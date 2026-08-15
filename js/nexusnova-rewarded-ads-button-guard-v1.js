/* NexusNova Rewarded Ads button guard v1.2.
   Keeps legacy handlers from minting/intercepting Watch Ad while the native
   AdMob bridge owns the current 2-hour mining-boost reward flow.
*/
(() => {
  'use strict';
  if (window.__nxRewardedAdsButtonGuardV1) return;
  window.__nxRewardedAdsButtonGuardV1 = true;

  function findButton() {
    return document.getElementById('rewardedAdBtn') ||
      Array.from(document.querySelectorAll('#tab-tasks button'))
        .find(button => /watch\s*ad/i.test(String(button.textContent || '')));
  }

  function relabel(button) {
    if (!button) return;
    // Once the mining-boost bridge is active it owns the dynamic Booster/Rain
    // label and status. The guard must not overwrite that richer state.
    if (window.__nxAdMobMiningBoostV1) return;
    const icon = button.querySelector('.mi-icon');
    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon) button.appendChild(icon);
    button.appendChild(document.createTextNode(' WATCH AD — MINING BOOST (-2H)'));
  }

  function ensureStatus(button) {
    let status = document.getElementById('rewardedAdStatus');
    if (!status && button) {
      status = document.createElement('div');
      status.id = 'rewardedAdStatus';
      status.className = 'status';
      status.style.marginTop = '8px';
      status.style.fontSize = '11px';
      status.textContent = 'AdMob mining boost • Android app';
      button.insertAdjacentElement('afterend', status);
    }
    return status;
  }

  function bind() {
    const button = findButton();
    if (!button) return;
    button.id = 'rewardedAdBtn';
    relabel(button);
    ensureStatus(button);
    if (!window.__nxAdMobMiningBoostV1) {
      button.title = 'Watch an optional rewarded ad for a 2-hour mining-time reduction. No advertiser click or install is required.';
    }
    if (button.dataset.nxSecureRewardedBound === '1') return;
    button.dataset.nxSecureRewardedBound = '1';

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const show = window.NexusNovaRewardedAds?.show;
      if (typeof show !== 'function') {
        console.warn('NexusNova rewarded ads bridge is unavailable.');
        return;
      }
      Promise.resolve(show()).catch(error => console.warn('NexusNova rewarded ad action:', error));
    }, true);
  }

  bind();
  window.addEventListener('load', bind, {once:true});
  [250,700,1500,3000,6000].forEach(ms => setTimeout(bind, ms));
})();
