const ARTICLES_FEED_URL = 'https://nexusnovatools.com/articles.json';
const ALLOWED_HOSTS = new Set(['nexusnovatools.com', 'www.nexusnovatools.com']);

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-articles-v2';
  root.innerHTML = html;
  return root;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeSiteUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return '';
    return url.href;
  } catch { return ''; }
}

function openArticle(url) {
  const safe = safeSiteUrl(url);
  if (!safe) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:safe }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url:safe })) return true;
    window.open(safe, '_blank', 'noopener,noreferrer');
    return true;
  } catch { return false; }
}

function normalizeArticle(item) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || '').trim().slice(0, 220);
  const url = safeSiteUrl(item.url);
  if (!title || !url) return null;
  return {
    title,
    url,
    image:safeSiteUrl(item.image),
    description:String(item.description || '').trim().slice(0, 420),
    publishedAt:String(item.publishedAt || '').trim().slice(0, 80),
    modifiedAt:String(item.modifiedAt || '').trim().slice(0, 80),
    category:String(item.category || 'Article').trim().slice(0, 80) || 'Article',
    author:String(item.author || 'NexusNova').trim().slice(0, 120) || 'NexusNova'
  };
}

function formatDate(raw) {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
}

function card(item, lead = false) {
  const meta = [item.category, formatDate(item.publishedAt), item.author].filter(Boolean).join(' • ');
  return `<button class="nxa2-card${lead ? ' is-lead' : ''}" type="button" data-article-url="${escapeHtml(item.url)}">
    <span class="nxa2-thumb">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : '<b>N</b>'}</span>
    <span class="nxa2-copy"><small>${escapeHtml(item.category)}</small><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<span>${escapeHtml(meta)}</span></span>
    <i>›</i>
  </button>`;
}

export function renderArticles() {
  const root = node(`
    <style>
      .nx-articles-v2{width:100%}.nxa2-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:12px;padding:15px;border:1px solid rgba(92,177,235,.16);border-radius:20px;background:linear-gradient(145deg,rgba(8,28,47,.98),rgba(4,14,25,.98))}.nxa2-head small{display:block;color:#45d0ff;font-size:9px;font-weight:900;letter-spacing:.13em}.nxa2-head h2{margin:6px 0 4px;font-size:25px;line-height:1}.nxa2-head p{margin:0;color:#8398ad;font-size:10px}.nxa2-head button{height:38px;padding:0 15px;border:1px solid rgba(62,176,239,.32);border-radius:12px;background:#061b2d;color:#4ed2ff;font-size:9px;font-weight:900}.nxa2-list{display:grid;gap:10px}.nxa2-card{display:grid;grid-template-columns:92px minmax(0,1fr) 18px;gap:12px;align-items:center;width:100%;padding:10px;border:1px solid rgba(98,167,214,.13);border-radius:17px;background:linear-gradient(145deg,#071522,#030c15);color:inherit;text-align:left}.nxa2-card.is-lead{grid-template-columns:128px minmax(0,1fr) 20px;padding:12px;border-color:rgba(64,185,245,.25)}.nxa2-thumb{height:78px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:radial-gradient(circle at 40% 25%,#123c63,#061422);color:#58dcff;font-size:30px;font-weight:900}.nxa2-card.is-lead .nxa2-thumb{height:104px}.nxa2-thumb img{width:100%;height:100%;object-fit:cover}.nxa2-copy{min-width:0}.nxa2-copy>small{display:block;color:#42cfff;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.nxa2-copy strong{display:-webkit-box;margin-top:5px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:14px;line-height:1.25}.nxa2-card.is-lead .nxa2-copy strong{font-size:17px}.nxa2-copy p{display:-webkit-box;margin:6px 0 0;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#a4b4c4;font-size:9px;line-height:1.4}.nxa2-copy>span{display:block;margin-top:7px;color:#748ca4;font-size:8px;line-height:1.35}.nxa2-card>i{color:#5ecfff;font-size:24px;font-style:normal}@media(max-width:390px){.nxa2-card{grid-template-columns:78px minmax(0,1fr) 14px}.nxa2-card.is-lead{grid-template-columns:104px minmax(0,1fr) 14px}.nxa2-thumb{height:68px}.nxa2-card.is-lead .nxa2-thumb{height:88px}}
    </style>
    <section class="nxa2-head"><div><small>LIVE SITE SYNC</small><h2>NexusNova Articles</h2><p data-articles-status>Loading current website feed…</p></div><button type="button" data-articles-refresh>REFRESH</button></section>
    <section class="nxa2-list" data-articles-list><div class="nx-empty">Loading latest articles…</div></section>`);

  const list = root.querySelector('[data-articles-list]');
  const status = root.querySelector('[data-articles-status]');
  const refresh = root.querySelector('[data-articles-refresh]');
  let revision = 0;
  let disposed = false;

  const load = async () => {
    const current = ++revision;
    refresh.disabled = true;
    refresh.textContent = 'LOADING…';
    status.textContent = 'Syncing directly with nexusnovatools.com…';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(`${ARTICLES_FEED_URL}?v=${Date.now()}`, { cache:'no-store', headers:{ Accept:'application/json' }, signal:controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`Article feed HTTP ${response.status}`);
      const data = await response.json();
      if (disposed || current !== revision) return;
      const rawItems = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(rawItems)) throw new Error('Article feed format is invalid.');
      const items = rawItems.map(normalizeArticle).filter(Boolean).slice(0, 100);

      if (!items.length) {
        list.innerHTML = '<div class="nx-empty">No published website articles are available.</div>';
        status.textContent = 'Feed connected • no published items.';
        return;
      }

      list.innerHTML = items.map((item, index) => card(item, index === 0)).join('');
      list.querySelectorAll('[data-article-url]').forEach(button => button.addEventListener('click', () => {
        if (!openArticle(button.dataset.articleUrl)) status.textContent = 'Could not open that article safely.';
      }));
      const updated = formatDate(data?.updatedAt);
      status.textContent = `${items.length} live article${items.length === 1 ? '' : 's'}${updated ? ` • feed updated ${updated}` : ''}`;
    } catch (error) {
      if (disposed || current !== revision) return;
      list.innerHTML = '<div class="nx-empty">Website article feed is unavailable right now. No fake or stale replacement items are shown.</div>';
      status.textContent = String(error?.message || 'Article feed unavailable.').slice(0, 180);
    } finally {
      if (!disposed && current === revision) { refresh.disabled = false; refresh.textContent = 'REFRESH'; }
    }
  };

  refresh.addEventListener('click', load);
  load();
  root.__cleanup = () => { disposed = true; revision += 1; };
  return root;
}

export const articleRenderers = Object.freeze({ articles:renderArticles });
