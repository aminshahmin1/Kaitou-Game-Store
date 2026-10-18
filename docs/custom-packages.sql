alter table public.product_variations
  add column supplier_quantity integer not null default 1 check(supplier_quantity between 1 and 5),
  add column repeatable boolean not null default false,
  add column base_package_title text;
alter table public.product_variations add constraint custom_package_approved
  check(supplier_quantity=1 or (repeatable and base_package_title is not null));
alter table public.orders add column bundle_lease_until timestamptz;
create index orders_pending_bundles on public.orders(updated_at) where status='processing' and fulfillment_reference like 'bundle-%';
create function public.claim_bundle_order()
returns setof public.orders language sql security invoker set search_path='' as $$
  update public.orders o set bundle_lease_until=clock_timestamp()+interval '2 minutes'
  from (select id from public.orders where status='processing' and paid_at is not null
    and fulfillment_reference like 'bundle-%'
    and (bundle_lease_until is null or bundle_lease_until<clock_timestamp())
    order by updated_at,id for update skip locked limit 1) candidate
  where o.id=candidate.id returning o.*;
$$;
revoke all on function public.claim_bundle_order() from public,anon,authenticated;
grant execute on function public.claim_bundle_order() to service_role;
create or replace function public.settle_supplier_reservation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.supplier_cost_confirmed_at is not null and (new.fulfillment_reference like 'ord-%' or new.fulfillment_reference like 'bundle-%') then
    update public.supplier_reservations set state='debited',amount_usd=new.cost_usd,debited_at=clock_timestamp()
      where order_id=new.id and state='held';
  elsif new.status::text='refunded' then
    update public.supplier_reservations set state='debited',debited_at=clock_timestamp()
      where order_id=new.id and state='held';
  end if;
  return new;
end $$;
revoke all on function public.settle_supplier_reservation() from public,anon,authenticated;
grant execute on function public.settle_supplier_reservation() to service_role;
