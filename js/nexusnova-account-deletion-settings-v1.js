/* NexusNova Essential Settings v2
   Web-only Settings cleanup. Keeps only useful account/preferences controls,
   plus Privacy Policy and account deletion. No mining, Nova Hub, rewards,
   navigation, ads, wallet, market, or native APK logic is changed.
*/
(() => {
  'use strict';
  if (window.__nxEssentialSettingsV2) return;
  window.__nxEssentialSettingsV2 = true;

  const DELETE_ROW_ID = 'nxAccountDeletionSettingsRow';
  const PRIVACY_ROW_ID = 'nxPrivacyPolicySettingsRow';
  const STYLE_ID = 'nxEssentialSettingsStyleV2';

  function openSameOriginPage(path) {
    const url = new URL(path, window.location.href).href;
    try {
      if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
        window.NexusBrowserAndroid.postMessage(JSON.stringify({ action: 'open', url }));
        return;
      }
    } catch (error) {
      console.warn('NexusNova Settings browser bridge:', error);
    }

    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch (_) {}

    window.location.href = url;
  }

  window.openNexusAccountDeletion = () => openSameOriginPage('./account-deletion.html');
  window.openNexusPrivacyPolicy = () => openSameOriginPage('./privacy-policy.html');

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-about .settings-hero{padding:14px 16px!important;margin-bottom:10px!important;border-radius:18px!important}
      #tab-about .settings-hero h2{font-size:18px!important;margin:0!important}
      #tab-about .settings-hero .settings-muted{font-size:10px!important;margin-top:4px!important;line-height:1.35!important}
      #tab-about .settings-version{font-size:9px!important;padding:5px 7px!important}
      #tab-about .settings-card{padding:12px 14px!important;margin-bottom:10px!important;border-radius:17px!important}
      #tab-about .settings-card>h3{font-size:13px!important;margin:0 0 4px!important}
      #tab-about .settings-row{padding:9px 0!important;min-height:0!important;gap:8px!important}
      #tab-about .settings-row strong{font-size:11px!important;line-height:1.25!important}
      #tab-about .settings-row small{font-size:9px!important;line-height:1.35!important;margin-top:2px!important}
      #tab-about .settings-btn,#tab-about .settings-select{font-size:9px!important;min-height:30px!important;padding:6px 8px!important;border-radius:9px!important}
      #tab-about .settings-actions{gap:5px!important}
      #${DELETE_ROW_ID}{border-top:1px solid rgba(255,125,145,.16)!important}
      #${DELETE_ROW_ID} strong{color:#ffb3c0!important}
      #${DELETE_ROW_ID} .nx-delete-btn{border:1px solid rgba(255,125,145,.38)!important;background:rgba(111,30,50,.78)!important;color:#fff!important}
      #${PRIVACY_ROW_ID}{border-top:1px solid rgba(94,177,255,.12)!important}
    `;
    document.head.appendChild(style);
  }

  function headingText(card) {
    return String(card?.querySelector('h2,h3')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findCard(settings, needle) {
    return Array.from(settings.querySelectorAll('.settings-card')).find(card =>
      headingText(card).includes(String(needle).toLowerCase())
    ) || null;
  }

  function findRow(card, label) {
    return Array.from(card?.querySelectorAll('.settings-row') || []).find(row =>
      String(row.querySelector('strong')?.textContent || '')
        .trim()
        .toLowerCase() === String(label).toLowerCase()
    ) || null;
  }

  function addPrivacyRow(accountCard) {
    if (!accountCard || document.getElementById(PRIVACY_ROW_ID)) return;
    const row = document.createElement('div');
    row.id = PRIVACY_ROW_ID;
    row.className = 'settings-row';
    row.innerHTML = `
      <div>
        <strong>Privacy Policy</strong>
        <small>Read how NexusNova handles account and app data.</small>
      </div>
      <button type="button" class="settings-btn settings-reset" id="nxPrivacyPolicyBtn">Open</button>`;
    accountCard.appendChild(row);
    row.querySelector('#nxPrivacyPolicyBtn')?.addEventListener('click', window.openNexusPrivacyPolicy);
  }

  function addDeletionRow(accountCard) {
    if (!accountCard || document.getElementById(DELETE_ROW_ID)) return;
    const row = document.createElement('div');
    row.id = DELETE_ROW_ID;
    row.className = 'settings-row';
    row.innerHTML = `
      <div>
        <strong>Delete Account</strong>
        <small>Request permanent deletion of your NexusNova account and associated data.</small>
      </div>
      <button type="button" class="settings-btn settings-reset nx-delete-btn" id="nxAccountDeletionBtn">Delete</button>`;
    accountCard.appendChild(row);
    row.querySelector('#nxAccountDeletionBtn')?.addEventListener('click', window.openNexusAccountDeletion);
  }

  function simplifySettings() {
    const settings = document.getElementById('tab-about');
    if (!settings) return false;

    installStyle();

    const hero = settings.querySelector('.settings-hero');
    if (hero) {
      const title = hero.querySelector('h2');
      const subtitle = hero.querySelector('.settings-muted');
      if (title) title.textContent = '⚙️ Settings';
      if (subtitle) subtitle.textContent = 'Account and essential app preferences.';
    }

    const accountCard = findCard(settings, 'account');
    const appearanceCard = findCard(settings, 'appearance');
    const aiCard = findCard(settings, 'ai');

    if (accountCard) {
      addPrivacyRow(accountCard);
      addDeletionRow(accountCard);

      // Keep Sign out as the final normal account action.
      const signOutRow = findRow(accountCard, 'Sign out');
      if (signOutRow) accountCard.appendChild(signOutRow);
    }

    if (appearanceCard) {
      const heading = appearanceCard.querySelector('h3');
      if (heading) heading.textContent = 'Preferences';

      // Compact mode created extra layout variation without being essential.
      findRow(appearanceCard, 'Compact mode')?.remove();

      // Keep the two useful AI preferences but merge them into one small card.
      if (aiCard) {
        const aiLanguage = findRow(aiCard, 'AI language');
        const voiceReplies = findRow(aiCard, 'Voice replies');
        if (aiLanguage) appearanceCard.appendChild(aiLanguage);
        if (voiceReplies) appearanceCard.appendChild(voiceReplies);
        aiCard.remove();
      }
    } else if (aiCard) {
      // If the appearance card is missing, leave AI intact rather than losing controls.
      findRow(aiCard, 'Clear saved AI data')?.remove();
    }

    // These built-in cards are either informational, duplicated by feature-level
    // permission prompts, or preferences that are not essential to daily use.
    [
      'notifications',
      'privacy & permissions',
      'general',
      'system status',
      'support & about'
    ].forEach(label => findCard(settings, label)?.remove());

    document.documentElement.dataset.nxSettingsSimple = '1';
    return Boolean(accountCard);
  }

  function boot() {
    simplifySettings();
    [250, 700, 1500, 3500].forEach(ms => setTimeout(simplifySettings, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
