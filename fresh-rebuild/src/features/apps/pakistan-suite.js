import { escapeHtml } from '../../core/local-store.js';

const QUERIES = Object.freeze({
  breaking:'Pakistan breaking latest news',
  urdu:'پاکستان اردو خبریں',
  sindhi:'سنڌ پاڪستان خبرون',
  pakistan:'Pakistan news politics economy',
  entertainment:'Pakistan entertainment film drama music'
});

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-pakistan-suite';
  root.innerHTML = html;
  return root;
}

function safeHttpUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function readableDate(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\d{8}T\d{6}Z?$/.test(text)) {
    const iso = `${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6,8)}T${text.slice(9,11)}:${text.slice(11,13)}:${text.slice(13,15)}Z`;
    const date = new Date(iso);
    if (Number.isFinite(date.getTime())) return date.toLocaleString();
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : text.slice(0, 40);
}

function relatedQuery(title) {
  return String(title || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 8)
    .join(' ');
}

async function gdelt(query, maxRecords = 20) {
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${Math.max(1, Math.min(30, maxRecords))}&format=json&sort=datedesc`, { cache:'no-store' });
  if (!response.ok) throw new Error(`News HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.articles) ? data.articles : [];
}

export function renderPakistanSuite() {
  const root = node(`
    <section class="nx-pk-hero">
      <div>
        <p class="nx-eyebrow">PAKISTAN • LIVE COVERAGE</p>
        <strong>Regional headlines in one premium feed</strong>
        <p class="nx-tool-meta" data-pk-status>Loading live regional coverage through GDELT…</p>
      </div>
      <span class="nx-news-live-dot"></span>
    </section>

    <section class="nx-pk-tabs" aria-label="Pakistan news categories">
      <button class="active" type="button" data-pk-cat="breaking">Breaking</button>
      <button type="button" data-pk-cat="urdu">Urdu</button>
      <button type="button" data-pk-cat="sindhi">Sindhi</button>
      <button type="button" data-pk-cat="pakistan">Pakistan</button>
      <button type="button" data-pk-cat="entertainment">Entertainment</button>
    </section>

    <section class="nx-news-reader" data-pk-reader hidden></section>
    <section class="nx-news-grid" data-pk-list><div class="nx-empty">Loading live headlines…</div></section>
  `);

  const status = root.querySelector('[data-pk-status]');
  const list = root.querySelector('[data-pk-list]');
  const reader = root.querySelector('[data-pk-reader]');
  let active = 'breaking';
  let rows = [];
  let cancelled = false;
  let loadToken = 0;

  const openReader = async index => {
    const row = rows[index];
    if (!row) return;
    const token = ++loadToken;
    const source = String(row.domain || row.sourcecountry || 'GDELT source').slice(0, 100);
    const date = readableDate(row.seendate);
    const image = safeHttpUrl(row.socialimage);
    reader.hidden = false;
    reader.innerHTML = `
      ${image ? `<img class="nx-news-reader__image" src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}
      <div class="nx-news-reader__top">
        <span class="nx-news-live-dot"></span>
        <span>${escapeHtml(source)}</span>
        <button type="button" data-pk-close aria-label="Close story">×</button>
      </div>
      <h2>${escapeHtml(row.title || 'News')}</h2>
      ${date ? `<p class="nx-news-reader__date">${escapeHtml(date)}</p>` : ''}
      <p class="nx-news-reader__empty">GDELT provides this headline and source metadata, not the publisher's full article body. NexusNova does not scrape or invent the missing article text.</p>
      <div class="nx-news-related" data-pk-related><div class="nx-empty">Loading related live coverage…</div></div>
    `;
    reader.querySelector('[data-pk-close]')?.addEventListener('click', () => { reader.hidden = true; });
    reader.scrollIntoView({ behavior:'smooth', block:'nearest' });

    const related = reader.querySelector('[data-pk-related]');
    try {
      const q = relatedQuery(row.title);
      if (!q) throw new Error('No related search terms');
      const matches = await gdelt(q, 10);
      if (cancelled || token !== loadToken) return;
      const currentUrl = safeHttpUrl(row.url);
      const unique = matches.filter(item => {
        const url = safeHttpUrl(item?.url);
        return url && url !== currentUrl && String(item?.title || '').trim();
      }).slice(0, 4);
      related.innerHTML = unique.length ? `
        <div class="nx-news-related__head"><strong>Related live coverage</strong><span>${unique.length} STORIES</span></div>
        ${unique.map(item => `<article><strong>${escapeHtml(item.title || 'Related story')}</strong><span>${escapeHtml([item.domain, readableDate(item.seendate)].filter(Boolean).join(' • '))}</span></article>`).join('')}
      ` : '<div class="nx-news-reader__note">No related live coverage returned for this headline.</div>';
    } catch {
      if (cancelled || token !== loadToken) return;
      related.innerHTML = '<div class="nx-news-reader__note">Related live coverage is unavailable right now.</div>';
    }
  };

  const paint = () => {
    list.innerHTML = rows.length ? rows.map((row, index) => {
      const source = String(row.domain || row.sourcecountry || 'GDELT').slice(0, 90);
      const date = readableDate(row.seendate);
      const image = safeHttpUrl(row.socialimage);
      return `
        <button class="nx-news-story nx-news-story--pk" type="button" data-pk-read="${index}">
          ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : `<span class="nx-news-story__number">${String(index + 1).padStart(2, '0')}</span>`}
          <span class="nx-news-story__body">
            <strong>${escapeHtml(row.title || 'News')}</strong>
            <span class="nx-news-story__meta">${escapeHtml(source)}${date ? ` • ${escapeHtml(date)}` : ''}</span>
          </span>
          <span class="nx-news-story__arrow">›</span>
        </button>`;
    }).join('') : '<div class="nx-empty">No live articles returned right now. Try another category.</div>';
    list.querySelectorAll('[data-pk-read]').forEach(button => button.addEventListener('click', () => openReader(Number(button.dataset.pkRead))));
  };

  const load = async cat => {
    active = QUERIES[cat] ? cat : 'breaking';
    const token = ++loadToken;
    root.querySelectorAll('[data-pk-cat]').forEach(button => button.classList.toggle('active', button.dataset.pkCat === active));
    status.textContent = 'Loading live regional coverage…';
    list.innerHTML = '<div class="nx-empty">Loading live headlines…</div>';
    reader.hidden = true;
    try {
      const nextRows = await gdelt(QUERIES[active]);
      if (cancelled || token !== loadToken) return;
      rows = nextRows;
      paint();
      status.textContent = `Live ${active} feed • ${rows.length} article${rows.length === 1 ? '' : 's'} • tap for in-app details`;
    } catch (error) {
      if (cancelled || token !== loadToken) return;
      rows = [];
      list.innerHTML = '<div class="nx-empty">Regional live feed is temporarily unavailable.</div>';
      status.textContent = 'GDELT live feed unavailable. No cached or fabricated headline was substituted.';
      console.warn('[NexusNova Fresh] Pakistan news:', error);
    }
  };

  root.querySelectorAll('[data-pk-cat]').forEach(button => button.addEventListener('click', () => load(button.dataset.pkCat)));
  load('breaking');
  root.__cleanup = () => { cancelled = true; rows = []; loadToken += 1; };
  return root;
}

export const pakistanSuiteRenderers = Object.freeze({ pakistan: renderPakistanSuite });
