(function(root){'use strict';
function documentRecord(data){const o=data.order;if(!o?.mode)throw new Error('Prepare the order details first.');const draft=o.mode==='prepared_po'&&!o.po_approval;
const title=o.mode==='confirmation'?'ORDER CONFIRMATION':o.mode==='client_lpo'?'CLIENT LPO SUMMARY':draft?'DRAFT PURCHASE ORDER':'APPROVED PURCHASE ORDER';
const notice=o.mode==='confirmation'?'Issued by CAGE to confirm the accepted quotation.':o.mode==='client_lpo'?'CAGE summary of the uploaded client LPO. The original client document remains the source.':draft?'Prepared by CAGE for client review and approval. This is not yet a client-issued LPO.':'Prepared by CAGE. Client approval recorded by staff; see approval details below.';
const a=o.po_approval||o.acceptance;const evidence=a?.source==='client'?`Client acceptance: ${a.name||''} on ${String(a.at||'').slice(0,10)}.`:`${o.po_approval?'PO approval':'Quotation acceptance'}: ${a?.contact||''}, via ${a?.method||''}, ${a?.date||''}. Recorded by ${a?.recordedByName||'CAGE staff'}.`;
return {...o.snapshot,id:'order-'+data.quote.id,number:o.order_data.number,issued:o.order_data.date,revision:o.version,orderTitle:title,orderNotice:notice,description:'Based on quotation '+o.snapshot.number+' — '+o.snapshot.description,serviceDetails:[o.snapshot.serviceDetails,evidence,o.po_approval?.clientPoNumber?'Client PO number: '+o.po_approval.clientPoNumber:''].filter(Boolean).join('\n'),recipient:o.snapshot.recipient};}
root.CageOrderDocument={documentRecord};
})(globalThis);
