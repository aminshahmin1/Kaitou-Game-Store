alter table public.steam_library_sync add column pending_games jsonb;
alter table public.steam_library_sync add column pending_count integer not null default 0;
alter table public.steam_library_sync add column next_offset integer not null default 0;
create or replace function public.claim_steam_catalog_sync() returns uuid
language sql security invoker set search_path='' as $$
  update public.steam_library_sync set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  where singleton and pending_count=0 and lease_until<now() and (full_sync_at is null or full_sync_at<now()-interval '3 hours') returning lease_token;
$$;
create or replace function public.ingest_steam_catalog(p_games jsonb,p_token uuid) returns integer
language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)<1 then raise exception 'Invalid catalogue'; end if;
  update public.steam_library_sync set pending_games=p_games,pending_count=jsonb_array_length(p_games),next_offset=0,lease_token=null,lease_until=now()
    where singleton and lease_token=p_token and lease_until>now() and pending_count=0;
  if not found then raise exception 'Catalogue lease expired'; end if;
  return jsonb_array_length(p_games);
end; $$;
create function public.apply_steam_catalog_batch() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare state public.steam_library_sync; batch jsonb; batch_size integer;
begin
  select * into state from public.steam_library_sync where singleton for update;
  if state.pending_count=0 then return jsonb_build_object('processed',0,'remaining',0); end if;
  batch:=jsonb_path_query_array(state.pending_games,format('$[%s to %s]',state.next_offset,least(state.next_offset+1999,state.pending_count-1))::jsonpath);
  batch_size:=jsonb_array_length(batch);
  if batch_size=0 then raise exception 'Invalid catalogue cursor'; end if;
  insert into public.steam_library_games(appid,name,source_rank)
    select (item->>'appid')::bigint,left(item->>'name',500),state.next_offset+ordinality::integer
    from jsonb_array_elements(batch) with ordinality as entries(item,ordinality)
    on conflict(appid) do update set name=excluded.name,source_rank=excluded.source_rank,supplier_active=true
    where (steam_library_games.name,steam_library_games.source_rank,steam_library_games.supplier_active) is distinct from (excluded.name,excluded.source_rank,true);
  if state.next_offset+batch_size>=state.pending_count then
    update public.steam_library_games g set supplier_active=false where g.supplier_active
      and not exists(select 1 from jsonb_to_recordset(state.pending_games) as r(appid bigint) where r.appid=g.appid);
    update public.steam_library_sync set full_sync_at=now(),pending_games=null,pending_count=0,next_offset=0 where singleton;
    return jsonb_build_object('processed',batch_size,'remaining',0);
  end if;
  update public.steam_library_sync set next_offset=next_offset+batch_size where singleton;
  return jsonb_build_object('processed',batch_size,'remaining',state.pending_count-state.next_offset-batch_size);
end; $$;
revoke all on function public.apply_steam_catalog_batch() from public,anon,authenticated;
grant execute on function public.apply_steam_catalog_batch() to service_role;
