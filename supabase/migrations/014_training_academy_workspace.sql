begin;
-- Evaluate cohort SELECT policy against the row itself. A self-lookup in a STABLE
-- function cannot see a newly inserted row during INSERT ... RETURNING.
create or replace function academy_cohort_scope(org uuid,lead uuid,creator uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare r text;sc text;begin
 if org is distinct from current_organization_id() or module_level('training')='none' then return false;end if;
 select role into r from profiles where id=auth.uid() and active;if r is null then return false;end if;
 select scope into sc from record_access where user_id=auth.uid() and module='training';
 if r='admin' or coalesce(sc,case when r='manager' then 'all' else 'own' end)='all' then return true;end if;
 if lead=auth.uid() or creator=auth.uid() then return true;end if;
 if sc='department' then return exists(select 1 from staff_work_settings a join staff_work_settings b on b.department=a.department and b.department<>'' where a.user_id=auth.uid() and b.user_id=lead);end if;
 return false;
end $$;
revoke all on function academy_cohort_scope(uuid,uuid,uuid) from public;
grant execute on function academy_cohort_scope(uuid,uuid,uuid) to authenticated;
drop policy if exists cohorts_read on training_cohorts;
create policy cohorts_read on training_cohorts for select to authenticated using(academy_cohort_scope(organization_id,lead_instructor,created_by));
drop policy if exists cohorts_edit on training_cohorts;
create policy cohorts_edit on training_cohorts for update to authenticated using(academy_cohort_scope(organization_id,lead_instructor,created_by) and has_training_access()) with check(academy_cohort_scope(organization_id,lead_instructor,created_by) and has_training_access());
-- Additive Academy upgrade; keeps existing learners, registers and assessment history.
alter table public.training_courses add column if not exists modules text not null default '';
alter table public.training_courses add column if not exists minimum_attendance numeric not null default 80 check(minimum_attendance between 0 and 100);
alter table public.training_courses add column if not exists practical_minutes integer not null default 0 check(practical_minutes >= 0);
alter table public.training_courses add column if not exists required_assessments text[] not null default array['Final assessment'];
alter table public.training_cohorts add column if not exists project_id text;
alter table public.learners add column if not exists guardian_phone text;
alter table public.learners add column if not exists guardian_consent boolean not null default false;
alter table public.learners add column if not exists collection_contacts text;
alter table public.learners add column if not exists invoice_id text;
alter table public.learners add column if not exists external_licence_status text not null default 'Not recorded';
alter table public.learners add column if not exists alumni_consent boolean not null default false;
alter table public.learners add column if not exists skills text;
alter table public.training_sessions add column if not exists cancelled boolean not null default false;

create table if not exists public.training_practical_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
 learner_id uuid not null references learners(id) on delete cascade,
 performed_on date not null, aircraft text not null, exercise text not null,
 minutes integer not null check(minutes > 0 and minutes <= 1440),
 notes text, signed_off_by uuid references profiles(id), created_by uuid not null references profiles(id),
 created_at timestamptz not null default now()
);
create table if not exists public.training_documents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
 learner_id uuid not null references learners(id) on delete cascade,
 title text not null, file_path text not null, created_by uuid not null references profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.training_materials (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
 cohort_id uuid not null references training_cohorts(id) on delete cascade,
 title text not null, description text, resource_url text, created_by uuid not null references profiles(id), created_at timestamptz not null default now(),
 check(resource_url ~ '^https://')
);
create index if not exists practical_learner_idx on training_practical_logs(learner_id);
create index if not exists documents_learner_idx on training_documents(learner_id);
create index if not exists materials_cohort_idx on training_materials(cohort_id);

