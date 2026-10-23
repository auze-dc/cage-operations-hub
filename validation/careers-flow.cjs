// Run with jsdom available on NODE_PATH. Uses a mocked endpoint; never submits applicant data.
const {JSDOM}=require('jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
const html=fs.readFileSync('dist/careers.html','utf8'),script=fs.readFileSync('dist/careers.js','utf8');
const fixture={id:'job-one',title:'ICT & STEM Training Intern',department:'STEM',location:'Lilongwe, Malawi',employment_type:'Intern',closing_date:'2026-10-28',description:'Build practical learning.\n\nKey responsibilities include:\n\nTeach C++ and Python.\n\nSupport project work.',requirements:'Practical programming skills.\n\nAn added advantage\n\nMentoring experience.\n\nApplication and assessment\n\nInclude project links. <script>alert(1)</script>'};
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hub.cagemw.com/careers.html'}),w=dom.window,d=w.document;let posts=[],fail=false;
w.CAGE_CONFIG={supabaseUrl:'https://example.test'};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.fetch=async(url,options)=>{if(!options)return {ok:true,json:async()=>({ok:true,jobs:[fixture]})};posts.push(options.body);return {ok:!fail,json:async()=>fail?{ok:false,error:'Please retry'}:{ok:true,applicationId:'test-reference'}}};
w.eval(script);await tick();
assert.match(d.querySelector('.job-copy').textContent,/Practical programming skills/);assert.equal(d.querySelectorAll('.job-copy script').length,0);assert.match(d.querySelector('.job-meta').textContent,/28 October 2026/);assert.equal(d.querySelectorAll('.job-copy li').length,3);
const open=()=>d.querySelector('[data-apply]').click();const f=d.querySelector('form');const submit=async()=>{f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick()};
open();await submit();assert.equal(d.querySelector('[data-step="0"]').hidden,false);assert.equal(posts.length,0);
f.elements.fullName.value='Test Applicant';f.elements.email.value='applicant@example.test';f.elements.phone.value='+265 000000000';await submit();assert.equal(d.querySelector('[data-step="1"]').hidden,false);
await submit();assert.equal(d.querySelector('[data-step="1"]').hidden,false);assert.equal(posts.length,0);
let file=new w.File(['test'],'cv.exe',{type:'application/octet-stream'});Object.defineProperty(f.elements.cv,'files',{configurable:true,get:()=>[file]});await submit();assert.match(f.elements.cv.validationMessage,/PDF/);
file=new w.File(['sample'],'cv.pdf',{type:'application/pdf'});
// jsdom has no native file picker; emulate its required-file validity after selection.
f.elements.cv.checkValidity=()=>!f.elements.cv.validity.customError;await submit();assert.equal(d.querySelector('[data-step="2"]').hidden,false);assert.match(d.querySelector('#application-review').textContent,/Test Applicant/);
await submit();assert.equal(posts.length,0);f.elements.consent.checked=true;fail=true;await submit();assert.equal(posts.length,1);assert.equal(f.elements.email.value,'applicant@example.test');assert.match(d.querySelector('#application-message').textContent,/Please retry/);assert.equal(d.querySelector('#application-next').disabled,false);
fail=false;await submit();assert.equal(posts.length,2);assert.equal(posts[1].get('consent'),'true');assert.equal(posts[1].get('jobId'),'job-one');assert.equal(d.querySelector('#application-success').hidden,false);assert.match(d.querySelector('#application-reference').textContent,/test-reference/);
d.querySelector('#application-done').click();open();assert.equal(f.hidden,false);assert.equal(d.querySelector('#application-success').hidden,true);assert.equal(f.elements.fullName.value,'');assert.equal(d.querySelector('[data-step="0"]').hidden,false);
console.log('PASS: vacancy structure, requirements, escaped content, step validation, CV checks, consent, error recovery, success and reopening.');dom.window.close();})().catch(e=>{console.error(e);process.exitCode=1});
