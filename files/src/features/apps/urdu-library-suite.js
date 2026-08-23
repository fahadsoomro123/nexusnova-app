import { escapeHtml } from '../../core/local-store.js';

const CATEGORIES = Object.freeze([
  ['Tafsir', 'قرآن تفاسیر اردو'],
  ['Seerah', 'سیرت النبی اردو'],
  ['Fiqh', 'فقہ اردو عربی'],
  ['Islamic History', 'اسلامی تاریخ اردو'],
  ['Nahj al-Balagha', 'نہج البلاغہ اردو']
]);

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-urdu-library';
  root.innerHTML = html;
  return root;
}

function cleanValue(value, max = 400) {
  if (Array.isArray(value)) return value.map(item => String(item || '')).filter(Boolean).join(', ').slice(0, max);
  if (value && typeof value === 'object') return '';
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeIdentifier(raw) {
  const value = String(raw || '').trim();
  return /^[A-Za-z0-9._-]{1,160}$/.test(value) ? value : '';
}

async function fetchJson(url, timeout = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { cache:'no-store', signal:controller.signal, headers:{Accept:'application/json'} });
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function archiveSearch(query) {
  const params = new URLSearchParams();
  params.set('q', `mediatype:texts AND (${query})`);
  ['identifier','title','creator','date','language','description','downloads'].forEach(field => params.append('fl[]', field));
  params.set('rows', '18');
  params.set('page', '1');
  params.set('output', 'json');
  params.append('sort[]', 'downloads desc');
  const json = await fetchJson(`https://archive.org/advancedsearch.php?${params.toString()}`);
  return Array.isArray(json?.response?.docs) ? json.response.docs : [];
}

export function renderUrduLibrarySuite() {
  const root = node(`
    <section class="nx-lib-hero">
      <div>
        <p class="nx-eyebrow">URDU LIBRARY • IN-APP</p>
        <h2>Read source collections without leaving NexusNova</h2>
        <p>Live Internet Archive catalog results. NexusNova does not copy books, bypass borrowing, or fabricate editions.</p>
      </div>
      <div class="nx-lib-search">
        <input maxlength="160" data-lib-query placeholder="کتاب، مصنف یا موضوع تلاش کریں">
        <button type="button" data-lib-search>SEARCH</button>
      </div>
      <div class="nx-lib-tabs">
        ${CATEGORIES.map(([label, query], index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-lib-category="${escapeHtml(query)}">${escapeHtml(label)}</button>`).join('')}
      </div>
      <p class="nx-tool-meta" data-lib-status>Ready to search the live archive catalog.</p>
    </section>
    <section class="nx-lib-reader" data-lib-reader hidden></section>
    <section class="nx-lib-grid" data-lib-results><div class="nx-empty">Choose a collection or search by title/topic.</div></section>
  `);

  const query = root.querySelector('[data-lib-query]');
  const search = root.querySelector('[data-lib-search]');
  const status = root.querySelector('[data-lib-status]');
  const resultsBox = root.querySelector('[data-lib-results]');
  const reader = root.querySelector('[data-lib-reader]');
  let rows = [];
  let busy = false;
  let cancelled = false;
  let loadToken = 0;

  const openReader = async index => {
    const item = rows[index];
    const identifier = safeIdentifier(item?.identifier);
    if (!identifier) return;
    const token = ++loadToken;
    reader.hidden = false;
    reader.innerHTML = '<div class="nx-empty">Loading archive item details…</div>';
    reader.scrollIntoView({ behavior:'smooth', block:'nearest' });
    try {
      const detail = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
      if (cancelled || token !== loadToken) return;
      const meta = detail?.metadata || {};
      const title = cleanValue(meta.title || item.title, 220) || 'Archive book';
      const creator = cleanValue(meta.creator || item.creator, 180);
      const date = cleanValue(meta.date || item.date, 40);
      const description = cleanValue(meta.description || item.description, 1400);
      const rights = cleanValue(meta.rights || meta.licenseurl, 260);
      const embed = `https://archive.org/embed/${encodeURIComponent(identifier)}`;
      reader.innerHTML = `
        <div class="nx-lib-reader__head">
          <div><span>INTERNET ARCHIVE</span><strong>${escapeHtml(title)}</strong></div>
          <button type="button" data-lib-close aria-label="Close reader">×</button>
        </div>
        <div class="nx-lib-reader__meta">${escapeHtml([creator, date].filter(Boolean).join(' • ') || 'Archive source item')}</div>
        ${description ? `<p class="nx-lib-reader__desc">${escapeHtml(description)}</p>` : ''}
        <div class="nx-lib-frame"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(title)}" loading="lazy" allow="fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="nx-lib-reader__note">${rights ? `Rights/access note: ${escapeHtml(rights)} • ` : ''}Reader and access controls are provided by Internet Archive. NexusNova does not bypass restricted borrowing or download controls.</p>
      `;
      reader.querySelector('[data-lib-close]')?.addEventListener('click', () => {
        reader.hidden = true;
        reader.replaceChildren();
      });
    } catch (error) {
      if (cancelled || token !== loadToken) return;
      reader.innerHTML = '<div class="nx-empty">This archive item could not be loaded in the in-app reader.</div>';
    }
  };

  const paint = () => {
    resultsBox.innerHTML = rows.length ? rows.map((item, index) => {
      const title = cleanValue(item.title, 220) || 'Untitled archive item';
      const creator = cleanValue(item.creator, 120);
      const year = cleanValue(item.date, 20).slice(0, 10);
      const language = cleanValue(item.language, 40);
      const description = cleanValue(item.description, 260);
      return `
        <button class="nx-lib-card" type="button" data-lib-open="${index}">
          <span class="nx-lib-card__mark">${String(index + 1).padStart(2, '0')}</span>
          <span class="nx-lib-card__body">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml([creator, year, language].filter(Boolean).join(' • ') || 'Internet Archive')}</span>
            ${description ? `<small>${escapeHtml(description)}</small>` : ''}
          </span>
          <span class="nx-lib-card__arrow">›</span>
        </button>`;
    }).join('') : '<div class="nx-empty">No matching archive books were returned.</div>';
    resultsBox.querySelectorAll('[data-lib-open]').forEach(button => button.addEventListener('click', () => openReader(Number(button.dataset.libOpen))));
  };

  const run = async value => {
    const text = String(value ?? query.value).trim();
    if (!text) {
      status.textContent = 'Enter a book, author or topic first.';
      query.focus();
      return;
    }
    if (busy) return;
    busy = true;
    const token = ++loadToken;
    search.disabled = true;
    search.textContent = 'SEARCHING…';
    reader.hidden = true;
    reader.replaceChildren();
    resultsBox.innerHTML = '<div class="nx-empty">Searching live Urdu reading sources…</div>';
    status.textContent = 'Searching Internet Archive catalog…';
    try {
      const nextRows = await archiveSearch(text);
      if (cancelled || token !== loadToken) return;
      rows = nextRows.filter(item => safeIdentifier(item.identifier));
      paint();
      status.textContent = `${rows.length} live archive result${rows.length === 1 ? '' : 's'} • tap a book for in-app source reader`;
    } catch (error) {
      if (cancelled || token !== loadToken) return;
      rows = [];
      resultsBox.innerHTML = '<div class="nx-empty">Urdu Library source is unavailable right now.</div>';
      status.textContent = 'Internet Archive search failed. No copied or fabricated book was substituted.';
    } finally {
      busy = false;
      search.disabled = false;
      search.textContent = 'SEARCH';
    }
  };

  root.querySelectorAll('[data-lib-category]').forEach(button => button.addEventListener('click', () => {
    root.querySelectorAll('[data-lib-category]').forEach(item => item.classList.toggle('active', item === button));
    query.value = button.dataset.libCategory || '';
    run(query.value);
  }));
  search.addEventListener('click', () => run());
  query.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });

  run(CATEGORIES[0][1]);
  root.__cleanup = () => {
    cancelled = true;
    rows = [];
    loadToken += 1;
    reader.replaceChildren();
  };
  return root;
}

export const urduLibraryRenderers = Object.freeze({ 'urdu-library':renderUrduLibrarySuite });
