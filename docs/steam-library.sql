create extension if not exists pg_trgm with schema extensions;
create table public.steam_library_games (
  appid bigint primary key check (appid > 0),
  name text not null,
  source_rank integer not null default 0,
  supplier_active boolean not null default true,
  metadata_status text not null default 'pending' check (metadata_status in ('pending','eligible','excluded')),
  metadata_checked_at timestamptz,
  metadata_attempt_at timestamptz,
  image_url text,
  description text,
  product_id uuid references public.products(id) on delete set null
);
alter table public.steam_library_games enable row level security;
revoke all on public.steam_library_games from public,anon,authenticated;
grant all on public.steam_library_games to service_role;
create index steam_library_name_search on public.steam_library_games using gin (name extensions.gin_trgm_ops);
create index steam_library_pending on public.steam_library_games(metadata_status,source_rank) where supplier_active;
create index steam_library_product on public.steam_library_games(product_id) where product_id is not null;
create table public.steam_library_sync (
  singleton boolean primary key default true check (singleton),
  full_sync_at timestamptz,
  lease_token uuid,
  lease_until timestamptz not null default '-infinity'
);
alter table public.steam_library_sync enable row level security;
revoke all on public.steam_library_sync from public,anon,authenticated;
grant all on public.steam_library_sync to service_role;
insert into public.steam_library_sync(singleton) values(true);
create function public.claim_steam_catalog_sync() returns uuid
language sql security invoker set search_path='' as $$
  update public.steam_library_sync set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  where singleton and lease_until<now() and (full_sync_at is null or full_sync_at<now()-interval '3 hours')
  returning lease_token;
$$;
create function public.ingest_steam_catalog(p_games jsonb,p_token uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare result integer;
begin
  perform 1 from public.steam_library_sync where singleton and lease_token=p_token and lease_until>now() for update;
  if not found or jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)<1 then raise exception 'Invalid catalog sync'; end if;
  with input as materialized (
    select (item->>'appid')::bigint appid,left(item->>'name',500) name,ordinality::integer source_rank
    from jsonb_array_elements(p_games) with ordinality as entries(item,ordinality)
  ), upserted as (
    insert into public.steam_library_games(appid,name,source_rank) select appid,name,source_rank from input
    on conflict(appid) do update set name=excluded.name,source_rank=excluded.source_rank,supplier_active=true
    where (steam_library_games.name,steam_library_games.source_rank,steam_library_games.supplier_active)
      is distinct from (excluded.name,excluded.source_rank,true)
    returning appid
  )
  update public.steam_library_games g set supplier_active=false where g.supplier_active and not exists(select 1 from input i where i.appid=g.appid);
  result:=jsonb_array_length(p_games);
  update public.steam_library_sync set full_sync_at=now(),lease_token=null,lease_until=now() where singleton;
  return result;
end; $$;
revoke all on function public.claim_steam_catalog_sync() from public,anon,authenticated;
revoke all on function public.ingest_steam_catalog(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.claim_steam_catalog_sync(),public.ingest_steam_catalog(jsonb,uuid) to service_role;
