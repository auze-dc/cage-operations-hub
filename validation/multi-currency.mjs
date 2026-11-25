import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require(process.env.CAGE_TEST_MODULES+'/jsdom');
const src=f=>fs.readFileSync('dist/'+f,'utf8');
const dom=new JSDOM(src('index.html').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''),{url:'https://currency.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.structuredClone=structuredClone;w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.scrollTo=()=>{};
let lastSave,number=0;
w.CAGE_BACKEND={currentProfile:()=>({id:'qa',active:true,role:'admin',full_name:'QA'}),currentMemberId:()=> 'alexander',moduleLevel:()=> 'edit',isProduction:()=>false,scheduleSave:s=>lastSave=structuredClone(s),boot:app=>app.renderAll(),reserveRecordNumber:async()=> 'QA-'+(++number),canSendInvoice:()=>true};
for(const f of ['currency.js','app.js','amount-input.js','documents-ui.js'])w.eval(src(f)+(f==='app.js'?';window.qaState=()=>state;':''));
const C=w.CageCurrency;
assert.equal(C.format(1250.50,false,'USD'),'USD 1,250.50');assert.equal(C.format(1.01,false,'GBP'),'GBP 1.01');
assert.equal(C.totals([{amount:100},{amount:20,currency:'USD'},{amount:30,currency:'USD'},{amount:7,currency:'EUR'}]),'MWK 100 · USD 50.00 · EUR 7.00');
assert.throws(()=>C.code('<script>'));
for(const id of ['quote','invoice','expense','deal','request','approval','commercial','training-program']){
 const f=w.document.getElementById(id+'-form');assert.equal(f.querySelectorAll('[name=currency]').length,1,id+' exactly one currency choice');assert.deepEqual([...f.elements.currency.options].map(o=>o.value),['MWK','USD','GBP','EUR']);
}
const call=async code=>{await w.eval(code);await new Promise(r=>setTimeout(r,5));};
const form=id=>w.document.getElementById(id+'-form');
const fill=(f,values)=>{for(const [k,v] of Object.entries(values))f.elements[k].value=v;};
// Exercise real document handlers, calculations and saves for every supported currency.
for(const currency of C.codes){
 await call('openQuoteDialog()');const q=form('quote');fill(q,{client:'QA client',recipient:'qa@example.com',description:'Currency check',currency});q.querySelector('[data-item-description]').value='Survey';q.querySelector('[data-item-quantity]').value='2';q.querySelector('[data-item-price]').value='1,250.50';q.dispatchEvent(new w.Event('input'));
 w.qaEvent={preventDefault(){},currentTarget:q};await call('createQuote(qaEvent)');const saved=lastSave.quotes.find(q=>q.number==='QA-'+number);assert.equal(saved.currency,currency);assert.equal(saved.amount,2501);assert.match(w.document.getElementById('finance-quote-list').textContent,new RegExp(currency+' 2,501'));
 await call('openInvoiceDialog()');const f=form('invoice');fill(f,{client:'QA client',recipient:'qa@example.com',description:'Currency check',currency,project:'p-geoportal',issued:'2026-11-25',due:'2026-12-25'});f.querySelector('[data-item-description]').value='Survey';f.querySelector('[data-item-price]').value='1250.50';f.dispatchEvent(new w.Event('input'));w.qaEvent={preventDefault(){},currentTarget:f};await call('createInvoice(qaEvent)');const inv=lastSave.invoices.find(i=>i.number==='QA-'+number);assert.ok(inv);assert.equal(inv.currency,currency);assert.equal(inv.amount,1250.5);
}
// Mixed-currency dashboards, reports and project margins must not relabel dollars as MWK.
w.eval(`qaState().invoices=[{id:'i-mwk',number:'MWK-1',client:'QA',project:'p-geoportal',amount:100,currency:'MWK',status:'Sent',due:'2020-01-01'},{id:'i-usd',number:'USD-1',client:'QA',project:'p-geoportal',amount:50,currency:'USD',status:'Sent',due:'2020-01-01'}];qaState().expenses=[{id:'e-usd',description:'USD cost',project:'p-geoportal',amount:10,currency:'USD',date:'2026-11-25',status:'Approved'}];renderAll();`);
assert.match(w.document.getElementById('metric-grid').textContent,/MWK 100 · USD 50/);
const margins=w.document.getElementById('project-profitability').textContent;assert.match(margins,/MWK 100/);assert.match(margins,/USD 40/);assert.doesNotMatch(margins,/MWK 140/);
// Edits retain selected currency, and new opportunities copy it from requests.
w.eval(`qaState().deals[0].currency='GBP';openDealDialog(qaState().deals[0].id);`);assert.equal(form('deal').elements.currency.value,'GBP');
w.eval(`qaRequest={id:'qa-request',title:'Currency',organisation:'QA',owner:'alexander',value:25,currency:'EUR',type:'Grant',deadline:'2026-12-01'};qaDeal=ensureRequestCRM(qaRequest);qaCommercial=ensureRequestCommercial(qaRequest);`);
assert.equal(w.qaDeal.currency,'EUR');assert.equal(w.qaCommercial.currency,'EUR');
w.qaRequest.stage='Qualified';w.qaRequest.currency='GBP';w.eval('syncRequestLinks(qaRequest)');assert.equal(w.qaDeal.currency,'GBP');assert.equal(w.qaCommercial.currency,'GBP');
// Real payroll form: foreign amounts convert before statutory calculations; reopen is stable.
const fixture={manage:true,approve:true,people:[{id:'qa',name:'QA'}],salaries:[{user_id:'qa',amounts:{basic:2000000,allowances:100000,allowance_items:[{name:'Travel',amount:100000,pension_treatment:'regular'}],overtime:0,bonus:0,advance:0,other_deductions:0,entry_currency:'USD',mwk_per_unit:2000},enabled:true,revision:1}],runs:[],slips:[],items:[]};
let payrollPayload;
w.CAGE_BACKEND.payrollData=async()=>fixture;w.CAGE_BACKEND.payrollWrite=async(a,t,e,p)=>{payrollPayload=p;return t;};
w.eval(src('payroll.js'));await w.CAGE_PAYROLL.refresh();w.document.querySelector('[data-payroll-tab="settings"]')?.click();
// The settings tab uses a role tab; find its declared action if needed.
const salaryTab=[...w.document.querySelectorAll('[role=tab]')].find(b=>b.textContent==='Salary settings');assert.ok(salaryTab);salaryTab.click();w.document.querySelector('[data-payroll-action="salary"][data-payroll-id="qa"]').click();
const salary=w.document.getElementById('payroll-amount-form');assert.equal(salary.elements.entry_currency.value,'USD');assert.equal(Number(salary.elements.basic.value),1000);assert.equal(Number(salary.querySelector('.payroll-allowance-amount').value),50);assert.equal(salary.elements.taxable_income.value,'2,100,000.00');
salary.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(payrollPayload.amounts.basic,2000000);assert.equal(payrollPayload.amounts.allowance_items[0].amount,100000);assert.equal(payrollPayload.amounts.entry_currency,'USD');assert.equal(payrollPayload.amounts.mwk_per_unit,2000);
// A new foreign currency never silently assumes a rate of one.
salaryTab.click();w.document.querySelector('[data-payroll-action="salary"][data-payroll-id="qa"]').click();
const changed=w.document.getElementById('payroll-amount-form');changed.elements.entry_currency.value='EUR';changed.elements.entry_currency.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(changed.elements.mwk_per_unit.value,'');assert.equal(changed.elements.paye.value,'');changed.elements.mwk_per_unit.value='2200';changed.elements.mwk_per_unit.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(changed.elements.taxable_income.value,'2,310,000.00');
// Generate real quotations/invoices and verify rendered PDF text for every code.
vm.runInThisContext(src('document-pdf.js'));const PDFLib=require('../dist/vendor/pdf-lib.min.js'),out=fs.mkdtempSync(path.join(os.tmpdir(),'cage-currency-pdf-'));
try{for(const currency of C.codes){for(const type of ['quote','invoice']){const bytes=await globalThis.CagePDF.createDocumentPDF(PDFLib,{id:'qa',number:'QA-1',client:'QA client',description:'Survey',issued:'2026-11-25',due:'2026-12-25',validUntil:'2026-12-25',currency,amount:2501,items:[{description:'Survey',quantity:2,unitPrice:1250.5}]},type,fs.readFileSync('dist/cage-logo-new.png'));const file=path.join(out,currency+'-'+type+'.pdf');fs.writeFileSync(file,bytes);const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});assert.ok(text.includes('Grand Total ('+currency+')'));assert.ok(text.includes('2,501.00'));}}}finally{fs.rmSync(out,{recursive:true,force:true});}
dom.window.close();console.log('PASS: four-currency document saves, decimal amounts, MWK legacy defaults, grouped dashboards/project margins, request propagation, edit retention, foreign payroll conversion and stable reopen.');
