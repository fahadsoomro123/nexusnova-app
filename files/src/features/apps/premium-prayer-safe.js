import { premiumPrayerRenderers } from './premium-prayer-times.js';

export function renderPrayerTimesSafe() {
  const renderer = premiumPrayerRenderers['prayer-times'];
  const root = renderer?.();
  if (!(root instanceof HTMLElement)) return root;

  const status = root.querySelector('[data-prayer-status]');
  const search = root.querySelector('[data-prayer-search]');
  const searchButton = root.querySelector('[data-prayer-search-go]');
  const list = root.querySelector('[data-prayer-list]');
  const baseCleanup = root.__cleanup;
  let active = true;
  let fallbackStarted = false;

  const maybeFallback = () => {
    if (!active || fallbackStarted) return;
    const text = String(status?.textContent || '').toLowerCase();
    const empty = !list?.querySelector('[data-prayer-key]');
    if (!empty || !text.includes('gps permission is unavailable')) return;
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
