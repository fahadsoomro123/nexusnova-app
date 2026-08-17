/* NexusNova existing-app ad hotfix v1
   Web-only repair for the already-installed Android TEST app.

   Goals:
   - Keep Tasks > Watch Ad independent from Mining Booster/Nova Rain.
   - Do not let the mining bridge relabel/disable the +2.5 NVX test-ad button.
   - Request capped interstitials after real utility actions once the existing
     3-interaction warmup has been reached.
   - Respect NexusNovaAds protected-feature policy and native cooldown/session caps.
   - No APK/native change and no reward-value mutation.
*/
(() => {
  'use strict';
  if (window.__nxExistingAppAdHotfixV1) return;
  window.__nxExistingAppAdHotfixV1 = true;

  const WATCH_BUTTON_ID = 'nxWatchAdRewardBtn';
  const WATCH_LABEL = 'WATCH REWARDED AD (+2.5 NVX)';
  let taskObserver = null;
  let watchedButton = null;
  let lastInterstitialAttemptAt = 0;
  let lastInterstitialAttemptKey = '';

  function taskWatchButton() {
    return document.querySelector('#tab-tasks button[onclick*="watchAdReward"]');
  }

  function setButtonLabel(button, text) {
    if (!button) return;
    const icon = button.querySelector('.mi-icon');
    const current = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (current === text && button.id === WATCH_BUTTON_ID) return;

    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon && icon.parentNode !== button) button.appendChild(icon);
    button.appendChild(document.createTextNode(` ${text}`));
  }

  function removeMiningTaskStatus() {
    const node = document.getElementById('rewardedAdStatus');
    if (node?.closest?.('#tab-tasks')) node.remove();
  }

  function repairTaskWatchAd() {
    const button = taskWatchButton();
    if (!button) return false;

    if (button.id === 'rewardedAdBtn') button.removeAttribute('id');
    if (button.id !== WATCH_BUTTON_ID) button.id = WATCH_BUTTON_ID;
    if (button.getAttribute('onclick') !== 'watchAdReward()') {
      button.setAttribute('onclick', 'watchAdReward()');
    }

    // Mining completion/booster state must never disable the independent
    // Tasks rewarded-ad test. The watch-ad security module can still disable
    // it itself when its own capability/server contract requires that.
    if (button.disabled && /mining|boost|session/i.test(String(button.textContent || ''))) {
      button.disabled = false;
    }

    setButtonLabel(button, WATCH_LABEL);
    removeMiningTaskStatus();

    if (watchedButton !== button) {
      taskObserver?.disconnect();
      watchedButton = button;
      taskObserver = new MutationObserver(() => {
        const text = String(button.textContent || '');
        const hijacked = button.id === 'rewardedAdBtn' || /mining\s*boost|nova\s*booster|nova\s*rain|claim\s*session|preparing\s*mining/i.test(text);
        if (hijacked) queueMicrotask(repairTaskWatchAd);
        removeMiningTaskStatus();
      });
      taskObserver.observe(button, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id', 'disabled']
      });
    }
    return true;
  }

  function activeFeatureFromAction(action) {
    const tab = action?.closest?.('.tab[id^="tab-"]');
    return String(tab?.id || '').replace(/^tab-/, '').trim().toLowerCase();
  }

  function maybeShowUtilityInterstitial(action) {
    const ads = window.NexusNovaAds;
    if (!ads?.maybeInterstitial || !ads?.status || !ads?.isEligibleFeature) return;
    if (!action || action.closest('.nx-allapps-back,.tools-main-back')) return;

    const feature = activeFeatureFromAction(action);
    if (!feature || !ads.isEligibleFeature(feature)) return;

    // nexusnova-ad-placements-v1 counts the eligible action in capture phase.
    // Only attempt a fullscreen ad once its existing 3-action warmup is ready.
    const status = ads.status();
    if (Number(status?.eligibleBreakCount || 0) < 3) return;
    if (status?.interstitialPending) return;

    const now = Date.now();
    const key = `${feature}:${String(action.id || action.getAttribute('onclick') || action.textContent || '').slice(0, 80)}`;
    if (key === lastInterstitialAttemptKey && now - lastInterstitialAttemptAt < 1500) return;
    if (now - lastInterstitialAttemptAt < 900) return;

    lastInterstitialAttemptAt = now;
    lastInterstitialAttemptKey = key;

    // Give the utility time to render its result first. The native owner still
    // enforces its own readiness/cooldown checks, so unavailable/no-fill does
    // not consume a session slot.
    setTimeout(() => {
      const liveAds = window.NexusNovaAds;
      if (!liveAds?.maybeInterstitial || !liveAds?.isEligibleFeature?.(feature)) return;
      liveAds.maybeInterstitial('utility-result', { feature });
    }, 700);
  }

  document.addEventListener('click', event => {
    const action = event.target?.closest?.('button,[role="button"],input[type="submit"]');
    if (!action) return;

    // Always repair the Tasks button before its click handler runs in case a
    // late mining-state render tried to take ownership of it.
    if (action.closest('#tab-tasks') && /watchAdReward\s*\(/i.test(String(action.getAttribute('onclick') || ''))) {
      repairTaskWatchAd();
      return;
    }

    maybeShowUtilityInterstitial(action);
  }, false);

  window.addEventListener('nexusnova:native-ad-event', () => {
    repairTaskWatchAd();
  });

  function boot() {
    repairTaskWatchAd();
    [250, 700, 1400, 2600, 4500, 8000].forEach(ms => setTimeout(repairTaskWatchAd, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
