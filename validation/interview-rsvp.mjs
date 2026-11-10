import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite'),db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',meeting='20000000-0000-4000-8000-000000000001',hash='a'.repeat(64),track='b'.repeat(64);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema recruitment_private;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('test.claims',true),''),'{}')::jsonb$$;
 create table organizations(id uuid primary key);create table profiles(id uuid primary key);
 create table job_openings(id uuid primary key,organization_id uuid,title text);
 create table job_applications(id uuid primary key,organization_id uuid,job_opening_id uuid,full_name text,email text);
 create table interviews(id uuid primary key,organization_id uuid,application_id uuid,scheduled_start timestamptz,scheduled_end timestamptz,format text,location_or_link text,status text,invitation_sent_at timestamptz,invitation_recipient text,invitation_location text);
 create function recruitment_private.guard_invitation_snapshot() returns trigger language plpgsql as $$begin return new;end$$;
 create trigger interview_invitation_snapshot_guard before insert or update on interviews for each row execute function recruitment_private.guard_invitation_snapshot();
 grant usage on schema public,auth to anon,authenticated,service_role;grant select,update on interviews to authenticated;
 insert into organizations values('${org}');insert into job_openings values('${meeting}','${org}','GIS role');
 insert into job_applications values('${meeting}','${org}','${meeting}','Fixture Applicant','fixture@example.test');
 insert into interviews values('${meeting}','${org}','${meeting}',now()+interval '1 day',now()+interval '1 day 1 hour','Video','https://meet.example.test/original','Scheduled',null,null,null);`);
 await db.exec(fs.readFileSync('supabase/setup/interview_invitation_responses.sql','utf8'));
 async function role(name='service_role'){await db.exec('reset role');await db.query("select set_config('test.claims',$1,false)",[JSON.stringify({role:name})]);await db.exec('set role '+name);}
 const prepare=async(h=hash,t=track)=>(await db.query('select interview_invitation_prepare($1,$2,$3,$4) data',[meeting,h,t,'fixture@example.test'])).rows[0].data;
 const deliver=async(id,status='sent')=>db.query('select interview_invitation_delivery($1,$2,$3)',[id,status,'provider-fixture']);
 const response=async(mode='view',h=hash,choice=null,reason=null)=>(await db.query('select interview_invitation_response($1,$2,$3,$4) data',[h,mode,choice,reason])).rows[0].data;
 await role();const invitation=await prepare();assert.equal(invitation.location_or_link,'https://meet.example.test/original');
 await assert.rejects(()=>response(),/has changed/);assert.equal((await response('open',track)).ok,true);await deliver(invitation.id);
 let data=await response();assert.equal(data.response,'pending');assert.equal(data.candidate_name,'Fixture Applicant');assert(!('recipient' in data));assert(!('id' in data));
 await assert.rejects(()=>response('respond',track,'accepted'),/unavailable/);await assert.rejects(()=>response('respond',hash,'declined',' '),/reason/);
 data=await response('respond',hash,'declined','Please consider tomorrow afternoon.');assert.equal(data.response,'declined');const at=data.responded_at;
 assert.equal((await response('respond',hash,'declined','Please consider tomorrow afternoon.')).responded_at,at);await assert.rejects(()=>response('respond',hash,'accepted'),/already recorded/);
 await db.exec('reset role');let row=(await db.query('select * from interviews')).rows[0];assert.equal(row.invitation_response,'Declined');assert.equal(row.invitation_response_reason,'Please consider tomorrow afternoon.');assert(row.invitation_opened_at);assert(row.invitation_viewed_at);
 await role('authenticated');await assert.rejects(()=>prepare(),/permission denied/);await assert.rejects(()=>response(),/permission denied/);await assert.rejects(()=>db.query("update interviews set invitation_response='Accepted'"),/invitation service/);await assert.rejects(()=>db.query('select * from recruitment_private.interview_invitations'),/permission denied/);
 await role('anon');await assert.rejects(()=>response(),/permission denied/);await role();
 const second=await prepare('c'.repeat(64),'d'.repeat(64));await deliver(second.id);await assert.rejects(()=>response(),/has changed/);assert.equal((await response('respond','c'.repeat(64),'accepted','Thank you.')).response,'accepted');
 await db.exec('reset role');await db.query("update interviews set scheduled_start=scheduled_start+interval '1 hour'");await role();await assert.rejects(()=>response('view','c'.repeat(64)),/has changed/);
 const third=await prepare('e'.repeat(64),'f'.repeat(64));await deliver(third.id);await db.exec('reset role');await db.query("update recruitment_private.interview_invitations set expires_at=now()-interval '1 second' where id=$1",[third.id]);await role();await assert.rejects(()=>response('view','e'.repeat(64)),/expired/);
 console.log('PASS RSVP SQL: private hashed capabilities, separate one-way open token, sent-before-response guard, explicit accept/decline and reasons, safe retries, immutable final response, latest invitation only, stale/expired links and staff spoofing/anonymous denial.');
}finally{await db.close()}
