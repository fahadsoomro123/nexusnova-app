import { icon } from '../../components/icons.js';
import { categories, hubApps } from './app-registry.js';

export function hubScreen({ openApp } = {}) {
  const root = document.createElement('section');
  root.className = 'nx-screen';
  root.innerHTML = `
    <header class="nx-screen-head">
      <div>
        <p class="nx-eyebrow">ALL APPS • DIRECT ACCESS</p>
        <h1 class="nx-title">Nova Hub</h1>
        <p class="nx-subtitle">Everyday apps and utilities. Mining tools now live under Mine.</p>
      </div>
    </header>
    <div class="nx-hub-toolbar">
      <input class="nx-search" type="search" inputmode="search" autocomplete="off" placeholder="Search Nova Hub" aria-label="Search Nova Hub" data-hub-search>
    </div>
    <div data-hub-content></div>
  `;

  const input = root.querySelector('[data-hub-search]');
  const content = root.querySelector('[data-hub-content]');

  const draw = query => {
    const needle = String(query || '').trim().toLowerCase();
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
        <section aria-label="${category}">
          <div class="nx-category">${category}</div>
          <div class="nx-app-grid">
            ${apps.map(app => `
              <button class="nx-app-card" type="button" data-app-id="${app.id}" aria-label="Open ${app.name}">
                <span class="nx-app-card__icon">${icon(app.icon)}</span>
                <strong>${app.name}</strong>
                <span>${app.description}</span>
              </button>
            `).join('')}
          </div>
        </section>
      `;
    }).join('');

    content.querySelectorAll('[data-app-id]').forEach(button => {
      button.addEventListener('click', () => openApp?.(button.dataset.appId));
    });
  };

  input.addEventListener('input', () => draw(input.value));
  draw('');
  return root;
}
