/* NexusNova existing-app ad hotfix v2
   Web-only repair for the already-installed Android TEST app.

   Purpose:
   - Keep Tasks > Watch Ad completely independent from Mining Booster/Nova Rain.
   - Show capped TEST interstitials after meaningful utility use, not only after
     pressing an in-app Back button.
   - Provide a TEST rewarded preview even while Daily Reward is on cooldown.
   - Preserve the 3-minute native cooldown, max 4 interstitials per session and
     all protected/ad-free NexusNova areas.
   - No APK/native rebuild and no NVX/mining value mutation.
*/
(() => {
  'use strict';
  if (window.__nxExistingAppAdHotfixV2) return;
  window.__nxExistingAppAdHotfixV2 = true;

  const WATCH_BUTTON_ID = 'nxWatchAdRewardBtn';
  const WATCH_LABEL = 'WATCH REWARDED AD (+2.5 NVX)';
  const TASKS_ID = 'tab-tasks';
  const PREVIEW_BUTTON_ID = 'nxAdRewardedPreviewV2';
  let taskObserver = null;
  let repairQueued = false;
  let lastInterstitialAttemptAt = 0;
  let lastInterstitialAttemptKey = '';

  const $ = selector => document.querySelector(selector);

  function taskWatchButton() {
    return $('#tab-tasks button[onclick*="watchAdReward"]');
  }

  function setButtonLabel(button) {
    if (!button) return;
    const icon = button.querySelector('.mi-icon');
    const current = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (current === WATCH_LABEL) return;
    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon && icon.parentNode !== button) button.appendChild(icon);
    button.appendChild(document.createTextNode(` ${WATCH_LABEL}`));
  }

  function removeMiningTaskStatus() {
    document.querySelectorAll('#tab-tasks #rewardedAdStatus').forEach(node => node.remove());
  }

  function repairTaskWatchAd() {
    repairQueued = false;
    const button = taskWatchButton();
    if (!button) return false;

    // The mining bridge locates the task button using either rewardedAdBtn or
    // the literal text "Watch Ad". Give the real task its own id and a label
    // that does not match that mining selector, while keeping user meaning clear.
    if (button.id === 'rewardedAdBtn') button.removeAttribute('id');
    button.id = WATCH_BUTTON_ID;
    button.setAttribute('onclick', 'watchAdReward()');

    const text = String(button.textContent || '');
    if (button.disabled && /mining|boost|session|preparing/i.test(text)) {
      button.disabled = false;
    }

    setButtonLabel(button);
    removeMiningTaskStatus();
    return true;
  }

  function queueRepair() {
    if (repairQueued) return;
    repairQueued = true;
    queueMicrotask(repairTaskWatchAd);
  }

  function installTaskGuard() {
    const tasks = document.getElementById(TASKS_ID);
    if (!tasks || taskObserver) return;
    taskObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
        if (!target) continue;
        if (
          target.closest?.('#tab-tasks') &&
          (target.matches?.('#rewardedAdStatus,#nxWatchAdRewardBtn,#rewardedAdBtn,button') ||
           target.querySelector?.('#rewardedAdStatus,#rewardedAdBtn,button[onclick*="watchAdReward"]'))
        ) {
          queueRepair();
          break;
        }
      }
    });
    taskObserver.observe(tasks, { childList:true, subtree:true, attributes:true, attributeFilter:['id','disabled','onclick'] });
  }

  function ensureRewardedPreviewButton() {
    const card = document.getElementById('nxAdTestSettingsCard');
    if (!card || document.getElementById(PREVIEW_BUTTON_ID)) return;
    const refresh = card.querySelector('#nxAdRefreshStatus');
    if (!refresh) return;

    const button = document.createElement('button');
    button.id = PREVIEW_BUTTON_ID;
    button.type = 'button';
    button.className = 'action-btn primary';
    button.style.width = '100%';
    button.style.marginTop = '8px';
    button.textContent = 'TEST REWARDED AD PREVIEW • NO NVX';
    button.addEventListener('click', () => {
      const status = document.getElementById('nxAdTestSettingsStatus');
      const ads = window.NexusNovaAds;
      if (!ads?.requestRewarded) {
        if (status) status.textContent = 'Rewarded TEST service is still loading. Try again in a moment.';
        return;
      }
      const result = ads.requestRewarded('daily-reward-test', { previewOnly:true, testOnly:true });
      if (status) status.textContent = result?.shown
        ? 'Opening Google TEST rewarded preview • this never adds NVX.'
        : 'TEST rewarded ad is not ready yet. Try Refresh Test Ad Status.';
    });
    refresh.insertAdjacentElement('beforebegin', button);
  }

  function featureFromElement(element) {
    const tab = element?.closest?.('.tab[id^="tab-"]');
    return String(tab?.id || '').replace(/^tab-/, '').trim().toLowerCase();
  }

  function actionKey(element, feature) {
    return `${feature}:${String(
      element?.id ||
      element?.getAttribute?.('onclick') ||
      element?.getAttribute?.('name') ||
      element?.textContent ||
      element?.tagName || ''
    ).replace(/\s+/g,' ').trim().slice(0,90)}`;
  }

  function scheduleUtilityInterstitial(element, placement = 'utility-result') {
    const feature = featureFromElement(element);
    if (!feature) return;

    // Let the existing placement controller count/render the action first.
    setTimeout(() => {
      const ads = window.NexusNovaAds;
      if (!ads?.maybeInterstitial || !ads?.status || !ads?.isEligibleFeature?.(feature)) return;

      const status = ads.status();
      if (status?.interstitialPending) return;

      // The base controller counts one engagement in capture phase. Requiring
      // two accumulated engagements here means the next maybeInterstitial()
      // becomes the third eligible break and can display the first ad. This is
      // intentionally easier to encounter than the old Back-button-only flow,
      // without showing ads on app open.
      if (Number(status?.eligibleBreakCount || 0) < 2) return;

      const now = Date.now();
      const key = actionKey(element, feature);
      if (key === lastInterstitialAttemptKey && now - lastInterstitialAttemptAt < 1800) return;
      if (now - lastInterstitialAttemptAt < 1000) return;

      lastInterstitialAttemptAt = now;
      lastInterstitialAttemptKey = key;

      // Give calculators/search/tools enough time to paint the result before
      // the fullscreen TEST ad is requested.
      setTimeout(() => {
        const liveAds = window.NexusNovaAds;
        if (!liveAds?.isEligibleFeature?.(feature)) return;
        liveAds.maybeInterstitial(placement, { feature, existingAppHotfix:true });
      }, 850);
    }, 120);
  }

  document.addEventListener('click', event => {
    const action = event.target?.closest?.('button,[role="button"],input[type="submit"],a[data-nx-action]');
    if (!action) return;

    if (action.closest('#tab-tasks') && /watchAdReward\s*\(/i.test(String(action.getAttribute('onclick') || ''))) {
      repairTaskWatchAd();
      return;
    }

    if (action.closest('.nx-allapps-back,.tools-main-back,.bottom-dock,#moreMenu,#nxAdTestSettingsCard')) return;
    scheduleUtilityInterstitial(action, 'utility-result');
  }, false);

  // Some useful tools finish on select/date/toggle changes instead of a button.
  // Use change (not input/keyup) so typing never triggers an interstitial.
  document.addEventListener('change', event => {
    const control = event.target;
    if (!control?.closest?.('.tab[id^="tab-"]')) return;
    if (control.closest('#tab-tasks,#tab-wallet,#tab-about,#tab-profile')) return;
    scheduleUtilityInterstitial(control, 'utility-result-change');
  }, false);

  // Keep the task separation intact after every native ad status/reward event.
  window.addEventListener('nexusnova:native-ad-event', () => {
    queueRepair();
    ensureRewardedPreviewButton();
  });

  function boot() {
    repairTaskWatchAd();
    installTaskGuard();
    ensureRewardedPreviewButton();
    [200,500,1000,1800,3000,5000,8000,12000,18000].forEach(ms => setTimeout(() => {
      repairTaskWatchAd();
      installTaskGuard();
      ensureRewardedPreviewButton();
    }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
