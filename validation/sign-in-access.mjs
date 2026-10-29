import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require(process.env.CAGE_TEST_MODULES+'/jsdom');
const source=fs.readFileSync('dist/production.js','utf8');
const html=fs.readFileSync('dist/index.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const valid={id:'alice',organization_id:'org',active:true,role:'admin',full_name:'Test Administrator',initials:'TA'};
const ok=data=>({data,error:null,status:200}),timeout={data:null,error:{message:'TimeoutError: signal timed out'},status:0};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(profiles=[ok(valid)],workspace=[ok({version:1,data:{}})],permissions=[ok([])]){
 const dom=new JSDOM(html,{url:'https://hub.test',runScripts:'outside-only'}),w=dom.window;
 let next=0,onAuth,reads=[],replacements=[],authReads=0;const timers=new Map();
 w.structuredClone=structuredClone;w.setInterval=()=>1;w.clearInterval=()=>{};
 w.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};w.clearTimeout=id=>timers.delete(id);
 w.CAGE_CONFIG={mode:'production',supabaseUrl:'https://project.test',supabaseAnonKey:'test-public-key',organizationId:'org'};
 w.CAGE_SYNC={apply:(state)=>state,equal:()=>true,changes:()=>[]};
 function response(kind,signal){
  const earlier=reads.filter(x=>x.kind===kind);if(earlier.length)assert.equal(earlier.at(-1).signal.aborted,true,'finish or abort before retry');
  reads.push({kind,signal});const result=kind==='profiles'?profiles.shift():kind==='workspace'?workspace.shift():permissions.shift();
  assert.ok(result,'unexpected extra '+kind+' read');
  return result==='stall'?new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})):Promise.resolve(result);
 }
 const client={auth:{onAuthStateChange:fn=>onAuth=fn,getSession:async()=>{authReads++;return ok({session:{user:{id:'alice'},access_token:'fake-test-token'}});}},
 from:kind=>{const builder={select:()=>builder,eq:()=>builder,single:()=>builder,abortSignal:signal=>response(kind,signal)};return builder;},
 rpc:()=>({abortSignal:signal=>response('workspace',signal)})};
 w.supabase={createClient:()=>client};w.eval(source);
 const boot=w.CAGE_BACKEND.boot({replaceState:data=>replacements.push(data)});await settle();
 return {w,dom,boot,reads,replacements,timers,authReads:()=>authReads,onAuth:(...args)=>onAuth(...args),async fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,'missing '+ms+' timer');timers.delete(entry[0]);entry[1].fn();await settle();},close:()=>dom.window.close()};
}
for(const failure of [timeout,{data:null,error:{message:'Gateway timeout'},status:504},'stall']){
 const t=await setup([failure,ok(valid)]);
 if(failure==='stall')await t.fire(15000);
 assert.equal(t.w.CAGE_BACKEND.currentProfile(),null);assert.equal(t.replacements.length,0,'never open unverified workspace');assert.equal(t.w.document.querySelector('#login-form [type=submit]').disabled,true);
 assert.match(t.w.document.getElementById('login-error').textContent,/Retrying your staff profile/);
 await t.fire(1000);await t.boot;
 assert.equal(t.w.CAGE_BACKEND.currentProfile().id,'alice');assert.equal(t.w.document.getElementById('auth-gate').hidden,true);
 assert.equal(t.reads.filter(x=>x.kind==='profiles').length,2);assert.equal(t.authReads(),1,'profile retry reuses the signed-in session');assert.equal(t.replacements.length,1);t.close();
}
for(const result of [{data:null,error:{message:'Denied'},status:401},{data:null,error:{message:'Denied'},status:403},{data:null,error:{message:'No profile',code:'PGRST116'},status:406},ok({...valid,active:false}),ok({...valid,organization_id:'other-org'}),ok({...valid,id:'other-user'}),ok({...valid,role:'unknown'})]){
 const t=await setup([result]);await t.boot;assert.equal(t.reads.length,1,'ineligible access must fail before loading workspace');assert.equal(t.w.CAGE_BACKEND.currentProfile(),null);assert.equal(t.w.document.getElementById('auth-gate').hidden,false);t.close();
}
{
 const t=await setup([timeout,timeout]);await t.fire(1000);await t.boot;
 assert.equal(t.w.CAGE_BACKEND.currentProfile(),null);assert.equal(t.reads.length,2,'persistent failure has a bounded retry count');
 const message=t.w.document.getElementById('login-error').textContent;assert.equal(t.w.document.querySelector('#login-form [type=submit]').disabled,false);assert.match(message,/Retry opening the workspace/);assert.doesNotMatch(message,/TimeoutError: signal/);t.close();
}
{
 const t=await setup([timeout,ok(valid)]);t.onAuth('SIGNED_OUT',null);await t.fire(0);await t.fire(1000);await t.boot;
 assert.equal(t.reads.length,1,'sign-out cancels queued profile retry');assert.equal(t.w.CAGE_BACKEND.currentProfile(),null);assert.equal(t.replacements.length,0);t.close();
}
{
 const t=await setup([ok(valid)],[{data:null,error:{message:'Gateway timeout'},status:504},ok({version:2,data:{}})]);await t.fire(1000);await t.boot;
 assert.equal(t.w.CAGE_BACKEND.currentProfile().id,'alice');assert.equal(t.reads.filter(x=>x.kind==='workspace').length,2);assert.equal(t.reads.filter(x=>x.kind==='profiles').length,1);t.close();
}
{
 const t=await setup([ok(valid)],[],[{data:null,error:{message:'Access denied'},status:403}]);await t.boot;
 assert.equal(t.w.CAGE_BACKEND.currentProfile(),null);assert.equal(t.reads.filter(x=>x.kind==='workspace').length,0,'denied module permissions must stop workspace reads');t.close();
}
console.log('PASS: actual sign-in boot recovers after aborted/504/stalled profile reads without another password submission; bounded persistent failure; 401/403/missing/inactive/wrong-org/invalid-role denied; sign-out cancels retries; workspace retry.');
