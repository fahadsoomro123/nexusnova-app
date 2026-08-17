import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pageUrl = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&stabilityTest=1`;
const slowProbe = 'https://nx-slow-probe.invalid/nonblocking-startup-probe.js';

function deadline(promise, ms, label) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}

const browser = await chromium.launch({ headless: true });

async function waitForShell(page, label) {
  await page.locator('#moreBtn').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#tab-home').waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => window.__nexusAndroidShell === true, null, { timeout: 10000 });
  await page.waitForFunction(() => (
    typeof window.switchTab === 'function' &&
    typeof window.toggleMore === 'function' &&
    typeof window.openMoreTab === 'function'
  ), null, { timeout: 10000 });
  const splash = await page.locator('#nxSplash').count();
  if (splash) {
    await page.waitForFunction(() => {
      const el = document.getElementById('nxSplash');
      if (!el) return true;
      const s = getComputedStyle(el);
      return s.pointerEvents === 'none' || s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0;
    }, null, { timeout: 6500 });
  }
  console.log(`PASS ${label}: shell visible, navigation primitives ready and splash non-blocking.`);
}

async function clickAndCheck(page, selector, tabId, label) {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click({ timeout: 5000 });
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('active') === true, tabId.slice(1), { timeout: 3000 });
  console.log(`PASS ${label}`);
}

async function exercise(page, label) {
  await clickAndCheck(page, '.bottom-dock .dock-item:nth-child(2)', '#tab-wallet', `${label} Wallet`);
  await clickAndCheck(page, '.bottom-dock .dock-item:nth-child(3)', '#tab-tasks', `${label} Tasks`);
  await clickAndCheck(page, '.bottom-dock .dock-item:nth-child(4)', '#tab-market', `${label} Market`);
  await page.locator('#moreBtn').click({ timeout: 5000 });
  await page.waitForFunction(() => document.getElementById('moreMenu')?.classList.contains('show') === true, null, { timeout: 3000 });
  console.log(`PASS ${label} ALL APPS`);
  await page.locator('#moreBtn').click({ timeout: 5000 });
  await clickAndCheck(page, '.bottom-dock .dock-item:nth-child(1)', '#tab-home', `${label} Mine`);
}

async function scenario(name, delayedProbe = false) {
  return deadline((async () => {
    console.log(`START ${name}`);
    const context = await browser.newContext({
      viewport: { width: 393, height: 873 },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaStabilityTest',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const severe = [];
    page.on('pageerror', error => {
      const text = String(error?.message || error || '');
      if (/Failed to fetch|ERR_FAILED|dynamically imported module/i.test(text)) return;
      severe.push(text);
    });

    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === base) return route.continue();
      if (url.hostname === 'www.gstatic.com') return route.continue();
      if (url.href === slowProbe && delayedProbe) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        return route.abort('failed');
      }
      return route.abort('failed');
    });

    const response = await page.goto(pageUrl, { waitUntil: 'commit', timeout: 8000 });
    assert.equal(response?.status(), 200, `${name}: HTTP ${response?.status()}`);
    await waitForShell(page, name);

    if (delayedProbe) {
      await page.evaluate(src => {
        const script = document.createElement('script');
        script.async = true;
        script.src = src;
        document.head.appendChild(script);
      }, slowProbe);
    }

    await exercise(page, `${name}:3s`);
    await page.waitForTimeout(3500);
    await exercise(page, `${name}:7s`);
    await page.waitForTimeout(5000);
    await exercise(page, `${name}:12s`);

    assert.deepEqual(severe, [], `${name}: severe page errors: ${severe.join(' | ')}`);
    await context.close();
    console.log(`PASS ${name}: real final Android dashboard stayed touchable through repeated navigation.`);
  })(), 45000, name);
}

try {
  await scenario('optional-network-blocked', false);
  await scenario('background-dependency-8s-slow', true);
  await browser.close();
  console.log('PASS NexusNova Android full-page stability regression.');
} catch (error) {
  try { await browser.close(); } catch (_) {}
  console.error(error?.stack || error);
  process.exit(1);
}
