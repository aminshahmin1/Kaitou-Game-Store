begin;
do $$
declare p uuid; o uuid; r jsonb; rate numeric; ledger_rows integer; n integer; units numeric;
begin
  select id into p from public.products order by id limit 1;
  rate:=public.manual_supplier_rate();
  select count(*) into ledger_rows from public.order_funding_allocations;
  insert into public.orders(product_id,order_number,customer_name,customer_email,customer_whatsapp,status,
    amount_myr,cost_usd,cost_myr,paid_at,supplier_cost_confirmed_at,is_test_order)
  values(p,'AUTO-QA-'||gen_random_uuid(),'QA','qa@example.invalid','0123456789','completed',20,10000,0,now(),now(),true) returning id into o;
  r:=public.allocate_order_funding(o);
  if (r->>'allocated')::boolean is not true or (r->>'costMyr')::numeric<>round(10000*rate,2) then raise exception 'Manual recognition still depends on funding'; end if;
  if (public.allocate_order_funding(o)->>'allocated')::boolean is not false then raise exception 'Duplicate recognition'; end if;
  if (select count(*) from public.order_funding_allocations)<>ledger_rows then raise exception 'Manual recognition altered deposit allocations'; end if;
  update public.orders set profit_allocated_at=null,status='refunded',cost_usd=1 where id=o;
  r:=public.allocate_order_funding(o);
  if (select net_profit_myr from public.orders where id=o)<>-round(rate,2)-1 then raise exception 'Refund hid unrecovered cost'; end if;
  update public.orders set profit_allocated_at=null,paid_at=null where id=o;
  if (public.allocate_order_funding(o)->>'allocated')::boolean is not false then raise exception 'Unpaid order recognised'; end if;
  for n in 1..5 loop
    insert into public.orders(product_id,order_number,customer_name,customer_email,customer_whatsapp,status,
      amount_myr,cost_usd,cost_myr,paid_at,is_test_order,ranking_game,ranking_unit,ranking_player_key,ranking_player_mask,ranking_units)
    values(p,'RANK-QA-'||gen_random_uuid(),'QA','qa@example.invalid','0123456789',
      case when n=4 then 'refunded'::public.kaitou_order_status else 'completed'::public.kaitou_order_status end,
      10,0,0,now(),n=5,'__automation_qa__','Units',repeat(case when n=3 then 'b' else 'a' end,64),
      case when n=3 then '****0002' else '****0001' end,case when n=1 then 100 when n=2 then 50 else 25 end);
  end loop;
  select total_units into units from public.currency_leaderboard() where game='__automation_qa__' and masked_player_id='****0001';
  select count(*) into n from public.currency_leaderboard() where game='__automation_qa__';
  if units<>150 or n<>2 then raise exception 'Repeated accounts did not accumulate or unrelated accounts merged'; end if;
end $$;
select 'PASS: Ledger-independent profit, duplicate/unpaid guards, refund losses, accumulated account ranking and separate players.' as result;
rollback;
