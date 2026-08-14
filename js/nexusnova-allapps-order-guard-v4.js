/* NexusNova ALL APPS Order + Back Control Guard v4 */
(() => {
  'use strict';

  const ORDER = [
    'TOOLS','GOLD/FX','NEWS','CHAT',
    'AI','LOCATION','SOS','FAMILY',
    'PROFILE','DAILY','BUDGET','LEARN',
    'TRAVEL','HEALTH','SMART','QIBLA',
    'PK NEWS','WATCH','BROWSER','CALLER',
    'SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR',
    'REMINDERS','FINANCE','WEATHER','LEARNING',
    'PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS',
    'CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT',
    'QR TOOLS','SECURITY','MARKETPLACE','ORDERS',
    'NOTIFICATIONS','TEACHER TOOLKIT'
  ];

  let busy = false;

  function labelOf(button) {
    return String(button?.textContent || '').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function targetOf(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return button.dataset.nxmega;
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    const match = code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function enforceOrder() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || busy) return;
    busy = true;
    try {
      const buttons = Array.from(inner.children).filter(el => el.classList?.contains('more-item'));
      const byLabel = new Map(buttons.map(button => [labelOf(button), button]));
      ORDER.forEach(label => {
        const button = byLabel.get(label);
        if (button) inner.appendChild(button);
      });
      // Keep any future/unknown items after the approved list rather than deleting them.
      buttons.filter(button => !ORDER.includes(labelOf(button))).forEach(button => inner.appendChild(button));
    } finally {
      busy = false;
    }
  }

  function addBack(tab) {
    if (!tab || tab.id === 'tab-tools') return;
    if (tab.querySelector(':scope > .nx-allapps-back')) return;
    const bar = document.createElement('div');
    bar.className = 'nx-allapps-back';
    bar.innerHTML = '<button class="tool-btn" type="button" data-nx-back-allapps>← Back to ALL APPS</button>';
    bar.querySelector('button').addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      window.nexusBackToAllApps?.();
    });
    tab.insertBefore(bar, tab.firstChild);
  }

  function ensureBackControls() {
    const buttons = Array.from(document.querySelectorAll('#moreMenu .more-item'));
    const targets = new Set(buttons.map(targetOf).filter(Boolean));
    targets.add('bible');
    targets.forEach(name => addBack(document.getElementById('tab-' + name)));
  }

  function repair() {
    enforceOrder();
    ensureBackControls();
  }

  function install() {
    repair();
    const menu = document.querySelector('#moreMenu .more-inner');
    if (menu) new MutationObserver(repair).observe(menu,{childList:true});
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (main) new MutationObserver(repair).observe(main,{childList:true,subtree:true});
    // Late module initializers can rebuild screens after load.
    [250,800,1800,4000,8000].forEach(ms => setTimeout(repair,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();