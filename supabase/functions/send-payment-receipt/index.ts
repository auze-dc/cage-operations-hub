import {createClient} from 'jsr:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import '../_shared/document-pdf.js';
import {logoBase64} from '../_shared/logo.ts';
import {cageSender} from '../_shared/cage-sender.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
 try{
 const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:auth,error:authError}=await user.auth.getUser();if(authError||!auth.user)return json({ok:false,error:'Sign in again.'},401);
 const {paymentId,recipient:raw}=await req.json();const recipient=String(raw||'').trim().toLowerCase();
 if(typeof paymentId!=='string'||!/^[0-9a-f-]{36}$/i.test(paymentId)||recipient.length>254||! /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient))return json({ok:false,error:'Choose a payment and one valid client email address.'},400);
 const result=await user.rpc('get_payment_receipt',{payment_key:paymentId});if(result.error||!result.data)return json({ok:false,error:'Receipt unavailable or access denied.'},403);
 const receipt=result.data;
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:profile}=await db.from('profiles').select('organization_id,active,role,email').eq('id',auth.user.id).single();
 if(!profile?.active||profile.role==='shared')return json({ok:false,error:'Account is inactive.'},403);
 const key=Deno.env.get('RESEND_API_KEY');if(!key)return json({ok:false,error:'Email delivery is not configured.'},503);
 const existing=await db.from('payment_receipt_sends').select('*').eq('organization_id',profile.organization_id).eq('payment_id',paymentId).eq('recipient',recipient).maybeSingle();if(existing.error)throw new Error('Install the payment receipts SQL update first.');let send=existing.data;
 if(!send){
  const bytes=await (globalThis as any).CagePDF.createDocumentPDF(PDFLib,receipt,'receipt',Uint8Array.from(atob(logoBase64),c=>c.charCodeAt(0)),new Date(receipt.createdAt));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const mail={from:cageSender(Deno.env.get('EMAIL_FROM')||'CAGE <operations@cagemw.com>'),to:[recipient],reply_to:profile.email,subject:'Payment receipt '+receipt.number+' — '+receipt.invoiceNumber,html:`<p>Dear ${esc(receipt.client)},</p><p>Thank you for your payment. Your CAGE payment receipt <strong>${esc(receipt.number)}</strong> for invoice ${esc(receipt.invoiceNumber)} is attached.</p><p>Amount received: ${esc(receipt.currency)} ${esc(Number(receipt.amount).toFixed(2))}</p><p>Remaining balance at receipt issue: ${esc(receipt.currency)} ${esc(Number(receipt.balance).toFixed(2))}</p>`,attachments:[{filename:receipt.number+'.pdf',content:btoa(binary)}]};
  const inserted=await db.from('payment_receipt_sends').insert({organization_id:profile.organization_id,payment_id:paymentId,recipient,sender_id:auth.user.id,mail_payload:mail}).select('*').single();
  if(inserted.error){if(inserted.error.code!=='23505')throw new Error('Could not register the receipt email. Retry.');const raced=await db.from('payment_receipt_sends').select('*').eq('organization_id',profile.organization_id).eq('payment_id',paymentId).eq('recipient',recipient).single();if(raced.error)throw new Error('Could not load the receipt email. Retry.');send=raced.data;}else send=inserted.data;
 }
 if(send.provider_id)return json({ok:true,alreadySent:true});
 if(Date.now()-Date.parse(send.created_at)>23*3600000)return json({ok:false,error:'This email attempt is over 23 hours old. Check email delivery history before sending again. You can still download the receipt.'},409);
 let response;try{response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cage-receipt-'+send.id},body:JSON.stringify(send.mail_payload)});}catch{return json({ok:false,error:'Email delivery could not be confirmed. Retry the same recipient.'},502);}
 const accepted=await response.json().catch(()=>({}));if(!response.ok||!accepted.id)return json({ok:false,error:'Email was not confirmed. Retry the same recipient.'},502);
 const saved=await db.from('payment_receipt_sends').update({provider_id:accepted.id,sent_at:new Date().toISOString()}).eq('id',send.id);if(saved.error)return json({ok:false,error:'Email provider accepted the receipt, but saving its status failed. Retry the same recipient.'},502);
 return json({ok:true});
 }catch(err){return json({ok:false,error:err instanceof Error?err.message:'Receipt email failed.'},400);}
});
