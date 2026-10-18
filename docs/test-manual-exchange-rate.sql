begin;
do $$
declare
  p uuid; o uuid; batch uuid; prices text; old_orders text; result jsonb; rate numeric;
begin
  select md5(string_agg(id::text||':'||price_myr::text,',' order by id)) into prices from public.product_variations;
  select md5(string_agg(id::text||':'||cost_myr::text,',' order by id)) into old_orders from public.orders;
  perform public.set_supplier_exchange_rate(4.25);
  if exists(select 1 from public.product_variations where cost_usd>0 and cost_myr<>round(cost_usd*4.25,2)) then raise exception 'Catalogue conversion mismatch'; end if;
  if prices<>(select md5(string_agg(id::text||':'||price_myr::text,',' order by id)) from public.product_variations) then raise exception 'Selling prices changed'; end if;
  if old_orders<>(select md5(string_agg(id::text||':'||cost_myr::text,',' order by id)) from public.orders) then raise exception 'Historical costs changed'; end if;
  if has_function_privilege('anon','public.set_supplier_exchange_rate(numeric)','execute')
    or has_function_privilege('authenticated','public.set_supplier_exchange_rate(numeric)','execute') then raise exception 'Public mutation permitted'; end if;
  select id into p from public.products order by id limit 1;
  insert into public.funding_batches(topup_date,myr_spent,usd_credited,effective_rate)
    values('1900-01-01',10,2,5) returning id into batch;
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,status,paid_at,supplier_cost_confirmed_at,is_test_order)
    values('FX-ROLLBACK-'||gen_random_uuid(),p,'Rollback QA','qa@example.invalid','000000000',11,0,1.5,'completed',now(),now(),true) returning id into o;
  select cost_exchange_rate into rate from public.orders where id=o;
  if rate<>4.25 then raise exception 'Order rate not captured'; end if;
  perform public.set_supplier_exchange_rate(4.08);
  result:=public.allocate_order_funding(o);
  if (result->>'allocated')::boolean is not true or (result->>'costMyr')::numeric<>6.38 then raise exception 'Snapshot allocation mismatch: %',result; end if;
  if (select net_profit_myr from public.orders where id=o)<>3.62 then raise exception 'Profit mismatch'; end if;
  if (select effective_rate from public.order_funding_allocations where order_id=o)<>4.25 then raise exception 'Funding fee rate leaked into cost'; end if;
  if (select cost_exchange_rate from public.orders where id=o)<>4.25 then raise exception 'Rate change rewrote order'; end if;
  if (public.allocate_order_funding(o)->>'allocated')::boolean is not false then raise exception 'Duplicate allocation'; end if;
end $$;
select 'PASS: Global conversion, unchanged selling prices/history, private mutation, frozen order rate, fee-free cost and duplicate allocation protection.' as result;
rollback;
