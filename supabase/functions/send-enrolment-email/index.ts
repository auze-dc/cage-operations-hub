import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
Deno.serve(async req=>{
  const origin=Deno.env.get('APP_URL')||'https://hub.cagemw.com';
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:auth,error:authError}=await caller.auth.getUser();
  if(authError||!auth.user)return reply({ok:false,error:'Sign in required'},401);
  const {data:profile}=await caller.from('profiles').select('organization_id,role,active').eq('id',auth.user.id).single();
  if(!profile?.active||!['admin','manager'].includes(profile.role))return reply({ok:false,error:'Manager or administrator access required'},403);
  const payload=await req.json().catch(()=>({}));
  const applicationId=String(payload.applicationId||'');
  if(!/^[0-9a-f-]{36}$/i.test(applicationId))return reply({ok:false,error:'Invalid application'},400);
  const app=await admin.from('academy_applications').select('id,organization_id,learner_id,cohort_id,full_name,email,status,form_snapshot').eq('id',applicationId).eq('organization_id',profile.organization_id).single();
  if(app.error||!app.data||app.data.status!=='Enrolled'||!app.data.learner_id)return reply({ok:false,error:'The applicant must be enrolled first'},409);
  const email=String(app.data.email||'').trim();
  if(!email)return reply({ok:false,error:'The enrolled applicant has no email address'},400);
  const existing=await admin.from('academy_enrolment_deliveries').select('*').eq('organization_id',profile.organization_id).eq('application_id',applicationId).maybeSingle();
  if(existing.data?.status==='sent')return reply({ok:true,alreadySent:true});
  const learner=await admin.from('learners').select('full_name').eq('id',app.data.learner_id).single();
  const cohort=await admin.from('training_cohorts').select('name,start_date,end_date,venue,course_id').eq('id',app.data.cohort_id).single();
  const course=cohort.data?.course_id?await admin.from('training_courses').select('name,category').eq('id',cohort.data.course_id).single():{data:null};
  const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM')||'CAGE Training Academy <operations@cagemw.com>';
  if(!key)return reply({ok:false,error:'Email sending is not configured'},503);
  const row={organization_id:profile.organization_id,application_id:applicationId,learner_id:app.data.learner_id,recipient:email,status:'processing',attempts:(existing.data?.attempts||0)+1,error_message:null,updated_at:new Date().toISOString()};
  const up=await admin.from('academy_enrolment_deliveries').upsert(row,{onConflict:'organization_id,application_id'}).select().single();
  if(up.error)return reply({ok:false,error:'Could not prepare the enrolment email'},500);
  const first=String(learner.data?.full_name||app.data.full_name||'Learner').trim().split(/\s+/)[0];
  const programme=course.data?.name||app.data.form_snapshot?.title||'CAGE Training programme';
  const dates=cohort.data?.start_date?`${esc(cohort.data.start_date)}${cohort.data.end_date&&cohort.data.end_date!==cohort.data.start_date?' to '+esc(cohort.data.end_date):''}`:'Dates will be confirmed by the training team';
  const subject=`Congratulations — you are enrolled in ${programme}`;
  const html=`<div style="font-family:Arial,sans-serif;color:#223346;line-height:1.6;max-width:680px;margin:auto"><div style="border-top:6px solid #00ADEF;padding-top:24px"><h1 style="font-size:26px;margin:0 0 16px;color:#12324a">Congratulations, ${esc(first)}!</h1><p>Your application has been successfully enrolled in <strong>${esc(programme)}</strong> with the CAGE Training Academy.</p><div style="background:#f1f9fd;border:1px solid #ccecf8;border-radius:10px;padding:16px;margin:22px 0"><p style="margin:0 0 8px"><strong>Cohort:</strong> ${esc(cohort.data?.name||'Assigned cohort')}</p><p style="margin:0 0 8px"><strong>Training dates:</strong> ${dates}</p><p style="margin:0"><strong>Venue:</strong> ${esc(cohort.data?.venue||'To be confirmed')}</p></div><p>Please keep an eye on your email for timetable updates, learning materials and any preparation instructions from the CAGE team.</p><p>We look forward to welcoming you.</p><p style="margin-top:28px">CAGE Training Academy<br><span style="color:#00ADEF">Learn. Practise. Progress.</span></p></div></div>`;
  try{
    const res=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`academy-enrolment-${applicationId}`},body:JSON.stringify({from,to:[email],subject,html})});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(body.message||`Email provider returned ${res.status}`);
    await admin.from('academy_enrolment_deliveries').update({status:'sent',provider_id:body.id||null,error_message:null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',up.data.id);
    return reply({ok:true,sent:true});
  }catch(error){
    const message=error instanceof Error?error.message:'Email failed';
    await admin.from('academy_enrolment_deliveries').update({status:'failed',error_message:message.slice(0,1000),updated_at:new Date().toISOString()}).eq('id',up.data.id);
    return reply({ok:false,error:'The learner was enrolled, but the congratulatory email could not be sent. You can retry from the application record.',detail:message},502);
  }
});
