-- Run in Supabase SQL Editor, once, AFTER migration 017 and function deployment.
-- Replace the two values below locally. Do not commit or share the edited copy.
-- This uses a NEW secret, separate from the existing opportunity scanner secret.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$
declare endpoint text='https://YOUR_PROJECT_REF.supabase.co/functions/v1/enrollment-email-dispatch';
 token text='PASTE_YOUR_ENROLLMENT_EMAIL_CRON_SECRET'; secret_id uuid; job_id bigint;
begin
 if endpoint like '%YOUR_PROJECT_REF%' or token='PASTE_YOUR_ENROLLMENT_EMAIL_CRON_SECRET' or length(token)<32 then raise exception 'Replace the project reference and private secret before running';end if;
 select id into secret_id from vault.secrets where name='cage_enrollment_email_url';
 if secret_id is null then perform vault.create_secret(endpoint,'cage_enrollment_email_url');else perform vault.update_secret(secret_id,endpoint);end if;
 select id into secret_id from vault.secrets where name='cage_enrollment_email_token';
 if secret_id is null then perform vault.create_secret(token,'cage_enrollment_email_token');else perform vault.update_secret(secret_id,token);end if;
 for job_id in select jobid from cron.job where jobname='cage-enrollment-email-dispatch' loop perform cron.unschedule(job_id);end loop;
 perform cron.schedule('cage-enrollment-email-dispatch','* * * * *',$cron$
 select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='cage_enrollment_email_url'),
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cage_enrollment_email_token')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
 $cron$);
end $$;
-- Runs every minute; new enrollments are queued transactionally.
select jobname,schedule,active from cron.job where jobname='cage-enrollment-email-dispatch';
