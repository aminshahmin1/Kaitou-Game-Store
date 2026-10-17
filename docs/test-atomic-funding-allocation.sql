begin;
do $$
declare
  p uuid; o uuid; other_order uuid; a uuid; b uuid;
  r jsonb; total numeric;
begin
  if exists(select 1 from public.funding_batches) then raise exception 'Test requires empty funding ledger'; end if;
  select id into p from public.products order by id limit 1;
  if p is null then raise exception 'No product for test'; end if;
  insert into public.funding_batches(topup_date,myr_spent,usd_credited,effective_rate)
    values('2026-01-01',4,1,4) returning id into a;
  insert into public.funding_batches(topup_date,myr_spent,usd_credited,effective_rate)
    values('2026-01-02',5,1,5) returning id into b;
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,status,paid_at,supplier_cost_confirmed_at)
    values('ROLLBACK-'||gen_random_uuid(),p,'Rollback QA','qa@example.invalid','000000000',10,0,1.5,'completed',now(),now()) returning id into o;
  r := public.allocate_order_funding(o);
  if (r->>'allocated')::boolean is not true or (r->>'costMyr')::numeric <> 6.5 then raise exception 'FIFO cost mismatch'; end if;
  select net_profit_myr into total from public.orders where id=o;
  if total <> 2.5 then raise exception 'Net profit mismatch'; end if;
  if (select count(*) from public.order_funding_allocations where order_id=o) <> 2 then raise exception 'Expected two funding allocations'; end if;
  r := public.allocate_order_funding(o);
  if (r->>'allocated')::boolean is not false then raise exception 'Repeat allocation was not idempotent'; end if;
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,status,paid_at,supplier_cost_confirmed_at)
    values('ROLLBACK-'||gen_random_uuid(),p,'Rollback QA','qa@example.invalid','000000000',10,0,0.6,'completed',now(),now()) returning id into other_order;
  r := public.allocate_order_funding(other_order);
  if (r->>'allocated')::boolean is not false then raise exception 'Over-allocation allowed'; end if;
  if exists(select 1 from public.order_funding_allocations where order_id=other_order) then raise exception 'Partial allocations leaked'; end if;
  update public.orders set cost_usd=0.5,paid_at=null where id=other_order;
  r := public.allocate_order_funding(other_order);
  if (r->>'allocated')::boolean is not false then raise exception 'Unpaid order allocated'; end if;
  update public.orders set paid_at=now(),supplier_cost_confirmed_at=null where id=other_order;
  r := public.allocate_order_funding(other_order);
  if (r->>'allocated')::boolean is not false then raise exception 'Unconfirmed quote allocated'; end if;
  update public.orders set supplier_cost_confirmed_at=now() where id=other_order;
  r := public.allocate_order_funding(other_order);
  if (r->>'allocated')::boolean is not true then raise exception 'Exact remaining balance rejected'; end if;
  if (select sum(amount_usd) from public.order_funding_allocations) <> 2 then raise exception 'Ledger total mismatch'; end if;
end $$;
rollback;
