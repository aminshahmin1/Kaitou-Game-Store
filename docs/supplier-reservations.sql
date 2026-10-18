create table public.supplier_reservations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  amount_usd numeric(18,4) not null check (amount_usd > 0),
  state text not null check (state in ('held','debited','released')),
  expires_at timestamptz not null,
  debited_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.supplier_reservations enable row level security;
revoke all on public.supplier_reservations from anon, authenticated;
grant all on public.supplier_reservations to service_role;
alter table public.orders add column payment_expires_at timestamptz;
alter table public.orders add column product_title text;
alter table public.orders add column variation_title text;

create function public.expire_supplier_reservations()
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(742019,2);
  update public.supplier_reservations r set state='released'
    from public.orders o where o.id=r.order_id and r.state='held'
    and o.paid_at is null and r.expires_at < clock_timestamp();
  get diagnostics n = row_count;
  return n;
end $$;

create function public.available_supplier_credit(p_balance numeric, p_observed_at timestamptz, p_exclude uuid default null)
returns numeric language plpgsql security invoker set search_path='' as $$
declare held numeric;
begin
  if p_balance is null or p_balance < 0 or p_balance::text in ('NaN','Infinity','-Infinity')
    or p_observed_at is null or p_observed_at < clock_timestamp()-interval '30 seconds'
    or p_observed_at > clock_timestamp()+interval '2 seconds' then
    raise exception 'A fresh valid supplier balance is required';
  end if;
  perform public.expire_supplier_reservations();
  select coalesce(sum(amount_usd),0) into held from public.supplier_reservations
    where (p_exclude is null or order_id<>p_exclude)
    and (state='held' or (state='debited' and debited_at>=p_observed_at));
  return greatest(0,p_balance-held);
end $$;

create function public.reserve_supplier_credit(p_order_number text, p_balance numeric, p_observed_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.orders%rowtype; free numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(742019,2);
  select * into o from public.orders where order_number=p_order_number;
  if not found or o.status::text not in ('pending_payment','processing') or o.cost_usd<=0
     or o.cost_usd::text in ('NaN','Infinity','-Infinity') then return false; end if;
  if o.paid_at is null and o.payment_expires_at <= clock_timestamp() then return false; end if;
  if exists(select 1 from public.supplier_reservations where order_id=o.id and state='debited') then return true; end if;
  free := public.available_supplier_credit(p_balance,p_observed_at,o.id);
  if free < o.cost_usd then return false; end if;
  insert into public.supplier_reservations(order_id,amount_usd,state,expires_at)
    values(o.id,o.cost_usd,'held',coalesce(o.payment_expires_at,clock_timestamp()+interval '15 minutes')+interval '2 minutes')
    on conflict(order_id) do update set amount_usd=excluded.amount_usd,state='held',expires_at=excluded.expires_at;
  return true;
end $$;

create function public.settle_supplier_reservation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.supplier_cost_confirmed_at is not null and new.fulfillment_reference like 'ord-%' then
    update public.supplier_reservations set state='debited',amount_usd=new.cost_usd,debited_at=clock_timestamp()
      where order_id=new.id and state='held';
  elsif new.status::text='refunded' then
    -- Fence any in-flight debit until the next fresh provider observation.
    update public.supplier_reservations set state='debited',debited_at=clock_timestamp()
      where order_id=new.id and state='held';
  end if;
  return new;
end $$;
create trigger settle_supplier_reservation after update on public.orders
  for each row execute function public.settle_supplier_reservation();
revoke all on function public.expire_supplier_reservations() from public,anon,authenticated;
revoke all on function public.available_supplier_credit(numeric,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.reserve_supplier_credit(text,numeric,timestamptz) from public,anon,authenticated;
revoke all on function public.settle_supplier_reservation() from public,anon,authenticated;
grant execute on function public.expire_supplier_reservations() to service_role;
grant execute on function public.available_supplier_credit(numeric,timestamptz,uuid) to service_role;
grant execute on function public.reserve_supplier_credit(text,numeric,timestamptz) to service_role;
grant execute on function public.settle_supplier_reservation() to service_role;
