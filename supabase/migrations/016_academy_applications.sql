begin;
-- Public intake data is exposed only by academy-admissions. No anonymous table access.
alter table training_courses drop constraint if exists training_courses_category_check;
alter table training_courses add constraint training_courses_category_check check(category in ('RPL','RPL Refresher','STEM','Industry Specific','Technical','Corporate','Other'));
create table if not exists academy_intakes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),
 category text not null check(category in ('RPL','RPL Refresher','STEM','Industry Specific')),title text not null check(length(title) between 1 and 160),
 description text not null default '',published boolean not null default false,accepting boolean not null default false,
 closes_on date,start_date date,fee numeric(14,2) not null default 0 check(fee>=0),currency text not null default 'MWK' check(currency ~ '^[A-Z]{3}$'),
 payment_instructions text not null default '',venue text not null default '',fields jsonb not null default '[]' check(jsonb_typeof(fields)='array' and jsonb_array_length(fields)<=60),
 schedule jsonb not null default '[]' check(jsonb_typeof(schedule)='array' and jsonb_array_length(schedule)<=120),schedule_notes text not null default '',
 revision integer not null default 1,created_by uuid references profiles(id),updated_at timestamptz not null default now()
);
create table if not exists academy_applications(
 id uuid primary key,organization_id uuid not null references organizations(id),intake_id uuid not null references academy_intakes(id),
 access_hash text not null check(access_hash ~ '^[a-f0-9]{64}$'),request_id uuid not null,
 full_name text not null,email text not null,phone text not null,answers jsonb not null,form_snapshot jsonb not null,
 category text not null,identity_type text check(identity_type in ('National ID','Passport','License')),
 status text not null default 'New' check(status in ('New','Under review','Accepted','Waitlisted','Declined','Enrolled')),
 staff_notes text not null default '',submitted_at timestamptz not null default now(),reviewed_by uuid references profiles(id),updated_at timestamptz not null default now(),
 learner_id uuid references learners(id),cohort_id uuid references training_cohorts(id),unique(organization_id,request_id)
);
create table if not exists academy_application_files(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),application_id uuid not null references academy_applications(id),
 kind text not null check(kind in ('identity','payment')),path text not null unique,file_name text not null,mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),size_bytes integer not null check(size_bytes>0 and size_bytes<=10485760),
 amount numeric(14,2) check(amount>0),payment_date date,payment_reference text not null default '',
 review_status text not null default 'Pending' check(review_status in ('Pending','Verified','Rejected')),review_note text not null default '',reviewed_by uuid references profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists academy_applications_org_date on academy_applications(organization_id,submitted_at desc);
create index if not exists academy_files_app on academy_application_files(application_id,created_at desc);
create table if not exists academy_intake_limits(key text primary key,window_start timestamptz not null default now(),count integer not null default 0);
alter table academy_intakes enable row level security;
alter table academy_applications enable row level security;
alter table academy_application_files enable row level security;
alter table academy_intake_limits enable row level security;
revoke all on academy_intakes,academy_applications,academy_application_files,academy_intake_limits from anon,authenticated;
grant select,insert,update on academy_intakes to authenticated;
grant select(id,organization_id,intake_id,full_name,email,phone,answers,form_snapshot,category,identity_type,status,staff_notes,submitted_at,reviewed_by,updated_at,learner_id,cohort_id) on academy_applications to authenticated;
grant select on academy_application_files to authenticated;
grant all on academy_intakes,academy_applications,academy_application_files,academy_intake_limits to service_role;
drop policy if exists intake_manager on academy_intakes;
create policy intake_manager on academy_intakes for all to authenticated using(organization_id=current_organization_id() and can_manage_stem()) with check(organization_id=current_organization_id() and can_manage_stem());
drop policy if exists applicant_manager on academy_applications;
create policy applicant_manager on academy_applications for select to authenticated using(organization_id=current_organization_id() and can_manage_stem());
drop policy if exists applicant_file_manager on academy_application_files;
create policy applicant_file_manager on academy_application_files for select to authenticated using(organization_id=current_organization_id() and can_manage_stem());
create or replace function academy_intake_revision() returns trigger language plpgsql as $$begin
 new.revision=old.revision+1;new.updated_at=now();return new;end $$;
