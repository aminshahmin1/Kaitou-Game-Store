alter table public.orders add column if not exists fulfillment_snapshot jsonb;
alter table public.orders add column if not exists supplier_cost_confirmed_at timestamptz;
-- Do not backfill from today's catalogue: an old order may refer to a different SKU.
