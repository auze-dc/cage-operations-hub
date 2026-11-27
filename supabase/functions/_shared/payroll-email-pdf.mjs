import './document-pdf.js';
import {normalFont,boldFont} from './payroll-fonts.mjs';

const cash = value => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Missing or invalid payroll amount');
  return amount.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2});
};
const day = date => new Intl.DateTimeFormat('en-GB',{
  timeZone:'Africa/Blantyre',day:'numeric',month:'short',year:'numeric'
}).format(new Date(date));
export const payrollMonth = period => new Intl.DateTimeFormat('en-GB',{
  timeZone:'UTC',month:'long',year:'numeric'
}).format(new Date(period));
function slot(id) {
  let hash=2166136261;
  for(const c of String(id)) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return (hash>>>0)%12;
}

// One source of truth for financial amounts: the immutable issued database row.
export async function renderPayrollPDF(PDFLib, item, logoBytes, fontkit) {
  if(!item.released_at || Number(item.net)!==Number(item.paid)) throw new Error('Only released, fully paid payslips can be rendered');
  const {PDFDocument,rgb}=PDFLib;
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const decode=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const normal=await doc.embedFont(decode(normalFont),{subset:true}), strong=await doc.embedFont(decode(boldFont),{subset:true});
  const supported=new Set(normal.getCharacterSet());
  const logo=await doc.embedPng(logoBytes);
  const {stamp,stampFont}=await globalThis.CagePDF.roundStampAssets(PDFLib,doc);
  const navy=rgb(.09,.15,.23), blue=rgb(0,.47,.63), pale=rgb(.94,.97,.98), white=rgb(1,1,1);
  let page,y;
  function txt(value,x,baseline,size=10,font=normal,color=navy) {
    page.drawText(String(value),{x,y:baseline,size,font,color});
  }
  function right(value,x,baseline,size=10,font=normal,color=navy) {
    txt(value,x-font.widthOfTextAtSize(String(value),size),baseline,size,font,color);
  }
  function wraps(value,width,size,font=normal) {
    const source=String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().normalize('NFC');
    if([...source].some(ch=>!supported.has(ch.codePointAt(0))))throw new Error('PDF font does not cover this payroll text');
    const lines=[];
    let line='';
    for(const word of source.split(/\s+/)){
      if(line && font.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
      if(font.widthOfTextAtSize(word,size)>width){
        for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line='';}line+=ch;}
      }else line+=(line?' ':'')+word;
    }
    lines.push(line);return lines;
  }
  const period=payrollMonth(item.period);
  function addPage(continuation=false){
    page=doc.addPage([595.28,841.89]);
    page.drawImage(logo,{x:39,y:759,width:130,height:130*logo.height/logo.width});
    right('Payslip',555,785,24,strong);
    right(period+'  |  MWK',555,765,11);
    txt('ABC-ABI, Area 47/1, Lilongwe, Malawi',39,742,9);
    txt('info@cagemw.com  |  +265 892 56 96 96',39,730,9);
    page.drawLine({start:{x:39,y:718},end:{x:555,y:718},color:blue,thickness:2});
    y=698;
    if(continuation){txt('Reference: '+item.id,39,y,9,strong);y-=22;}
  }
  function metadata(label,value){
    txt(label,39,y,9,strong);const lines=wraps(value||'—',390,10);
    for(const [n,line] of lines.entries()) txt(line,160,y-n*13,10);
    y-=Math.max(15,lines.length*13+2);
  }
  function tableTitle(){
    page.drawRectangle({x:39,y:y-19,width:516,height:21,color:pale});
    txt('Description',46,y-13,10,strong);
    right('MWK',548,y-13,10,strong);
    y-=30;
  }
  function row(label,value,bold=false){
    const font=bold?strong:normal, lines=wraps(label,380,10,font);
    if(y-lines.length*13<54){addPage(true);tableTitle();}
    lines.forEach((line,i)=>txt(line,46,y-i*13,10,font));
    right(cash(value),548,y,10,font);
    y-=lines.length*13+3;
  }
  addPage();
  metadata('Employee',item.employee_name);
  metadata('Employee ID',item.employee_number);
  metadata('Job title',item.job_title);
  metadata('Department',item.department);
  y-=7;
  const a=item.amounts;
  if(a.entry_currency&&a.entry_currency!=='MWK'){
    for(const l of wraps(`Salary entry: ${a.entry_currency} | MWK ${cash(a.mwk_per_unit)} per 1 ${a.entry_currency}. Net equivalent: ${a.entry_currency} ${cash(Number(item.net)/Number(a.mwk_per_unit))}.`,515,9)){
      txt(l,39,y,9);y-=12;
    }
    txt('Statutory amounts and recorded payments are in MWK.',39,y,9);y-=18;
  }
  tableTitle();
  row('Basic salary',a.basic);
  const allowances=Array.isArray(a.allowance_items)?a.allowance_items:(Number(a.allowances)>0?[{name:'Other allowance',amount:a.allowances}]:[]);
  allowances.forEach(entry=>row('Allowance — '+entry.name,entry.amount));
  row('Overtime',a.overtime);row('Bonus',a.bonus);
  row('Total allowances',a.allowances,true);row('Gross pay',item.gross,true);
  if(a.pension_rule)row('Pensionable monthly earnings',a.pensionable_income);
  if(a.paye_rule)row('Taxable monthly earnings',a.taxable_income);
  row('PAYE (deduction)',a.paye);row('Employee pension (deduction)',a.pension);
  row('Salary advance recovery (deduction)',a.advance);row('Other deductions',a.other_deductions);
  row('Total deductions',item.deductions,true);
  if(y<207)addPage(true);
  page.drawRectangle({x:39,y:y-23,width:516,height:28,color:navy});
  txt('Net pay',47,y-14,12,strong,white);
  right('MWK '+cash(item.net),548,y-14,12,strong,white);
  y-=44;
  txt('Payment recorded: MWK '+cash(item.paid)+(item.paid_on?'  |  Completed '+day(item.paid_on):'  |  No payment required'),39,y,10);
  txt('Employer pension contribution: MWK '+cash(a.employer_pension)+' (separate from deductions)',39,y-15,10);
  txt('Confidential  |  Generated electronically by CAGE Operations Hub',39,80,9);
  txt('Reference '+item.id,39,66,9);
  const issue=day(item.released_at)+'  |  '+new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Blantyre',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).format(new Date(item.released_at))+' CAT';
  txt('Issued '+issue,39,52,9,strong);
  const n=slot(item.id);
  globalThis.CagePDF.drawRoundStamp(PDFLib,page,stamp,stampFont,globalThis.CagePDF.stampDateAt(item.released_at),
    429+(n%4)*9,37+Math.floor(n/4)*7,.38);
  doc.getPages().forEach((p,i)=>p.drawText(`${i+1} / ${doc.getPageCount()}`,{x:39,y:23,size:8,font:normal,color:navy}));
  doc.setTitle('Official CAGE payslip | '+period);
  return doc.save();
}
