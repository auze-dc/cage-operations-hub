import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
function validFields(fields:any,category:string){
 if(!Array.isArray(fields)||fields.length>60)throw new Error('Invalid form fields');const ids=new Set();
 for(const f of fields){if(!/^[a-z][a-z0-9_]{0,49}$/.test(f.id)||ids.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>200||!['text','textarea','email','tel','date','number','select','checkbox'].includes(f.type))throw new Error('Invalid or duplicate application field');ids.add(f.id);if(f.type==='select'&&(!Array.isArray(f.options)||!f.options.length||f.options.length>50||f.options.some((o:any)=>typeof o!=='string'||o.length>200)))throw new Error('A choice field needs valid options');}
 for(const id of ['full_name','email','phone',...(category==='STEM'?['guardian_name','guardian_phone','guardian_consent']:[])])if(!fields.some((f:any)=>f.id===id&&f.required))throw new Error('Required contact fields are missing');
}
function validateAnswers(fields:any[],answers:any,category:string){
 validFields(fields,category);if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new Error('Complete the application fields');let clean:any={};
 for(const f of fields){const v=answers[f.id];if(f.type==='checkbox'){clean[f.id]=v===true;if(f.required&&!clean[f.id])throw new Error('Please confirm: '+f.label);continue;}
 if(v!=null&&typeof v!=='string')throw new Error('Invalid answer: '+f.label);const text=(v||'').trim();if(text.length>5000)throw new Error('Answer too long: '+f.label);if(f.required&&!text)throw new Error('Required: '+f.label);
 if(text&&f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new Error('Enter a valid email');if(text&&f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))))throw new Error('Invalid date: '+f.label);if(text&&f.type==='number'&&!Number.isFinite(Number(text)))throw new Error('Invalid number: '+f.label);if(text&&f.type==='select'&&!f.options.includes(text))throw new Error('Choose an available option: '+f.label);clean[f.id]=text;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email||'')||!(clean.full_name||'').trim()||!(clean.phone||'').trim())throw new Error('Name, contact email and phone are required');return clean;
}
async function fileInfo(value:FormDataEntryValue|null){
 if(!(value instanceof File)||!value.size)return null;if(value.size>10485760)throw new Error('Each document must be 10 MB or smaller');const bytes=new Uint8Array(await value.arrayBuffer());let mime='',ext='';
 if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){mime='application/pdf';ext='pdf';}
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';ext='jpg';}
 else if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)){mime='image/png';ext='png';}
 else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){mime='image/webp';ext='webp';}
 else throw new Error('Upload a PDF, JPG, PNG or WebP image');
 return {bytes,mime,ext,file_name:value.name.replace(/[\x00-\x1f]/g,'').slice(0,180)||'document.'+ext,size_bytes:bytes.length};
}
async function boundedForm(req:Request){const reader=req.body?.getReader();if(!reader)throw new Error('Empty request');let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024){await reader.cancel();throw new Error('Upload exceeds 12 MB request limit');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')||''}}).formData();}
Deno.serve(async req=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':Deno.env.get('APP_URL')||'https://hub.cagemw.com','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization, x-client-info, x-application-access','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});if(req.method==='OPTIONS')return new Response(null,{headers});
 const org=Deno.env.get('ACADEMY_ORGANIZATION_ID')||Deno.env.get('STEM_ORGANIZATION_ID'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!org||!url||!key)return reply({error:'Applications are not configured yet.'},503);
 const admin=createClient(url,key,{auth:{persistSession:false}}),u=new URL(req.url),action=u.searchParams.get('action')||'catalog';let uploaded:string|null=null;
 try{
 if(req.method==='GET'&&action==='catalog'){
 const r=await admin.from('academy_intakes').select('id,category,title,description,accepting,closes_on,start_date,fee,currency,venue,fields,schedule,schedule_notes,revision').eq('organization_id',org).eq('published',true).order('start_date',{ascending:true,nullsFirst:false});if(r.error)throw new Error('Applications could not be loaded');return reply({intakes:r.data});}
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const rateKey=await sha(org+':'+ip+':'+key);
 const rate=await admin.rpc('academy_intake_rate',{rate_key:rateKey,maximum:100,seconds:3600});if(rate.error||!rate.data)return reply({error:'Too many requests. Please try again later.'},429);
 if(action==='staff-file'){
 const bearer=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!bearer)return reply({error:'Sign in required'},401);
 const auth=await admin.auth.getUser(bearer);if(auth.error||!auth.data.user)return reply({error:'Sign in required'},401);
 const staff=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+bearer}},auth:{persistSession:false}});
 const form=await boundedForm(req),id=String(form.get('file')||'');if(!UUID.test(id))throw new Error('Invalid document');const r=await staff.from('academy_application_files').select('path,file_name,organization_id').eq('id',id).eq('organization_id',org).single();if(r.error||!r.data)return reply({error:'Document access denied'},403);
 const audit=await staff.rpc('log_academy_document_access',{file_key:id});if(audit.error)throw new Error('Document access could not be logged');
 const signed=await admin.storage.from('academy-applications').createSignedUrl(r.data.path,60,{download:r.data.file_name});if(signed.error)throw new Error('Document unavailable');return reply({url:signed.data.signedUrl});}
 const token=req.headers.get('x-application-access')||'';if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Your private application access key is required.'},401);const hash=await sha(token);
 const form=await boundedForm(req);if(String(form.get('website')||''))throw new Error('Submission unavailable');
 if(action==='apply'){
 const intake=String(form.get('intake')||''),requestId=String(form.get('request_id')||'');if(!UUID.test(intake)||!UUID.test(requestId))throw new Error('Invalid application');
 const prior=await admin.from('academy_applications').select('id,access_hash').eq('organization_id',org).eq('request_id',requestId).maybeSingle();if(prior.data){if(prior.data.access_hash!==hash)return reply({error:'Submission conflict'},409);return reply({id:prior.data.id});}
 const r=await admin.from('academy_intakes').select('*').eq('id',intake).eq('organization_id',org).eq('published',true).single();if(r.error||!r.data)throw new Error('Intake unavailable');const c=r.data;
 const today=new Date(Date.now()+7200000).toISOString().slice(0,10);if(!c.accepting||(c.closes_on&&c.closes_on<today))throw new Error('This intake is closed');
 if(Number(form.get('revision'))!==c.revision)throw new Error('The form changed. Reload it before submitting.');
 let answers;try{answers=JSON.parse(String(form.get('answers')));}catch{throw new Error('Invalid application fields');}answers=validateAnswers(c.fields,answers,c.category);
 const identity=await fileInfo(form.get('identity')),identityType=String(form.get('identity_type')||'');if(!identity&&c.category!=='STEM')throw new Error('Upload a National ID, passport or license');if(identity&&!['National ID','Passport','License'].includes(identityType))throw new Error('Choose the identity document type');
 const limit=await admin.rpc('academy_intake_rate',{rate_key:'submissions:'+org,maximum:200,seconds:3600});if(limit.error||!limit.data)return reply({error:'Applications are busy. Please try again later.'},429);
 const id=crypto.randomUUID();let document=null;if(identity){uploaded=`${org}/${id}/identity/${crypto.randomUUID()}.${identity.ext}`;const up=await admin.storage.from('academy-applications').upload(uploaded,identity.bytes,{contentType:identity.mime,upsert:false});if(up.error)throw new Error('Identity upload failed. Please retry.');document={path:uploaded,file_name:identity.file_name,mime:identity.mime,size_bytes:identity.size_bytes};}
 const saved=await admin.rpc('submit_academy_application',{payload:{id,intake_id:intake,request_id:requestId,revision:c.revision,access_hash:hash,full_name:answers.full_name,email:answers.email,phone:answers.phone,answers,identity_type:identity?identityType:null},document});if(saved.error)throw new Error('Application could not be saved. Check whether this intake is still open, then retry.');
 if(saved.data!==id&&uploaded)await admin.storage.from('academy-applications').remove([uploaded]);uploaded=null;return reply({id:saved.data});
 }
 const id=String(form.get('application')||'');if(!UUID.test(id))return reply({error:'Application access denied'},403);
 const r=await admin.from('academy_applications').select('id,intake_id,status,access_hash,form_snapshot,submitted_at').eq('id',id).eq('organization_id',org).eq('access_hash',hash).maybeSingle();if(r.error||!r.data)return reply({error:'Application access denied. Check your reference and private key.'},403);
 if(action==='payment-plan'){
 const due=String(form.get('balance_due_on')||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(due))throw new Error('Choose your balance payment date');
 const saved=await admin.rpc('set_academy_balance_date',{app:id,token_hash:hash,due_on:due});if(saved.error)throw new Error(saved.error.message);return reply({ok:true});
 }
 if(action==='status'){
 const files=await admin.from('academy_application_files').select('id,kind,file_name,amount,payment_date,payment_reference,review_status,review_note,created_at').eq('application_id',id).eq('organization_id',org).order('created_at',{ascending:false});if(files.error)throw new Error('Uploads could not be loaded');
 const c=await admin.from('academy_intakes').select('payment_instructions,schedule,schedule_notes,title,venue,category').eq('id',r.data.intake_id).single();if(c.error)throw new Error('Intake details unavailable');const balance=await admin.rpc('academy_payment_summary',{app:id});if(balance.error)throw new Error('Payment details could not be loaded');return reply({balance:balance.data,id,status:r.data.status,submitted_at:r.data.submitted_at,fee:r.data.form_snapshot.fee,currency:r.data.form_snapshot.currency,intake:c.data,files:files.data});}
 if(action==='payment'){
 const file=await fileInfo(form.get('proof'));if(!file)throw new Error('Select your payment proof');const amount=Number(form.get('amount')),date=String(form.get('payment_date')||''),reference=String(form.get('payment_reference')||'').trim();if(!Number.isFinite(amount)||amount<=0||amount>999999999999||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||!reference||reference.length>200)throw new Error('Enter the payment amount, date and transaction reference');
 const uploadId=String(form.get('upload_id')||'');if(!UUID.test(uploadId))throw new Error('Invalid upload request');
 uploaded=`${org}/${id}/payment/${uploadId}.${file.ext}`;const prior=await admin.from('academy_application_files').select('id').eq('path',uploaded).maybeSingle();if(prior.data){uploaded=null;return reply({ok:true});}
 const up=await admin.storage.from('academy-applications').upload(uploaded,file.bytes,{contentType:file.mime,upsert:false});if(up.error){uploaded=null;throw new Error('Upload failed or is still processing. Retry shortly.');}
 const saved=await admin.rpc('add_academy_payment',{app:id,token_hash:hash,document:{path:uploaded,file_name:file.file_name,mime:file.mime,size_bytes:file.size_bytes,amount,payment_date:date,payment_reference:reference}});if(saved.error)throw new Error('Payment proof could not be saved. Retry or contact CAGE.');uploaded=null;return reply({ok:true});
 }
 return reply({error:'Unknown action'},400);
 }catch(e){if(uploaded)await admin.storage.from('academy-applications').remove([uploaded]);return reply({error:e instanceof Error?e.message:'Request failed'},400);}
});
