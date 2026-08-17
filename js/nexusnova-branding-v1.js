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

  function ensureCss() {
    if (document.querySelector(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-branding-v1.css?v=20260817-branding-v1';
    link.setAttribute(CSS_MARKER, '1');
    document.head.appendChild(link);
  }

  function labelForTab(tab) {
    const id = String(tab?.id || '').replace(/^tab-/, '').replace(/[-_]+/g, ' ');
    const heading = tab?.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .card h2, :scope > .card h3, :scope > .nxui-hero h2, :scope > .nx-speed4-hero h2');
    let label = clean(heading?.textContent || id || 'Utility');
    label = label.replace(/^nexusnova\s*/i, '').trim();
    if (!label) label = 'Utility';
    return label.slice(0, 32);
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
    if (!(tab instanceof HTMLElement)) return;
    if (!tab.classList.contains('tab')) return;

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
      if (!(node instanceof HTMLElement)) return;
      if (node.closest('#tab-home')) return;
      node.classList.add('nx-brand-status');
    });
  }

  function applyBranding() {
    ensureCss();
    document.body?.classList.add('nx-branding-v1');
    document.querySelectorAll('main .tab, main.main .tab').forEach(brandTab);
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
