/* NexusNova Nova Hub search-only top v1
   Presentation-only cleanup requested by the user:
   - Keep the Nova Hub search input.
   - Remove non-interactive title/kicker/description content above it.
   - Leave category chips, cards, navigation and feature logic untouched.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubSearchOnlyTopV1) return;
  window.__nxNovaHubSearchOnlyTopV1 = true;

  const findHubSearch = menu => Array.from(menu?.querySelectorAll('input') || []).find(input => {
    const placeholder = String(input.getAttribute('placeholder') || '').trim();
    const aria = String(input.getAttribute('aria-label') || '').trim();
    return /search\s+nova\s+hub/i.test(placeholder) ||
           /search\s+nova\s+hub/i.test(aria) ||
           input.id === 'nxAllAppsSmartSearch';
  }) || null;

  function isNonInteractive(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches('script,style,template')) return false;
    return !node.matches('button,a,input,select,textarea,[role="button"],[tabindex]') &&
           !node.querySelector('button,a,input,select,textarea,[role="button"],[tabindex]');
  }

  function hideBeforeSearch(search, boundary) {
    let current = search;
    while (current && current !== boundary) {
      const parent = current.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === current) break;
        if (!isNonInteractive(sibling)) continue;
        sibling.style.setProperty('display', 'none', 'important');
        sibling.dataset.nxNovaHubTopHidden = '1';
      }
      current = parent;
    }
  }

  function hideKnownIntroText(menu, search) {
    const patterns = [
      /^all apps\s*[•·|\-]?\s*direct access$/i,
      /^all apps$/i,
      /^direct access$/i,
      /^nova hub$/i,
      /^everyday apps and utilities\.?$/i,
      /^mining tools now live under mine\.?$/i,
      /^everyday apps and utilities\.?\s*mining tools now live under mine\.?$/i
    ];

    menu.querySelectorAll('h1,h2,h3,p,small,span,div').forEach(node => {
      if (node === search || node.contains(search) || search.contains(node)) return;
      if (!(node.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 140) return;
      if (!patterns.some(rx => rx.test(text))) return;
      node.style.setProperty('display', 'none', 'important');
      node.dataset.nxNovaHubTopHidden = '1';
    });
  }

  function cleanHubTop() {
    const menu = document.getElementById('moreMenu');
    if (!menu) return false;
    const search = findHubSearch(menu);
    if (!search) return false;
    const inner = menu.querySelector('.more-inner') || menu;
    hideBeforeSearch(search, inner);
    hideKnownIntroText(menu, search);
    search.style.removeProperty('display');
    search.removeAttribute('data-nx-nova-hub-top-hidden');
    return true;
  }

  function install() {
    cleanHubTop();
    [0, 80, 250, 700, 1500, 3000].forEach(ms => setTimeout(cleanHubTop, ms));

    const menu = document.getElementById('moreMenu');
    if (menu && !menu.__nxNovaHubTopObserver) {
      let queued = false;
      const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          cleanHubTop();
        });
      });
      observer.observe(menu, { childList: true, subtree: true });
      menu.__nxNovaHubTopObserver = observer;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
