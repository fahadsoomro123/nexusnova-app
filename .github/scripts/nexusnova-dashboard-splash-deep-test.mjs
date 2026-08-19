import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pageUrl = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&deepSplashTest=1`;
const startedAt = Date.now();

function log(message) {
  console.log(`DIAG +${Date.now() - startedAt}ms ${message}`);
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
  console.error(`FAIL Ads/UX starvation split: hard 45s watchdog expired at +${Date.now() - startedAt}ms.`);
  process.exit(124);
}, 45_000);
hardWatchdog.unref();

const rewardedBridge = [
  'nexusnova-rewarded-ads-config-v1.js',
  'nexusnova-rewarded-ads-v1.js',
  'nexusnova-rewarded-ads-button-guard-v1.js',
  'nexusnova-watch-ad-reward-v1.js',
];

const placementHotfix = [
  'nexusnova-ad-settings-v2.js',
  'nexusnova-ad-placements-v1.js',
  'nexusnova-existing-app-ad-hotfix-v1.js',
  'nexusnova-existing-app-ad-hotfix-v2.js',
];

const uxSpeed = [
  'nexusnova-ux-simplify-v1.js',
  'nexusnova-speedtest-app-v4.js',
];

const scenarios = [
  { name:'block-rewarded-bridge', block:rewardedBridge },
  { name:'block-placement-hotfix', block:placementHotfix },
  { name:'block-ux-speed', block:uxSpeed },
  { name:'block-rewarded-ads-v1', block:['nexusnova-rewarded-ads-v1.js'] },
  { name:'block-watch-ad-reward', block:['nexusnova-watch-ad-reward-v1.js'] },
  { name:'block-ad-placements', block:['nexusnova-ad-placements-v1.js'] },
  { name:'block-existing-hotfix-v1', block:['nexusnova-existing-app-ad-hotfix-v1.js'] },
  { name:'block-existing-hotfix-v2', block:['nexusnova-existing-app-ad-hotfix-v2.js'] },
  { name:'block-ux-simplify', block:['nexusnova-ux-simplify-v1.js'] },
  { name:'block-speedtest', block:['nexusnova-speedtest-app-v4.js'] },
];

async function probeScenario(scenario) {
  const blocked = new Set(scenario.block);
  let browser;
  let context;
  let page;
  const blockedHits = [];
  const result = {
    name: scenario.name,
    responsive: false,
    mineReady: false,
    state: null,
    blockedHits,
    error: '',
  };

  try {
    log(`${scenario.name}: launch`);
    browser = await bounded(chromium.launch({ headless:true }), 4200, `${scenario.name} chromium.launch`);
    context = await bounded(browser.newContext({
      viewport: { width:393, height:873 },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaAdsUxSplit',
      serviceWorkers: 'block',
    }), 2800, `${scenario.name} newContext`);
    page = await bounded(context.newPage(), 2800, `${scenario.name} newPage`);

    await page.route('**/*', async route => {
      try {
        const url = new URL(route.request().url());
        const basename = url.pathname.split('/').pop() || '';
        if (url.origin !== base) return route.abort('failed');
        if (blocked.has(basename)) {
          blockedHits.push(basename);
          return route.abort('failed');
        }
        return route.continue();
      } catch (_) {
        return route.abort('failed');
      }
    });

    const response = await bounded(page.goto(pageUrl, { waitUntil:'commit', timeout:5500 }), 6200, `${scenario.name} goto`);
    if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()}`);

    await bounded(
      page.waitForFunction(() => Boolean(document.getElementById('mineBtn')), null, { timeout:3200 }),
      3800,
      `${scenario.name} mineBtn`
    );
    result.mineReady = true;

    // Starvation has repeatedly begun around 0.47s after navigation. Wait past
    // that window, then ask the renderer for a tiny state snapshot.
    await new Promise(resolve => setTimeout(resolve, 850));

    result.state = await bounded(page.evaluate(() => {
      const splash = document.getElementById('nxSplash');
      const mine = document.getElementById('mineBtn');
      const home = document.getElementById('tab-home');
      const dock = document.querySelector('.bottom-dock');
      const splashStyle = splash ? getComputedStyle(splash) : null;
      const mineRect = mine?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      return {
        readyState: document.readyState,
        android: window.__nexusAndroidShell === true,
        homeActive: Boolean(home?.classList.contains('active')),
        homeContainsMine: Boolean(home && mine && home.contains(mine)),
        splashBlocking: Boolean(splash && splashStyle && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden' && Number(splashStyle.opacity) > 0 && splashStyle.pointerEvents !== 'none'),
        shieldExists: Boolean(document.getElementById('nxSecureStartupShieldV3')),
        mineVisible: Boolean(mineRect && mineRect.width > 100 && mineRect.height > 40),
        dockVisible: Boolean(dockRect && dockRect.width > 100 && dockRect.height > 20),
        balance: String(document.getElementById('balance')?.textContent || '').trim(),
        btnText: String(document.getElementById('btnText')?.textContent || '').trim(),
      };
    }), 1600, `${scenario.name} responsiveness evaluate`);

    result.responsive = true;
  } catch (error) {
    result.error = String(error?.message || error || 'unknown').slice(0, 300);
  } finally {
    try { if (context) await bounded(context.close(), 900, `${scenario.name} context.close`); } catch (_) {}
    try { if (browser) await bounded(browser.close(), 900, `${scenario.name} browser.close`); } catch (_) {}
  }

  console.log(`ADS_UX_SPLIT ${JSON.stringify(result)}`);
  return result;
}

const results = [];
for (const scenario of scenarios) results.push(await probeScenario(scenario));
clearTimeout(hardWatchdog);

const responsive = results.filter(item => item.responsive).map(item => item.name);
const starved = results.filter(item => !item.responsive).map(item => item.name);
console.log(`ADS_UX_SPLIT_SUMMARY ${JSON.stringify({responsive,starved})}`);

// Diagnostic only. Never turn the real startup gate green while modules are
// artificially blocked; fix the isolated source first, then restore full test.
console.error('FAIL diagnostic-only Ads/UX split complete; inspect ADS_UX_SPLIT_SUMMARY.');
process.exit(1);
