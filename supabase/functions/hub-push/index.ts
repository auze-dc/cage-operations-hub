import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-cron-secret','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const env=(name:string)=>Deno.env.get(name)||'';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 try{
  const body=await req.json();
  if(body.action==='config'){
   const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
   const {data,error}=await db.auth.getUser(token);if(error||!data.user)return reply({error:'Sign in required'},401);
   const p=await db.from('profiles').select('active,role').eq('id',data.user.id).single();if(p.error||!p.data?.active||p.data.role==='shared')return reply({error:'Staff access required'},403);
   return reply({publicKey:env('VAPID_PUBLIC_KEY')});
  }
  if(!env('PUSH_CRON_SECRET')||req.headers.get('x-cron-secret')!==env('PUSH_CRON_SECRET'))return reply({error:'Not authorised'},401);
  if(!env('VAPID_PUBLIC_KEY')||!env('VAPID_PRIVATE_KEY')||!env('VAPID_SUBJECT'))return reply({error:'Push keys not configured'},503);
  webpush.setVapidDetails(env('VAPID_SUBJECT'),env('VAPID_PUBLIC_KEY'),env('VAPID_PRIVATE_KEY'));
  const tick=await db.rpc('hub_push_tick');if(tick.error)throw tick.error;
  const claimed=await db.rpc('hub_push_claim');if(claimed.error)throw claimed.error;
  async function send(q:any){
   const finish=async(status:string,error:string|null=null,delay=0)=>{const r=await db.from('hub_push_queue').update({status,error,available_at:new Date(Date.now()+delay).toISOString()}).eq('id',q.id);if(r.error)throw r.error;};
   try{
    const [nr,dr]=await Promise.all([db.from('personal_notifications').select('*').eq('id',q.notice_id).single(),db.from('hub_push_devices').select('*').eq('id',q.device_id).single()]);
    if(nr.error||dr.error)throw Error('Could not load notification');const n=nr.data,d=dr.data;
    if(n.read_at||n.user_id!==d.user_id||Date.now()-Date.parse(n.created_at)>86400000){await finish('skipped');return;}
    const [pr,or,ar,mr]=await Promise.all([db.from('profiles').select('id,active,role').eq('id',n.user_id).single(),db.from('hub_push_options').select('*').eq('user_id',n.user_id).single(),db.from('app_notification_preferences').select('*').eq('user_id',n.user_id).maybeSingle(),db.from('module_access').select('access').eq('user_id',n.user_id).eq('module',n.target_view).maybeSingle()]);
    if(pr.error||or.error||ar.error||mr.error)throw Error('Could not check recipient settings');
    const allowed=await db.rpc('hub_push_allowed',{notice_key:n.id});if(allowed.error)throw allowed.error;if(!allowed.data){await finish('skipped');return;}
    const p=pr.data,o=or.data,a=ar.data||{};
    const category=n.event_key?.startsWith('mention:')?'mentions':({chat:'chat',tasks:'tasks',mywork:'reminders',approvals:'approvals'} as Record<string,string>)[n.target_view]||'other';
    if(!p?.active||p.role==='shared'||!o?.push_enabled||mr.data?.access==='none'||a[category]===false||n.target_view==='chat'&&a.muted_threads?.includes(n.target_id)){await finish('skipped');return;}
    if(o.quiet_start&&o.quiet_end){const clock=new Intl.DateTimeFormat('en-GB',{timeZone:o.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());const start=o.quiet_start.slice(0,5),end=o.quiet_end.slice(0,5);if(start<end?clock>=start&&clock<end:clock>=start||clock<end){await finish('skipped');return;}}
    // Only known browser push-service hosts are permitted. Never request arbitrary subscriber URLs.
    const url=new URL(d.endpoint);if(url.protocol!=='https:'||url.port||url.username||url.password||!(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/).test(url.hostname)){await finish('failed','Unsupported push endpoint');return;}
    const titles:Record<string,string>={chat:'New chat message',mentions:'You were mentioned',tasks:'Task update',reminders:'Reminder',approvals:'Approval update',other:'Work update'};
    await webpush.sendNotification(d.subscription,JSON.stringify({id:n.id,user:n.user_id,title:titles[category]}),{TTL:3600,timeout:8000,urgency:'normal'});
    await finish('sent');
   }catch(e:any){if([404,410].includes(e.statusCode)){await db.from('hub_push_devices').delete().eq('id',q.device_id);return;}await finish(q.attempts>=5?'failed':'pending','Delivery failed'+(e.statusCode?' ('+e.statusCode+')':''),Math.min(3600000,60000*2**q.attempts));}
  }
  for(let i=0;i<claimed.data.length;i+=5)await Promise.all(claimed.data.slice(i,i+5).map(send));
  // Bounded retention. Notification history itself is untouched.
  await db.from('hub_push_queue').delete().in('status',['sent','skipped','failed']).lt('created_at',new Date(Date.now()-7*86400000).toISOString());
  return reply({processed:claimed.data.length});
 }catch{return reply({error:'Push delivery could not complete. Check function logs and database setup.'},500);}
});
