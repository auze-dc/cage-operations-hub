// Pure routing and content rules: no delivery or credentials in this module.
export const defaults={delivery:'immediate',daily_digest:true,reminder_email:false,time_zone:'Africa/Blantyre',workdays:[1,2,3,4,5]};
export const member=(p:any)=>p.email.split('@')[0]==='bonfancio'?'bonifancio':p.email.split('@')[0];
export const owns=(p:any,id:any)=>[p.id,member(p)].includes(id);
export function local(now:Date,zone:string){const a=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(x=>[x.type,x.value]));return {date:`${a.year}-${a.month}-${a.day}`,hour:Number(a.hour),day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(a.weekday)};}
export function shift(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function previousWorkday(date:string,days:number[]){let d=date;for(let i=0;i<7;i++){d=shift(d,-1);if(days.includes(new Date(d+'T12:00:00Z').getUTCDay()))return d;}return d;}
export function access(p:any,module:string,rules:any[]){if(p.role==='admin')return true;const explicit=rules.find(r=>r.user_id===p.id&&r.module===module)?.access;if(explicit)return explicit!=='none';if(module==='approvals')return p.role==='manager';return !['admin','settings'].includes(module);}
export function eligible(item:any,kind:string,c:any){const {p,s,notices,reminders,route,rules,now}=c;if(!p.active||!access(p,item.view,rules))return false;
 const arr=(key:string)=>(s[key]||[]);const task=arr('tasks').find((t:any)=>t.id===(item.task||item.target));
 if(kind==='assignment'||kind==='task')return task&&owns(p,task.owner)&&!['Done','Completed','Cancelled'].includes(task.status);
 if(kind==='mention'){const n=notices.find((n:any)=>n.id===item.notice);return n&&!n.read_at&&arr('messages').some((m:any)=>n.event_key===`mention:${m.id}:${p.id}`&&(m.mentions||[]).some((id:string)=>owns(p,id)));}
 if(kind==='reminder'){const r=reminders.find((r:any)=>r.id===item.target);return r&&!r.completed_at&&(!item.dueAt||Date.parse(r.due_at)===Date.parse(item.dueAt));}
 if(kind==='approval')return ['admin','manager'].includes(p.role)&&(!route.approval_users?.length||route.approval_users.includes(p.id))&&arr('approvals').some((a:any)=>a.id===item.target&&a.status==='Pending');
 if(kind==='blocker')return task&&task.status==='Blocked'&&task.needsLeadHelp&&arr('projects').some((a:any)=>a.id===task.project&&owns(p,a.lead||a.owner));
 if(kind==='equipment'){const a=arr('assets').find((a:any)=>a.id===item.target);return a&&owns(p,a.custodian)&&a[item.field]===item.due&&!(item.field==='returnDate'&&a.status!=='Assigned');}
 if(kind==='opportunity')return route.opportunity_users?.includes(p.id)&&arr('opportunityMatches').some((o:any)=>o.id===item.target&&Number(o.match||o.score)>=80&&(!o.deadline||o.deadline==='Rolling'||Date.parse(o.deadline)>now.getTime()+172800000));
 if(kind==='decision'){const key=item.source||(item.view==='leave'?'leaveRequests':item.view);return arr(key).some((r:any)=>r.id===(item.sourceId||item.target)&&owns(p,r.requester||r.submittedBy||r.person||r.owner));}
 return kind==='delivery_failure';
}
export function summary(c:any){const {p,s,pref,plans,now}=c;const day=local(now,pref.time_zone).date;const items:any[]=[];
 for(const t of s.tasks||[]){if(!owns(p,t.owner)||['Done','Completed','Cancelled'].includes(t.status))continue;const plan=plans.find((x:any)=>x.task_id===t.id&&x.user_id===p.id&&x.bucket==='day'&&x.plan_date===day);let body='';if(t.due&&t.due<day)body='A fresh start today: choose one small next step, reschedule, or ask your project lead for help.';else if(t.due===day)body='Due today.';else if(t.due&&previousWorkday(t.due,pref.workdays)===day)body=`Due ${t.due}: one working day to prepare.`;if(plan)body=`Planned today${plan.start_at?' at '+new Date(plan.start_at).toLocaleTimeString('en-GB',{timeZone:pref.time_zone,hour:'2-digit',minute:'2-digit'}):''}. ${body}`;if(body)items.push({kind:'task',title:t.title,body,view:'tasks',target:t.id});}
 for(const a of s.approvals||[])if(a.status==='Pending')items.push({kind:'approval',title:a.title||a.type,body:'Your review is needed. Open the record to approve or return it with guidance.',view:'approvals',target:a.id});
 for(const a of s.assets||[])if(owns(p,a.custodian))for(const field of ['returnDate','nextService'])if(a[field]&&a[field]<=shift(day,1))items.push({kind:'equipment',title:a.name,body:`${field==='returnDate'?'Return':'Service'} ${a[field]<day?'overdue since':'due'} ${a[field]}. Please arrange the next step.`,view:'assets',target:a.id,field,due:a[field]});

 return items.filter(i=>eligible(i,i.kind,c));
}
// Resolve mention copy only from the recipient's already scoped workspace.
export function mentionContent(item:any,c:any,profiles:any[]=[]){
 if(item.kind!=='mention')return item;
 const notice=c.notices.find((n:any)=>n.id===item.notice);
 const message=(c.s.messages||[]).find((m:any)=>notice?.event_key===`mention:${m.id}:${c.p.id}`);
 if(!message)return {...item,title:'You were mentioned',body:'A colleague mentioned you in a conversation.',actionLabel:'Open conversation'};
 const sender=profiles.find((p:any)=>p.organization_id===c.p.organization_id&&owns(p,message.sender));
 const teamMember=(c.s.team||[]).find((p:any)=>p.id===message.sender);
 const senderName=sender?.full_name||teamMember?.name||'A colleague';
 const thread=item.target;
 let conversation='';
 if(thread==='team:general-enquiries')conversation='General Enquiries';
 else {
 const request=(c.s.requests||[]).find((r:any)=>r.id===thread);
 if(request)conversation=request.title;
 else for(const [prefix,key,field] of [['project:','projects','name'],['deal:','deals','name'],['commercial:','commercialRecords','title']]){
 if(typeof thread==='string'&&thread.startsWith(prefix))conversation=(c.s[key]||[]).find((r:any)=>r.id===thread.slice(prefix.length))?.[field]||'';
 }
 }
 return {...item,title:`${senderName} mentioned you${conversation?' in '+conversation:''}`,body:'',messageExcerpt:String(message.text||'').slice(0,600)||'Open the conversation to view the message.',actionLabel:'Open conversation'};
}
export const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function email(name:string,items:any[],base:string,digest:boolean){const first=name?.trim().split(/\s+/)[0]||'there';const link=(i:any)=>{const u=new URL(base);u.searchParams.set('view',i.view);u.searchParams.set('record',i.target||'');return esc(u.href);};return `<html><body style="font-family:Arial,sans-serif;color:#181B34;margin:0"><div style="max-width:640px;margin:auto;border:1px solid #E6E9EF"><div style="background:#181B34;color:white;padding:20px"><b>CAGE</b> · ${digest?'Your day at CAGE':'Work update'}</div><div style="padding:24px"><p>Hello ${esc(first)},</p><p>${digest?'Here is what needs your attention today.':'You have an update on your work.'}</p>${items.map(i=>`<div style="padding:16px 0;border-bottom:1px solid #E6E9EF"><b>${esc(i.title)}</b>${i.messageExcerpt!==undefined?`<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #00ADEF;background:#F5FAFC;white-space:pre-wrap">${esc(i.messageExcerpt)}</blockquote>`:`<p>${esc(i.body)}</p>`}<a style="color:#007EAF" href="${link(i)}">${esc(i.actionLabel||'Open in CAGE')} →</a></div>`).join('')}<p>You can adjust routine emails in <a href="${link({view:'notifications'})}">Notification preferences</a>.</p></div></div></body></html>`;}
