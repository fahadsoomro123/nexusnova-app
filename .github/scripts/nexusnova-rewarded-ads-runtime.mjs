import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${origin}/.runtime-origin.html`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    document.body.innerHTML = `
      <section id="tab-tasks">
        <div id="balance">42.0000</div>
        <button id="legacyWatchAd" onclick="watchAdReward()">WATCH AD (+2.5 NVX)</button>
      </section>`;

    window.__nativeAdMessages = [];
    window.__premiumMessages = [];
    window.NexusAndroid = {
      postMessage(raw) {
        window.__nativeAdMessages.push(JSON.parse(String(raw)));
      }
    };
    window.NexusNovaUI = {
      alert: async options => {
        window.__premiumMessages.push(options);
        return true;
      }
    };
  });

  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-config-v1.js?v=test` });
  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-v1.js?v=test` });
  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-button-guard-v1.js?v=test` });

  await page.waitForFunction(() => window.__nxAdMobNexusPassV1 === true);
  await page.waitForFunction(() => /NEXUS PASS/i.test(document.getElementById('rewardedAdBtn')?.textContent || ''));

  let state = await page.evaluate(() => ({
    button: document.getElementById('rewardedAdBtn')?.textContent || '',
    balance: document.getElementById('balance')?.textContent || '',
    provider: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.provider,
    native: window.__nativeAdMessages.slice()
  }));

  assert.match(state.button, /UNLOCK 20 MIN NEXUS PASS/i);
  assert.doesNotMatch(state.button, /\+2\.5\s*NVX/i);
  assert.equal(state.balance, '42.0000');
  assert.equal(state.provider, 'admob-native');
  assert.ok(state.native.some(message => message.action === 'adStatus'), 'Bridge should request native ad status');

  await page.evaluate(() => { window.__nativeAdMessages.length = 0; });
  await page.locator('#rewardedAdBtn').click();
  await page.waitForFunction(() => window.__nativeAdMessages.some(message => message.action === 'showRewardedAd'));

  state = await page.evaluate(() => ({
    balance: document.getElementById('balance')?.textContent || '',
    native: window.__nativeAdMessages.slice()
  }));
  assert.equal(state.balance, '42.0000', 'Requesting an ad must never mint NVX');
  assert.equal(state.native.filter(message => message.action === 'showRewardedAd').length, 1);

  const expiry = Date.now() + 20 * 60 * 1000;
  await page.evaluate(passExpiresAt => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: {
        event: 'rewarded-earned',
        provider: 'admob',
        testMode: true,
        passExpiresAt,
        passMinutes: 20,
        rewardType: 'Nexus Pass',
        rewardAmount: 1
      }
    }));
  }, expiry);

  await page.waitForFunction(() => window.NexusNovaAccessPass?.active() === true);
  state = await page.evaluate(() => ({
    balance: document.getElementById('balance')?.textContent || '',
    active: window.NexusNovaAccessPass?.active(),
    remaining: window.NexusNovaAccessPass?.remainingMs(),
    status: document.getElementById('rewardedAdStatus')?.textContent || '',
    messages: window.__premiumMessages.slice()
  }));

  assert.equal(state.balance, '42.0000', 'Rewarded completion must unlock access, not mutate NVX');
  assert.equal(state.active, true);
  assert.ok(state.remaining > 19 * 60 * 1000, 'Nexus Pass should have close to 20 minutes remaining');
  assert.match(state.status, /Nexus Pass ACTIVE/i);
  assert.ok(state.messages.some(message => /Nexus Pass Unlocked/i.test(message.title || '')));

  await page.evaluate(() => {
    window.__nativeAdMessages.length = 0;
    window.NexusNovaInterstitialAds.show('test-natural-transition');
  });
  await page.waitForFunction(() => window.__nativeAdMessages.some(message => message.action === 'showInterstitialAd'));

  state = await page.evaluate(() => ({
    native: window.__nativeAdMessages.slice(),
    balance: document.getElementById('balance')?.textContent || ''
  }));
  assert.equal(state.native[0].action, 'showInterstitialAd');
  assert.equal(state.native[0].reason, 'test-natural-transition');
  assert.equal(state.balance, '42.0000');

  console.log('Rewarded ads runtime: PASS — AdMob native bridge, Nexus Pass, interstitial routing, and zero NVX mutation verified.');
} finally {
  await browser.close();
}
