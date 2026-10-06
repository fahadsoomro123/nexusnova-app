import { escapeHtml } from '../../core/local-store.js';

const QUERIES = Object.freeze({
  breaking:'Pakistan breaking latest news',
  urdu:'پاکستان اردو خبریں',
  sindhi:'سنڌ پاڪستان خبرون',
  pakistan:'Pakistan news politics economy',
  entertainment:'Pakistan entertainment film drama music'
});
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-pakistan-suite nx-pk-v5';
  root.innerHTML = html;
  return root;
}

function safeUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
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

function readableDate(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'Live now';
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  const date = compact
    ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] || '00'}:${compact[5] || '00'}:00Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 36) : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function bridgeFeed(query, timeout = 20000) {
  const bridge = window.NexusAppCheckAndroid;
  if (!bridge || typeof bridge.postMessage !== 'function') return Promise.reject(new Error('Native live-news bridge is unavailable.'));
  return new Promise((resolve, reject) => {
    const requestId = `pk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const previous = bridge.onmessage;
    let settled = false;
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      if (bridge.onmessage === handler) bridge.onmessage = previous || null;
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const handler = event => {
      let payload = null;
      try { payload = JSON.parse(String(event?.data || '')); } catch {}
      if (!payload || payload.requestId !== requestId) {
        if (typeof previous === 'function') { try { previous.call(bridge, event); } catch {} }
        return;
      }
      if (!payload.ok) return finish(reject, new Error(String(payload.error || 'Native Pakistan news failed.')));
      finish(resolve, { articles:Array.isArray(payload.articles) ? payload.articles : [] });
    };
    bridge.onmessage = handler;
    timer = setTimeout(() => finish(reject, new Error('Native Pakistan news timed out.')), timeout);
    try { bridge.postMessage(JSON.stringify({ action:'fetchNews', requestId, query })); }
    catch (error) { finish(reject, error instanceof Error ? error : new Error('Native Pakistan news request failed.')); }
  });
}

function webFeed(query, timeout = 18000) {
  const params = new URLSearchParams({ query, mode:'ArtList', format:'json', maxrecords:'30', sort:'DateDesc', timespan:'48h' });
  const request = fetch(`${GDELT_DOC}?${params}`, { cache:'no-store', headers:{ Accept:'application/json' } })
    .then(async response => {
      if (!response.ok) throw new Error(`Pakistan live feed HTTP ${response.status}`);
      return response.json();
    });
  return Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Pakistan live feed timed out.')), timeout))
  ]);
}

async function liveFeed(query) {
  if (typeof window.NexusAppCheckAndroid?.postMessage === 'function') {
    try { return await bridgeFeed(query); }
    catch (nativeError) {
      try { return await webFeed(query); }
      catch { throw nativeError; }
    }
  }
  return webFeed(query);
}

function normalizeArticle(item) {
  const url = safeUrl(item?.url);
  const title = String(item?.title || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!url || !title) return null;
  let domain = String(item?.domain || item?.source || '').trim().slice(0, 100);
  if (!domain) { try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {} }
  return {
    title,
    url,
    image:safeUrl(item?.image || item?.socialimage),
    domain:domain || 'Publisher',
    seen:String(item?.seen || item?.seendate || item?.date || '').trim(),
    country:String(item?.country || item?.sourcecountry || '').trim().slice(0, 60)
  };
}

function pageSize() {
  return window.innerHeight < 720 ? 2 : 3;
}

function storyMarkup(item) {
  const meta = [item.domain, item.country, readableDate(item.seen)].filter(Boolean).join(' • ');
  const visual = item.image
    ? `<span class="nxpk5-img"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><em>LIVE</em></span>`
    : `<span class="nxpk5-img nxpk5-img--empty"><b>${escapeHtml(item.domain.slice(0,1).toUpperCase() || 'P')}</b><em>LIVE</em></span>`;
  return `<button class="nxpk5-story" type="button" data-pk-url="${escapeHtml(item.url)}">
    ${visual}
    <span class="nxpk5-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></span>
    <span class="nxpk5-arrow">›</span>
  </button>`;
}

export function renderPakistanSuite() {
  const root = node(`
    <style>
      .nx-pk-v5{height:100%;max-height:100%;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:7px;box-sizing:border-box}.nxpk5-status{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border:1px solid rgba(76,222,173,.14);border-radius:16px;background:linear-gradient(145deg,#10291f,#07140f);box-shadow:inset 0 1px rgba(255,255,255,.06)}.nxpk5-status span{display:block;color:#6ef0c0;font-size:7px;font-weight:950;letter-spacing:.13em}.nxpk5-status strong{display:block;margin-top:3px;color:#dcebe5;font-size:9px;line-height:1.35;font-weight:700}.nxpk5-status button{height:34px;padding:0 11px;border:1px solid rgba(91,231,184,.2);border-radius:11px;background:#123d2e;color:#a8f5d5;font-size:8px;font-weight:950}.nxpk5-tabs{display:flex;gap:6px;overflow:hidden;padding:4px;border:1px solid rgba(86,213,174,.08);border-radius:13px;background:rgba(5,18,14,.92)}.nxpk5-tabs button{flex:1 1 0;min-width:0;height:31px;padding:0 5px;border:1px solid rgba(91,176,145,.12);border-radius:10px;background:#081711;color:#7e9e91;font-size:7px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxpk5-tabs button.active{border-color:rgba(72,233,174,.22);background:linear-gradient(180deg,#205b48,#123629);color:#b8f9df}.nxpk5-list{min-height:0;display:grid;grid-template-rows:repeat(var(--pk-rows,3),minmax(0,1fr));gap:7px;overflow:hidden}.nxpk5-story{min-height:0;display:grid;grid-template-columns:78px minmax(0,1fr) 16px;gap:10px;align-items:center;width:100%;padding:8px;border:1px solid rgba(91,181,147,.13);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.025),transparent 28%),linear-gradient(155deg,#10221a,#06110d);color:inherit;text-align:left;overflow:hidden}.nxpk5-img{position:relative;height:100%;min-height:58px;max-height:82px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#0d2c21;color:#77e8bc}.nxpk5-img img{width:100%;height:100%;object-fit:cover}.nxpk5-img em{position:absolute;left:5px;bottom:5px;padding:2px 4px;border-radius:5px;background:rgba(2,12,8,.82);color:#6af0bd;font-size:5px;font-style:normal;font-weight:950}.nxpk5-img--empty{background:radial-gradient(circle at 35% 25%,#205f49,#081711 72%)}.nxpk5-img--empty b{font-size:28px}.nxpk5-copy{min-width:0;align-self:center}.nxpk5-copy strong{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:1.25}.nxpk5-copy small{display:block;margin-top:5px;overflow:hidden;color:#78988b;font-size:7px;line-height:1.25;white-space:nowrap;text-overflow:ellipsis}.nxpk5-arrow{color:#6ceabb;font-size:21px}.nxpk5-empty{grid-row:1/-1;display:grid;place-items:center;padding:14px;border:1px dashed rgba(86,213,174,.17);border-radius:16px;background:radial-gradient(circle at 50% 20%,rgba(47,210,151,.07),transparent 38%),#07110d;text-align:center}.nxpk5-empty strong{display:block;color:#dcebe5;font-size:13px}.nxpk5-empty p{max-width:310px;margin:7px auto 10px;color:#7f9d91;font-size:9px;line-height:1.5}.nxpk5-empty button{height:34px;padding:0 14px;border:1px solid rgba(91,231,184,.2);border-radius:11px;background:#123d2e;color:#a8f5d5;font-size:8px;font-weight:950}.nxpk5-pager{display:grid;grid-template-columns:72px minmax(0,1fr) 72px;gap:7px;align-items:center}.nxpk5-pager button{height:33px;border:1px solid rgba(91,181,147,.13);border-radius:10px;background:#0a1d16;color:#9fc8b8;font-size:8px;font-weight:900}.nxpk5-pager button:disabled{opacity:.35}.nxpk5-pager span{text-align:center;color:#78988b;font-size:8px;font-weight:850}.nxpk5-loading{opacity:.65}@media(max-width:390px){.nxpk5-story{grid-template-columns:66px minmax(0,1fr) 14px;gap:8px}.nxpk5-copy strong{font-size:11px}.nxpk5-tabs button{font-size:6.5px}}@media(max-height:720px){.nxpk5-status{padding:7px 9px}.nxpk5-tabs button{height:28px}.nxpk5-pager button{height:30px}}
    </style>
    <section class="nxpk5-status"><div><span>PAKISTAN LIVE • NATIVE-FIRST</span><strong data-pk-status>Connecting to genuine regional headlines…</strong></div><button type="button" data-pk-refresh>REFRESH</button></section>
    <nav class="nxpk5-tabs" aria-label="Pakistan news categories">
      <button class="active" type="button" data-pk-cat="breaking">Breaking</button>
      <button type="button" data-pk-cat="urdu">Urdu</button>
      <button type="button" data-pk-cat="sindhi">Sindhi</button>
      <button type="button" data-pk-cat="pakistan">Pakistan</button>
      <button type="button" data-pk-cat="entertainment">Entertain.</button>
    </nav>
    <section class="nxpk5-list" data-pk-list><div class="nxpk5-empty"><div><strong>Connecting…</strong><p>Checking live regional publishers. No cached or fabricated headline will be substituted.</p></div></div></section>
    <footer class="nxpk5-pager"><button type="button" data-pk-prev>PREV</button><span data-pk-page>PAGE 1 / 1</span><button type="button" data-pk-next>NEXT</button></footer>
  `);

  const status = root.querySelector('[data-pk-status]');
  const list = root.querySelector('[data-pk-list]');
  const refresh = root.querySelector('[data-pk-refresh]');
  const prev = root.querySelector('[data-pk-prev]');
  const next = root.querySelector('[data-pk-next]');
  const pageLabel = root.querySelector('[data-pk-page]');
  let active = 'breaking';
  let rows = [];
  let page = 0;
  let revision = 0;
  let disposed = false;

  const paint = () => {
    const size = pageSize();
    root.style.setProperty('--pk-rows', String(size));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.max(0, Math.min(page, pages - 1));
    const visible = rows.slice(page * size, page * size + size);
    list.innerHTML = visible.length
      ? visible.map(storyMarkup).join('')
      : '<div class="nxpk5-empty"><div><strong>No live stories returned</strong><p>Try another category or refresh. NexusNova will not fill the screen with cached or invented headlines.</p><button type="button" data-pk-retry>RETRY LIVE FEED</button></div></div>';
    list.querySelectorAll('[data-pk-url]').forEach(button => button.addEventListener('click', () => {
      if (!openExternal(button.dataset.pkUrl)) status.textContent = 'Could not open that publisher safely.';
    }));
    list.querySelector('[data-pk-retry]')?.addEventListener('click', () => load(active));
    pageLabel.textContent = `PAGE ${page + 1} / ${pages}`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1 || !rows.length;
  };

  const load = async cat => {
    active = QUERIES[cat] ? cat : 'breaking';
    const current = ++revision;
    page = 0;
    root.querySelectorAll('[data-pk-cat]').forEach(button => button.classList.toggle('active', button.dataset.pkCat === active));
    refresh.disabled = true;
    refresh.textContent = 'LOADING…';
    status.textContent = 'Checking native bridge, then live web fallback…';
    list.innerHTML = '<div class="nxpk5-empty nxpk5-loading"><div><strong>Loading live Pakistan coverage…</strong><p>Native Android request first • direct publisher fallback second.</p></div></div>';
    try {
      const data = await liveFeed(QUERIES[active]);
      if (disposed || current !== revision) return;
      const seen = new Set();
      rows = (Array.isArray(data?.articles) ? data.articles : [])
        .map(normalizeArticle)
        .filter(item => item && !seen.has(item.url) && seen.add(item.url))
        .slice(0, 30);
      paint();
      status.textContent = `${rows.length} genuine ${active} result${rows.length === 1 ? '' : 's'} • newest first`;
    } catch (error) {
      if (disposed || current !== revision) return;
      rows = [];
      paint();
      status.textContent = String(error?.message || 'Regional live feed unavailable.').slice(0, 150);
    } finally {
      if (!disposed && current === revision) {
        refresh.disabled = false;
        refresh.textContent = 'REFRESH';
      }
    }
  };

  refresh.addEventListener('click', () => load(active));
  prev.addEventListener('click', () => { if (page > 0) { page -= 1; paint(); } });
  next.addEventListener('click', () => { const pages = Math.ceil(rows.length / pageSize()); if (page + 1 < pages) { page += 1; paint(); } });
  root.querySelectorAll('[data-pk-cat]').forEach(button => button.addEventListener('click', () => load(button.dataset.pkCat)));
  window.addEventListener('resize', paint);
  load('breaking');
  root.__cleanup = () => {
    disposed = true;
    revision += 1;
    rows = [];
    window.removeEventListener('resize', paint);
  };
  return root;
}

export const pakistanSuiteRenderers = Object.freeze({ pakistan: renderPakistanSuite });