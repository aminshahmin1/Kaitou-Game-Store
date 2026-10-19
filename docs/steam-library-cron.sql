-- Enable after the release is assigned to kaitou.shop. Source names refresh daily;
-- the five-minute worker resumes interrupted imports and verifies pending game metadata.
select cron.schedule('kaitou-steam-library','*/5 * * * *',$job$
  select net.http_post(
    url:='https://kaitou.shop/api/cron/steam-library',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='kaitou_balance_monitor' limit 1)),
    body:='{}'::jsonb,timeout_milliseconds:=55000
  );
$job$);
