create table public.steam_library_packages (
  subid bigint primary key check(subid>0),
  appids bigint[] not null,
  checked_at timestamptz not null default now()
);
alter table public.steam_library_packages enable row level security;
revoke all on public.steam_library_packages from public,anon,authenticated;
grant all on public.steam_library_packages to service_role;
