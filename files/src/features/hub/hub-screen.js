import { icon } from '../../components/icons.js';
import { categories, hubApps } from './app-registry.js';

const ALL_CATEGORY = 'All';
const hubState = { scrollY: 0, lastAppId: '', query: '', category: ALL_CATEGORY };
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
  if (!restoreScroll) {
    hubState.query = '';
    hubState.category = ALL_CATEGORY;
  }

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
      <div class="nx-hub-filters" role="group" aria-label="Nova Hub categories">
        ${[ALL_CATEGORY, ...categories].map(category => `
          <button type="button" data-hub-category="${category}" aria-pressed="false">${category}</button>
        `).join('')}
      </div>
    </div>
    <div class="nx-hub-content" data-hub-content></div>
  `;

  const input = root.querySelector('[data-hub-search]');
  const content = root.querySelector('[data-hub-content]');
  const categoryButtons = [...root.querySelectorAll('[data-hub-category]')];

  const syncCategoryButtons = () => {
    categoryButtons.forEach(button => {
      const active = button.dataset.hubCategory === hubState.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const draw = () => {
    const needle = String(input.value || '').trim().toLowerCase();
    hubState.query = String(input.value || '');
    const filtered = hubApps.filter(app => {
      const matchesCategory = hubState.category === ALL_CATEGORY || app.category === hubState.category;
      const matchesQuery = !needle || `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });

    syncCategoryButtons();

    if (!filtered.length) {
      content.innerHTML = '<div class="nx-empty">No Nova Hub app matches that search or category.</div>';
      return;
    }

    content.innerHTML = `
      <div class="nx-app-grid" aria-label="Nova Hub apps">
        ${filtered.map(app => {
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
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      hubState.category = button.dataset.hubCategory || ALL_CATEGORY;
      draw();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  input.value = hubState.query;
  draw();

  if (restoreScroll) {
    const savedScrollY = Math.max(0, Number(hubState.scrollY) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }));
  }

  return root;
}
