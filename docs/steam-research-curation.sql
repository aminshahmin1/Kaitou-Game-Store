alter table public.steam_library_games
  add column if not exists curated_rank integer check(curated_rank between 1 and 500),
  add column if not exists curated_category text check(length(curated_category)<=80);
create index if not exists steam_library_curated_priority
  on public.steam_library_games(curated_rank asc nulls last, source_rank)
  where supplier_active;
