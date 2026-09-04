const ARTICLES_FEED_URL = 'https://nexusnovatools.com/articles.json';
const ALLOWED_HOSTS = new Set(['nexusnovatools.com', 'www.nexusnovatools.com']);
const GENERIC_IMAGE_NAMES = ['nexusnova-logo-512.svg', 'nexusnova-logo.svg', 'logo-512.svg'];
const PAGE_SIZE = 3;

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-articles-v4';
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
  return `<span class="nxa4-topic nxa4-topic--${tone}" aria-hidden="true"><i></i><b>${mark}</b><small>${label}</small><em></em></span>`;
}

function card(item, lead = false) {
  const meta = [formatDate(item.publishedAt), item.author].filter(Boolean).join(' • ');
  const visual = item.image
    ? `<span class="nxa4-thumb"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><em>${escapeHtml(item.category)}</em></span>`
    : topicArt(item);
  return `<button class="nxa4-card${lead ? ' is-lead' : ''}" type="button" data-article-url="${escapeHtml(item.url)}">
    ${visual}
    <span class="nxa4-copy"><small>${escapeHtml(item.category)}</small><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<span>${escapeHtml(meta)}</span></span>
    <i class="nxa4-arrow">›</i>
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
      .nx-articles-fullscreen{position:relative!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;background:#03101b!important}
      .nx-articles-fullscreen>[data-app-mount]{height:100dvh!important;min-height:0!important;overflow:hidden!important}
      .nx-articles-fullscreen>.nx-app-head{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 10px)!important;right:max(10px,env(safe-area-inset-right,0px))!important;z-index:2147481000!important;width:40px!important;height:40px!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      .nx-articles-fullscreen>.nx-app-head>.nx-app-head__icon,.nx-articles-fullscreen>.nx-app-head>div{display:none!important}
      .nx-articles-fullscreen>.nx-app-head>.nx-back{position:static!important;display:grid!important;place-items:center!important;width:40px!important;height:40px!important;margin:0!important;padding:0 0 2px!important;border:1px solid rgba(151,188,224,.2)!important;border-radius:13px!important;background:rgba(8,22,38,.94)!important;color:#f7fbff!important;box-shadow:0 8px 22px rgba(0,0,0,.27),inset 0 1px rgba(255,255,255,.07)!important;font:750 29px/1 system-ui,-apple-system,"Segoe UI",sans-serif!important}
      .nx-articles-v4{box-sizing:border-box!important;width:100%!important;height:100dvh!important;min-height:0!important;padding:calc(env(safe-area-inset-top,0px) + 7px) 8px calc(env(safe-area-inset-bottom,0px) + 7px)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;gap:8px!important;overflow:hidden!important;background:#03101b!important}
      .nxa4-head{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;margin:0;padding:11px 54px 11px 12px;border:1px solid rgba(86,190,244,.22);border-radius:18px;background:radial-gradient(circle at 80% 15%,rgba(70,143,255,.13),transparent 33%),linear-gradient(145deg,#09223a,#04121f 64%,#020b13)}
      .nxa4-head:after{content:"";position:absolute;right:-40px;top:-70px;width:140px;height:140px;border:1px solid rgba(83,211,255,.09);border-radius:50%}.nxa4-head>div,.nxa4-head>button{position:relative;z-index:1}.nxa4-head small{display:flex;align-items:center;gap:6px;color:#47d4ff;font-size:7px;font-weight:900;letter-spacing:.14em}.nxa4-head small:before{content:"";width:6px;height:6px;border-radius:50%;background:#32ec72;box-shadow:0 0 10px rgba(50,236,114,.55)}.nxa4-head h2{margin:4px 0 3px;font-size:20px;line-height:1}.nxa4-head p{margin:0;overflow:hidden;color:#8da2b6;font-size:8px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}.nxa4-head button{height:34px;padding:0 11px;border:1px solid rgba(62,176,239,.32);border-radius:11px;background:rgba(4,28,47,.9);color:#55d8ff;font-size:7px;font-weight:900;letter-spacing:.04em}.nxa4-head button:disabled{opacity:.55}
      .nxa4-list{--rows:3;min-height:0;height:100%;display:grid;grid-template-rows:repeat(var(--rows),minmax(0,1fr));gap:7px;overflow:hidden}.nxa4-card{position:relative;display:grid;grid-template-columns:86px minmax(0,1fr) 15px;gap:10px;align-items:center;width:100%;height:100%;min-height:0;padding:9px;border:1px solid rgba(98,167,214,.16);border-radius:16px;background:linear-gradient(145deg,#071724,#030c15);color:inherit;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.02);overflow:hidden}.nxa4-card.is-lead{border-color:rgba(64,185,245,.32);background:radial-gradient(circle at 10% 18%,rgba(40,154,222,.09),transparent 38%),linear-gradient(145deg,#081a2a,#030c15)}
      .nxa4-thumb,.nxa4-topic{position:relative;width:100%;height:min(88px,11dvh);display:grid;place-items:center;overflow:hidden;border-radius:12px}.nxa4-thumb{background:#071d31}.nxa4-thumb img{width:100%;height:100%;object-fit:cover}.nxa4-thumb em{position:absolute;left:5px;bottom:5px;max-width:calc(100% - 10px);overflow:hidden;padding:3px 5px;border-radius:6px;background:rgba(2,10,16,.84);color:#62ddff;font-size:6px;font-style:normal;font-weight:900;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;letter-spacing:.07em}
      .nxa4-topic{isolation:isolate;background:radial-gradient(circle at 25% 18%,rgba(77,218,255,.27),transparent 38%),linear-gradient(145deg,#0b3353,#061421 70%);border:1px solid rgba(96,201,255,.13)}.nxa4-topic:before{content:"";position:absolute;inset:-26% 42% 46% -15%;border:1px solid rgba(255,255,255,.14);border-radius:50%;transform:rotate(-20deg)}.nxa4-topic i{position:absolute;right:-12px;bottom:-18px;width:62px;height:62px;border:1px solid rgba(109,213,255,.15);border-radius:50%}.nxa4-topic b{position:relative;z-index:2;color:#e9f9ff;font-size:21px;line-height:1;font-weight:900;letter-spacing:-.04em;text-shadow:0 2px 16px rgba(0,0,0,.45)}.nxa4-topic small{position:absolute;left:7px;bottom:7px;z-index:2;color:#60d9ff;font-size:5.5px;font-weight:900;letter-spacing:.11em}.nxa4-topic em{position:absolute;right:8px;top:8px;width:6px;height:6px;border:1px solid #77e4ff;border-radius:50%;box-shadow:0 0 10px rgba(72,214,255,.4)}.nxa4-topic--security{background:radial-gradient(circle at 25% 18%,rgba(68,239,174,.22),transparent 38%),linear-gradient(145deg,#0b3a3b,#061718 70%)}.nxa4-topic--game{background:radial-gradient(circle at 25% 18%,rgba(194,105,255,.24),transparent 38%),linear-gradient(145deg,#2e1746,#0b0b18 70%)}.nxa4-topic--image{background:radial-gradient(circle at 25% 18%,rgba(255,154,83,.24),transparent 38%),linear-gradient(145deg,#493019,#15100a 70%)}.nxa4-topic--ai{background:radial-gradient(circle at 25% 18%,rgba(83,125,255,.28),transparent 38%),linear-gradient(145deg,#172d62,#080d23 70%)}
      .nxa4-copy{min-width:0}.nxa4-copy>small{display:block;overflow:hidden;color:#46d1ff;font-size:7px;font-weight:900;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;letter-spacing:.08em}.nxa4-copy strong{display:-webkit-box;margin-top:4px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:13px;line-height:1.24}.nxa4-copy p{display:-webkit-box;margin:5px 0 0;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#a4b4c4;font-size:8px;line-height:1.34}.nxa4-copy>span{display:block;margin-top:5px;overflow:hidden;color:#788fa5;font-size:7px;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}.nxa4-arrow{color:#5ecfff;font-size:22px;font-style:normal}.nxa4-empty{display:grid;place-items:center;height:100%;min-height:0;padding:18px;border:1px dashed rgba(89,165,214,.18);border-radius:16px;color:#9aadc0;text-align:center;font-size:10px;line-height:1.5}
      .nxa4-pager{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;min-height:38px}.nxa4-pager[hidden]{display:none!important}.nxa4-pager button{height:36px;border:1px solid rgba(74,174,224,.24);border-radius:12px;background:linear-gradient(145deg,rgba(9,34,53,.95),rgba(4,17,29,.98));color:#71dcff;font-size:8px;font-weight:900;letter-spacing:.06em}.nxa4-pager button:last-child{justify-self:stretch}.nxa4-pager button:disabled{opacity:.35}.nxa4-pager span{min-width:70px;text-align:center;color:#9fb1c2;font-size:8px;font-weight:850;letter-spacing:.08em}
      @media(max-height:720px){.nxa4-head{padding-top:8px;padding-bottom:8px}.nxa4-head h2{font-size:18px}.nxa4-thumb,.nxa4-topic{height:min(72px,10dvh)}.nxa4-copy p{-webkit-line-clamp:1}.nxa4-card{padding:7px}.nxa4-pager{min-height:34px}.nxa4-pager button{height:32px}}
      @media(max-width:390px){.nx-articles-fullscreen>.nx-app-head{right:8px!important}.nx-articles-fullscreen>.nx-app-head>.nx-back{width:37px!important;height:37px!important}.nxa4-head{padding-right:50px}.nxa4-card{grid-template-columns:72px minmax(0,1fr) 13px;gap:8px}.nxa4-topic b{font-size:18px}.nxa4-copy strong{font-size:12px}.nxa4-copy p{font-size:7.5px}}
    </style>
    <section class="nxa4-head"><div><small>LIVE SITE SYNC</small><h2>Articles</h2><p data-articles-status>Loading current website feed…</p></div><button type="button" data-articles-refresh>REFRESH</button></section>
    <section class="nxa4-list" data-articles-list><div class="nxa4-empty">Loading latest articles…</div></section>
    <nav class="nxa4-pager" data-articles-pager hidden aria-label="Article pages"><button type="button" data-articles-prev>‹ PREV</button><span data-articles-page>1 / 1</span><button type="button" data-articles-next>NEXT ›</button></nav>`);

  const list = root.querySelector('[data-articles-list]');
  const status = root.querySelector('[data-articles-status]');
  const refresh = root.querySelector('[data-articles-refresh]');
  const pager = root.querySelector('[data-articles-pager]');
  const prev = root.querySelector('[data-articles-prev]');
  const next = root.querySelector('[data-articles-next]');
  const pageLabel = root.querySelector('[data-articles-page]');
  let revision = 0;
  let disposed = false;
  let screen = null;
  let items = [];
  let page = 0;

  queueMicrotask(() => {
    if (disposed) return;
    screen = root.closest('.nx-screen');
    screen?.classList.add('nx-articles-fullscreen');
  });

  const bindArticleButtons = () => {
    list.querySelectorAll('[data-article-url]').forEach(button => button.addEventListener('click', () => {
      if (!openArticle(button.dataset.articleUrl)) status.textContent = 'Could not open that article safely.';
    }));
  };

  const renderPage = () => {
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    page = Math.max(0, Math.min(page, pages - 1));
    const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    list.style.setProperty('--rows', String(Math.max(1, pageItems.length)));
    list.innerHTML = pageItems.length
      ? pageItems.map((item, index) => card(item, page === 0 && index === 0)).join('')
      : '<div class="nxa4-empty">No published website articles are available.</div>';
    bindArticleButtons();
    pager.hidden = items.length <= PAGE_SIZE;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
    pageLabel.textContent = `${page + 1} / ${pages}`;
  };

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
      items = rawItems.map(normalizeArticle).filter(Boolean).slice(0, 100);
      page = 0;
      renderPage();
      if (!items.length) {
        status.textContent = 'Feed connected • no published items.';
        return;
      }
      const updated = formatDate(data?.updatedAt);
      status.textContent = `${items.length} live article${items.length === 1 ? '' : 's'}${updated ? ` • feed updated ${updated}` : ''} • newest first`;
    } catch (error) {
      if (disposed || current !== revision) return;
      items = [];
      page = 0;
      list.style.setProperty('--rows', '1');
      list.innerHTML = '<div class="nxa4-empty">Website article feed is unavailable right now. No fake or stale replacement items are shown.</div>';
      pager.hidden = true;
      status.textContent = String(error?.message || 'Article feed unavailable.').replace(/signal is aborted without reason/ig, 'Article sync could not complete.').slice(0, 180);
    } finally {
      if (!disposed && current === revision) {
        refresh.disabled = false;
        refresh.textContent = 'REFRESH';
      }
    }
  };

  prev.addEventListener('click', () => { if (page > 0) { page -= 1; renderPage(); } });
  next.addEventListener('click', () => { if ((page + 1) * PAGE_SIZE < items.length) { page += 1; renderPage(); } });
  refresh.addEventListener('click', load);
  load();

  root.__cleanup = () => {
    disposed = true;
    revision += 1;
    screen?.classList.remove('nx-articles-fullscreen');
  };
  return root;
}

export const articleRenderers = Object.freeze({ articles:renderArticles });
