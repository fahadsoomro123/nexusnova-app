import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message||String(error)));

try {
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main class="main">
      <section id="tab-home" class="tab active"><div class="stats-grid"></div></section>
      <section id="tab-profile" class="tab"><div class="card">Profile</div></section>
    </main>
    <div id="moreMenu"><div class="more-inner"></div></div>
    <nav><button class="dock-item active">Mine</button></nav>
  </body></html>`);

  await page.addScriptTag({url:base+'/js/nexusnova-community-progress-v1.js?v=1'});
  await page.waitForSelector('#nxLeaderboardMenuBtn');
  await page.waitForSelector('#nxProgressMini');
  await page.waitForSelector('#tab-leaderboard');

  assert.equal(await page.textContent('#nxLeaderboardMenuBtn').then(t=>/LEADERBOARD/i.test(t)),true);
  assert.equal(await page.textContent('#nxProgressMini').then(t=>/Progress/i.test(t)),true);
  assert.equal(await page.locator('#nxBadgeGrid .nx-badge').count(),0,'badges should wait for secure profile data');

  await page.click('#nxLeaderboardMenuBtn');
  assert.equal(await page.locator('#tab-leaderboard').evaluate(el=>el.classList.contains('active')),true);
  assert.equal(await page.locator('#tab-home').evaluate(el=>el.classList.contains('active')),false);
  assert.match(await page.textContent('#tab-leaderboard'),/Privacy Safe/i);
  assert.match(await page.textContent('#tab-leaderboard'),/Top 50/i);

  const source=await (await fetch(base+'/js/nexusnova-community-progress-v1.js')).text();
  assert.match(source,/leaderboardPublic/);
  assert.match(source,/totalMined/);
  assert.match(source,/dailyRewardStreak/);
  assert.doesNotMatch(source,/function publicShape\([^)]*\)[\s\S]{0,500}\bemail\s*:/i);
  assert.doesNotMatch(source,/function publicShape\([^)]*\)[\s\S]{0,500}\bbalance\s*:/i);
  assert.doesNotMatch(source,/function publicShape\([^)]*\)[\s\S]{0,500}\buid\s*:/i);

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Community League UI + privacy-safe public mirror structure');
} finally {
  await browser.close();
}
