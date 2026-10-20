begin;
do $$
declare p uuid; g text; n integer; lowest numeric; highest numeric;
begin
  select id into p from public.products order by id limit 1;
  if p is null then raise exception 'A product is required for rollback fixtures'; end if;
  foreach g in array array['__qa_top100_a__','__qa_top100_b__'] loop
    insert into public.orders(product_id,order_number,status,customer_name,customer_email,customer_whatsapp,
      amount_myr,cost_myr,paid_at,is_test_order,ranking_game,ranking_unit,ranking_player_key,ranking_player_mask,ranking_units)
    select p,'KGS-QA-'||gen_random_uuid(),'completed','QA rollback only','qa@example.invalid','0123456789',1,1,
      clock_timestamp(),false,g,'Units',md5(g||i::text), '****'||lpad(i::text,4,'0'),i from generate_series(1,105) i;
    select count(*),min(total_units),max(total_units) into n,lowest,highest from public.currency_leaderboard() where game=g;
    if n<>100 or lowest<>6 or highest<>105 then raise exception 'Top-100 partition/order failed for %',g; end if;
  end loop;
  if has_function_privilege('anon','public.currency_leaderboard()','execute') or has_function_privilege('authenticated','public.currency_leaderboard()','execute') then raise exception 'Raw ranking RPC is public'; end if;
end $$;
select 'PASS: each game has exactly its top 100 players, correct totals/order, and private RPC access; fixtures rolled back' as result;
rollback;
