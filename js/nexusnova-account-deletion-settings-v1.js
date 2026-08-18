/* NexusNova Account Deletion Settings v1
   Web-only Settings injection. Adds a Play-readiness account deletion path
   without changing auth, mining, rewards, Nova Hub, ads, or native APK code.
*/
(() => {
  'use strict';
  if (window.__nxAccountDeletionSettingsV1) return;
  window.__nxAccountDeletionSettingsV1 = true;

  const CARD_ID = 'nxAccountDeletionSettingsCard';
  const STYLE_ID = 'nxAccountDeletionSettingsStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{border-color:rgba(255,125,145,.22)!important;background:linear-gradient(145deg,rgba(42,17,29,.58),rgba(10,18,31,.94))!important}
      #${CARD_ID} .nx-delete-kicker{font-size:9px;font-weight:900;letter-spacing:.16em;color:#ff9aad;text-transform:uppercase}
      #${CARD_ID} h3{margin:5px 0 6px;color:#fff;font-size:16px}
      #${CARD_ID} p{margin:0;color:var(--sub,#9bb0c8);font-size:11px;line-height:1.55}
      #${CARD_ID} .nx-delete-btn{width:100%;margin-top:12px;border:1px solid rgba(255,125,145,.36);border-radius:13px;padding:11px 12px;background:linear-gradient(135deg,rgba(133,33,57,.92),rgba(86,23,42,.95));color:#fff;font-size:10px;font-weight:900;letter-spacing:.05em;cursor:pointer;touch-action:manipulation}
      #${CARD_ID} .nx-delete-btn:active{transform:translateY(1px)}
    `;
    document.head.appendChild(style);
  }

  function openDeletionPage() {
    const url = new URL('./account-deletion.html', window.location.href).href;
    try {
      if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
        window.NexusBrowserAndroid.postMessage(JSON.stringify({action:'open', url}));
        return;
      }
    } catch (error) {
      console.warn('NexusNova account deletion browser bridge:', error);
    }

    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch (_) {}

    window.location.href = url;
  }

  window.openNexusAccountDeletion = openDeletionPage;

  function installCard() {
    const settings = document.getElementById('tab-about');
    if (!settings || document.getElementById(CARD_ID)) return false;

    installStyle();
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    card.innerHTML = `
      <div class="nx-delete-kicker">ACCOUNT & PRIVACY</div>
      <h3>Delete Account</h3>
      <p>Request permanent deletion of your NexusNova account and associated personal data.</p>
      <button type="button" class="nx-delete-btn" id="nxAccountDeletionBtn">REQUEST ACCOUNT DELETION</button>`;

    settings.appendChild(card);
    card.querySelector('#nxAccountDeletionBtn')?.addEventListener('click', openDeletionPage);
    return true;
  }

  function boot() {
    if (installCard()) return;
    [250, 800, 1800, 3500, 7000].forEach(ms => setTimeout(installCard, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
