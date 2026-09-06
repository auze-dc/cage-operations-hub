-- Run this after deploying the opportunity-scan Edge Function.
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET before executing.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cage-daily-opportunity-scan',
  '0 5 * * *', -- 07:00 Malawi time (UTC+2)
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/opportunity-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := '{"organizationId":"00000000-0000-4000-8000-000000000001"}'::jsonb
  );
  $$
);
