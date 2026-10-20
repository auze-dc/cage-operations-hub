(function(root){
'use strict';
// Accept ungrouped decimals or groups of exactly three digits. Never guess locale.
function parse(value){
 const text=String(value??'').trim();
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))return NaN;
 const n=Number(text.replaceAll(',',''));
 return Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER/100?n:NaN;
}
function format(value){return Number(value).toLocaleString('en-GB',{maximumFractionDigits:2});}
const api={parse,format};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.CageAmountInput=api;
})(globalThis);
