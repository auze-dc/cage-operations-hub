/* Currency is recorded per transaction. No implicit exchange-rate conversion. */
(function(root){'use strict';
const codes=Object.freeze(['MWK','USD','GBP','EUR']);
const names={MWK:'Malawi kwacha',USD:'US dollar',GBP:'British pound',EUR:'Euro'};
function code(value){if(value==null||value==='')return 'MWK';if(!/^[A-Z]{3}$/.test(value))throw new Error('Choose a valid currency');return value;}
function format(value,compact=false,currency='MWK'){currency=code(currency);const n=Number(value)||0;if(compact&&Math.abs(n)>=1000000)return `${currency} ${(n/1000000).toFixed(1).replace(/\.0$/,'')}m`;if(compact&&Math.abs(n)>=1000)return `${currency} ${(n/1000).toFixed(1).replace(/\.0$/,'')}k`;return `${currency} ${new Intl.NumberFormat('en-GB',{minimumFractionDigits:currency==='MWK'?0:2,maximumFractionDigits:2}).format(n)}`;}
function totals(rows,amount=r=>r.amount,compact=true){const groups=new Map();for(const r of rows){const c=code(r.currency);groups.set(c,(groups.get(c)||0)+(Number(amount(r))||0));}return [...groups].sort(([a],[b])=>(codes.indexOf(a)<0?99:codes.indexOf(a))-(codes.indexOf(b)<0?99:codes.indexOf(b))||a.localeCompare(b)).map(([c,n])=>format(n,compact,c)).join(' · ')||format(0,compact);}
function options(selected='MWK'){selected=code(selected);return [...new Set([...codes,selected])].map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c} — ${names[c]||c}</option>`).join('');}
function field(selected='MWK',name='currency'){return `<label class="field"><span>Currency</span><select name="${name}" required>${options(selected)}</select></label>`;}
root.CageCurrency=Object.freeze({codes,code,format,totals,options,field});
})(typeof window==='undefined'?globalThis:window);
