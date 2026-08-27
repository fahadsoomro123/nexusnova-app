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
  return previous + shortestDelta(previous, next) * alpha;
}

function rotateValue(value) {
  const match = String(value || '').match(/rotate\(\s*(-?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : NaN;
}

function normalized(value) {
  return ((Number(value) % 360) + 360) % 360;
}

export function renderQiblaSafeV2() {
  const base = premiumQiblaRenderers.qibla;
  const root = base?.();
  if (!(root instanceof HTMLElement)) return root;

  const rotor = root.querySelector('[data-qb-rotor]');
  const pointer = root.querySelector('[data-qb-pointer]');
  const svg = pointer?.ownerSVGElement || rotor?.ownerSVGElement || null;
  let restoreRotor = null;
  let restorePointer = null;

  // The face never moves. Removing only the large SVG filter keeps the artwork
  // intact while avoiding the Android WebView tile-corruption path seen on the
  // tested device.
  if (rotor instanceof SVGElement) {
    const ownSetAttribute = rotor.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(rotor);
    rotor.removeAttribute('transform');
    rotor.removeAttribute('filter');
    rotor.setAttribute = (name, value) => {
      const key = String(name).toLowerCase();
      if (key === 'transform' || key === 'filter') return;
      nativeSetAttribute(name, value);
    };
    restoreRotor = () => {
      try { delete rotor.setAttribute; } catch { rotor.setAttribute = ownSetAttribute; }
      rotor.removeAttribute('transform');
      rotor.removeAttribute('filter');
    };
  }

  if (svg instanceof SVGElement) {
    svg.style.willChange = 'auto';
    svg.style.transform = 'none';
    svg.style.backfaceVisibility = 'visible';
  }

  // Only the small needle moves. CSS transition gives the same damped/gimbal
  // feel without a permanent continuous frame loop, which removes the
  // continuous CPU/GPU load that could take down the WebView renderer.
  let visualPointer = NaN;
  if (pointer instanceof SVGElement) {
    const ownSetAttribute = pointer.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(pointer);
    const initial = rotateValue(pointer.getAttribute('transform'));
    if (Number.isFinite(initial)) visualPointer = initial;
    pointer.removeAttribute('transform');
    pointer.removeAttribute('filter');
    pointer.style.transformBox = 'view-box';
    pointer.style.transformOrigin = '50% 50%';
    pointer.style.transition = 'transform 125ms cubic-bezier(.22,.72,.22,1)';
    pointer.style.willChange = 'auto';
    pointer.style.backfaceVisibility = 'visible';
    if (Number.isFinite(visualPointer)) pointer.style.transform = `rotate(${visualPointer.toFixed(3)}deg)`;

    pointer.setAttribute = (name, value) => {
      const key = String(name).toLowerCase();
      if (key === 'transform') {
        const angle = rotateValue(value);
        if (Number.isFinite(angle)) {
          if (!Number.isFinite(visualPointer)) visualPointer = angle;
          else visualPointer += shortestDelta(normalized(visualPointer), normalized(angle));
          pointer.style.transform = `rotate(${visualPointer.toFixed(3)}deg)`;
        }
        return;
      }
      if (key === 'filter') return;
      nativeSetAttribute(name, value);
    };

    restorePointer = () => {
      try { delete pointer.setAttribute; } catch { pointer.setAttribute = ownSetAttribute; }
      pointer.style.transition = '';
      pointer.style.willChange = '';
      pointer.style.backfaceVisibility = '';
    };
  }

  let disposed = false;
  let smoothedHeading = NaN;
  let pendingHeading = NaN;
  let lastAbsoluteAt = 0;
  let lastEmitAt = 0;
  let emitTimer = 0;
  const EMIT_INTERVAL_MS = 52;

  const emit = heading => {
    if (disposed || !Number.isFinite(heading)) return;
    lastEmitAt = performance.now();
    const value = normalized(heading);
    const synthetic = new Event('deviceorientation');
    Object.defineProperty(synthetic, '__nxQiblaNormalized', { value: true });
    Object.defineProperty(synthetic, 'webkitCompassHeading', { value });
    Object.defineProperty(synthetic, 'alpha', { value: 360 - value });
    window.dispatchEvent(synthetic);
  };

  const scheduleEmit = heading => {
    pendingHeading = heading;
    const elapsed = performance.now() - lastEmitAt;
    if (elapsed >= EMIT_INTERVAL_MS && !emitTimer) {
      const next = pendingHeading;
      pendingHeading = NaN;
      emit(next);
      return;
    }
    if (emitTimer) return;
    emitTimer = window.setTimeout(() => {
      emitTimer = 0;
      const next = pendingHeading;
      pendingHeading = NaN;
      emit(next);
    }, Math.max(1, EMIT_INTERVAL_MS - elapsed));
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
    smoothedHeading = easedAngle(smoothedHeading, heading, 0.24);
    scheduleEmit(smoothedHeading);
  };

  window.addEventListener('deviceorientationabsolute', intercept, true);
  window.addEventListener('deviceorientation', intercept, true);

  const baseCleanup = root.__cleanup;
  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    disposed = true;
    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = 0;
    window.removeEventListener('deviceorientationabsolute', intercept, true);
    window.removeEventListener('deviceorientation', intercept, true);
    restoreRotor?.();
    restorePointer?.();
    baseCleanup?.();
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla: renderQiblaSafeV2 });
