begin;
-- All active internal members may manage Academy records in their own organisation.
create or replace function public.has_training_access() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and active and role<>'shared')
$$;
create or replace function public.module_level(m text) returns text language plpgsql stable security definer set search_path=public as $$
declare r text; a text;
begin
 select role into r from profiles where id=auth.uid() and active;
 if r is null then return 'none'; end if;
 if m='training' then return case when r='shared' then 'none' else 'edit' end; end if;
 if r='admin' then return 'edit'; end if;
 if m in ('settings','admin') then return 'none'; end if;
 select access into a from module_access where user_id=auth.uid() and module=m;
 if r='viewer' then return case when a='none' then 'none' else 'view' end; end if;
 if a is not null then return a; end if;
 if m='approvals' then return case when r='manager' then 'edit' else 'none' end; end if;
 if m='hr' then return case when r in ('manager','hr') then 'edit' else 'view' end; end if;
 return case when r='viewer' then 'view' else 'edit' end;
end $$;
create or replace function public.can_manage_stem() returns boolean language sql stable security definer set search_path=public as $$select has_training_access()$$;
create or replace function public.academy_cohort_scope(org uuid,lead uuid,creator uuid) returns boolean
language sql stable security definer set search_path=public as $$select has_training_access() and org=current_organization_id()$$;
create or replace function public.can_cohort(cid uuid) returns boolean
language sql stable security definer set search_path=public as $$select has_training_access() and exists(select 1 from training_cohorts where id=cid and organization_id=current_organization_id())$$;
create or replace function academy_guard() returns trigger language plpgsql security invoker set search_path=public as $$
declare progress jsonb;cid uuid;org uuid;begin
 if tg_table_name='training_practical_logs' then
 if new.signed_off_by is not null and new.signed_off_by<>auth.uid() then raise exception 'Sign off using your own instructor account';end if;
 if new.performed_on>current_date then raise exception 'Practical records cannot be future dated';end if;
 elsif tg_table_name='training_cohorts' then
 if not exists(select 1 from training_courses where id=new.course_id and organization_id=new.organization_id) then raise exception 'Course must belong to this organisation';end if;
 if new.lead_instructor is not null and not exists(select 1 from profiles where id=new.lead_instructor and organization_id=new.organization_id and active) then raise exception 'Select an active instructor from this organisation';end if;
 elsif tg_table_name='training_sessions' then
 if tg_op='UPDATE' and new.cohort_id is distinct from old.cohort_id and exists(select 1 from learner_attendance where session_id=new.id) then raise exception 'A session with attendance cannot move to another cohort';end if;
 if not exists(select 1 from training_cohorts where id=new.cohort_id and organization_id=new.organization_id) then raise exception 'Cohort must belong to this organisation';end if;
 elsif tg_table_name='learners' then
 if not exists(select 1 from training_cohorts where id=new.cohort_id and organization_id=new.organization_id) then raise exception 'Cohort must belong to this organisation';end if;
 if new.date_of_birth>current_date then raise exception 'Date of birth cannot be in the future';end if;
 if new.stage in ('Training','Assessment','Certification','Completed') and
 (new.date_of_birth > (current_date - interval '18 years')::date or (new.date_of_birth is null and exists(select 1 from training_cohorts ch join training_courses c on c.id=ch.course_id where ch.id=new.cohort_id and c.category='STEM'))) and
 (not new.guardian_consent or coalesce(trim(new.guardian_name),'')='' or coalesce(trim(new.guardian_phone),'')='') then raise exception 'Guardian contact and consent required before training';end if;
 if new.stage in ('Certification','Completed') and (tg_op='INSERT' or old.stage is distinct from new.stage) then
 progress:=academy_completion(new.id);
 if not (progress->>'ready')::boolean or not new.documents_complete then raise exception 'Completion requirements: %',progress->'reasons';end if;
 if new.stage='Completed' and not has_training_access() then raise exception 'An active Academy member must approve completion';end if;
 end if;
 elsif tg_table_name='training_certificates' then
 if not has_training_access() then raise exception 'An active Academy member must approve certificates';end if;
 progress:=academy_completion(new.learner_id);
 if not (progress->>'ready')::boolean then raise exception 'Completion requirements: %',progress->'reasons';end if;
 if new.issued_by is distinct from auth.uid() then raise exception 'Certificate approver must be the signed-in account';end if;
 if new.certificate_type not in ('CAGE course completion','CAGE attendance') then raise exception 'External licences must be recorded separately';end if;
 end if;
 return new;
