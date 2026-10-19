create function public.price_steam_library_variations(p_product_id uuid,p_rows jsonb,p_rate numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare current_rate numeric;
begin
  if not exists(select 1 from public.products where id=p_product_id and source='steam_library') then raise exception 'Not an automatic library listing'; end if;
  select (public_config->>'usdMyr')::numeric into current_rate from public.integration_settings where id='supplier-exchange-rate';
  if current_rate is null or current_rate<>p_rate then raise exception 'Exchange rate changed; request a new quote'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid prices'; end if;
  update public.product_variations v set cost_usd=r.cost_usd,cost_myr=r.cost_myr,price_myr=r.price_myr,title=r.title
    from jsonb_to_recordset(p_rows) as r(sku text,cost_usd numeric,cost_myr numeric,price_myr numeric,title text)
    where v.product_id=p_product_id and v.sku=r.sku and r.cost_usd>0 and r.price_myr>r.cost_myr
      and r.cost_myr=round(r.cost_usd*current_rate,2);
  update public.product_variations v set available=false where v.product_id=p_product_id
    and not exists(select 1 from jsonb_array_elements(p_rows) r where r->>'sku'=v.sku);
end; $$;
revoke all on function public.price_steam_library_variations(uuid,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.price_steam_library_variations(uuid,jsonb,numeric) to service_role;
