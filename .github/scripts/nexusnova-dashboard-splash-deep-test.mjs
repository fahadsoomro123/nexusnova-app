import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pageUrl = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&deepSplashTest=1`;
const startedAt = Date.now();

function stage(name, extra = '') {
  const elapsed = Date.now() - startedAt;
  console.log(`STAGE +${elapsed}ms ${name}${extra ? ` :: ${extra}` : ''}`);
}

function timeoutAfter(ms, label) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
}

async function bounded(promise, ms, label) {
  return Promise.race([promise, timeoutAfter(ms, label)]);
}

const hardWatchdog = setTimeout(() => {
  console.error(`FAIL Android dashboard startup deep test: hard 45s watchdog expired at +${Date.now() - startedAt}ms.`);
  process.exit(124);
}, 45_000);
hardWatchdog.unref();

let browser;
let context;
let page;
let failure = null;

try {
  stage('launch chromium');
  browser = await bounded(chromium.launch({ headless: true }), 8000, 'chromium.launch');

  stage('create Android-sized context');
  context = await bounded(browser.newContext({
    viewport: { width: 393, height: 873 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaDeepSplashTest',
    serviceWorkers: 'block',
  }), 5000, 'browser.newContext');

  page = await bounded(context.newPage(), 5000, 'context.newPage');
  page.setDefaultTimeout(7000);

  await page.route('**/*', async route => {
    try {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      return route.abort('failed');
    } catch (_) {
      return route.abort('failed');
    }
  });

  const errors = [];
  const navigations = [];
  page.on('pageerror', error => errors.push(String(error?.message || error || '')));
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.on('console', msg => {
    const text = String(msg.text() || '').slice(0, 500);
    if (/NexusNova|startup|splash|mining|firebase|auth/i.test(text)) {
      console.log(`BROWSER ${msg.type()} ${text}`);
    }
  });

  stage('goto dashboard');
  const response = await bounded(
    page.goto(pageUrl, { waitUntil: 'commit', timeout: 10000 }),
    12000,
    'page.goto'
  );
  assert.equal(response?.status(), 200, `dashboard HTTP status was ${response?.status()}`);

  stage('wait mineBtn DOM');
  await bounded(
    page.waitForFunction(() => Boolean(document.getElementById('mineBtn')), null, { timeout: 7000 }),
    8500,
    'mineBtn DOM wait'
  );

  stage('trace mineBtn ownership');
  const ownership = await bounded(page.evaluate(() => {
    const mine = document.getElementById('mineBtn');
    const home = document.getElementById('tab-home');
    const chain = [];
    let node = mine;
    for (let i = 0; node && i < 9; i += 1, node = node.parentElement) {
      chain.push({
        tag: String(node.tagName || '').toLowerCase(),
        id: String(node.id || ''),
        className: String(node.className || '').slice(0, 240),
      });
    }
    return {
      mineConnected: Boolean(mine?.isConnected),
      mineCount: document.querySelectorAll('#mineBtn').length,
      mineOuter: String(mine?.outerHTML || '').slice(0, 700),
      homeExists: Boolean(home),
      homeClass: String(home?.className || ''),
      homeContainsMine: Boolean(home && mine && home.contains(mine)),
      closestTabId: String(mine?.closest?.('.tab')?.id || ''),
      chain,
      homeOuterStart: String(home?.outerHTML || '').slice(0, 1600),
    };
  }), 5000, 'mineBtn ownership trace');
  console.log(`OWNERSHIP ${JSON.stringify(ownership)}`);

  async function snapshot(label) {
    stage(`snapshot ${label} begin`);
    const state = await bounded(page.evaluate(() => {
      const splash = document.getElementById('nxSplash');
      const shield = document.getElementById('nxSecureStartupShieldV3');
      const mine = document.getElementById('mineBtn');
      const home = document.getElementById('tab-home');
      const miningTab = mine?.closest?.('.tab') || null;
      const dock = document.querySelector('.bottom-dock');
      const splashStyle = splash ? getComputedStyle(splash) : null;
      const shieldStyle = shield ? getComputedStyle(shield) : null;
      const mineRect = mine?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      return {
        href: location.href,
        android: window.__nexusAndroidShell === true,
        readyState: document.readyState,
        splashBlocking: Boolean(splash && splashStyle && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden' && Number(splashStyle.opacity) > 0 && splashStyle.pointerEvents !== 'none'),
        splashDisplay: String(splashStyle?.display || ''),
        splashPointerEvents: String(splashStyle?.pointerEvents || ''),
        shieldExists: Boolean(shield),
        shieldBlocking: Boolean(shield && shieldStyle && shieldStyle.display !== 'none' && shieldStyle.visibility !== 'hidden' && Number(shieldStyle.opacity) > 0 && shieldStyle.pointerEvents !== 'none'),
        miningTabId: String(miningTab?.id || ''),
        homeExists: Boolean(home),
        homeContainsMine: Boolean(home && mine && home.contains(mine)),
        homeActive: Boolean(home?.classList.contains('active')),
        mineVisible: Boolean(mineRect && mineRect.width > 100 && mineRect.height > 40),
        dockVisible: Boolean(dockRect && dockRect.width > 100 && dockRect.height > 20),
        balance: String(document.getElementById('balance')?.textContent || '').trim(),
        btnText: String(document.getElementById('btnText')?.textContent || '').trim(),
        timer: String(document.getElementById('timer')?.textContent || '').trim(),
      };
    }), 5000, `snapshot ${label} page.evaluate`);
    console.log(`SNAPSHOT ${label} ${JSON.stringify({...state,navigations})}`);
    assert.match(state.href, /\/page2\.html(?:\?|$)/, `${label}: dashboard unexpectedly navigated away; history=${navigations.join(' -> ')}`);
    assert.equal(state.android, true, `${label}: Android shell marker missing`);
    assert.equal(state.splashBlocking, false, `${label}: HTML splash is blocking`);
    assert.equal(state.shieldBlocking, false, `${label}: secondary shield is blocking`);
    assert.equal(state.shieldExists, false, `${label}: Android created a secondary startup shield`);
    assert.equal(state.homeExists, true, `${label}: tab-home missing`);
    assert.equal(state.homeContainsMine, true, `${label}: mining button is no longer contained by tab-home`);
    assert.equal(state.homeActive, true, `${label}: mining screen is not active`);
    assert.equal(state.mineVisible, true, `${label}: mining control is not visible`);
    assert.equal(state.dockVisible, true, `${label}: bottom dock is not visible`);
    assert.notEqual(state.balance, '0.0000', `${label}: stale 0.0000 balance exposed`);
    stage(`snapshot ${label} passed`);
  }

  // IMPORTANT: this test never calls a release/hide/remove helper for nxSplash.
  await page.waitForTimeout(150);
  await snapshot('150ms');
  await page.waitForTimeout(2850);
  await snapshot('3s');
  await page.waitForTimeout(5000);
  await snapshot('8s');

  stage('navigate dock to wallet');
  await bounded(page.locator('.bottom-dock .dock-item:nth-child(2)').click({ timeout: 5000 }), 6500, 'wallet dock click');
  await bounded(
    page.waitForFunction(() => document.getElementById('tab-wallet')?.classList.contains('active') === true, null, { timeout: 3000 }),
    4500,
    'wallet active wait'
  );

  stage('navigate dock back home');
  await bounded(page.locator('.bottom-dock .dock-item:nth-child(1)').click({ timeout: 5000 }), 6500, 'home dock click');
  await bounded(
    page.waitForFunction(() => document.getElementById('tab-home')?.classList.contains('active') === true, null, { timeout: 3000 }),
    4500,
    'home active wait'
  );
  await page.waitForTimeout(4000);
  await snapshot('12s-after-navigation');

  const severe = errors.filter(text => !/Failed to fetch|ERR_FAILED|dynamically imported module|Importing a module script failed/i.test(text));
  assert.deepEqual(severe, [], `unexpected severe page errors: ${severe.join(' | ')}`);

  stage('PASS');
  console.log('PASS Android dashboard startup deep test: no blocking splash/shield, no stale zero, dashboard touchable with external network blocked.');
} catch (error) {
  failure = error;
  console.error(`FAIL Android dashboard startup deep test at +${Date.now() - startedAt}ms: ${error?.stack || error}`);
} finally {
  clearTimeout(hardWatchdog);
  stage('cleanup begin');
  try { if (context) await bounded(context.close(), 2000, 'context.close'); } catch (error) { console.error(`CLEANUP context: ${error?.message || error}`); }
  try { if (browser) await bounded(browser.close(), 2000, 'browser.close'); } catch (error) { console.error(`CLEANUP browser: ${error?.message || error}`); }
  stage('cleanup end');
}

if (failure) process.exit(1);
