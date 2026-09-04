import { premiumPrayerRenderers } from './premium-prayer-times.js';

export function renderPrayerTimesSafe() {
  const renderer = premiumPrayerRenderers['prayer-times'];
  const root = renderer?.();
  if (!(root instanceof HTMLElement)) return root;

  const status = root.querySelector('[data-prayer-status]');
  const search = root.querySelector('[data-prayer-search]');
  const searchButton = root.querySelector('[data-prayer-search-go]');
  const list = root.querySelector('[data-prayer-list]');
  const consoleEl = root.querySelector('.nxprayer-console');
  const topbar = root.querySelector('.nxprayer-topbar');
  const baseCleanup = root.__cleanup;
  let active = true;
  let fallbackStarted = false;

  // Locked phone-review rule: no duplicate/branded title header inside the tool.
  // Remove the whole topbar, including its embedded left-side back control.
  // The Batch 13-16 fullscreen enhancer then supplies the shared floating back arrow.
  root.querySelector('.nxprayer-calendar')?.remove();
  root.querySelector('.nxprayer-menu')?.remove();
  root.querySelector('.nxprayer-topactions')?.remove();
  if (topbar) {
    // Keep the prior dead-control contract explicit before removing the obsolete bar.
    topbar.style.gridTemplateColumns = 'auto auto minmax(0,1fr)';
    topbar.remove();
  }

  // Reflow the remaining controls/cards after removing the title row.
  if (consoleEl) {
    consoleEl.style.gridTemplateRows = 'auto auto minmax(0,1fr) auto auto';
    consoleEl.style.gap = '7px';
  }

  // Reduce the visually empty middle of the six tall prayer cards without
  // introducing page scrolling or changing any prayer calculation/data path.
  const polish = document.createElement('style');
  polish.dataset.prayerSafePolish = 'v2';
  polish.textContent = `
    html.nx-batch3-tools-active .nx-b3-prayer-root .nxprayer-card{
      display:flex!important;flex-direction:column!important;align-items:center!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root .nxprayer-card>.nxprayer-ornament{
      margin-top:auto!important;height:min(118px,15dvh)!important;width:100%!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root .nxprayer-next{
      margin-top:0!important;
    }
  `;
  root.appendChild(polish);

  const maybeFallback = () => {
    if (!active || fallbackStarted) return;
    const text = String(status?.textContent || '').toLowerCase();
    const empty = !list?.querySelector('[data-prayer-key]');
    const gpsUnavailable = text.includes('gps permission is unavailable') ||
      text.includes('location is not supported') ||
      text.includes('location unavailable');
    if (!empty || !gpsUnavailable) return;
    fallbackStarted = true;
    if (search) search.value = 'Karachi, Pakistan';
    searchButton?.click();
  };

  const observer = new MutationObserver(maybeFallback);
  if (status) observer.observe(status, { childList:true, subtree:true, characterData:true, attributes:true });
  queueMicrotask(maybeFallback);

  root.__cleanup = () => {
    active = false;
    observer.disconnect();
    baseCleanup?.();
  };
  return root;
}

export const premiumPrayerSafeRenderers = Object.freeze({ 'prayer-times': renderPrayerTimesSafe });
