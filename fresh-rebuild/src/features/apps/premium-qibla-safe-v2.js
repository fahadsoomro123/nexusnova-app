import { premiumQiblaRenderers } from './premium-qibla.js';

function normalizedHeading(event) {
  const webkit = Number(event?.webkitCompassHeading);
  if (Number.isFinite(webkit)) return ((webkit % 360) + 360) % 360;
  const alpha = Number(event?.alpha);
  if (Number.isFinite(alpha)) return ((360 - alpha) % 360 + 360) % 360;
  return NaN;
}

function smoothCircular(previous, next, factor = 0.34) {
  if (!Number.isFinite(previous)) return next;
  let delta = ((next - previous + 540) % 360) - 180;
  if (Math.abs(delta) < 0.65) return previous;
  return (previous + delta * factor + 360) % 360;
}

export function renderQiblaSafeV2() {
  const base = premiumQiblaRenderers.qibla;
  const root = base?.();
  if (!(root instanceof HTMLElement)) return root;

  const rotor = root.querySelector('[data-qb-rotor]');
  let restoreRotor = null;

  // The original screen re-applies rotate(0) to the entire large, filtered
  // compass face on every sensor tick. It is visually static, so blocking only
  // that redundant transform prevents Android WebView from re-compositing the
  // artwork. Qibla math and the original SVG remain untouched.
  if (rotor instanceof SVGElement) {
    const ownSetAttribute = rotor.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(rotor);
    rotor.removeAttribute('transform');
    rotor.setAttribute = (name, value) => {
      if (String(name).toLowerCase() === 'transform') return;
      nativeSetAttribute(name, value);
    };
    restoreRotor = () => {
      try { delete rotor.setAttribute; } catch { rotor.setAttribute = ownSetAttribute; }
      rotor.removeAttribute('transform');
    };
  }

  let disposed = false;
  let smoothed = NaN;
  let lastAbsoluteAt = 0;
  let lastEmitAt = 0;

  const emit = heading => {
    const synthetic = new Event('deviceorientation');
    Object.defineProperty(synthetic, '__nxQiblaNormalized', { value: true });
    Object.defineProperty(synthetic, 'webkitCompassHeading', { value: heading });
    Object.defineProperty(synthetic, 'alpha', { value: 360 - heading });
    window.dispatchEvent(synthetic);
  };

  const intercept = event => {
    if (disposed || event?.__nxQiblaNormalized) return;

    const now = performance.now();
    const isAbsolute = event.type === 'deviceorientationabsolute' || event.absolute === true;
    if (isAbsolute) lastAbsoluteAt = now;
    else if (now - lastAbsoluteAt < 1400) {
      event.stopImmediatePropagation();
      return;
    }

    const heading = normalizedHeading(event);
    if (!Number.isFinite(heading)) return;

    // Stop the two raw orientation streams from independently driving the same
    // needle. Emit one throttled, circularly-smoothed heading instead.
    event.stopImmediatePropagation();
    smoothed = smoothCircular(smoothed, heading);
    if (now - lastEmitAt < 65) return;
    lastEmitAt = now;
    emit(smoothed);
  };

  window.addEventListener('deviceorientationabsolute', intercept, true);
  window.addEventListener('deviceorientation', intercept, true);

  const baseCleanup = root.__cleanup;
  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    disposed = true;
    window.removeEventListener('deviceorientationabsolute', intercept, true);
    window.removeEventListener('deviceorientation', intercept, true);
    restoreRotor?.();
    baseCleanup?.();
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla: renderQiblaSafeV2 });
