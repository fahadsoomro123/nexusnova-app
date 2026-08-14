import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main class="main">
      <section id="tab-home" class="tab active"><button id="mineBtn" type="button">START MINING</button></section>
      <section id="tab-about" class="tab"></section>
    </main>
    <nav class="bottom-dock">
      <button class="dock-item" onclick="switchTab('wallet',this)" type="button">Wallet</button>
      <button class="dock-item" id="moreBtn" type="button">ALL APPS</button>
    </nav>
    <div id="moreMenu"><div class="more-inner"><button class="more-item" onclick="openMoreTab('weather')" type="button">Weather</button></div></div>
  </body></html>`);
  await page.evaluate(()=>localStorage.clear());
  await page.addScriptTag({url:`${base}/js/nexusnova-onboarding-insights-v1.js?v=1`});

  assert.equal(await page.evaluate(()=>window.nexusOnboardingVersion),'onboarding-insights-v1');
  assert.equal(await page.evaluate(()=>window.nexusProductInsights.version),'local-private-v1');
  await page.waitForSelector('#nxPrivateInsightsCard');
  assert.equal(await page.textContent('#nxInsightSessions'),'1');
  console.log('PASS onboarding module boots and records a local session only');

  await page.click('.dock-item');
  await page.click('#moreMenu .more-item');
  await page.click('#mineBtn');
  const summary=await page.evaluate(()=>window.nexusProductInsights.summary());
  assert.equal(summary.featureOpens,2);
  assert.equal(summary.topFeature,'wallet');
  console.log('PASS private usage counters capture safe feature keys');

  const events=await page.evaluate(()=>JSON.parse(localStorage.getItem('nexusnova_product_events_v1')||'[]'));
  for(const row of events){
    assert.deepEqual(Object.keys(row).sort(),Object.keys(row).filter(k=>['t','e','f'].includes(k)).sort());
    if(row.f) assert.match(row.f,/^[a-z0-9_-]{1,40}$/);
  }
  const raw=JSON.stringify(events).toLowerCase();
  for(const forbidden of ['email','walletaddress','searchtext','latitude','longitude','message','uid']){
    assert.equal(raw.includes(forbidden),false,`private event store leaked forbidden key: ${forbidden}`);
  }
  console.log('PASS event store contains no personal-content fields');

  await page.evaluate(()=>window.nexusOpenAppTour());
  await page.waitForSelector('#nxOnboardingOverlay:not([hidden])');
  assert.match(await page.textContent('#nxTourTitle'),/Meet NexusNova/i);
  for(let i=0;i<5;i++) await page.click('#nxTourNext');
  await page.waitForFunction(()=>document.getElementById('nxOnboardingOverlay')?.hidden===true);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('nexusnova_onboarding_v1_state')||'null'));
  assert.equal(state.status,'completed');
  console.log('PASS guided tour completes and remembers onboarding state');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nOnboarding runtime complete: guided tour + privacy-safe local insights passed.');
} finally {
  await browser.close();
}
