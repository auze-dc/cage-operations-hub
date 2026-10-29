import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {syncSourceMirrors} from '../scripts/source-mirrors.mjs';
syncSourceMirrors(false);
const app=fs.readFileSync('dist/app.js','utf8');
const ctx={TODAY:'2026-10-29',state:{quotes:[{id:'a',number:'Q-1'},{id:'b',number:'Q-1'}]},projectTasks:()=>[],isOverdue:t=>t.due<'2026-10-29'&&t.status!=='Done'};
vm.createContext(ctx);
for(const name of ['projectHealth','displayRecordReference']){
 const code=app.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))?.[0];assert.ok(code,name);vm.runInContext(code,ctx);
}
assert.equal(ctx.projectHealth({id:'p',deadline:'2026-10-01'}),'attention');
assert.equal(ctx.projectHealth({id:'p',deadline:'2026-10-29'}),'on-track');
assert.equal(ctx.projectHealth({id:'p',deadline:'2026-12-01'}),'on-track');
assert.equal(ctx.projectHealth({id:'p',deadline:''}),'on-track');
ctx.projectTasks=()=>[{status:'Done',due:'2026-10-01'}];
assert.equal(ctx.projectHealth({id:'p',deadline:'2026-10-01'}),'complete');
ctx.projectTasks=()=>[{status:'Blocked',due:'2026-12-01'}];
assert.equal(ctx.projectHealth({id:'p',deadline:'2026-12-01'}),'attention');
const record=ctx.state.quotes[0];assert.equal(ctx.displayRecordReference('quotes',record),'Q-1 · ID a');assert.equal(record.number,'Q-1');
assert.equal(ctx.displayRecordReference('invoices',{id:'i',number:'INV-1'}),'INV-1');
const require=createRequire(import.meta.url);const {JSDOM}=require(process.env.CAGE_TEST_MODULES+'/jsdom');
const dom=new JSDOM('<body></body>',{url:'https://hub.cagemw.com',runScripts:'outside-only'});
const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(fs.readFileSync('dist/draft-privacy.js','utf8'));
const privacy=w.CAGE_DRAFT_PRIVACY,storage=w.localStorage;
storage.setItem('cage-unsynced-u','important');storage.setItem('cage-unsynced-u:before-reset:1','recovery');storage.setItem('cage-unsynced-user2','other');
let choice=privacy.choose('u');let dialog=w.document.querySelector('dialog');
assert.ok(dialog);assert.equal([...dialog.querySelectorAll('button')].find(b=>b.textContent.startsWith('Clear')).disabled,true);
[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click();assert.equal(await choice,'cancel');assert.equal(storage.getItem('cage-unsynced-u'),'important');
choice=privacy.choose('u');dialog=w.document.querySelector('dialog');[...dialog.querySelectorAll('button')].find(b=>b.textContent.startsWith('Keep')).click();
assert.equal(await choice,'keep');assert.equal(storage.getItem('cage-unsynced-u'),'important');
choice=privacy.choose('u');dialog=w.document.querySelector('dialog');const checkbox=dialog.querySelector('input');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change'));
[...dialog.querySelectorAll('button')].find(b=>b.textContent.startsWith('Clear')).click();assert.equal(await choice,'clear');
privacy.clear('u');assert.equal(storage.getItem('cage-unsynced-u'),null);assert.equal(storage.getItem('cage-unsynced-u:before-reset:1'),null);assert.equal(storage.getItem('cage-unsynced-user2'),'other');dom.window.close();
const child=spawn(process.execPath,['scripts/dev-server.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
try{
 const port=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('Dev server did not start')),10000);child.once('error',reject);child.stdout.on('data',data=>{out+=data;const m=out.match(/server: (\d+)/);if(m){clearTimeout(timeout);resolve(Number(m[1]));}});child.once('exit',code=>reject(Error('Dev server exited '+code)));});
 const origin='http://127.0.0.1:'+port;
 for(const route of ['/','/apply','/careers'])assert.equal((await fetch(origin+route)).status,200,route);
 assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
 assert.match((await fetch(origin+'/app.js')).headers.get('content-type'),/javascript/);
 const raw=path=>new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});
 for(const path of ['/%2e%2e/package.json','/.env','/%2e%2e%5cpackage.json','/does-not-exist'])assert.equal(await raw(path),404,path);
}finally{child.kill('SIGTERM');}
console.log('PASS enterprise: overdue project detection; reference disambiguation without renumbering; explicit draft retention/cleanup and account isolation; canonical mirrors; safe dependency-free development server.');
