/* NexusNova OTA bugfix runtime v1
   Shell-only behavior: dock motion, low-memory speed-test guard, Qibla render stability.
   No mining, auth, wallet or calculation logic is changed here. */

const SPEED_HOST = 'speed.cloudflare.com';
const MAX_SPEED_CHUNK_BYTES = 1_000_000;

function installSpeedTestGuard() {
  if (window.__nexusNovaSpeedGuardV1 || typeof window.fetch !== 'function') return;
  window.__nexusNovaSpeedGuardV1 = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = function nexusNovaSafeFetch(input, init) {
    try {
      const isRequest = typeof Request === 'function' && input instanceof Request;
      const raw = isRequest ? input.url : String(input || '');
      const url = new URL(raw, location.href);
      if (url.hostname === SPEED_HOST && url.pathname === '/__down') {
        const requested = Number(url.searchParams.get('bytes'));
        if (Number.isFinite(requested) && requested > MAX_SPEED_CHUNK_BYTES) {
          url.searchParams.set('bytes', String(MAX_SPEED_CHUNK_BYTES));
          if (isRequest) {
            const safeRequest = new Request(url.href, input);
            return nativeFetch(safeRequest, init);
          }
          return nativeFetch(url.href, init);
        }
      }
    } catch (error) {
      console.warn('[NexusNova OTA] speed guard:', error);
    }
    return nativeFetch(input, init);
  };
}

function patchQiblaRoot(scope = document) {
  const rotors = [];
  if (scope instanceof Element && scope.matches('[data-qb-rotor]')) rotors.push(scope);
  scope.querySelectorAll?.('[data-qb-rotor]').forEach(node => rotors.push(node));

  rotors.forEach(rotor => {
    if (rotor.dataset.nxStableRotor === '1') return;
    rotor.dataset.nxStableRotor = '1';
    const nativeSetAttribute = rotor.setAttribute.bind(rotor);
    try {
      rotor.removeAttribute('transform');
      rotor.setAttribute = function stableRotorSetAttribute(name, value) {
        if (String(name).toLowerCase() === 'transform') return;
        return nativeSetAttribute(name, value);
      };
    } catch (error) {
      console.warn('[NexusNova OTA] Qibla rotor patch:', error);
    }
  });

  const pointers = [];
  if (scope instanceof Element && scope.matches('[data-qb-pointer]')) pointers.push(scope);
  scope.querySelectorAll?.('[data-qb-pointer]').forEach(node => pointers.push(node));
  pointers.forEach(pointer => {
    if (pointer.dataset.nxStablePointer === '1') return;
    pointer.dataset.nxStablePointer = '1';
    pointer.removeAttribute('filter');
    pointer.style.filter = 'none';
    pointer.style.transformOrigin = 'center';
  });
}

function installQiblaStabilityPatch() {
  patchQiblaRoot(document);
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) patchQiblaRoot(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function installDockMotion() {
  const dock = document.querySelector('.nx-dock');
  if (!dock || dock.dataset.nxMotionV1 === '1') return;
  dock.dataset.nxMotionV1 = '1';

  let lastY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  let frame = 0;

  const showDock = () => dock.classList.remove('nx-dock--scroll-away');
  const sync = () => {
    frame = 0;
    const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const delta = y - lastY;
    if (y <= 8) showDock();
    else if (delta > 7) dock.classList.add('nx-dock--scroll-away');
    else if (delta < -7) showDock();
    lastY = y;
  };

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
  }, { passive: true });

  const routeObserver = new MutationObserver(() => showDock());
  routeObserver.observe(dock, { attributes: true, subtree: true, attributeFilter: ['hidden', 'aria-current'] });
}

function bootRuntimeFixes() {
  installSpeedTestGuard();
  installQiblaStabilityPatch();
  installDockMotion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootRuntimeFixes, { once: true });
} else {
  bootRuntimeFixes();
}
