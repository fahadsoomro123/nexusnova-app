import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pageUrl = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&deepSplashTest=1`;

const hardWatchdog = setTimeout(() => {
  console.error('FAIL Android dashboard startup deep test: hard 45s watchdog expired.');
  process.exit(124);
}, 45_000);
hardWatchdog.unref();

let browser;
let context;

try {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 393, height: 873 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaDeepSplashTest',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    return route.abort('failed');
  });

  const errors = [];
  const navigations = [];
  page.on('pageerror', error => errors.push(String(error?.message || error || '')));
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  const response = await page.goto(pageUrl, { waitUntil: 'commit', timeout: 10000 });
  assert.equal(response?.status(), 200, `dashboard HTTP status was ${response?.status()}`);

  // Use a DOM predicate rather than locator stability: if code keeps navigating
  // or replacing the document, the next snapshot reports the exact URL/history
  // instead of producing an ambiguous "resolved but timed out" locator error.
  await page.waitForFunction(() => Boolean(document.getElementById('mineBtn')), null, { timeout: 7000 });
  await page.waitForFunction(() => Boolean(document.getElementById('mineBtn')?.closest('.tab')), null, { timeout: 7000 });

  async function snapshot(label) {
    const state = await page.evaluate(() => {
      const splash = document.getElementById('nxSplash');
      const shield = document.getElementById('nxSecureStartupShieldV3');
      const mine = document.getElementById('mineBtn');
      const miningTab = mine?.closest('.tab') || null;
      const dock = document.querySelector('.bottom-dock');
      const splashStyle = splash ? getComputedStyle(splash) : null;
      const shieldStyle = shield ? getComputedStyle(shield) : null;
      const mineRect = mine?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      return {
        href: location.href,
        android: window.__nexusAndroidShell === true,
        splashBlocking: Boolean(splash && splashStyle && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden' && Number(splashStyle.opacity) > 0 && splashStyle.pointerEvents !== 'none'),
        shieldExists: Boolean(shield),
        shieldBlocking: Boolean(shield && shieldStyle && shieldStyle.display !== 'none' && shieldStyle.visibility !== 'hidden' && Number(shieldStyle.opacity) > 0 && shieldStyle.pointerEvents !== 'none'),
        miningTabId: String(miningTab?.id || ''),
        homeActive: Boolean(miningTab?.classList.contains('active')),
        mineVisible: Boolean(mineRect && mineRect.width > 100 && mineRect.height > 40),
        dockVisible: Boolean(dockRect && dockRect.width > 100 && dockRect.height > 20),
        balance: String(document.getElementById('balance')?.textContent || '').trim(),
      };
    });
    console.log(`SNAPSHOT ${label} ${JSON.stringify({...state,navigations})}`);
    assert.match(state.href, /\/page2\.html(?:\?|$)/, `${label}: dashboard unexpectedly navigated away; history=${navigations.join(' -> ')}`);
    assert.equal(state.android, true, `${label}: Android shell marker missing`);
    assert.equal(state.splashBlocking, false, `${label}: HTML splash is blocking`);
    assert.equal(state.shieldBlocking, false, `${label}: secondary shield is blocking`);
    assert.equal(state.shieldExists, false, `${label}: Android created a secondary startup shield`);
    assert.equal(state.miningTabId, 'tab-home', `${label}: mining button is no longer owned by tab-home`);
    assert.equal(state.homeActive, true, `${label}: mining screen is not active`);
    assert.equal(state.mineVisible, true, `${label}: mining control is not visible`);
    assert.equal(state.dockVisible, true, `${label}: bottom dock is not visible`);
    assert.notEqual(state.balance, '0.0000', `${label}: stale 0.0000 balance exposed`);
  }

  // IMPORTANT: this test never calls a release/hide/remove helper for nxSplash.
  await page.waitForTimeout(150);
  await snapshot('150ms');
  await page.waitForTimeout(2850);
  await snapshot('3s');
  await page.waitForTimeout(5000);
  await snapshot('8s');

  await page.locator('.bottom-dock .dock-item:nth-child(2)').click({ timeout: 5000 });
  await page.waitForFunction(() => document.getElementById('tab-wallet')?.classList.contains('active') === true, null, { timeout: 3000 });
  await page.locator('.bottom-dock .dock-item:nth-child(1)').click({ timeout: 5000 });
  await page.waitForFunction(() => document.getElementById('mineBtn')?.closest('.tab')?.classList.contains('active') === true, null, { timeout: 3000 });
  await page.waitForTimeout(4000);
  await snapshot('12s-after-navigation');

  const severe = errors.filter(text => !/Failed to fetch|ERR_FAILED|dynamically imported module|Importing a module script failed/i.test(text));
  assert.deepEqual(severe, [], `unexpected severe page errors: ${severe.join(' | ')}`);

  console.log('PASS Android dashboard startup deep test: no blocking splash/shield, no stale zero, dashboard touchable with external network blocked.');
} finally {
  clearTimeout(hardWatchdog);
  try { await context?.close(); } catch (_) {}
  try { await browser?.close(); } catch (_) {}
}