const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;
const FACE_ASSET = './assets/qibla/qibla-purple-gold-face.webp';
const POINTER_ASSET = './assets/qibla/qibla-purple-gold-pointer.png';

function normalized(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function shortestDelta(from, to) {
  return ((normalized(to) - normalized(from) + 540) % 360) - 180;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function headingFromEvent(event) {
  const webkitHeading = event?.webkitCompassHeading == null ? NaN : Number(event.webkitCompassHeading);
  if (Number.isFinite(webkitHeading)) return normalized(webkitHeading);
  const alpha = event?.alpha == null ? NaN : Number(event.alpha);
  if (Number.isFinite(alpha)) return normalized(360 - alpha);
  return NaN;
}

function bearingToKaaba(latitude, longitude) {
  const startLatitude = Number(latitude) * Math.PI / 180;
  const kaabaLatitude = KAABA_LATITUDE * Math.PI / 180;
  const longitudeDelta = (KAABA_LONGITUDE - Number(longitude)) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(kaabaLatitude);
  const x = Math.cos(startLatitude) * Math.sin(kaabaLatitude)
    - Math.sin(startLatitude) * Math.cos(kaabaLatitude) * Math.cos(longitudeDelta);
  return normalized(Math.atan2(y, x) * 180 / Math.PI);
}

function distanceToKaaba(latitude, longitude) {
  const earthRadiusKm = 6371;
  const startLatitude = Number(latitude) * Math.PI / 180;
  const kaabaLatitude = KAABA_LATITUDE * Math.PI / 180;
  const latitudeDelta = (KAABA_LATITUDE - Number(latitude)) * Math.PI / 180;
  const longitudeDelta = (KAABA_LONGITUDE - Number(longitude)) * Math.PI / 180;
  const rawA = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(kaabaLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const a = clamp(rawA, 0, 1);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is unavailable on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    });
  });
}

function locationErrorMessage(error) {
  if (Number(error?.code) === 1) return 'Location permission is required for Qibla.';
  if (Number(error?.code) === 2) return 'Turn on device location to calculate Qibla.';
  if (Number(error?.code) === 3) return 'Location request timed out. Reopen Qibla to retry.';
  return error?.message || 'Location is unavailable on this device.';
}

