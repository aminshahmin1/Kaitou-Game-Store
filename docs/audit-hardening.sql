-- image_url already exists in the initial products schema; no new column required.
alter function public.set_updated_at() set search_path='';
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
-- The storefront reads catalogue data only through the server-side service client.
revoke all on table public.products,public.product_variations from public,anon,authenticated;
