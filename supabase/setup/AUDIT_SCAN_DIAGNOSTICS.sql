-- Read-only. Does not expose job commands, URLs containing secrets, or credentials.
select jobid,jobname,schedule,active from cron.job
where jobname='cage-daily-opportunity-scan';
select d.jobid,d.status,d.start_time,d.end_time
from cron.job_run_details d join cron.job j using(jobid)
where j.jobname='cage-daily-opportunity-scan'
order by d.start_time desc limit 20;
select organization_id,frequency,disabled_sources,updated_at
from public.opportunity_scan_settings;
select organization_id,started_at,finished_at,status,added,updated,checked,error
from public.opportunity_scan_runs order by started_at desc limit 20;
-- A successful cron SQL run alone does not prove the HTTP Edge Function succeeded.
-- Compare these timestamps with opportunity-scan invocation logs in Supabase.
