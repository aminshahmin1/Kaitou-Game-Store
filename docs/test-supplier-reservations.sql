begin;
do $$
declare p uuid; a uuid; b uuid; n1 text; n2 text; observed timestamptz; result boolean; free numeric;
begin
  if exists(select 1 from public.supplier_reservations) then raise exception 'Reservation test requires empty ledger'; end if;
  select id into p from public.products order by id limit 1;
  n1 := 'ROLLBACK-'||gen_random_uuid(); n2 := 'ROLLBACK-'||gen_random_uuid();
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,payment_expires_at)
    values(n1,p,'Rollback QA','qa@example.invalid','000000000',5,4,1,clock_timestamp()+interval '15 minutes') returning id into a;
  insert into public.orders(order_number,product_id,customer_name,customer_email,customer_whatsapp,amount_myr,cost_myr,cost_usd,payment_expires_at)
    values(n2,p,'Rollback QA','qa@example.invalid','000000000',5,4,1,clock_timestamp()+interval '15 minutes') returning id into b;
  observed := clock_timestamp();
  if not public.reserve_supplier_credit(n1,1.5,observed) then raise exception 'First reservation rejected'; end if;
  if public.reserve_supplier_credit(n2,1.5,observed) then raise exception 'Same balance spent twice'; end if;
  if public.available_supplier_credit(1.5,observed) <> .5 then raise exception 'Held money not excluded'; end if;
  update public.orders set payment_expires_at=clock_timestamp()-interval '5 minutes' where id=a;
  update public.supplier_reservations set expires_at=clock_timestamp()-interval '1 minute' where order_id=a;
  perform public.expire_supplier_reservations();
  if not public.reserve_supplier_credit(n2,1.5,observed) then raise exception 'Expired unpaid credit not restored'; end if;
  update public.orders set status='processing',paid_at=clock_timestamp() where id=a;
  if public.reserve_supplier_credit(n1,1.5,observed) then raise exception 'Late payment bypassed funding check'; end if;
  update public.orders set status='processing',paid_at=clock_timestamp(),fulfillment_reference='ord-rollback',supplier_cost_confirmed_at=clock_timestamp() where id=b;
  if public.available_supplier_credit(1.5,observed) <> .5 then raise exception 'Old balance sample ignored new debit'; end if;
  if public.available_supplier_credit(.5,clock_timestamp()) <> .5 then raise exception 'Fresh balance double-counted debit'; end if;
  if not public.reserve_supplier_credit(n1,1.5,clock_timestamp()) then raise exception 'Late paid order rejected after replenishment'; end if;
  update public.supplier_reservations set expires_at=clock_timestamp()-interval '1 minute' where order_id=a;
  perform public.expire_supplier_reservations();
  if not exists(select 1 from public.supplier_reservations where order_id=a and state='held') then raise exception 'Paid reservation expired'; end if;
  begin
    perform public.available_supplier_credit(1.5,clock_timestamp()-interval '2 minutes');
    raise exception 'STALE_ALLOWED';
  exception when others then if sqlerrm='STALE_ALLOWED' then raise; end if; end;
end $$;
rollback;
