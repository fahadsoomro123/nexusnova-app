const ARTICLES_FEED_URL = 'https://nexusnovatools.com/articles.json';
const ALLOWED_HOSTS = new Set(['nexusnovatools.com', 'www.nexusnovatools.com']);
const GENERIC_IMAGE_NAMES = ['nexusnova-logo-512.svg', 'nexusnova-logo.svg', 'logo-512.svg'];

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-articles-v3';
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

function imageFromItem(item) {
  const candidates = [
    item?.image,
    item?.thumbnail,
    item?.thumbnailUrl,
    item?.imageUrl,
    item?.featuredImage,
    item?.featured_image,
    item?.ogImage,
    item?.heroImage,
    item?.cover
  ];
  for (const candidate of candidates) {
    const safe = safeSiteUrl(candidate);
    if (safe) return safe;
  }
  return '';
}

function isGenericImage(url) {
  const value = String(url || '').toLowerCase();
  return !value || GENERIC_IMAGE_NAMES.some(name => value.includes(name));
}

function normalizeArticle(item) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || '').trim().slice(0, 220);
  const url = safeSiteUrl(item.url);
  if (!title || !url) return null;
  const image = imageFromItem(item);
  return {
    title,
    url,
    image:isGenericImage(image) ? '' : image,
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

function topicArt(item) {
  const text = `${item.title} ${item.category}`.toLowerCase();
  const topics = [
    [/google|search|seo|spam update/, ['GS','SEARCH','search']],
    [/youtube|thumbnail/, ['YT','VIDEO','video']],
    [/gpt|artificial intelligence|\bai\b|token|context window/, ['AI','INTELLIGENCE','ai']],
    [/windows|gaming|game|modern warfare|valorant|cs2|amd|driver/, ['GX','GAMING','game']],
    [/chrome|firefox|browser|webgpu|webassembly/, ['WB','WEB','web']],
    [/malware|security|phishing|passkey|quantum|encryption|privacy/, ['SC','SECURITY','security']],
    [/pdf|invoice|document/, ['PDF','DOCUMENT','document']],
    [/image|jpg|png|webp|avif|exif|photo|background/, ['IMG','IMAGE','image']],
    [/qr|code/, ['QR','UTILITY','utility']],
    [/typing|wpm|pomodoro|focus/, ['PX','PRODUCTIVITY','productivity']],
    [/emi|calculator|percentage|finance/, ['CAL','CALCULATE','calculate']],
    [/unix|timestamp|developer/, ['DEV','DEVELOPER','developer']],
    [/color|hex|rgb/, ['RGB','COLOR','image']]
  ];
  const matched = topics.find(([pattern]) => pattern.test(text));
  const [mark, label, tone] = matched?.[1] || ['NX','ARTICLE','default'];
  return `<span class="nxa3-topic nxa3-topic--${tone}" aria-hidden="true"><i></i><b>${mark}</b><small>${label}</small><em></em></span>`;
}

function card(item, lead = false) {
  const meta = [formatDate(item.publishedAt), item.author].filter(Boolean).join(' • ');
  const visual = item.image
    ? `<span class="nxa3-thumb"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><em>${escapeHtml(item.category)}</em></span>`
    : topicArt(item);
  return `<button class="nxa3-card${lead ? ' is-lead' : ''}" type="button" data-article-url="${escapeHtml(item.url)}">
    ${visual}
    <span class="nxa3-copy"><small>${escapeHtml(item.category)}</small><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<span>${escapeHtml(meta)}</span></span>
    <i class="nxa3-arrow">›</i>
  </button>`;
}

function withTimeout(promise, timeout, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    }, timeout);
    Promise.resolve(promise).then(value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function fetchArticles() {
  // As with News, avoid AbortController inside Android WebView. The website feed
  // is small; a UI timeout is enough and prevents false "signal aborted" errors.
  const request = fetch(`${ARTICLES_FEED_URL}?v=${Date.now()}`, {
    cache:'no-store',
    headers:{ Accept:'application/json' }
  }).then(async response => {
    if (!response.ok) throw new Error(`Article feed HTTP ${response.status}`);
    return response.json();
  });
  return withTimeout(request, 18000, 'Article sync timed out.');
}

export function renderArticles() {
  const root = node(`
    <style>
      .nx-articles-v3{width:100%}.nxa3-head{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:13px;padding:17px;border:1px solid rgba(86,190,244,.2);border-radius:22px;background:radial-gradient(circle at 82% 20%,rgba(70,143,255,.14),transparent 31%),linear-gradient(145deg,#09223a,#04121f 62%,#020b13)}.nxa3-head:after{content:"";position:absolute;right:-36px;top:-62px;width:138px;height:138px;border:1px solid rgba(83,211,255,.1);border-radius:50%}.nxa3-head>div,.nxa3-head>button{position:relative;z-index:1}.nxa3-head small{display:flex;align-items:center;gap:7px;color:#47d4ff;font-size:9px;font-weight:900;letter-spacing:.14em}.nxa3-head small:before{content:"";width:7px;height:7px;border-radius:50%;background:#32ec72;box-shadow:0 0 12px rgba(50,236,114,.65)}.nxa3-head h2{margin:7px 0 4px;font-size:27px;line-height:1}.nxa3-head p{margin:0;color:#899fb4;font-size:10px;line-height:1.45}.nxa3-head button{height:40px;padding:0 15px;border:1px solid rgba(62,176,239,.34);border-radius:13px;background:rgba(4,28,47,.9);color:#55d8ff;font-size:9px;font-weight:900}.nxa3-list{display:grid;gap:10px}.nxa3-card{position:relative;display:grid;grid-template-columns:96px minmax(0,1fr) 18px;gap:12px;align-items:center;width:100%;padding:10px;border:1px solid rgba(98,167,214,.15);border-radius:18px;background:linear-gradient(145deg,#071724,#030c15);color:inherit;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.018)}.nxa3-card.is-lead{grid-template-columns:132px minmax(0,1fr) 20px;padding:12px;border-color:rgba(64,185,245,.3);background:radial-gradient(circle at 10% 18%,rgba(40,154,222,.09),transparent 38%),linear-gradient(145deg,#081a2a,#030c15)}.nxa3-thumb,.nxa3-topic{position:relative;height:76px;display:grid;place-items:center;overflow:hidden;border-radius:13px}.nxa3-card.is-lead .nxa3-thumb,.nxa3-card.is-lead .nxa3-topic{height:100px}.nxa3-thumb{background:#071d31}.nxa3-thumb img{width:100%;height:100%;object-fit:cover}.nxa3-thumb em{position:absolute;left:6px;bottom:6px;max-width:calc(100% - 12px);overflow:hidden;padding:3px 5px;border-radius:6px;background:rgba(2,10,16,.82);color:#62ddff;font-size:6px;font-style:normal;font-weight:900;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;letter-spacing:.08em}.nxa3-topic{isolation:isolate;background:radial-gradient(circle at 25% 18%,rgba(77,218,255,.27),transparent 38%),linear-gradient(145deg,#0b3353,#061421 70%);border:1px solid rgba(96,201,255,.13)}.nxa3-topic:before{content:"";position:absolute;inset:-26% 42% 46% -15%;border:1px solid rgba(255,255,255,.14);border-radius:50%;transform:rotate(-20deg)}.nxa3-topic i{position:absolute;right:-12px;bottom:-18px;width:62px;height:62px;border:1px solid rgba(109,213,255,.15);border-radius:50%}.nxa3-topic b{position:relative;z-index:2;color:#e9f9ff;font-size:23px;line-height:1;font-weight:900;letter-spacing:-.04em;text-shadow:0 2px 16px rgba(0,0,0,.45)}.nxa3-topic small{position:absolute;left:8px;bottom:8px;z-index:2;color:#60d9ff;font-size:6px;font-weight:900;letter-spacing:.12em}.nxa3-topic em{position:absolute;right:9px;top:9px;width:7px;height:7px;border:1px solid #77e4ff;border-radius:50%;box-shadow:0 0 10px rgba(72,214,255,.4)}.nxa3-topic--security{background:radial-gradient(circle at 25% 18%,rgba(68,239,174,.22),transparent 38%),linear-gradient(145deg,#0b3a3b,#061718 70%)}.nxa3-topic--game{background:radial-gradient(circle at 25% 18%,rgba(194,105,255,.24),transparent 38%),linear-gradient(145deg,#2e1746,#0b0b18 70%)}.nxa3-topic--image{background:radial-gradient(circle at 25% 18%,rgba(255,154,83,.24),transparent 38%),linear-gradient(145deg,#493019,#15100a 70%)}.nxa3-topic--ai{background:radial-gradient(circle at 25% 18%,rgba(83,125,255,.28),transparent 38%),linear-gradient(145deg,#172d62,#080d23 70%)}.nxa3-copy{min-width:0}.nxa3-copy>small{display:block;overflow:hidden;color:#46d1ff;font-size:8px;font-weight:900;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;letter-spacing:.09em}.nxa3-copy strong{display:-webkit-box;margin-top:5px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:14px;line-height:1.28}.nxa3-card.is-lead .nxa3-copy strong{font-size:17px}.nxa3-copy p{display:-webkit-box;margin:6px 0 0;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#a4b4c4;font-size:9px;line-height:1.4}.nxa3-copy>span{display:block;margin-top:7px;color:#788fa5;font-size:8px;line-height:1.35}.nxa3-arrow{color:#5ecfff;font-size:24px;font-style:normal}.nxa3-empty{padding:42px 18px;border:1px dashed rgba(89,165,214,.18);border-radius:18px;color:#9aadc0;text-align:center;font-size:11px;line-height:1.6}@media(max-width:390px){.nxa3-card{grid-template-columns:78px minmax(0,1fr) 14px}.nxa3-card.is-lead{grid-template-columns:105px minmax(0,1fr) 14px}.nxa3-thumb,.nxa3-topic{height:66px}.nxa3-card.is-lead .nxa3-thumb,.nxa3-card.is-lead .nxa3-topic{height:86px}.nxa3-head h2{font-size:24px}.nxa3-topic b{font-size:20px}}
    </style>
    <section class="nxa3-head"><div><small>LIVE SITE SYNC</small><h2>NexusNova Articles</h2><p data-articles-status>Loading current website feed…</p></div><button type="button" data-articles-refresh>REFRESH</button></section>
    <section class="nxa3-list" data-articles-list><div class="nxa3-empty">Loading latest articles…</div></section>`);

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
      const data = await fetchArticles();
      if (disposed || current !== revision) return;
      const rawItems = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(rawItems)) throw new Error('Article feed format is invalid.');
      const items = rawItems.map(normalizeArticle).filter(Boolean).slice(0, 100);

      if (!items.length) {
        list.innerHTML = '<div class="nxa3-empty">No published website articles are available.</div>';
        status.textContent = 'Feed connected • no published items.';
        return;
      }

      list.innerHTML = items.map((item, index) => card(item, index === 0)).join('');
      list.querySelectorAll('[data-article-url]').forEach(button => button.addEventListener('click', () => {
        if (!openArticle(button.dataset.articleUrl)) status.textContent = 'Could not open that article safely.';
      }));
      const updated = formatDate(data?.updatedAt);
      status.textContent = `${items.length} live article${items.length === 1 ? '' : 's'}${updated ? ` • feed updated ${updated}` : ''} • newest first`;
    } catch (error) {
      if (disposed || current !== revision) return;
      list.innerHTML = '<div class="nxa3-empty">Website article feed is unavailable right now. No fake or stale replacement items are shown.</div>';
      status.textContent = String(error?.message || 'Article feed unavailable.').replace(/signal is aborted without reason/ig, 'Article sync could not complete.').slice(0, 180);
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
