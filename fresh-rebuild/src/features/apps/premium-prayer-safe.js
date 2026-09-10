import { premiumPrayerRenderers } from './premium-prayer-times.js';

export function renderPrayerTimesSafe() {
  const renderer = premiumPrayerRenderers['prayer-times'];
  const root = renderer?.();
  if (!(root instanceof HTMLElement)) return root;

  const status = root.querySelector('[data-prayer-status]');
  const search = root.querySelector('[data-prayer-search]');
  const searchButton = root.querySelector('[data-prayer-search-go]');
  const list = root.querySelector('[data-prayer-list]');
  const topbar = root.querySelector('.nxprayer-topbar');
  const baseCleanup = root.__cleanup;
  let active = true;
  let fallbackStarted = false;

  // The premium renderer previously exposed Calendar/Menu controls without
  // actions. Do not show dead or misleading controls in the phone review UI.
  root.querySelector('.nxprayer-calendar')?.remove();
  root.querySelector('.nxprayer-menu')?.remove();
  root.querySelector('.nxprayer-topactions')?.remove();
  if (topbar) {
    topbar.style.gridTemplateColumns = 'auto auto minmax(0,1fr)';
    topbar.style.paddingRight = '0';
  }

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
