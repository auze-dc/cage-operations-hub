import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require((process.env.CAGE_TEST_MODULES||'/workspace/scratch/cage-fit-tests/node_modules')+'/jsdom');
const html=fs.readFileSync('dist/index.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const source=fs.readFileSync('dist/production.js','utf8');
async function setup(result){
 const dom=new JSDOM(html,{url:'https://hub.example',runScripts:'outside-only'}),w=dom.window;
 w.document.head.insertAdjacentHTML('beforeend','<style>'+fs.readFileSync('dist/monday-theme.css','utf8')+'</style>');
 const timers=new Map();let next=0,options;
 w.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};w.clearTimeout=id=>timers.delete(id);
 w.CAGE_CONFIG={mode:'production',supabaseUrl:'https://project.example',supabaseAnonKey:'public-test-key',organizationId:'org'};
 w.supabase={createClient:(url,key,opts)=>{options=opts;return {auth:{onAuthStateChange:()=>{},getSession:()=>result}};}};
 w.eval(source);
 return {dom,w,timers,boot:w.CAGE_BACKEND.boot({}),get options(){return options;}};
}
let t=await setup(new Promise(()=>{}));
assert.equal(t.w.document.body.classList.contains('session-checking'),true);
assert.notEqual(t.w.getComputedStyle(t.w.document.querySelector('.session-loader')).display,'none','a stalled saved-session check must show a loader');
for(const [id,timer] of [...t.timers])if(timer.ms===20000){t.timers.delete(id);timer.fn();}
await t.boot;
assert.equal(t.w.document.body.classList.contains('session-checking'),false);
assert.equal(t.w.document.getElementById('auth-gate').hidden,false);
assert.equal(t.w.getComputedStyle(t.w.document.getElementById('auth-gate')).display,'flex');
assert.match(t.w.document.getElementById('login-error').textContent,/Session check timed out/);
assert.equal(t.options.auth.lockAcquireTimeout,10000);
let sentSignal;
t.w.fetch=(input,options)=>new Promise((resolve,reject)=>{sentSignal=options.signal;sentSignal.addEventListener('abort',()=>reject(sentSignal.reason));});
const pending=t.options.global.fetch('https://project.example/auth/v1/token',{method:'POST'});
for(const [id,timer] of [...t.timers])if(timer.ms===10000){t.timers.delete(id);timer.fn();}
await assert.rejects(pending,/Sign-in connection timed out/);assert.equal(sentSignal.aborted,true);
// Long-running non-auth operations retain their caller's timeout rather than the sign-in deadline.
const original=new t.w.AbortController();let observed;
t.w.fetch=async(input,options)=>{observed=options.signal;return {ok:true};};
await t.options.global.fetch('https://project.example/functions/v1/opportunity-scan',{signal:original.signal});assert.equal(observed,original.signal);
t.dom.window.close();
t=await setup(Promise.resolve({data:{session:null},error:null}));await t.boot;
assert.equal(t.w.document.body.classList.contains('session-checking'),false);assert.equal(t.w.document.getElementById('auth-gate').hidden,false);
assert.equal(t.w.document.getElementById('login-error').textContent,'');t.dom.window.close();
console.log('PASS: stalled session stays visible; timeout exposes sign-in and retry; auth HTTP is aborted; scan timeouts unaffected; signed-out sign-in form opens.');
