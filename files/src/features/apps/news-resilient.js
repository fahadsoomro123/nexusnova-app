import { escapeHtml } from '../../core/local-store.js';

const DEFAULT_TOPIC = 'Pakistan';
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite nx-news-v4';
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
  if (!bridge || typeof bridge.postMessage !== 'function') {
    return Promise.reject(new Error('Native live-news bridge is unavailable.'));
  }

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
        if (typeof previous === 'function') {
          try { previous.call(bridge, event); } catch {}
        }
        return;
      }
      if (!payload.ok) {
        finish(reject, new Error(String(payload.error || 'Native live news failed.')));
        return;
      }
      finish(resolve, { articles:Array.isArray(payload.articles) ? payload.articles : [] });
    };

    bridge.onmessage = handler;
    timer = setTimeout(() => finish(reject, new Error('Native live news timed out.')), timeout);
    try {
      bridge.postMessage(JSON.stringify({ action:'fetchNews', requestId, query }));
    } catch (error) {
      finish(reject, error instanceof Error ? error : new Error('Native live news request failed.'));
    }
  });
}

function webFeed(query, timeout = 18000) {
  const params = new URLSearchParams({
    query,
    mode:'ArtList',
    format:'json',
    maxrecords:'40',
    sort:'DateDesc',
    timespan:'48h'
  });
  const request = fetch(`${GDELT_DOC}?${params}`, {
    cache:'no-store',
    headers:{ Accept:'application/json' }
  }).then(async response => {
    if (!response.ok) throw new Error(`Live publisher HTTP ${response.status}`);
    return response.json();
  });
  return Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live publisher request timed out.')), timeout))
  ]);
}

