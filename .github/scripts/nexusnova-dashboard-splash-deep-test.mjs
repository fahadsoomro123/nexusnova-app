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
  console.error(`FAIL starvation isolation: hard 45s watchdog expired at +${Date.now() - startedAt}ms.`);
  process.exit(124);
}, 45_000);
hardWatchdog.unref();

const integrityAdsUx = [
  'nexusnova-rewarded-ads-config-v1.js',
  'nexusnova-rewarded-ads-v1.js',
  'nexusnova-rewarded-ads-button-guard-v1.js',
  'nexusnova-ad-settings-v2.js',
  'nexusnova-ad-placements-v1.js',
  'nexusnova-watch-ad-reward-v1.js',
  'nexusnova-existing-app-ad-hotfix-v1.js',
  'nexusnova-existing-app-ad-hotfix-v2.js',
  'nexusnova-ux-simplify-v1.js',
  'nexusnova-speedtest-app-v4.js',
];

const integrityRewardsGrowth = [
  'nexusnova-rewards-spark-v1.js',
  'nexusnova-allapps-smart-search-v1.js',
  'nexusnova-community-progress-v1.js',
  'nexusnova-complete-profile-v1.js',
  'nexusnova-growth-center-v1.js',
  'nexusnova-nova-vault-v1.js',
  'nexusnova-growth-referral-link-v1.js',
  'nexusnova-referral-capture-v1.js',
  'nexusnova-onboarding-insights-v1.js',
];

const integrityHealthBrowserCore = [
  'nexusnova-analytics-v1.js',
  'nexusnova-bug-report-v1.js',
  'nexusnova-health-monitor-v1.js',
  'nexusnova-browser-v1.js',
  'nexusnova-browser-guard-v1.js',
  'final-integrity-fix-core.js',
];

const allIntegrityChildren = [
  ...integrityAdsUx,
  ...integrityRewardsGrowth,
  ...integrityHealthBrowserCore,
];

const scenarios = [
  { name:'block-final-integrity-bootstrap', block:['final-integrity-fix.js'] },
  { name:'block-all-integrity-children', block:allIntegrityChildren },
  { name:'block-integrity-ads-ux', block:integrityAdsUx },
  { name:'block-integrity-rewards-growth', block:integrityRewardsGrowth },
  { name:'block-integrity-health-browser-core', block:integrityHealthBrowserCore },
  { name:'block-final-user-fixes', block:['nexusnova-final-user-fixes-v1.js'] },
  { name:'block-news-allinone', block:['news-fix.js','nexusnova-allinone-hub-v1.js'] },
  { name:'block-mega-tail', block:['nexusnova-mega-merge-v1.js','nexusnova-super-app-v1.js'] },
];

async function probeScenario(scenario) {
  const blocked = new Set(scenario.block);
  let browser;
  let context;
  let page;
  const browserErrors = [];
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
    browser = await bounded(chromium.launch({ headless:true }), 4500, `${scenario.name} chromium.launch`);
    context = await bounded(browser.newContext({
      viewport: { width:393, height:873 },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X693) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaStarvationIsolation',
      serviceWorkers: 'block',
    }), 3000, `${scenario.name} newContext`);
    page = await bounded(context.newPage(), 3000, `${scenario.name} newPage`);

    page.on('pageerror', error => browserErrors.push(String(error?.message || error || '').slice(0, 180)));
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

    const response = await bounded(page.goto(pageUrl, { waitUntil:'commit', timeout:6000 }), 7000, `${scenario.name} goto`);
    if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()}`);

    await bounded(
      page.waitForFunction(() => Boolean(document.getElementById('mineBtn')), null, { timeout:3500 }),
      4200,
      `${scenario.name} mineBtn`
    );
    result.mineReady = true;

    // Give startup modules enough time to enter the starvation window observed
    // in the unmodified staged Android shell (~470ms after navigation).
    await new Promise(resolve => setTimeout(resolve, 950));

    result.state = await bounded(page.evaluate(() => {
      const splash = document.getElementById('nxSplash');
      const shield = document.getElementById('nxSecureStartupShieldV3');
      const mine = document.getElementById('mineBtn');
      const home = document.getElementById('tab-home');
      const dock = document.querySelector('.bottom-dock');
      const splashStyle = splash ? getComputedStyle(splash) : null;
      const mineRect = mine?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      return {
        href: location.href,
        readyState: document.readyState,
        android: window.__nexusAndroidShell === true,
        homeContainsMine: Boolean(home && mine && home.contains(mine)),
        homeActive: Boolean(home?.classList.contains('active')),
        splashBlocking: Boolean(splash && splashStyle && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden' && Number(splashStyle.opacity) > 0 && splashStyle.pointerEvents !== 'none'),
        shieldExists: Boolean(shield),
        mineVisible: Boolean(mineRect && mineRect.width > 100 && mineRect.height > 40),
        dockVisible: Boolean(dockRect && dockRect.width > 100 && dockRect.height > 20),
        balance: String(document.getElementById('balance')?.textContent || '').trim(),
        btnText: String(document.getElementById('btnText')?.textContent || '').trim(),
        timer: String(document.getElementById('timer')?.textContent || '').trim(),
      };
    }), 1800, `${scenario.name} responsiveness evaluate`);

    result.responsive = true;
  } catch (error) {
    result.error = String(error?.message || error || 'unknown').slice(0, 300);
  } finally {
    if (browserErrors.length) result.browserErrors = [...new Set(browserErrors)].slice(0, 6);
    try { if (context) await bounded(context.close(), 1000, `${scenario.name} context.close`); } catch (_) {}
    try { if (browser) await bounded(browser.close(), 1000, `${scenario.name} browser.close`); } catch (_) {}
  }

  console.log(`ISOLATION ${JSON.stringify(result)}`);
  return result;
}

const results = [];
for (const scenario of scenarios) {
  results.push(await probeScenario(scenario));
}
clearTimeout(hardWatchdog);

const responsive = results.filter(item => item.responsive).map(item => item.name);
const starved = results.filter(item => !item.responsive).map(item => item.name);
console.log(`ISOLATION_SUMMARY ${JSON.stringify({responsive,starved})}`);

// Diagnostic-only run: never allow a temporary blocked-module scenario to turn
// the production startup gate green. A follow-up commit will fix only the
// isolated culprit and restore the full unblocked deep runtime assertions.
console.error('FAIL diagnostic-only starvation isolation complete; inspect ISOLATION_SUMMARY before changing app code.');
process.exit(1);
