import { escapeHtml } from '../../core/local-store.js';

const DEFAULT_TOPIC = 'Pakistan';
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite nx-news-v5';
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

function bridgeFeed(query, timeout = 20000) {
  const bridge = window.NexusAppCheckAndroid;
  if (!bridge || typeof bridge.postMessage !== 'function') return Promise.reject(new Error('Native live-news bridge is unavailable.'));
  return new Promise((resolve, reject) => {
    const requestId = `news-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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
      if (!payload.ok) return finish(reject, new Error(String(payload.error || 'Native live news failed.')));
      finish(resolve, { articles:Array.isArray(payload.articles) ? payload.articles : [] });
    };
    bridge.onmessage = handler;
    timer = setTimeout(() => finish(reject, new Error('Native live news timed out.')), timeout);
    try { bridge.postMessage(JSON.stringify({ action:'fetchNews', requestId, query })); }
    catch (error) { finish(reject, error instanceof Error ? error : new Error('Native live news request failed.')); }
  });
}

function webFeed(query, timeout = 18000) {
  const params = new URLSearchParams({ query, mode:'ArtList', format:'json', maxrecords:'40', sort:'DateDesc', timespan:'48h' });
  const request = fetch(`${GDELT_DOC}?${params}`, { cache:'no-store', headers:{ Accept:'application/json' } })
    .then(async response => {
      if (!response.ok) throw new Error(`Live publisher HTTP ${response.status}`);
      return response.json();
    });
  return Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live publisher request timed out.')), timeout))
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
  let domain = String(item?.domain || item?.source || '').trim().slice(0, 120);
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

function formatSeen(raw) {
  const value = String(raw || '').trim();
  if (!value) return 'Live now';
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  const date = compact
    ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] || '00'}:${compact[5] || '00'}:00Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 36) : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function pageSize() {
  return window.innerHeight < 720 ? 2 : 3;
}

function storyMarkup(item) {
  const meta = [item.country, formatSeen(item.seen)].filter(Boolean).join(' • ');
  const visual = item.image
    ? `<span class="nxn5-image"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><em>LIVE</em></span>`
    : `<span class="nxn5-image nxn5-image--empty"><b>${escapeHtml(item.domain.slice(0,1).toUpperCase() || 'N')}</b><em>LIVE</em></span>`;
  return `<button class="nxn5-story" type="button" data-news-url="${escapeHtml(item.url)}">
    ${visual}
    <span class="nxn5-copy"><span>${escapeHtml(item.domain)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></span>
    <i>›</i>
  </button>`;
}

export function renderNewsResilient() {
  const root = node(`
    <style>
      .nx-news-v5{height:100%;max-height:100%;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:7px;box-sizing:border-box}.nxn5-controls{display:grid;gap:7px;padding:10px;border:1px solid rgba(83,190,245,.16);border-radius:17px;background:radial-gradient(circle at 88% 10%,rgba(35,196,255,.09),transparent 32%),linear-gradient(145deg,#0a2133,#04111d);box-shadow:inset 0 1px rgba(255,255,255,.06)}.nxn5-statusrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.nxn5-statusrow div{min-width:0}.nxn5-statusrow span{display:block;color:#4fd8ff;font-size:7px;font-weight:950;letter-spacing:.12em}.nxn5-statusrow strong{display:block;margin-top:3px;overflow:hidden;color:#d8e7f2;font-size:9px;line-height:1.35;white-space:nowrap;text-overflow:ellipsis}.nxn5-refresh{height:34px;padding:0 11px;border:1px solid rgba(73,197,255,.24);border-radius:11px;background:#08263a;color:#65ddff;font-size:8px;font-weight:950}.nxn5-search{display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:7px}.nxn5-search input{min-width:0;height:36px;padding:0 11px;border:1px solid rgba(99,178,226,.16);border-radius:11px;background:#03101b;color:#f4f9fc;outline:none}.nxn5-search button{height:36px;border:0;border-radius:11px;background:#0b3655;color:#6adeff;font-size:8px;font-weight:950}.nxn5-topics{display:flex;gap:6px;overflow:hidden}.nxn5-topic{flex:1 1 0;min-width:0;height:30px;padding:0 5px;border:1px solid rgba(87,162,211,.14);border-radius:10px;background:#051522;color:#8ca7bc;font-size:7px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxn5-topic.is-active{border-color:rgba(67,199,255,.34);background:#0a2f4a;color:#61dbff}.nxn5-list{min-height:0;display:grid;grid-template-rows:repeat(var(--news-rows,3),minmax(0,1fr));gap:7px;overflow:hidden}.nxn5-story{min-height:0;display:grid;grid-template-columns:78px minmax(0,1fr) 15px;gap:10px;align-items:center;width:100%;padding:8px;border:1px solid rgba(98,167,214,.14);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.025),transparent 28%),linear-gradient(155deg,#10202c,#061019);color:inherit;text-align:left;overflow:hidden}.nxn5-image{position:relative;height:100%;min-height:58px;max-height:82px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#071d31;color:#68ddff}.nxn5-image img{width:100%;height:100%;object-fit:cover}.nxn5-image em{position:absolute;left:5px;bottom:5px;padding:2px 4px;border-radius:5px;background:rgba(2,10,16,.82);color:#61ddff;font-size:5px;font-style:normal;font-weight:950}.nxn5-image--empty{background:radial-gradient(circle at 35% 25%,#14547f,#061523 72%)}.nxn5-image--empty b{font-size:28px}.nxn5-copy{min-width:0}.nxn5-copy>span{display:block;overflow:hidden;color:#46d1ff;font-size:7px;font-weight:950;text-transform:uppercase;white-space:nowrap;text-overflow:ellipsis;letter-spacing:.08em}.nxn5-copy strong{display:-webkit-box;margin-top:4px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:1.25}.nxn5-copy small{display:block;margin-top:5px;color:#7890a5;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxn5-story>i{color:#5ed8ff;font-size:21px;font-style:normal}.nxn5-empty{grid-row:1/-1;display:grid;place-items:center;padding:14px;border:1px dashed rgba(89,165,214,.17);border-radius:16px;background:radial-gradient(circle at 50% 20%,rgba(53,178,239,.07),transparent 38%),#061019;text-align:center}.nxn5-empty strong{display:block;color:#d8e7f2;font-size:13px}.nxn5-empty p{max-width:310px;margin:7px auto 10px;color:#8298aa;font-size:9px;line-height:1.5}.nxn5-empty button{height:34px;padding:0 14px;border:1px solid rgba(73,197,255,.22);border-radius:11px;background:#08263a;color:#65ddff;font-size:8px;font-weight:950}.nxn5-pager{display:grid;grid-template-columns:72px minmax(0,1fr) 72px;gap:7px;align-items:center}.nxn5-pager button{height:33px;border:1px solid rgba(98,167,214,.13);border-radius:10px;background:#071a28;color:#95b6ca;font-size:8px;font-weight:900}.nxn5-pager button:disabled{opacity:.35}.nxn5-pager span{text-align:center;color:#7890a5;font-size:8px;font-weight:850}@media(max-width:390px){.nxn5-story{grid-template-columns:66px minmax(0,1fr) 14px;gap:8px}.nxn5-copy strong{font-size:11px}.nxn5-topic{font-size:6.5px}}@media(max-height:720px){.nxn5-controls{padding:7px}.nxn5-topic{height:27px}.nxn5-pager button{height:30px}}
    </style>
    <section class="nxn5-controls">
      <div class="nxn5-statusrow"><div><span>LIVE PUBLISHER SEARCH</span><strong data-news-status>Connecting to genuine current headlines…</strong></div><button class="nxn5-refresh" type="button" data-news-refresh>REFRESH</button></div>
      <div class="nxn5-search"><input type="search" maxlength="120" value="${DEFAULT_TOPIC}" data-news-query aria-label="News topic"><button type="button" data-news-search>SEARCH</button></div>
    </section>
    <nav class="nxn5-topics" aria-label="News topics">
      <button class="nxn5-topic is-active" type="button" data-news-topic="Pakistan">PAKISTAN</button>
      <button class="nxn5-topic" type="button" data-news-topic="Technology">TECH</button>
      <button class="nxn5-topic" type="button" data-news-topic="Artificial Intelligence">AI</button>
      <button class="nxn5-topic" type="button" data-news-topic="World">WORLD</button>
      <button class="nxn5-topic" type="button" data-news-topic="Business">BUSINESS</button>
    </nav>
    <section class="nxn5-list" data-news-list><div class="nxn5-empty"><div><strong>Connecting…</strong><p>Checking native Android bridge and live publisher fallback. No cached or invented headlines.</p></div></div></section>
    <footer class="nxn5-pager"><button type="button" data-news-prev>PREV</button><span data-news-page>PAGE 1 / 1</span><button type="button" data-news-next>NEXT</button></footer>
  `);

  const status = root.querySelector('[data-news-status]');
  const list = root.querySelector('[data-news-list]');
  const refresh = root.querySelector('[data-news-refresh]');
  const search = root.querySelector('[data-news-search]');
  const query = root.querySelector('[data-news-query]');
  const topics = [...root.querySelectorAll('[data-news-topic]')];
  const prev = root.querySelector('[data-news-prev]');
  const next = root.querySelector('[data-news-next]');
  const pageLabel = root.querySelector('[data-news-page]');
  let rows = [];
  let page = 0;
  let revision = 0;
  let disposed = false;

  const paint = () => {
    const size = pageSize();
    root.style.setProperty('--news-rows', String(size));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.max(0, Math.min(page, pages - 1));
    const visible = rows.slice(page * size, page * size + size);
    list.innerHTML = visible.length
      ? visible.map(storyMarkup).join('')
      : '<div class="nxn5-empty"><div><strong>No live results returned</strong><p>Try another topic or refresh. NexusNova will not replace missing live results with cached or fabricated headlines.</p><button type="button" data-news-retry>RETRY LIVE FEED</button></div></div>';
    list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => {
      if (!openExternal(button.dataset.newsUrl)) status.textContent = 'Could not open that live story safely.';
    }));
    list.querySelector('[data-news-retry]')?.addEventListener('click', load);
    pageLabel.textContent = `PAGE ${page + 1} / ${pages}`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1 || !rows.length;
  };

  const load = async () => {
    const q = query.value.trim() || DEFAULT_TOPIC;
    const current = ++revision;
    page = 0;
    refresh.disabled = true;
    search.disabled = true;
    refresh.textContent = 'LOADING…';
    status.textContent = `Checking latest ${q} coverage…`;
    list.innerHTML = '<div class="nxn5-empty"><div><strong>Loading live publishers…</strong><p>Native Android bridge first • direct web fallback second.</p></div></div>';
    try {
      const data = await liveFeed(q);
      if (disposed || current !== revision) return;
      const seen = new Set();
      rows = (Array.isArray(data?.articles) ? data.articles : [])
        .map(normalizeArticle)
        .filter(item => item && !seen.has(item.url) && seen.add(item.url))
        .slice(0, 40);
      paint();
      status.textContent = `${rows.length} genuine live result${rows.length === 1 ? '' : 's'} • newest first`;
    } catch (error) {
      if (disposed || current !== revision) return;
      rows = [];
      paint();
      status.textContent = String(error?.message || 'Live news unavailable.').replace(/signal is aborted without reason/ig, 'Live connection failed').slice(0, 160);
    } finally {
      if (!disposed && current === revision) {
        refresh.disabled = false;
        search.disabled = false;
        refresh.textContent = 'REFRESH';
      }
    }
  };

  refresh.addEventListener('click', load);
  search.addEventListener('click', load);
  query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); load(); } });
  topics.forEach(button => button.addEventListener('click', () => {
    topics.forEach(item => item.classList.toggle('is-active', item === button));
    query.value = button.dataset.newsTopic || DEFAULT_TOPIC;
    load();
  }));
  query.addEventListener('input', () => topics.forEach(item => item.classList.remove('is-active')));
  prev.addEventListener('click', () => { if (page > 0) { page -= 1; paint(); } });
  next.addEventListener('click', () => { const pages = Math.ceil(rows.length / pageSize()); if (page + 1 < pages) { page += 1; paint(); } });
  window.addEventListener('resize', paint);
  load();
  root.__cleanup = () => {
    disposed = true;
    revision += 1;
    rows = [];
    window.removeEventListener('resize', paint);
  };
  return root;
}

export const newsResilientRenderers = Object.freeze({ news: renderNewsResilient });