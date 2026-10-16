alter table public.orders
  add column if not exists product_amount_myr numeric(12,2) check (product_amount_myr >= 0),
  add column if not exists payment_surcharge_myr numeric(12,2) not null default 0 check (payment_surcharge_myr >= 0);

-- Existing orders retain their original totals; no retroactive surcharge.
