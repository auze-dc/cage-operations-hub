-- Run only after deploying the scanner with cron-auth.js and applying its Vault migration.
-- Preserves the existing organization's ID, schedule and active state.
DO $repair$
DECLARE j record;org uuid;new_command text;
BEGIN
 SELECT jobid,command INTO STRICT j FROM cron.job WHERE jobname='cage-daily-opportunity-scan';
 IF j.command LIKE '%cage_opportunity_scan_cron_secret%' THEN RETURN;END IF;
 IF j.command NOT LIKE '%YOUR_CRON_SECRET%' THEN RAISE EXCEPTION 'Job configuration changed. Inspect before replacing it.';END IF;
 org=substring(j.command from 'organizationId[^a-zA-Z0-9]+([a-zA-Z0-9-]+)')::uuid;
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org) THEN RAISE EXCEPTION 'Valid organization required';END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='cage_opportunity_scan_cron_secret') THEN RAISE EXCEPTION 'Apply scanner Vault migration first';END IF;
 new_command=format($job$
 select net.http_post(
 url:='https://lrvcpiobxqtmcntwhaat.supabase.co/functions/v1/opportunity-scan',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
  (select decrypted_secret from vault.decrypted_secrets where name='cage_opportunity_scan_cron_secret')),
 body:=jsonb_build_object('organizationId',%L),timeout_milliseconds:=120000);
 $job$,org::text);
 PERFORM cron.alter_job(j.jobid,command:=new_command);
END $repair$;
