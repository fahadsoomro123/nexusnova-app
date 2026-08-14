/* NexusNova Rewarded Ads button guard v1.
   Ensures legacy reward handlers cannot mint or intercept the Watch Ad action.
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

  function ensureStatus(button) {
    let status = document.getElementById('rewardedAdStatus');
    if (!status && button) {
      status = document.createElement('div');
      status.id = 'rewardedAdStatus';
      status.className = 'status';
      status.style.marginTop = '8px';
      status.style.fontSize = '11px';
      status.textContent = 'Secure ad bridge ready • publisher setup pending';
      button.insertAdjacentElement('afterend', status);
    }
    return status;
  }

  function bind() {
    const button = findButton();
    if (!button) return;
    if (!button.id) button.id = 'rewardedAdBtn';
    ensureStatus(button);
    if (button.dataset.nxSecureRewardedBound === '1') return;
    button.dataset.nxSecureRewardedBound = '1';
    button.title = 'Reward is credited only after verified ad completion.';

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
