/* NexusNova Ad Settings v2
   TESTING-edition ad policy + bootstrap.

   This module deliberately does NOT enable production ad IDs or production
   value rewards. It wires the already-audited TEST rewarded/interstitial
   modules into the normal app boot path and exposes one clear policy/status
   card in Settings for device testing.

   UX rules:
   - Rewarded ads are always user initiated.
   - Interstitials are frequency-capped and only requested at natural breaks.
   - No forced interstitials on protected/sensitive screens.
   - No permanent bottom banner that can cover the NexusNova dock.
   - Quran/Hadith/Bible/Islamic reading screens remain ad-free.
*/
(() => {
  'use strict';
  if (window.__nxAdSettingsV2) return;
  window.__nxAdSettingsV2 = true;

  const TEST_POLICY = Object.freeze({
    edition: 'TESTING',
    productionAdsEnabled: false,
    formatsUnderTest: Object.freeze(['rewarded', 'interstitial']),
    rewarded: Object.freeze({
      dailyReward: 'opt-in gate before secure +5 NVX daily claim',
      watchAd: 'opt-in TEST flow; +2.5 NVX production credit disabled',
      miningBoost: 'opt-in TEST flow; production server-verified value disabled'
    }),
    interstitial: Object.freeze({
      minGapMs: 180000,
      sessionMax: 4,
      firstAfterEligibleBreaks: 3,
      naturalBreaksOnly: true
    }),
    eligibleInterstitialFeatures: Object.freeze([
      'Tools','Finance','Money','News','Learning','Travel','Smart Tools','AI',
      'Entertainment','Browser','Calendar','Reminders','Weather','Pakistan Hub',
      'Shopping','Marketplace','Orders','Teacher Toolkit'
    ]),
    protectedNoForcedAds: Object.freeze([
      'Login/Auth','Home/Mining core','Wallet','Profile','Tasks core','Emergency',
      'Health','Location','Caller ID','Qibla','Islamic Hub','Quran','Hadith',
      'Bible','Security','File Vault','Contacts','Settings'
    ]),
    permanentBottomBanner: false,
    inlineNativeFeedAdsEnabled: false
  });

  window.NexusNovaAdPolicy = TEST_POLICY;

  const MODULES = [
    { flag:'__nxAdPlacementsV1', marker:'data-nx-ad-placements-v1', src:'./js/nexusnova-ad-placements-v1.js?v=20260817-test', label:'ad placement controller' },
    { flag:'__nxDailyRewardAdGateV4', marker:'data-nx-daily-ad-gate-v4', src:'./js/nexusnova-daily-ad-test-v1.js?v=20260817-test', label:'Daily Reward ad gate' },
    { flag:'__nxWatchAdRewardV1', marker:'data-nx-watch-ad-reward-v1', src:'./js/nexusnova-watch-ad-reward-v1.js?v=20260817-test', label:'Watch Ad reward flow' },
    { flag:'__nxAdMobDiagnosticsV2', marker:'data-nx-admob-diagnostics-v2', src:'./js/nexusnova-admob-diagnostics-v1.js?v=20260817-test', label:'AdMob diagnostics' },
    { flag:'__nxAdPrivacyV1', marker:'data-nx-ad-privacy-v1', src:'./js/nexusnova-ad-privacy-v1.js?v=20260817-test', label:'ad privacy controls' }
  ];

  function loadModule(mod) {
    if (window[mod.flag]) return Promise.resolve(true);
    const existing = document.querySelector(`script[${mod.marker}]`);
    if (existing) {
      return new Promise(resolve => {
        const started = Date.now();
        const poll = setInterval(() => {
          if (window[mod.flag] || Date.now() - started > 7000) {
            clearInterval(poll);
            resolve(Boolean(window[mod.flag]));
          }
        }, 60);
      });
    }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = mod.src;
      script.async = false;
      script.setAttribute(mod.marker, '1');
      script.onload = () => resolve(Boolean(window[mod.flag]));
      script.onerror = () => {
        console.warn(`NexusNova ${mod.label} could not load.`);
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  async function bootModules() {
    // Placement controller first: Watch Ad uses NexusNovaAds.requestRewarded().
    for (const mod of MODULES) await loadModule(mod);
    requestStatus();
    renderSettingsCard();
  }

  function nativeAvailable() {
    return typeof window.nexusPostNativeAction === 'function' ||
      typeof window.NexusAndroid?.postMessage === 'function';
  }

  function postNative(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload) !== false;
      }
      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function requestStatus() {
    if (nativeAvailable()) postNative('adStatus');
  }

  function settingsTab() {
    return document.getElementById('tab-about');
  }

  function ensureSettingsCard() {
    const tab = settingsTab();
    if (!tab) return null;
    let card = document.getElementById('nxAdTestSettingsCard');
    if (card) return card;

    card = document.createElement('div');
    card.id = 'nxAdTestSettingsCard';
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div style="font-size:9px;font-weight:900;letter-spacing:.16em;color:#60a5fa">MONETIZATION TEST</div>
          <h3 style="margin-top:4px">Ads • TESTING Edition</h3>
        </div>
        <span id="nxAdTestModeBadge" style="padding:6px 9px;border-radius:999px;border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.10);color:#86efac;font-size:9px;font-weight:900">TEST ONLY</span>
      </div>
      <p style="margin-top:8px;color:var(--sub);font-size:.8rem;line-height:1.55">
        Rewarded ads and limited natural-break interstitials are enabled for testing. Production ad IDs remain off.
      </p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px">
        <div style="padding:10px;border:1px solid rgba(96,165,250,.16);border-radius:13px;background:rgba(9,26,49,.58)"><small style="color:#7f9bb7">Rewarded</small><b id="nxAdRewardedState" style="display:block;margin-top:3px">Checking…</b></div>
        <div style="padding:10px;border:1px solid rgba(96,165,250,.16);border-radius:13px;background:rgba(9,26,49,.58)"><small style="color:#7f9bb7">Interstitial</small><b id="nxAdInterstitialState" style="display:block;margin-top:3px">Checking…</b></div>
      </div>
      <div style="margin-top:9px;color:#8fa8c0;font-size:10px;line-height:1.55">
        No forced ads: Wallet • Qibla • Islamic readers • Bible • Emergency • Health • Security • Login.
      </div>
      <button id="nxAdRefreshStatus" type="button" class="action-btn" style="width:100%;margin-top:10px">REFRESH TEST AD STATUS</button>
      <div id="nxAdTestSettingsStatus" class="status" role="status" style="margin-top:8px">Waiting for Android AdMob status…</div>`;

    tab.appendChild(card);
    card.querySelector('#nxAdRefreshStatus')?.addEventListener('click', () => {
      const status = document.getElementById('nxAdTestSettingsStatus');
      if (status) status.textContent = nativeAvailable()
        ? 'Refreshing AdMob TEST status…'
        : 'Native AdMob is available only inside the NexusNova Android TEST APK.';
      requestStatus();
    });
    return card;
  }

  function renderSettingsCard(detail = null) {
    const card = ensureSettingsCard();
    if (!card) return;
    const rewarded = document.getElementById('nxAdRewardedState');
    const interstitial = document.getElementById('nxAdInterstitialState');
    const status = document.getElementById('nxAdTestSettingsStatus');

    if (!nativeAvailable()) {
      if (rewarded) rewarded.textContent = 'Android only';
      if (interstitial) interstitial.textContent = 'Android only';
      if (status) status.textContent = 'Open this page in the NexusNova Android TEST APK to test native ads.';
      return;
    }

    if (!detail) {
      const web = window.NexusNovaAds?.status?.();
      if (rewarded) rewarded.textContent = 'TEST enabled';
      if (interstitial) interstitial.textContent = web?.interstitialReady ? 'Ready' : 'Preparing';
      if (status) status.textContent = 'TEST ad policy active • production ads disabled.';
      return;
    }

    const isTest = detail.testMode !== false;
    if (rewarded) rewarded.textContent = detail.rewardedReady === true ? 'Ready' : detail.rewardedLoading ? 'Loading' : 'Preparing';
    if (interstitial) interstitial.textContent = detail.interstitialReady === true ? 'Ready' : 'Preparing';
    if (status) status.textContent = isTest
      ? 'Google TEST inventory active • no production ad traffic.'
      : 'Production mode detected. Release should not be used until final monetization approval.';
    const badge = document.getElementById('nxAdTestModeBadge');
    if (badge) badge.textContent = isTest ? 'TEST ONLY' : 'PRODUCTION';
  }

  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    if (String(detail.event || '') === 'status') renderSettingsCard(detail);
  });

  const install = () => {
    void bootModules();
    ensureSettingsCard();
    [500,1500,3500,7000].forEach(ms => setTimeout(() => {
      ensureSettingsCard();
      renderSettingsCard();
    }, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
