import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite');
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const admin='20000000-0000-4000-8000-000000000001',panel='20000000-0000-4000-8000-000000000002',outsider='20000000-0000-4000-8000-000000000003',inactive='20000000-0000-4000-8000-000000000004';
const meeting='30000000-0000-4000-8000-000000000001';let serial=0;
try{
await db.exec(`create role anon;create role authenticated;create schema auth;create schema recruitment_private;revoke all on schema recruitment_private from public;grant usage on schema recruitment_private to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table organizations(id uuid primary key);create table profiles(id uuid primary key,organization_id uuid,full_name text,role text,active boolean);
create table job_applications(id uuid primary key,organization_id uuid,full_name text);
create table interviews(id uuid primary key,organization_id uuid,application_id uuid,status text,scheduled_start timestamptz,scheduled_end timestamptz,location_or_link text);
create function current_organization_id() returns uuid language sql stable security definer as $$select organization_id from public.profiles where id=auth.uid() and active$$;
create function has_hr_access() returns boolean language sql stable security definer as $$select coalesce((select active and role in ('admin','manager','hr') from public.profiles where id=auth.uid()),false)$$;
create function hub_mfa_satisfied() returns boolean language sql stable as $$select coalesce(current_setting('test.aal',true),'')='aal2'$$;
create function module_level(text) returns text language sql stable as $$select coalesce(nullif(current_setting('test.level',true),''),'edit')$$;
grant usage on schema public,auth to anon,authenticated;grant select,insert,update on interviews to authenticated;
insert into organizations values('${org}'),('${other}');
insert into profiles values('${admin}','${org}','HR recorder','admin',true),('${panel}','${org}','Technical panelist','member',true),('${outsider}','${other}','Other HR','hr',true),('${inactive}','${org}','Inactive','member',false);
insert into job_applications values('${meeting}','${org}','Fixture candidate');
insert into interviews values('${meeting}','${org}','${meeting}','Scheduled','2026-11-10T08:00:00Z','2026-11-10T09:00:00Z','https://meet.example.test/room');`);
await db.exec(fs.readFileSync('supabase/setup/interview_panel_records.sql','utf8'));
async function identity(id=admin,aal='aal2',level='edit'){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false),set_config('test.level',$3,false)",[id,aal,level]);await db.exec('set role authenticated');}
const read=async before=>(await db.query('select interview_panel_read($1,$2) data',[meeting,before??null])).rows[0].data;
const scores={role_skills:4,relevant_experience:3,communication:5,problem_solving:4};
async function write({person=panel,values=scores,notes='Explained relevant GIS examples.',rec='Yes',key=null}={}){return(await db.query('select interview_panel_write($1,$2,$3,$4,$5,$6) data',[meeting,person,JSON.stringify(values),notes,rec,key||`40000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`])).rows[0].data;}
await identity();let data=await read();assert.equal(data.history.length,0);assert(data.panelists.some(x=>x.id===panel));assert(!data.panelists.some(x=>x.id===outsider||x.id===inactive));
const key='50000000-0000-4000-8000-000000000001';await write({key});await write({key});data=await read();assert.equal(data.history.length,1);assert.equal(data.history[0].panelist_id,panel);assert.equal(data.history[0].recorded_by,admin);assert.equal(data.latest_scores.length,1);
await assert.rejects(()=>write({key,notes:'Changed'}),/already used/);await assert.rejects(()=>write({values:{role_skills:4}}),/four scores/);await assert.rejects(()=>write({values:{...scores,role_skills:6}}),/four scores/);await assert.rejects(()=>write({values:{...scores,role_skills:'4'}}),/four scores/);
await assert.rejects(()=>write({notes:' '}),/evidence or notes/);await assert.rejects(()=>write({person:outsider}),/active panelist/);await assert.rejects(()=>write({person:inactive}),/active panelist/);
await write({values:{},notes:'Explained how to handle an unexpected flight constraint.',rec:null});await write({values:{...scores,role_skills:5}});data=await read();assert.equal(data.history.length,3);assert.equal(data.latest_scores.length,1);assert.equal(data.latest_scores[0].scores.role_skills,5);assert.equal(data.history[2].scores.role_skills,4);
await assert.rejects(()=>db.query('select * from recruitment_private.interview_entries'),/permission denied/);
await assert.rejects(()=>db.query("update interviews set invitation_location='https://fake.example.test' where id=$1",[meeting]),/invitation service/);
await assert.rejects(()=>db.query("insert into interviews(id,invitation_sent_at) values('60000000-0000-4000-8000-000000000001',now())"),/invitation service/);
await identity(panel);await assert.rejects(read,/Recruitment access/);await assert.rejects(write,/Recruitment edit access/);
await identity(outsider);await assert.rejects(read,/unavailable/);await assert.rejects(write,/unavailable/);
await identity(inactive);await assert.rejects(read,/Recruitment access/);
await identity(admin,'aal1');await assert.rejects(read,/verified sign-in/);await assert.rejects(write,/verified sign-in/);
await identity(admin,'aal2','view');assert.equal((await read()).can_edit,false);await assert.rejects(write,/Recruitment edit access/);
await identity(admin,'aal2','none');await assert.rejects(read,/Recruitment access/);
await identity();for(let i=0;i<49;i++)await write({values:{},notes:'Fixture note '+i});data=await read();assert.equal(data.history.length,50);assert(data.next_before);const older=await read(data.next_before);assert.equal(older.history.length,2);assert(!older.history.some(x=>data.history.some(y=>y.id===x.id)));
await db.exec('reset role');await db.query("update interviews set status='Cancelled',invitation_location=location_or_link,invitation_sent_at=now() where id=$1",[meeting]);await identity();assert.equal((await read()).can_edit,false);await assert.rejects(write,/Cancelled/);
await db.exec('reset role;set role anon');await assert.rejects(read,/permission denied/);
console.log('PASS interview SQL: private append-only records, selected panelist and actual recorder, full score validation, note-only entries, stable retries, retained revisions, pagination, snapshot integrity, role/tenant/MFA/read-only/cancelled denials.');
}finally{await db.close()}
