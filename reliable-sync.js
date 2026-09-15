(function(){'use strict';
const equal=(a,b)=>JSON.stringify(normal(a))===JSON.stringify(normal(b));function normal(v){return Array.isArray(v)?v.map(normal):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normal(v[k])])):v;}
function changes(base,next){const out=[];for(const key of new Set([...Object.keys(base||{}),...Object.keys(next||{})])){const a=base?.[key],b=next?.[key];if(equal(a,b))continue;if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(r=>r&&typeof r==='object'&&r.id)){for(const id of new Set([...a,...b].map(r=>r.id))){const before=a.find(r=>r.id===id)||null,after=b.find(r=>r.id===id)||null;if(!equal(before,after))out.push({key,id,before,after});}}else out.push({key,id:null,before:a??null,after:b??null});}return out;}
function apply(base,patches){const n=structuredClone(base);for(const c of patches){if(c.id===null)n[c.key]=c.after;else{n[c.key]=(n[c.key]||[]).filter(r=>r.id!==c.id);if(c.after)n[c.key].push(c.after);}}return n;}
window.CAGE_SYNC={changes,apply,equal};
})();
