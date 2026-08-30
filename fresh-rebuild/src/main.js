import './core/browser-compat.js';
import { icon } from './components/icons.js';
import { createRouter } from './core/router.js';
import { backend } from './core/backend-adapter.js';
import { firebaseBackend } from './core/firebase-backend.js';
import { authService } from './core/auth-service.js';
import { adPolicy } from './core/ad-policy.js';
import { authScreen } from './features/auth/auth-screen.js';
import { mineScreen, cleanupMineScreen } from './features/mine/mine-screen.js';
import { hubScreen, requestHubReturnRestore } from './features/hub/hub-screen.js';
import { mineApps } from './features/hub/app-registry.js';

const stage = document.getElementById('nx-stage');
const dock = document.querySelector('.nx-dock');
const dockItems = [...document.querySelectorAll('.nx-dock__item')];
const mineBrandPortal = document.getElementById('nx-mine-brand-portal');
const mineAppIds = new Set(mineApps.map(app => app.id));
const BOOT_SPLASH_MIN_MS = 1_350;
const POST_LOGIN_SPLASH_MS = 900;
const bootSplashStartedAt = performance.now();

backend.attach(firebaseBackend);

let appScreenModulePromise = null;
let appScreenModule = null;
function loadAppScreenModule() {
  if (!appScreenModulePromise) {
    appScreenModulePromise = import('./features/apps/app-screen.js').then(module => {
      appScreenModule = module;
      return module;
    }).catch(error => {
      appScreenModulePromise = null;
      appScreenModule = null;
      throw error;
    });
  }
  return appScreenModulePromise;
}

function cleanupActiveAppScreen() {
  try { appScreenModule?.cleanupAppScreen?.(); }
  catch (error) { console.warn('[NexusNova Fresh] app cleanup:', error); }
}

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

function openMineBrandPortal() {
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage !== 'function') {
      console.warn('[NexusNova Fresh] Nova Browser bridge unavailable');
      return false;
    }
    window.NexusBrowserAndroid.postMessage(JSON.stringify({
      action: 'open',
      url: 'https://nexusnovatools.com/'
    }));
    return true;
  } catch (error) {
    console.warn('[NexusNova Fresh] Mine brand portal:', error);
    return false;
  }
}

mineBrandPortal?.addEventListener('click', openMineBrandPortal);

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

function setSplashMode(enabled) {
  document.body.classList.toggle('nx-splash-mode', Boolean(enabled));
}

function splashMarkup(phase = 'boot') {
  const entering = phase === 'entry';
  const kicker = entering
    ? 'IDENTITY VERIFIED / SECURE ACCESS'
    : 'NEXUSNOVA / PRIVATE DIGITAL INFRASTRUCTURE';
  const title = entering
    ? 'Secure workspace <span>online.</span>'
    : 'Infrastructure for your <span>digital world.</span>';
  const status = entering
    ? 'Synchronizing protected services'
    : 'Establishing secure session';

  return `
    <section class="nx-cinematic-splash" data-splash-phase="${entering ? 'entry' : 'boot'}" aria-label="NexusNova secure startup">
      <div class="nx-cinematic-splash__noise" aria-hidden="true"></div>
      <div class="nx-cinematic-splash__beam" aria-hidden="true"></div>
      <div class="nx-cinematic-splash__grid" aria-hidden="true"></div>
      <div class="nx-cinematic-splash__orbital" aria-hidden="true"></div>
      <div class="nx-cinematic-splash__shell">
        <div class="nx-cinematic-splash__telemetry" aria-hidden="true">
          <span>NX-01</span>
          <span>ENCRYPTED LINK</span>
        </div>
        <div class="nx-cinematic-splash__core">
          <div class="nx-cinematic-splash__mark" aria-hidden="true"><span>N</span></div>
          <p class="nx-cinematic-splash__kicker">${kicker}</p>
          <h1>${title}</h1>
          <div class="nx-cinematic-splash__rule" aria-hidden="true"><i></i></div>
          <p class="nx-cinematic-splash__status"><span aria-hidden="true"></span>${status}</p>
        </div>
        <div class="nx-cinematic-splash__footer" aria-hidden="true">
          <span>SECURE CORE</span>
          <span>NEXUSNOVA NETWORK</span>
        </div>
      </div>
    </section>
  `;
}

function renderCinematicSplash(phase = 'boot') {
  showDock(false);
  setSplashMode(true);
  stage.dataset.route = 'splash';
  stage.innerHTML = splashMarkup(phase);
  stage.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
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

function appModuleFailureScreen(id, error) {
  console.error('[NexusNova Fresh] app module load:', error);
  const parent = parentRouteForApp(id);
  const root = document.createElement('section');
  root.className = 'nx-screen';
  root.innerHTML = `<article class="nx-tool-card"><h2>App tools could not load</h2><p>The app module hit a temporary load error. You can retry the module or return to ${parent === 'mine' ? 'Mine' : 'Nova Hub'}.</p><div class="nx-action-row"><button class="nx-primary" type="button" data-app-module-retry>RETRY</button><button type="button" data-app-module-back>BACK</button></div></article>`;
  root.querySelector('[data-app-module-retry]').addEventListener('click', () => router.render('app', { id }));
  root.querySelector('[data-app-module-back]').addEventListener('click', () => {
    if (parent === 'mine') router.render('mine');
    else backToHub();
  });
  return root;
}

async function handleSignedIn() {
  renderCinematicSplash('entry');
  await wait(POST_LOGIN_SPLASH_MS);
  await router.render('mine');
}

router = createRouter({
  stage,
  routes: {
    auth: () => authScreen({ onSignedIn: handleSignedIn }),
    // Every eligible app-open transition uses the same ad policy regardless of
    // whether the entry came from Nova Hub, Mine quick access, or another app.
    mine: () => mineScreen({
      openHubApp: openAppWithAd,
      beforeMiningRenewal: continueMining => adPolicy.gateMiningRenewal(continueMining)
    }),
    hub: () => hubScreen({ openApp: openAppWithAd }),
    app: async payload => {
      try {
        const { appScreen } = await loadAppScreenModule();
        return appScreen({ id: payload.id, backToHub, backToMine });
      } catch (error) {
        return appModuleFailureScreen(payload.id, error);
      }
    }
  },
  beforeRoute(next, payload = {}, previous) {
    if (next !== 'app') adPolicy.cancelPendingHubNavigation();
    if (previous === 'app') cleanupActiveAppScreen();
    if (previous === 'mine' && next !== 'mine') cleanupMineScreen();
  },
  onRoute(route, payload = {}) {
    setSplashMode(false);
    if (route === 'app') currentAppParent = parentRouteForApp(payload.id);
    syncDock(route, payload);
    showDock(route !== 'auth');
    if (route !== 'app' && appScreenModulePromise) appScreenModulePromise.then(module => module.cleanupAppScreen()).catch(() => {});
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
  return remaining > 0 ? wait(remaining) : Promise.resolve();
}

async function boot() {
  renderCinematicSplash('boot');
  const user = await authService.waitForUser();
  await waitForBootSplashMinimum();
  if (!user) {
    await router.render('auth');
    return;
  }
  const initial = router.initial();
  await router.render(initial === 'auth' || initial === 'app' ? 'mine' : initial);
}

authService.onChange(user => {
  if (!user && router.current && router.current !== 'auth') router.render('auth');
});

boot().catch(error => {
  console.error('[NexusNova Fresh] boot:', error);
  setSplashMode(false);
  stage.innerHTML = `<div class="nx-empty">NexusNova could not initialize.<br><small>${String(error?.message || error)}</small></div>`;
  showDock(false);
});
