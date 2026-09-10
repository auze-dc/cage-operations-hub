import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {defaults,local,eligible,summary,email} from '../_shared/staff-email-rules.ts';
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const secret=Deno.env.get('STAFF_EMAIL_CRON_SECRET');if(!secret||req.headers.get('x-cron-secret')!==secret)return reply({error:'Unauthorized'},401);
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM'),base=Deno.env.get('APP_URL');
 if(!key||!from||!base||!base.startsWith('https://'))return reply({error:'Configure RESEND_API_KEY, EMAIL_FROM and HTTPS APP_URL'},503);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const now=new Date();
 const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
 async function all(table:string,apply:(q:any)=>any=(q)=>q){const out:any[]=[];for(let start=0;;start+=1000){const rows=await checked(apply(db.from(table).select('*')).range(start,start+999));out.push(...rows);if(rows.length<1000)return out;}}
 async function context(p:any){const [preferences,workspace,rules,route,notices,reminders,plans,opportunities]=await Promise.all([
 checked(db.from('staff_email_preferences').select('*').eq('user_id',p.id).maybeSingle()),checked(db.rpc('email_scoped_workspace',{recipient:p.id})),all('module_access',q=>q.eq('user_id',p.id)),checked(db.from('staff_email_routing').select('*').eq('organization_id',p.organization_id).maybeSingle()),all('personal_notifications',q=>q.eq('user_id',p.id).is('read_at',null)),all('personal_reminders',q=>q.eq('user_id',p.id)),all('task_plans',q=>q.eq('user_id',p.id)),all('opportunity_matches',q=>q.eq('organization_id',p.organization_id).eq('status','New'))]);return {p,s:{...(workspace.data||{}),opportunityMatches:opportunities.map((o:any)=>({...o.raw_data,id:o.raw_data?.id||o.id,match:o.match_score,deadline:o.deadline||'Rolling'}))},rules,route:route||{},notices,reminders,plans,pref:{...defaults,...preferences},now};}
 const permitted=(kind:string,pref:any)=>kind==='delivery_failure'||(kind==='reminder'?pref.reminder_email:pref.delivery!=='inapp');
 try{
 const profiles=await all('profiles',q=>q.eq('active',true));let queued=0,sent=0,cancelled=0;
 for(const p of profiles){const c=await context(p);const events=await all('staff_email_events',q=>q.eq('user_id',p.id).eq('organization_id',p.organization_id).is('batched_at',null).lte('available_at',now.toISOString()).order('created_at'));const immediate:any[]=[],deferred:any[]=[];
 for(const e of events){if(e.kind==='opportunity'&&![1,2,3,4,5].includes(local(now,c.pref.time_zone).day))continue;e.items=e.items.map((i:any)=>({...i,kind:e.kind,notice:e.notification_id}));const items=e.items.filter((i:any)=>permitted(e.kind,c.pref)&&eligible(i,e.kind,c));if(!items.length){await checked(db.from('staff_email_events').update({batched_at:now.toISOString()}).eq('id',e.id).is('batched_at',null));continue;}e.items=items;if(e.kind==='delivery_failure'||e.kind==='reminder'||(c.pref.delivery==='immediate'&&e.kind!=='opportunity'))immediate.push(e);else deferred.push(e);}
 const enqueue=async(list:any[],extras:any[],date:string|null)=>{const items=[...list.flatMap(e=>e.items),...extras.map((i:any)=>({...i,scheduled:true}))];const unique=items.filter((i,n)=>items.findIndex(x=>x.kind===i.kind&&x.target===i.target&&x.title===i.title)===n);if(!unique.length)return;const subject=date?`Your day at CAGE — ${date}`:unique.length===1?`CAGE: ${unique[0].title}`:`CAGE: ${unique.length} work updates`;const id=await checked(db.rpc('enqueue_staff_email',{recipient_id:p.id,event_keys:list.map(e=>e.id),digest_day:date,mail_subject:subject,mail_html:email(p.full_name,unique,base,!!date),mail_context:unique}));if(id)queued++;};
 await enqueue(immediate,[],null);const clock=local(now,c.pref.time_zone);
 if(clock.hour===7&&c.pref.workdays.includes(clock.day)&&(c.pref.daily_digest||c.pref.delivery==='digest'||(c.pref.delivery==='immediate'&&deferred.some(e=>e.kind==='opportunity'))))await enqueue(deferred,c.pref.daily_digest?summary(c):[],clock.date);
 }
 const jobs=await checked(db.rpc('claim_staff_email'));
 for(const job of jobs){const p=await checked(db.from('profiles').select('*').eq('id',job.user_id).single());const c=p.active?await context(p):null;
 if(!c||job.organization_id!==p.organization_id||job.recipient!==p.email||!job.context.every((i:any)=>(i.scheduled?c.pref.daily_digest:permitted(i.kind,c.pref))&&eligible(i,i.kind,c))||(job.digest_date&&!c.pref.daily_digest&&c.pref.delivery!=='digest'&&!job.context.some((i:any)=>i.kind==='opportunity'))){
 await checked(db.from('staff_email_outbox').update({status:'cancelled',error:'Recipient preferences, access or work changed before delivery.'}).eq('id',job.id));await checked(db.from('staff_email_events').update({batched_at:null}).in('id',job.event_ids).eq('user_id',job.user_id));cancelled++;continue;
 }
 try{const res=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`staff-${job.id}`},body:JSON.stringify({from,to:[p.email],subject:job.subject,html:job.html})});const result=await res.json();if(!res.ok)throw new Error(`Provider ${res.status}: ${result.message||'Delivery failed'}`);await checked(db.from('staff_email_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_id:result.id,error:null}).eq('id',job.id));sent++;
 }catch(e){await checked(db.from('staff_email_outbox').update({status:job.attempts>=5?'failed':'pending',available_at:new Date(Date.now()+Math.min(60,2**job.attempts)*60000).toISOString(),error:String(e).slice(0,500)}).eq('id',job.id));}
 }
 await checked(db.from('staff_email_outbox').update({status:'failed',error:'Delivery window expired; review the notification centre.'}).in('status',['pending','processing']).lt('created_at',new Date(now.getTime()-23*3600000).toISOString()));
 return reply({queued,sent,cancelled});
 }catch(e){console.error('Staff email dispatch failed',String(e));return reply({error:'Dispatch failed. Check function logs.'},500);}
});
