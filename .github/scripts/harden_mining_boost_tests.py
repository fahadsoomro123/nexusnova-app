from pathlib import Path

# Rewrite the mining-boost Firestore attack test around the new security model:
# every direct client timestamp boost must fail, while normal mining is covered
# by the existing general Firestore mining smoke.
rules_test = Path('.github/scripts/mining-boost-rules-smoke.mjs')
rules_test.write_text(r'''import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId = 'demo-nexusnova-rules';
const rules = await fs.readFile('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({projectId, firestore:{rules}});

const HOUR = 60 * 60 * 1000;
const BOOST = 2 * HOUR;

const verified = env.authenticatedContext('boost-miner', {
  email:'boost@example.com', email_verified:true
}).firestore();
const unverified = env.authenticatedContext('boost-unverified', {
  email:'boost2@example.com', email_verified:false
}).firestore();

const verifiedRef = doc(verified, 'users/boost-miner');
const unverifiedRef = doc(unverified, 'users/boost-unverified');

const profile = (uid, email, anchor) => ({
  uid,
  name:'Boost Miner',
  email,
  balance:0,
  totalMined:0,
  tasksCompleted:0,
  completedTasks:{},
  miningActive:true,
  miningStartedAt:anchor,
  miningLastUpdate:anchor,
  sessionEarned:0,
  lastDailyReward:0,
  dailyRewardStreak:0,
  createdAt:new Date(anchor - HOUR)
});

try {
  const anchor = Date.now();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/boost-miner'), profile('boost-miner', 'boost@example.com', anchor));
    await setDoc(doc(db, 'users/boost-unverified'), profile('boost-unverified', 'boost2@example.com', anchor));
  });

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - BOOST}));
  console.log('PASS verified client cannot apply a 2h mining boost directly');

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - 6 * HOUR}));
  console.log('PASS verified client cannot jump mining timestamps by multiple boost slots');

  await assertFails(updateDoc(verifiedRef, {
    miningStartedAt: anchor - BOOST,
    balance: 24
  }));
  console.log('PASS blocked boost path cannot smuggle a balance change');

  await assertFails(updateDoc(unverifiedRef, {miningStartedAt: anchor - BOOST}));
  console.log('PASS unverified client cannot apply a mining boost either');

  const snap = await getDoc(verifiedRef);
  assert.equal(Number(snap.data().miningStartedAt), anchor);
  assert.equal(Number(snap.data().miningLastUpdate), anchor);
  assert.equal(Number(snap.data().balance), 0);
  assert.equal(Number(snap.data().totalMined), 0);
  console.log('PASS rejected boost attempts leave the mining session and NVX unchanged');

  console.log('\nMining boost Firestore rules smoke complete: all direct client boost/value mutations denied.');
} finally {
  await env.cleanup();
}
''', encoding='utf-8')

# Browser test: debug rewarded inventory proves routing only. No direct apply hook
# may change mining state, and the public config must truthfully report value OFF.
runtime = Path('.github/scripts/nexusnova-rewarded-ads-runtime.mjs')
runtime.write_text(r'''import { chromium } from 'playwright';
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
  assert.ok(state.messages.some(message => /TEST ads never reduce mining time or change NVX/i.test(message.message || '')));

  const directApply = await page.evaluate(async () => {
    try {
      await window.NexusNovaMiningBoosters.apply('booster');
      return {ok:true};
    } catch (error) {
      return {ok:false, message:String(error?.message || error)};
    }
  });
  assert.equal(directApply.ok, false);
  assert.match(directApply.message, /server-verified ad proof/i);

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

  console.log('Rewarded ads runtime: PASS — Mining Boost TEST routing works and all mining/NVX value changes stay disabled without server proof.');
} finally {
  await browser.close();
}
''', encoding='utf-8')

# Firebase security readiness: Mining Boost is no longer a tolerated direct
# Firestore transition; treat any return of the helper/writer as an error.
validator_path = Path('.github/scripts/firebase-security-readiness.py')
validator = validator_path.read_text(encoding='utf-8')
if "mining_boost = read('js/nexusnova-admob-nexus-pass-v1.js')" not in validator:
    validator = validator.replace(
        "mining = read('js/rewards-security-v1.js')\n",
        "mining = read('js/rewards-security-v1.js')\nmining_boost = read('js/nexusnova-admob-nexus-pass-v1.js')\n",
        1
    )
boost_check_marker = "# Mining remains a known migration item on the free/Spark architecture. Do not\n"
boost_check = """# Rewarded Mining Boost is never client-authoritative. TEST ads may prove UX,\n# but direct timestamp/value mutation stays denied until server proof exists.\nif 'validMiningBoost()' in rules:\n    errors.append('Direct client Mining Boost Firestore permission returned')\nfor forbidden in ['runTransaction(context.db', 'tx.update(ref, { miningStartedAt:']:\n    if forbidden in mining_boost:\n        errors.append(f'Mining Boost client value writer returned: {forbidden}')\nfor marker in [\n    'const SERVER_VERIFIED_BOOST_ENABLED = false;',\n    \"boostKind:expected, testOnly:true\",\n    'TEST ads never reduce mining time or change NVX.'\n]:\n    if marker not in mining_boost:\n        errors.append(f'Mining Boost server-proof safety marker missing: {marker}')\n\n"""
if boost_check not in validator:
    if boost_check_marker not in validator:
        raise SystemExit('Firebase security mining warning insertion point not found.')
    validator = validator.replace(boost_check_marker, boost_check + boost_check_marker, 1)
validator = validator.replace("        'validMiningStart()', 'validMiningBoost()', 'validMiningFinish()',\n", "        'validMiningStart()', 'validMiningFinish()',\n", 1)
validator_path.write_text(validator, encoding='utf-8')

# Android build checks must validate the new proof-only boost contract, not a
# post-transaction timestamp adoption that no longer exists.
android_path = Path('.github/workflows/nexusnova-android-build.yml')
android = android_path.read_text(encoding='utf-8')
android = android.replace(
    "          grep -q 'nexusSecureAdoptMiningState(result)' NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js\n          grep -q 'nexusSecureSyncMining?.({ force:true })' NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js\n",
    "          grep -q 'SERVER_VERIFIED_BOOST_ENABLED = false' NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js\n          grep -q 'TEST ads never reduce mining time or change NVX.' NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js\n",
    1
)
android_path.write_text(android, encoding='utf-8')

print('Updated Mining Boost attack/runtime/CI tests for server-proof-only value changes.')
