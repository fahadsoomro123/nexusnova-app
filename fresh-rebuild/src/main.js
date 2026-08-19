import './core/browser-compat.js';
import { icon } from './components/icons.js';
import { createRouter } from './core/router.js';
import { backend } from './core/backend-adapter.js';
import { firebaseBackend } from './core/firebase-backend.js';
import { authService } from './core/auth-service.js';
import { authScreen } from './features/auth/auth-screen.js';
import { mineScreen } from './features/mine/mine-screen.js';
import { hubScreen } from './features/hub/hub-screen.js';
import { appScreen, cleanupAppScreen } from './features/apps/app-screen.js';

const stage = document.getElementById('nx-stage');
const dock = document.querySelector('.nx-dock');
const dockItems = [...document.querySelectorAll('.nx-dock__item')];

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

function syncDock(route) {
  dockItems.forEach(button => {
    const active = button.dataset.route === route || (route === 'app' && button.dataset.route === 'hub');
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

let router;
const openApp = id => router.render('app', { id });
const backToHub = () => router.render('hub');

router = createRouter({
  stage,
  routes: {
    auth: () => authScreen({ onSignedIn: () => router.render('mine') }),
    mine: () => mineScreen({ openHubApp: openApp }),
    hub: () => hubScreen({ openApp }),
    app: payload => appScreen({ id: payload.id, backToHub })
  },
  onRoute(route) {
    syncDock(route);
    showDock(route !== 'auth');
    if (route !== 'app') cleanupAppScreen();
  }
});

window.NexusNovaFresh = Object.freeze({
  openApp(id) {
    const safeId = String(id || '').trim();
    if (!safeId) return false;
    router.render('app', { id: safeId });
    return true;
  },
  openHub() {
    router.render('hub');
    return true;
  },
  openMine() {
    router.render('mine');
    return true;
  }
});

/* Android MainActivity already asks NexusNovaUxSimplify.systemBack().
   Keep that native contract, but give it a fresh implementation instead of
   loading any legacy UX script. */
window.NexusNovaUxSimplify = Object.freeze({
  systemBack() {
    if (!router?.current || router.current === 'auth' || router.current === 'mine') return false;
    if (router.current === 'app') {
      router.render('hub');
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

dockItems.forEach(button => button.addEventListener('click', () => router.render(button.dataset.route)));

async function boot() {
  stage.innerHTML = '<div class="nx-boot"><div class="nx-auth__logo">N</div><p>Initializing secure workspace…</p></div>';
  const user = await authService.waitForUser();
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
  stage.innerHTML = `<div class="nx-empty">NexusNova could not initialize.<br><small>${String(error?.message || error)}</small></div>`;
  showDock(false);
});
