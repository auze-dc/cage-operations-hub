import {createClient} from 'jsr:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import '../_shared/document-pdf.js';
import '../_shared/order-document.js';
import {logoBase64} from '../_shared/logo.ts';
import {cageSender} from '../_shared/cage-sender.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type'};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
 try{
 const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const auth=await user.auth.getUser();if(auth.error||!auth.data.user)return json({ok:false,error:'Sign in again.'},401);
 const p=await req.json(),recipient=String(p.recipient||'').trim().toLowerCase();
 if(!['acceptance','order'].includes(p.kind)||typeof p.qid!=='string'||!Number.isInteger(p.version)||typeof p.message!=='string'||!p.message.trim()||p.message.length>5000||recipient.length>254||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient))return json({ok:false,error:'Check the document, email address and message.'},400);
 const level=await user.rpc('module_level',{m:'finance'});if(level.error||level.data!=='edit')return json({ok:false,error:'Finance edit access required.'},403);
 const read=await user.rpc('quote_order_read',{qid:p.qid});if(read.error)return json({ok:false,error:'Quotation access required.'},403);const data=read.data;
 if(data.quoteDeleted||data.invoiceDeleted)return json({ok:false,error:'This document was deleted. The order is retained as history.'},409);
 if(data.quote.status!=='Accepted'||(data.order?.version||0)!==p.version)return json({ok:false,error:'Workflow changed. Reopen the current document before sending.'},409);
 if(p.kind==='order'&&!data.order?.mode)return json({ok:false,error:'Prepare the order document first.'},409);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const profile=await db.from('profiles').select('organization_id,email,active,role').eq('id',auth.data.user.id).single();if(profile.error||!profile.data.active||profile.data.role==='shared')return json({ok:false,error:'Account is inactive.'},403);
 const key=Deno.env.get('RESEND_API_KEY');if(!key)return json({ok:false,error:'Email delivery is not configured.'},503);
 const filter=()=>db.from('order_document_sends').select('*').eq('organization_id',profile.data.organization_id).eq('quote_id',p.qid).eq('version',p.version).eq('kind',p.kind).eq('recipient',recipient);
 const found=await filter().maybeSingle();if(found.error)throw new Error('Install the quotation workflow SQL first.');let send=found.data;
 if(!send){
  const a=data.order?.acceptance||data.quote.clientResponse;
  const agreement=a?.source==='staff'?`Acceptance recorded by ${a.recordedByName} for ${a.contact}, via ${a.method}, on ${a.date}.`:`Client acceptance recorded on ${String(a?.at||'').slice(0,10)}.`;
  const mail:any={from:cageSender(Deno.env.get('EMAIL_FROM')||'CAGE <operations@cagemw.com>'),to:[recipient],reply_to:profile.data.email,subject:(p.kind==='acceptance'?'Quotation acceptance — ':'Order document — ')+data.quote.number,html:`<p>Dear ${esc(data.quote.client)},</p><p style="white-space:pre-wrap">${esc(p.message)}</p><hr><p>${esc(data.quote.number)} · ${esc(data.quote.currency||'MWK')} ${esc(Number(data.quote.amount).toLocaleString('en-GB',{minimumFractionDigits:2}))}</p><p>${esc(agreement)}</p>`};
  if(p.kind==='order'){
   const r=(globalThis as any).CageOrderDocument.documentRecord(data);const bytes=await (globalThis as any).CagePDF.createDocumentPDF(PDFLib,r,'order',Uint8Array.from(atob(logoBase64),c=>c.charCodeAt(0)),new Date(data.order.order_data.preparedAt));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);mail.attachments=[{filename:String(r.number).replace(/[^a-zA-Z0-9_-]/g,'-')+'.pdf',content:btoa(binary)}];mail.html+=`<p><strong>${esc(r.orderTitle)}</strong><br>${esc(r.orderNotice)}</p>`;
  }
  const row={id:crypto.randomUUID(),organization_id:profile.data.organization_id,quote_id:p.qid,version:p.version,kind:p.kind,recipient,sender_id:auth.data.user.id,payload:{message:p.message,mail}};
  const insert=await db.from('order_document_sends').insert(row).select('*').single();
  if(insert.error){if(insert.error.code!=='23505')throw new Error('Could not register this email. Retry unchanged.');const existing=await filter().single();if(existing.error)throw new Error('Could not load the registered email. Retry.');send=existing.data;}else send=insert.data;
 }
 if(send.provider_id)return json({ok:true,alreadySent:true});
 if(send.payload.message!==p.message)return json({ok:false,error:'An email attempt already exists with different wording. Retry the original message; check delivery history before starting another email.'},409);
 if(Date.now()-Date.parse(send.created_at)>23*3600000)return json({ok:false,error:'This attempt is over 23 hours old. Check provider delivery history before sending again.'},409);
 // Recheck the live version just before delivery; a changed PO must be reviewed again.
 const latest=await user.rpc('quote_order_read',{qid:p.qid});if(latest.error||(latest.data.order?.version||0)!==p.version||latest.data.quote.status!=='Accepted')return json({ok:false,error:'Workflow changed before delivery. Reopen the current document.'},409);
 let response;try{response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cage-order-'+send.id},body:JSON.stringify(send.payload.mail)});}catch{return json({ok:false,error:'Email delivery could not be confirmed. Retry this unchanged form.'},502);}
 const result=await response.json().catch(()=>({}));if(!response.ok||!result.id)return json({ok:false,error:'Email was not confirmed. Retry this unchanged form.'},502);
 const saved=await db.from('order_document_sends').update({provider_id:result.id,sent_at:new Date().toISOString()}).eq('id',send.id);if(saved.error)return json({ok:false,error:'Email accepted, but saving its status failed. Retry unchanged.'},502);
 return json({ok:true});
 }catch(err){return json({ok:false,error:err instanceof Error?err.message:'Unable to send the notification.'},400);}
});
