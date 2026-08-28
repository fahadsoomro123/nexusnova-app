import { premiumDriveRenderers } from './premium-drive-tools.js';

export function renderNovaDriveSafe() {
  const renderer = premiumDriveRenderers['nova-drive'];
  const root = renderer?.();
  if (!(root instanceof HTMLElement)) return root;

  const baseCleanup = root.__cleanup;
  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    const stop = root.querySelector('[data-dr-stop]');
    if (stop instanceof HTMLButtonElement && !stop.disabled) {
      try { stop.click(); } catch (error) { console.warn('[NexusNova Fresh] drive auto-save:', error); }
    }
    baseCleanup?.();
  };
  return root;
}

export const premiumDriveSafeRenderers = Object.freeze({ 'nova-drive': renderNovaDriveSafe });
