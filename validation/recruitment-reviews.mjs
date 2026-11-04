import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
async function main(){
const require=createRequire(import.meta.url),{PGlite}=require(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite');const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const admin='20000000-0000-4000-8000-000000000001',hr='20000000-0000-4000-8000-000000000002',member='20000000-0000-4000-8000-000000000003',outsider='20000000-0000-4000-8000-000000000004',inactive='20000000-0000-4000-8000-000000000005';
const app='30000000-0000-4000-8000-000000000001';let request=0;
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table organizations(id uuid primary key);create table profiles(id uuid primary key,organization_id uuid references organizations,full_name text,role text,active boolean);create table job_openings(id uuid primary key,organization_id uuid,title text);
create table job_applications(id uuid primary key,organization_id uuid references organizations,job_opening_id uuid,full_name text,stage text default 'New',score int,screening_notes text,updated_by uuid,updated_at timestamptz default now());
create function current_organization_id() returns uuid language sql stable security definer as $$select organization_id from public.profiles where id=auth.uid() and active$$;
create function has_hr_access() returns boolean language sql stable security definer as $$select coalesce((select active and role in ('admin','manager','hr') from public.profiles where id=auth.uid()),false)$$;
create function hub_mfa_satisfied() returns boolean language sql stable as $$select coalesce(current_setting('test.aal',true),'')='aal2'$$;
create function module_level(text) returns text language sql stable as $$select coalesce(nullif(current_setting('test.level',true),''),'edit')$$;
alter table job_applications enable row level security;create policy hr on job_applications to authenticated using(organization_id=current_organization_id() and has_hr_access() and hub_mfa_satisfied() and module_level('hr')<>'none') with check(organization_id=current_organization_id() and has_hr_access() and hub_mfa_satisfied() and module_level('hr')='edit');
grant usage on schema auth,public to authenticated,anon;grant select,update on job_applications to authenticated;grant select on profiles,organizations to authenticated;
insert into organizations values('${org}'),('${other}');
insert into profiles values('${admin}','${org}','Administrator','admin',true),('${hr}','${org}','HR Reviewer','hr',true),('${member}','${org}','Staff','member',true),('${outsider}','${other}','Other HR','hr',true),('${inactive}','${org}','Inactive reviewer','hr',false);
insert into job_openings values('${app}','${org}','Fixture vacancy');insert into job_applications(id,organization_id,job_opening_id,full_name,score,screening_notes) values('${app}','${org}','${app}','Fixture applicant',50,'Earlier note');`);
await db.exec(fs.readFileSync('supabase/setup/recruitment_reviews.sql','utf8'));
async function identity(id=admin,aal='aal2',level='edit'){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false),set_config('test.level',$3,false)",[id,aal,level]);await db.exec('set role authenticated');}
const read=async(before=null)=>(await db.query('select application_review_read($1,$2) data',[app,before])).rows[0].data;
async function write({action='note',notes='Evidence-based review',scores={},stage=null,reviewer=null,version=0,key=null}={}){return (await db.query('select application_review_write($1,$2,$3,$4,$5::jsonb,$6,$7,$8) data',[app,version,action,notes,JSON.stringify(scores),stage,reviewer,key||`40000000-0000-4000-8000-${String(++request).padStart(12,'0')}`])).rows[0].data;}
try{
await identity();assert.equal((await read()).history.length,0);assert.equal((await read()).application.legacy_notes,'Earlier note');
const key='50000000-0000-4000-8000-000000000001';await write({key});assert.equal((await read()).history.length,1);await write({key});assert.equal((await read()).history.length,1);await assert.rejects(()=>write({key,notes:'Changed payload'}),/already used/);
await assert.rejects(()=>write({version:0}),/changed/);assert.equal((await read()).application.review_version,1);
await assert.rejects(()=>write({version:1,action:'assessment',scores:{role_skills:5}}),/four scores/);await assert.rejects(()=>write({version:1,action:'stage',stage:'Shortlisted',notes:' '}),/Provide a reason/);
await write({version:1,action:'assessment',scores:{role_skills:4,relevant_experience:3,communication:4,problem_solving:5}});assert.equal((await read()).application.stage,'New');assert.equal((await read()).assessments.length,1);
await write({version:2,action:'stage',stage:'Shortlisted',notes:'Relevant GIS evidence meets the role requirements.'});let context=await read();assert.equal(context.application.stage,'Shortlisted');assert.equal(context.history[0].kind,'stage');assert.match(context.history[0].notes,/GIS evidence/);assert.equal(context.history[0].actor_id,admin);
await assert.rejects(()=>write({version:3,action:'assignment',reviewer:outsider}),/active recruitment/);await assert.rejects(()=>write({version:3,action:'assignment',reviewer:inactive}),/active recruitment/);
await write({version:3,action:'assignment',reviewer:hr,notes:'Lead technical review.'});context=await read();assert.equal(context.application.assigned_reviewer,hr);assert.equal(context.history[0].to_reviewer_name,'HR Reviewer');
await db.query('update job_applications set stage=$1,updated_by=$2 where id=$3',['Interview',outsider,app]);context=await read();assert.equal(context.history[0].kind,'stage');assert.equal(context.history[0].actor_id,admin);assert.match(context.history[0].notes,/existing workflow/);
await assert.rejects(()=>db.exec("insert into recruitment_private.review_events(organization_id,application_id,kind,actor_name) values('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','note','Forged')"),/permission denied/);
await identity(hr);await write({version:5,action:'assessment',scores:{role_skills:3,relevant_experience:3,communication:3,problem_solving:3}});assert.equal((await read()).assessments.length,2);
await write({version:6,action:'stage',stage:'Offer',notes:'Panel recommends an offer for the documented role-related evidence.'});assert.equal((await read()).application.stage,'Offer');
for(const id of [member,outsider,inactive]){await identity(id);await assert.rejects(()=>read(),/access|unavailable/);await assert.rejects(()=>write({version:7}),/access|unavailable/);}
await identity(admin,'aal1');await assert.rejects(()=>read(),/verified sign-in/);await assert.rejects(()=>write({version:7}),/verified sign-in/);
await identity(admin,'aal2','read');assert.equal((await read()).can_edit,false);await assert.rejects(()=>write({version:7}),/edit access/);
await db.exec('reset role;set role anon');await assert.rejects(()=>read(),/permission denied/);await assert.rejects(()=>write(),/permission denied/);
await identity();for(let i=0;i<52;i++)await write({version:7+i,notes:'Pagination fixture '+i});context=await read();assert.equal(context.history.length,50);assert(context.next_before);assert((await read(context.next_before)).history.length>0);assert.equal(context.application.legacy_score,50);assert.equal(context.application.legacy_notes,'Earlier note');
await db.exec('reset role');const countBefore=(await db.query('select count(*)::int n from recruitment_private.review_events')).rows[0].n;await db.query('delete from job_applications where id=$1',[app]);assert.equal((await db.query('select count(*)::int n from recruitment_private.review_events')).rows[0].n,countBefore);assert.equal((await db.query('select count(*)::int n from recruitment_private.review_events where application_id is null and application_reference=$1',[app])).rows[0].n,countBefore);
assert(!context.reviewers.some(x=>x.id===member||x.id===outsider||x.id===inactive));
console.log('PASS: additive preservation, private author-stamped history, complete scorecards, reasoned stage changes, reviewer eligibility, existing interview workflow audit, concurrency/idempotency, pagination and anonymous/member/tenant/MFA/read-only denial.');
}finally{await db.close()}

}
main().catch(e=>{console.error(e.message,e.where||"");process.exitCode=1});
