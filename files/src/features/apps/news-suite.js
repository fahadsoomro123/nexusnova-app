import { escapeHtml } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite';
  root.innerHTML = html;
  return root;
}

function safeHttpUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function cleanFeedText(raw) {
  const html = String(raw || '').trim();
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    return String(doc.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
  }
}

function titleParts(raw) {
  const full = String(raw || '').trim();
  const pieces = full.split(/\s+-\s+/);
  const source = pieces.length > 1 ? pieces.pop().trim() : '';
  return { title: pieces.join(' - ').trim() || full, source };
}

function readableDate(raw) {
  const date = new Date(raw || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
}

async function fetchFeed(query) {
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PK&gl=PK&ceid=PK:en`;
  try {
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    const json = await response.json();
    if (json?.status && json.status !== 'ok') throw new Error(json.message || 'RSS service failed');
    return (Array.isArray(json?.items) ? json.items : []).map(item => {
      const parts = titleParts(item.title);
      const preview = cleanFeedText(item.description || item.content || item.contentSnippet || '');
      return {
        title: parts.title,
        source: String(item.author || parts.source || 'News').slice(0, 90),
        date: item.pubDate || '',
        link: safeHttpUrl(item.link),
        preview
      };
    }).filter(item => item.title.length > 8 && item.link).slice(0, 30);
  } catch (firstError) {
    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(rss)}`, { cache:'no-store' });
    if (!response.ok) throw firstError;
    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return [...doc.querySelectorAll('item')].map(item => {
      const parts = titleParts(item.querySelector('title')?.textContent || '');
      return {
        title: parts.title,
        source: String(item.querySelector('source')?.textContent || parts.source || 'News').slice(0, 90),
        date: item.querySelector('pubDate')?.textContent || '',
        link: safeHttpUrl(item.querySelector('link')?.textContent || ''),
        preview: cleanFeedText(item.querySelector('description')?.textContent || '')
      };
    }).filter(item => item.title.length > 8 && item.link).slice(0, 30);
  }
}

export function renderNewsSuite() {
  const root = node(`
    <section class="nx-news-hero">
      <div>
        <p class="nx-eyebrow">LIVE • IN-APP NEWS</p>
        <strong>Top stories without leaving NexusNova</strong>
        <p class="nx-tool-meta" data-news-status>Loading verified feed headlines…</p>
      </div>
      <button type="button" data-news-refresh>REFRESH</button>
    </section>
    <section class="nx-news-reader" data-news-reader hidden></section>
    <section class="nx-news-grid" data-news-list><div class="nx-empty">Loading live headlines…</div></section>
  `);

  const status = root.querySelector('[data-news-status]');
  const list = root.querySelector('[data-news-list]');
  const reader = root.querySelector('[data-news-reader]');
  const refresh = root.querySelector('[data-news-refresh]');
  let items = [];
  let busy = false;
  let cancelled = false;

  const openReader = index => {
    const item = items[index];
    if (!item) return;
    const date = readableDate(item.date);
    const preview = item.preview && item.preview.toLowerCase() !== item.title.toLowerCase()
      ? `<p class="nx-news-reader__copy">${escapeHtml(item.preview)}</p>`
      : '<p class="nx-news-reader__empty">This feed item does not include a readable article preview. NexusNova will not scrape or invent publisher text.</p>';
    reader.innerHTML = `
      <div class="nx-news-reader__top">
        <span class="nx-news-live-dot"></span>
        <span>${escapeHtml(item.source)}</span>
        <button type="button" data-news-close aria-label="Close story">×</button>
      </div>
      <h2>${escapeHtml(item.title)}</h2>
      ${date ? `<p class="nx-news-reader__date">${escapeHtml(date)}</p>` : ''}
      ${preview}
      <div class="nx-news-reader__note">Feed-provided preview • original publisher article is not copied or scraped.</div>
    `;
    reader.hidden = false;
    reader.querySelector('[data-news-close]')?.addEventListener('click', () => { reader.hidden = true; });
    reader.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  const paint = () => {
    list.innerHTML = items.length ? items.map((item, index) => {
      const date = readableDate(item.date);
      const preview = item.preview ? item.preview.slice(0, 170) : 'Tap for the feed-provided story details available inside NexusNova.';
      return `
        <button class="nx-news-story" type="button" data-news-story="${index}">
          <span class="nx-news-story__number">${String(index + 1).padStart(2, '0')}</span>
          <span class="nx-news-story__body">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="nx-news-story__preview">${escapeHtml(preview)}</span>
            <span class="nx-news-story__meta">${escapeHtml(item.source)}${date ? ` • ${escapeHtml(date)}` : ''}</span>
          </span>
          <span class="nx-news-story__arrow">›</span>
        </button>`;
    }).join('') : '<div class="nx-empty">No live headlines returned right now.</div>';
    list.querySelectorAll('[data-news-story]').forEach(button => button.addEventListener('click', () => openReader(Number(button.dataset.newsStory))));
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    status.textContent = 'Loading verified feed headlines…';
    list.innerHTML = '<div class="nx-empty">Loading live headlines…</div>';
    reader.hidden = true;
    try {
      const rows = await fetchFeed('Pakistan latest news');
      if (cancelled) return;
      if (!rows.length) throw new Error('No current stories returned.');
      items = rows;
      paint();
      status.textContent = `${items.length} live stories • tap any headline to read available details in-app`;
    } catch (error) {
      if (cancelled) return;
      items = [];
      list.innerHTML = '<div class="nx-empty">News provider unavailable right now.</div>';
      status.textContent = 'Live feed unavailable. No cached or fabricated headline was substituted.';
      console.warn('[NexusNova Fresh] news suite:', error);
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  };

  refresh.addEventListener('click', load);
  load();
  root.__cleanup = () => { cancelled = true; items = []; };
  return root;
}

export const newsSuiteRenderers = Object.freeze({ news: renderNewsSuite });
