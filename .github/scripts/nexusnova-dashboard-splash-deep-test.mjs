import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pageUrl = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&deepSplashTest=1`;
const startedAt = Date.now();

function stage(name) {
  console.log(`STAGE +${Date.now() - startedAt}ms ${name}`);
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
  console.error(`FAIL Android dashboard startup proof: hard 45s watchdog expired at +${Date.now() - startedAt}ms.`);
  process.exit(124);
}, 45_000);
hardWatchdog.unref();

let browser;
let context;
let page;
let failure = null;

try {
  stage('launch chromium');
  browser = await bounded(chromium.launch({ headless:true }), 7000, 'chromium.launch');
  context = await bounded(browser.newContext({
    viewport: { width:393, height:873 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaDeepStartupProof',
    serviceWorkers: 'block',
  }), 4000, 'browser.newContext');
  page = await bounded(context.newPage(), 4000, 'context.newPage');
  page.setDefaultTimeout(6000);

  // This is deliberately harsher than normal use: only the staged APK shell is
  // reachable. Firebase/CDNs/news/ads are blocked so no external response can
  // be the thing that releases the dashboard or keeps its event loop alive.
  await page.route('**/*', async route => {
    try {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      return route.abort('failed');
    } catch (_) {
      return route.abort('failed');
    }
  });

  const pageErrors = [];
  const navigations = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error || '')));
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  stage('goto staged Android dashboard');
  const response = await bounded(
    page.goto(pageUrl, { waitUntil:'commit', timeout:9000 }),
    10000,
    'page.goto'
  );
  assert.equal(response?.status(), 200, `dashboard HTTP status was ${response?.status()}`);

  await bounded(
    page.waitForFunction(() => Boolean(document.getElementById('mineBtn')), null, { timeout:5000 }),
    6000,
    'mineBtn DOM wait'
  );

  async function snapshot(label, { expectWatchGuard = false } = {}) {
    stage(`snapshot ${label} begin`);
    const state = await bounded(page.evaluate(() => {
      const splash = document.getElementById('nxSplash');
      const shield = document.getElementById('nxSecureStartupShieldV3');
      const mine = document.getElementById('mineBtn');
      const home = document.getElementById('tab-home');
      const dock = document.querySelector('.bottom-dock');
      const watch = document.querySelector('#tab-tasks button[onclick*="watchAdReward"]');
      const splashStyle = splash ? getComputedStyle(splash) : null;
      const shieldStyle = shield ? getComputedStyle(shield) : null;
      const mineRect = mine?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      const visibleDock = Array.from(document.querySelectorAll('.bottom-dock .dock-item')).filter(button => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return button.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 20 && rect.height > 20;
      });
      return {
        href: location.href,
        readyState: document.readyState,
        android: window.__nexusAndroidShell === true,
        splashBlocking: Boolean(splash && splashStyle && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden' && Number(splashStyle.opacity) > 0 && splashStyle.pointerEvents !== 'none'),
        splashDisplay: String(splashStyle?.display || ''),
        shieldExists: Boolean(shield),
        shieldBlocking: Boolean(shield && shieldStyle && shieldStyle.display !== 'none' && shieldStyle.visibility !== 'hidden' && Number(shieldStyle.opacity) > 0 && shieldStyle.pointerEvents !== 'none'),
        homeActive: Boolean(home?.classList.contains('active')),
        homeContainsMine: Boolean(home && mine && home.contains(mine)),
        mineVisible: Boolean(mineRect && mineRect.width > 100 && mineRect.height > 40),
        dockVisible: Boolean(dockRect && dockRect.width > 100 && dockRect.height > 20),
        visibleDockCount: visibleDock.length,
        visibleDockLabels: visibleDock.map(button => String(button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g,' ').trim()),
        balance: String(document.getElementById('balance')?.textContent || '').trim(),
        btnText: String(document.getElementById('btnText')?.textContent || '').trim(),
        timer: String(document.getElementById('timer')?.textContent || '').trim(),
        watchExists: Boolean(watch),
        watchId: String(watch?.id || ''),
        watchOnclick: String(watch?.getAttribute('onclick') || ''),
      };
    }), 2500, `snapshot ${label} evaluate`);

    console.log(`SNAPSHOT ${label} ${JSON.stringify({...state,navigations})}`);
    assert.match(state.href, /\/page2\.html(?:\?|$)/, `${label}: dashboard navigated away; history=${navigations.join(' -> ')}`);
    assert.equal(state.android, true, `${label}: Android shell marker missing`);
    assert.equal(state.splashBlocking, false, `${label}: HTML splash is blocking`);
    assert.equal(state.shieldBlocking, false, `${label}: secondary startup shield is blocking`);
    assert.equal(state.shieldExists, false, `${label}: Android created a secondary startup shield`);
    assert.equal(state.homeContainsMine, true, `${label}: Mine control left tab-home`);
    assert.equal(state.homeActive, true, `${label}: Mining screen is not active`);
    assert.equal(state.mineVisible, true, `${label}: Mine control is not visible`);
    assert.equal(state.dockVisible, true, `${label}: bottom dock is not visible`);
    assert.equal(state.visibleDockCount, 2, `${label}: approved Mine + Nova Hub dock is not the only visible dock pair`);
    assert.notEqual(state.balance, '0.0000', `${label}: stale 0.0000 balance exposed`);

    if (expectWatchGuard && state.watchExists) {
      assert.equal(state.watchId, 'nxWatchAdRewardBtn', `${label}: Tasks rewarded button ownership regressed`);
      assert.equal(state.watchOnclick, 'watchAdReward()', `${label}: Tasks rewarded button handler regressed`);
    }
    stage(`snapshot ${label} passed`);
  }

  // IMPORTANT: this test never invokes any splash release/hide/remove helper.
  // 1s is specifically past the old hotfix-v2 200/500ms observer-loop window.
  await page.waitForTimeout(150);
  await snapshot('150ms');
  await page.waitForTimeout(850);
  await snapshot('1s', { expectWatchGuard:true });
  await page.waitForTimeout(2000);
  await snapshot('3s', { expectWatchGuard:true });
  await page.waitForTimeout(5000);
  await snapshot('8s', { expectWatchGuard:true });

  // The approved phone-confirmed Nova Hub navigation deliberately exposes only
  // Mine + Nova Hub in the dock. Wallet/Market live inside Nova Hub, so test the
  // real navigation instead of clicking a hidden legacy Wallet dock button.
  stage('open Nova Hub');
  const hubButton = page.locator('#moreBtn');
  await bounded(hubButton.click({ timeout:4500 }), 5500, 'Nova Hub dock click');
  await bounded(
    page.waitForFunction(() => {
      const menu = document.getElementById('moreMenu');
      if (!menu) return false;
      const style = getComputedStyle(menu);
      return menu.classList.contains('show') || document.body.classList.contains('nx-allapps-open') || (style.display !== 'none' && style.visibility !== 'hidden');
    }, null, { timeout:3000 }),
    4000,
    'Nova Hub open wait'
  );

  stage('open Wallet from Nova Hub');
  const hubWallet = page.locator('#moreMenu [data-nx-nova-hub-target="wallet"]');
  await bounded(hubWallet.click({ timeout:4500 }), 5500, 'Nova Hub Wallet click');
  await bounded(
    page.waitForFunction(() => document.getElementById('tab-wallet')?.classList.contains('active') === true, null, { timeout:3000 }),
    4000,
    'Wallet active wait'
  );

  const walletState = await bounded(page.evaluate(() => ({
    walletActive: document.getElementById('tab-wallet')?.classList.contains('active') === true,
    hubDockActive: document.getElementById('moreBtn')?.classList.contains('active') === true,
    splashBlocking: (() => {
      const splash = document.getElementById('nxSplash');
      if (!splash) return false;
      const style = getComputedStyle(splash);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && style.pointerEvents !== 'none';
    })(),
  })), 2500, 'Wallet state evaluate');
  console.log(`WALLET_STATE ${JSON.stringify(walletState)}`);
  assert.equal(walletState.walletActive, true, 'Wallet did not open from Nova Hub');
  assert.equal(walletState.hubDockActive, true, 'Nova Hub dock state did not follow Wallet');
  assert.equal(walletState.splashBlocking, false, 'Splash returned after Wallet navigation');

  stage('return to Mine');
  const mineDock = page.locator('.bottom-dock .dock-item[data-nx-nova-hub-primary="1"]:not(#moreBtn)');
  await bounded(mineDock.click({ timeout:4500 }), 5500, 'Mine dock click');
  await bounded(
    page.waitForFunction(() => document.getElementById('tab-home')?.classList.contains('active') === true, null, { timeout:3000 }),
    4000,
    'Mine active wait'
  );
  await page.waitForTimeout(1200);
  await snapshot('after-hub-wallet-mine', { expectWatchGuard:true });

  const severe = pageErrors.filter(text => !/Failed to fetch|ERR_FAILED|dynamically imported module|Importing a module script failed|NetworkError/i.test(text));
  assert.deepEqual(severe, [], `unexpected severe page errors: ${severe.join(' | ')}`);

  stage('PASS');
  console.log('PASS Android dashboard startup proof: full staged shell remained responsive, splash/shield never blocked, stale zero stayed masked, Tasks ad guard stayed stable, and approved Mine -> Nova Hub -> Wallet -> Mine navigation worked with external network blocked.');
} catch (error) {
  failure = error;
  console.error(`FAIL Android dashboard startup proof at +${Date.now() - startedAt}ms: ${error?.stack || error}`);
} finally {
  clearTimeout(hardWatchdog);
  try { if (context) await bounded(context.close(), 1800, 'context.close'); } catch (_) {}
  try { if (browser) await bounded(browser.close(), 1800, 'browser.close'); } catch (_) {}
}

if (failure) process.exit(1);
