import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(`${process.env.CAGE_TEST_MODULES}/@electric-sql/pglite/dist/index.js`);
const db=new PGlite();
try{
 await db.exec('create role anon;create role authenticated;create role service_role;grant usage on schema public to anon,authenticated,service_role;');
 const migration=fs.readFileSync('supabase/migrations/20261028221354_restrict_background_jobs.sql','utf8');
 const functions=[...migration.matchAll(/'public\.([^']+)'::regprocedure/g)].map(x=>'public.'+x[1]);
 assert.equal(functions.length,11);
 for(const f of functions)await db.exec(`create function ${f} returns void language sql as $$select$$;grant execute on function ${f} to anon,authenticated,service_role;`);
 await db.exec('create function public.hub_partner_submit(text,jsonb) returns void language sql as $$select$$;grant execute on function public.hub_partner_submit(text,jsonb) to anon;');
 await db.exec(migration);
 for(const f of functions){
  const [row]=(await db.query("select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') u,has_function_privilege('service_role',$1,'execute') s",[f])).rows;
  assert.deepEqual(row,{a:false,u:false,s:true},f);
 }
 assert.equal((await db.query("select has_function_privilege('anon','public.hub_partner_submit(text,jsonb)','execute') a")).rows[0].a,true);
 await db.exec('set role service_role;select public.claim_staff_email();reset role;');
 await assert.rejects(db.exec('set role anon;select public.claim_staff_email();'),/permission denied/);
 console.log('PASS: all 11 internal RPCs blocked for anon/staff; server execution retained; separate public-token endpoint unchanged; no emails or applications created.');
}finally{await db.close();}
