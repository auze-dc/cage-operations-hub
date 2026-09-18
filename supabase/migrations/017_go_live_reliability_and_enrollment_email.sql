-- Apply after 016. Additive; does not reset data or email existing enrollments.
begin;
drop function if exists public.save_workspace_changes(jsonb);
create or replace function public.save_workspace_changes(changes jsonb, expected_epoch text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;merged jsonb;c jsonb;cur jsonb;items jsonb;k text;rid text;conflicts jsonb='[]';
begin
 if jsonb_typeof(changes)<>'array' then raise exception 'Invalid changes';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;if w.organization_id is null then raise exception 'Workspace unavailable';end if;merged=w.data;
 if w.data->>'_resetEpoch' is distinct from expected_epoch then raise exception 'Workspace was reset. Reload and review your draft before saving.';end if;
 for c in select * from jsonb_array_elements(changes) loop
 k=c->>'key';rid=c->>'id';if k is null or k not in ('requests','projects','tasks','contacts','deals','events','invoices','quotes','expenses','boardLists','leaveRequests','knowledge','messages','chatGroups','missions','assets','compliance','approvals','commercialRecords','opportunityMatches','opportunityMonitor','requestPurposes','team','settings') then raise exception 'Unknown module';end if;
 if module_level(state_module(k))<>'edit' and not (k='approvals' and c->'before'='null'::jsonb and c->'after'->>'status'='Pending' and c->'after'->>'requester'=staff_member_id(auth.uid())) then raise exception 'Edit access required for %',k;end if;
 if rid is not null then
   select x into cur from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'=rid;
   if cur is not null and not record_visible(k,cur,w.data) then raise exception 'This record is outside your access';end if;
   if c->'after'<>'null'::jsonb and (c->'after'->>'id' is distinct from rid or not record_visible(k,c->'after',merged)) then raise exception 'Assignment is outside your access';end if;
 else cur=merged->k;if not is_admin() then raise exception 'Administrator access required for workspace settings';end if;end if;
 -- Ignore obsolete read-state-only writes from older browser sessions.
 if k='messages' and rid is not null and cur is not null and jsonb_typeof(c->'after')='object' and (cur-'unread')=((c->'after')-'unread') then continue;end if;
 if k='messages' and cur is not null and c->'before'='null'::jsonb and (cur-'createdBy'-'mentions')=((c->'after')-'createdBy'-'mentions') then continue;end if;
 if cur=c->'after' or (c->'before'='null'::jsonb and cur is not null and (cur-'createdBy')=((c->'after')-'createdBy')) then continue;end if;
 if coalesce(cur,'null') is distinct from c->'before' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('key',k,'id',rid,'current',cur));continue;end if;
 if rid is null then merged=jsonb_set(merged,array[k],c->'after');
 else
   select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'<>rid;
   if c->'after'<>'null'::jsonb then items=items||jsonb_build_array(c->'after');end if;merged=jsonb_set(merged,array[k],items);
 end if;
 end loop;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('conflicts',conflicts);end if;
 update workspace_states set data=merged,version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.save_workspace_changes(jsonb,text) from public;
grant execute on function public.save_workspace_changes(jsonb,text) to authenticated;

create table if not exists enrollment_email_outbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
 source text not null, application_id uuid not null, learner_id uuid not null references learners(id),
 recipient text not null, learner_name text not null, course_name text not null,
 start_date date, venue text, status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 first_attempt_at timestamptz, created_at timestamptz not null default now(), sent_at timestamptz,
 provider_id text, error text, payload jsonb, unique(source,application_id)
);
create index if not exists enrollment_email_ready on enrollment_email_outbox(status,available_at);
alter table enrollment_email_outbox enable row level security;
drop policy if exists enrollment_mail_review on enrollment_email_outbox;
create policy enrollment_mail_review on enrollment_email_outbox for select to authenticated
 using(organization_id=current_organization_id() and can_manage_stem());
grant select on enrollment_email_outbox to authenticated;
grant all on enrollment_email_outbox to service_role;
create or replace function queue_enrollment_email() returns trigger language plpgsql security definer set search_path=public as $$
declare l learners%rowtype;c training_cohorts%rowtype;address text;
begin
 if new.status<>'Enrolled' or new.learner_id is null or old.status='Enrolled' then return new;end if;
 select * into l from learners where id=new.learner_id and organization_id=new.organization_id;
 select * into c from training_cohorts where id=new.cohort_id and organization_id=new.organization_id;
 address=coalesce(nullif(l.email::text,''),nullif(to_jsonb(new)->>'email',''),nullif(to_jsonb(new)->>'respondent_email',''),'');
 insert into enrollment_email_outbox(organization_id,source,application_id,learner_id,recipient,learner_name,course_name,start_date,venue,status,error)
 values(new.organization_id,TG_TABLE_NAME,new.id,l.id,address,l.full_name,c.name,c.start_date,c.venue,
 case when address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then 'pending' else 'failed' end,
 case when address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then null else 'No valid applicant email; contact the applicant and review manually.' end)
 on conflict(source,application_id) do nothing;
 return new;
end $$;
drop trigger if exists enrollment_mail_queue on academy_applications;
create trigger enrollment_mail_queue after update on academy_applications for each row execute function queue_enrollment_email();
drop trigger if exists enrollment_mail_queue on stem_applications;
create trigger enrollment_mail_queue after update on stem_applications for each row execute function queue_enrollment_email();
create or replace function claim_enrollment_email() returns setof enrollment_email_outbox language plpgsql security definer set search_path=public as $$
begin
 update enrollment_email_outbox set status='failed',error='Delivery uncertain or retry limit reached. Check provider logs before any manual resend.'
 where status in ('pending','processing') and (first_attempt_at<now()-interval '23 hours' or attempts>=8);
 return query update enrollment_email_outbox e set status='processing',attempts=e.attempts+1,
 first_attempt_at=coalesce(e.first_attempt_at,now()),available_at=now()+interval '5 minutes'
 where e.id in (select id from enrollment_email_outbox where status in ('pending','processing') and available_at<=now()
 order by created_at for update skip locked limit 10) returning e.*;
end $$;
revoke all on function claim_enrollment_email() from public;
grant execute on function claim_enrollment_email() to service_role;
notify pgrst, 'reload schema';
commit;