end $$;
create or replace function issue_academy_certificate(learner_key uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare l learners%rowtype;r training_certificates%rowtype;begin
 select * into l from learners where id=learner_key for update;
 if not found or not can_cohort(l.cohort_id) or not has_training_access() then raise exception 'Learner edit access required';end if;
 if not has_training_access() then raise exception 'An active Academy member must approve completion';end if;
 select * into r from training_certificates where learner_id=l.id and certificate_type in ('CAGE course completion','CAGE attendance') order by issued_on desc limit 1;
 if found then return to_jsonb(r);end if;
 insert into training_certificates(organization_id,learner_id,certificate_number,certificate_type,issued_on,issued_by)
 values(l.organization_id,l.id,'CAGE-'||to_char(now() at time zone 'Africa/Blantyre','YYYY')||'-'||upper(replace(l.id::text,'-','')),'CAGE course completion',(now() at time zone 'Africa/Blantyre')::date,auth.uid()) returning * into r;
 update learners set stage='Completed',updated_at=now() where id=l.id;
 return to_jsonb(r);
end $$;

-- Keep existing file policies, changing only Academy's module mapping.
do $$declare p record;q text;w text;begin
 for p in select * from pg_policies where (schemaname='public' and tablename='attachments' and policyname in ('attachment module read','attachment module upload')) or (schemaname='storage' and tablename='objects' and policyname in ('file module read','file module upload')) loop
 q=p.qual;w=p.with_check;
 if q is not null and position('training' in q)=0 then
 q=replace(q,'WHEN ''chat''::text','WHEN ''training''::text THEN ''training''::text WHEN ''chat''::text');
 execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,q);
 end if;
 if w is not null and position('training' in w)=0 then
 w=replace(w,'WHEN ''chat''::text','WHEN ''training''::text THEN ''training''::text WHEN ''chat''::text');
 execute format('alter policy %I on %I.%I with check (%s)',p.policyname,p.schemaname,p.tablename,w);
 end if;
 end loop;
end $$;
-- Append-only audit; writes come from database triggers, not client-supplied actor fields.
create table if not exists public.academy_activity_log (
 id bigint generated always as identity primary key,
 organization_id uuid not null references organizations(id),
 actor_id uuid, actor_name text, actor_email text,
 actor_kind text not null, action text not null, entity_type text not null,
 entity_id text, old_data jsonb, new_data jsonb,
 created_at timestamptz not null default now()
);
create index if not exists academy_activity_org_time on academy_activity_log(organization_id,created_at desc,id desc);
alter table academy_activity_log enable row level security;
revoke all on academy_activity_log from public,anon,authenticated;
grant select on academy_activity_log to authenticated;
drop policy if exists academy_activity_read on academy_activity_log;
create policy academy_activity_read on academy_activity_log for select to authenticated
using(has_training_access() and organization_id=current_organization_id());
create or replace function public.audit_academy_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare before_row jsonb;after_row jsonb;r jsonb;org uuid;actor_uid uuid;actor profiles%rowtype;
begin
 if tg_op<>'INSERT' then before_row=to_jsonb(old);end if;
 if tg_op<>'DELETE' then after_row=to_jsonb(new);end if;
 if tg_op='UPDATE' and before_row=after_row then return new;end if;
 r=coalesce(after_row,before_row);org=(r->>'organization_id')::uuid;
 if org is null and tg_table_name='learner_attendance' then select organization_id into org from training_sessions where id=(r->>'session_id')::uuid;end if;
 if org is null then raise exception 'Academy change cannot be logged without organisation';end if;
 actor_uid=auth.uid();
 if actor_uid is null and tg_table_name='cohort_deliveries' then actor_uid=(r->>'sender_id')::uuid;end if;
 select * into actor from profiles where id=actor_uid;
 insert into academy_activity_log(organization_id,actor_id,actor_name,actor_email,actor_kind,action,entity_type,entity_id,old_data,new_data)
 values(org,actor_uid,actor.full_name,actor.email,case when actor_uid is null then 'system_or_public_service' else 'member' end,
 tg_op,tg_table_name,coalesce(r->>'id',r->>'delivery_key',(r->>'session_id')||':'||(r->>'learner_id')),
 before_row-array['access_hash','path','file_path'],after_row-array['access_hash','path','file_path']);
 return coalesce(new,old);
end $$;
revoke all on function audit_academy_change() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['training_courses','training_cohorts','learners','training_sessions','learner_attendance','training_assessments','training_certificates','training_practical_logs','training_documents','training_materials','academy_intakes','academy_applications','academy_application_files','academy_payment_reminders','enrollment_email_outbox','stem_applications','stem_connections','cohort_messages','cohort_deliveries'] loop
 if to_regclass('public.'||t) is null then continue;end if;
 execute format('drop trigger if exists academy_activity on public.%I',t);
 execute format('create trigger academy_activity after insert or update or delete on public.%I for each row execute function public.audit_academy_change()',t);
 end loop;
end $$;
create or replace function public.log_academy_document_access(file_key uuid) returns void
language plpgsql security definer set search_path=public as $$
declare f academy_application_files%rowtype;p profiles%rowtype;
begin
 if not has_training_access() then raise exception 'Academy access required';end if;
 select * into f from academy_application_files where id=file_key and organization_id=current_organization_id();
 if not found then raise exception 'Document access denied';end if;
 select * into p from profiles where id=auth.uid();
 insert into academy_activity_log(organization_id,actor_id,actor_name,actor_email,actor_kind,action,entity_type,entity_id)
 values(f.organization_id,auth.uid(),p.full_name,p.email,'member','DOCUMENT_LINK_REQUESTED','academy_application_files',f.id::text);
end $$;
revoke all on function log_academy_document_access(uuid) from public,anon;
grant execute on function log_academy_document_access(uuid) to authenticated;
commit;
