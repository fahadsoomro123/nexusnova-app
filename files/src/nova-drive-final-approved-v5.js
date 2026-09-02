import { hydrateDriveTrackState } from './core/drive-track-persistence.js';

const mounted = new WeakSet();

function notify(ui, message) {
  const toast = ui.querySelector('[data-approved-toast]');
  if (!toast) return;
  toast.textContent = String(message || '');
  toast.classList.add('is-show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('is-show'), 1800);
}

function speedValue(el) {
  const match = String(el?.textContent || '0').match(/-?\d+(?:\.\d+)?/);
  return Math.max(0, Number(match?.[0]) || 0);
}

function speedAngle(kmh) {
  const value = Math.max(0, Math.min(160, Number(kmh) || 0));
  return -130 + (value / 160) * 260;
}

function buildSharedFrame() {
  const frame = document.createElement('div');
  frame.className = 'nx-approved-final-frame';
  frame.setAttribute('data-approved-final-frame', '');
  frame.innerHTML = `
    <button class="nx-approved-shared-mode-tab drive is-active" type="button" data-final-drive aria-label="Drive">
      <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#75edff" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#eaffff"/><path d="M6 15h20M16 16l-7 7M16 16l7 7" stroke="#75edff" stroke-width="2" stroke-linecap="round"/></svg></span>
      <span class="nx-approved-tab-copy"><b>DRIVE</b><small>COCKPIT</small></span>
    </button>
    <button class="nx-approved-shared-mode-tab vehicle" type="button" data-final-vehicle aria-label="Vehicle Tracking">
      <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="13" r="9" stroke="#a378ff" stroke-width="2"/><circle cx="16" cy="13" r="4" stroke="#66ebff" stroke-width="2"/><circle cx="16" cy="13" r="1.7" fill="#efffff"/><path d="M16 22v7M11 28h10" stroke="#66ebff" stroke-width="2" stroke-linecap="round"/></svg></span>
      <span class="nx-approved-tab-copy"><b>VEHICLE TRACKING</b><small>LIVE TRACKER</small></span>
    </button>`;
  return frame;
}

function mount(ui) {
  if (!ui || mounted.has(ui)) return;
  const driveView = ui.querySelector('[data-approved-drive-view]');
  const trackerView = ui.querySelector('[data-approved-tracker-view]');
  if (!driveView || !trackerView) return;
  mounted.add(ui);
  ui.classList.add('nx-approved-final-v5');

  const originalDrive = driveView.querySelector('[data-approved-drive-hit]') || trackerView.querySelector('[data-approved-drive-hit]');
  const originalVehicle = driveView.querySelector('[data-approved-vehicle-hit]') || trackerView.querySelector('[data-approved-vehicle-hit]');

  const frame = buildSharedFrame();
  ui.appendChild(frame);
  const driveTab = frame.querySelector('[data-final-drive]');
  const vehicleTab = frame.querySelector('[data-final-vehicle]');

  const syncDock = () => {
    const trackerActive = trackerView.classList.contains('is-active');
    driveTab?.classList.toggle('is-active', !trackerActive);
    vehicleTab?.classList.toggle('is-active', trackerActive);
    ui.classList.toggle('is-tracker-mode', trackerActive);
  };
  syncDock();
  const modeObserver = new MutationObserver(syncDock);
  modeObserver.observe(driveView, { attributes:true, attributeFilter:['class'] });
  modeObserver.observe(trackerView, { attributes:true, attributeFilter:['class'] });

  driveTab?.addEventListener('click', () => originalDrive?.click());
  vehicleTab?.addEventListener('click', () => originalVehicle?.click());

  const speedEl = driveView.querySelector('[data-approved-speed]');
  if (speedEl) {
    const needle = document.createElement('i');
    needle.className = 'nx-approved-speed-needle';
    needle.setAttribute('data-approved-speed-needle', '');
    driveView.insertBefore(needle, speedEl);
    const syncNeedle = () => {
      needle.style.setProperty('--nx-speed-angle', `${speedAngle(speedValue(speedEl)).toFixed(2)}deg`);
    };
    syncNeedle();
    new MutationObserver(syncNeedle).observe(speedEl, { childList:true, subtree:true, characterData:true });
  }

  const recover = driveView.querySelector('[data-approved-recover]');
  let recovering = false;
  recover?.addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (recovering) return;
    recovering = true;
    recover.setAttribute('aria-busy', 'true');
    notify(ui, 'Recovering Drive data…');
    try {
      const result = await hydrateDriveTrackState();
      window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
      const count = Number(result?.store?.trips?.length) || 0;
      notify(ui, result?.cloud
        ? `${count} trip record${count === 1 ? '' : 's'} restored from account backup.`
        : 'Recovery checked. Local Drive data is safe.');
    } catch (error) {
      notify(ui, error?.message || 'Drive recovery could not complete.');
    } finally {
      recovering = false;
      recover.removeAttribute('aria-busy');
    }
  }, true);
}

function scan() {
  document.querySelectorAll('[data-nx-approved]').forEach(mount);
}

scan();
const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList:true, subtree:true });
