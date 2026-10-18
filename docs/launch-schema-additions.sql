alter table public.orders add column if not exists is_test_order boolean not null default false;
alter table public.funding_batches add column if not exists opening_used_usd numeric(18,4) not null default 0
  check (opening_used_usd >= 0 and opening_used_usd <= usd_credited);
