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

function buildLiteNeedle(compass, sourceSvg, sourcePointer) {
  if (!(compass instanceof HTMLElement) || !(sourceSvg instanceof SVGElement) || !(sourcePointer instanceof SVGElement)) return null;
  const needle = document.createElement('div');
  needle.className = 'nx2-qb-needle-lite';
  needle.setAttribute('aria-hidden', 'true');

  // Reuse the approved golden pointer artwork, but crop its SVG surface from
  // 1000x1000 to a narrow 140x500 strip so Android never promotes a full-screen
  // transparent moving tile.
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('viewBox', '430 0 140 500');
  overlay.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  overlay.setAttribute('focusable', 'false');

  const pointer = sourcePointer.cloneNode(true);
  pointer.removeAttribute('data-qb-pointer');
  pointer.removeAttribute('transform');
  [pointer, ...pointer.querySelectorAll('*')].forEach(element => element.removeAttribute('filter'));

  const prefix = `nxq-lite-${Math.random().toString(36).slice(2, 9)}`;
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
  needle.appendChild(overlay);
  compass.appendChild(needle);
  return needle;
}

function installLiteNeedleStyle(root) {
  const style = document.createElement('style');
  style.textContent = `
    .nx2-qb-compass{position:relative!important;isolation:auto!important;contain:none!important;filter:none!important}
    .nx2-qb-needle-lite{
      position:absolute;z-index:6;left:50%;top:7%;bottom:50%;width:52px;margin-left:-26px;
      transform:rotate(0deg);transform-origin:50% 100%;
      transition:transform 112ms cubic-bezier(.2,.78,.24,1);pointer-events:none;
    }
    .nx2-qb-needle-lite svg{display:block;width:100%;height:100%;overflow:visible;filter:none}
    @media(max-width:390px){
      .nx2-qb-needle-lite{width:46px;margin-left:-23px}
    }
    @media(prefers-reduced-motion:reduce){.nx2-qb-needle-lite{transition-duration:0ms}}
  `;
  root.prepend(style);
  return style;
}

function compactReusableInfo(root) {
  const readyCopy = root.querySelector('.nx2-qb-ready > div:nth-child(2)');
  const location = root.querySelector('[data-qb-location]');
  const distance = root.querySelector('[data-qb-distance]');
  const status = root.querySelector('[data-qb-status]');
  if (!(readyCopy instanceof HTMLElement) || !(status instanceof HTMLElement)) return null;

  const meta = document.createElement('div');
  meta.className = 'nx2-qb-ready-meta';
  if (location instanceof HTMLElement) meta.appendChild(location);
  if (distance instanceof HTMLElement) {
    const distanceWrap = document.createElement('span');
    distanceWrap.className = 'nx2-qb-ready-distance';
    distanceWrap.append(distance, document.createTextNode(' km'));
    meta.appendChild(distanceWrap);
  }
  readyCopy.insertBefore(meta, status);
  return meta;
}

