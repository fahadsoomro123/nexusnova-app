/* NexusNova Nova Hub original icon sprite v1
   Uses the user's 26 supplied glossy icon designs, re-encoded into one compact AVIF sprite.
   Presentation-only: no navigation, Mine, mining, session or feature logic is changed.
   If AVIF is unavailable in the current WebView, the existing vector icons remain as fallback.
*/
import part01 from './nova-hub-original-avif-part-01.js';
import part02 from './nova-hub-original-avif-part-02.js';
import part03 from './nova-hub-original-avif-part-03.js';
import part04 from './nova-hub-original-avif-part-04.js';

(() => {
  'use strict';
  if (window.__nxNovaHubOriginalIconSpriteV1) return;
  window.__nxNovaHubOriginalIconSpriteV1 = true;
  window.nexusNovaHubOriginalIconSpriteVersion = 'nova-hub-original-icon-sprite-v1';

  const SPRITE = 'data:image/avif;base64,' + part01 + part02 + part03 + part04;
  const CELL = 68;
  const COLS = 7;
  const ROWS = 4;

  const INDEX = new Map([
    ['profile',0],
    ['notes',1],
    ['to-do',2], ['to do',2], ['todo',2],
    ['calculator',3],
    ['unit converter',4],
    ['expenses',5], ['expense',5],
    ['focus timer',6],
    ['bmi',7], ['bmi calculator',7],
    ['tip calculator',8],
    ['world clock',9],
    ['qr tools',10],
    ['weather',11],
    ['qibla',12],
    ['prayer times',13], ['prayer time',13],
    ['nova internet speed',14], ['internet speed',14], ['speed test',14],
    ['pakistan hub',15],
    ['news',16],
    ['articles',17], ['article',17],
    ['my location',18], ['location',18],
    ['nova drive',19],
    ['nova track',20],
    ['nova ai',21], ['nexusnova ai',21],
    ['smart hub',22], ['smart tools',22],
    ['community chat',23],
    ['browser',24], ['nexusnova browser',24],
    ['travel',25]
  ]);

  let spriteReady = false;
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

  function ensureIcon(button) {
    let icon = button.querySelector(':scope > .mi-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'mi-icon';
      button.insertBefore(icon, button.firstChild);
    }
    return icon;
  }

  function applyButton(button) {
    if (!spriteReady || !(button instanceof HTMLElement) || !button.matches('#moreMenu .more-item')) return;
    const key = titleOf(button);
    const index = INDEX.get(key);
    if (index === undefined) return;

    const icon = ensureIcon(button);
    if (icon.dataset.nxNovaHubOriginalIndex === String(index) && icon.querySelector(':scope > .nx-hub-original-sprite')) return;

    const tile = document.createElement('span');
    tile.className = 'nx-hub-premium-icon nx-hub-original-sprite';
    tile.setAttribute('aria-hidden', 'true');
    tile.style.width = CELL + 'px';
    tile.style.height = CELL + 'px';
    tile.style.display = 'block';
    tile.style.backgroundImage = `url("${SPRITE}")`;
    tile.style.backgroundRepeat = 'no-repeat';
    tile.style.backgroundSize = `${COLS * CELL}px ${ROWS * CELL}px`;
    tile.style.backgroundPosition = `${-(index % COLS) * CELL}px ${-Math.floor(index / COLS) * CELL}px`;
    tile.style.backgroundColor = 'transparent';

    icon.replaceChildren(tile);
    icon.dataset.nxNovaHubOriginal = key;
    icon.dataset.nxNovaHubOriginalIndex = String(index);
  }

  function applyAll() {
    queued = false;
    if (!spriteReady) return;
    document.querySelectorAll('#moreMenu .more-item').forEach(applyButton);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyAll);
  }

  function watchMenu() {
    const menu = document.getElementById('moreMenu');
    if (!menu || menu.__nxOriginalIconSpriteObserverV1) return;
    const observer = new MutationObserver(schedule);
    observer.observe(menu, { childList:true, subtree:true });
    menu.__nxOriginalIconSpriteObserverV1 = observer;
  }

  function activate() {
    spriteReady = true;
    schedule();
    [80,250,700,1500,3000].forEach(ms => setTimeout(schedule, ms));
    watchMenu();
  }

  function boot() {
    watchMenu();
    const probe = new Image();
    probe.onload = activate;
    probe.onerror = () => {
      spriteReady = false;
      console.warn('NexusNova Nova Hub original AVIF sprite unavailable; keeping vector fallback.');
    };
    probe.src = SPRITE;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
