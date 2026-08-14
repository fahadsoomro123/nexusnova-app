import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <section id="tab-travel" class="tab">
      <button onclick="nxComing('flight')">Flight Search</button>
      <button onclick="nxComing('rail')">Train Search</button>
      <button onclick="nxComing('bus')">Bus Search</button>
      <button onclick="nxComing('trip')">Plan Trip</button>
      <div class="integration-note">Live providers and ticketing will be connected in the next working-integration phase.</div>
    </section>
    <section id="tab-learn" class="tab">
      <button onclick="nxComing('learning')">Open Learning</button>
      <button onclick="nxComing('papers')">Open Papers</button>
    </section>
    <section id="tab-mega-learning" class="tab">
      <input id="nxMegaStudy" value="">
      <button>📖 Solved Papers</button><button>📝 Quiz</button><button>📅 Study Planner</button>
    </section>
  </body></html>`);

  await page.evaluate(()=>{
    localStorage.clear();
    window.__comingCalls=0;
    window.nxComing=()=>{window.__comingCalls+=1;};
    window.__opened=[];
    window.nxOpenExternal=url=>window.__opened.push(String(url));
    window.NexusNovaUI={
      form:async options=>{
        if(String(options?.title).includes('Plan Your Trip')) return {destination:'Islamabad',start:'2026-08-20',days:'3',notes:'Family visit'};
        if(String(options?.title).includes('Find Solved')) return {board:'BISE Larkana',className:'Grade 10',subject:'Mathematics',year:'2025'};
        return null;
      },
      resultShell:({title='',subtitle='',bodyHtml='',footer=''})=>`<div><b>${title}</b><small>${subtitle}</small>${bodyHtml}<em>${footer}</em></div>`,
      toast:()=>{}
    };
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-travel-live-v1.js?v=2`});
  await page.waitForFunction(()=>window.__nxTravelLiveV2===true && document.getElementById('nxTravelFlightLive'));
  assert.equal(await page.evaluate(()=>window.nexusTravelLiveVersion),'provider-handoff-v2');
  assert.equal(await page.evaluate(()=>document.querySelector('#tab-travel .integration-note')?.dataset.nxTravelLive),'1');
  assert.equal((await page.textContent('#tab-travel .integration-note')).includes('next working-integration phase'),false);
  console.log('PASS Travel V2 replaces stale integration copy and claims legacy buttons');

  await page.click('#nxTravelFlightLive');
  assert.ok((await page.textContent('#nxTravelLiveOut')).includes('Live Flight Search'));
  await page.click('[data-travel-link="0"]');
  assert.ok((await page.evaluate(()=>window.__opened)).some(url=>url.includes('google.com/travel/flights')));
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Travel flight action hands off to a real provider without legacy Coming Soon');

  await page.click('#nxTravelPlanLive');
  await page.waitForFunction(()=>document.getElementById('nxTravelLiveOut')?.textContent?.includes('Islamabad — 3-Day Trip Plan'));
  const trip=await page.evaluate(()=>JSON.parse(localStorage.getItem('nexusnova_trip_plan_v1')||'null'));
  assert.equal(trip.destination,'Islamabad');
  assert.equal(trip.days,3);
  assert.equal(trip.notes,'Family visit');
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Travel planner uses in-app form data and saves only the local itinerary');

  await page.addScriptTag({url:`${base}/js/nexusnova-learning-engine-v1.js?v=3`});
  await page.waitForFunction(()=>window.__nxLearningEngineV3===true && document.getElementById('nxLearnOpenPapers'));
  assert.ok(await page.$('#nxLearningSolvedPapers'));
  assert.ok(await page.$('#nxLearningQuiz'));
  assert.ok(await page.$('#nxLearningPlanner'));
  console.log('PASS Learning V3 claims legacy Learn/Papers and mega-learning actions');

  await page.click('#nxLearnOpenPapers');
  await page.waitForFunction(()=>document.querySelector('.nx-learning-output')?.textContent?.includes('Real Solved / Past Paper Search'));
  const learningText=await page.textContent('.nx-learning-output');
  assert.ok(learningText.includes('BISE Larkana'));
  assert.ok(learningText.includes('Grade 10'));
  await page.click('[data-paper="pdf"]');
  const opened=await page.evaluate(()=>window.__opened.slice());
  assert.ok(opened.some(url=>decodeURIComponent(url).includes('BISE Larkana Grade 10 Mathematics 2025 past paper solved paper PDF filetype:pdf')));
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Learning solved-paper flow builds a truthful real-web/PDF search without inventing files');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nTravel + Learning runtime complete: real handoff, premium trip planner and learning overrides passed.');
} finally {
  await browser.close();
}
