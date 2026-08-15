/* NexusNova Rewarded Ads button guard v1.1.
   Keeps legacy handlers from minting/intercepting Watch Ad and presents the
   current non-transferable Nexus Pass reward model.
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
    const icon = button.querySelector('.mi-icon');
    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon) button.appendChild(icon);
    button.appendChild(document.createTextNode(' WATCH AD — UNLOCK 20 MIN NEXUS PASS'));
  }

  function ensureStatus(button) {
    let status = document.getElementById('rewardedAdStatus');
    if (!status && button) {
      status = document.createElement('div');
      status.id = 'rewardedAdStatus';
      status.className = 'status';
      status.style.marginTop = '8px';
      status.style.fontSize = '11px';
      status.textContent = 'AdMob rewarded ads • Android app';
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
    button.title = 'Watch an optional rewarded ad to unlock Nexus Pass. Advertiser clicks or installs are not required.';
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