async function liveFeed(query) {
  // Android uses a native HTTPS request first. This bypasses WebView-specific
  // fetch/JSONP failures without inventing or caching headlines. Browser builds
  // retain the direct GDELT path.
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
  return Number.isNaN(date.getTime())
    ? value.slice(0, 36)
    : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function storyMarkup(item, lead = false) {
  const meta = [item.country, formatSeen(item.seen)].filter(Boolean).join(' • ');
  const visual = item.image
    ? `<span class="nxn4-image"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><em>LIVE</em></span>`
    : `<span class="nxn4-image nxn4-image--empty"><b>${escapeHtml(item.domain.slice(0, 1).toUpperCase() || 'N')}</b><em>LIVE</em></span>`;
  return `<button class="nxn4-story${lead ? ' is-lead' : ''}" type="button" data-news-url="${escapeHtml(item.url)}">
    ${visual}
    <span class="nxn4-copy"><span class="nxn4-source">${escapeHtml(item.domain)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></span>
    <span class="nxn4-arrow">›</span>
  </button>`;
}

export function renderNewsResilient() {
  const root = node(`
    <style>
      .nx-news-v4{width:100%}.nxn4-hero{position:relative;overflow:hidden;margin-bottom:12px;padding:17px;border:1px solid rgba(83,190,245,.2);border-radius:22px;background:radial-gradient(circle at 86% 18%,rgba(35,196,255,.15),transparent 30%),linear-gradient(145deg,#09223a,#04121f 62%,#020b13)}.nxn4-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}.nxn4-live{display:flex;align-items:center;gap:7px;color:#49d6ff;font-size:9px;font-weight:900;letter-spacing:.14em}.nxn4-live i{width:7px;height:7px;border-radius:50%;background:#29ee70;box-shadow:0 0 12px rgba(41,238,112,.7)}.nxn4-head h2{margin:7px 0 4px;font-size:28px;line-height:1}.nxn4-head p{margin:0;color:#91a6ba;font-size:10px;line-height:1.45}.nxn4-refresh{height:40px;padding:0 15px;border:1px solid rgba(73,197,255,.34);border-radius:13px;background:#061d30;color:#58daff;font-size:9px;font-weight:900}.nxn4-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:14px}.nxn4-search input{min-width:0;height:43px;padding:0 13px;border:1px solid rgba(99,178,226,.19);border-radius:13px;background:#041321;color:#f6faff;outline:none}.nxn4-search button{height:43px;padding:0 15px;border:0;border-radius:13px;background:#0b3655;color:#62dcff;font-size:9px;font-weight:900}.nxn4-topics{display:flex;gap:7px;overflow:auto;margin:10px 0 13px;padding-bottom:2px;scrollbar-width:none}.nxn4-topics::-webkit-scrollbar{display:none}.nxn4-topic{flex:0 0 auto;height:31px;padding:0 12px;border:1px solid rgba(87,162,211,.16);border-radius:999px;background:#051522;color:#9db4c8;font-size:8px;font-weight:850}.nxn4-topic.is-active{border-color:rgba(67,199,255,.4);background:#0a2f4a;color:#55d8ff}.nxn4-list{display:grid;gap:10px}.nxn4-story{display:grid;grid-template-columns:96px minmax(0,1fr) 18px;gap:12px;align-items:center;width:100%;padding:10px;border:1px solid rgba(98,167,214,.15);border-radius:18px;background:linear-gradient(145deg,#071724,#030c15);color:inherit;text-align:left}.nxn4-story.is-lead{grid-template-columns:132px minmax(0,1fr) 20px;padding:12px;border-color:rgba(64,185,245,.3);background:radial-gradient(circle at 10% 20%,rgba(30,154,222,.08),transparent 38%),linear-gradient(145deg,#081a2a,#030c15)}.nxn4-image{position:relative;height:74px;display:grid;place-items:center;overflow:hidden;border-radius:13px;background:#071d31;color:#6adfff}.nxn4-story.is-lead .nxn4-image{height:98px}.nxn4-image img{width:100%;height:100%;object-fit:cover}.nxn4-image em{position:absolute;left:6px;bottom:6px;padding:3px 5px;border-radius:6px;background:rgba(2,10,16,.82);color:#5ae3ff;font-size:6px;font-style:normal;font-weight:900;letter-spacing:.12em}.nxn4-image--empty{background:radial-gradient(circle at 35% 25%,#14547f,#061523 72%)}.nxn4-image--empty b{font-size:34px;line-height:1}.nxn4-copy{min-width:0}.nxn4-source{display:block;overflow:hidden;color:#46d1ff;font-size:8px;font-weight:900;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;letter-spacing:.08em}.nxn4-copy strong{display:-webkit-box;margin-top:5px;overflow:hidden;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-size:14px;line-height:1.28}.nxn4-story.is-lead .nxn4-copy strong{font-size:17px}.nxn4-copy small{display:block;margin-top:7px;color:#7e93a8;font-size:8px;line-height:1.35}.nxn4-arrow{color:#5ecfff;font-size:24px}.nxn4-empty{padding:42px 18px;border:1px dashed rgba(89,165,214,.18);border-radius:18px;color:#9aadc0;text-align:center;font-size:11px;line-height:1.6}@media(max-width:390px){.nxn4-story{grid-template-columns:78px minmax(0,1fr) 14px}.nxn4-story.is-lead{grid-template-columns:105px minmax(0,1fr) 14px}.nxn4-image{height:65px}.nxn4-story.is-lead .nxn4-image{height:84px}.nxn4-head h2{font-size:24px}}
    </style>
    <section class="nxn4-hero"><div class="nxn4-head"><div><span class="nxn4-live"><i></i>LIVE PUBLISHER FEED</span><h2>News</h2><p data-news-status>Connecting to genuine current headlines…</p></div><button class="nxn4-refresh" type="button" data-news-refresh>REFRESH</button></div><div class="nxn4-search"><input type="search" maxlength="120" value="${DEFAULT_TOPIC}" data-news-query aria-label="News topic"><button type="button" data-news-search>SEARCH</button></div></section>
    <nav class="nxn4-topics" aria-label="News topics"><button class="nxn4-topic is-active" type="button" data-news-topic="Pakistan">PAKISTAN</button><button class="nxn4-topic" type="button" data-news-topic="Technology">TECH</button><button class="nxn4-topic" type="button" data-news-topic="Artificial Intelligence">AI</button><button class="nxn4-topic" type="button" data-news-topic="World">WORLD</button><button class="nxn4-topic" type="button" data-news-topic="Business">BUSINESS</button></nav>
    <section class="nxn4-list" data-news-list><div class="nxn4-empty">Loading genuine live headlines…</div></section>`);

  const status = root.querySelector('[data-news-status]');
  const list = root.querySelector('[data-news-list]');
  const refresh = root.querySelector('[data-news-refresh]');
  const search = root.querySelector('[data-news-search]');
  const query = root.querySelector('[data-news-query]');
  const topics = [...root.querySelectorAll('[data-news-topic]')];
  let revision = 0;
  let disposed = false;

  const load = async () => {
    const q = query.value.trim() || DEFAULT_TOPIC;
    const current = ++revision;
    refresh.disabled = true;
    search.disabled = true;
    refresh.textContent = 'LOADING…';
    status.textContent = `Checking latest ${q} coverage…`;
    list.innerHTML = '<div class="nxn4-empty">Connecting to live publishers…</div>';
    try {
      const data = await liveFeed(q);
      if (disposed || current !== revision) return;
      const seen = new Set();
      const rows = (Array.isArray(data?.articles) ? data.articles : [])
        .map(normalizeArticle)
        .filter(item => item && !seen.has(item.url) && seen.add(item.url))
        .slice(0, 40);
      list.innerHTML = rows.length
        ? rows.map((item, index) => storyMarkup(item, index === 0)).join('')
        : '<div class="nxn4-empty">No live publisher results matched this topic. Try another topic.</div>';
      list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => {
        if (!openExternal(button.dataset.newsUrl)) status.textContent = 'Could not open that live story safely.';
      }));
      status.textContent = `${rows.length} genuine live result${rows.length === 1 ? '' : 's'} • newest coverage first`;
    } catch (error) {
      if (disposed || current !== revision) return;
      list.innerHTML = '<div class="nxn4-empty">Live news could not connect right now. No cached, fake or invented headlines are shown.</div>';
      status.textContent = String(error?.message || 'Live news unavailable.').replace(/signal is aborted without reason/ig, 'Live connection failed').slice(0, 180);
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

  load();
  root.__cleanup = () => { disposed = true; revision += 1; };
  return root;
}

export const newsResilientRenderers = Object.freeze({ news:renderNewsResilient });
