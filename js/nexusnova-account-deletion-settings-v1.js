/* NexusNova Essential Settings v3 - single owner
   Deliberately tiny Settings: Account essentials + Appearance/Theme only,
   with Privacy Policy, Delete Account and Sign out kept visible.
   No mining, Nova Hub, rewards, wallet, market or sign-in logic is changed.
*/
(() => {
  'use strict';
  if (window.__nxEssentialSettingsV3) return;
  window.__nxEssentialSettingsV3 = true;

  const PUBLIC_BASE = 'https://fahadsoomro123.github.io/nexusnova-app/';
  const DELETE_ID = 'nxAccountDeletionSettingsRow';
  const PRIVACY_ID = 'nxPrivacyPolicySettingsRow';
  const STYLE_ID = 'nxEssentialSettingsV3Style';

  function publicUrl(file) {
    try {
      const current = new URL(window.location.href);
      if (current.hostname.toLowerCase() === 'fahadsoomro123.github.io' && current.pathname.startsWith('/nexusnova-native/')) {
        return new URL(file, PUBLIC_BASE).href;
      }
      return new URL(file, current.href).href;
    } catch (_) {
      return new URL(file, PUBLIC_BASE).href;
    }
  }

  function openPublic(file) {
    const url = publicUrl(file);
    try {
      if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
        window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
        return;
      }
    } catch (_) {}
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch (_) {}
    window.location.href = url;
  }

  window.openNexusPrivacyPolicy = () => openPublic('privacy-policy.html');
  window.openNexusAccountDeletion = () => openPublic('account-deletion.html');

  const text = el => String(el?.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
  const cards = settings => Array.from(settings.querySelectorAll('.settings-card'));
  const cardBy = (settings, name) => cards(settings).find(card => text(card.querySelector('h2,h3')).includes(name)) || null;
  const rowBy = (card, label) => Array.from(card?.querySelectorAll('.settings-row') || []).find(row => text(row.querySelector('strong')) === String(label).toLowerCase()) || null;

  function addRow(card, id, title, copy, buttonText, handler, danger=false) {
    if (!card) return;
    let row = document.getElementById(id);
    if (!row) {
      row = document.createElement('div');
      row.id = id;
      row.className = 'settings-row';
      row.innerHTML = `<div><strong>${title}</strong><small>${copy}</small></div><button type="button" class="settings-btn ${danger ? 'settings-logout nx-delete-btn' : 'settings-reset'}">${buttonText}</button>`;
      card.appendChild(row);
    }
    const button = row.querySelector('button');
    if (button) {
      button.id = id === PRIVACY_ID ? 'nxPrivacyPolicyBtn' : 'nxAccountDeletionBtn';
      if (button.dataset.nxEssentialBound !== '1') {
        button.dataset.nxEssentialBound = '1';
        button.addEventListener('click', handler);
      }
    }
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-about .settings-hero{padding:13px 15px!important;margin-bottom:9px!important;border-radius:17px!important}
      #tab-about .settings-hero h2{font-size:17px!important;margin:0!important}
      #tab-about .settings-hero .settings-muted{font-size:9px!important;margin-top:3px!important;line-height:1.35!important}
      #tab-about .settings-version{font-size:8px!important;padding:4px 6px!important}
      #tab-about .settings-card{padding:11px 13px!important;margin-bottom:9px!important;border-radius:16px!important}
      #tab-about .settings-card>h3{font-size:12px!important;margin:0 0 3px!important}
      #tab-about .settings-row{padding:8px 0!important;min-height:0!important;gap:8px!important}
      #tab-about .settings-row strong{font-size:10.5px!important;line-height:1.2!important}
      #tab-about .settings-row small{font-size:8.5px!important;line-height:1.3!important;margin-top:2px!important}
      #tab-about .settings-btn,#tab-about .settings-select{font-size:8.5px!important;min-height:29px!important;padding:6px 8px!important;border-radius:9px!important}
      #${DELETE_ID}{border-top:1px solid rgba(255,120,145,.18)!important}
      #${DELETE_ID} strong{color:#ffb1bf!important}
      #${DELETE_ID} .nx-delete-btn{border-color:rgba(255,125,145,.38)!important;background:rgba(111,30,50,.78)!important;color:#fff!important}
      #${PRIVACY_ID}{border-top:1px solid rgba(94,177,255,.12)!important}
    `;
    document.head.appendChild(style);
  }

  function simplify() {
    const settings = document.getElementById('tab-about');
    if (!settings) return false;
    installStyle();

    const hero = settings.querySelector('.settings-hero');
    if (hero) {
      const h = hero.querySelector('h2');
      const p = hero.querySelector('.settings-muted');
      if (h) h.textContent = '⚙️ Settings';
      if (p) p.textContent = 'Account and essential preferences.';
    }

    const account = cardBy(settings, 'account');
    const appearance = cardBy(settings, 'appearance');

    if (account) {
      addRow(account, PRIVACY_ID, 'Privacy Policy', 'Read NexusNova privacy information.', 'Open', window.openNexusPrivacyPolicy);
      addRow(account, DELETE_ID, 'Delete Account', 'Request permanent account and data deletion.', 'Delete', window.openNexusAccountDeletion, true);
      const signout = rowBy(account, 'sign out');
      if (signout) account.appendChild(signout);
    }

    if (appearance) {
      const heading = appearance.querySelector('h3');
      if (heading) heading.textContent = 'Appearance';
      Array.from(appearance.querySelectorAll('.settings-row')).forEach(row => {
        if (text(row.querySelector('strong')) !== 'theme') row.remove();
      });
    }

    cards(settings).forEach(card => {
      if (card !== account && card !== appearance) card.remove();
    });

    document.documentElement.dataset.nxSettingsSimple = '1';
    document.documentElement.dataset.nxSettingsVersion = '3';
    return Boolean(account);
  }

  function boot() {
    simplify();
    [150,450,1000,2200,4500].forEach(ms => setTimeout(simplify, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();