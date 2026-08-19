import { icon } from '../../components/icons.js';
import { novaApps } from '../hub/app-registry.js';
import { everydayRenderers } from './everyday-tools.js';
import { liveRenderers } from './live-tools.js';
import { coreRenderers } from './core-apps.js';
import { personalRenderers } from './personal-apps.js';
import { discoverRenderers } from './discover-apps.js';
import { faithSecurityRenderers } from './faith-security-apps.js';
import { deviceRenderers } from './device-apps.js';
import { smartRenderers } from './smart-apps.js';
import { teacherSuiteRenderers } from './teacher-suite.js';
import { islamicSuiteRenderers } from './islamic-suite.js';

let cleanup = null;

export function appScreen({ id, backToHub } = {}) {
  cleanup?.();
  cleanup = null;

  const app = novaApps.find(item => item.id === id);
  const root = document.createElement('section');
  root.className = 'nx-screen';

  if (!app) {
    root.innerHTML = '<div class="nx-empty">This Nova Hub app could not be found.</div>';
    return root;
  }

  root.innerHTML = `
    <header class="nx-app-head">
      <button class="nx-back" type="button" data-app-back aria-label="Back to Nova Hub">‹</button>
      <span class="nx-app-head__icon">${icon(app.icon)}</span>
      <div><p class="nx-eyebrow">${app.category}</p><h1>${app.name}</h1><p>${app.description}</p></div>
    </header>
    <div data-app-mount></div>
  `;

  root.querySelector('[data-app-back]').addEventListener('click', () => backToHub?.());
  const mount = root.querySelector('[data-app-mount]');
  const renderer = coreRenderers[id] || personalRenderers[id] || teacherSuiteRenderers[id] || islamicSuiteRenderers[id] || discoverRenderers[id] || faithSecurityRenderers[id] || deviceRenderers[id] || smartRenderers[id] || everydayRenderers[id] || liveRenderers[id];

  if (renderer) {
    const body = renderer();
    mount.appendChild(body);
    cleanup = () => body.__cleanup?.();
  } else {
    mount.innerHTML = `
      <article class="nx-tool-card nx-migration-card">
        <span class="nx-app-head__icon">${icon(app.icon)}</span>
        <h2>${app.name} fresh migration</h2>
        <p>This module exists in the current NexusNova codebase, but its old presentation layer is intentionally not being loaded here. Its verified logic/native/provider contracts will be connected to this fresh screen without carrying the legacy UI.</p>
        <div class="nx-migration-status"><i></i><span>Fresh architecture migration queued</span></div>
      </article>
    `;
  }

  return root;
}

export function cleanupAppScreen() {
  cleanup?.();
  cleanup = null;
}
