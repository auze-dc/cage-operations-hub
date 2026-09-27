import {createClient} from 'jsr:@supabase/supabase-js@2';
import {SOURCES,canonical,parseFeed,parsePPDA,parseListing,feedURL,assess,safeText,plain,hash} from './core.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-cron-secret'};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);let run:string|null=null;
 try{
 const body=await req.json().catch(()=>({}));const secret=Deno.env.get('CRON_SECRET');const cron=!!secret&&req.headers.get('x-cron-secret')===secret;let org;
 if(cron){org=body.organizationId;if(!org)return reply({ok:false,error:'organizationId required'},400);}else{
 const auth=await db.auth.getUser((req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''));if(auth.error||!auth.data.user)return reply({ok:false,error:'Sign in again'},401);
 const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}}});
 const access=await user.rpc('opportunity_access',{editing:true});const p=await db.from('profiles').select('organization_id,role,active').eq('id',auth.data.user.id).single();if(access.error||!access.data||!p.data?.active||!['admin','manager'].includes(p.data.role))return reply({ok:false,error:'Commercial edit access and Manager or Administrator role required'},403);org=p.data.organization_id;
 }
 const begin=await db.rpc('opportunity_scan_begin',{org,manual:!cron});if(begin.error)throw Error(begin.error.message);run=begin.data;if(!run)return reply({ok:true,skipped:true,message:'A scan is already running, ran recently, or is not scheduled yet.'});
 const settings=await db.from('opportunity_scan_settings').select('*').eq('organization_id',org).maybeSingle();if(settings.error)throw Error(settings.error.message);
 const sources=SOURCES.filter(s=>!settings.data?.disabled_sources?.includes(s.id));
 // Search groups are discovery queries, never claimed to be complete portal coverage.
 const reports:any[]=[];const discovered=(await Promise.all(sources.map(async s=>{
 let direct:any[]=[],search:any[]=[],notes:string[]=[],directOK=false,searchOK=false;
 if(['malawi','banks','innovation','climate','un'].includes(s.id)){try{direct=parseListing(await safeText(s.url),s);directOK=true;}catch(e){notes.push('Direct listing: '+(e as Error).message);}}
 if(s.id!=='malawi'){try{search=parseFeed(await safeText(feedURL(s)));searchOK=true;}catch(e){notes.push('Search feed: '+(e as Error).message);}}
 const items=[...direct,...search];const status=!directOK&&!searchOK?'failed':notes.length?'partial':'ok';reports.push({id:s.id,name:s.name,url:s.url,status,count:items.length,method:directOK?'Direct listing'+(searchOK?' + search RSS':''):'Rotating-domain search RSS',error:notes.join(' · '),at:new Date().toISOString()});return items.map(i=>({...i,source:s}));
 }))).flat();
 const oldRows:any[]=[];for(let start=0;;start+=1000){const r=await db.from('opportunity_matches').select('*').eq('organization_id',org).order('id').range(start,start+999);if(r.error)throw Error(r.error.message);oldRows.push(...r.data);if(r.data.length<1000)break;}
 const tracks=await db.from('opportunity_tracking').select('opportunity_id,stage').eq('organization_id',org).in('stage',['Saved','Applying','Submitted']);if(tracks.error)throw Error(tracks.error.message);
 const savedIds=new Set((tracks.data||[]).map(x=>x.opportunity_id));
 // Rotate saved-page checks by oldest checked time; bounded work keeps requests within runtime limits.
 const saved=oldRows.filter(x=>savedIds.has(x.id)).sort((a,b)=>String(a.raw_data?.checkedAt||'').localeCompare(String(b.raw_data?.checkedAt||''))).slice(0,12).map(x=>({title:x.title,excerpt:x.raw_data?.summary||'',url:canonical(x.source_url),source:SOURCES.find(s=>s.domains.some(d=>{try{const h=new URL(x.source_url).hostname;return h===d||h.endsWith('.'+d);}catch{return false;}})),old:x}));
 const seen=new Set();const queue=[...saved,...discovered.sort((a,b)=>(assess(b,'',b.source)?.score||0)-(assess(a,'',a.source)?.score||0))].filter(x=>{if(!x.url||seen.has(x.url)||(!('old'in x)&&!assess(x,'',x.source)))return false;seen.add(x.url);return true;}).slice(0,24);
 let added=0,updated=0,checked=0,errors=0;const startAt=Date.now();
 for(let start=0;start<queue.length;start+=4){if(Date.now()-startAt>95000)break;await Promise.all(queue.slice(start,start+4).map(async item=>{
 const previous=oldRows.find(x=>canonical(x.source_url)===item.url);item.source=SOURCES.find(s=>s.domains.some(d=>{const h=new URL(item.url).hostname;return h===d||h.endsWith('.'+d);}));let page='',pageError='';try{page=plain(await safeText(item.url)).slice(0,24000);if(/captcha|access denied|verify you are human/i.test(page.slice(0,1200)))throw Error('Source requires manual access');}catch(e){page='';pageError=(e as Error).message;}
 checked++;const fingerprint=await hash(page||item.excerpt||'');const unchanged=previous?.raw_data?.fingerprint===fingerprint;
 let data=unchanged?previous.raw_data:assess(item,page,item.source);if(!data&&previous)data={...previous.raw_data,reviewFlag:'Page changed; review the notice manually.'};if(!data)return;
 const old=previous?.raw_data||{};const changed=!!previous&&!unchanged&&!!page;
 const changes=changed?[{at:new Date().toISOString(),note:data.deadline!==previous.deadline?'Detected deadline text changed; verify against the notice.':'Source text changed; review requirements, cancellation or outcome notices.'},...(old.changes||[])].slice(0,12):(old.changes||[]);
 // A failed recheck never erases previously collected evidence or dates.
 if(previous&&!page)data={...old,pageError};
 const row={organization_id:org,external_key:previous?.external_key||await hash(item.url),title:previous?.title||item.title,organization:data.organisation&&data.organisation!=='Not stated'?data.organisation:previous?.organization||'Not stated',opportunity_type:data.type||previous?.opportunity_type||'Grant',source_name:new URL(item.url).hostname,source_url:item.url,deadline:previous&&!page?previous.deadline:data.deadline||null,status:previous?.status||'New',match_score:data.score||previous?.match_score||50,match_reason:data.reason||previous?.match_reason||'Review required',updated_at:new Date().toISOString(),raw_data:{...data,fingerprint:previous&&!page?old.fingerprint:fingerprint,checkedAt:new Date().toISOString(),pageError,changes,sourceGroup:item.source?.name||'Saved source',sourceLinks:[...new Set([...(old.sourceLinks||[]),item.url])],summaryMethod:'Source excerpt + rule-based relevance; no AI eligibility decision'}};
 const save=await db.from('opportunity_matches').upsert(row,{onConflict:'organization_id,external_key'});if(save.error){errors++;return;}if(previous){if(changed)updated++;}else added++;
 }));}
 const failed=reports.filter(x=>x.status==='failed').length;const status=errors?'partial':!sources.length?'paused':failed===sources.length?'failed':reports.some(x=>x.status!=='ok')?'partial':'completed';
 const error=errors?`${errors} results could not be saved.`:status==='failed'?'All discovery feeds failed. Existing results retained.':null;
 const finish=await db.from('opportunity_scan_runs').update({finished_at:new Date().toISOString(),status,sources:reports,added,updated,checked,error}).eq('id',run);if(finish.error)throw Error('Could not save scan status');
 return reply({ok:status!=='failed',status,added,updated,checked,sources:reports,error,message:`${added} new; ${updated} changed; ${checked} pages checked.`},status==='failed'?502:200);
 }catch(e){if(run)await db.from('opportunity_scan_runs').update({status:'failed',finished_at:new Date().toISOString(),error:(e as Error).message}).eq('id',run);return reply({ok:false,error:(e as Error).message},500);}
});
