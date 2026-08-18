/* NexusNova Account Deletion Settings v1
   Web-only Settings injection. Adds the Play-readiness account deletion path
   inside the existing Account card without changing auth, mining, rewards,
   Nova Hub, ads, or native APK code.
*/
(() => {
  'use strict';
  if (window.__nxAccountDeletionSettingsV1) return;
  window.__nxAccountDeletionSettingsV1 = true;

  const ROW_ID = 'nxAccountDeletionSettingsRow';
  const STYLE_ID = 'nxAccountDeletionSettingsStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROW_ID}{border-top:1px solid rgba(255,125,145,.16)!important}
      #${ROW_ID} strong{color:#ffb3c0!important}
      #${ROW_ID} small{color:var(--sub,#9bb0c8)!important}
      #${ROW_ID} .nx-delete-btn{border:1px solid rgba(255,125,145,.38)!important;background:rgba(111,30,50,.78)!important;color:#fff!important}
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

  function findAccountCard(settings) {
    return Array.from(settings.querySelectorAll('.settings-card, .card')).find(card => {
      const heading = card.querySelector('h2,h3');
      return String(heading?.textContent || '').trim().toLowerCase().includes('account');
    }) || null;
  }

  function installRow() {
    const settings = document.getElementById('tab-about');
    if (!settings || document.getElementById(ROW_ID)) return Boolean(document.getElementById(ROW_ID));

    const accountCard = findAccountCard(settings);
    if (!accountCard) return false;

    installStyle();
    const row = document.createElement('div');
    row.id = ROW_ID;
    row.className = 'settings-row';
    row.innerHTML = `
      <div>
        <strong>Delete Account</strong>
        <small>Request permanent deletion of your NexusNova account and associated personal data.</small>
      </div>
      <button type="button" class="settings-btn settings-reset nx-delete-btn" id="nxAccountDeletionBtn">Delete</button>`;

    accountCard.appendChild(row);
    row.querySelector('#nxAccountDeletionBtn')?.addEventListener('click', openDeletionPage);
    return true;
  }

  function boot() {
    if (installRow()) return;
    [200, 600, 1200, 2400, 5000, 9000].forEach(ms => setTimeout(installRow, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
