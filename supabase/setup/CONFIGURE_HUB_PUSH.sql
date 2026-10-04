-- First add these secrets in Supabase Vault (not in this file):
-- cage_push_url: https://YOUR_PROJECT_REF.supabase.co/functions/v1/hub-push
-- cage_push_cron_secret: the same value as Edge Function secret PUSH_CRON_SECRET
-- Supabase Cron and pg_net must be enabled. Run after migration and function deployment.
do $$
begin
 if to_regclass('cron.job') is null then raise exception 'Enable Supabase Cron first';end if;
 if not exists(select 1 from vault.decrypted_secrets where name='cage_push_url') or not exists(select 1 from vault.decrypted_secrets where name='cage_push_cron_secret') then raise exception 'Add cage_push_url and cage_push_cron_secret in Vault first';end if;
 perform cron.schedule('cage-push-delivery','* * * * *',$job$
 select net.http_post(
 url := (select decrypted_secret from vault.decrypted_secrets where name='cage_push_url' limit 1),
 headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cage_push_cron_secret' limit 1)),
 body := '{"action":"deliver"}'::jsonb,timeout_milliseconds := 60000);
 $job$);
end $$;
select jobname,schedule,active from cron.job where jobname='cage-push-delivery';
