/* NexusNova Two-Tab Shell v1
   User-facing shell change only:
   - bottom navigation = Mine + Nova Hub
   - Wallet / Rewards / Market move under Mine Quick Access
   - Settings becomes four compact essential groups
   No mining, reward, wallet, market, auth or Firebase value logic is changed here.
*/
(() => {
  'use strict';
  if (window.__nxTwoTabShellV1) return;
  window.__nxTwoTabShellV1 = true;

  const CSS_MARKER = 'data-nx-two-tab-shell-v1';
  const HOME_AUX = new Set(['wallet','tasks','market']);
  const $ = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  function ensureCss() {
    if ($(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-two-tab-shell-v1.css?v=20260817-shell2';
    link.setAttribute(CSS_MARKER,'1');
    document.head.appendChild(link);
  }

  function labelNode(button) {
    if (!button) return null;
    return qsa(':scope > span',button)
      .filter(node => !node.classList.contains('mi-icon') && !node.classList.contains('nx-brand-app-badge'))
      .pop() || null;
  }

  function setText(node,value) {
    if (node && String(node.textContent || '').trim() !== value) node.textContent = value;
  }

  function dockButtonFor(target) {
    return qsa('.bottom-dock .dock-item').find(button => {
      const action = String(button.getAttribute('onclick') || '');
      return new RegExp(`switchTab\\(\\s*['"]${target}['"]`).test(action);
    }) || null;
  }

  function activeTabName() {
    const active = $('main.main > .tab.active,main > .tab.active,.tab.active');
    return String(active ? active.id : '').replace(/^tab-/,'') || 'home';
  }

  function menuOpen() {
    const menu = $('#moreMenu');
    return Boolean(menu && menu.classList.contains('show') && getComputedStyle(menu).display !== 'none');
  }

  function ensureTwoTabDock() {
    const dock = $('.bottom-dock .dock-inner');
    const home = dockButtonFor('home');
    const more = $('#moreBtn');
    if (!dock || !home || !more) return;

    if (document.body) document.body.classList.add('nx-two-tab-shell');

    [home,more].forEach(button => {
      if (button.dataset.nxShellPrimary !== '1') button.dataset.nxShellPrimary = '1';
      button.hidden = false;
      button.removeAttribute('aria-hidden');
      button.tabIndex = 0;
    });

    setText(labelNode(home),'Mine');
    setText(labelNode(more),'Nova Hub');
    home.setAttribute('aria-label','Open Mine');
    more.setAttribute('aria-label','Open Nova Hub');
    home.title = 'Mine';
    more.title = 'Nova Hub';

    ['wallet','tasks','market'].forEach(target => {
      const button = dockButtonFor(target);
      if (!button) return;
      if (button.dataset.nxShellHidden !== '1') button.dataset.nxShellHidden = '1';
      button.hidden = true;
      button.setAttribute('aria-hidden','true');
      button.tabIndex = -1;
      button.classList.remove('active');
    });
  }

  function targetOfHubTile(button) {
    if (!button) return '';
    if (button.dataset && button.dataset.nxHubTarget) return String(button.dataset.nxHubTarget);
    if (button.dataset && button.dataset.nxmega) return String(button.dataset.nxmega);
    if (button.hasAttribute('data-nx-speedtest-v4')) return 'speed-test';
    const match = String(button.getAttribute('onclick') || '').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match ? match[1] : '';
  }

  function hideMineOwnedHubItems() {
    qsa('#moreMenu .more-item').forEach(tile => {
      const target = targetOfHubTile(tile);
      if (target === 'tasks') tile.dataset.nxShellMineOwned = '1';
    });
  }

  function reflectDockState() {
    const home = dockButtonFor('home');
    const more = $('#moreBtn');
    if (!home || !more) return;
    const tabName = activeTabName();
    const homeFamily = tabName === 'home' || HOME_AUX.has(tabName);
    const hubFamily = !homeFamily;
    const hubIsOpen = menuOpen();

    home.classList.toggle('active',homeFamily && !hubIsOpen);
    more.classList.toggle('active',hubIsOpen || hubFamily);
    ['wallet','tasks','market'].forEach(target => {
      const button = dockButtonFor(target);
      if (button) button.classList.remove('active');
    });
  }

  function openMineTarget(target) {
    if (!HOME_AUX.has(target)) return false;
    const menu = $('#moreMenu');
    if (menu && menu.classList.contains('show')) {
      try {
        const more = $('#moreBtn');
        if (more) more.click();
      } catch (_) {
        menu.classList.remove('show');
      }
    }

    const button = dockButtonFor(target);
    if (button) {
      try {
        button.click();
        setTimeout(reflectDockState,0);
        setTimeout(reflectDockState,80);
        return true;
      } catch (_) {}
    }

    try {
      if (typeof window.switchTab === 'function') {
        window.switchTab(target,null);
        setTimeout(reflectDockState,0);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function ensureMineQuickAccess() {
    const home = $('#tab-home');
    if (!home || $('#nxMineQuickAccess',home)) return;

    const panel = document.createElement('section');
    panel.id = 'nxMineQuickAccess';
    panel.setAttribute('aria-label','Mine quick access');
    panel.innerHTML = `
      <div class="nx-mine-quick-head"><strong>Quick Access</strong><span>Wallet • Rewards • Market</span></div>
      <div class="nx-mine-quick-grid">
        <button type="button" class="nx-mine-quick-card" data-nx-mine-target="wallet" aria-label="Open Wallet">
          <span class="nx-mine-quick-icon"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10h17M15.5 14h2"/></svg></span>
          <b>Wallet</b><small>Assets & transfers</small>
        </button>
        <button type="button" class="nx-mine-quick-card" data-nx-mine-target="tasks" aria-label="Open Rewards">
          <span class="nx-mine-quick-icon"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8v12M4 12h16M8 8c0-2 1.4-3 3-3 1.2 0 1.8.5 2.5 1.7C14.2 5.5 15 5 16.2 5 18 5 19 6.2 19 8"/></svg></span>
          <b>Rewards</b><small>Daily NVX & tasks</small>
        </button>
        <button type="button" class="nx-mine-quick-card" data-nx-mine-target="market" aria-label="Open Market">
          <span class="nx-mine-quick-icon"><svg viewBox="0 0 24 24"><path d="M4 18V9l4 4 4-7 4 5 4-3v10z"/></svg></span>
          <b>Market</b><small>Live crypto prices</small>
        </button>
      </div>`;

    qsa('[data-nx-mine-target]',panel).forEach(button => {
      button.addEventListener('click',() => openMineTarget(button.dataset.nxMineTarget));
    });

    const stats = $('.stats-grid',home);
    if (stats && stats.nextSibling) home.insertBefore(panel,stats.nextSibling);
    else home.appendChild(panel);
  }

  function cardTitle(card) {
    const heading = card ? card.querySelector('h3') : null;
    return String(heading ? heading.textContent : '').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function settingsCard(tab,matcher) {
    return qsa(':scope > .settings-card',tab).find(card => matcher.test(cardTitle(card))) || null;
  }

  function settingsRowByLabel(card,label) {
    if (!card) return null;
    const wanted = label.toLowerCase();
    return qsa('.settings-row',card).find(row => {
      const strong = row.querySelector('strong');
      return String(strong ? strong.textContent : '').trim().toLowerCase() === wanted;
    }) || null;
  }

  const icons = Object.freeze({
    account:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>',
    app:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 13h5"/></svg>',
    privacy:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    about:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>'
  });

  function createSettingsGroup(title,subtitle,icon) {
    const details = document.createElement('details');
    details.className = 'nx-settings-group';
    details.innerHTML = `
      <summary>
        <span class="nx-settings-icon">${icon}</span>
        <span><strong>${title}</strong><small>${subtitle}</small></span>
        <span class="nx-settings-chevron">›</span>
      </summary>
      <div class="nx-settings-body"></div>`;
    return details;
  }

  function appendIf(body,node) {
    if (body && node) body.appendChild(node);
  }

  function compactSettings() {
    const tab = $('#tab-about');
    if (!tab || $('#nxCompactSettings',tab)) return;

    if (document.body) document.body.classList.add('nx-compact-settings');
    const hero = $(':scope > .settings-hero',tab);
    if (hero) {
      setText($('h2',hero),'Settings');
      setText($('.settings-muted',hero),'Essential account, app and privacy controls.');
    }

    const account = settingsCard(tab,/account/);
    const appearance = settingsCard(tab,/appearance/);
    const notifications = settingsCard(tab,/notifications/);
    const ai = settingsCard(tab,/^ai$/);
    const privacy = settingsCard(tab,/privacy.*permissions/);
    const general = settingsCard(tab,/general/);
    const system = settingsCard(tab,/system status/);
    const support = settingsCard(tab,/support.*about/);

    [account,appearance,notifications,ai,privacy,general,system,support].filter(Boolean).forEach(card => {
      card.dataset.nxSettingsSource = '1';
    });

    const shell = document.createElement('div');
    shell.id = 'nxCompactSettings';
    shell.setAttribute('aria-label','Compact settings');

    const accountGroup = createSettingsGroup('Account','Profile, password and sign out',icons.account);
    const appGroup = createSettingsGroup('App','Theme, language and currency',icons.app);
    const privacyGroup = createSettingsGroup('Permissions','Location, camera and microphone',icons.privacy);
    const aboutGroup = createSettingsGroup('About','Version, network and support',icons.about);

    const accountBody = $('.nx-settings-body',accountGroup);
    const appBody = $('.nx-settings-body',appGroup);
    const privacyBody = $('.nx-settings-body',privacyGroup);
    const aboutBody = $('.nx-settings-body',aboutGroup);

    const accountRows = account ? qsa('.settings-row',account) : [];
    const accountProfile = accountRows.find(row => Boolean(row.querySelector('#settingsName'))) || accountRows[0] || null;
    const password = settingsRowByLabel(account,'Change password');
    const logout = settingsRowByLabel(account,'Sign out');
    appendIf(accountBody,accountProfile);
    appendIf(accountBody,password);
    if (logout) {
      const button = logout.querySelector('button');
      if (button) button.classList.add('nx-settings-logout');
      appendIf(accountBody,logout);
    }

    appendIf(appBody,settingsRowByLabel(appearance,'Theme'));
    appendIf(appBody,settingsRowByLabel(general,'Language'));
    appendIf(appBody,settingsRowByLabel(general,'Currency'));

    const privacyRows = privacy ? qsa('.settings-row',privacy) : [];
    privacyRows.forEach(row => appendIf(privacyBody,row));

    const systemRows = system ? qsa('.info-row',system) : [];
    const appVersion = systemRows.find(row => /app version/i.test(row.textContent || '')) || null;
    const network = systemRows.find(row => /^\s*Network/i.test(row.textContent || '')) || null;
    appendIf(aboutBody,appVersion);
    appendIf(aboutBody,network);

    const aboutCopy = support ? support.querySelector('.settings-muted') : null;
    if (aboutCopy) {
      aboutCopy.classList.add('nx-settings-about-copy');
      appendIf(aboutBody,aboutCopy);
    }
    appendIf(aboutBody,support ? support.querySelector('.settings-actions') : null);

    [accountGroup,appGroup,privacyGroup,aboutGroup].forEach(group => shell.appendChild(group));

    if (hero && hero.nextSibling) tab.insertBefore(shell,hero.nextSibling);
    else tab.appendChild(shell);
  }

  function installStateObservers() {
    const main = $('main.main,main');
    const menu = $('#moreMenu');
    if (main && main.dataset.nxTwoTabObserved !== '1') {
      main.dataset.nxTwoTabObserved = '1';
      new MutationObserver(() => requestAnimationFrame(reflectDockState))
        .observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
    }
    if (menu && menu.dataset.nxTwoTabObserved !== '1') {
      menu.dataset.nxTwoTabObserved = '1';
      new MutationObserver(() => requestAnimationFrame(reflectDockState))
        .observe(menu,{attributes:true,attributeFilter:['class','style']});
    }
  }

  function apply() {
    ensureCss();
    ensureTwoTabDock();
    ensureMineQuickAccess();
    hideMineOwnedHubItems();
    compactSettings();
    installStateObservers();
    reflectDockState();
    try {
      if (window.NexusNovaUxSimplify && typeof window.NexusNovaUxSimplify.refresh === 'function') {
        window.NexusNovaUxSimplify.refresh();
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();

  document.addEventListener('click',() => setTimeout(reflectDockState,0),true);
  [150,400,800,1500,3000,6000].forEach(ms => setTimeout(apply,ms));

  window.NexusNovaTwoTabShell = Object.freeze({
    version:'1.0.1',
    refresh:apply,
    openMine:openMineTarget
  });
})();
