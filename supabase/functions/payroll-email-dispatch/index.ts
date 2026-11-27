import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import nodemailer from 'npm:nodemailer@10.6.1';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { logoBase64 } from '../_shared/logo.ts';
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { payrollMonth, renderPayrollPDF } from '../_shared/payroll-email-pdf.mjs';

const address = 'accounting@cagemw.com';
const testRecipient = 'alexander@cagemw.com';
const reply = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const equalSecret = (provided:string, expected:string) => {
  const a=Buffer.from(provided), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
};
const logo = () => Uint8Array.from(atob(logoBase64), c=>c.charCodeAt(0));

Deno.serve(async req => {
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const secret=Deno.env.get('PAYROLL_EMAIL_CRON_SECRET')||'';
  if(secret.length<32||!equalSecret(req.headers.get('x-payroll-email-secret')||'',secret))
    return reply({error:'Unauthorized'},401);
  const body=await req.json().catch(()=>null);
  if(!body||Object.keys(body).length!==1||!['dispatch','test'].includes(body.mode))
    return reply({error:'Invalid dispatch request'},400);
  const host=Deno.env.get('PAYROLL_SMTP_HOST')||'', password=Deno.env.get('PAYROLL_SMTP_PASSWORD');
  const org=Deno.env.get('PAYROLL_EMAIL_ORG_ID')||'';
  if(!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(host)||!password||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(org))
    return reply({error:'Accounting SMTP is not configured'},503);

  // Implicit TLS with certificate validation; the envelope and From match the authenticated mailbox.
  const smtp=nodemailer.createTransport({
    host, port:465, secure:true, auth:{user:address,pass:password},
    tls:{minVersion:'TLSv1.2',servername:host,rejectUnauthorized:true},
    connectionTimeout:9000,greetingTimeout:7000,socketTimeout:12000,
    disableFileAccess:true,disableUrlAccess:true,
  });
  const send=(to:string, subject:string, text:string, pdf:Uint8Array, id:string, filename:string) =>
    smtp.sendMail({
      from:{name:'CAGE Finance',address},to:[{name:'',address:to}],envelope:{from:address,to:[to]},
      messageId:`<${id}@cagemw.com>`,subject,text,
      attachments:[{filename,content:Buffer.from(pdf),contentType:'application/pdf'}],
    });

  if(body.mode==='test'){
    if(Deno.env.get('PAYROLL_EMAIL_TEST_ENABLED')!=='true')return reply({error:'Test mode is off'},403);
    if(Deno.env.get('PAYROLL_EMAIL_LIVE')==='true')return reply({error:'Test is available only before live delivery'},409);
    // One hard-coded recipient, synthetic figures, no production payroll or queue access.
    const sample={id:'synthetic-payroll-render-test',period:'2026-12-01',employee_name:'Sample Employee',
      employee_number:'TEST-0000',job_title:'Test only',department:'Test only',gross:1000,deductions:50,net:950,paid:950,
      paid_on:'2026-12-23',released_at:'2026-12-23T08:00:00Z',
      amounts:{basic:1000,allowances:0,overtime:0,bonus:0,paye:0,pension:50,advance:0,other_deductions:0,employer_pension:100}};
    try{
      const pdf=await renderPayrollPDF(PDFLib,sample,logo(),fontkit);
      const res=await send(testRecipient,'TEST ONLY | CAGE Finance payslip delivery',
        'This is a delivery test with a fictional payslip. It is not an employee record.',
        pdf,'payroll-test-'+crypto.randomUUID(),'TEST-ONLY-CAGE-payslip.pdf');
      if(res.accepted.length!==1)return reply({error:'SMTP acceptance was not confirmed. Check the mailbox before retrying.'},502);
      return reply({accepted:true});
    }catch{
      return reply({error:'Test delivery was not confirmed. Check the mailbox before retrying.'},502);
    }finally{smtp.close();}
  }
  if(Deno.env.get('PAYROLL_EMAIL_LIVE')!=='true')return reply({paused:true});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})},auth:{persistSession:false}});
  try{
    const claim=await db.rpc('claim_payroll_email',{org});
    if(claim.error)return reply({error:'Payroll email claim failed'},500);
    const job=claim.data;
    if(!job||job.skipped)return reply({processed:0});
    const {slip,recipient,claimed_at}=job;
    async function complete(status:string,reason:string|null=null){
      const result=await db.from('payroll_email_deliveries').update({
        status,reason,sent_at:status==='sent'?new Date().toISOString():null,
      }).eq('item_id',slip.id).eq('organization_id',org).eq('status','sending').eq('claimed_at',claimed_at)
        .select('item_id').maybeSingle();
      if(result.error||!result.data)throw new Error('Delivery state not recorded');
    }
    let pdf:Uint8Array;
    try{pdf=await renderPayrollPDF(PDFLib,slip,logo(),fontkit);}
    catch{await complete('failed','Payslip PDF could not be generated. No email sent.');return reply({processed:1,failed:1});}

    let accepted=false;
    let rejected=false;
    try{
      const result=await send(recipient,'Official CAGE payslip | '+payrollMonth(slip.period),
        'Your official CAGE payslip is attached. It is also available under My payslips in the CAGE Operations Hub.\n\nCAGE Finance',
        pdf,'payroll-'+slip.id,'CAGE-payslip-'+slip.period.slice(0,7)+'.pdf');
      accepted=result.accepted.length===1 && result.rejected.length===0;
    }catch(e){
      const smtpError=e as {responseCode?:number};
      // A final negative SMTP reply is definite; timeouts/disconnects may follow acceptance.
      rejected=Number(smtpError.responseCode)>=400&&Number(smtpError.responseCode)<=599;
    }
    if(accepted) await complete('sent');
    else if(rejected) await complete('failed','The mail server rejected delivery. Check the accounting mail service.');
    else await complete('review','Delivery uncertain. Check the mail server before resending.');
    return reply({processed:1,accepted});
  }catch{return reply({error:'Payroll email status needs review'},500);}
  finally{smtp.close();}
});
