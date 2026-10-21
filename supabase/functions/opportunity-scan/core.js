// Deterministic discovery and evidence extraction. No eligibility claims are inferred as facts.
export const SOURCES=[
 {id:'malawi',name:'Malawi procurement',domains:['ppda.mw','maneps.mw'],url:'https://www.ppda.mw/tenders',official:true},
 {id:'un',name:'UN procurement',domains:['ungm.org','procurement-notices.undp.org','unops.org'],url:'https://www.ungm.org/Public/Notice',official:true},
 {id:'banks',name:'Development banks',domains:['afdb.org','worldbank.org'],url:'https://www.afdb.org/en/about-us/corporate-procurement/procurement-notices/current-solicitations',official:true},
 {id:'bilateral',name:'Development partners',domains:['giz.de','developpp.de'],url:'https://www.developpp.de/en/',official:true},
 {id:'innovation',name:'Innovation & technology',domains:['unicefventurefund.org','gsma.com','gcgh.grandchallenges.org'],url:'https://www.unicefventurefund.org/apply-funding',official:true},
 {id:'climate',name:'Climate & conservation',domains:['iucn.org','greenclimate.fund','thegef.org'],url:'https://iucn.org/procurement/currently-running-tenders',official:true},
 {id:'linkedin',name:'LinkedIn public leads',domains:['linkedin.com'],url:'https://www.linkedin.com/',official:false},
 {id:'discovery',name:'Secondary discovery',domains:['opportunitydesk.org','fundsforngos.org','opportunitiesforafricans.com'],url:'https://opportunitydesk.org/',official:false}
];
const CAPABILITIES=[
 ['Drone operations',/\b(drones?|uavs?|uas|rpas|lidar|photogrammetry|unmanned aerial|remotely piloted)\b/i],
 ['Geospatial services',/\b(gis|geospatial|remote sensing|earth observation|topographic(?:al)?|land surveying|aerial surveying|satellite imagery|geographic information|spatial data)\b/i],
 ['Precision agriculture',/\b(precision (?:farming|agriculture)|crop mapping|agricultural drones?|crop remote sensing)\b/i],
 ['Training & STEM',/\b(drone training|remote pilot licen[cs]e|stem education|stem training|robotics education|robotics training|geospatial training)\b/i]
];
export const MATCH_POLICY='cage-malawi-v1';
export function linkedinPost(url){try{const u=new URL(url);return /(^|\.)linkedin\.com$/.test(u.hostname)&&/^\/(?:posts\/|pulse\/|feed\/update\/urn:li:activity:)/.test(u.pathname);}catch{return false;}}
// Country evidence must refer to applicants, not the project location or publisher's address.
export function malawiEligibility(text='',trusted=false){
 const clauses=plain(text).split(/(?<=[.!?;])\s+|[\r\n]+/).filter(x=>x.length<1400);
 const evidence=clauses.filter(x=>/\b(eligib\w*|applicants?|applications? (?:are )?(?:open|invited)|open to|registered in|based in|established in|bidders?|nationals?|residents?|countries? (?:include|are|only))\b/i.test(x));
 const explicitExcluded=evidence.find(x=>/\b(?:excluding|except|not (?:open|eligible)|ineligible)\b[^.;]{0,80}\bmalawi\b|\bmalawi\b[^.;]{0,60}\b(?:not eligible|ineligible|excluded)\b/i.test(x));
 const entityExcluded=evidence.find(x=>/\b(?:only (?:registered )?(?:nonprofits?|non-profits?|ngos?|universities|students|individuals)|(?:nonprofits?|non-profits?|ngos?|universities|students|individuals) only)\b/i.test(x));
 // An explicit restricted country list overrides broad Africa/global language.
 const restricted=evidence.find(x=>/\b(?:eligible countries\s*(?:are\b|:)|(?:limited|restricted) to|only (?:applicants|companies|organisations|organizations|bidders)|(?:applicants|companies|organisations|organizations|bidders) (?:must be|must be legally) (?:registered|based|established) in)\b/i.test(x));
 const allows=x=>/\bmalawi\b/i.test(x)||/\b(?:all|any) (?:african|sadc|sub-saharan african) (?:countries|country)|\b(?:worldwide|all countries|any country)\b/i.test(x)||/\b(?:open to|applicants (?:from|across)|companies (?:from|across))\s+(?:(?:all|any)\s+)?(?:africa|southern africa|sadc|sub-saharan africa)\b/i.test(x);
 const positive=evidence.find(x=>allows(x)&&!/\b(?:not|except|excluding|limited|restricted)\b/i.test(x));
 if(explicitExcluded||entityExcluded||(restricted&&!allows(restricted)))return {status:trusted?'excluded':'unknown',evidence:explicitExcluded||entityExcluded||restricted,reason:trusted?'Published applicant restrictions do not establish a direct route for CAGE in Malawi.':'Restrictions appear in a search excerpt; verify the official notice.'};
 if(positive&&trusted)return {status:'supported',evidence:positive,reason:'Published country wording includes Malawi; other application conditions still need review.'};
 return {status:'unknown',evidence:positive||'',reason:positive?'Country wording found in a search excerpt; official confirmation needed.':'No explicit Malawi applicant eligibility found. A project location is not applicant eligibility.'};
}
const opportunity=/\b(tender|rfp|rfq|procurement|bid|grant|funding|call for proposals|expression of interest|contract|partnership|consortium|accelerator|challenge|call for applications|applications open|apply now)\b/i;
export function canonical(value){try{const u=new URL(decode(value));if(u.protocol!=='https:'||u.username||u.password||u.port)return '';u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid|msclkid)/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href.replace(/\/$/,'');}catch{return '';}}
export function allowed(value){const u=canonical(value);if(!u)return false;const h=new URL(u).hostname;return SOURCES.some(s=>s.domains.some(d=>h===d||h.endsWith('.'+d)))||h==='www.bing.com';}
export function decode(s=''){return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>{const v=Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):'';});}
export function plain(s=''){return decode(s.replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
function tag(s,t){return plain((s.match(new RegExp('<'+t+'\\b[^>]*>([\\s\\S]*?)</'+t+'>','i'))||[])[1]?.replace(/<!\[CDATA\[|\]\]>/g,'')||'');}
export function parseFeed(xml){if(!/<(?:rss|feed)\b/i.test(xml))throw Error('Source did not return an RSS/Atom feed');return (xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi)||[]).slice(0,60).map(b=>({title:tag(b,'title'),excerpt:tag(b,'description')||tag(b,'summary')||tag(b,'content'),url:canonical(tag(b,'link')||b.match(/<link[^>]+href=["']([^"']+)/i)?.[1]||'')})).filter(x=>x.title&&x.url);}
export function feedURL(s){const slot=Math.floor(Date.now()/43200000),domain=s.domains[slot%s.domains.length];const region=slot%2?'Africa':'Malawi';const q=`${region} (tender OR grant OR partnership) (drone OR mapping OR agriculture OR training) site:${domain}`;return 'https://www.bing.com/search?format=rss&q='+encodeURIComponent(q);}
export function parsePPDA(html){const rows=(html.match(/<tr\b[\s\S]*?<\/tr>/gi)||[]);const results=[];for(const row of rows){const link=row.match(/href=["']([^"']*\/opentenders\/[^"']+)["']/i)?.[1];if(!link)continue;const cells=(row.match(/<td\b[\s\S]*?<\/td>/gi)||[]).map(plain);results.push({title:'Tender: '+(cells.find(x=>x.length>12&&!/view|download/i.test(x))||plain(row).slice(0,240)),scope:cells[0],organisation:cells[1]||'Not stated',excerpt:'Malawi procurement notice. '+plain(row)+(cells[4]&&/^\d{4}-\d{2}-\d{2}$/.test(cells[4])?' Closing date: '+cells[4]:''),url:canonical(new URL(decode(link),'https://www.ppda.mw/tenders').href)});}if(!results.length&&!/no tenders|no records|no data available/i.test(html))throw Error('PPDA layout needs manual review');return results.filter(x=>x.url).slice(0,100);}
export function deadline(text){
 const clean=text.replace(/(\d)(st|nd|rd|th)\b/gi,'$1');const m=clean.match(/(?:deadline(?: on)?|closing date|closes|submit(?:ted)? by)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -]\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})(.{0,55})/i);
 if(!m)return {date:null,label:/\b(rolling applications|rolling deadline|applications accepted on a rolling basis)\b/i.test(text)?'Rolling':'Not stated',timezone:'Not stated',evidence:''};
 const d=new Date(m[1]);const date=Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;return {date,label:date||'Not stated',timezone:m[2]?.match(/\b(?:UTC|GMT|CAT|EAT|CET|CEST)(?:\s*[+-]\s*\d{1,2}(?::\d{2})?)?\b/i)?.[0]||'Not stated',evidence:m[0].trim()};
}
export function assess(item,page='',source){if(genericTitle(item.title)||!item.title)return null;const text=item.title+' '+(item.excerpt||'')+' '+page;const caps=CAPABILITIES.filter(([,r])=>r.test(text)).map(([n])=>n);if(!caps.length||!opportunity.test(text))return null;
 const country=malawiEligibility(page||item.excerpt||'',!!page&&!!source?.official);
 const discoveryExcluded=country.status==='excluded';
 const geography=/\bmalawi\b/i.test(text)?'Malawi':/\b(southern africa|sadc)\b/i.test(text)?'Southern Africa':/\b(africa|african|sub-saharan)\b/i.test(text)?'Africa':/\b(global|worldwide|international bidders|developing countries)\b/i.test(text)?'International':'Not stated';
 const d=deadline((item.excerpt||'')+' '+page);const restriction=/\b(ngos? only|nonprofits? only|students? only|individuals? only|universities only|nationals only)\b/i.test(text);const partner=/\b(consortium|subcontractor|implementing partner|delivery partner)\b/i.test(text);
 const type=/\b(partnership|consortium|subcontractor)\b/i.test(item.title)?'Partnership':/\b(contract award|contract opportunity)\b/i.test(item.title)?'Contract':/\b(tender|rfp|rfq|procurement|bid|expression of interest)\b/i.test(item.title+' '+(item.excerpt||'').slice(0,500))?'Tender / RFQ':'Grant';
 const score=Math.min(95,35+caps.length*9+({Malawi:25,'Southern Africa':18,Africa:12,International:8}[geography]||0));
 const titleYear=Number(item.title.match(/\b(20\d{2})\b/)?.[1]||0);const historical=titleYear>0&&titleYear<new Date().getUTCFullYear()-1;
 return {matchPolicy:MATCH_POLICY,discoveryExcluded,countryEligibility:country.status,countryEvidence:country.evidence,eligibilityReason:country.reason,historical,type,geography,score,deadline:d.date,deadlineLabel:d.label,timezone:d.timezone,deadlineEvidence:d.evidence,capabilities:caps,
 eligibility:'Needs review',routeHint:restriction?'Restrictions detected — check eligibility':partner?'Potential partner route — verify conditions':'Check applicant eligibility',
 reason:`Matches ${caps.join(', ')}. ${geography==='Not stated'?'Geography needs confirmation.':geography+' is mentioned in the notice.'} This is a relevance ranking, not confirmation that CAGE qualifies.`,
 organisation:item.organisation||'Not stated',estimatedValue:'Not stated',sourceKind:source?.official?'Official domain':'Secondary source',verification:page?'Page retrieved — staff verification required':'Search excerpt only',summary:plain(page||item.excerpt||'').slice(0,1200),requirements:[],checkedAt:new Date().toISOString()};}
export async function safeText(url,fetcher=fetch){if(!allowed(url))throw Error('Source domain requires manual review');let current=url;for(let n=0;n<4;n++){const r=await fetcher(current,{redirect:'manual',headers:{'User-Agent':'CAGE-Opportunity-Monitor/4.0'},signal:AbortSignal.timeout(6500)});if(r.status>=300&&r.status<400){current=new URL(r.headers.get('location')||'',current).href;if(!allowed(current))throw Error('Redirect requires manual review');continue;}if(!r.ok)throw Error('Source returned HTTP '+r.status);if(!/text|xml|json/i.test(r.headers.get('content-type')||''))throw Error('PDF or unsupported content — open the source manually');const reader=r.body?.getReader();if(!reader)throw Error('Empty source response');let size=0,parts=[];try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>1500000)throw Error('Source exceeds scan size limit');parts.push(x.value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let off=0;for(const b of parts){bytes.set(b,off);off+=b.length;}return new TextDecoder().decode(bytes);}throw Error('Too many redirects');}
export const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');

export function parseListing(html,source){if(source.id==='malawi')return parsePPDA(html);const out=[];const blocks=source.id==='innovation'?[html]:(html.match(/<tr\b[\s\S]*?<\/tr>/gi)||[]);for(const block of blocks){for(const m of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){let href;try{href=canonical(new URL(decode(m[1]),source.url).href);}catch{continue;}const title=plain(m[2]);if(!href||title.length<8)continue;const valid=source.id==='innovation'?new URL(href).pathname.startsWith('/call/'):source.id==='un'?/\/Public\/Notice\/\d+/i.test(href):source.id==='banks'?/\/documents?\/|\.pdf(?:\?|$)/i.test(href):/\/sites\/default\/files\//.test(href);if(!valid)continue;out.push({title:(source.id==='innovation'?'Funding call: ':'Tender: ')+title,scope:source.id==='innovation'?title:plain(block),excerpt:source.id==='innovation'?title:plain(block),url:href,organisation:({banks:'African Development Bank',innovation:'UNICEF Venture Fund',climate:'IUCN'}[source.id]||'Not stated')});}}if(!out.length&&!/no results|no tenders|no current|no records|no open/i.test(html))throw Error('Listing requires manual review or a newer portal');return out.slice(0,70);}

// Multiple independent discovery routes; search snippets are never treated as verified notices.
export function feedURLs(source){
 const slot=Math.floor(Date.now()/43200000);
 const terms=['(drone OR geospatial OR remote sensing OR lidar)','(precision agriculture OR earth observation OR STEM education OR land surveying)'];
 return terms.map((term,i)=>'https://www.bing.com/search?format=rss&q='+encodeURIComponent(`(Malawi OR Africa OR global) (tender OR grant OR funding OR proposals) ${term} site:${source.id==='linkedin'?'linkedin.com/posts':source.domains[(slot+i)%source.domains.length]}`));
}
export function directFeeds(source){return source.id==='discovery'?['https://opportunitydesk.org/feed/','https://www.opportunitiesforafricans.com/feed/']:[];}
export function candidates(items,oldRows,saved,limit=40,rotation=Math.floor(Date.now()/60000)){
 const seen=new Set();const last=new Map(oldRows.map(x=>[canonical(x.source_url),x.raw_data?.checkedAt||'']));
 const ranked=items.filter(i=>allowed(i.url)&&(!i.url.includes('linkedin.com')||linkedinPost(i.url))).sort((a,b)=>{
  const aOld=last.get(a.url),bOld=last.get(b.url);
  if(!!aOld!==!!bOld)return aOld?1:-1;
  if(aOld&&bOld)return aOld.localeCompare(bOld);
  return (assess(b,'',b.source)?.score||0)-(assess(a,'',a.source)?.score||0);
 });
 const top=ranked.slice(0,Math.ceil((limit-saved.length)/2));const remaining=ranked.slice(top.length);const offset=remaining.length?rotation%remaining.length:0;
 return [...saved,...top,...remaining.slice(offset),...remaining.slice(0,offset)].filter(i=>{if(!i.url||seen.has(i.url))return false;seen.add(i.url);return true;}).slice(0,limit);
}

// A navigation label is not a notice. Keep these out of discovery and fetch the title from the notice itself.
export function genericTitle(value='') {
 return /^(?:funding call:\s*|tender:\s*)?(?:view (?:call )?details|call details|read more|learn more|apply now|click here|view notice|details)$/i.test(plain(value).trim());
}
export function noticeTitle(html,fallback='') {
 const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>plain(m[1]));
 const title=plain(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 return [...headings,title,fallback].find(t=>t.length>=12&&!genericTitle(t))||'';
}
export function noticeText(html) {
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html;
 return plain(main.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi,' '));
}
