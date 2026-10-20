create or replace function public.currency_leaderboard()
returns table(game text,unit text,masked_player_id text,total_units numeric)
language sql stable security invoker set search_path='' as $$
  with totals as (
    select ranking_game,ranking_unit,ranking_player_key,ranking_player_mask,sum(ranking_units) as units
    from public.orders where status='completed' and paid_at is not null and not is_test_order
      and refund_reference is null and ranking_units>0
      and ranking_game is not null and ranking_unit is not null and ranking_player_key is not null
      and ranking_player_mask is not null
    group by ranking_game,ranking_unit,ranking_player_key,ranking_player_mask
  ), ranked as (
    select *,row_number() over(partition by ranking_game,ranking_unit order by units desc,ranking_player_key) as place
    from totals
  )
  select ranking_game,ranking_unit,ranking_player_mask,units from ranked where place<=100
  order by ranking_game,ranking_unit,place;
$$;
revoke all on function public.currency_leaderboard() from public,anon,authenticated;
grant execute on function public.currency_leaderboard() to service_role;
