begin;
do $$
declare p uuid; o uuid; job public.order_email_outbox%rowtype; job2 public.order_email_outbox%rowtype;
begin
  if exists(select 1 from public.order_email_outbox) then raise exception 'Email test requires empty queue'; end if;
  select id into p from public.products order by id limit 1;
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,product_title,variation_title)
    values('ROLLBACK-'||gen_random_uuid(),p,'QA','qa@example.invalid','000000000',2.1,.96,.2317,'Mobile Legends','13 + 1') returning id into o;
  update public.orders set support_notes='Unpaid note' where id=o;
  if exists(select 1 from public.order_email_outbox) then raise exception 'Unpaid email queued'; end if;
  update public.orders set status='processing',paid_at=clock_timestamp() where id=o;
  update public.orders set support_notes='Paid note' where id=o;
  if (select count(*) from public.order_email_outbox)<>2 then raise exception 'Duplicate status emails queued'; end if;
  select * into job from public.claim_order_email();
  if job.id is null or job.attempts<>1 or job.state<>'sending' then raise exception 'Claim failed'; end if;
  select * into job2 from public.claim_order_email();
  if job2.id=job.id then raise exception 'Lease did not exclude active job'; end if;
  update public.orders set status='completed' where id=o;
  if (select count(*) from public.order_email_outbox)<>4 then raise exception 'Completed emails missing'; end if;
end $$;
rollback;
