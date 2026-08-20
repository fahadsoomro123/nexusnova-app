import './core/browser-compat.js';
import { icon } from './components/icons.js';
import { createRouter } from './core/router.js';
import { backend } from './core/backend-adapter.js';
import { firebaseBackend } from './core/firebase-backend.js';
import { authService } from './core/auth-service.js';
import { adPolicy } from './core/ad-policy.js';
import { authScreen } from './features/auth/auth-screen.js';
import { mineScreen } from './features/mine/mine-screen.js';
import { hubScreen, requestHubReturnRestore } from './features/hub/hub-screen.js';
import { mineApps } from './features/hub/app-registry.js';
import { appScreen, cleanupAppScreen } from './features/apps/app-screen.js';

const stage = document.getElementById('nx-stage');
const dock = document.querySelector('.nx-dock');
const dockItems = [...document.querySelectorAll('.nx-dock__item')];
const mineAppIds = new Set(mineApps.map(app => app.id));
const BOOT_SPLASH_MIN_MS = 2_200;
const bootSplashStartedAt = performance.now();

backend.attach(firebaseBackend);

window.nexusPostNativeAction = window.nexusPostNativeAction || function(action, payload = {}) {
  try {
    if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
    window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
    return true;
  } catch (error) {
    console.warn('[NexusNova Fresh] native bridge:', error);
    return false;
  }
};

let nativeAccountId = '';
function syncNativeAccount(user) {
  const uid = String(user?.uid || '').trim().slice(0, 128);
  if (uid) {
    nativeAccountId = uid;
    window.nexusPostNativeAction('setActiveAccount', { accountId: uid });
    return;
  }
  // Never erase a previous same-device marker merely because Firebase is still
  // restoring at initial boot. Clear only after this runtime actually knew a UID.
  if (nativeAccountId) {
    window.nexusPostNativeAction('clearActiveAccount', { accountId: nativeAccountId });
    nativeAccountId = '';
  }
}

const labels = {
  mine: ['MINE', 'mine'],
  hub: ['NOVA HUB', 'hub']
};

function dockLabel(route) {
  const urdu = localStorage.getItem('nexus_ui_lang_v1') === 'ur';
  if (!urdu) return labels[route]?.[0] || labels.mine[0];
  return route === 'hub' ? 'نووا ہب' : 'مائن';
}

function paintDockLabels() {
  dockItems.forEach(button => {
    const route = button.dataset.route || 'mine';
    const [, iconName] = labels[route] || labels.mine;
    button.innerHTML = `${icon(iconName)}<span>${dockLabel(route)}</span>`;
  });
}

paintDockLabels();
window.addEventListener('nexusnova:language-changed', paintDockLabels);

function showDock(show) {
  dock.hidden = !show;
  document.body.classList.toggle('nx-auth-mode', !show);
}

function parentRouteForApp(id) {
  return mineAppIds.has(String(id || '')) ? 'mine' : 'hub';
}

function syncDock(route, payload = {}) {
  const visibleRoute = route === 'app' ? parentRouteForApp(payload.id) : route;
  dockItems.forEach(button => {
    const active = button.dataset.route === visibleRoute;
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

let router;
let currentAppParent = 'hub';
const openAppDirect = id => router.render('app', { id });
const openAppWithAd = id => adPolicy.gateHubApp(id, () => openAppDirect(id));
const backToHub = () => {
  requestHubReturnRestore();
  return router.render('hub');
};
const backToMine = () => router.render('mine');

router = createRouter({
  stage,
  routes: {
    auth: () => authScreen({ onSignedIn: () => router.render('mine') }),
    // Every eligible app-open transition uses the same ad policy regardless of
    // whether the entry came from Nova Hub, Mine quick access, or another app.
    mine: () => mineScreen({
      openHubApp: openAppWithAd,
      beforeMiningRenewal: continueMining => adPolicy.gateMiningRenewal(continueMining)
    }),
    hub: () => hubScreen({ openApp: openAppWithAd }),
    app: payload => appScreen({ id: payload.id, backToHub, backToMine })
  },
  onRoute(route, payload = {}) {
    if (route === 'app') currentAppParent = parentRouteForApp(payload.id);
    syncDock(route, payload);
    showDock(route !== 'auth');
    if (route !== 'app') cleanupAppScreen();
  }
});

window.NexusNovaFresh = Object.freeze({
  openApp(id) {
    const safeId = String(id || '').trim();
    if (!safeId) return false;
    openAppWithAd(safeId);
    return true;
  },
  openHub() {
    if (router.current === 'app' && currentAppParent === 'hub') requestHubReturnRestore();
    router.render('hub');
    return true;
  },
  openMine() {
    router.render('mine');
    return true;
  },
  adStatus() {
    return adPolicy.status();
  }
});

/* Android MainActivity already asks NexusNovaUxSimplify.systemBack().
   Keep that native contract, but give it a fresh implementation instead of
   loading any legacy UX script. */
window.NexusNovaUxSimplify = Object.freeze({
  systemBack() {
    if (!router?.current || router.current === 'auth' || router.current === 'mine') return false;
    if (router.current === 'app') {
      if (currentAppParent === 'hub') {
        requestHubReturnRestore();
        router.render('hub');
      } else {
        router.render('mine');
      }
      return true;
    }
    if (router.current === 'hub') {
      router.render('mine');
      return true;
    }
    router.render('mine');
    return true;
  }
});

dockItems.forEach(button => button.addEventListener('click', () => {
  const route = button.dataset.route;
  if (!route || router.current === route) return;
  if (route === 'hub' && router.current === 'app' && currentAppParent === 'hub') requestHubReturnRestore();
  router.render(route);
}));

function waitForBootSplashMinimum() {
  const remaining = BOOT_SPLASH_MIN_MS - (performance.now() - bootSplashStartedAt);
  return remaining > 0 ? new Promise(resolve => setTimeout(resolve, remaining)) : Promise.resolve();
}

async function boot() {
  stage.innerHTML = '<div class="nx-boot"><div class="nx-auth__logo">N</div><p>Initializing secure workspace…</p></div>';
  const user = await authService.waitForUser();
  await waitForBootSplashMinimum();
  if (!user) {
    await router.render('auth');
    return;
  }
  syncNativeAccount(user);
  const initial = router.initial();
  await router.render(initial === 'auth' || initial === 'app' ? 'mine' : initial);
}

authService.onChange(user => {
  syncNativeAccount(user);
  if (!user && router.current && router.current !== 'auth') router.render('auth');
});

boot().catch(error => {
  console.error('[NexusNova Fresh] boot:', error);
  stage.innerHTML = `<div class="nx-empty">NexusNova could not initialize.<br><small>${String(error?.message || error)}</small></div>`;
  showDock(false);
});
