import { premiumQiblaRenderers } from './premium-qibla.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function normalized(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function normalizedHeading(event) {
  const webkit = Number(event?.webkitCompassHeading);
  if (Number.isFinite(webkit)) return normalized(webkit);
  const alpha = Number(event?.alpha);
  if (Number.isFinite(alpha)) return normalized(360 - alpha);
  return NaN;
}

function shortestDelta(from, to) {
  return ((normalized(to) - normalized(from) + 540) % 360) - 180;
}

function rotateValue(value) {
  const match = String(value || '').match(/rotate\(\s*(-?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : NaN;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rewritePaintRefs(node, prefix) {
  const refs = new Set();
  const elements = [node, ...node.querySelectorAll('*')];
  elements.forEach(element => {
    for (const attr of [...element.attributes]) {
      const regex = /url\(#([^)]+)\)/g;
      let match;
      while ((match = regex.exec(attr.value))) refs.add(match[1]);
    }
  });
  const map = new Map([...refs].map(id => [id, `${prefix}-${id}`]));
  elements.forEach(element => {
    for (const attr of [...element.attributes]) {
      let value = attr.value;
      map.forEach((next, old) => { value = value.replaceAll(`url(#${old})`, `url(#${next})`); });
      if (value !== attr.value) element.setAttribute(attr.name, value);
    }
  });
  return map;
}

function buildNeedleOverlay(compass, sourceSvg, sourcePointer) {
  if (!(compass instanceof HTMLElement) || !(sourceSvg instanceof SVGElement) || !(sourcePointer instanceof SVGElement)) return null;

  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('nx2-qb-needle-overlay');
  overlay.setAttribute('viewBox', sourceSvg.getAttribute('viewBox') || '0 0 1000 1000');
  overlay.setAttribute('preserveAspectRatio', sourceSvg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('focusable', 'false');

  const pointer = sourcePointer.cloneNode(true);
  pointer.removeAttribute('data-qb-pointer');
  pointer.removeAttribute('transform');
  [pointer, ...pointer.querySelectorAll('*')].forEach(element => element.removeAttribute('filter'));

  const prefix = `nxq4-${Math.random().toString(36).slice(2, 9)}`;
  const paintMap = rewritePaintRefs(pointer, prefix);
  if (paintMap.size) {
    const defs = document.createElementNS(SVG_NS, 'defs');
    paintMap.forEach((nextId, oldId) => {
      const source = sourceSvg.querySelector(`[id="${oldId}"]`);
      if (!(source instanceof SVGElement)) return;
      const clone = source.cloneNode(true);
      clone.id = nextId;
      defs.appendChild(clone);
    });
    if (defs.childNodes.length) overlay.appendChild(defs);
  }

  overlay.appendChild(pointer);
  Object.assign(overlay.style, {
    position:'absolute', inset:'0', width:'100%', height:'100%', overflow:'visible',
    pointerEvents:'none', transformOrigin:'50% 50%', transformBox:'border-box',
    willChange:'transform', backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
    contain:'strict', zIndex:'4'
  });
  compass.appendChild(overlay);
  return overlay;
}

export function renderQiblaSafeV2() {
  const base = premiumQiblaRenderers.qibla;
  const root = base?.();
  if (!(root instanceof HTMLElement)) return root;

  const compass = root.querySelector('.nx2-qb-compass');
  const rotor = root.querySelector('[data-qb-rotor]');
  const pointer = root.querySelector('[data-qb-pointer]');
  const sourceSvg = pointer?.ownerSVGElement || rotor?.ownerSVGElement || null;

  let restoreRotor = null;
  let restorePointer = null;

  // Android WebView can re-raster the complete 1000x1000 compass whenever a
  // child SVG transform/filter changes. Freeze the face and remove the costly
  // whole-face filters so the background remains a static paint layer.
  if (compass instanceof HTMLElement) {
    compass.style.setProperty('position', 'relative');
    compass.style.setProperty('filter', 'none', 'important');
    compass.style.setProperty('isolation', 'isolate');
    compass.style.setProperty('contain', 'layout paint');
  }
  if (sourceSvg instanceof SVGElement) {
    sourceSvg.style.setProperty('filter', 'none', 'important');
    sourceSvg.style.setProperty('will-change', 'auto');
    sourceSvg.style.setProperty('backface-visibility', 'visible');
  }
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

  // Move only a lightweight transparent needle layer. The original pointer is
  // retained as the base renderer's target sink but never painted.
  const overlay = buildNeedleOverlay(compass, sourceSvg, pointer);
  let targetPointer = NaN;
  let visualPointer = NaN;
  let needleFrame = 0;
  let needleLastAt = 0;

  const paintNeedle = angle => {
    if (!(overlay instanceof SVGElement) || !Number.isFinite(angle)) return;
    overlay.style.transform = `rotate(${angle.toFixed(3)}deg)`;
  };

  const animateNeedle = now => {
    needleFrame = 0;
    if (!Number.isFinite(targetPointer) || !Number.isFinite(visualPointer) || !(overlay instanceof SVGElement)) return;
    const dt = clamp(needleLastAt ? (now - needleLastAt) / 1000 : 1 / 60, 1 / 240, 0.05);
    needleLastAt = now;
    const difference = targetPointer - visualPointer;
    if (Math.abs(difference) <= 0.035) {
      visualPointer = targetPointer;
      paintNeedle(visualPointer);
      needleLastAt = 0;
      return;
    }
    const response = 1 - Math.exp(-dt / 0.105);
    const maximumStep = 430 * dt;
    let step = clamp(difference * response, -maximumStep, maximumStep);
    if (Math.abs(step) < 0.012) step = Math.sign(difference) * Math.min(Math.abs(difference), 0.012);
    visualPointer += step;
    paintNeedle(visualPointer);
    needleFrame = requestAnimationFrame(animateNeedle);
  };

  const setNeedleTarget = angle => {
    if (!Number.isFinite(angle)) return;
    if (!Number.isFinite(targetPointer)) targetPointer = angle;
    else targetPointer += shortestDelta(targetPointer, angle);
    if (!Number.isFinite(visualPointer)) {
      visualPointer = targetPointer;
      paintNeedle(visualPointer);
      return;
    }
    if (!needleFrame) needleFrame = requestAnimationFrame(animateNeedle);
  };

  if (pointer instanceof SVGElement) {
    const ownSetAttribute = pointer.setAttribute;
    const nativeSetAttribute = ownSetAttribute.bind(pointer);
    const initial = rotateValue(pointer.getAttribute('transform'));
    pointer.removeAttribute('transform');
    pointer.removeAttribute('filter');
    pointer.style.display = 'none';
    if (Number.isFinite(initial)) setNeedleTarget(initial);

    pointer.setAttribute = (name, value) => {
      const key = String(name).toLowerCase();
      if (key === 'transform') {
        const angle = rotateValue(value);
        if (Number.isFinite(angle)) setNeedleTarget(angle);
        return;
      }
      if (key === 'filter') return;
      nativeSetAttribute(name, value);
    };

    restorePointer = () => {
      try { delete pointer.setAttribute; } catch { pointer.setAttribute = ownSetAttribute; }
      pointer.style.display = '';
      pointer.removeAttribute('filter');
    };
  }

  // Sensor conditioning: absolute heading wins, tiny magnetic jitter is ignored,
  // implausible single-frame jumps are velocity-limited, then a circular low-pass
  // filter is applied before the base Qibla math sees the heading.
  let disposed = false;
  let filteredHeading = NaN;
  let lastSensorAt = 0;
  let lastAbsoluteAt = 0;
  let lastEmitAt = 0;
  let pendingHeading = NaN;
  let emitTimer = 0;
  const EMIT_INTERVAL_MS = 33;
  const FILTER_TAU_MS = 135;
  const MAX_SENSOR_SPEED = 430;
  const JITTER_DEADBAND = 0.22;

  const emit = heading => {
    if (disposed || !Number.isFinite(heading)) return;
    lastEmitAt = performance.now();
    const value = normalized(heading);
    const synthetic = new Event('deviceorientation');
    Object.defineProperty(synthetic, '__nxQiblaNormalized', { value:true });
    Object.defineProperty(synthetic, 'webkitCompassHeading', { value });
    Object.defineProperty(synthetic, 'alpha', { value:360 - value });
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
    else if (now - lastAbsoluteAt < 2500) {
      event.stopImmediatePropagation();
      return;
    }

    const raw = normalizedHeading(event);
    if (!Number.isFinite(raw)) return;
    event.stopImmediatePropagation();

    if (!Number.isFinite(filteredHeading)) {
      filteredHeading = raw;
      lastSensorAt = now;
      scheduleEmit(filteredHeading);
      return;
    }

    const dtMs = clamp(lastSensorAt ? now - lastSensorAt : 16.7, 8, 140);
    lastSensorAt = now;
    let delta = shortestDelta(filteredHeading, raw);
    const maxDelta = Math.max(5.5, MAX_SENSOR_SPEED * dtMs / 1000);
    delta = clamp(delta, -maxDelta, maxDelta);
    if (Math.abs(delta) <= JITTER_DEADBAND) return;

    const alpha = 1 - Math.exp(-dtMs / FILTER_TAU_MS);
    filteredHeading = normalized(filteredHeading + delta * alpha);
    scheduleEmit(filteredHeading);
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
    if (needleFrame) cancelAnimationFrame(needleFrame);
    emitTimer = 0;
    needleFrame = 0;
    window.removeEventListener('deviceorientationabsolute', intercept, true);
    window.removeEventListener('deviceorientation', intercept, true);
    overlay?.remove();
    restoreRotor?.();
    restorePointer?.();
    baseCleanup?.();
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla: renderQiblaSafeV2 });
