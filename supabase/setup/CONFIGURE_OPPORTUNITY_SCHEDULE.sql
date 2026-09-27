-- Run AFTER applying the opportunity migration and deploying opportunity-scan.
-- Reuses the existing job's project URL and secret; no credentials are changed.
do $$
begin
 if to_regclass('cron.job') is null then raise exception 'Enable Supabase Cron first. Then create the opportunity scan job using your existing project URL and CRON_SECRET.';end if;
 if not exists(select 1 from cron.job where jobname='cage-daily-opportunity-scan') then raise exception 'Existing cage-daily-opportunity-scan job not found. Do not create a duplicate: inspect your existing opportunity job name in Cron.';end if;
 update cron.job set schedule='0 5,17 * * *' where jobname='cage-daily-opportunity-scan';
end $$;
-- Schedule is UTC: 05:00 and 17:00 = 07:00 and 19:00 CAT.
-- An intentionally inactive job stays inactive. Review its Active toggle yourself.
select jobname,schedule,active from cron.job where jobname='cage-daily-opportunity-scan';
