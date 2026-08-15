/* NexusNova Ad Privacy v1
   Shows the Google UMP privacy-options entry point only when native UMP says
   it is REQUIRED. The control is hidden for test builds and users/regions where
   Google says no publisher-rendered privacy entry point is required.
*/
(() => {
  'use strict';
  if (window.__nxAdPrivacyV1) return;
  window.__nxAdPrivacyV1 = true;

  const CARD_ID = 'nxAdPrivacyCard';
  const STATUS_ID = 'nxAdPrivacyStatus';

  function postNative(action) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, {}) !== false;
      }
      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function settingsTab() {
    return document.getElementById('tab-about');
  }

  function ensureCard() {
    const tab = settingsTab();
    if (!tab) return null;
    let card = document.getElementById(CARD_ID);
    if (card) return card;

    card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    card.hidden = true;
    card.innerHTML = `
      <h3>Ad Privacy Choices</h3>
      <p style="margin-top:7px;color:var(--sub);font-size:.82rem;line-height:1.55">
        Manage the privacy choices used for Google ads on this device.
      </p>
      <button type="button" class="action-btn" data-nx-ad-privacy-open
              style="width:100%;margin-top:10px">
        MANAGE AD PRIVACY
      </button>
      <div id="${STATUS_ID}" class="status" role="status" style="margin-top:8px">
        Privacy options ready.
      </div>`;

    const hero = tab.querySelector('.settings-hero');
    if (hero?.nextSibling) tab.insertBefore(card, hero.nextSibling);
    else if (hero) hero.insertAdjacentElement('afterend', card);
    else tab.prepend(card);

    card.querySelector('[data-nx-ad-privacy-open]')?.addEventListener('click', () => {
      const status = document.getElementById(STATUS_ID);
      if (status) status.textContent = 'Opening Google privacy choices…';
      if (!postNative('showAdPrivacyOptions') && status) {
        status.textContent = 'Privacy choices are available in the NexusNova Android app.';
      }
    });
    return card;
  }

  function applyStatus(detail = {}) {
    const card = ensureCard();
    if (!card) return;
    const required = detail.required === true;
    const testMode = detail.testMode === true;
    card.hidden = !required || testMode;
    if (!required || testMode) return;

    const status = document.getElementById(STATUS_ID);
    const error = String(detail.error || '').trim();
    if (status) status.textContent = error
      ? `Privacy form: ${error.slice(0,140)}`
      : 'You can review or change your Google ad privacy choices here.';
  }

  window.addEventListener('nexusnova:ad-privacy-event', event => {
    applyStatus(event?.detail || {});
  });

  const observer = new MutationObserver(() => {
    if (settingsTab()) ensureCard();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureCard();
      postNative('adPrivacyStatus');
    }, { once:true });
  } else {
    ensureCard();
    postNative('adPrivacyStatus');
  }
  setTimeout(() => postNative('adPrivacyStatus'), 1800);
})();
