-- Apply before the revised atomic-funding-allocation.sql.
insert into public.integration_settings(id,provider,enabled,public_config)
values('supplier-exchange-rate','fazercards',true,'{"usdMyr":4.08}'::jsonb)
on conflict(id) do nothing;

alter table public.orders add column cost_exchange_rate numeric(12,6)
  check(cost_exchange_rate>0 and cost_exchange_rate<=10000);

create function public.manual_supplier_rate() returns numeric
language plpgsql security invoker set search_path='' as $$
declare v_rate numeric;
begin
  select (public_config->>'usdMyr')::numeric into v_rate from public.integration_settings
    where id='supplier-exchange-rate' for share;
  if v_rate is null or v_rate<=0 or v_rate>10000 or v_rate::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Invalid manual exchange rate';
  end if;
  return v_rate;
end $$;

create function public.apply_manual_variation_cost() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.cost_usd>0 then new.cost_myr:=round(new.cost_usd*public.manual_supplier_rate(),2); end if;
  return new;
end $$;
create trigger variation_manual_exchange_cost before insert or update on public.product_variations
  for each row execute function public.apply_manual_variation_cost();

create function public.snapshot_order_exchange_rate() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.cost_exchange_rate:=public.manual_supplier_rate();
  new.cost_myr:=round(new.cost_usd*new.cost_exchange_rate,2);
  return new;
end $$;
create trigger order_manual_exchange_snapshot before insert on public.orders
  for each row execute function public.snapshot_order_exchange_rate();

create function public.set_supplier_exchange_rate(p_rate numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
  if p_rate is null or p_rate<=0 or p_rate>10000 or p_rate::text in ('NaN','Infinity','-Infinity')
    or round(p_rate,6)<>p_rate then raise exception 'Invalid exchange rate'; end if;
  update public.integration_settings set public_config=jsonb_build_object('usdMyr',p_rate),updated_at=clock_timestamp()
    where id='supplier-exchange-rate';
  if not found then raise exception 'Exchange rate setting missing'; end if;
  update public.product_variations set cost_myr=round(cost_usd*p_rate,2) where cost_usd>0;
  get diagnostics v_count=row_count;
  return jsonb_build_object('rate',p_rate,'updated',v_count);
end $$;

revoke all on function public.manual_supplier_rate(),public.apply_manual_variation_cost(),
  public.snapshot_order_exchange_rate(),public.set_supplier_exchange_rate(numeric) from public,anon,authenticated;
grant execute on function public.manual_supplier_rate(),public.apply_manual_variation_cost(),
  public.snapshot_order_exchange_rate(),public.set_supplier_exchange_rate(numeric) to service_role;

select public.set_supplier_exchange_rate(4.08);
