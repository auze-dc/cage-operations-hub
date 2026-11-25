import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(`${process.env.CAGE_TEST_MODULES}/@electric-sql/pglite/dist/index.js`),db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema payroll_private;create table training_courses(id integer,default_fee numeric);insert into training_courses values(1,100);create table workspace_states(organization_id uuid,data jsonb);create table invoice_payments(organization_id uuid,invoice_id text);insert into workspace_states values('00000000-0000-0000-0000-000000000001','{"quotes":[],"invoices":[],"expenses":[]}');`);
const tax=fs.readFileSync('supabase/migrations/20261027172620_paye_and_named_allowances.sql','utf8');await db.exec(tax.slice(tax.indexOf('create function payroll_private.monthly_paye'),tax.indexOf('create or replace function payroll_private.amounts')));
const file=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_multi_currency_records.sql'));await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
assert.equal((await db.query('select currency from training_courses')).rows[0].currency,'MWK');
for(const currency of ['MWK','USD','GBP','EUR']){
 await db.query('update training_courses set currency=$1',[currency]);
 await db.query(`update workspace_states set data=jsonb_set(data,'{quotes}',$1::jsonb)`,[JSON.stringify([{id:'q',currency,amount:100.5}])]);
 const input={basic:2000000,overtime:0,bonus:0,advance:0,other_deductions:0,allowance_items:[{name:'Travel',amount:100000}],entry_currency:currency,mwk_per_unit:2000};
 const v=(await db.query('select payroll_private.amounts($1) v',[input])).rows[0].v;
 assert.equal(v.basic,2000000);assert.equal(v.taxable_income,2100000);assert.equal(v.paye,605500);assert.equal(v.pension,105000);assert.equal(v.entry_currency,currency);assert.equal(v.mwk_per_unit,currency==='MWK'?1:2000);
 const again=(await db.query('select payroll_private.amounts($1) v',[v])).rows[0].v;assert.deepEqual(again,v,'normalizing a saved salary cannot convert twice');
}
await assert.rejects(db.exec(`update training_courses set currency='XYZ'`),/check constraint/);
await assert.rejects(db.exec(`update workspace_states set data=jsonb_set(data,'{quotes}','[{"id":"q","currency":"XYZ"}]')`),/Choose MWK/);
await db.exec(`update workspace_states set data=jsonb_set(data,'{invoices}','[{"id":"i","currency":"USD","status":"Sent","amount":200}]');insert into invoice_payments values('00000000-0000-0000-0000-000000000001','i');`);
await assert.rejects(db.exec(`update workspace_states set data=jsonb_set(data,'{invoices,0,currency}','"GBP"')`),/Currency cannot change after payment/);
// Legacy absence still means MWK; normal metadata edits do not need a data backfill.
await db.exec(`update workspace_states set data=jsonb_set(data,'{expenses}','[{"id":"e","amount":12}]');update workspace_states set data=jsonb_set(data,'{expenses,0,description}','"edited"');`);
for(const rate of [undefined,0,-1,1e10])await assert.rejects(db.query('select payroll_private.amounts($1)',[{basic:100,overtime:0,bonus:0,advance:0,other_deductions:0,allowances:0,entry_currency:'USD',mwk_per_unit:rate}]),/exchange rate/);

// The fixture's fresh CREATE has PUBLIC default. Production uses CREATE OR REPLACE
// on the existing revoked function; verify the migration does not grant access.
assert.doesNotMatch(fs.readFileSync('supabase/migrations/'+file,'utf8'),/grant\s+.*execute/i);
await db.exec(fs.readFileSync('validation/payroll-pension.sql','utf8'));await db.close();console.log('PASS: currency defaults/constraints, all four currencies, server PAYE/pension authority, repeat-safe salary normalization, required FX rate, legacy edits and paid-invoice currency lock.');
