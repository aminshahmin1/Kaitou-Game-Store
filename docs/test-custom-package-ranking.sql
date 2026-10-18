begin;
do $$
declare i integer; t numeric; count_rows integer; q uuid; n integer; p uuid;
begin
  select id into p from public.products order by id limit 1;
  if p is null then raise exception 'A product is required for rollback fixtures'; end if;
  for i in 1..8 loop
    insert into public.orders(product_id,order_number,status,customer_name,customer_email,customer_whatsapp,
      amount_myr,cost_myr,paid_at,is_test_order,ranking_game,ranking_unit,ranking_player_key,
      ranking_player_mask,ranking_units,refund_reference)
    values(p,'KGS-QA-'||gen_random_uuid(),case when i=5 then 'review'::public.kaitou_order_status
      when i=6 then 'refunded'::public.kaitou_order_status else 'completed'::public.kaitou_order_status end,
      'QA','qa@example.invalid','0123456789',123,1,case when i=4 then null else clock_timestamp() end,
      i=3,'__qa_currency__','Diamonds',repeat('a',64),'****7481',
      case when i=1 then 100 when i=2 then 50 when i=8 then 0 else 1000 end,
      case when i=7 then 'qa-refund' else null end);
  end loop;
  select total_units into t from public.currency_leaderboard() where game='__qa_currency__';
  select count(*) into count_rows from public.currency_leaderboard() where game='__qa_currency__';
  if t<>150 or count_rows<>1 then raise exception 'Ranking exclusions or accumulation failed'; end if;
  if has_function_privilege('anon','public.currency_leaderboard()','execute') then raise exception 'Raw ranking RPC is public'; end if;
  insert into public.orders(product_id,order_number,status,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,
    cost_usd,paid_at,fulfillment_reference)
  values(p,'KGS-QA-'||gen_random_uuid(),'processing','QA','qa@example.invalid','0123456789',10,1,
    0.4,clock_timestamp(),'bundle-QA-'||gen_random_uuid()) returning id into q;
  insert into public.supplier_reservations(order_id,amount_usd,state,expires_at)
    values(q,0.4,'held',clock_timestamp()+interval '15 minutes');
  perform public.claim_bundle_order();
  select count(*) into n from public.claim_bundle_order();
  if n<>0 then raise exception 'Bundle lease allowed overlapping claims'; end if;
  update public.orders set supplier_cost_confirmed_at=clock_timestamp() where id=q;
  select count(*) into n from public.supplier_reservations where order_id=q and state='debited' and amount_usd=0.4;
  if n<>1 then raise exception 'Combined debit not settled'; end if;
end $$;
select 'PASS: accumulation, test/unpaid/review/refund exclusions, private RPC, exclusive bundle lease and combined reservation settlement' as result;
rollback;
