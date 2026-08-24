import { escapeHtml } from '../../core/local-store.js';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite';
  root.innerHTML = html;
  return root;
}

function safeUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

function openExternal(raw) {
  const url = safeUrl(raw);
  if (!url) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url })) return true;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch { return false; }
}

function gdeltJsonp(query, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const callback = `__nxGdelt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let timer = null;
    const cleanup = () => {
      clearTimeout(timer);
      script.remove();
      try { delete window[callback]; } catch { window[callback] = undefined; }
    };
    window[callback] = data => { cleanup(); resolve(data || {}); };
    const params = new URLSearchParams({
      query,
      mode:'ArtList',
      format:'jsonp',
      callback,
      maxrecords:'30',
      sort:'HybridRel',
      timespan:'24h'
    });
    script.async = true;
    script.src = `${GDELT_DOC}?${params.toString()}`;
    script.onerror = () => { cleanup(); reject(new Error('Live news service could not load.')); };
    timer = setTimeout(() => { cleanup(); reject(new Error('Live news service timed out.')); }, timeout);
    document.head.appendChild(script);
  });
}

function normalizeArticle(item) {
  const url = safeUrl(item?.url);
  const title = String(item?.title || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  if (!url || !title) return null;
  let domain = String(item?.domain || '').trim().slice(0, 120);
  if (!domain) { try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {} }
  return {
    title,
    url,
    domain:domain || 'Publisher',
    seen:String(item?.seendate || item?.date || '').trim(),
    language:String(item?.language || '').trim().slice(0, 40),
    country:String(item?.sourcecountry || '').trim().slice(0, 60)
  };
}

export function renderNewsResilient() {
  const root = node(`
    <section class="nx-news-hero">
      <div><p class="nx-eyebrow">LIVE • REAL PUBLISHER LINKS</p><strong>Current news without fake cached headlines</strong><p class="nx-tool-meta" data-news-status>Loading current Pakistan stories…</p></div>
      <button type="button" data-news-refresh>REFRESH</button>
    </section>
    <section class="nx-tool-card">
      <label class="nx-field"><span>News topic</span><input type="search" maxlength="120" value="Pakistan" data-news-query></label>
      <p class="nx-tool-meta">GDELT indexes current publisher coverage. NexusNova shows source metadata and opens the original article; it does not copy full publisher text.</p>
    </section>
    <section class="nx-news-grid" data-news-list><div class="nx-empty">Loading live headlines…</div></section>`);

  const status = root.querySelector('[data-news-status]');
  const list = root.querySelector('[data-news-list]');
  const refresh = root.querySelector('[data-news-refresh]');
  const query = root.querySelector('[data-news-query]');
  let revision = 0;
  let disposed = false;

  const load = async () => {
    const q = query.value.trim() || 'Pakistan';
    const current = ++revision;
    refresh.disabled = true;
    refresh.textContent = 'LOADING…';
    status.textContent = `Loading current ${q} coverage…`;
    list.innerHTML = '<div class="nx-empty">Checking live publisher index…</div>';
    try {
      const data = await gdeltJsonp(q);
      if (disposed || current !== revision) return;
      const rows = (Array.isArray(data?.articles) ? data.articles : []).map(normalizeArticle).filter(Boolean);
      list.innerHTML = rows.length ? rows.map((item, index) => `<button class="nx-news-story" type="button" data-news-url="${escapeHtml(item.url)}"><span class="nx-news-story__number">${String(index + 1).padStart(2, '0')}</span><span class="nx-news-story__body"><strong>${escapeHtml(item.title)}</strong><span class="nx-news-story__meta">${escapeHtml([item.domain, item.country, item.language, item.seen].filter(Boolean).join(' • '))}</span></span><span class="nx-news-story__arrow">›</span></button>`).join('') : '<div class="nx-empty">No current publisher results matched this topic.</div>';
      list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => {
        if (!openExternal(button.dataset.newsUrl)) status.textContent = 'Could not open that publisher link safely.';
      }));
      status.textContent = `${rows.length} current publisher result${rows.length === 1 ? '' : 's'} • GDELT live index`;
    } catch (error) {
      if (disposed || current !== revision) return;
      list.innerHTML = '<div class="nx-empty">Live news service is unavailable right now.</div>';
      status.textContent = String(error?.message || 'Live news unavailable.').slice(0, 220);
    } finally {
      if (!disposed && current === revision) { refresh.disabled = false; refresh.textContent = 'REFRESH'; }
    }
  };

  refresh.addEventListener('click', load);
  query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); load(); } });
  load();
  root.__cleanup = () => { disposed = true; revision += 1; };
  return root;
}

export const newsResilientRenderers = Object.freeze({ news:renderNewsResilient });
