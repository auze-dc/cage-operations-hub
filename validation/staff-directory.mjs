import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite'),db=new PGlite();
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',admin='20000000-0000-4000-8000-000000000001',fresh='20000000-0000-4000-8000-000000000002';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema recruitment_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table profiles(id uuid primary key,organization_id uuid,email text,full_name text,initials text,role text,active boolean,assignable boolean);
 create table record_deletion_log(organization_id uuid,kind text,record_id text);
 create function current_organization_id() returns uuid language sql stable security definer as $$select organization_id from public.profiles where id=auth.uid() and active$$;
 create function hub_mfa_satisfied() returns boolean language sql stable as $$select coalesce(current_setting('test.aal',true),'')='aal2'$$;
 create function finance_delete_original_workspace() returns jsonb language sql stable as $$select current_setting('test.payload')::jsonb$$;
 grant usage on schema public,auth to authenticated,anon;
 insert into profiles values('${admin}','${org}','admin@cagemw.com','Administrator','AM','admin',true,true),('20000000-0000-4000-8000-000000000003','${other}','other@example.test','Outside staff','OS','member',true,true);
 insert into record_deletion_log values('${org}','quotes','deleted');`);
 const payload={version:37,collaboration:{chatThreads:['private-thread']},data:{team:[{id:'admin',email:'admin@cagemw.com',name:'Old name',role:'Operations lead',capacity:40},{id:'former',name:'Former employee'}],tasks:[{id:'task',owner:'admin'}],chatGroups:[{id:'private-thread',members:['admin']}],quotes:[{id:'kept',number:'Q-26050'},{id:'deleted',number:'Q-26060'}],invoices:[]}};
 await db.query("select set_config('test.payload',$1,false)",[JSON.stringify(payload)]);
 await db.exec(fs.readFileSync('supabase/setup/staff_directory_refresh.sql','utf8'));
 async function identity(id=admin,aal='aal2'){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[id,aal]);await db.exec('set role authenticated');}
 const read=async()=>(await db.query('select get_my_workspace() data')).rows[0].data;
 await identity();let data=await read();assert.equal(data.version,37);assert.equal(data.data.team.find(x=>x.id==='admin').name,'Administrator');assert.equal(data.data.team.find(x=>x.id==='admin').role,'Operations lead');assert.equal(data.data.team.find(x=>x.id==='admin').capacity,40);assert.equal(data.data.team.find(x=>x.id==='former').assignable,false);assert(!data.data.team.some(x=>x.name==='Outside staff'));
 assert.equal(data.data.quotes.length,1);assert.equal(data.financeNumberFloor.quotes,26060);assert.deepEqual(data.data.tasks,payload.data.tasks);assert.deepEqual(data.collaboration,payload.collaboration);assert.deepEqual(data.data.chatGroups,payload.data.chatGroups);
 await db.exec('reset role');await db.query('insert into profiles values($1,$2,$3,$4,$5,$6,true,true)',[fresh,org,'new@cagemw.com','New staff','NS','member']);await identity();data=await read();assert.equal(data.version,37);assert.equal(data.data.team.find(x=>x.id==='new').assignable,true);assert.equal(data.data.team.find(x=>x.id==='new').userId,fresh);
 await db.exec('reset role');await db.query("update profiles set full_name='Renamed staff' where id=$1",[fresh]);await identity();assert.equal((await read()).data.team.find(x=>x.id==='new').name,'Renamed staff');
 await db.exec('reset role');await db.query('update profiles set active=false where id=$1',[fresh]);await identity();assert.equal((await read()).data.team.find(x=>x.id==='new').assignable,false);
 await db.exec('reset role');await db.query("update profiles set active=true,role='shared' where id=$1",[fresh]);await identity();assert.equal((await read()).data.team.find(x=>x.id==='new').assignable,false);
 await db.exec('reset role');await db.query("insert into profiles values('20000000-0000-4000-8000-000000000004',$1,'bonfancio@cagemw.com','Legacy alias','LA','member',true,true)",[org]);await identity();assert((await read()).data.team.some(x=>x.id==='bonifancio'));
 await assert.rejects(()=>db.query("select recruitment_private.with_staff_directory('{}')"),/permission denied/);
 await identity(admin,'aal1');await assert.rejects(read,/Verified sign-in/);await identity(fresh);await db.exec('reset role');await db.query('update profiles set active=false where id=$1',[fresh]);await identity(fresh);await assert.rejects(read,/Active staff/);
 await db.exec('reset role;set role anon');await assert.rejects(read,/permission denied/);
 console.log('PASS staff directory SQL: additions and renames without workspace version changes, deactivation/shared exclusions, preserved legacy identifiers and metadata, tenant/MFA/role guards, unchanged tasks/chat access and finance deletion/numbering filters.');
}finally{await db.close()}
