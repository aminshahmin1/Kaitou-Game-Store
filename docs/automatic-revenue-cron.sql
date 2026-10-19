-- Apply after /api/cron/revenue is deployed. Reuses the private existing Vault token.
select cron.schedule(jobname, '* * * * *', command)
from cron.job where jobname = 'kaitou-fulfillment-recovery';

select cron.schedule('kaitou-revenue-reconciliation', '* * * * *', $job$
  select net.http_post(
    url := 'https://kaitou.shop/api/cron/revenue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
        where name = 'kaitou_balance_monitor' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);
