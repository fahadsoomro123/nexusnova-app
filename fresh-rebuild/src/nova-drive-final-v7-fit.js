const mounted = new WeakSet();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function distanceText(meters) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  return km < 10 ? `${km.toFixed(2)}` : `${km.toFixed(1)}`;
}

function durationText(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setValue(el, value, unit = '') {
  if (!el) return;
  el.innerHTML = `${value}${unit ? `<small>${unit}</small>` : ''}`;
}

function setImportant(el, name, value) {
  el?.style?.setProperty(name, value, 'important');
}

function fitMasterFrame(ui, driveView, trackerView, frame) {
  if (!ui?.isConnected) return;
  const rect = ui.getBoundingClientRect();
  const vv = window.visualViewport;
  const visibleW = Math.max(1, Math.round(rect.width || vv?.width || window.innerWidth || 1));
  const visibleH = Math.max(1, Math.round(rect.height || vv?.height || window.innerHeight || 1));
  const ratio = 864 / 1472;

  let frameW;
  let frameH;
  if ((visibleW / visibleH) > ratio) {
    frameH = visibleH;
    frameW = frameH * ratio;
  } else {
    frameW = visibleW;
    frameH = frameW / ratio;
  }

  frameW = Math.max(1, frameW);
  frameH = Math.max(1, frameH);
  const sideSpace = Math.max(0, (visibleW - frameW) / 2);
  const verticalSpace = Math.max(0, (visibleH - frameH) / 2);
  const portrait = visibleH >= visibleW;

  for (const target of [ui, driveView, trackerView, frame]) {
    setImportant(target, '--nx-final-frame-w', `${frameW.toFixed(3)}px`);
    setImportant(target, '--nx-final-frame-h', `${frameH.toFixed(3)}px`);
    setImportant(target, '--nx-final-side-space', `${sideSpace.toFixed(3)}px`);
    setImportant(target, '--nx-final-vertical-space', `${verticalSpace.toFixed(3)}px`);
    setImportant(target, '--nx-approved-crop-x', '0px');
    setImportant(target, '--nx-approved-crop-y', '0px');
    setImportant(target, '--nx-approved-drive-cover-w', `${frameW.toFixed(3)}px`);
    setImportant(target, '--nx-approved-drive-cover-h', `${frameH.toFixed(3)}px`);
    setImportant(target, '--nx-approved-tracker-cover-w', `${frameW.toFixed(3)}px`);
    setImportant(target, '--nx-approved-tracker-cover-h', `${frameH.toFixed(3)}px`);
  }

  ui.dataset.finalOrientation = portrait ? 'portrait' : 'landscape';
  ui.dataset.finalFit = 'contain';
}

function paintLiveMetrics(ui, detail) {
  if (!ui?.isConnected || !detail || typeof detail !== 'object') return;
  const drive = ui.querySelector('[data-approved-drive-view]');
  if (!drive) return;

  const paused = detail.paused === true;
  const speed = paused ? 0 : Math.max(0, Number(detail.speedKmh) || 0);
  const distance = Math.max(0, Number(detail.distanceM) || 0);
  const moving = Math.max(0, Number(detail.movingMs) || 0);
  const top = Math.max(0, Number(detail.topKmh) || 0);
  const avg = moving > 0
    ? (distance / (moving / 1000)) * 3.6
    : Math.max(0, Number(detail.avgKmh) || 0);

  setValue(drive.querySelector('[data-approved-speed]'), String(Math.round(speed)), 'km/h');
  setValue(drive.querySelector('[data-approved-distance]'), distanceText(distance), 'km');
  setValue(drive.querySelector('[data-approved-average]'), String(Math.round(avg)), 'km/h');
  setValue(drive.querySelector('[data-approved-top]'), String(Math.round(top)), 'km/h');
  setValue(drive.querySelector('[data-approved-duration]'), durationText(moving), 'hh:mm');

  /* v6 owns the LED arc element. Update it directly as a safety path as well as
     through the speed-value MutationObserver, so live native speed always moves it. */
  const arc = drive.querySelector('[data-approved-speed-arc-mask]');
  if (arc) {
    const sweep = (clamp(speed, 0, 160) / 160) * 270;
    arc.style.setProperty('--nx-speed-sweep', `${sweep.toFixed(2)}deg`);
  }
}

function mount(ui) {
  if (!(ui instanceof HTMLElement) || mounted.has(ui)) return;
  const driveView = ui.querySelector('[data-approved-drive-view]');
  const trackerView = ui.querySelector('[data-approved-tracker-view]');
  const frame = ui.querySelector('[data-approved-final-frame]');
  if (!driveView || !trackerView || !frame) return;
  mounted.add(ui);
  ui.classList.add('nx-approved-final-v7');

  let rafA = 0;
  let rafB = 0;
  const queueFit = () => {
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    /* Two RAFs intentionally run after the older v6 cover geometry callback. */
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => fitMasterFrame(ui, driveView, trackerView, frame));
    });
  };

  const onNative = event => paintLiveMetrics(ui, event?.detail);
  const onOrientation = () => queueFit();
  const viewport = window.visualViewport;
  const orientation = window.screen?.orientation;

  window.addEventListener('resize', queueFit, { passive:true });
  window.addEventListener('orientationchange', onOrientation, { passive:true });
  viewport?.addEventListener('resize', queueFit, { passive:true });
  orientation?.addEventListener?.('change', onOrientation);
  window.addEventListener('nexusnova:native-drive', onNative);

  const modeObserver = new MutationObserver(queueFit);
  modeObserver.observe(driveView, { attributes:true, attributeFilter:['class'] });
  modeObserver.observe(trackerView, { attributes:true, attributeFilter:['class'] });

  queueFit();
  window.nexusPostNativeAction?.('nativeDriveStatus');

  const cleanup = setInterval(() => {
    if (ui.isConnected) return;
    clearInterval(cleanup);
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    modeObserver.disconnect();
    window.removeEventListener('resize', queueFit);
    window.removeEventListener('orientationchange', onOrientation);
    viewport?.removeEventListener('resize', queueFit);
    orientation?.removeEventListener?.('change', onOrientation);
    window.removeEventListener('nexusnova:native-drive', onNative);
  }, 900);
}

function scan(node = document) {
  if (node instanceof HTMLElement && node.matches('[data-nx-approved]')) mount(node);
  node.querySelectorAll?.('[data-nx-approved]').forEach(mount);
}

scan();
new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) scan(node);
    }
  }
}).observe(document.documentElement, { childList:true, subtree:true });