drop trigger if exists intake_revision on academy_intakes;
create trigger intake_revision before update on academy_intakes for each row execute function academy_intake_revision();
-- Rate counters are checked only by the server, including a total intake limit.
create or replace function academy_intake_rate(rate_key text,maximum integer,seconds integer) returns boolean language plpgsql security definer set search_path=public as $$declare n integer;begin
 insert into academy_intake_limits(key,window_start,count) values(rate_key,now(),1)
 on conflict(key) do update set count=case when academy_intake_limits.window_start<now()-make_interval(secs=>seconds) then 1 else academy_intake_limits.count+1 end,window_start=case when academy_intake_limits.window_start<now()-make_interval(secs=>seconds) then now() else academy_intake_limits.window_start end returning count into n;
 return n<=maximum;end $$;
revoke all on function academy_intake_rate(text,integer,integer) from public,authenticated;grant execute on function academy_intake_rate(text,integer,integer) to service_role;
create or replace function submit_academy_application(payload jsonb,document jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare c academy_intakes%rowtype;existing academy_applications%rowtype;app uuid:=(payload->>'id')::uuid;begin
 select * into c from academy_intakes where id=(payload->>'intake_id')::uuid for share;
 select * into existing from academy_applications where organization_id=c.organization_id and request_id=(payload->>'request_id')::uuid;
 if found then if existing.access_hash<>payload->>'access_hash' then raise exception 'Submission conflict';end if;return existing.id;end if;
 if c.id is null or not c.published or not c.accepting or (c.closes_on is not null and c.closes_on<(now() at time zone 'Africa/Blantyre')::date) then raise exception 'This intake is closed';end if;
 if c.revision<>(payload->>'revision')::integer then raise exception 'This form changed. Reload the application form before submitting again.';end if;
 if c.category<>'STEM' and document is null then raise exception 'Identity document required';end if;
 insert into academy_applications(id,organization_id,intake_id,access_hash,request_id,full_name,email,phone,answers,form_snapshot,category,identity_type)
 values(app,c.organization_id,c.id,payload->>'access_hash',(payload->>'request_id')::uuid,payload->>'full_name',payload->>'email',payload->>'phone',payload->'answers',jsonb_build_object('title',c.title,'fields',c.fields,'fee',c.fee,'currency',c.currency),c.category,nullif(payload->>'identity_type',''));
 if document is not null then
 if document->>'path' not like c.organization_id::text||'/'||app::text||'/%' then raise exception 'Invalid document path';end if;
 insert into academy_application_files(organization_id,application_id,kind,path,file_name,mime,size_bytes) values(c.organization_id,app,'identity',document->>'path',document->>'file_name',document->>'mime',(document->>'size_bytes')::integer);
 end if;return app;end $$;
revoke all on function submit_academy_application(jsonb,jsonb) from public,authenticated;grant execute on function submit_academy_application(jsonb,jsonb) to service_role;
create or replace function add_academy_payment(app uuid,token_hash text,document jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare a academy_applications%rowtype;result uuid;begin
 select * into a from academy_applications where id=app and access_hash=token_hash for update;
 if not found then raise exception 'Application access denied';end if;
 if (select count(*) from academy_application_files where application_id=app and kind='payment')>=20 then raise exception 'Upload limit reached. Please contact CAGE.';end if;
 if document->>'path' not like a.organization_id::text||'/'||app::text||'/%' then raise exception 'Invalid document path';end if;
 insert into academy_application_files(organization_id,application_id,kind,path,file_name,mime,size_bytes,amount,payment_date,payment_reference)
 values(a.organization_id,app,'payment',document->>'path',document->>'file_name',document->>'mime',(document->>'size_bytes')::integer,(document->>'amount')::numeric,(document->>'payment_date')::date,left(document->>'payment_reference',200)) returning id into result;return result;end $$;
revoke all on function add_academy_payment(uuid,text,jsonb) from public,authenticated;grant execute on function add_academy_payment(uuid,text,jsonb) to service_role;
create or replace function review_academy_application(app uuid,new_status text,note text) returns void language plpgsql security definer set search_path=public as $$begin
 if not can_manage_stem() then raise exception 'Manager training access required';end if;
 if new_status not in ('New','Under review','Accepted','Waitlisted','Declined') then raise exception 'Invalid review status';end if;
 update academy_applications set status=new_status,staff_notes=left(coalesce(note,''),10000),reviewed_by=auth.uid(),updated_at=now() where id=app and organization_id=current_organization_id() and learner_id is null;
 if not found then raise exception 'Application unavailable or already enrolled';end if;end $$;
create or replace function review_academy_payment(file_key uuid,new_status text,note text) returns void language plpgsql security definer set search_path=public as $$begin
 if not can_manage_stem() then raise exception 'Manager training access required';end if;
 if new_status not in ('Pending','Verified','Rejected') then raise exception 'Invalid proof status';end if;
 update academy_application_files set review_status=new_status,review_note=left(coalesce(note,''),2000),reviewed_by=auth.uid(),reviewed_at=now() where id=file_key and kind='payment' and organization_id=current_organization_id();
 if not found then raise exception 'Payment evidence unavailable';end if;end $$;
revoke all on function review_academy_application(uuid,text,text),review_academy_payment(uuid,text,text) from public;
grant execute on function review_academy_application(uuid,text,text),review_academy_payment(uuid,text,text) to authenticated;
-- Private by default; only the authenticated server issues short-lived file links.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('academy-applications','academy-applications',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists academy_uploads_server_only on storage.objects;
create policy academy_uploads_server_only on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'academy-applications') with check(bucket_id<>'academy-applications');
-- Four starter calls are drafts. Staff must review, set dates and publish them.
insert into academy_intakes(organization_id,category,title,fields)
select o.id,x.category,x.category||' applications',
 '[{"id":"full_name","label":"Applicant full name","type":"text","required":true},{"id":"email","label":"Contact email","type":"email","required":true},{"id":"phone","label":"Contact phone","type":"tel","required":true},{"id":"date_of_birth","label":"Date of birth","type":"date","required":false}]'::jsonb||case when x.category='STEM' then '[{"id":"guardian_name","label":"Parent / guardian full name","type":"text","required":true},{"id":"guardian_phone","label":"Parent / guardian phone","type":"tel","required":true},{"id":"guardian_consent","label":"I am the parent / authorised guardian and consent to this application","type":"checkbox","required":true}]'::jsonb else '[]'::jsonb end
from organizations o cross join unnest(array['RPL','RPL Refresher','STEM','Industry Specific']) as x(category)
where not exists(select 1 from academy_intakes a where a.organization_id=o.id and a.category=x.category);
create or replace function enrol_academy_application(app uuid,cohort_key uuid,details jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare a academy_applications%rowtype;ch training_cohorts%rowtype;cat text;learner_key uuid;begin
 if not can_manage_stem() or not can_cohort(cohort_key) then raise exception 'Manager and cohort access required';end if;
 select * into a from academy_applications where id=app and organization_id=current_organization_id() for update;
 if not found then raise exception 'Application unavailable';end if;if a.learner_id is not null then return a.learner_id;end if;
 if a.status<>'Accepted' then raise exception 'Accept the application before enrolling';end if;
 if coalesce((a.form_snapshot->>'fee')::numeric,0)>coalesce((select sum(amount) from academy_application_files where application_id=app and kind='payment' and review_status='Verified'),0) then raise exception 'Verify evidence covering the course fee before enrolling';end if;
 select * into ch from training_cohorts where id=cohort_key and organization_id=a.organization_id for update;
 if not found or ch.status in ('Completed','Cancelled') then raise exception 'Choose an active cohort';end if;
 select category into cat from training_courses where id=ch.course_id;
 if cat<>a.category and not (a.category='Industry Specific' and cat in ('Technical','Corporate','Other')) then raise exception 'Choose a cohort for the same programme';end if;
 if coalesce(trim(details->>'full_name'),'')='' or coalesce(trim(details->>'phone'),'')='' then raise exception 'Learner name and contact phone are required';end if;
 if a.category='STEM' and (coalesce(trim(details->>'guardian_name'),'')='' or coalesce(trim(details->>'guardian_phone'),'')='' or not coalesce((details->>'guardian_consent')::boolean,false)) then raise exception 'Confirm guardian contact and consent';end if;
 insert into learners(organization_id,cohort_id,full_name,email,phone,date_of_birth,guardian_name,guardian_phone,guardian_consent,stage,documents_complete,created_by,notes)
 values(a.organization_id,ch.id,details->>'full_name',nullif(details->>'email',''),details->>'phone',nullif(details->>'date_of_birth','')::date,details->>'guardian_name',details->>'guardian_phone',coalesce((details->>'guardian_consent')::boolean,false),'Documents pending',false,auth.uid(),'Application reference: '||a.id::text) returning id into learner_key;
 update academy_applications set status='Enrolled',learner_id=learner_key,cohort_id=ch.id,reviewed_by=auth.uid(),updated_at=now() where id=a.id;return learner_key;end $$;
revoke all on function enrol_academy_application(uuid,uuid,jsonb) from public;grant execute on function enrol_academy_application(uuid,uuid,jsonb) to authenticated;
commit;
