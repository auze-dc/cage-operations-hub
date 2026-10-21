import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const core=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('supabase/functions/opportunity-scan/core.js','utf8')).toString('base64'));
const official={official:true};
for(const title of ['Tender: Road construction consultancy and solar streetlights','Tender: Provision of consultancy services for marketing agency','Tender: Office complex design and construction supervision'])assert.equal(core.assess({title,excerpt:'Malawi procurement notice'},'',official),null,title);
const title='Tender: drone mapping and geospatial survey';
let fit=core.assess({title},'Applications are open to companies based in Malawi. Closing date: 2026-12-01.',official);
assert.equal(fit.countryEligibility,'supported');assert.equal(fit.deadline,'2026-12-01');
assert.equal(core.assess({title},'Project location: Malawi. Applicants must be registered in Kenya.',official).countryEligibility,'excluded');
assert.equal(core.assess({title},'Project location: Malawi.',official).countryEligibility,'unknown');
assert.equal(core.assess({title},'Open to Africa. Eligible countries are Kenya and Uganda.',official).countryEligibility,'excluded');
assert.equal(core.assess({title},'Open to Africa. Malawi is not eligible.',official).countryEligibility,'excluded');
assert.equal(core.assess({title},'Open to companies worldwide. Only NGOs are eligible.',official).countryEligibility,'excluded');
assert.equal(core.assess({title},'Applications open to Africa.',official).countryEligibility,'supported');
assert.equal(core.assess({title,excerpt:'Applications open to companies based in Malawi.'},'',official).countryEligibility,'unknown');
assert.equal(core.assess({title},'Open to companies worldwide.',{official:false}).countryEligibility,'unknown');
assert(core.linkedinPost('https://www.linkedin.com/posts/someone_drone-funding-activity-123'));
assert(!core.linkedinPost('https://www.linkedin.com/in/someone'));
assert(!core.linkedinPost('https://evil-linkedin.com/posts/x'));
assert(core.feedURLs(core.SOURCES.find(s=>s.id==='linkedin')).every(u=>decodeURIComponent(u).includes('site:linkedin.com/posts')));
assert.equal(core.candidates([{title,url:'https://www.linkedin.com/in/foo'}],[],[]).length,0);
console.log('Opportunity scope, country evidence and LinkedIn discovery checks passed.');
// Render actual views to verify uncertain leads and excluded records cannot leak into Discover.
const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
const {JSDOM}=require((process.env.CAGE_TEST_MODULES||'/tmp/cage-fit-tests/node_modules')+'/jsdom');
const dom=new JSDOM('<section data-view-panel="commercial"><div class="opportunity-monitor"></div><button id="new-commercial-button"></button></section>',{url:'https://hub.example',runScripts:'outside-only'});
const win=dom.window;
const records=[['eligible','supported',false],['uncertain','unknown',false],['excluded','excluded',true],['irrelevant','unknown',true]].map(([title,countryEligibility,discoveryExcluded])=>({id:title,title,organization:'Issuer',opportunity_type:'Grant',source_url:'https://example.com',match_score:60,found_at:'2026-10-21',raw_data:{countryEligibility,discoveryExcluded},tracking:{stage:'New',verified:{}}}));
win.CAGE_BACKEND={isProduction:()=>true,opportunityDashboard:async()=>({matches:records,staff:[],runs:[],settings:{frequency:'twice_daily'},canScan:true,canManageScan:false})};
win.eval(readFileSync('dist/opportunities.js','utf8'));await new Promise(r=>setTimeout(r,10));
const titles=()=>[...win.document.querySelectorAll('.opp-row h3')].map(x=>x.textContent);
assert.deepEqual(titles(),['eligible','uncertain']);
win.document.querySelector('[data-opp-tab="Needs verification"]').click();assert.deepEqual(titles(),['uncertain']);
win.document.querySelector('[data-opp-tab="All"]').click();assert.equal(titles().length,4);
assert(win.document.querySelector('[data-opp-scan]'));assert.equal(win.document.querySelector('[data-opp-settings]'),null);
records.splice(0,records.length,...[
 ['direct','Grant','Direct service match',false,'https://example.com/direct'],
 ['fund','Grant','Potential grant fit',false,'https://opportunitydesk.org/2026/funding'],
 ['fellow','Fellowship / Training','Staff development',false,'https://opportunitydesk.org/2026/fellowship'],
 ['closed','Fellowship / Training','Staff development',true,'https://www.rockefellerfoundation.org/closed']
].map(([title,type,fitLevel,closed,source_url])=>({id:title,title,opportunity_type:type,organization:'Issuer',source_url,match_score:60,found_at:'2026-10-21',raw_data:{fitLevel,closed,countryEligibility:'unknown'},tracking:{stage:'New',verified:{}}})));
await win.CAGE_OPPORTUNITIES.refresh(true);win.document.querySelector('[data-opp-tab="Discover"]').click();assert.deepEqual(titles(),['direct','fund','fellow']);
function focus(value){const el=win.document.querySelector('[data-filter="scope"]');el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));}
focus('development');assert.deepEqual(titles(),['fellow']);focus('direct');assert.deepEqual(titles(),['direct']);focus('funding');assert.deepEqual(titles(),['direct','fund']);focus('all');
const sourceFilter=win.document.querySelector('[data-filter="source"]');sourceFilter.value='opportunitydesk.org';sourceFilter.dispatchEvent(new win.Event('change',{bubbles:true}));assert.deepEqual(titles(),['fund','fellow']);
win.document.querySelector('[data-filter="source"]').value='';win.document.querySelector('[data-filter="source"]').dispatchEvent(new win.Event('change',{bubbles:true}));
win.document.querySelector('[data-opp-tab="Past deadlines"]').click();assert.deepEqual(titles(),['closed']);assert.match(win.document.querySelector('.opp-row').textContent,/Closed on source/);
dom.window.close();console.log('Discovery, verification and retained history views passed.');

assert.equal(core.assess({title:'Youth Ecopreneur Programme funding 2026'},'',official).fitLevel,'Potential grant fit');
assert.equal(core.assess({title:'Grant: climate adaptation and agriculture innovation'},'',official).fitLevel,'Potential grant fit');
assert.equal(core.assess({title:'Research fellowship in international affairs'},'',official),null);

const secondary={official:false};
const rock=core.assess({title:'Rockefeller Foundation Big Bets Fellowship 2027',excerpt:'Leadership and climate innovation programme for individuals.'},'Applications are open to individuals across Africa. Applications are now closed.',official);
assert.equal(rock.type,'Fellowship / Training');assert.equal(rock.fitLevel,'Staff development');assert.equal(rock.closed,true);assert.equal(rock.discoveryExcluded,false);assert.match(rock.applicantRoute,/Individual/);
assert.equal(core.assess({title:'Climate leadership fellowship 2027'},'Applicants must be based in Kenya.',official).countryEligibility,'excluded');
assert.equal(core.assess({title:'Climate leadership fellowship 2027',excerpt:'Open to Malawi applicants'},'',secondary).countryEligibility,'unknown');
assert.equal(core.assess({title:'Climate innovation prize competition 2027'},'',official).type,'Award / Competition');
assert.equal(core.directFeeds(core.SOURCES.find(s=>s.id==='discovery')).filter(u=>u.includes('opportunitydesk.org')).length,3);
assert(core.SOURCES.some(s=>s.domains.includes('rockefellerfoundation.org')));
assert(core.feedURLs(core.SOURCES.find(s=>s.id==='foundations')).some(u=>decodeURIComponent(u).includes('fellowship')));
console.log('Broad discovery, staff applicant routes, foundation feeds and closed-call checks passed.');
