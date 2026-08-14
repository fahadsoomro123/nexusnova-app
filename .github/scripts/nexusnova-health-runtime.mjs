import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message||String(error)));

  await page.goto(base+'/.runtime-origin.html?ref=NVX-PRIVATE123&search=secret-query');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main>
      <section id="tab-profile" class="tab"></section>
      <section id="tab-about" class="tab"></section>
    </main>
  </body></html>`);

  await page.evaluate(() => {
    localStorage.clear();
    window.__nxHealthOnline=true;
    try {
      Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__nxHealthOnline});
    } catch (_) {}
    window.switchTab=()=>{};
    window.__nexusSecureRewardsSingleOwner=true;
    window.__nxRewardsSparkV1=true;
    window.__nxWalletActionsV3=true;
    window.__nexusTop100LiveFix={refreshAll:()=>{}};
    window.nexusMarketIntegrityVersion='live-v4';
    window.__nxAllAppsSmartSearchV2=true;
    window.__nxCompleteProfileV1=true;
    window.__nxGrowthCenterV1=true;
    window.__nxOnboardingInsightsV1=true;
    window.__nxAnalyticsV1=true;
    window.__nxBugReportV1=true;
    window.nexusAppCheckReady=Promise.resolve({ready:true,message:''});
    window.__nxBugOpened=0;
    window.nexusOpenBugReport=()=>{window.__nxBugOpened+=1;};
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-health-monitor-v1.js?v=1`});
  await page.waitForFunction(()=>window.nexusHealth?.version==='local-health-v1');

  const first=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(first.status,'healthy',JSON.stringify(first));
  assert.equal(first.online,true);
  assert.equal(first.counts.active,0);
  assert.ok(first.checks.every(row=>['pass','n-a'].includes(row.status)),JSON.stringify(first.checks));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-nx-health-card]').length),2);
  console.log('PASS Health Center boots healthy with all monitored modules ready');

  await page.evaluate(() => {
    const sensitive='secret@example.com 0x1111111111111111111111111111111111111111 https://example.com/?ref=NVX-PRIVATE123 secret-query';
    window.dispatchEvent(new ErrorEvent('error',{
      message:sensitive,
      filename:location.origin+'/js/fake-runtime.js?email=secret@example.com&ref=NVX-PRIVATE123'
    }));
  });
  await page.waitForTimeout(120);
  const attention=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(attention.status,'attention');
  assert.equal(attention.counts.runtime,1);
  assert.equal(attention.counts.active,1);
  const localSerialized=await page.evaluate(()=>JSON.stringify({snapshot:window.nexusHealth.snapshot(),issues:window.nexusHealth.issues(),stored:localStorage.getItem('nexusnova_health_v1')}));
  for(const forbidden of ['secret@example.com','0x1111111111111111111111111111111111111111','example.com','nvx-private123','secret-query','?ref=']){
    assert.equal(localSerialized.toLowerCase().includes(forbidden),false,`health diagnostics leaked forbidden content: ${forbidden}`);
  }
  console.log('PASS runtime errors become generic local issue codes with no personal-content leakage');

  await page.evaluate(() => {
    window.nexusHealth.clear();
    window.dispatchEvent(new ErrorEvent('error',{
      message:'Cannot redefine property: ethereum',
      filename:'chrome-extension://example/inpage.js'
    }));
  });
  await page.waitForTimeout(100);
  const extensionNoise=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(extensionNoise.status,'healthy',JSON.stringify(extensionNoise));
  assert.equal(extensionNoise.counts.runtime,0);
  console.log('PASS known browser-wallet extension injection noise is ignored');

  await page.evaluate(() => {
    window.__nxWalletActionsV3=false;
    window.nexusHealth.clear();
  });
  const missingModule=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(missingModule.status,'attention');
  assert.equal(missingModule.checks.find(row=>row.id==='wallet')?.status,'fail');
  await page.evaluate(()=>{window.__nxWalletActionsV3=true;});
  console.log('PASS missing critical module is surfaced as ATTENTION');

  await page.evaluate(() => {
    window.nexusHealth.clear();
    window.__nxHealthOnline=false;
    window.dispatchEvent(new Event('offline'));
  });
  await page.waitForTimeout(80);
  const offline=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(offline.status,'offline');
  assert.equal(offline.online,false);
  await page.evaluate(() => {
    window.__nxHealthOnline=true;
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(160);
  const recovered=await page.evaluate(()=>window.nexusHealth.run());
  assert.equal(recovered.status,'healthy',JSON.stringify(recovered));
  console.log('PASS offline state and recovery are detected without retaining a false failure');

  await page.click('[data-nx-health-report]');
  assert.equal(await page.evaluate(()=>window.__nxBugOpened),1);
  console.log('PASS Health Center routes detailed reporting through the existing explicit Bug Report flow');

  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  console.log('\nHealth monitor runtime complete: health checks, privacy, extension-noise filtering and recovery passed.');
} finally {
  await browser.close();
}
