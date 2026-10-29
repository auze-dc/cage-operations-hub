import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require(process.env.CAGE_TEST_MODULES+'/jsdom');
const {PGlite}=await import(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite/dist/index.js');
const migration=fs.readFileSync('supabase/setup/hub_mfa_guard.sql','utf8');
const db=new PGlite();
try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;create role authenticator;
 create schema auth;create schema storage;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table auth.mfa_factors(id uuid,user_id uuid,status text);
 create table public.profiles(id uuid primary key,role text,active boolean);
 create table public.business(id int);
 create table public.server_only(id int);
 create table storage.objects(id int);
 alter table public.profiles enable row level security;
 alter table public.business enable row level security;
 alter table public.server_only enable row level security;
 alter table storage.objects enable row level security;
 create policy original_access on public.profiles for all to authenticated using(true) with check(true);
 create policy original_access on public.business for all to authenticated using(true) with check(true);
 create policy original_access on storage.objects for all to authenticated using(true) with check(true);
 grant usage on schema public,storage,auth to anon,authenticated,service_role;
 grant select,insert,update,delete on public.profiles,public.business,public.server_only,storage.objects to authenticated,service_role;
 insert into public.profiles values('00000000-0000-4000-8000-000000000001','admin',true),('00000000-0000-4000-8000-000000000002','member',true);
 insert into public.business values(1);insert into storage.objects values(1);insert into public.server_only values(1);
 create function public.test_definer() returns int language sql security definer as $$select count(*)::int from public.business$$;
 grant execute on function public.test_definer() to authenticated;
 `);
 await db.exec(migration);await db.exec(migration);
 async function claims(role,id,aal){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,...(id?{sub:id}:{}),...(aal?{aal}: {})})]);}
 const admin='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002';
 await claims('authenticated',admin,'aal1');
 await db.exec('set role authenticated');
 assert.equal((await db.query('select public.hub_mfa_satisfied() ok')).rows[0].ok,false,'unenrolled admin requires MFA');
 assert.equal((await db.query('select public.hub_security_status() s')).rows[0].s.required,true);
 assert.equal((await db.query('select * from public.business')).rows.length,0);
 assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await assert.rejects(db.exec("insert into public.business values(2)"),/row-level security/);
 await db.query("select set_config('request.path','/rpc/test_definer',false)");
 await assert.rejects(db.exec("select public.hub_check_request();select public.test_definer()"),/Two-step verification/,'pre-request blocks definer bypass');
 await db.query("select set_config('request.path','/rpc/hub_security_status',false)");
 await db.exec('select public.hub_check_request()');
 await claims('authenticated',admin,'aal2');
 await db.exec('select public.hub_assert_mfa()');
 assert.equal((await db.query('select * from public.business')).rows.length,1);
 assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 assert.equal((await db.query('select * from public.server_only')).rows.length,0,'restrictive policy grants no server-only rows');
 await claims('authenticated',member,'aal1');
 await db.exec('select public.hub_assert_mfa()');
 await db.exec('reset role');
 await db.query("insert into auth.mfa_factors values('00000000-0000-4000-8000-000000000003',$1,'verified')",[member]);
 await db.exec('set role authenticated');
 await assert.rejects(db.exec('select public.hub_assert_mfa()'),/Two-step verification/);
 await claims('anon',null,null);await db.exec('reset role;set role anon');
 await db.exec('select public.hub_check_request()');
 await assert.rejects(db.exec('select public.hub_security_status()'),/permission denied/);
 await db.exec('reset role;set role service_role');await claims('service_role',null,null);await db.exec('select public.hub_assert_mfa();select public.hub_check_request()');
 await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from pg_policy where polname='hub_mfa_required' and not polpermissive")).rows[0].n,4);
}finally{await db.close();}
const source=fs.readFileSync('dist/security.js','utf8'),settle=()=>new Promise(r=>setImmediate(r));
function setup({level='aal1',required=false,factors=[],failVerify=false,missing=false,network=false}={}){
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://hub.test',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.AbortSignal=AbortSignal;let verified=false,removed=[],enrolled=0,attempts=0;
 const ok=data=>({data,error:null});
 const client={rpc:()=>({abortSignal:async()=>network?{error:{message:'Connection failed',code:'NETWORK'}}:missing?{error:{code:'PGRST202'}}:ok({required})}),auth:{mfa:{
  getAuthenticatorAssuranceLevel:async()=>ok({currentLevel:verified?'aal2':level}),
  listFactors:async()=>ok({totp:verified?[{id:'new',status:'verified'}]:factors}),
  enroll:async()=>{enrolled++;return ok({id:'new',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'TEST-SETUP-KEY'}});},
  challengeAndVerify:async({code})=>{attempts++;assert.equal(code,'123456');if(failVerify&&attempts===1)return {error:{message:'Invalid code'}};verified=true;return ok({});},
  unenroll:async({factorId})=>{removed.push(factorId);return ok({});}
 }}};
 w.eval(source);return {w,client,dom,removed,enrolled:()=>enrolled,verified:()=>verified};
}
for(const options of [{level:'aal2',required:true},{required:false},{missing:true}]){
 const t=setup(options);await t.w.CAGE_SECURITY.ensure(t.client,{bootstrap:true});assert.equal(t.enrolled(),0);assert.equal(t.w.document.querySelector('dialog'),null);t.dom.window.close();
}
{
 const t=setup({required:true,failVerify:true}),p=t.w.CAGE_SECURITY.ensure(t.client,{bootstrap:true});await settle();
 assert.equal(t.enrolled(),1);assert.equal(t.w.localStorage.length,0,'setup secret never persisted');
 const form=t.w.document.querySelector('form'),input=form.querySelector('input');input.value='123456';form.dispatchEvent(new t.w.Event('submit',{cancelable:true}));await settle();
 assert.match(form.textContent,/Invalid code/);assert.equal(t.verified(),false);
 input.value='123456';form.dispatchEvent(new t.w.Event('submit',{cancelable:true}));await p;
 assert.equal(t.verified(),true);assert.equal(t.w.document.querySelector('dialog'),null);assert.deepEqual(t.removed,[]);t.dom.window.close();
}
{
 const t=setup({factors:[{id:'old',status:'verified'}]}),p=t.w.CAGE_SECURITY.ensure(t.client,{bootstrap:true});await settle();
 assert.equal(t.enrolled(),0);assert.equal(t.w.document.querySelector('img'),null);
 t.w.document.querySelector('button[type=button]').click();await assert.rejects(p,/cancelled/);assert.deepEqual(t.removed,[]);t.dom.window.close();
}
{
 const t=setup({required:true}),p=t.w.CAGE_SECURITY.ensure(t.client,{bootstrap:true});await settle();t.w.document.querySelector('button[type=button]').click();await assert.rejects(p,/cancelled/);assert.deepEqual(t.removed,['new']);assert.equal(t.w.document.querySelector('dialog'),null);t.dom.window.close();
}
{
 const t=setup({network:true});await assert.rejects(t.w.CAGE_SECURITY.ensure(t.client,{bootstrap:true}),/Connection failed/);assert.equal(t.enrolled(),0);t.dom.window.close();
}
const {transform}=await import('esbuild');
const helper=await transform(fs.readFileSync('supabase/functions/_shared/staff-mfa.ts','utf8'),{loader:'ts',format:'esm'});
const {assertStaffMfa}=await import('data:text/javascript;base64,'+Buffer.from(helper.code).toString('base64'));
assert.equal(await assertStaffMfa({rpc:async()=>({error:null})}),null);
assert.match(await assertStaffMfa({rpc:async()=>({error:{message:'Denied'}})}),/Two-step verification/);
assert.match(await assertStaffMfa({rpc:async()=>{throw Error('offline')}}),/could not be checked/);
for(const name of ['admin-users','notify-interview']){
 const code=fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8');
 assert.ok(code.indexOf('await assertStaffMfa(')<code.indexOf('.from("profiles")'),'guard precedes service-role reads: '+name);
}
const production=fs.readFileSync('dist/production.js','utf8');
assert.ok(production.indexOf('ensure(client,{bootstrap:true})')<production.indexOf('const nextProfile=await verifiedProfile'),'MFA bootstrap precedes profile/workspace load');
console.log('PASS MFA: admin enrollment; existing factor challenge; cancellation/retry without secret persistence; Data API definer guard; restrictive database/storage policies; public and server paths retained.');
