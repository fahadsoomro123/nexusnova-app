import { escapeHtml } from '../../core/local-store.js';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite nx-news-v2';
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

function buildParams(query, format) {
  return new URLSearchParams({
    query,
    mode:'ArtList',
    format,
    maxrecords:'40',
    sort:'DateDesc',
    timespan:'24h'
  });
}

async function gdeltFetch(query, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${GDELT_DOC}?${buildParams(query, 'json')}`, {
      cache:'no-store',
      headers:{ Accept:'application/json' },
      signal:controller.signal
    });
    if (!response.ok) throw new Error(`Live news HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function gdeltJsonp(query, timeout = 10000) {
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
    const params = buildParams(query, 'jsonp');
    params.set('callback', callback);
    script.async = true;
    script.src = `${GDELT_DOC}?${params}`;
    script.onerror = () => { cleanup(); reject(new Error('Live news fallback could not load.')); };
    timer = setTimeout(() => { cleanup(); reject(new Error('Live news service timed out.')); }, timeout);
    document.head.appendChild(script);
  });
}

async function liveFeed(query) {
  try { return await gdeltFetch(query); }
  catch (firstError) {
    try { return await gdeltJsonp(query); }
    catch { throw firstError; }
  }
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
    image:safeUrl(item?.socialimage || item?.image),
    domain:domain || 'Publisher',
    seen:String(item?.seendate || item?.date || '').trim(),
    language:String(item?.language || '').trim().slice(0, 40),
    country:String(item?.sourcecountry || '').trim().slice(0, 60)
  };
}

function formatSeen(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  const date = compact
    ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] || '00'}:${compact[5] || '00'}:00Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 32) : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function storyMarkup(item, lead = false) {
  const meta = [item.domain, item.country, formatSeen(item.seen)].filter(Boolean).join(' • ');
  return `<button class="nxn2-story${lead ? ' is-lead' : ''}" type="button" data-news-url="${escapeHtml(item.url)}">
    ${item.image ? `<span class="nxn2-image"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>` : '<span class="nxn2-image nxn2-image--empty">LIVE</span>'}
    <span class="nxn2-copy"><span class="nxn2-source">${escapeHtml(item.domain)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></span>
    <span class="nxn2-arrow">›</span>
  </button>`;
}

export function renderNewsResilient() {
  const root = node(`
    <style>
      .nx-news-v2{width:100%}.nxn2-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:12px;padding:15px;border:1px solid rgba(93,176,236,.16);border-radius:20px;background:linear-gradient(145deg,rgba(8,28,47,.98),rgba(4,14,25,.98))}.nxn2-top p{margin:0;color:#48cfff;font-size:9px;font-weight:900;letter-spacing:.14em}.nxn2-top h2{margin:6px 0 4px;font-size:25px;line-height:1}.nxn2-top small{color:#8297ac;font-size:10px}.nxn2-top button{height:38px;padding:0 15px;border:1px solid rgba(62,176,239,.32);border-radius:12px;background:#061b2d;color:#4ed2ff;font-size:9px;font-weight:900}.nxn2-search{margin-bottom:11px}.nxn2-search input{width:100%;height:42px;padding:0 13px;border:1px solid rgba(99,170,218,.16);border-radius:13px;background:#051321;color:#f5f9ff;outline:none}.nxn2-list{display:grid;gap:10px}.nxn2-story{position:relative;display:grid;grid-template-columns:92px minmax(0,1fr) 18px;gap:12px;align-items:center;width:100%;padding:10px;border:1px solid rgba(98,167,214,.13);border-radius:17px;background:linear-gradient(145deg,#071522,#030c15);color:inherit;text-align:left}.nxn2-story.is-lead{grid-template-columns:128px minmax(0,1fr) 20px;padding:12px;border-color:rgba(64,185,245,.26)}.nxn2-image{height:72px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#071d31;color:#3acbff;font-size:10px;font-weight:900;letter-spacing:.12em}.nxn2-story.is-lead .nxn2-image{height:94px}.nxn2-image img{width:100%;height:100%;object-fit:cover}.nxn2-copy{min-width:0}.nxn2-source{display:block;color:#42cfff;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.nxn2-copy strong{display:-webkit-box;margin-top:5px;overflow:hidden;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-size:14px;line-height:1.28}.nxn2-story.is-lead .nxn2-copy strong{font-size:17px}.nxn2-copy small{display:block;margin-top:7px;color:#748ca4;font-size:8px;line-height:1.35}.nxn2-arrow{color:#5ecfff;font-size:24px}@media(max-width:390px){.nxn2-story{grid-template-columns:78px minmax(0,1fr) 14px}.nxn2-story.is-lead{grid-template-columns:104px minmax(0,1fr) 14px}.nxn2-image{height:64px}.nxn2-story.is-lead .nxn2-image{height:82px}}
    </style>
    <section class="nxn2-top"><div><p>LIVE PUBLISHER INDEX</p><h2>News</h2><small data-news-status>Loading current Pakistan stories…</small></div><button type="button" data-news-refresh>REFRESH</button></section>
    <label class="nxn2-search"><input type="search" maxlength="120" value="Pakistan" data-news-query aria-label="News topic"></label>
    <section class="nxn2-list" data-news-list><div class="nx-empty">Loading live headlines…</div></section>`);

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
    status.textContent = `Checking live ${q} publisher coverage…`;
    list.innerHTML = '<div class="nx-empty">Connecting to live publisher index…</div>';
    try {
      const data = await liveFeed(q);
      if (disposed || current !== revision) return;
      const rows = (Array.isArray(data?.articles) ? data.articles : []).map(normalizeArticle).filter(Boolean);
      list.innerHTML = rows.length ? rows.map((item, index) => storyMarkup(item, index === 0)).join('') : '<div class="nx-empty">No live publisher results matched this topic.</div>';
      list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => {
        if (!openExternal(button.dataset.newsUrl)) status.textContent = 'Could not open that publisher link safely.';
      }));
      status.textContent = `${rows.length} live result${rows.length === 1 ? '' : 's'} • newest first • original publisher links`;
    } catch (error) {
      if (disposed || current !== revision) return;
      list.innerHTML = '<div class="nx-empty">Live news service is unavailable right now. No cached or invented headlines are shown.</div>';
      status.textContent = String(error?.message || 'Live news unavailable.').slice(0, 180);
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