do $$declare t text;begin
 foreach t in array array['training_practical_logs','training_documents'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists academy_read on public.%I',t);
 execute format('create policy academy_read on public.%I for select to authenticated using(organization_id=current_organization_id() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)))',t);
 execute format('drop policy if exists academy_insert on public.%I',t);
 execute format('create policy academy_insert on public.%I for insert to authenticated with check(organization_id=current_organization_id() and created_by=auth.uid() and has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)))',t);
 execute format('grant select,insert on public.%I to authenticated',t);
 end loop;
end $$;
alter table training_materials enable row level security;
drop policy if exists academy_read on training_materials;
create policy academy_read on training_materials for select to authenticated using(organization_id=current_organization_id() and can_cohort(cohort_id));
drop policy if exists academy_write on training_materials;
create policy academy_write on training_materials for all to authenticated using(can_cohort(cohort_id) and has_training_access()) with check(organization_id=current_organization_id() and can_cohort(cohort_id) and has_training_access() and created_by=auth.uid());
grant select,insert,update,delete on training_materials to authenticated;

-- Always derive attendance from ALL elapsed sessions, including unmarked absences.
-- Excused sessions are omitted from the denominator; future/cancelled sessions do not count.
create or replace function academy_completion(learner_key uuid) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare l learners%rowtype;c training_courses%rowtype;total integer;attended integer;mins integer;rate numeric;missing text[];reasons text[]:=array[]::text[];
begin
 select * into l from learners where id=learner_key;
 if not found or not can_cohort(l.cohort_id) then raise exception 'Learner access required';end if;
 select tc.* into c from training_courses tc join training_cohorts ch on ch.course_id=tc.id where ch.id=l.cohort_id;
 select count(*),count(*) filter(where a.status in ('Present','Late')) into total,attended
 from training_sessions s left join learner_attendance a on a.session_id=s.id and a.learner_id=l.id
 where s.cohort_id=l.cohort_id and s.ends_at<=now() and not s.cancelled and a.status is distinct from 'Excused';
 rate:=case when total=0 then 0 else round(100.0*attended/total,2) end;
 select coalesce(sum(minutes),0) into mins from training_practical_logs where learner_id=l.id and signed_off_by is not null;
 select coalesce(array_agg(req),array[]::text[]) into missing from unnest(c.required_assessments) req
 where coalesce((select a.result in ('Pass','Competent') from training_assessments a where a.learner_id=l.id and lower(trim(a.assessment_type))=lower(trim(req)) order by a.assessed_at desc,a.id desc limit 1),false)=false;
 if not l.documents_complete then reasons:=array_append(reasons,'Required documents have not been checked');end if;
 if l.date_of_birth > (current_date - interval '18 years')::date or (c.category='STEM' and l.date_of_birth is null) then
 if not l.guardian_consent or coalesce(trim(l.guardian_name),'')='' or coalesce(trim(l.guardian_phone),'')='' then reasons:=array_append(reasons,'Guardian contact and consent required');end if;
 end if;
 if c.minimum_attendance>0 and (total=0 or rate<c.minimum_attendance) then reasons:=array_append(reasons,'Attendance below course requirement');end if;
 if mins<c.practical_minutes then reasons:=array_append(reasons,'Signed practical minutes below course requirement');end if;
 if cardinality(missing)>0 then reasons:=array_append(reasons,'Outstanding assessments: '||array_to_string(missing,', '));end if;
 if exists(select 1 from training_sessions where cohort_id=l.cohort_id and not cancelled and ends_at>now()) then reasons:=array_append(reasons,'Scheduled sessions remain');end if;
 if l.stage='Withdrawn' then reasons:=array_append(reasons,'Learner has withdrawn');end if;
 return jsonb_build_object('ready',cardinality(reasons)=0,'reasons',reasons,'attendance',rate,'sessions',total,'practical_minutes',mins,'missing_assessments',missing);
end $$;
revoke all on function academy_completion(uuid) from public;
grant execute on function academy_completion(uuid) to authenticated;

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
 if new.stage='Completed' and not exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager')) then raise exception 'A manager or administrator must approve completion';end if;
 end if;
 elsif tg_table_name='training_certificates' then
 if not exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager')) then raise exception 'A manager or administrator must approve certificates';end if;
 progress:=academy_completion(new.learner_id);
 if not (progress->>'ready')::boolean then raise exception 'Completion requirements: %',progress->'reasons';end if;
 if new.issued_by is distinct from auth.uid() then raise exception 'Certificate approver must be the signed-in account';end if;
 if new.certificate_type not in ('CAGE course completion','CAGE attendance') then raise exception 'External licences must be recorded separately';end if;
 end if;
 return new;
end $$;
do $$declare t text;begin
 foreach t in array array['learners','training_cohorts','training_sessions','training_practical_logs','training_certificates'] loop
 execute format('drop trigger if exists academy_validation on %I',t);
 execute format('create trigger academy_validation before insert or update on %I for each row execute function academy_guard()',t);
 end loop;
end $$;
-- Completion records are immutable after issuance, including through the direct API.
drop policy if exists certificates_write on training_certificates;
drop policy if exists academy_certificates_insert on training_certificates;
create policy academy_certificates_insert on training_certificates for insert to authenticated with check(organization_id=current_organization_id() and has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)));
-- One numbered completion record per enrolment. Atomic issuance also completes the learner.
-- Existing certificate records remain unchanged and are returned on retries.
create or replace function issue_academy_certificate(learner_key uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare l learners%rowtype;r training_certificates%rowtype;begin
 select * into l from learners where id=learner_key for update;
 if not found or not can_cohort(l.cohort_id) or not has_training_access() then raise exception 'Learner edit access required';end if;
 if not exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager')) then raise exception 'A manager or administrator must approve completion';end if;
 select * into r from training_certificates where learner_id=l.id and certificate_type in ('CAGE course completion','CAGE attendance') order by issued_on desc limit 1;
 if found then return to_jsonb(r);end if;
 insert into training_certificates(organization_id,learner_id,certificate_number,certificate_type,issued_on,issued_by)
 values(l.organization_id,l.id,'CAGE-'||to_char(now() at time zone 'Africa/Blantyre','YYYY')||'-'||upper(replace(l.id::text,'-','')),'CAGE course completion',(now() at time zone 'Africa/Blantyre')::date,auth.uid()) returning * into r;
 update learners set stage='Completed',updated_at=now() where id=l.id;
 return to_jsonb(r);
end $$;
revoke all on function issue_academy_certificate(uuid) from public;
grant execute on function issue_academy_certificate(uuid) to authenticated;
-- Preserve capacity and document checks, while letting course criteria define assessment needs.
create or replace function validate_training_stage() returns trigger language plpgsql security definer set search_path=public as $$
declare cap integer;n integer;begin
 if new.stage<>'Withdrawn' and (tg_op='INSERT' or new.cohort_id is distinct from old.cohort_id or old.stage='Withdrawn') then
 select capacity into cap from training_cohorts where id=new.cohort_id for update;
 select count(*) into n from learners where cohort_id=new.cohort_id and stage<>'Withdrawn' and id<>new.id;
 if n>=cap then raise exception 'This cohort is full';end if;
 end if;
 if new.stage in ('Training','Assessment','Certification','Completed') and not new.documents_complete then raise exception 'Complete learner document checks first';end if;
 return new;
end $$;
commit;
