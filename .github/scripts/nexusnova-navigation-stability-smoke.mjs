import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message || String(error)));

try {
  await page.goto(base + '/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;min-height:100%;background:#07101d;color:white}
    .tab{display:none}.tab.active{display:block}
    .more-menu{position:fixed;inset:0 0 70px;display:none;overflow:auto;background:#07101d;z-index:190}
    .more-menu.show{display:block}
    .bottom-dock{position:fixed;left:0;right:0;bottom:0;height:70px;display:flex;background:#020914;z-index:200}
    .dock-item{flex:1}.dock-item.active{font-weight:900}
    .nx-allapps-back{display:flex}
  </style></head><body>
    <main class="main">
      <section id="tab-home" class="tab active"><h2>Mine</h2></section>
      <section id="tab-wallet" class="tab"><h2>Wallet</h2></section>
      <section id="tab-tasks" class="tab"><h2>Tasks</h2></section>
      <section id="tab-market" class="tab"><h2>Market</h2></section>
      <section id="tab-mega-weather" class="tab"><h2>Weather</h2></section>
    </main>
    <div id="moreMenu" class="more-menu"><div class="more-inner" style="height:1600px">
      <button class="more-item" data-nxmega="mega-weather" onclick="openMoreTab('mega-weather')" type="button"><span>WEATHER</span></button>
    </div></div>
    <nav class="bottom-dock">
      <button class="dock-item active" onclick="switchTab('home',this)" type="button">MINE</button>
      <button class="dock-item" onclick="switchTab('wallet',this)" type="button">WALLET</button>
      <button class="dock-item" onclick="switchTab('tasks',this)" type="button">TASKS</button>
      <button class="dock-item" onclick="switchTab('market',this)" type="button">MARKET</button>
      <button class="dock-item" id="moreBtn" onclick="toggleMore()" type="button">ALL APPS</button>
    </nav>
  </body></html>`);

  // Reproduce the old core behavior: switchTab changes the tab/dock state but
  // does NOT close the ALL APPS overlay. This is the exact Android-stuck bug.
  await page.evaluate(() => {
    window.switchTab = function(name, button) {
      const tab = document.getElementById('tab-' + name);
      if (!tab) return false;
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.dock-item').forEach(x => x.classList.remove('active'));
      button?.classList.add('active');
      return true;
    };
    window.openMoreTab = function(name) {
      document.getElementById('moreMenu')?.classList.remove('show');
      return window.switchTab(name, null);
    };
    window.toggleMore = function() {
      document.getElementById('moreMenu')?.classList.toggle('show');
    };
  });

  await page.addScriptTag({ url: `${base}/js/nexusnova-navigation-stability-v1.js?v=1` });
  await page.waitForFunction(() => window.__nxNavigationStabilityV1 === true);

  // Open ALL APPS using the real bottom button.
  await page.click('#moreBtn');
  await page.waitForFunction(() => document.body.classList.contains('nx-allapps-open'));
  assert.notEqual(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');

  // Regression #1: Wallet must escape ALL APPS, not only turn the icon blue.
  await page.click('.bottom-dock .dock-item:nth-child(2)');
  await page.waitForFunction(() => document.getElementById('tab-wallet')?.classList.contains('active'));
  assert.equal(await page.evaluate(() => document.body.classList.contains('nx-allapps-open')), false);
  assert.equal(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');
  assert.equal(await page.$eval('.bottom-dock .dock-item:nth-child(2)', el => el.classList.contains('active')), true);

  // Regression #2: same escape path must survive repeated fast tab changes.
  await page.click('#moreBtn');
  await page.click('.bottom-dock .dock-item:nth-child(3)');
  await page.waitForFunction(() => document.getElementById('tab-tasks')?.classList.contains('active'));
  assert.equal(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');

  await page.click('#moreBtn');
  await page.click('.bottom-dock .dock-item:nth-child(4)');
  await page.waitForFunction(() => document.getElementById('tab-market')?.classList.contains('active'));
  assert.equal(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');

  // Regression #3: every All Apps feature gets a real Back to ALL APPS button.
  await page.click('#moreBtn');
  await page.click('#moreMenu .more-item');
  await page.waitForFunction(() => document.getElementById('tab-mega-weather')?.classList.contains('active'));
  await page.waitForSelector('#tab-mega-weather > .nx-allapps-back [data-nx-back-allapps]', { state: 'attached' });
  assert.equal(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');

  await page.click('#tab-mega-weather > .nx-allapps-back [data-nx-back-allapps]');
  await page.waitForFunction(() => document.body.classList.contains('nx-allapps-open'));
  assert.notEqual(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');
  assert.equal(await page.$eval('#moreBtn', el => el.classList.contains('active')), true);

  // Regression #4: late scripts may replace switchTab; capture navigation must
  // still close the overlay before invoking whatever switchTab exists now.
  await page.evaluate(() => {
    window.switchTab = function(name, button) {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.getElementById('tab-' + name)?.classList.add('active');
      button?.classList.add('active');
      return true;
    };
  });
  await page.click('.bottom-dock .dock-item:nth-child(1)');
  await page.waitForFunction(() => document.getElementById('tab-home')?.classList.contains('active'));
  assert.equal(await page.$eval('#moreMenu', el => getComputedStyle(el).display), 'none');
  assert.equal(await page.evaluate(() => document.body.classList.contains('nx-allapps-open')), false);

  const scrollPolish = await page.evaluate(() => {
    const menu = document.getElementById('moreMenu');
    document.body.classList.add('nx-allapps-open');
    menu.classList.add('show');
    menu.style.removeProperty('display');
    const style = getComputedStyle(menu);
    return {
      touchAction: style.touchAction,
      overflowY: style.overflowY,
      hasStyle: Boolean(document.getElementById('nxNavigationStabilityStylesV1'))
    };
  });
  assert.equal(scrollPolish.hasStyle, true);
  assert.match(scrollPolish.touchAction, /pan-y|auto/);
  assert.match(scrollPolish.overflowY, /auto|scroll/);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));

  console.log('PASS navigation stability: ALL APPS dock escape, universal Back, late-wrapper resilience and mobile scroll polish verified.');
} finally {
  await browser.close();
}
