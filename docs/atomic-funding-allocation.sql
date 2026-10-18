-- Server-only, atomic FIFO allocation of a confirmed supplier debit.
create or replace function public.allocate_order_funding(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_batch record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_cost numeric := 0;
  v_piece numeric;
begin
  -- Serialize allocations across orders, then lock the order against admin edits.
  perform pg_catalog.pg_advisory_xact_lock(742019, 1);
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('allocated', false, 'reason', 'Order not found.'); end if;
  if v_order.profit_allocated_at is not null then
    return jsonb_build_object('allocated', false, 'reason', 'Order already allocated.');
  end if;
  if v_order.paid_at is null or v_order.supplier_cost_confirmed_at is null
     or v_order.status::text not in ('processing', 'completed', 'review') then
    return jsonb_build_object('allocated', false, 'reason', 'Verified payment and confirmed supplier debit are required.');
  end if;
  if v_order.cost_usd <= 0 or v_order.cost_usd::text in ('NaN','Infinity','-Infinity') then
    return jsonb_build_object('allocated', false, 'reason', 'Supplier cost must be positive.');
  end if;
  if exists (select 1 from public.order_funding_allocations where order_id = p_order_id) then
    return jsonb_build_object('allocated', false, 'reason', 'Existing partial allocations require reconciliation.');
  end if;

  -- Lock funding batches before deriving their unspent amounts.
  perform id from public.funding_batches where provider = 'fazercards'
    order by topup_date, created_at, id for update;
  select coalesce(sum(greatest(0, f.usd_credited - f.opening_used_usd - coalesce(a.used, 0))), 0)
    into v_available
    from public.funding_batches f
    left join (select funding_batch_id, sum(amount_usd) used
               from public.order_funding_allocations group by funding_batch_id) a
      on a.funding_batch_id = f.id
    where f.provider = 'fazercards';
  if v_available < v_order.cost_usd then
    return jsonb_build_object('allocated', false, 'reason', 'Not enough recorded funding. Add or reconcile funding before allocation.');
  end if;
  v_remaining := v_order.cost_usd;
  for v_batch in
    select f.id, f.effective_rate, greatest(0, f.usd_credited - f.opening_used_usd - coalesce(a.used, 0)) remaining
    from public.funding_batches f
    left join (select funding_batch_id, sum(amount_usd) used
               from public.order_funding_allocations group by funding_batch_id) a
      on a.funding_batch_id = f.id
    where f.provider = 'fazercards'
    order by f.topup_date, f.created_at, f.id
  loop
    exit when v_remaining = 0;
    v_take := least(v_batch.remaining, v_remaining);
    if v_take <= 0 then continue; end if;
    v_piece := round(v_take * v_batch.effective_rate, 2);
    insert into public.order_funding_allocations(order_id, funding_batch_id, amount_usd, effective_rate, cost_myr)
      values(p_order_id, v_batch.id, v_take, v_batch.effective_rate, v_piece);
    v_cost := v_cost + v_piece;
    v_remaining := v_remaining - v_take;
  end loop;
  if v_remaining <> 0 then raise exception 'Funding changed during allocation'; end if;
  update public.orders set cost_myr = v_cost,
    gross_profit_myr = round(amount_myr - v_cost, 2),
    net_profit_myr = round(amount_myr - v_cost - payment_fee_myr, 2),
    profit_allocated_at = now()
    where id = p_order_id;
  return jsonb_build_object('allocated', true, 'costMyr', v_cost);
end;
$$;
revoke all on function public.allocate_order_funding(uuid) from public, anon, authenticated;
grant execute on function public.allocate_order_funding(uuid) to service_role;
