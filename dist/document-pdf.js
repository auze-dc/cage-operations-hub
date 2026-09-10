(function(root){
'use strict';
async function createDocumentPDF(PDFLib,record,type,logoBytes){
 const {PDFDocument,StandardFonts,rgb}=PDFLib;
 const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesRomanBold);
 const logo=await doc.embedPng(logoBytes),blue=rgb(0,173/255,239/255),navy=rgb(.09,.10,.20),black=rgb(0,0,0),grey=rgb(.85,.85,.85);
 const currency=record.currency||'MWK', num=n=>Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
 const clean=v=>String(v??'').replace(/[\u2010-\u2015]/g,'-').replace(/\u2022/g,'-').replace(/\u2019/g,"'").replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'?');
 function lines(value,width,size=11,font=regular){const out=[];for(const para of clean(value).split('\n')){let line='';for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize((line?line+' ':'')+word,size)>width&&line){out.push(line);line='';}if(font.widthOfTextAtSize(word,size)>width){for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>width){out.push(line);line='';}line+=ch;}}else line+=(line?' ':'')+word;}out.push(line);}return out;}
 let page,y;
 function text(v,x,y,size=11,font=regular,color=black){page.drawText(clean(v),{x,y,size,font,color});}
 function newPage(){page=doc.addPage([595.28,841.89]);page.drawRectangle({x:0,y:829,width:595.28,height:13,color:navy});page.drawRectangle({x:0,y:813,width:330,height:29,color:blue});page.drawRectangle({x:0,y:0,width:210,height:9,color:blue});page.drawRectangle({x:210,y:0,width:386,height:20,color:navy});page.drawImage(logo,{x:55,y:747,width:111,height:40});text('Phone: +265 892569696',403,780,9);text('Web: cagemw.com',403,768,9);text('Add: Area 47 sector 1, ABC, Lilongwe',365,756,9);page.drawLine({start:{x:0,y:732},end:{x:595.28,y:732},thickness:2,color:navy});text('Area 47 sector 1, ABC-ABI',30,49,10,regular,navy);text('+265 892569696',246,49,10,regular,navy);text('info@cagemw.com',427,49,10,regular,navy);y=712;}
 function ensure(h){if(y-h<92)newPage();}
 function paragraph(v,width=525,size=11,font=regular){for(const line of lines(v,width,size,font)){ensure(size+6);text(line,35,y,size,font);y-=size+5;}}
 newPage();
 const clientLines=lines('TO: '+record.client,355,12);for(const line of clientLines){text(line,35,y,12);y-=16;}for(const line of lines(record.recipient||'',355,11)){text(line,35,y,11);y-=15;}
 const metaTop=710;text((type==='quote'?'Quotation':'Invoice')+' No:',418,metaTop,12,bold,blue);text(record.number,418,metaTop-17,12,bold,blue);text('Date: '+(record.issued||''),418,metaTop-34,11,bold);text((type==='quote'?'Valid until: ':'Due: ')+(record.validUntil||record.due||''),418,metaTop-51,10,bold);
 y=Math.min(y-24,622);paragraph(record.description||'',525,13,bold);y-=20;
 const columns=[35,66,260,365,435,560];
 function tableHeader(){ensure(40);page.drawRectangle({x:35,y:y-29,width:525,height:29,color:blue});['sn','Deliverables Description','Unit Price ('+currency+')','Quantity','Total ('+currency+')'].forEach((v,i)=>text(v,columns[i]+5,y-18,i===2?9:10,bold));y-=29;}
 tableHeader();
 const items=Array.isArray(record.items)&&record.items.length?record.items:[{description:record.description,unitPrice:record.amount,quantity:1}];
 let total=0;
 for(let i=0;i<items.length;i++){
 const item=items[i], wrapped=lines(item.description,184,11),price=Number(item.unitPrice),qty=Number(item.quantity);if(!Number.isFinite(price)||!Number.isFinite(qty)||price<0||qty<=0)throw new Error('Invalid document line item.');total+=Math.round(price*qty*100)/100;
 let offset=0;while(offset<wrapped.length){if(y<130){newPage();tableHeader();}const count=Math.max(1,Math.min(wrapped.length-offset,Math.floor((y-105)/15)));const h=Math.max(30,count*15+12);page.drawRectangle({x:35,y:y-h,width:525,height:h,borderColor:grey,borderWidth:.5});for(const x of columns.slice(1,-1))page.drawLine({start:{x,y},end:{x,y:y-h},color:grey,thickness:.5});
 if(offset===0){text(i+1,columns[0]+10,y-18);text(num(price),columns[2]+6,y-18,10);text(qty,columns[3]+7,y-18,11);text(num(price*qty),columns[4]+5,y-18,10);}
 wrapped.slice(offset,offset+count).forEach((line,n)=>text(line,columns[1]+5,y-18-n*15));y-=h;offset+=count;
 }
 }
 ensure(48);page.drawRectangle({x:35,y:y-45,width:525,height:45,color:grey});text('Grand Total ('+currency+')',305,y-26,12,bold);text(num(total),440,y-26,11,bold);y-=77;
 if(record.serviceDetails){paragraph('Service Description',525,12,bold);paragraph(record.serviceDetails);y-=22;}
 ensure(110);paragraph('Payment Details',525,12,bold);paragraph(record.paymentDetails||'CAGE\n1013608314\nGateway Mall Branch\nNational Bank');y-=24;
 ensure(50);text('Prepared By: '+(record.preparedBy||'CAGE'),35,y,11);text('Signature: __________________',340,y,11);y-=20;
 doc.getPages().forEach((p,i)=>p.drawText(`${record.number} | ${i+1} / ${doc.getPageCount()}`,{x:252,y:26,size:8,font:regular,color:navy}));
 return doc.save();
}
root.CagePDF={createDocumentPDF};
})(globalThis);
