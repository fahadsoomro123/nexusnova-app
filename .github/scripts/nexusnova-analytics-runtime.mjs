import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.goto(base+'/.runtime-origin.html?ref=NVX-SECRET123&search=private-query');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main>
      <section id="tab-home" class="tab active">
        <input id="privateSearch" value="private user search text">
        <button id="mineBtn" type="button">Mine</button>
        <button id="dailyRewardBtn" type="button">Daily</button>
        <button id="rewardedAdBtn" type="button">Ad</button>
        <button id="bugReportButton" data-nx-report-problem type="button">Report</button>
      </section>
      <section id="tab-profile" class="tab"></section>
      <section id="tab-about" class="tab"></section>
    </main>
    <nav>
      <button class="dock-item" onclick="switchTab('wallet',this)" type="button">Wallet</button>
      <button class="more-item" data-nxmega="wallet?email=secret@example.com&ref=NVX-SECRET123" type="button">Malicious data</button>
    </nav>
  </body></html>`);

  await page.evaluate(() => {
    localStorage.clear();
    window.switchTab=()=>{};
    window.openMoreTab=()=>{};
    localStorage.setItem('nexusnova_analytics_consent_v1',JSON.stringify({status:'granted',at:Date.now()}));
    window.__nxAnalyticsEvents=[];
    window.__nxAnalyticsAdapterState={enabled:null,consent:null,inits:0};
    window.__nxAnalyticsTestAdapter={
      init:async()=>{
        window.__nxAnalyticsAdapterState.inits+=1;
        return {
          log:(name,params)=>window.__nxAnalyticsEvents.push({name,params}),
          setEnabled:value=>{ window.__nxAnalyticsAdapterState.enabled=Boolean(value); },
          setConsent:value=>{ window.__nxAnalyticsAdapterState.consent=Boolean(value); }
        };
      }
    };
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-analytics-v1.js?v=2`});
  await page.waitForFunction(()=>window.nexusAnalytics?.state()==='on');
  assert.equal(await page.evaluate(()=>window.nexusAnalyticsVersion),'firebase-consent-v1');
  assert.equal(await page.evaluate(()=>window.__nxAnalyticsAdapterState.inits),1);
  assert.equal(await page.evaluate(()=>window.__nxAnalyticsAdapterState.enabled),true);
  assert.equal(await page.evaluate(()=>window.__nxAnalyticsAdapterState.consent),true);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-nx-analytics-card]').length),2);
  console.log('PASS consented analytics initializes once and renders privacy controls');

  await page.click('.dock-item');
  await page.click('#mineBtn');
  await page.click('#dailyRewardBtn');
  await page.click('#rewardedAdBtn');
  await page.click('#bugReportButton');

  const safeEvents=await page.evaluate(()=>window.__nxAnalyticsEvents.slice());
  assert.ok(safeEvents.some(row=>row.name==='nx_app_session' && row.params?.source==='web'));
  assert.ok(safeEvents.some(row=>row.name==='nx_feature_open' && row.params?.feature==='wallet'));
  assert.ok(safeEvents.some(row=>row.name==='nx_mining_action' && row.params?.action==='mine'));
  assert.ok(safeEvents.some(row=>row.name==='nx_daily_reward_action'));
  assert.ok(safeEvents.some(row=>row.name==='nx_rewarded_ad_action'));
  assert.ok(safeEvents.some(row=>row.name==='nx_bug_report_open'));
  console.log('PASS safe session and product events are emitted after opt-in');

  const beforeMalicious=await page.evaluate(()=>window.__nxAnalyticsEvents.length);
  await page.click('.more-item');
  await page.evaluate(()=>window.nexusAnalytics.track('nx_feature_open',{feature:'wallet?email=leak@example.com&ref=NVX-SECRET123'}));
  const afterRows=await page.evaluate(()=>window.__nxAnalyticsEvents.slice());
  const serialized=JSON.stringify(afterRows).toLowerCase();
  for(const forbidden of [
    'secret@example.com','leak@example.com','nvx-secret123','private-query',
    'private user search text','search=','?ref='
  ]){
    assert.equal(serialized.includes(forbidden),false,`analytics leaked forbidden content: ${forbidden}`);
  }
  assert.ok(afterRows.length>=beforeMalicious);
  console.log('PASS unknown feature data, URL query and form content cannot leak into analytics payloads');

  const countBeforeDisable=await page.evaluate(()=>window.__nxAnalyticsEvents.length);
  await page.evaluate(()=>window.nexusAnalytics.disable());
  assert.equal(await page.evaluate(()=>window.nexusAnalytics.consent()),'denied');
  assert.equal(await page.evaluate(()=>window.__nxAnalyticsAdapterState.enabled),false);
  assert.equal(await page.evaluate(()=>window.__nxAnalyticsAdapterState.consent),false);
  await page.click('.dock-item');
  const countAfterDisable=await page.evaluate(()=>window.__nxAnalyticsEvents.length);
  assert.equal(countAfterDisable,countBeforeDisable);
  console.log('PASS disabling analytics immediately stops future custom events');

  const noConsent=await browser.newPage();
  await noConsent.goto(base+'/.runtime-origin.html');
  await noConsent.setContent('<section id="tab-profile"></section><section id="tab-about"></section>');
  await noConsent.evaluate(()=>{
    localStorage.clear();
    window.__nxAnalyticsTestAdapter={init:async()=>{ throw new Error('adapter must not initialize without consent'); }};
  });
  await noConsent.addScriptTag({url:`${base}/js/nexusnova-analytics-v1.js?v=2`});
  await noConsent.waitForFunction(()=>window.nexusAnalytics?.state()==='off');
  assert.equal(await noConsent.evaluate(()=>window.nexusAnalytics.consent()),'unknown');
  assert.equal(await noConsent.evaluate(()=>window.nexusAnalytics.state()),'off');
  console.log('PASS analytics provider is not initialized before explicit opt-in');
  await noConsent.close();

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nAnalytics runtime complete: consent, retention events, privacy whitelist and opt-out passed.');
} finally {
  await browser.close();
}
