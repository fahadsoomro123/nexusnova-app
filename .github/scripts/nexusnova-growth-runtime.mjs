import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();

try {
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="moreMenu"><div class="more-inner"></div></div>
    <main class="main">
      <section id="tab-home" class="tab active"></section>
      <section id="tab-profile" class="tab"></section>
      <section id="tab-tasks" class="tab"></section>
    </main>
  </body></html>`);
  await page.addScriptTag({url:`${base}/js/nexusnova-growth-center-v1.js?v=1`});
  await page.waitForSelector('#tab-growth');
  await page.waitForSelector('#nxGrowthMenuBtn');
  await page.waitForSelector('#nxGrowthMini');
  await page.waitForSelector('#nxMissionMiniTasks');

  assert.equal(await page.evaluate(()=>window.nexusGrowthCenterVersion),'growth-v1');
  const growthText=await page.textContent('#tab-growth');
  assert.match(growthText,/Referral Center/i);
  assert.match(growthText,/Mission Center/i);
  assert.match(growthText,/Reward Activity/i);
  assert.match(growthText,/referral NVX rewards are intentionally OFF/i);
  console.log('PASS Growth Center UI + profile/tasks integration rendered');

  await page.evaluate(()=>{
    window.__copiedReferral='';
    Object.defineProperty(navigator,'clipboard',{
      configurable:true,
      value:{writeText:async value=>{window.__copiedReferral=String(value);}}
    });
    document.getElementById('nxReferralCode').textContent='NVX-ABCDEFGH';
  });
  await page.addScriptTag({url:`${base}/js/nexusnova-growth-referral-link-v1.js?v=1`});
  await page.click('#nxCopyReferral');
  await page.waitForFunction(()=>window.__copiedReferral.includes('referral.html?ref=NVX-ABCDEFGH'));
  const copied=await page.evaluate(()=>window.__copiedReferral);
  assert.equal(copied,`${base}/referral.html?ref=NVX-ABCDEFGH`);
  console.log('PASS Growth referral copy routes through referral landing page');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.close();

  const landing=await context.newPage();
  await landing.goto(`${base}/referral.html?ref=NVX-ABCDEFGH`);
  await landing.waitForURL('**/index.html',{timeout:5000});
  const stored=await landing.evaluate(()=>localStorage.getItem('nexusnova_pending_referral_v1'));
  assert.equal(stored,'NVX-ABCDEFGH');
  console.log('PASS referral landing persists invite code before signup redirect');
  await landing.close();

  console.log('\nGrowth runtime complete: UI, invite link and landing capture passed.');
} finally {
  await browser.close();
}
