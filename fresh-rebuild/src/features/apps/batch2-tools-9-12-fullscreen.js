const ACTIVE_CLASS = 'nx-batch2-tools-active';
const SCREEN_CLASS = 'nx-batch2-tools-screen';
const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalTheme = themeMeta?.content || '#07111f';
const originalScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

const APP_DETECTORS = [
  { id:'tip', className:'nx-b2-tip', selectors:['[data-tip-chip]','[data-tip-result]'], theme:'system' },
  { id:'world-clock', className:'nx-b2-clock', selectors:['[data-clock-list]','[data-world-list]'], theme:'system' },
  { id:'qr', className:'nx-b2-qr', selectors:['[data-qr-chip]','[data-qr-output]'], theme:'system' },
  { id:'weather', className:'nx-b2-weather', selectors:['[data-wx-shell]','[data-weather-temp]'], theme:'native' }
];

function detectApp() {
  if (!stage) return null;
  for (const config of APP_DETECTORS) {
    for (const selector of config.selectors) {
      const marker = stage.querySelector(selector);
      if (!marker) continue;
      const screen = marker.closest('.nx-screen');
      const root = marker.closest('.nx-app-body') || screen?.querySelector('[data-app-mount] > *');
      if (screen && root) return { ...config, screen, root, marker };
    }
  }
  return null;
}

function applyTheme(themeMode) {
  if (!activeScreen || themeMode !== 'system') return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxBatch2Theme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f4f6f8' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreTheme() {
  delete document.documentElement.dataset.nxBatch2Theme;
  if (themeMeta) themeMeta.content = originalTheme;
  if (schemeMeta) schemeMeta.content = originalScheme;
}

const CLOCK_KEY = 'nexus_world_clocks_v3';
const DEFAULT_CLOCKS = [
  { code:'PK', zone:'Asia/Karachi' },
  { code:'AE', zone:'Asia/Dubai' },
  { code:'GB', zone:'Europe/London' },
  { code:'US', zone:'America/New_York' },
  { code:'JP', zone:'Asia/Tokyo' }
];

function readClockRows() {
  try {
    const value = JSON.parse(localStorage.getItem(CLOCK_KEY) || 'null');
    if (Array.isArray(value)) return value.filter(item => item?.zone).slice(0,24);
  } catch {}
  return DEFAULT_CLOCKS.map(item => ({ ...item }));
}

function writeClockRows(rows) {
  localStorage.setItem(CLOCK_KEY, JSON.stringify(Array.isArray(rows) ? rows.slice(0,24) : []));
}

