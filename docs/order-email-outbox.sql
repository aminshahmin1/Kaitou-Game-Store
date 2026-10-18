create table public.order_email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  audience text not null check(audience in ('customer','admin')),
  order_status text not null,
  payload jsonb not null,
  state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default clock_timestamp(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(order_id,audience,order_status)
);
alter table public.order_email_outbox enable row level security;
revoke all on public.order_email_outbox from anon,authenticated;
grant all on public.order_email_outbox to service_role;
create index order_email_outbox_pending on public.order_email_outbox(next_attempt_at,created_at) where state in ('pending','sending');

create function public.queue_order_email()
returns trigger language plpgsql security invoker set search_path='' as $$
declare payload jsonb;
begin
  if new.paid_at is null or new.status::text not in ('processing','completed','failed','review','refunded') then return new; end if;
  if old.paid_at is not null and old.status=new.status then return new; end if;
  payload := jsonb_build_object('orderNumber',new.order_number,'status',new.status::text,
    'product',coalesce(new.product_title,'Game order'),'variation',coalesce(new.variation_title,''),
    'name',new.customer_name,'email',new.customer_email,'whatsapp',new.customer_whatsapp,
    'fields',new.customer_fields,'amountMyr',new.amount_myr,'subtotalMyr',new.product_amount_myr,
    'feeMyr',new.payment_surcharge_myr,'paidAt',new.paid_at,'refundReference',new.refund_reference);
  insert into public.order_email_outbox(order_id,audience,order_status,payload)
    values(new.id,'customer',new.status::text,payload),(new.id,'admin',new.status::text,payload)
    on conflict(order_id,audience,order_status) do nothing;
  return new;
end $$;
create trigger queue_order_email after update on public.orders for each row execute function public.queue_order_email();

create function public.claim_order_email()
returns setof public.order_email_outbox language sql security invoker set search_path='' as $$
  update public.order_email_outbox q set state='sending',attempts=q.attempts+1,
    lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
  from (select id from public.order_email_outbox where attempts<5 and next_attempt_at<=clock_timestamp()
    and (state='pending' or (state='sending' and lease_until<clock_timestamp()))
    order by created_at,id for update skip locked limit 1) candidate
  where q.id=candidate.id returning q.*;
$$;
revoke all on function public.queue_order_email() from public,anon,authenticated;
revoke all on function public.claim_order_email() from public,anon,authenticated;
grant execute on function public.queue_order_email() to service_role;
grant execute on function public.claim_order_email() to service_role;
