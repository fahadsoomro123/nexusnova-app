import { hubApps } from './app-registry.js';

const hubState = { scrollY: 0, lastAppId: '', query: '' };
let restoreOnNextRender = false;
const HIDDEN_HUB_APP_IDS = new Set(['nova-track']);

export function requestHubReturnRestore() {
  restoreOnNextRender = true;
}

function currentScrollY() {
  return Math.max(0, Number(document.scrollingElement?.scrollTop ?? window.scrollY) || 0);
}

export function hubScreen({ openApp } = {}) {
  const restoreScroll = restoreOnNextRender;
  restoreOnNextRender = false;
  if (!restoreScroll) hubState.query = '';

  const root = document.createElement('section');
  root.className = 'nx-screen nx-hub-screen';
  root.innerHTML = `
    <div class="nx-hub-toolbar">
      <input class="nx-search" type="search" inputmode="search" autocomplete="off" placeholder="Search Nova Hub" aria-label="Search Nova Hub" data-hub-search>
    </div>
    <div class="nx-hub-content" data-hub-content></div>
  `;

  const input = root.querySelector('[data-hub-search]');
  const content = root.querySelector('[data-hub-content]');

  const draw = () => {
    const needle = String(input.value || '').trim().toLowerCase();
    hubState.query = String(input.value || '');
    const filtered = hubApps.filter(app => {
      if (HIDDEN_HUB_APP_IDS.has(app.id)) return false;
      return !needle || `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(needle);
    });

    if (!filtered.length) {
      content.innerHTML = '<div class="nx-empty">No Nova Hub app matches that search.</div>';
      return;
    }

    content.innerHTML = `
      <div class="nx-app-grid" aria-label="Nova Hub apps">
        ${filtered.map(app => {
          const isLastOpened = app.id === hubState.lastAppId;
          return `
            <button class="nx-app-card${isLastOpened ? ' is-last-opened' : ''}" type="button" data-app-id="${app.id}"${isLastOpened ? ' data-last-opened="true"' : ''} aria-label="Open ${app.name}">
              <span class="nx-app-card__icon" aria-hidden="true">
                <img src="./assets/icons/nova-hub/${app.id}.webp" alt="" width="192" height="192" loading="lazy" decoding="async" draggable="false">
              </span>
              <strong>${app.name}</strong>
            </button>
          `;
        }).join('')}
      </div>
    `;

    content.querySelectorAll('[data-app-id]').forEach(button => {
      button.addEventListener('click', () => {
        hubState.scrollY = currentScrollY();
        hubState.lastAppId = button.dataset.appId;
        content.querySelectorAll('.is-last-opened').forEach(card => {
          card.classList.remove('is-last-opened');
          card.removeAttribute('data-last-opened');
        });
        button.classList.add('is-last-opened');
        button.setAttribute('data-last-opened', 'true');
        openApp?.(button.dataset.appId);
      });
    });
  };

  input.addEventListener('input', draw);
  input.value = hubState.query;
  draw();

  if (restoreScroll) {
    const savedScrollY = Math.max(0, Number(hubState.scrollY) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!root.isConnected) return;
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }));
  }

  return root;
}
