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

  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-config-v1.js?v=secure-test` });
  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-v1.js?v=secure-test` });
  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-button-guard-v1.js?v=secure-test` });

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

  await page.waitForFunction(() => /TEST AD/i.test(document.getElementById('rewardedAdBtn')?.textContent || ''));

  let state = await page.evaluate(() => ({
    button: document.getElementById('rewardedAdBtn')?.textContent || '',
    balance: document.getElementById('balance')?.textContent || '',
    provider: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.provider,
    purpose: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.rewardPurpose,
    valueEnabled: window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG?.serverVerifiedValueEnabled,
    mining: window.NexusNovaMiningBoosters.status(),
    native: window.__nativeAdMessages.slice()
  }));

  assert.match(state.button, /TEST AD.*NOVA BOOSTER.*NO TIME CHANGE/i);
  assert.equal(state.balance, '42.0000');
  assert.equal(state.provider, 'admob-native');
  assert.equal(state.purpose, 'mining-boost');
  assert.equal(state.valueEnabled, false);
  assert.equal(state.mining.startedAt, sessionAnchor);
  assert.equal(state.mining.uses, 0);
  assert.ok(state.native.some(message => message.action === 'adStatus'));

  await page.evaluate(() => { window.__nativeAdMessages.length = 0; });
  await page.locator('#rewardedAdBtn').click();
  await page.waitForFunction(() => window.__nativeAdMessages.some(message => message.action === 'showRewardedAd'));

  state = await page.evaluate(() => ({
    native: window.__nativeAdMessages.slice(),
    balance: document.getElementById('balance')?.textContent || ''
  }));
  const request = state.native.find(message => message.action === 'showRewardedAd');
  assert.equal(state.balance, '42.0000');
  assert.equal(request?.rewardPurpose, 'mining-boost');
  assert.equal(request?.testOnly, true);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: {
        event: 'rewarded-earned',
        provider: 'admob',
        testMode: true,
        rewardPurpose: 'mining-boost',
        boostHours: 2,
        rewardType: 'Nexus Mining Boost Test',
        rewardAmount: 1
      }
    }));
  });
  await page.waitForFunction(() => window.__premiumMessages.some(message => /TEST Ad Completed/i.test(message.title || '')));

  state = await page.evaluate(() => ({
    balance: document.getElementById('balance')?.textContent || '',
    mining: window.NexusNovaMiningBoosters.status(),
    messages: window.__premiumMessages.slice()
  }));
  assert.equal(state.balance, '42.0000');
  assert.equal(state.mining.startedAt, sessionAnchor, 'TEST rewarded completion must not shift mining time');
  assert.equal(state.mining.uses, 0);
  assert.ok(state.messages.some(message => /TEST ads never reduce mining time or change NVX/i.test(message.text || '')));

  // The old public apply hook must no longer contain its own Firestore writer.
  // Without the Nova Vault module it must fail closed rather than changing time.
  const directApply = await page.evaluate(async () => {
    try {
      await window.NexusNovaMiningBoosters.apply('booster');
      return {ok:true};
    } catch (error) {
      return {ok:false, message:String(error?.message || error)};
    }
  });
  assert.equal(directApply.ok, false);
  assert.match(directApply.message, /Nova Vault secure boost service is still loading/i);

  // When a stored Vault Booster exists, the button must route to the Vault
  // server owner instead of requesting a rewarded ad. This mock represents the
  // already-tested callable boundary; it never mutates local mining state.
  await page.evaluate(() => {
    window.__vaultCalls = [];
    window.NexusNovaVault = {
      inventory: () => ({booster:1, rain:0, timeWarp:0, pendingVaults:0}),
      cooldownRemainingMs: () => 0,
      useBoost: async kind => {
        window.__vaultCalls.push(kind);
        return {applied:true, appliedKind:kind, reducedHours:2};
      }
    };
    window.__nativeAdMessages.length = 0;
    window.dispatchEvent(new CustomEvent('nexusnova:nova-vault-state'));
  });
  await page.waitForFunction(() => /USE VAULT BOOSTER/i.test(document.getElementById('nxBoosterBtn')?.textContent || ''));
  await page.locator('#nxBoosterBtn').click();
  await page.waitForFunction(() => window.__vaultCalls.length === 1);
  state = await page.evaluate(() => ({
    vaultCalls: window.__vaultCalls.slice(),
    native: window.__nativeAdMessages.slice(),
    mining: window.NexusNovaMiningBoosters.status()
  }));
  assert.deepEqual(state.vaultCalls, ['booster']);
  assert.equal(state.native.some(message => message.action === 'showRewardedAd'), false, 'stored Vault Booster must not request an ad');
  assert.equal(state.mining.startedAt, sessionAnchor, 'client bridge must not self-mutate mining state');

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

  console.log('Rewarded ads runtime: PASS — TEST ads stay value-free and stored Nova Vault Booster routes only to the server-authoritative Vault owner.');
} finally {
  await browser.close();
}
