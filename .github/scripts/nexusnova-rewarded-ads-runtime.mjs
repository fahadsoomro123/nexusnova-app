import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${origin}/.runtime-origin.html`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    document.body.innerHTML = `
      <section id="tab-home">
        <div id="balance">42.0000</div>
        <div id="timer">20:00:00</div>
        <div class="stats-grid"></div>
      </section>
      <section id="tab-tasks">
        <button id="legacyWatchAd" onclick="watchAdReward()">WATCH AD (+2.5 NVX)</button>
      </section>`;

    window.__nativeAdMessages = [];
    window.__premiumMessages = [];
    window.__appliedBoosts = [];
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

  await page.waitForFunction(() => window.__nxAdMobMiningBoostV1 === true);
  await page.waitForFunction(() => Boolean(window.NexusNovaMiningBoosters?.adoptDisplayState));

  const sessionAnchor = Date.now();
  await page.evaluate(anchor => {
    window.NexusNovaMiningBoosters.adoptDisplayState({
      miningActive: true,
      miningStartedAt: anchor,
      miningLastUpdate: anchor
    });
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: {
        event: 'status',
        provider: 'admob',
        testMode: true,
        rewardedReady: true,
        interstitialReady: true,
        rewardPurpose: 'mining-boost',
        boostHours: 2
      }
    }));
  }, sessionAnchor);

  await page.waitForFunction(() => /NOVA BOOSTER/i.test(document.getElementById('rewardedAdBtn')?.textContent || ''));
  await page.waitForFunction(() => document.getElementById('nxBoosterCount')?.textContent?.includes('0 / 2'));

  let state = await page.evaluate(() => ({
    button: document.getElementById('rewardedAdBtn')?.textContent || '',
    balance: document.getElementById('balance')?.textContent || '',
    provider: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.provider,
    purpose: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.rewardPurpose,
    native: window.__nativeAdMessages.slice(),
    passActive: window.NexusNovaAccessPass?.active?.()
  }));

  assert.match(state.button, /NOVA BOOSTER \(-2H\)/i);
  assert.doesNotMatch(state.button, /\+2\.5\s*NVX|NEXUS PASS/i);
  assert.equal(state.balance, '42.0000');
  assert.equal(state.provider, 'admob-native');
  assert.equal(state.purpose, 'mining-boost');
  assert.equal(state.passActive, false);
  assert.ok(state.native.some(message => message.action === 'adStatus'), 'Bridge should request native ad status');

  await page.evaluate(() => {
    window.__nativeAdMessages.length = 0;
    window.NexusNovaMiningBoosters.apply = async kind => {
      window.__appliedBoosts.push(kind);
      return { appliedKind:kind, reducedHours:2, uses:1 };
    };
  });

  await page.locator('#rewardedAdBtn').click();
  await page.waitForFunction(() => window.__nativeAdMessages.some(message => message.action === 'showRewardedAd'));

  state = await page.evaluate(() => ({
    balance: document.getElementById('balance')?.textContent || '',
    native: window.__nativeAdMessages.slice()
  }));
  assert.equal(state.balance, '42.0000', 'Requesting an ad must never mint NVX');
  assert.equal(state.native.filter(message => message.action === 'showRewardedAd').length, 1);
  assert.equal(state.native.find(message => message.action === 'showRewardedAd')?.rewardPurpose, 'mining-boost');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: {
        event: 'rewarded-earned',
        provider: 'admob',
        testMode: true,
        rewardPurpose: 'mining-boost',
        boostHours: 2,
        rewardType: 'Nexus Mining Boost',
        rewardAmount: 1
      }
    }));
  });

  await page.waitForFunction(() => window.__appliedBoosts.length === 1);
  state = await page.evaluate(() => ({
    balance: document.getElementById('balance')?.textContent || '',
    applied: window.__appliedBoosts.slice(),
    messages: window.__premiumMessages.slice(),
    passActive: window.NexusNovaAccessPass?.active?.()
  }));

  assert.equal(state.balance, '42.0000', 'Rewarded completion must alter session time, never directly mint NVX');
  assert.deepEqual(state.applied, ['booster']);
  assert.equal(state.passActive, false, 'Nexus Pass must remain retired in the mining-boost flow');
  assert.ok(state.messages.some(message => /Nova Booster Applied/i.test(message.title || '')));

  // Two completed boost slots are represented by a four-hour shift from the
  // immutable session anchor. The next reward must become Nova Rain.
  await page.evaluate(anchor => {
    window.NexusNovaMiningBoosters.adoptDisplayState({
      miningActive: true,
      miningStartedAt: anchor - 4 * 60 * 60 * 1000,
      miningLastUpdate: anchor
    });
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: { event:'rewarded-ready', provider:'admob', testMode:true }
    }));
  }, sessionAnchor);
  await page.waitForFunction(() => /NOVA RAIN/i.test(document.getElementById('rewardedAdBtn')?.textContent || ''));
  state = await page.evaluate(() => ({
    taskButton: document.getElementById('rewardedAdBtn')?.textContent || '',
    boosterCount: document.getElementById('nxBoosterCount')?.textContent || '',
    rainCount: document.getElementById('nxRainCount')?.textContent || ''
  }));
  assert.match(state.taskButton, /NOVA RAIN \(-2H\)/i);
  assert.equal(state.boosterCount, '2 / 2');
  assert.equal(state.rainCount, '0 / 4');

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

  console.log('Rewarded ads runtime: PASS — AdMob mining boost routing, Booster->Rain progression, and zero direct NVX mutation verified.');
} finally {
  await browser.close();
}
