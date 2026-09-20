import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function dispatchPaymentReminders(db:any,key:string,from:string){
 const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
 const jobs=await checked(db.rpc('claim_academy_payment_reminders'));let sent=0,retrying=0;
 for(const claim of jobs){
  const job=await checked(db.rpc('prepare_academy_payment_reminder',{reminder:claim.id}));if(!job)continue;
  let payload=job.payload;
  if(!payload){payload={from,to:[job.recipient],subject:'CAGE course payment reminder',html:`<div style="font-family:Arial,sans-serif;max-width:600px;color:#17243b"><h1 style="color:#00ADEF">Course payment reminder</h1><p>Hello ${esc(job.learner_name)},</p><p>This is a reminder about your remaining balance for <strong>${esc(job.course_name)}</strong>.</p><p><strong>Outstanding balance:</strong> ${esc(job.currency)} ${esc(Number(job.balance_amount).toLocaleString('en-GB'))}<br><strong>Agreed payment date:</strong> ${esc(job.due_on)}</p>${job.note?`<p style="white-space:pre-line">${esc(job.note)}</p>`:''}<p>If you have already paid, please upload your proof using the private return link you saved when applying, or contact CAGE so staff can verify it. This balance reflects payment proofs verified by CAGE.</p><p>Application reference: ${esc(job.application_id)}</p><p>Thank you,<br>CAGE Training Academy</p></div>`};
   await checked(db.from('academy_payment_reminders').update({payload}).eq('id',job.id).eq('status','processing'));}
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cage-payment-reminder-'+job.id},body:JSON.stringify(payload)});
   if(!response.ok)throw new Error('Email provider returned '+response.status);
   const result=await response.json();if(!result.id)throw new Error('Email provider returned no confirmation');
   await checked(db.from('academy_payment_reminders').update({status:'sent',sent_at:new Date().toISOString(),provider_id:result.id,error:null}).eq('id',job.id));sent++;
  }catch(e){await checked(db.from('academy_payment_reminders').update({status:'pending',error:e instanceof Error?e.message:'Email delivery failed',available_at:new Date(Date.now()+300000).toISOString()}).eq('id',job.id).eq('status','processing'));retrying++;}
 }
 return {sent,retrying};
}
Deno.serve(async req=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const secret=Deno.env.get('ENROLLMENT_EMAIL_CRON_SECRET');
 if(!secret||req.headers.get('x-cron-secret')!==secret)return reply({error:'Unauthorized'},401);
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM');
 if(!key||!from)return reply({error:'Configure RESEND_API_KEY and EMAIL_FROM'},503);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
 try {
 const jobs=await checked(db.rpc('claim_enrollment_email'));let sent=0,retrying=0;
 for(const job of jobs){
  // Freeze the provider request before its first send; retries use identical content.
  let payload=job.payload;
  if(!payload){payload={from,to:[job.recipient],subject:'Congratulations — you are enrolled with CAGE!',html:`<div style="font-family:Arial,sans-serif;max-width:600px;color:#17243b"><h1 style="color:#00ADEF">Congratulations!</h1><p>Hello ${esc(job.learner_name)},</p><p>Your enrollment in <strong>${esc(job.course_name)}</strong> with CAGE Training Academy is confirmed. We are delighted to welcome you!</p><p><strong>Start date:</strong> ${esc(job.start_date||'To be confirmed')}<br><strong>Venue:</strong> ${esc(job.venue||'To be confirmed')}</p><p>Our training team will share any remaining preparation and joining instructions. Please keep your application reference: ${esc(job.application_id)}.</p><p>We look forward to learning with you.<br>CAGE Training Academy</p></div>`};
   await checked(db.from('enrollment_email_outbox').update({payload}).eq('id',job.id));}
  try {
   const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cage-enrollment-'+job.id},body:JSON.stringify(payload)});
   if(!r.ok)throw new Error('Email provider returned '+r.status);
   const data=await r.json();if(!data.id)throw new Error('Email provider returned no confirmation');
   await checked(db.from('enrollment_email_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_id:data.id,error:null}).eq('id',job.id));sent++;
  }catch(e){await checked(db.from('enrollment_email_outbox').update({status:'pending',error:e instanceof Error?e.message:'Email delivery failed',available_at:new Date(Date.now()+300000).toISOString()}).eq('id',job.id));retrying++;}
 }
 const reminders=await dispatchPaymentReminders(db,key,from);
 return reply({sent,retrying,reminders});
 }catch{ return reply({error:'Dispatch failed. Check function logs and the enrollment email queue.'},500); }
});
