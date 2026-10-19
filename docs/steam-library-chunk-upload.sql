alter table public.steam_library_games add column source_generation uuid;
alter table public.steam_library_sync add column catalog_generation uuid;
alter table public.steam_library_sync add column catalog_hash text;
alter table public.steam_library_sync add column last_fetch_at timestamptz;
create or replace function public.claim_steam_catalog_sync() returns uuid
language sql security invoker set search_path='' as $$
  update public.steam_library_sync set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',last_fetch_at=now()
  where singleton and lease_until<now() and (last_fetch_at is null or last_fetch_at<now()-interval '3 minutes')
    and (pending_count>0 or full_sync_at is null or full_sync_at<now()-interval '24 hours') returning lease_token;
$$;
create function public.begin_steam_catalog_chunks(p_token uuid,p_total integer,p_hash text) returns integer
language plpgsql security invoker set search_path='' as $$
declare state public.steam_library_sync;
begin
  select * into state from public.steam_library_sync where singleton for update;
  if state.lease_token is distinct from p_token or state.lease_until<now() or p_total<1 or p_total>1000000 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid catalogue lease'; end if;
  if state.catalog_hash is distinct from p_hash or state.pending_count=0 then
    update public.steam_library_sync set catalog_generation=gen_random_uuid(),catalog_hash=p_hash,pending_count=p_total,next_offset=0,pending_games=null where singleton;
    return 0;
  end if;
  if state.pending_count<>p_total then raise exception 'Catalogue size changed'; end if;
  return state.next_offset;
end; $$;
create function public.ingest_steam_catalog_chunk(p_token uuid,p_games jsonb,p_offset integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare state public.steam_library_sync; n integer;
begin
  select * into state from public.steam_library_sync where singleton for update;
  n:=jsonb_array_length(p_games);
  if state.lease_token is distinct from p_token or state.lease_until<now() or n<1 or n>2000 or p_offset<>state.next_offset or p_offset+n>state.pending_count then raise exception 'Invalid catalogue chunk'; end if;
  insert into public.steam_library_games(appid,name,source_rank,source_generation)
    select (item->>'appid')::bigint,left(item->>'name',500),p_offset+ordinality::integer,state.catalog_generation from jsonb_array_elements(p_games) with ordinality as rows(item,ordinality)
    on conflict(appid) do update set name=excluded.name,source_rank=excluded.source_rank,source_generation=excluded.source_generation,supplier_active=true;
  if p_offset+n=state.pending_count then
    update public.steam_library_games set supplier_active=false where supplier_active and source_generation is distinct from state.catalog_generation;
    update public.steam_library_sync set full_sync_at=now(),pending_count=0,next_offset=0,lease_token=null,lease_until=now() where singleton;
  else
    update public.steam_library_sync set next_offset=next_offset+n,lease_until=now()+interval '2 minutes' where singleton;
  end if;
  return jsonb_build_object('processed',n,'remaining',state.pending_count-p_offset-n);
end; $$;
revoke all on function public.begin_steam_catalog_chunks(uuid,integer,text),public.ingest_steam_catalog_chunk(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.begin_steam_catalog_chunks(uuid,integer,text),public.ingest_steam_catalog_chunk(uuid,jsonb,integer) to service_role;
-- Retire the earlier large-payload entry points; the bounded importer is authoritative.
revoke execute on function public.ingest_steam_catalog(jsonb,uuid),public.apply_steam_catalog_batch() from service_role;
