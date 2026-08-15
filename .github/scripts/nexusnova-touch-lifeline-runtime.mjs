import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Reproduce the mobile failure mode: Firebase/GStatic is unavailable or too slow,
// but the visible NexusNova shell has already rendered.
await page.route('https://www.gstatic.com/**', route => route.abort('failed'));
await page.goto(base + '/.runtime-origin.html');
await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
.tab{display:none}.tab.active{display:block}.more-menu{display:none}.more-menu.show{display:block}
#nxSplash{position:fixed;inset:0;z-index:99;background:#020712}
</style></head><body>
<div id="nxSplash">NexusNova</div>
<section id="tab-home" class="tab active">HOME</section>
<section id="tab-wallet" class="tab">WALLET</section>
<section id="tab-tasks" class="tab">TASKS</section>
<section id="tab-market" class="tab">MARKET</section>
<section id="tab-tools" class="tab">TOOLS</section>
<div id="moreMenu" class="more-menu"><button id="openTools" onclick="openMoreTab('tools')">TOOLS</button></div>
<nav class="bottom-dock"><div class="dock-inner">
<button id="navMine" class="dock-item active" onclick="switchTab('home',this)">Mine</button>
<button id="navWallet" class="dock-item" onclick="switchTab('wallet',this)">Wallet</button>
<button id="navTasks" class="dock-item" onclick="switchTab('tasks',this)">Tasks</button>
<button id="navMarket" class="dock-item" onclick="switchTab('market',this)">Market</button>
<button id="moreBtn" class="dock-item" onclick="toggleMore()">ALL APPS</button>
</div></nav>
</body></html>`);

await page.addScriptTag({ url: `${base}/js/core-failsafe.js?touch-lifeline-test=1` });

assert.equal(await page.evaluate(() => typeof window.switchTab), 'function');
assert.equal(await page.evaluate(() => typeof window.toggleMore), 'function');
assert.equal(await page.evaluate(() => typeof window.openMoreTab), 'function');

// These clicks must work immediately, without waiting for Firebase imports.
await page.click('#navWallet');
assert.equal(await page.evaluate(() => document.getElementById('tab-wallet').classList.contains('active')), true);
assert.equal(await page.evaluate(() => document.getElementById('navWallet').classList.contains('active')), true);

await page.click('#navTasks');
assert.equal(await page.evaluate(() => document.getElementById('tab-tasks').classList.contains('active')), true);

await page.click('#navMarket');
assert.equal(await page.evaluate(() => document.getElementById('tab-market').classList.contains('active')), true);

await page.click('#moreBtn');
assert.equal(await page.evaluate(() => document.getElementById('moreMenu').classList.contains('show')), true);

await page.click('#openTools');
assert.equal(await page.evaluate(() => document.getElementById('tab-tools').classList.contains('active')), true);
assert.equal(await page.evaluate(() => document.getElementById('moreMenu').classList.contains('show')), false);

// The splash may animate, but it must never remain an invisible touch shield.
await page.waitForTimeout(2800);
const splashState = await page.evaluate(() => {
  const splash = document.getElementById('nxSplash');
  if (!splash) return { removed: true, pointerEvents: 'none', visibility: 'hidden' };
  const style = getComputedStyle(splash);
  return { removed: false, pointerEvents: style.pointerEvents, visibility: style.visibility };
});
assert.ok(
  splashState.removed || splashState.pointerEvents === 'none' || splashState.visibility === 'hidden',
  `Splash still blocks touch: ${JSON.stringify(splashState)}`
);

// Re-check after the failed Firebase attempt: UI lifeline must still be alive.
await page.click('#navWallet');
assert.equal(await page.evaluate(() => document.getElementById('tab-wallet').classList.contains('active')), true);

console.log('PASS NexusNova frozen-startup touch lifeline — core navigation and ALL APPS remain usable with Firebase/GStatic blocked.');
await browser.close();
