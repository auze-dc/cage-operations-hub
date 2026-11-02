// Isolated UI fixtures. No network requests or production application writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://hub.example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.HTMLElement.prototype.scrollIntoView=function(){};
let role='manager',writes=0;
const jobs=[{id:'sales',title:'Sales & Marketing Intern',department:'Sales',status:'Open',closing_date:'2099-11-04'},{id:'gis',title:'GIS <img src=x onerror=alert(1)>',department:'IT',status:'Open',closing_date:'2099-11-04'}];
const applications=[{id:'one',job_opening_id:'sales',full_name:'Candidate One',email:'one@example.test',phone:'000',stage:'New'},{id:'two',job_opening_id:'gis',full_name:'Candidate Two',email:'two@example.test',phone:'000',stage:'Shortlisted'},{id:'three',job_opening_id:'sales',full_name:'Candidate Three',email:'three@example.test',phone:'000',stage:'Interview'}];
w.CAGE_BACKEND={currentProfile:()=>({id:'staff',role,full_name:'Fixture manager'}),loadHR:async()=>({jobs,applications,interviews:[],employeeProfile:null,documents:[]}),updateApplicationStage:async()=>{writes++}};
w.showToast=message=>{throw Error(message)};
w.eval(fs.readFileSync('dist/job-advert.js','utf8'));w.eval(fs.readFileSync('dist/hr.js','utf8'));await w.CAGE_HR_UI.load();
const filter=d.getElementById('candidate-vacancy-filter'),search=d.getElementById('candidate-search'),board=d.getElementById('candidate-board');
assert.equal(board.querySelectorAll('.candidate-card').length,3);assert.match(filter.options[0].textContent,/All vacancies \(3\)/);assert.equal(d.querySelectorAll('#job-opening-list img').length,0);
filter.value='sales';filter.dispatchEvent(new w.Event('change'));assert.equal(board.querySelectorAll('.candidate-card').length,2);assert(!board.textContent.includes('Candidate Two'));assert.match(d.getElementById('candidate-result-summary').textContent,/Sales & Marketing Intern/);
search.value='Three';search.dispatchEvent(new w.Event('input'));assert.equal(board.querySelectorAll('.candidate-card').length,1);assert.match(board.textContent,/Candidate Three/);
d.querySelector('[data-view-applicants="gis"]').click();assert.equal(filter.value,'gis');assert.equal(search.value,'');assert.equal(board.querySelectorAll('.candidate-card').length,1);assert.match(board.textContent,/Candidate Two/);assert.equal(board.querySelectorAll('img').length,0);
applications.push({id:'four',job_opening_id:'gis',full_name:'Candidate Four',email:'four@example.test',phone:'000',stage:'New'});await w.CAGE_HR_UI.load();assert.equal(filter.value,'gis');assert.equal(board.querySelectorAll('.candidate-card').length,2);assert.match(filter.selectedOptions[0].textContent,/\(2\)/);
search.value='no-match';search.dispatchEvent(new w.Event('input'));assert.match(board.textContent,/No applications match/);search.value='';search.dispatchEvent(new w.Event('input'));filter.value='';filter.dispatchEvent(new w.Event('change'));assert.equal(board.querySelectorAll('.candidate-card').length,4);
assert.equal(d.querySelector('[data-view-applicants="sales"]').textContent,'View applicants (2)');assert.equal(d.querySelector('.vacancy-advert-link').getAttribute('href'),'./careers#role-sales');
assert.equal(writes,0);role='member';w.CAGE_HR_UI.render();assert.equal(board.innerHTML,'');dom.window.close();console.log('PASS: vacancy counts, isolated candidate pipelines, combined name search, one-click vacancy selection, incoming applications and retained selection, empty/all states, escaped job titles, direct advert links and no writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
