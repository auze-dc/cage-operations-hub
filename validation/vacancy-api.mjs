import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
let handler, uploads=0, inserts=[],job={id:'job',status:'Open',closing_date:'2099-11-04',cover_note_required:true,screening_questions:['Why this role?']};
const client={rpc:async()=>({data:true}),from(table){return {select(){return this},eq(){return this},gte(){return this},order:async()=>({data:[]}),single:async()=>({data:job}),insert:async data=>{inserts.push(data);return {data:null}}}},storage:{from(){return {upload:async()=>{uploads++;return {}},remove:async()=>({})}}}};
const source=fs.readFileSync('supabase/functions/careers/index.ts','utf8').replace(/^import .*\n/,'');
vm.runInNewContext((await transform(source,{loader:'ts',format:'iife'})).code,{createClient:()=>client,Deno:{env:{get:()=>''},serve:fn=>handler=fn},Intl,Date,Response,File,crypto,TextEncoder,Uint8Array,FormData,JSON,Number,String,Array});
function form(values={}){const f=new FormData();for(const [k,v]of Object.entries({jobId:'job',fullName:'Fixture applicant',email:'applicant@example.test',phone:'+265000000000',consent:'true',coverNote:'Relevant experience',salaryExpectation:'350000',salaryCurrency:'MWK',salaryPeriod:'month',screeningAnswers:'["My experience matches."]',...values}))f.set(k,v);f.set('cv',new File(['fixture'],'cv.pdf',{type:'application/pdf'}));return f}
async function submit(values){return handler(new Request('https://example.test',{method:'POST',body:form(values)}))}
for(const salaryExpectation of ['', '-1','NaN','Infinity','1e6','1.001','1000000000000']){assert.equal((await submit({salaryExpectation})).status,400)}
assert.equal((await submit({salaryCurrency:'XXX'})).status,400);assert.equal((await submit({salaryPeriod:'week'})).status,400);assert.equal((await submit({coverNote:''})).status,400);assert.equal((await submit({screeningAnswers:'[]'})).status,400);assert.equal((await submit({screeningAnswers:'[" "]'})).status,400);assert.equal(uploads,0);assert.equal(inserts.length,0);
assert.equal((await submit({})).status,200);assert.equal(uploads,1);assert.equal(inserts[0].salary_expectation,350000);assert.equal(inserts[0].salary_currency,'MWK');assert.equal(inserts[0].salary_period,'month');assert.equal(inserts[0].screening_answers[0].question,'Why this role?');
assert.equal((await submit({salaryExpectation:'0'})).status,200);
job={...job,status:'Closed'};assert.equal((await submit({})).status,400);assert.equal(uploads,2);
console.log('PASS: public API requires valid salary, currency, period, cover note and question answers before uploading; valid and zero expectations persist; closed vacancies reject.');