function flattenStaticFace(sourceSvg) {
  if (!(sourceSvg instanceof SVGElement)) return null;
  let objectUrl = '';
  let disposed = false;
  let ready = false;
  let requestedSize = 0;
  let replaced = false;

  const canvas = document.createElement('canvas');
  canvas.className = 'nx2-qb-face-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Qibla compass');
  Object.assign(canvas.style, {
    display:'block', width:'100%', height:'100%', pointerEvents:'none'
  });

  const image = new Image();
  const paint = size => {
    requestedSize = Number(size) || requestedSize;
    if (!ready || disposed || requestedSize <= 0) return;
    const ratio = clamp(Number(window.devicePixelRatio) || 1, 1, 2.25);
    const pixels = Math.round(clamp(requestedSize * ratio, 480, 1100));
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    const context = canvas.getContext('2d', { alpha:true });
    if (!context) return;
    context.clearRect(0, 0, pixels, pixels);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, pixels, pixels);
    if (!replaced && sourceSvg.isConnected) {
      sourceSvg.replaceWith(canvas);
      replaced = true;
    }
  };

  try {
    const clone = sourceSvg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '1000');
    clone.setAttribute('height', '1000');
    const markup = new XMLSerializer().serializeToString(clone);
    objectUrl = URL.createObjectURL(new Blob([markup], { type:'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      ready = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
      paint(requestedSize);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    };
    image.src = objectUrl;
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }

  return {
    paint,
    dispose() {
      disposed = true;
      image.onload = null;
      image.onerror = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
  };
}

export function renderQiblaSafeV2() {
  const base = premiumQiblaRenderers.qibla;
  const root = base?.();
  if (!(root instanceof HTMLElement)) return root;

  const compass = root.querySelector('.nx2-qb-compass');
  const visual = root.querySelector('.nx2-qb-visual');
  const rotor = root.querySelector('[data-qb-rotor]');
  const pointer = root.querySelector('[data-qb-pointer]');
  const sourceSvg = pointer?.ownerSVGElement || rotor?.ownerSVGElement || null;

  installLiteNeedleStyle(root);
  compactReusableInfo(root);

  // The premium face is cloned once and then never mutated. The base renderer
  // continues writing to its detached rotor, so sensor samples cannot invalidate
  // or re-raster the large visible SVG on Android WebView.
  if (rotor instanceof SVGElement) {
    const staticRotor = rotor.cloneNode(true);
    staticRotor.removeAttribute('data-qb-rotor');
    staticRotor.removeAttribute('transform');
    staticRotor.removeAttribute('filter');
    staticRotor.querySelectorAll('[filter]').forEach(element => element.removeAttribute('filter'));
    rotor.replaceWith(staticRotor);
  }

  // The original pointer remains the base renderer's calculation sink but is
  // detached from paint. Only a narrow HTML/CSS needle is composited and moved.
  const needle = buildLiteNeedle(compass, sourceSvg, pointer);
  let needleTarget = NaN;
  const setNeedleTarget = angle => {
    if (!(needle instanceof HTMLElement) || !Number.isFinite(angle)) return;
    if (!Number.isFinite(needleTarget)) needleTarget = angle;
    else needleTarget += shortestDelta(needleTarget, angle);
    needle.style.transform = `rotate(${needleTarget.toFixed(3)}deg)`;
  };

  let pointerObserver = null;
  if (pointer instanceof SVGElement) {
    const initial = rotateValue(pointer.getAttribute('transform'));
    pointer.removeAttribute('filter');
    pointer.remove();
    if (Number.isFinite(initial)) setNeedleTarget(initial);
    pointerObserver = new MutationObserver(() => {
      const angle = rotateValue(pointer.getAttribute('transform'));
      if (Number.isFinite(angle)) setNeedleTarget(angle);
    });
    pointerObserver.observe(pointer, { attributes:true, attributeFilter:['transform'] });
  }

  if (compass instanceof HTMLElement) {
    compass.style.setProperty('position', 'relative');
    compass.style.setProperty('filter', 'none', 'important');
    compass.style.setProperty('transform', 'none', 'important');
  }
  if (sourceSvg instanceof SVGElement) {
    sourceSvg.style.setProperty('filter', 'none', 'important');
    sourceSvg.style.setProperty('transform', 'none', 'important');
    sourceSvg.querySelectorAll('filter').forEach(filter => filter.remove());
  }
  const flatFace = flattenStaticFace(sourceSvg);

  // Fit the square to the exact free fullscreen cell. This is layout-only and
  // runs on viewport changes, never as a continuous sensor animation loop.
  const fitCompass = () => {
    if (!(compass instanceof HTMLElement) || !(visual instanceof HTMLElement)) return;
    const size = Math.floor(Math.min(visual.clientWidth, visual.clientHeight));
    if (size > 0) {
      compass.style.setProperty('--nx-qb-fit-size', `${size}px`);
      flatFace?.paint(size);
    }
  };
  const resizeObserver = typeof ResizeObserver === 'function' && visual instanceof HTMLElement
    ? new ResizeObserver(fitCompass)
    : null;
  const layoutObserver = new MutationObserver(fitCompass);
  resizeObserver?.observe(visual);
  layoutObserver.observe(root, { attributes:true, attributeFilter:['class'] });
  window.addEventListener('resize', fitCompass, { passive:true });
  queueMicrotask(fitCompass);

  // Absolute heading wins. A circular low-pass filter removes magnetic jitter,
  // while the speed limit rejects implausible single-sample jumps.
  let disposed = false;
  let filteredHeading = NaN;
  let lastSensorAt = 0;
  let lastAbsoluteAt = 0;
  let lastEmitAt = 0;
  let pendingHeading = NaN;
  let emitTimer = 0;
  const EMIT_INTERVAL_MS = 33;
  const FILTER_TAU_MS = 95;
  const MAX_SENSOR_SPEED = 540;
  const JITTER_DEADBAND = 0.18;

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
    const maxDelta = Math.max(6, MAX_SENSOR_SPEED * dtMs / 1000);
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
    emitTimer = 0;
    pointerObserver?.disconnect();
    resizeObserver?.disconnect();
    layoutObserver.disconnect();
    flatFace?.dispose();
    window.removeEventListener('resize', fitCompass);
    window.removeEventListener('deviceorientationabsolute', intercept, true);
    window.removeEventListener('deviceorientation', intercept, true);
    needle?.remove();
    baseCleanup?.();
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla:renderQiblaSafeV2 });
