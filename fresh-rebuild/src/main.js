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

dockItems.forEach(button => {
  const [label, iconName] = labels[button.dataset.route] || labels.mine;
  button.innerHTML = `${icon(iconName)}<span>${label}</span>`;
});

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
