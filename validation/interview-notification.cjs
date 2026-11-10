const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {transformSync}=require('esbuild');
(async()=>{
const raw=fs.readFileSync('supabase/functions/notify-interview/index.ts','utf8').replace(/^import .*;\n/gm,'');
const code=transformSync(raw,{loader:'ts',format:'cjs'}).code;
let handler,authorized=true,accept=true,snapshotError=false,emails=[],snapshots=[];
const meeting={id:'meeting',application_id:'app',format:'Video',scheduled_start:'2026-11-10T08:00:00Z',location_or_link:'https://meet.example.test/original?a=1&b=2'};
const service={from:table=>{let update=null;const q={select:()=>q,eq:()=>q,single:async()=>({data:table==='profiles'?{role:'hr',active:true,organization_id:'org'}:table==='interviews'?meeting:table==='job_applications'?{full_name:'Fixture Applicant',email:'fixture@example.test',job_opening_id:'job'}:{title:'GIS role'}}),update:value=>{update=value;return q},then:resolve=>{snapshots.push(update);return Promise.resolve({error:snapshotError?{message:'Offline'}:null}).then(resolve)}};return q}};
const caller={auth:{getUser:async()=>({data:{user:authorized?{id:'author'}:null}})}};
vm.runInNewContext(code,{Deno:{serve:fn=>handler=fn,env:{get:key=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_ANON_KEY:'fixture-public',RESEND_API_KEY:'fixture-email'})[key]}},createClient:(_url,key)=>key==='fixture-service'?service:caller,assertStaffMfa:async()=>null,Response,fetch:async(_url,options)=>{emails.push(JSON.parse(options.body));return {ok:accept}},Date});
async function call(){return(await handler(new Request('https://fixture.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({interviewId:'meeting'})}))).json()}
let result=await call();assert.equal(result.emailSent,true);assert.equal(emails.length,1);assert.match(emails[0].html,/10:00/);assert.match(emails[0].html,/original\?a=1&amp;b=2/);assert.equal(snapshots[0].invitation_location,meeting.location_or_link);assert.equal(snapshots[0].invitation_recipient,'fixture@example.test');
accept=false;result=await call();assert.equal(result.emailSent,false);assert.equal(snapshots.length,1);
accept=true;snapshotError=true;result=await call();assert.equal(result.emailSent,true);assert.match(result.warning,/record could not be saved/);
authorized=false;const before=emails.length;await call();assert.equal(emails.length,before);
console.log('PASS invitation service fixtures: exact sent link/recipient snapshot after provider acceptance, Malawi time, rejected send does not claim success, snapshot failure is surfaced, unauthenticated requests send nothing. No external emails sent.');
})().catch(e=>{console.error(e);process.exitCode=1});
