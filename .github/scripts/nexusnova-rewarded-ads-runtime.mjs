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
        <button id="legacyWatchAd" onclick="watchAdReward()">WATCH AD (+2.5 NVX)</button>
      </section>`;

    window.__NX_REWARDED_TEST_UID = 'firebase-test-user-123';
    window.__nxBalanceMutationCalls = 0;
    window.nexusApplySecureAccountState = () => { window.__nxBalanceMutationCalls += 1; };
    window.NexusNovaUI = { alert: async () => true };

    window.AyetVideoSdk = {
      initCalls: [],
      requestCalls: [],
      playCalls: 0,
      custom: {},
      init(placementId, externalIdentifier, optionalParameter) {
        this.initCalls.push({ placementId, externalIdentifier, optionalParameter });
        return Promise.resolve();
      },
      setCustomParameter(key, value) { this.custom[key] = value; },
      requestAd(name, success) {
        this.requestCalls.push(name);
        setTimeout(success, 0);
      },
      playFullsizeAd() {
        this.playCalls += 1;
        this.callbackPlaying?.();
        this.callbackComplete?.();
      }
    };
  });

  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-config-v1.js?v=test` });

  await page.evaluate(() => {
    document.querySelector('meta[name="nexusnova-ayet-placement-id"]').content = '321';
    document.querySelector('meta[name="nexusnova-ayet-adslot-name"]').content = 'nexusnova_rewarded_test';
  });

  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-v1.js?v=test` });
  await page.addScriptTag({ url: `${origin}/js/nexusnova-rewarded-ads-button-guard-v1.js?v=test` });

  await page.locator('#rewardedAdBtn').click();
  await page.waitForFunction(() => window.AyetVideoSdk.playCalls === 1);

  let state = await page.evaluate(() => ({
    mutations: window.__nxBalanceMutationCalls,
    initCalls: window.AyetVideoSdk.initCalls,
    requestCalls: window.AyetVideoSdk.requestCalls,
    status: document.getElementById('rewardedAdStatus')?.textContent || ''
  }));

  assert.equal(state.mutations, 0, 'Ad playback/completion must never mutate balance client-side');
  assert.equal(state.initCalls.length, 1, 'Rewarded SDK should initialize exactly once');
  assert.equal(state.initCalls[0].placementId, 321);
  assert.equal(state.initCalls[0].externalIdentifier, 'firebase-test-user-123');
  assert.deepEqual(state.requestCalls, ['nexusnova_rewarded_test']);
  assert.match(state.status, /checking reward verification/i);

  await page.evaluate(() => {
    window.AyetVideoSdk.callbackRewarded?.({
      status: 'success',
      rewarded: true,
      externalIdentifier: 'firebase-test-user-123',
      currency: 2.5,
      conversionId: 'conversion-test-001',
      signature: 'client-signature-is-not-authoritative'
    });
  });

  state = await page.evaluate(() => ({
    mutations: window.__nxBalanceMutationCalls,
    grant: window.__nexusRewardedLastClientGrant,
    status: document.getElementById('rewardedAdStatus')?.textContent || ''
  }));

  assert.equal(state.mutations, 0, 'Client rewarded callback must not mint NVX');
  assert.equal(state.grant?.conversionId, 'conversion-test-001');
  assert.match(state.status, /pending secure server verification/i);

  await page.evaluate(() => {
    window.AyetVideoSdk.callbackRewarded?.({
      status: 'success',
      rewarded: true,
      externalIdentifier: 'different-user',
      currency: 2.5,
      conversionId: 'conversion-test-spoof'
    });
  });

  state = await page.evaluate(() => ({
    mutations: window.__nxBalanceMutationCalls,
    grant: window.__nexusRewardedLastClientGrant,
    status: document.getElementById('rewardedAdStatus')?.textContent || ''
  }));

  assert.equal(state.mutations, 0);
  assert.equal(state.grant?.conversionId, 'conversion-test-001', 'Mismatched account callback must not replace accepted UX receipt');
  assert.match(state.status, /could not be matched/i);

  console.log('Rewarded ads runtime: PASS — no client-side NVX mint, provider identity and verification state enforced.');
} finally {
  await browser.close();
}
