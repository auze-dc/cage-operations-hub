import { cageSender } from "../_shared/cage-sender.js";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import "../_shared/document-pdf.js";
import { logoBase64 } from "../_shared/logo.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const esc = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = (amount: unknown) => new Intl.NumberFormat("en-MW", {
  style: "currency", currency: "MWK", maximumFractionDigits: 0,
}).format(Number(amount) || 0);

import { recipients, content, canonical, sha256, expiry } from "../_shared/document-recipients.js";
Deno.serve(async req => {
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
 try {
 const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:auth,error:authError}=await userClient.auth.getUser();
 if(authError||!auth.user)return json({ok:false,error:'Sign in again.'},401);
 const {data:profile}=await db.from('profiles').select('organization_id,active,email,role').eq('id',auth.user.id).single();
 if(!profile?.active||profile.role==='shared')return json({ok:false,error:'Account is inactive.'},403);
 const payload=await req.json();const {type,subject,message}=payload;
 if(!['quote','invoice'].includes(type)||typeof subject!=='string'||!subject.trim()||subject.length>200||typeof message!=='string'||message.length>10000)return json({ok:false,error:'Check document type, subject and message.'},400);
 const access=await userClient.rpc('module_level',{m:'finance'});
 const visible=await userClient.rpc('can_work_record',{k:type==='quote'?'quotes':'invoices',rid:payload.record?.id||''});
 if(access.error||(type==='invoice'?!['view','edit'].includes(access.data):access.data!=='edit')||visible.error||!visible.data)return json({ok:false,error:'Access to this document is required (Finance edit access for quotes).'},403);
 const w=await db.from('workspace_states').select('data').eq('organization_id',profile.organization_id).single();
 const record=w.data?.data?.[type==='quote'?'quotes':'invoices']?.find((r:any)=>r.id===payload.record?.id);
 if(!record||!record.number)return json({ok:false,error:'Document not found.'},404);
 if(type==='invoice'&&['Cancelled','Voided'].includes(record.status))return json({ok:false,error:'This invoice is no longer open for sending.'},409);
 if(type==='quote'&&!['Approved','Sent','Accepted'].includes(record.status))return json({ok:false,error:'Quotation must be approved before sending.'},409);
 const people=recipients({...payload,record});
 const attemptId=payload.deliveryAttempt;
 if(typeof attemptId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId))return json({ok:false,error:'Refresh the Hub before sending.'},400);
 const hash=await sha256(canonical([type,content(record),people,subject,message]));
 const previous=await db.from('document_sends_v2').select('*').eq('id',attemptId).maybeSingle();
 if(previous.error)return json({ok:false,error:'Install the document responses SQL update first.'},503);
 let frozen=previous.data;
 if(frozen&&(frozen.organization_id!==profile.organization_id||frozen.sender_id!==auth.user.id||frozen.request_hash!==hash))return json({ok:false,error:'Document or recipients changed. Reopen the send form.'},409);
 const resendKey=Deno.env.get('RESEND_API_KEY');
 if(!resendKey)return json({ok:false,error:'Email delivery is not configured.'},503);
 const from=cageSender(Deno.env.get('EMAIL_FROM')||'CAGE <operations@cagemw.com>');
 if(!frozen){
  const sendingAt=new Date();
  const stampDate=(globalThis as any).CagePDF.stampDateAt(sendingAt);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes=await (globalThis as any).CagePDF.createDocumentPDF(PDFLib,record,type,Uint8Array.from(atob(logoBase64),c=>c.charCodeAt(0)),sendingAt);
  } catch(error) { return json({ok:false,error:"The PDF could not be generated: "+String(error)},400); }
  let binary=""; for(const byte of pdfBytes) binary+=String.fromCharCode(byte);
  const filename=String(record.number).replace(/[^a-zA-Z0-9_-]/g,"-")+".pdf";
  const title = type === "quote" ? "Quotation" : "Invoice";
  const html = `<!doctype html><html><body style="margin:0;background:#f2f6f8;font-family:Arial,sans-serif;color:#102b3a">
    <div style="max-width:680px;margin:32px auto;background:white;border-radius:14px;overflow:hidden;border:1px solid #dce8ee">
      <div style="background:#071724;padding:24px 30px;color:white"><strong style="font-size:22px">CAGE</strong><span style="float:right;color:#6dd7ff">${esc(title)}</span></div>
      <div style="padding:30px"><p style="white-space:pre-line;line-height:1.6">${esc(message)}</p>
        <div style="margin:24px 0;padding:22px;background:#f4f9fb;border-left:4px solid #00adef">
          <div style="font-size:13px;color:#647985">${esc(title)} number</div><strong style="font-size:21px">${esc(record.number)}</strong>
          <p style="margin:16px 0 6px">${esc(record.description)}</p>
          <strong style="font-size:24px;color:#007cab">${esc(record.currency||"MWK")} ${Number(record.amount).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
          ${record.due ? `<p style="color:#647985">Due: ${esc(record.due)}</p>` : ""}
          ${record.validUntil ? `<p style="color:#647985">Valid until: ${esc(record.validUntil)}</p>` : ""}
        </div>
        <p style="font-size:13px;color:#71818b">Sent by CAGE.</p>
      </div>
    </div></body></html>`;


 const mail:any={from,to:people.to,subject,html,reply_to:profile.email,attachments:[{filename,content:btoa(binary)}]};
 if(people.cc.length)mail.cc=people.cc;if(people.bcc.length)mail.bcc=people.bcc;
 let tokenHash=null,expiresAt=null,invitation=null;
 if(people.approver){
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  tokenHash=await sha256(token);expiresAt=expiry(record);
  const link='https://hub.cagemw.com/quote-response.html#'+token;
  invitation={from,to:[people.approver],reply_to:profile.email,subject:'Your response requested: '+record.number,
   html:`<p>CAGE has sent you quotation <strong>${esc(record.number)}</strong>.</p><p>Please review the quote and respond using your private link:</p><p><a href="${esc(link)}">Review quotation and respond</a></p><p>You can accept, request changes or decline. Opening this link does not accept the quote.</p><p>This link is for ${esc(people.approver)} only. Do not forward it. It expires ${esc(expiresAt)} (UTC).</p>`};
 }
 const registered=await db.rpc('register_document_send_v2',{entry:{id:attemptId,organization_id:profile.organization_id,sender_id:auth.user.id,document_type:type,document_id:record.id,request_hash:hash,snapshot:record,recipients:{to:people.to,cc:people.cc,bcc:people.bcc},approver:people.approver,token_hash:tokenHash,expires_at:expiresAt,mail_payload:mail,invitation_payload:invitation}});
 if(registered.error)return json({ok:false,error:registered.error.message},409);
 frozen=registered.data;
 }
 async function completed(){
  if(type==='invoice'){
   const saved=await db.rpc('complete_staff_invoice_send',{attempt:attemptId});
   if(saved.error)return json({ok:false,error:'Email provider accepted the invoice, but recording its status failed. Retry this unchanged form.'},502);
  }
  return json({ok:true,messageId:frozen.provider_id});
 }
 if(frozen.provider_id&&(!frozen.invitation_payload||frozen.invitation_provider_id))return await completed();
 if(Date.now()-Date.parse(frozen.created_at)>23*3600000)return json({ok:false,error:'This attempt is over 23 hours old. Check provider history before starting another send; do not retry blindly.'},409);
 for(const part of ['document','invitation']){
  const column=part==='document'?'provider_id':'invitation_provider_id';
  const body=part==='document'?frozen.mail_payload:frozen.invitation_payload;
  if(!body||frozen[column])continue;
  let response:Response;
  try{response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':'cage-v2-'+attemptId+'-'+part},body:JSON.stringify(body)});}
  catch{await db.from('document_sends_v2').update({last_error:part+' delivery could not be confirmed; retry the unchanged form.'}).eq('id',attemptId);return json({ok:false,error:'Delivery could not be confirmed. Retry this unchanged form.'},502);}
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id){await db.from('document_sends_v2').update({last_error:part+' email was not confirmed; retry the unchanged form.'}).eq('id',attemptId);return json({ok:false,error:part==='invitation'?'The document was accepted by the email provider, but the response invitation was not confirmed. Retry this unchanged form.':'Email was not confirmed. Retry this unchanged form.'},502);}
  const saved=await db.from('document_sends_v2').update({[column]:result.id}).eq('id',attemptId);
  if(saved.error)return json({ok:false,error:'Provider accepted the email, but its status could not be saved. Retry this unchanged form.'},502);
  frozen[column]=result.id;
 }
 return await completed();
 }catch(error){
  // Do not return provider payloads, tokens or recipient lists in diagnostic logs.
  if(error instanceof TypeError||error instanceof DOMException)return json({ok:false,error:'Delivery could not be confirmed. Retry this unchanged form; do not start a new send.'},502);
  return json({ok:false,error:error instanceof Error?error.message:'Unable to send this document.'},400);
 }
});
