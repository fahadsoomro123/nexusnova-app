const ARTICLES_FEED_URL = 'https://nexusnovatools.com/articles.json';
const ALLOWED_HOSTS = new Set(['nexusnovatools.com', 'www.nexusnovatools.com']);

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-articles-pro';
  root.innerHTML = html;
  return root;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeArticleUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return '';
    return url.href;
  } catch { return ''; }
}

function safeImageUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return '';
    return url.href;
  } catch { return ''; }
}

function openArticle(url) {
  const safe = safeArticleUrl(url);
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
  const url = safeArticleUrl(item.url);
  if (!title || !url) return null;
  return {
    title, url,
    description:String(item.description || '').trim().slice(0, 420),
    publishedAt:String(item.publishedAt || '').trim().slice(0, 80),
    category:String(item.category || 'Article').trim().slice(0, 80) || 'Article',
    author:String(item.author || 'NexusNova').trim().slice(0, 120) || 'NexusNova',
    image:safeImageUrl(item.image)
  };
}

function formatDate(raw) {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
}

function fallbackMark(item) {
  const cat = String(item.category || 'Article').toUpperCase();
  if (cat.includes('TECH')) return 'TECH';
  if (cat.includes('AI')) return 'AI';
  return 'NX';
}

const styles = `
.nx-articles-pro{width:100%;max-width:none;color:#f4f8fd;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.nx-articles-pro *{box-sizing:border-box}.nx-articles-pro button{font:inherit}
.nxap-shell{display:grid;gap:11px}.nxap-head{position:relative;overflow:hidden;padding:18px 16px;border:1px solid rgba(110,183,230,.17);border-radius:22px;background:radial-gradient(circle at 90% 0,rgba(52,166,226,.17),transparent 34%),linear-gradient(145deg,#0a2034,#061421 62%,#040c15);box-shadow:0 16px 34px rgba(0,0,0,.21)}.nxap-head:after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;background:linear-gradient(90deg,#44d4ff,rgba(68,212,255,.04))}.nxap-kicker{color:#5cd9ff;font-size:8px;font-weight:950;letter-spacing:.17em}.nxap-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.nxap-title-row h2{margin:8px 0 0;font-size:27px;line-height:1;letter-spacing:-.045em}.nxap-title-row button{height:34px;padding:0 13px;border:1px solid rgba(66,181,230,.24);border-radius:11px;background:#082239;color:#62d5ff;font-size:8px;font-weight:950;letter-spacing:.1em}.nxap-title-row button:disabled{opacity:.55}.nxap-head p{margin:8px 0 0;max-width:34rem;color:#8ca3b8;font-size:10px;line-height:1.5}.nxap-status{margin:0 3px;color:#768da2;font-size:9px}.nxap-grid{display:grid;gap:8px}.nxap-card{width:100%;display:grid;grid-template-columns:112px minmax(0,1fr);gap:11px;padding:8px;border:1px solid rgba(102,173,217,.13);border-radius:18px;background:linear-gradient(145deg,rgba(9,27,44,.98),rgba(4,14,25,.99));color:#f4f8fd;text-align:left;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.02),0 8px 22px rgba(0,0,0,.12)}.nxap-media{position:relative;overflow:hidden;height:96px;border-radius:13px;background:radial-gradient(circle at 65% 18%,rgba(57,183,238,.23),transparent 42%),linear-gradient(145deg,#0c344f,#061624);display:grid;place-items:center}.nxap-media img{width:100%;height:100%;object-fit:cover;padding:13px;filter:drop-shadow(0 6px 11px rgba(0,0,0,.27))}.nxap-media b{font-size:23px;color:#57d4ff;letter-spacing:-.06em}.nxap-media span{position:absolute;left:7px;bottom:7px;padding:4px 6px;border-radius:7px;background:rgba(2,11,18,.78);color:#8de6ff;font-size:6px;font-weight:950;letter-spacing:.08em}.nxap-body{min-width:0;padding:2px 3px 2px 0}.nxap-meta{color:#55c8f3;font-size:7px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.nxap-body h3{margin:6px 0 0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:13px;line-height:1.28;letter-spacing:-.018em}.nxap-body p{margin:6px 0 0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;color:#8ea3b6;font-size:9px;line-height:1.4}.nxap-open{display:flex;align-items:center;justify-content:space-between;margin-top:7px;color:#6f879a;font-size:7px}.nxap-open b{color:#8ddfff;font-size:15px}.nxap-empty{padding:28px 14px;border:1px dashed rgba(104,177,222,.16);border-radius:17px;color:#8398aa;text-align:center;font-size:11px}
@media(max-width:350px){.nxap-card{grid-template-columns:92px minmax(0,1fr)}.nxap-media{height:86px}.nxap-body h3{font-size:11.5px}.nxap-body p{font-size:8px}}
@media(min-width:620px){.nxap-grid{grid-template-columns:1fr 1fr}.nxap-card{grid-template-columns:100px minmax(0,1fr)}}
`;

