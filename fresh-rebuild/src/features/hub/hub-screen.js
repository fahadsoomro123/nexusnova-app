import { icon } from '../../components/icons.js';
import { categories, hubApps } from './app-registry.js';

const hubState = { scrollY: 0, lastAppId: '', query: '' };
let restoreOnNextRender = false;

export function requestHubReturnRestore() {
  restoreOnNextRender = true;
}

function currentScrollY() {
  return Math.max(0, Number(document.scrollingElement?.scrollTop ?? window.scrollY) || 0);
}

export function hubScreen({ openApp } = {}) {
  const restoreScroll = restoreOnNextRender;
  restoreOnNextRender = false;

  const root = document.createElement('section');
  root.className = 'nx-screen nx-hub-screen';
  root.innerHTML = `
    <header class="nx-screen-head nx-hub-head">
      <div>
        <p class="nx-eyebrow">ALL APPS • DIRECT ACCESS</p>
        <h1 class="nx-title">Nova Hub</h1>
        <p class="nx-subtitle">Everyday apps and utilities. Mining tools now live under Mine.</p>
      </div>
    </header>
    <div class="nx-hub-toolbar">
      <input class="nx-search" type="search" inputmode="search" autocomplete="off" placeholder="Search Nova Hub" aria-label="Search Nova Hub" data-hub-search>
    </div>
    <div class="nx-hub-content" data-hub-content></div>
  `;

  const input = root.querySelector('[data-hub-search]');
  const content = root.querySelector('[data-hub-content]');

  const draw = query => {
    const needle = String(query || '').trim().toLowerCase();
    hubState.query = String(query || '');
    const filtered = needle
      ? hubApps.filter(app => `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(needle))
      : hubApps;

    if (!filtered.length) {
      content.innerHTML = '<div class="nx-empty">No Nova Hub app matches that search.</div>';
      return;
    }

    content.innerHTML = categories.map(category => {
      const apps = filtered.filter(app => app.category === category);
      if (!apps.length) return '';
      return `
        <section class="nx-hub-section" aria-label="${category}">
          <div class="nx-category">${category}</div>
          <div class="nx-app-grid">
            ${apps.map(app => {
              const isLastOpened = app.id === hubState.lastAppId;
              return `
                <button class="nx-app-card${isLastOpened ? ' is-last-opened' : ''}" type="button" data-app-id="${app.id}"${isLastOpened ? ' data-last-opened="true"' : ''} aria-label="Open ${app.name}">
                  <span class="nx-app-card__icon">${icon(app.icon)}</span>
                  <strong>${app.name}</strong>
                  <span>${app.description}</span>
                </button>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');

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

  input.addEventListener('input', () => draw(input.value));
  input.value = restoreScroll ? hubState.query : '';
  draw(input.value);

  if (restoreScroll) {
    const savedScrollY = Math.max(0, Number(hubState.scrollY) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }));
  }

  return root;
}
