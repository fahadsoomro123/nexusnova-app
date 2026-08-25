/* NexusNova Nova Hub missing icon assets v1
   Maps the 28 previously-missing Nova Hub features to their own standalone SVG files.
   Presentation-only: no navigation, feature handler, Mine, mining or session logic is changed.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubMissingIconAssetsV1) return;
  window.__nxNovaHubMissingIconAssetsV1 = true;
  window.nexusNovaHubMissingIconAssetsVersion = 'nova-hub-missing-icon-assets-v1';

  const ASSETS = new Map([
    ['learning','learning.svg'],
    ['teacher toolkit','teacher-toolkit.svg'],
    ['documents','documents.svg'],
    ['entertainment','entertainment.svg'],
    ['islamic hub','islamic-hub.svg'],
    ['quran','quran.svg'],
    ['hadith','hadith.svg'],
    ['urdu library','urdu-library.svg'],
    ['health','health.svg'],
    ['calendar','calendar.svg'],
    ['reminders','reminders.svg'],
    ['habits','habits.svg'],
    ['savings','savings.svg'],
    ['contacts','contacts.svg'],
    ['family hub','family-hub.svg'],
    ['family emergency','family-emergency.svg'],
    ['finance','finance.svg'],
    ['budget','budget.svg'],
    ['bills','bills.svg'],
    ['shopping','shopping.svg'],
    ['marketplace','marketplace.svg'],
    ['orders','orders.svg'],
    ['growth center','growth-center.svg'],
    ['nova vpn','nova-vpn.svg'],
    ['file vault','file-vault.svg'],
    ['security','security.svg'],
    ['notifications','notifications.svg'],
    ['settings','settings.svg']
  ]);

  let queued = false;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function titleOf(button) {
    const explicit = button.querySelector(':scope > .nx-hub-title');
    if (explicit) return clean(explicit.textContent);
    const labels = Array.from(button.children || []).filter(node =>
      node.nodeType === 1 && !node.classList.contains('mi-icon')
    );
    return clean(labels.length ? labels[labels.length - 1].textContent : button.textContent);
  }

  function applyButton(button) {
    if (!(button instanceof HTMLElement) || !button.matches('#moreMenu .more-item')) return;
    const key = titleOf(button);
    const file = ASSETS.get(key);
    if (!file) return;

    let icon = button.querySelector(':scope > .mi-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'mi-icon';
      button.insertBefore(icon, button.firstChild);
    }

    const wanted = `./icons/nova-hub/${file}`;
    const current = icon.querySelector(':scope > img.nx-hub-premium-asset');
    if (current?.getAttribute('src') === wanted) return;

    const image = document.createElement('img');
    image.className = 'nx-hub-premium-icon nx-hub-premium-asset';
    image.src = wanted;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.draggable = false;

    icon.replaceChildren(image);
    icon.dataset.nxNovaHubAsset = file;
  }

  function applyAll() {
    queued = false;
    document.querySelectorAll('#moreMenu .more-item').forEach(applyButton);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyAll);
  }

  function boot() {
    schedule();
    [80,250,700,1500,3000].forEach(ms => setTimeout(schedule, ms));
    const menu = document.getElementById('moreMenu');
    if (menu && !menu.__nxMissingIconAssetsObserverV1) {
      const observer = new MutationObserver(schedule);
      observer.observe(menu, { childList:true, subtree:true });
      menu.__nxMissingIconAssetsObserverV1 = observer;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