export function renderArticles() {
  const root = node(`<style>${styles}</style><section class="nxap-shell"><header class="nxap-head"><div class="nxap-kicker">NEXUSNOVA • EDITORIAL</div><div class="nxap-title-row"><h2>Articles</h2><button type="button" data-articles-refresh>REFRESH</button></div><p>Fresh NexusNova guides and technology explainers, synced directly from nexusnovatools.com.</p></header><p class="nxap-status" data-articles-status>Syncing latest articles…</p><section class="nxap-grid" data-articles-list><div class="nxap-empty">Loading published articles…</div></section></section>`);

  const list = root.querySelector('[data-articles-list]');
  const status = root.querySelector('[data-articles-status]');
  const refresh = root.querySelector('[data-articles-refresh]');
  let busy = false;
  let disposed = false;
  let controller = null;

  const load = async () => {
    if (busy || disposed) return;
    busy = true;
    controller?.abort();
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 12_000);
    refresh.disabled = true;
    status.textContent = 'Loading latest published articles…';
    try {
      const response = await fetch(`${ARTICLES_FEED_URL}?v=${Date.now()}`, { cache:'no-store', headers:{ Accept:'application/json' }, signal:controller.signal });
      if (!response.ok) throw new Error(`Article feed HTTP ${response.status}`);
      const data = await response.json();
      if (disposed) return;
      const rawItems = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(rawItems)) throw new Error('Article feed format is invalid.');
      const items = rawItems.map(normalizeArticle).filter(Boolean).slice(0, 100);
      if (!items.length) {
        list.innerHTML = '<div class="nxap-empty">No published articles are available yet.</div>';
        status.textContent = 'Live article feed connected.';
        return;
      }
      list.innerHTML = items.map(item => {
        const date = formatDate(item.publishedAt);
        const media = item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : `<b>${escapeHtml(fallbackMark(item))}</b>`;
        return `<button class="nxap-card" type="button" data-article-url="${escapeHtml(item.url)}"><span class="nxap-media">${media}<span>${escapeHtml(item.category)}</span></span><span class="nxap-body"><span class="nxap-meta">${escapeHtml([date,item.author].filter(Boolean).join(' • '))}</span><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<span class="nxap-open"><span>READ ARTICLE</span><b>↗</b></span></span></button>`;
      }).join('');
      list.querySelectorAll('[data-article-url]').forEach(button => button.addEventListener('click', () => {
        if (!openArticle(button.dataset.articleUrl)) status.textContent = 'Could not open that article safely.';
      }));
      list.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
        const media = img.closest('.nxap-media');
        img.remove();
        if (media && !media.querySelector('b')) media.insertAdjacentHTML('afterbegin','<b>NX</b>');
      }, { once:true }));
      const updated = String(data?.updatedAt || '').trim();
      status.textContent = `${items.length} live article${items.length === 1 ? '' : 's'}${updated ? ` • feed ${updated}` : ''}`;
    } catch (error) {
      if (disposed) return;
      list.innerHTML = '<div class="nxap-empty">Article feed is unavailable right now.<br>Tap REFRESH to try again.</div>';
      status.textContent = error?.name === 'AbortError' ? 'Article feed timed out • no dummy content shown' : 'Live article feed unavailable • no dummy content shown';
      console.warn('[NexusNova Fresh] articles:', error);
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (!disposed) refresh.disabled = false;
    }
  };

  refresh.addEventListener('click', load);
  load();
  root.__cleanup = () => { disposed = true; controller?.abort(); };
  return root;
}

export const articleRenderers = Object.freeze({ articles:renderArticles });
