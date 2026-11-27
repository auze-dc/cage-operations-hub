// Isolated Postgres + PDF tests; no real recipients or network mail.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {renderPayrollPDF} from '../supabase/functions/_shared/payroll-email-pdf.mjs';
const require=createRequire(process.env.CAGE_PAYROLL_TEST_MODULES||import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const pdfLib=require('pdf-lib');
const fontkit=require('@pdf-lib/fontkit');
const db=new PGlite();
const ids=Object.fromEntries(['org','org2','manager','staff','unverified','run','november','new','old','unpaid','noaddress','oldrelease','duplicate'].map((x,i)=>[x,'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')]));
const {org,org2,manager,staff,unverified,run,november}=ids;
const sql=s=>db.exec(s);
await sql(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth; create schema payroll_private;
grant usage on schema payroll_private to authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.organizations(id uuid primary key);
create table public.profiles(id uuid primary key,organization_id uuid,active boolean,role text,email text);
create table public.payroll_runs(id uuid primary key,organization_id uuid,status text);
create table public.payroll_items(id uuid primary key,organization_id uuid,run_id uuid,user_id uuid,period date,
 paid numeric(16,2),net numeric(16,2),paid_on date,released_at timestamptz,note text,unique(id,organization_id));
grant select on public.payroll_items to authenticated;
create function public.hub_mfa_satisfied() returns boolean language sql stable as
 $$select current_setting('test.mfa',true)='yes'$$;
create function payroll_private.manager(org uuid) returns boolean language sql stable security definer set search_path='' as
 $$select exists(select 1 from public.profiles where id=current_setting('test.caller',true)::uuid and active and role in ('admin','finance') and organization_id=org)$$;
insert into public.organizations values ('${org}'),('${org2}');
insert into public.profiles values ('${manager}','${org}',true,'admin','manager@example.test'),
 ('${staff}','${org}',true,'member','staff@example.test'),('${unverified}','${org}',true,'member','new@example.test');
insert into auth.users values ('${staff}','staff@example.test',now()),('${unverified}','new@example.test',null);
insert into public.payroll_runs values ('${run}','${org}','Approved'),('${november}','${org}','Approved');
`);
await sql(await fs.readFile(new URL('../supabase/migrations/20261127143500_payroll_email.sql',import.meta.url),'utf8'));
const insert=(id,options={})=>{
 const {r=run,p='2026-12-01', amount=5,user=staff,released=false}=options;
 return sql(`insert into public.payroll_items values ('${id}','${org}','${r}','${user}','${p}',${amount},5,'2026-12-20',${released?'now()':'null'},'private')`);
};
const release=id=>sql(`update public.payroll_items set released_at=now() where id='${id}'`);
const rows=async()=> (await db.query('select item_id,status,recipient from public.payroll_email_deliveries order by item_id')).rows;
await insert(ids.oldrelease);await release(ids.oldrelease);assert.deepEqual(await rows(),[]);
await sql(`insert into public.payroll_email_settings values ('${org}','2026-12-01',true)`);
await insert(ids.old,{r:november,p:'2026-11-01'});await release(ids.old);
await insert(ids.unpaid,{amount:4});await release(ids.unpaid);
assert.deepEqual(await rows(),[],'not retroactive, no November, no partial payments');
await insert(ids.noaddress,{user:unverified});await release(ids.noaddress);
await insert(ids.new);await release(ids.new);await release(ids.new);
assert.deepEqual((await rows()).map(x=>x.status),['queued','failed']);
await sql(`set role authenticated;set test.caller='${staff}';set test.mfa='yes'`);
assert.deepEqual((await db.query('select public.payroll_email_status($1) x',[run])).rows[0].x,[]);
await sql(`set test.caller='${manager}';set test.mfa='no'`);
assert.deepEqual((await db.query('select public.payroll_email_status($1) x',[run])).rows[0].x,[]);
await sql("set test.mfa='yes'");
assert.equal((await db.query('select public.payroll_email_status($1) x',[run])).rows[0].x.length,2);
await assert.rejects(db.query('select recipient from public.payroll_email_deliveries'),/permission denied/);
await assert.rejects(db.query('select public.claim_payroll_email($1)',[org]),/permission denied/);
await sql('reset role;set role service_role');
const claim=async(o=org)=>(await db.query('select public.claim_payroll_email($1) x',[o])).rows[0].x;
assert.equal(await claim(org2),null);
const job=await claim();assert.equal(job.recipient,'staff@example.test');assert.equal(job.slip.id,ids.new);assert.equal(job.slip.note,undefined);
assert.equal(await claim(),null,'never claim the same job twice');
await sql('reset role');
await sql(`update public.payroll_email_deliveries set claimed_at=now()-interval '11 minutes' where item_id='${ids.new}'`);
await insert(ids.duplicate);await release(ids.duplicate);
await sql(`update public.profiles set email='changed@example.test' where id='${staff}'; set role service_role`);
assert.deepEqual(await claim(),{skipped:true});
await sql('reset role');
assert.deepEqual((await rows()).map(x=>x.status),['review','failed','failed']);
await db.close();

const fixture={id:ids.new,period:'2026-12-01',employee_name:'Sample Employee',employee_number:'TEST-0000',
 job_title:'Test job',department:'Test team',gross:200,deductions:40,net:160,paid:160,
 paid_on:'2026-12-20',released_at:'2026-12-20T22:05:00Z',
 amounts:{basic:100,allowances:100,overtime:0,bonus:0,paye:20,pension:20,advance:0,other_deductions:0,employer_pension:40}};
const logo=await fs.readFile(new URL('../dist/cage-logo-new.png',import.meta.url));
await assert.rejects(renderPayrollPDF(pdfLib,{...fixture,paid:159},logo,fontkit),/fully paid/);
const bytes=await renderPayrollPDF(pdfLib,fixture,logo,fontkit);
const normal=await pdfLib.PDFDocument.load(bytes);
assert.equal(normal.getPageCount(),1);
assert.equal(normal.getTitle(),'Official CAGE payslip | December 2026');
const long=await pdfLib.PDFDocument.load(await renderPayrollPDF(pdfLib,{...fixture,amounts:{...fixture.amounts,
 allowance_items:Array.from({length:50},(_,i)=>({name:'Named allowance '+i,amount:2}))}},logo,fontkit));
assert.ok(long.getPageCount()>1,'long statements paginate instead of overwriting the stamp');
if(process.env.CAGE_PAYROLL_SAMPLE_PDF)await fs.writeFile(process.env.CAGE_PAYROLL_SAMPLE_PDF,bytes);
console.log('PASS: disabled and historical releases, partial payment, recipient verification, manager and MFA isolation, one durable claim, no ambiguous retry, and PDF rendering.');