const styles = `
  html.nxq5-fullscreen-active,
  html.nxq5-fullscreen-active body{
    width:100%;height:100%;min-height:100%;overflow:hidden!important;overscroll-behavior:none;
  }
  html.nxq5-fullscreen-active body{
    background:#0b0710!important;color:#fff!important;
  }
  html.nxq5-fullscreen-active body .nx-app{
    width:100%!important;max-width:760px!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;
  }
  html.nxq5-fullscreen-active body .nx-stage{
    width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;padding:0!important;
    scroll-padding:0!important;overflow:hidden!important;background:#0b0710!important;
  }
  html.nxq5-fullscreen-active body .nx-dock,
  html.nxq5-fullscreen-active body #nx-mine-brand-portal{
    display:none!important;
  }
  html.nxq5-fullscreen-active .nx2-qibla-screen{
    width:100%!important;height:100dvh!important;min-height:0!important;max-height:100dvh!important;
    margin:0!important;padding:0!important;overflow:hidden!important;background:#0b0710!important;
  }
  html.nxq5-fullscreen-active .nx2-qibla-screen>.nx-app-head{display:none!important}
  html.nxq5-fullscreen-active .nx2-qibla-screen>[data-app-mount]{
    width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
  }
  .nxq5-qibla{
    box-sizing:border-box!important;width:100%!important;max-width:none!important;height:100%!important;min-height:0!important;
    margin:0!important;padding:0!important;overflow:hidden!important;color:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
  }
  .nxq5-qibla *{box-sizing:border-box}
  .nxq5-page{
    position:relative;width:100%;height:100%;min-height:0;overflow:hidden;isolation:isolate;
    background:
      radial-gradient(circle at 50% 47%,rgba(111,34,150,.42),transparent 42%),
      radial-gradient(circle at 50% 34%,rgba(66,19,91,.34),transparent 59%),
      linear-gradient(180deg,#24102f 0%,#16091f 53%,#0b0710 100%);
  }
  .nxq5-page::before{
    content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.45;
    background:radial-gradient(ellipse at 50% 47%,transparent 40%,rgba(0,0,0,.55) 100%);
  }
  .nxq5-back{
    position:absolute;z-index:20;top:calc(env(safe-area-inset-top,0px) + 9px);left:max(9px,env(safe-area-inset-left,0px));
    width:42px;height:42px;display:grid;place-items:center;padding:0 0 2px;border:1px solid rgba(218,151,255,.35);border-radius:14px;
    color:#fff;background:linear-gradient(145deg,rgba(75,20,103,.92),rgba(21,5,31,.96));
    box-shadow:inset 0 1px rgba(255,255,255,.16),0 8px 24px rgba(0,0,0,.34);font:750 30px/1 system-ui,sans-serif;
    -webkit-tap-highlight-color:transparent;cursor:pointer;
  }
  .nxq5-back:active{transform:scale(.95)}
  .nxq5-stage{position:absolute;z-index:2;inset:0;min-width:0;min-height:0;overflow:hidden;pointer-events:none}
  .nxq5-compass{
    position:absolute;left:50%;top:var(--nxq5-compass-y,50%);width:320px;height:320px;max-width:none;max-height:none;
    overflow:visible;transform:translate(-50%,-50%) translateZ(0);filter:drop-shadow(0 18px 26px rgba(0,0,0,.38));
    contain:layout style;
  }
  .nxq5-face,.nxq4-pointer,.nxq5-pointer{position:absolute;display:block;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none}
  .nxq5-face{z-index:1;inset:0;width:100%;height:100%;border-radius:50%}
  .nxq4-pointer,.nxq5-pointer{
    z-index:2;inset:13%;width:74%;height:74%;opacity:0;transform-origin:50% 50%;transform:rotate(0deg);backface-visibility:hidden;
    transition:transform 105ms cubic-bezier(.2,.74,.22,1),opacity 150ms ease-out;
  }
  .nxq4-pointer.is-ready,.nxq5-pointer.is-ready{opacity:1}
  .nxq5-metrics{
    position:absolute;z-index:8;left:max(8px,env(safe-area-inset-left,0px));right:max(8px,env(safe-area-inset-right,0px));
    bottom:calc(env(safe-area-inset-bottom,0px) + 8px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;
    width:auto;max-width:520px;margin:auto;
  }
  .nxq5-metric{
    min-width:0;height:66px;padding:9px 12px 8px;border:1px solid rgba(213,139,255,.36);border-radius:17px;
    display:flex;flex-direction:column;justify-content:center;align-items:center;
    background:linear-gradient(145deg,rgba(55,12,76,.93),rgba(17,4,27,.97));
    box-shadow:inset 0 1px rgba(255,255,255,.12),0 10px 25px rgba(0,0,0,.28);overflow:hidden;text-align:center;
  }
  .nxq5-metric>span{display:block;color:#e2a5ff;font-size:9px;font-weight:850;letter-spacing:.1em;white-space:nowrap}
  .nxq5-metric>strong{display:block;margin-top:5px;color:#fff5cf;font-size:clamp(21px,6vw,27px);line-height:1;font-weight:850;white-space:nowrap;text-shadow:0 0 13px rgba(255,190,73,.19)}
  .nxq5-metric>strong small{font-size:.42em;color:#e4bd67;font-weight:800}
  .nxq5-error{
    position:absolute;z-index:12;top:calc(env(safe-area-inset-top,0px) + 58px);left:50%;width:max-content;max-width:calc(100% - 24px);
    margin:0;padding:7px 10px;border:1px solid rgba(255,181,99,.38);border-radius:12px;transform:translateX(-50%);
    color:#ffe5bc;background:rgba(41,11,35,.92);box-shadow:0 8px 20px rgba(0,0,0,.3);font-size:10px;line-height:1.3;text-align:center;
  }
  .nxq5-error[hidden]{display:none!important}
  @media(max-height:620px){
    .nxq5-back{width:38px;height:38px;top:calc(env(safe-area-inset-top,0px) + 6px);left:6px}
    .nxq5-metric{height:58px;padding:7px 9px}.nxq5-metric>strong{margin-top:3px}
  }
  @media(max-width:390px){
    .nxq5-metrics{left:5px;right:5px;gap:5px}.nxq5-metric{padding-left:9px;padding-right:9px;border-radius:15px}
  }
  @media(prefers-reduced-motion:reduce){.nxq4-pointer,.nxq5-pointer{transition-duration:0ms}}
`;

