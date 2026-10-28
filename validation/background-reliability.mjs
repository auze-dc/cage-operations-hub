import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const source=fs.readFileSync('dist/production.js','utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
let now=0,tick,requests=0,access=0,received=0,resolveRequest,rejectRequest,banners=0;
const ctx=vm.createContext({profile:{id:'alice'},sessionGeneration:1,sessionLoad:null,workspacePoll:null,workspacePollRunning:false,document:{hidden:false},savingNow:false,navigator:{onLine:true},pendingState:null,syncConflicts:[],workspaceVersion:1,remoteSnapshot:{},applyingRemote:false,
 Date:{now:()=>now},AbortSignal,setInterval:fn=>(tick=fn,1),clearInterval:()=>{},loadModuleAccess:async()=>{access++;},
 client:{rpc:()=>{requests++;return {abortSignal:()=>new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;})};}},
 window:{CAGE_SYNC:{equal:()=>false}},banner:{dataset:{},className:''},receiveWorkspace:()=>received++,flushSave:()=>{},applyPermissions:()=>{},showBanner:()=>banners++});
vm.runInContext(section('  function subscribe()','\n  // Chat messages'),ctx);
vm.runInContext('subscribe()',ctx);
const first=tick();await settle();assert.equal(requests,1);await tick();assert.equal(requests,1,'slow requests must not overlap');
vm.runInContext('subscribe()',ctx);await tick();assert.equal(requests,1,'resubscribing cannot overlap an old read');
resolveRequest({data:{version:2,data:{}}});await first;assert.equal(received,1);
const second=tick();await settle();assert.equal(requests,2);rejectRequest(Error('offline'));await second;assert.equal(banners,1);
now=1000;await tick();assert.equal(requests,2,'failed reads must back off');
now=17000;const third=tick();await settle();resolveRequest({data:{version:2,data:{}}});await third;assert.equal(ctx.banner.dataset.connection,undefined,'recovery clears only the connection warning');
assert.equal(access,2,'permissions are cached within the current subscription');
now=26000;const stale=tick();await settle();ctx.profile={id:'bob'};ctx.sessionGeneration++;rejectRequest(Error('old request failed'));await stale;assert.equal(banners,1,'an old session must not show an error in a new account');
ctx.navigator.onLine=false;now=100000;await tick();assert.equal(requests,4,'offline polling must pause');
// Personal queries must use the indexed user filter as well as database RLS.
const queries=[];ctx.profile={id:'bob'};ctx.client={from:table=>{const q={table};queries.push(q);const builder={select:()=>builder,eq:(key,value)=>(q[key]=value,builder),order:()=>builder,limit:()=>builder,abortSignal:signal=>(q.signal=signal,Promise.resolve({data:[],error:null}))};return builder;}};
vm.runInContext(section('  async function personalData()','\n  async function saveReminder'),ctx);await vm.runInContext('personalData()',ctx);
assert.equal(queries.length,2);for(const q of queries){assert.equal(q.user_id,'bob');assert.ok(q.signal);}
// Temporary server failures retain the open workspace; revocation still closes it.
let closed=0,retries=0;Object.assign(ctx,{sessionReady:true,accessRetryTimer:null,showBanner:()=>{},clearTimeout:()=>{},setTimeout:()=>++retries,loginFailure:()=>closed++});
vm.runInContext(section('  function sessionCheckFailure(','\n  async function verifiedProfile'),ctx);
vm.runInContext("sessionCheckFailure({status:500,message:'Server error'},true,'bob',sessionGeneration)",ctx);assert.equal(closed,0);assert.equal(retries,1);
for(const status of [401,403])vm.runInContext(`sessionCheckFailure({status:${status},message:'Access denied'},true,'bob',sessionGeneration)`,ctx);assert.equal(closed,2);
// A notification refresh requested during a read runs once afterward, without overlap.
const personal=fs.readFileSync('dist/personal-work.js','utf8');let uid='alice',loads=0,complete,notified=0;
const pc=vm.createContext({profile:()=>uid?{id:uid}:null,backend:()=>({personalData:()=>{loads++;return new Promise(resolve=>complete=resolve);}}),window:{dispatchEvent:()=>notified++},CustomEvent:class{},Event:class{},updateBadge:()=>{},refreshView:()=>{},$:()=>({textContent:''})});
vm.runInContext(personal.slice(personal.indexOf('let refreshSequence='),personal.indexOf('function formatWhen')),pc);
const pending=vm.runInContext('refresh()',pc);vm.runInContext('refresh()',pc);assert.equal(loads,1);complete({reminders:[],notifications:[]});await pending;assert.equal(loads,2);
uid='bob';complete({reminders:[],notifications:[{title:'private old data'}]});await settle();await settle();assert.equal(notified,2,'old-user results cannot dispatch notification updates');
console.log('PASS: slow reads single-flight across resubscribe; backoff and offline pause; recovery; indexed own-user queries and deadlines; stale sessions ignored; 500 recovery and 401/403 closure; trailing personal refresh.');
