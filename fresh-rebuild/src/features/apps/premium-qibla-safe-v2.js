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
  const svg = pointer?.ownerSVGElement || rotor?.ownerSVGElement || null;
  let restoreRotor = null;
  let restorePointer = null;

  // Keep the large compass face completely static. Android WebView can corrupt
  // SVG tiles when a large filtered group shares a composited surface with a
  // continuously transformed child. Removing only the face shadow/filter keeps
  // the original artwork/math while preventing that re-rasterization path.
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
    // Do not promote the whole 1000x1000 compass into a GPU layer. Only the
    // needle receives a transform; the face remains a normal static paint.
    svg.style.willChange = 'auto';
    svg.style.backfaceVisibility = 'visible';
    svg.style.transform = 'none';
  }

  let targetPointer = NaN;
  let displayedPointer = NaN;

  // Move only the small needle. The glow filter and forced will-change layer
  // are disabled because both are known to trigger broken SVG tile composition
  // on older Android WebView/GPU combinations.
  if (pointer instanceof SVGElement) {
    const ownSetAttribute = pointer.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(pointer);
    const initial = rotateValue(pointer.getAttribute('transform'));
    if (Number.isFinite(initial)) targetPointer = displayedPointer = initial;
    pointer.removeAttribute('transform');
    pointer.removeAttribute('filter');
    pointer.style.transformBox = 'view-box';
    pointer.style.transformOrigin = '50% 50%';
    pointer.style.willChange = 'auto';
    pointer.style.backfaceVisibility = 'visible';
    if (Number.isFinite(displayedPointer)) pointer.style.transform = `rotate(${displayedPointer.toFixed(3)}deg)`;

    pointer.setAttribute = (name, value) => {
      const key = String(name).toLowerCase();
      if (key === 'transform') {
        const angle = rotateValue(value);
        if (Number.isFinite(angle)) {
          targetPointer = angle;
          if (!Number.isFinite(displayedPointer)) displayedPointer = angle;
        }
        return;
      }
      if (key === 'filter') return;
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
