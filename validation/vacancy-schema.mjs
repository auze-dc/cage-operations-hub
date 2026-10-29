import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.CAGE_TEST_MODULES+'/@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create table public.job_openings(id int primary key,title text,department text,location text,description text,requirements text,closing_date date,status text,updated_at timestamptz default now());create table public.job_applications(id int primary key);insert into job_openings values(1,'Legacy','HR','Malawi','Summary','Skills','2026-10-01','Open',now());insert into job_applications values(1);`);
const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_modern_vacancy_editor.sql'));await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
assert.equal((await db.query('select salary_expectation from job_applications where id=1')).rows[0].salary_expectation,null);
await db.exec('update job_applications set id=1 where id=1');
await assert.rejects(()=>db.exec('insert into job_applications(id) values(2)'),/Salary expectation/);
for(const invalid of ["-1,'MWK','month'","100,'XXX','month'","100,'MWK',null"]){await assert.rejects(()=>db.exec(`insert into job_applications(id,salary_expectation,salary_currency,salary_period) values(2,${invalid})`));}
await db.exec("insert into job_applications(id,salary_expectation,salary_currency,salary_period) values(2,0,'MWK','month')");
await assert.rejects(()=>db.exec("insert into job_openings(id,title,status,screening_questions) values(2,'Draft','Draft',array['Q','Q'])"),/different screening/);
await assert.rejects(()=>db.exec("insert into job_openings(id,title,status,closing_date) values(2,'Incomplete','Open','2099-11-04')"),/Complete role/);
await db.exec("insert into job_openings(id,title,status,closing_date) values(2,'Working draft','Draft','2099-11-04')");
assert.equal((await db.query('select count(*)::int n from job_openings')).rows[0].n,2);
await db.close();console.log('PASS: additive migration preserves legacy records, new applications require salary, invalid salary and screening values fail, drafts remain editable.');
