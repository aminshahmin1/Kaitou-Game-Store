-- Applied using Supabase migration provider_balance_monitor.
create table public.provider_balance_monitor (
  id text primary key check (id = 'fazercards'),
  balance_usd numeric(20,4),
  blocked_variations integer not null default 0,
  checked_at timestamptz,
  lease_until timestamptz not null default '1970-01-01',
  last_alert_at timestamptz not null default '1970-01-01'
);
alter table public.provider_balance_monitor enable row level security;
revoke all on public.provider_balance_monitor from public, anon, authenticated;
grant select,insert,update on public.provider_balance_monitor to service_role;
insert into public.provider_balance_monitor(id) values ('fazercards');
create extension if not exists pg_cron;
create extension if not exists pg_net;
