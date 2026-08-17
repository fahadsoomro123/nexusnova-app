import assert from 'node:assert/strict';
import { chromium } from 'playwright';

function failNow(error, title = 'Android full-page stability failure') {
  const message = String(error?.stack || error?.message || error || 'Unknown Android runtime failure').replace(/\r?\n/g, '%0A');
  console.error(`::error file=.github/scripts/nexusnova-android-fullpage-stability.mjs,line=1,title=${title}::${message}`);
  process.exit(1);
}

process.on('uncaughtException', (error) => failNow(error));
process.on('unhandledRejection', (error) => failNow(error, 'Android full-page stability rejection'));

const base = 'http://127.0.0.1:4173';
const nativePage = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&stabilityTest=1`;
const SLOW_PROBE_URL = 'https://nx-slow-probe.invalid/nonblocking-startup-probe.js';

function withDeadline(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms hard deadline`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const browser = await chromium.launch({ headless: true });

async function assertDockHitTarget(page, selector) {
  const info = await page.locator(selector).evaluate((button) => {
    const r = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    const x = Math.max(r.left + 2, Math.min(innerWidth - 2, r.left + r.width / 2));
    const y = Math.max(r.top + 2, Math.min(innerHeight - 2, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return { width:r.width, height:r.height, display:style.display, visibility:style.visibility, opacity:style.opacity, contained:Boolean(hit && (hit === button || button.contains(hit))) };
  });
  assert.ok(info.width > 20 && info.height > 20, `${selector} has no usable mobile hit box: ${JSON.stringify(info)}`);
  assert.notEqual(info.display, 'none', `${selector} is display:none: ${JSON.stringify(info)}`);
  assert.notEqual(info.visibility, 'hidden', `${selector} is hidden: ${JSON.stringify(info)}`);
  assert.ok(Number(info.opacity || 1) > 0, `${selector} is transparent: ${JSON.stringify(info)}`);
  assert.equal(info.contained, true, `${selector} is covered by another element: ${JSON.stringify(info)}`);
}

async function clickTab(page, buttonSelector, tabId) {
  await assertDockHitTarget(page, buttonSelector);
  await page.locator(buttonSelector).click({ timeout: 3000 });
  await page.waitForTimeout(100);
  assert.equal(await page.locator(tabId).evaluate((tab) => tab.classList.contains('active')), true, `${buttonSelector} did not activate ${tabId}`);
}

async function assertCoreInteraction(page, label) {
  console.log(`CHECK ${label}`);
  const ready = await page.evaluate(() => ({ native:window.__nexusAndroidShell === true, interactive:window.__nexusInteractiveReady === true, switchTab:typeof window.switchTab, toggleMore:typeof window.toggleMore, openMoreTab:typeof window.openMoreTab }));
  assert.equal(ready.native, true, `${label}: native shell marker missing`);
  assert.equal(ready.interactive, true, `${label}: interactive-ready marker missing: ${JSON.stringify(ready)}`);
  assert.equal(ready.switchTab, 'function', `${label}: switchTab missing`);
  assert.equal(ready.toggleMore, 'function', `${label}: toggleMore missing`);
  assert.equal(ready.openMoreTab, 'function', `${label}: openMoreTab missing`);
  await clickTab(page, '.bottom-dock .dock-item:nth-child(2)', '#tab-wallet');
  await clickTab(page, '.bottom-dock .dock-item:nth-child(3)', '#tab-tasks');
  await clickTab(page, '.bottom-dock .dock-item:nth-child(4)', '#tab-market');
  await assertDockHitTarget(page, '#moreBtn');
  await page.locator('#moreBtn').click({ timeout: 3000 });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#moreMenu').evaluate((menu) => menu.classList.contains('show')), true, `${label}: ALL APPS did not open`);
  await page.locator('#moreBtn').click({ timeout: 3000 });
  await page.waitForTimeout(100);
  await clickTab(page, '.bottom-dock .dock-item:nth-child(1)', '#tab-home');
  const splash = await page.evaluate(() => { const el=document.getElementById('nxSplash'); if(!el) return {removed:true}; const s=getComputedStyle(el); return {removed:false,pointerEvents:s.pointerEvents,visibility:s.visibility,opacity:s.opacity,display:s.display}; });
  assert.ok(splash.removed || splash.pointerEvents === 'none' || splash.visibility === 'hidden' || splash.display === 'none' || Number(splash.opacity) === 0, `${label}: splash still blocks touch: ${JSON.stringify(splash)}`);
}

async function runScenarioBody(name, slowProbeDelayMs) {
  console.log(`START ${name}`);
  const context = await browser.newContext({ viewport:{width:393,height:873}, userAgent:'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaStabilityTest', serviceWorkers:'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(12000);
  const severeErrors = [];
  const blockedAuthRedirects = [];
  try {
    page.on('pageerror', (error) => { const message=String(error?.message || error || ''); if (/Failed to fetch dynamically imported module|Importing a module script failed|ERR_FAILED|fetch/i.test(message)) return; severeErrors.push(message); });
    await page.route('**/*', async (route) => {
      const request=route.request(); const url=new URL(request.url());
      if(url.origin === base){
        if(request.isNavigationRequest() && /\/index\.html$/.test(url.pathname)){ blockedAuthRedirects.push(url.href); return route.abort('aborted'); }
        return route.continue();
      }
      if(url.href === SLOW_PROBE_URL && slowProbeDelayMs > 0){ await new Promise((resolve)=>setTimeout(resolve,slowProbeDelayMs)); return route.abort('failed'); }
      return route.abort('failed');
    });
    const response = await page.goto(nativePage, { waitUntil:'domcontentloaded', timeout:12000 });
    assert.equal(response?.status(), 200, `${name}: prepared Android shell returned HTTP ${response?.status()}`);
    try {
      await page.locator('#moreBtn').waitFor({ state:'attached', timeout:5000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({ href:location.href, readyState:document.readyState, title:document.title, hasBody:Boolean(document.body), bodyChars:document.body?.textContent?.length || 0, bodyStart:(document.body?.innerText || '').slice(0,160), hasSplash:Boolean(document.getElementById('nxSplash')), hasDock:Boolean(document.querySelector('.bottom-dock')), hasMore:Boolean(document.getElementById('moreBtn')), native:window.__nexusAndroidShell === true, interactive:window.__nexusInteractiveReady === true })).catch(() => ({href:page.url()}));
      throw new Error(`${name}: #moreBtn missing. diagnostic=${JSON.stringify(diagnostic)} blockedAuthRedirects=${JSON.stringify(blockedAuthRedirects)} cause=${error?.message || error}`);
    }
    assert.ok(page.url().includes('/page2.html'), `${name}: dashboard navigation escaped to ${page.url()}; auth redirects=${JSON.stringify(blockedAuthRedirects)}`);
    if(slowProbeDelayMs > 0){ await page.evaluate((src)=>{ const script=document.createElement('script'); script.async=true; script.src=src; script.dataset.nxSlowDependencyProbe='1'; document.head.appendChild(script); }, SLOW_PROBE_URL); }
    await page.waitForTimeout(2800); await assertCoreInteraction(page, `${name}:3s`);
    await page.waitForTimeout(3500); await assertCoreInteraction(page, `${name}:7s`);
    await page.waitForTimeout(5500); await assertCoreInteraction(page, `${name}:12s`);
    const registrations = await page.evaluate(async () => { if(!('serviceWorker' in navigator)) return []; const regs=await Promise.race([navigator.serviceWorker.getRegistrations(),new Promise((resolve)=>setTimeout(()=>resolve([]),1200))]); return regs.map ? regs.map((r)=>r.scope) : []; });
    assert.deepEqual(registrations, [], `${name}: Android shell must not register a web service worker`);
    assert.deepEqual(severeErrors, [], `${name}: severe page errors: ${severeErrors.join(' | ')}`);
    console.log(`PASS ${name}: full Android page remains touchable with the real NexusNova module stack.`);
  } finally {
    await Promise.race([context.close().catch(()=>{}),new Promise((resolve)=>setTimeout(resolve,2500))]);
  }
}

async function runScenario(name, slowProbeDelayMs){ return withDeadline(runScenarioBody(name,slowProbeDelayMs),45000,name); }

try {
  await runScenario('external-network-blocked',0);
  await runScenario('background-dependency-very-slow',8000);
  await Promise.race([browser.close(),new Promise((resolve)=>setTimeout(resolve,3000))]);
  console.log('PASS NexusNova Android full-page stability regression: Wallet, Tasks, Market and ALL APPS remain interactive with remote traffic blocked and an 8-second non-blocking dependency in flight.');
  process.exit(0);
} catch(error){ try{await Promise.race([browser.close(),new Promise((resolve)=>setTimeout(resolve,3000))]);}catch(_){} failNow(error); }