export function renderQiblaSafeV2() {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx2-qibla nxq5-qibla';
  root.innerHTML = `
    <style>${styles}</style>
    <section class="nxq5-page" aria-label="Qibla compass">
      <button class="nxq5-back" type="button" data-qb-back aria-label="Back to Nova Hub">‹</button>
      <div class="nxq5-stage">
        <div class="nxq5-compass" role="img" aria-label="Live purple and gold Qibla compass">
          <img class="nxq4-pointer nxq5-pointer" data-qb-pointer src="${POINTER_ASSET}" alt="" draggable="false" decoding="async" fetchpriority="high">
          <img class="nxq5-face" src="${FACE_ASSET}" alt="" draggable="false" decoding="async" fetchpriority="high">
        </div>
      </div>
      <section class="nxq5-metrics" aria-label="Qibla results">
        <article class="nxq5-metric">
          <span>QIBLA DIRECTION</span>
          <strong data-qb-bearing>—</strong>
        </article>
        <article class="nxq5-metric">
          <span>DISTANCE</span>
          <strong><b data-qb-distance>—</b> <small>km</small></strong>
        </article>
      </section>
      <p class="nxq5-error" data-qb-error role="status" aria-live="polite" hidden></p>
    </section>
  `;

  const page = root.querySelector('.nxq5-page');
  const stage = root.querySelector('.nxq5-stage');
  const compass = root.querySelector('.nxq5-compass');
  const metrics = root.querySelector('.nxq5-metrics');
  const backButton = root.querySelector('[data-qb-back]');
  const pointer = root.querySelector('[data-qb-pointer]');
  const bearingElement = root.querySelector('[data-qb-bearing]');
  const distanceElement = root.querySelector('[data-qb-distance]');
  const errorElement = root.querySelector('[data-qb-error]');

  let screen = null;
  let bearing = NaN;
  let filteredHeading = NaN;
  let displayedPointerAngle = NaN;
  let lastSensorAt = 0;
  let lastAbsoluteAt = 0;
  let lastPaintAt = 0;
  let pendingPaintTimer = 0;
  let sensorTimeout = 0;
  let disposed = false;

  const errors = { location:'', sensor:'' };
  const renderError = () => {
    if (!(errorElement instanceof HTMLElement)) return;
    const message = errors.location || errors.sensor;
    errorElement.textContent = message;
    errorElement.hidden = !message;
  };

  const fitCompass = () => {
    if (!(page instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(compass instanceof HTMLElement) || !(metrics instanceof HTMLElement)) return;
    const pageRect = page.getBoundingClientRect();
    const metricsRect = metrics.getBoundingClientRect();
    const topEdge = 6;
    const metricGap = 8;
    const bottomEdge = Math.max(topEdge, metricsRect.top - pageRect.top - metricGap);
    const availableHeight = Math.max(0, bottomEdge - topEdge);
    const availableWidth = Math.max(0, page.clientWidth - 12);
    const size = Math.floor(Math.min(availableWidth, availableHeight, 560));
    if (size <= 0) return;

    const desiredCenterY = page.clientHeight / 2;
    const minCenterY = topEdge + size / 2;
    const maxCenterY = bottomEdge - size / 2;
    const centerY = minCenterY <= maxCenterY
      ? clamp(desiredCenterY, minCenterY, maxCenterY)
      : (topEdge + bottomEdge) / 2;

    compass.style.width = `${size}px`;
    compass.style.height = `${size}px`;
    stage.style.setProperty('--nxq5-compass-y', `${centerY.toFixed(2)}px`);
  };

  const paintPointer = () => {
    if (!(pointer instanceof HTMLElement) || !Number.isFinite(bearing) || !Number.isFinite(filteredHeading)) return;
    const target = shortestDelta(filteredHeading, bearing);
    if (!Number.isFinite(displayedPointerAngle)) displayedPointerAngle = target;
    else displayedPointerAngle += shortestDelta(displayedPointerAngle, target);
    pointer.style.transform = `rotate(${displayedPointerAngle.toFixed(3)}deg)`;
    pointer.classList.add('is-ready');
  };

  const schedulePointerPaint = () => {
    const elapsed = performance.now() - lastPaintAt;
    if (elapsed >= 33 && !pendingPaintTimer) {
      lastPaintAt = performance.now();
      paintPointer();
      return;
    }
    if (pendingPaintTimer) return;
    pendingPaintTimer = window.setTimeout(() => {
      pendingPaintTimer = 0;
      if (disposed) return;
      lastPaintAt = performance.now();
      paintPointer();
    }, Math.max(1, 33 - elapsed));
  };

  const onOrientation = event => {
    if (disposed) return;
    const now = performance.now();
    const rawHeading = headingFromEvent(event);
    if (!Number.isFinite(rawHeading)) return;
    const absolute = event.type === 'deviceorientationabsolute' || event.absolute === true;
    if (absolute) lastAbsoluteAt = now;
    else if (now - lastAbsoluteAt < 2500) return;
    errors.sensor = '';
    renderError();
    if (sensorTimeout) {
      clearTimeout(sensorTimeout);
      sensorTimeout = 0;
    }

    if (!Number.isFinite(filteredHeading)) {
      filteredHeading = rawHeading;
      lastSensorAt = now;
      schedulePointerPaint();
      return;
    }

    const elapsed = clamp(lastSensorAt ? now - lastSensorAt : 16.7, 8, 140);
    lastSensorAt = now;
    let delta = shortestDelta(filteredHeading, rawHeading);
    const maximumDelta = Math.max(6, 540 * elapsed / 1000);
    delta = clamp(delta, -maximumDelta, maximumDelta);
    if (Math.abs(delta) <= .18) return;
    const smoothing = 1 - Math.exp(-elapsed / 95);
    filteredHeading = normalized(filteredHeading + delta * smoothing);
    schedulePointerPaint();
  };

  const attachOrientation = () => {
    window.addEventListener('deviceorientationabsolute', onOrientation, true);
    window.addEventListener('deviceorientation', onOrientation, true);
    sensorTimeout = window.setTimeout(() => {
      sensorTimeout = 0;
      if (disposed || Number.isFinite(filteredHeading)) return;
      errors.sensor = 'Compass sensor is unavailable on this device.';
      renderError();
    }, 8000);
  };

  const startOrientationAutomatically = async () => {
    try {
      const OrientationEvent = window.DeviceOrientationEvent;
      if (typeof OrientationEvent?.requestPermission === 'function') {
        const permission = await OrientationEvent.requestPermission();
        if (disposed) return;
        if (permission !== 'granted') throw new Error('Motion permission is required for Qibla.');
      }
      if (!disposed) attachOrientation();
    } catch (error) {
      if (disposed) return;
      errors.sensor = error?.message || 'Compass sensor permission is required.';
      renderError();
    }
  };

  const loadLocationAutomatically = async () => {
    try {
      const position = await currentPosition();
      if (disposed) return;
      const rawLatitude = position?.coords?.latitude;
      const rawLongitude = position?.coords?.longitude;
      const latitude = rawLatitude == null ? NaN : Number(rawLatitude);
      const longitude = rawLongitude == null ? NaN : Number(rawLongitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Location returned invalid coordinates.');
      }
      bearing = bearingToKaaba(latitude, longitude);
      const distance = distanceToKaaba(latitude, longitude);
      if (bearingElement instanceof HTMLElement) bearingElement.textContent = `${Math.round(bearing)}°`;
      if (distanceElement instanceof HTMLElement) distanceElement.textContent = Math.round(distance).toLocaleString();
      errors.location = '';
      renderError();
      schedulePointerPaint();
    } catch (error) {
      if (disposed) return;
      errors.location = locationErrorMessage(error);
      renderError();
    }
  };

  const openHub = () => {
    const appBack = screen?.querySelector(':scope > .nx-app-head [data-app-back]');
    if (appBack instanceof HTMLElement) appBack.click();
    else window.NexusNovaFresh?.openHub?.();
  };

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(fitCompass)
    : null;
  if (page instanceof HTMLElement) resizeObserver?.observe(page);
  if (metrics instanceof HTMLElement) resizeObserver?.observe(metrics);
  backButton?.addEventListener('click', openHub);
  window.addEventListener('resize', fitCompass, { passive:true });
  window.visualViewport?.addEventListener('resize', fitCompass, { passive:true });

  queueMicrotask(() => {
    if (disposed) return;
    screen = root.closest('.nx-screen');
    document.documentElement.classList.add('nxq5-fullscreen-active');
    screen?.classList.add('nx2-qibla-screen');
    fitCompass();
    queueMicrotask(() => {
      if (!disposed) fitCompass();
    });
    startOrientationAutomatically();
    loadLocationAutomatically();
  });

  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    disposed = true;
    if (pendingPaintTimer) clearTimeout(pendingPaintTimer);
    if (sensorTimeout) clearTimeout(sensorTimeout);
    pendingPaintTimer = 0;
    sensorTimeout = 0;
    resizeObserver?.disconnect();
    backButton?.removeEventListener('click', openHub);
    window.removeEventListener('resize', fitCompass);
    window.visualViewport?.removeEventListener('resize', fitCompass);
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
    screen?.classList.remove('nx2-qibla-screen');
    document.documentElement.classList.remove('nxq5-fullscreen-active');
  };

  return root;
}

export const qiblaSafeV2Renderers = Object.freeze({ qibla:renderQiblaSafeV2 });