function enhanceWorldClockEditing(root) {
  const list = root.querySelector('[data-clock-list]');
  const country = root.querySelector('[data-clock-country]');
  const zone = root.querySelector('[data-clock-zone]');
  const add = root.querySelector('[data-clock-add]');
  const status = root.querySelector('[data-clock-status]');
  if (!list || !country || !zone || !add) return () => {};

  let editingIndex = -1;
  const defaultAddText = add.textContent || 'ADD CLOCK';

  const resetEdit = () => {
    editingIndex = -1;
    add.textContent = defaultAddText;
    root.classList.remove('is-clock-editing');
  };

  const beginEdit = index => {
    const rows = readClockRows();
    const item = rows[index];
    if (!item) return;
    editingIndex = index;
    country.value = item.code || country.value;
    country.dispatchEvent(new Event('change', { bubbles:true }));
    queueMicrotask(() => {
      zone.value = item.zone || zone.value;
      if (zone.value !== item.zone) {
        requestAnimationFrame(() => { zone.value = item.zone || zone.value; });
      }
    });
    add.textContent = 'UPDATE CLOCK';
    root.classList.add('is-clock-editing');
    if (status) status.textContent = 'Editing saved clock. Choose country/time zone, then tap UPDATE CLOCK.';
    country.focus({ preventScroll:true });
  };

  const installPencils = () => {
    list.querySelectorAll('[data-clock-remove]').forEach(remove => {
      const card = remove.closest('.nxclock-card');
      if (!card || card.querySelector('[data-clock-edit]')) return;
      const index = Number(remove.dataset.clockRemove);
      if (!Number.isInteger(index) || index < 0) return;

      let actions = card.querySelector('.nx-b2-clock-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'nx-b2-clock-actions';
        card.appendChild(actions);
        actions.appendChild(remove);
      }

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'nx-b2-clock-edit';
      edit.dataset.clockEdit = String(index);
      edit.setAttribute('aria-label', 'Edit clock');
      edit.title = 'Edit clock';
      edit.textContent = '✎';
      actions.insertBefore(edit, remove);
      edit.addEventListener('click', () => beginEdit(index));
    });
  };

  const onUpdate = event => {
    if (editingIndex < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const code = country.value;
    const nextZone = zone.value;
    if (!code || !nextZone) return;
    const rows = readClockRows();
    if (!rows[editingIndex]) {
      resetEdit();
      return;
    }
    const duplicate = rows.some((item, index) => index !== editingIndex && item.code === code && item.zone === nextZone);
    if (duplicate) {
      if (status) status.textContent = 'That clock is already in your list.';
      return;
    }
    rows[editingIndex] = { code, zone:nextZone };
    writeClockRows(rows);
    resetEdit();
    if (status) status.textContent = 'Clock updated.';
  };

  add.addEventListener('click', onUpdate, true);
  const observer = new MutationObserver(installPencils);
  observer.observe(list, { childList:true, subtree:true });
  installPencils();

  return () => {
    observer.disconnect();
    add.removeEventListener('click', onUpdate, true);
    resetEdit();
  };
}

function removeWeatherPrayerTimes(root) {
  const prayers = root.querySelector('[data-wx-prayers]');
  const strip = root.querySelector('.nxwx-prayer-strip') || prayers?.closest('section');
  strip?.remove();
}

function enhance(found) {
  const { id, className, screen, root, theme } = found;
  if (screen.dataset.batch2Fullscreen === id) return () => {};

  screen.dataset.batch2Fullscreen = id;
  screen.classList.add(SCREEN_CLASS, className);
  root.classList.add(`${className}-root`);
  document.documentElement.classList.add(ACTIVE_CLASS);
  document.body.classList.add(ACTIVE_CLASS);
  document.documentElement.dataset.nxBatch2App = id;
  activeScreen = screen;
  applyTheme(theme);

  // Tip premium has seven direct rows. Keep the live receipt as the flexing row
  // so released app-shell height becomes useful result space, not a stretched input row.
  const tipCard = id === 'tip' && root.classList.contains('nx-tip-pro')
    ? root.querySelector(':scope > .nx-tool-card')
    : null;
  tipCard?.style.setProperty('grid-template-rows', 'auto auto auto auto auto minmax(132px,1fr) auto', 'important');

  if (id === 'weather') removeWeatherPrayerTimes(root);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-batch2-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);
  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const appCleanup = id === 'world-clock' ? enhanceWorldClockEditing(root) : () => {};
  const onTheme = () => applyTheme(theme);
  if (theme === 'system') lightQuery?.addEventListener?.('change', onTheme);

  return () => {
    appCleanup();
    if (theme === 'system') lightQuery?.removeEventListener?.('change', onTheme);
    tipCard?.style.removeProperty('grid-template-rows');
    back.remove();
    root.classList.remove(`${className}-root`);
    screen.classList.remove(SCREEN_CLASS, className);
    delete screen.dataset.batch2Fullscreen;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    delete document.documentElement.dataset.nxBatch2App;
    activeScreen = null;
    restoreTheme();
  };
}

function sync() {
  const found = detectApp();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }
  if (activeScreen === found.screen && activeCleanup) return;
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }
  try {
    activeCleanup = enhance(found);
  } catch (error) {
    console.error('[NexusNova Batch 2] fullscreen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    activeScreen = null;
    restoreTheme();
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(sync));
  observer.observe(stage, { childList:true, subtree:true });
  sync();
}