-- Kaitou Game Store schema.
-- Public catalog rows can be read by visitors. Admin writes go through server-side route handlers using the service role key.

create extension if not exists pgcrypto;

do $$ begin
  create type public.kaitou_product_type as enum ('topup', 'steam_gift_game');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.kaitou_order_status as enum ('pending_payment', 'processing', 'completed', 'failed', 'review', 'refunded');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.kaitou_staff_role as enum ('admin', 'support');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.kaitou_staff_role not null default 'support',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type public.kaitou_product_type not null,
  category text not null,
  game text not null,
  description text,
  image_url text,
  image_tone text not null default 'from-sky-500 via-blue-700 to-slate-950',
  region text not null default 'MY',
  delivery_type text not null,
  required_fields jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  fazercards_product_id text,
  active boolean not null default true,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  sku text not null,
  fazercards_sku text,
  price_myr numeric(12, 2) not null,
  cost_myr numeric(12, 2) not null default 0,
  active boolean not null default true,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  product_id uuid not null references public.products(id),
  product_variation_id uuid references public.product_variations(id),
  status public.kaitou_order_status not null default 'pending_payment',
  customer_name text not null,
  customer_email text not null,
  customer_whatsapp text not null,
  customer_fields jsonb not null default '{}'::jsonb,
  amount_myr numeric(12, 2) not null,
  cost_myr numeric(12, 2) not null,
  payment_provider text not null default 'toyyibpay',
  payment_reference text,
  payment_raw jsonb,
  fulfillment_provider text not null default 'fazercards',
  fulfillment_reference text,
  fulfillment_raw jsonb,
  failure_reason text,
  support_notes text,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_settings (
  id text primary key,
  provider text not null,
  enabled boolean not null default false,
  public_config jsonb not null default '{}'::jsonb,
  encrypted_secret_reference text,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_product_variations_updated_at on public.product_variations;
create trigger set_product_variations_updated_at
before update on public.product_variations
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variations enable row level security;
alter table public.orders enable row level security;
alter table public.integration_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read active variations" on public.product_variations;
create policy "Public can read active variations"
on public.product_variations
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.products
    where products.id = product_variations.product_id
      and products.active = true
  )
);

create index if not exists products_active_sort_idx on public.products (active, sort_order, title);
create index if not exists product_variations_product_sort_idx on public.product_variations (product_id, active, sort_order, price_myr);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_payment_reference_idx on public.orders (payment_reference);
