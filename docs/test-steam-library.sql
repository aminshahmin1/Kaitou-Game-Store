begin;
do $$
declare token uuid; n integer; pid uuid; rate numeric;
begin
  if has_table_privilege('anon','public.steam_library_games','select') or has_table_privilege('authenticated','public.steam_library_games','select') then raise exception 'Catalog must stay private'; end if;
  if has_function_privilege('anon','public.ingest_steam_catalog(jsonb,uuid)','execute') then raise exception 'Public import'; end if;
  if has_function_privilege('anon','public.ingest_steam_catalog_chunk(uuid,jsonb,integer)','execute') then raise exception 'Public chunk import'; end if;
  update public.steam_library_sync set full_sync_at=null,lease_token=null,lease_until=now()-interval '1 minute',pending_count=0,pending_games=null,next_offset=0,last_fetch_at=null;
  token:=public.claim_steam_catalog_sync();
  if token is null or public.claim_steam_catalog_sync() is not null then raise exception 'Sync lease failed'; end if;
  n:=public.begin_steam_catalog_chunks(token,3,repeat('a',64));
  if n<>0 or public.claim_steam_catalog_sync() is not null then raise exception 'Catalog freshness guard failed'; end if;
  perform public.ingest_steam_catalog_chunk(token,'[{"appid":991234567,"name":"Rollback game"},{"appid":991234568,"name":"Rollback DLC"}]',0);
  if not exists(select 1 from public.steam_library_games where appid=991234567) then raise exception 'Catalogue batch missing'; end if;
  update public.steam_library_sync set lease_until=now()-interval '1 minute',last_fetch_at=now()-interval '4 minutes';
  token:=public.claim_steam_catalog_sync();
  if public.begin_steam_catalog_chunks(token,3,repeat('a',64))<>2 then raise exception 'Resume cursor lost'; end if;
  update public.steam_library_sync set pending_count=0,full_sync_at=now(),lease_until=now()-interval '1 minute',last_fetch_at=now()-interval '4 minutes';
  if public.claim_steam_catalog_sync() is not null then raise exception 'Daily freshness guard failed'; end if;
  select (public_config->>'usdMyr')::numeric into rate from public.integration_settings where id='supplier-exchange-rate';
  insert into public.products(slug,title,type,category,game,region,delivery_type,image_tone,source) values('rollback-steam-test','Rollback game','steam_gift_game','Steam Gift Games','Rollback game','Global','Steam gift','bg-black','steam_library') returning id into pid;
  insert into public.product_variations(product_id,sku,title,price_myr,cost_usd,cost_myr,active,available) values(pid,'rollback-option','Edition',10,1,rate,false,false);
  perform public.price_steam_library_variations(pid,jsonb_build_array(jsonb_build_object('sku','rollback-option','title','Updated edition','cost_usd',2,'cost_myr',round(2*rate,2),'price_myr',round(2*rate,2)+2)),rate);
  if not exists(select 1 from public.product_variations where product_id=pid and not active and not available and cost_usd=2) then raise exception 'Disabled edition overwritten'; end if;
end $$;
rollback;
select 'PASS: private catalogue grants, serialized refresh lease, freshness guard and price-only updates preserve disabled editions; all fixtures rolled back' as result;
