import { premiumQiblaRenderers } from './premium-qibla.js';

function normalizedHeading(event) {
  const webkit = Number(event?.webkitCompassHeading);
  if (Number.isFinite(webkit)) return ((webkit % 360) + 360) % 360;
  const alpha = Number(event?.alpha);
  if (Number.isFinite(alpha)) return ((360 - alpha) % 360 + 360) % 360;
  return NaN;
}

function shortestDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

function easedAngle(previous, next, alpha) {
  if (!Number.isFinite(previous)) return next;
  const delta = shortestDelta(previous, next);
  if (Math.abs(delta) < 0.04) return previous;
  return previous + delta * alpha;
}

function rotateValue(value) {
  const match = String(value || '').match(/rotate\(\s*(-?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : NaN;
}

export function renderQiblaSafeV2() {
  const base = premiumQiblaRenderers.qibla;
  const root = base?.();
  if (!(root instanceof HTMLElement)) return root;

  const rotor = root.querySelector('[data-qb-rotor]');
  const pointer = root.querySelector('[data-qb-pointer]');
  let restoreRotor = null;
  let restorePointer = null;

  // The compass artwork itself never needs to rotate. Keeping this large,
  // filtered SVG group completely static prevents Android WebView from
  // re-rasterizing the whole face on every sensor sample.
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

  let targetPointer = NaN;
  let displayedPointer = NaN;

  // Move only the small needle. The original SVG glow filter on the moving
  // group is deliberately disabled while live because several Android WebView
  // GPU drivers corrupt filtered SVG layers during rapid transforms. The
  // original artwork, bearing math and compass face are otherwise untouched.
  if (pointer instanceof SVGElement) {
    const ownSetAttribute = pointer.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(pointer);
    const initial = rotateValue(pointer.getAttribute('transform'));
    if (Number.isFinite(initial)) targetPointer = displayedPointer = initial;
    pointer.removeAttribute('transform');
    pointer.removeAttribute('filter');
    pointer.style.transformBox = 'view-box';
    pointer.style.transformOrigin = '50% 50%';
    pointer.style.willChange = 'transform';
    pointer.style.backfaceVisibility = 'hidden';
    if (Number.isFinite(displayedPointer)) pointer.style.transform = `rotate(${displayedPointer.toFixed(3)}deg)`;

    pointer.setAttribute = (name, value) => {
      if (String(name).toLowerCase() === 'transform') {
        const angle = rotateValue(value);
        if (Number.isFinite(angle)) {
          targetPointer = angle;
          if (!Number.isFinite(displayedPointer)) displayedPointer = angle;
        }
        return;
      }
      if (String(name).toLowerCase() === 'filter') return;
      nativeSetAttribute(name, value);
    };

    restorePointer = () => {
      try { delete pointer.setAttribute; } catch { pointer.setAttribute = ownSetAttribute; }
      pointer.style.willChange = '';
      pointer.style.backfaceVisibility = '';
    };
  }

  let disposed = false;
  let targetHeading = NaN;
  let displayedHeading = NaN;
  let lastAbsoluteAt = 0;
  let lastFrameAt = performance.now();
  let lastEmitAt = 0;
  let frameId = 0;

  const emit = heading => {
    const synthetic = new Event('deviceorientation');
    Object.defineProperty(synthetic, '__nxQiblaNormalized', { value: true });
    Object.defineProperty(synthetic, 'webkitCompassHeading', { value: ((heading % 360) + 360) % 360 });
    Object.defineProperty(synthetic, 'alpha', { value: 360 - (((heading % 360) + 360) % 360) });
    window.dispatchEvent(synthetic);
  };

  const intercept = event => {
    if (disposed || event?.__nxQiblaNormalized) return;
    const now = performance.now();
    const isAbsolute = event.type === 'deviceorientationabsolute' || event.absolute === true;
    if (isAbsolute) lastAbsoluteAt = now;
    else if (now - lastAbsoluteAt < 1500) {
      event.stopImmediatePropagation();
      return;
    }

    const heading = normalizedHeading(event);
    if (!Number.isFinite(heading)) return;
    event.stopImmediatePropagation();
    targetHeading = heading;
    if (!Number.isFinite(displayedHeading)) displayedHeading = heading;
  };

  const animate = now => {
    if (disposed) return;
    const dt = Math.max(1, Math.min(50, now - lastFrameAt));
    lastFrameAt = now;

    if (Number.isFinite(targetHeading)) {
      // Time-based low-pass interpolation feels like a damped gimbal instead
      // of following noisy sensor samples one-for-one.
      const headingAlpha = 1 - Math.exp(-dt / 145);
      displayedHeading = easedAngle(displayedHeading, targetHeading, headingAlpha);
      if (now - lastEmitAt >= 32) {
        lastEmitAt = now;
        emit(displayedHeading);
      }
    }

    if (pointer instanceof SVGElement && Number.isFinite(targetPointer)) {
      const pointerAlpha = 1 - Math.exp(-dt / 90);
      displayedPointer = easedAngle(displayedPointer, targetPointer, pointerAlpha);
      pointer.style.transform = `rotate(${displayedPointer.toFixed(3)}deg)`;
    }

    frameId = requestAnimationFrame(animate);
  };

  // Capture the raw streams before the original listener. Only one normalized,
  // smoothed stream is allowed through, so duplicate absolute/relative events
  // can no longer fight each other and make the needle jitter.
  window.addEventListener('deviceorientationabsolute', intercept, true);
  window.addEventListener('deviceorientation', intercept, true);
  frameId = requestAnimationFrame(animate);

  const baseCleanup = root.__cleanup;
  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    disposed = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener('deviceorientationabsolute', intercept, true);
    window.removeEventListener('deviceorientation', intercept, true);
    restoreRotor?.();
    restorePointer?.();
    baseCleanup?.();
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla: renderQiblaSafeV2 });
