/* NexusNova Branding v1
   Visual identity only. No network calls and no changes to feature handlers,
   mining, rewards, wallet, auth or Firebase state.
*/
(() => {
  'use strict';
  if (window.__nxBrandingV1) return;
  window.__nxBrandingV1 = true;

  const CSS_MARKER = 'data-nx-branding-v1';
  const CHIP_CLASS = 'nx-brand-chip';
  const FOOTER_CLASS = 'nx-brand-footer';

  const clean = value => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[•|]+/g, ' ')
    .trim();

  const TAB_LABELS = Object.freeze({
    'tab-home':'MINING',
    'tab-wallet':'WALLET',
    'tab-tasks':'REWARDS',
    'tab-market':'MARKET',
    'tab-finance':'FINANCE',
    'tab-news':'NEWS',
    'tab-profile':'PROFILE',
    'tab-settings':'SETTINGS',
    'tab-tools':'TOOLS',
    'tab-speed-test':'SPEED TEST'
  });

  function ensureCss() {
    if (document.querySelector(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-branding-v1.css?v=20260817-branding-v2';
    link.setAttribute(CSS_MARKER, '1');
    document.head.appendChild(link);
  }

  function labelForTab(tab) {
    const explicit = TAB_LABELS[String(tab?.id || '')];
    if (explicit) return explicit;
    const id = String(tab?.id || '').replace(/^tab-/, '').replace(/[-_]+/g, ' ');
    const heading = tab?.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .card h2, :scope > .card h3, :scope > .nxui-hero h2, :scope > .nx-speed4-hero h2');
    let label = clean(heading?.textContent || id || 'Utility');
    label = label.replace(/^nexusnova\s*/i, '').trim();
    if (!label) label = 'Utility';
    return label.slice(0, 32).toUpperCase();
  }

  function makeChip(context) {
    const chip = document.createElement('div');
    chip.className = CHIP_CLASS;
    chip.setAttribute('aria-hidden', 'true');
    chip.innerHTML = `
      <span class="nx-brand-chip-logo">N</span>
      <span class="nx-brand-chip-name">NEXUSNOVA</span>
      <span class="nx-brand-chip-dot"></span>
      <span class="nx-brand-chip-context"></span>`;
    chip.querySelector('.nx-brand-chip-context').textContent = context;
    return chip;
  }

  function brandTab(tab) {
    if (!(tab instanceof HTMLElement) || !tab.classList.contains('tab')) return;

    if (!tab.querySelector(`:scope > .${CHIP_CLASS}`)) {
      const chip = makeChip(labelForTab(tab));
      const anchor = tab.firstElementChild;
      if (anchor) tab.insertBefore(chip, anchor);
      else tab.appendChild(chip);
    }

    if (!tab.querySelector(`:scope > .${FOOTER_CLASS}`)) {
      const footer = document.createElement('div');
      footer.className = FOOTER_CLASS;
      footer.setAttribute('aria-hidden', 'true');
      footer.textContent = 'NEXUSNOVA • SECURE UTILITY GRID';
      tab.appendChild(footer);
    }
  }

  function addWatermark(surface) {
    if (!(surface instanceof HTMLElement)) return;
    surface.classList.add('nx-brand-surface');
    if (surface.querySelector(':scope > .nx-brand-corner-watermark')) return;
    const mark = document.createElement('span');
    mark.className = 'nx-brand-corner-watermark';
    mark.textContent = 'N';
    mark.setAttribute('aria-hidden', 'true');
    surface.appendChild(mark);
  }

  function brandCoreCards() {
    document.querySelectorAll([
      '.tab > .card',
      '.tab .stat-card',
      '.tab .gold-box',
      '.tab .news-card',
      '.tab .profile-card',
      '.tab .settings-card',
      '.tab .market-card',
      '.tab .wallet-card'
    ].join(',')).forEach(addWatermark);
  }

  function brandMining() {
    const home = document.getElementById('tab-home');
    if (!home) return;

    const balanceCard = home.querySelector(':scope > .card');
    if (balanceCard instanceof HTMLElement) {
      balanceCard.classList.add('nx-brand-mining-card');
      if (!balanceCard.querySelector(':scope > .nx-brand-mining-seal')) {
        const seal = document.createElement('div');
        seal.className = 'nx-brand-mining-seal';
        seal.setAttribute('aria-hidden', 'true');
        seal.innerHTML = '<span>N</span><b>NEXUSNOVA</b><i>MINING</i>';
        balanceCard.appendChild(seal);
      }
    }

    const mineButton = document.getElementById('mineBtn');
    if (mineButton instanceof HTMLElement) mineButton.classList.add('nx-brand-mining-button');

    const timer = document.getElementById('timer');
    if (timer instanceof HTMLElement) timer.classList.add('nx-brand-mining-readout');

    home.querySelectorAll('.stat-card').forEach(card => card.classList.add('nx-brand-mining-stat'));
  }

  function brandAllApps() {
    document.querySelectorAll('#moreMenu .more-item').forEach(tile => {
      if (!(tile instanceof HTMLElement)) return;
      if (tile.querySelector(':scope > .nx-brand-app-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'nx-brand-app-badge';
      badge.textContent = 'N';
      badge.setAttribute('aria-hidden', 'true');
      tile.appendChild(badge);
    });
  }

  function brandPanels() {
    document.querySelectorAll([
      '.nexus-tool-panel',
      '.nxui-hero',
      '.nx-speed4-shell',
      '.nx-scripture-reader',
      '.nx-bible-reader',
      '.nx-browser-shell',
      '[data-nx-standalone-app]'
    ].join(',')).forEach(node => node.classList?.add('nx-brand-watermarked'));

    document.querySelectorAll('.tab .status').forEach(node => {
      if (node instanceof HTMLElement) node.classList.add('nx-brand-status');
    });
  }

  function applyBranding() {
    ensureCss();
    document.body?.classList.add('nx-branding-v1');
    document.querySelectorAll('main .tab, main.main .tab').forEach(brandTab);
    brandCoreCards();
    brandMining();
    brandAllApps();
    brandPanels();
  }

  let queued = false;
  function queueApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyBranding();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBranding, { once:true });
  } else {
    applyBranding();
  }

  // Many NexusNova utilities are inserted lazily after ALL APPS opens.
  // Re-apply only visual markers when those nodes appear.
  const observer = new MutationObserver(queueApply);
  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList:true, subtree:true });
  };
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once:true });

  [300, 900, 1800, 3500].forEach(ms => setTimeout(applyBranding, ms));

  window.NexusNovaBranding = Object.freeze({ refresh: applyBranding });
})();
