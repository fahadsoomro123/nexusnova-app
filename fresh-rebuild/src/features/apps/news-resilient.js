import { escapeHtml } from '../../core/local-store.js';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-news-suite nx-news-pro';
  root.innerHTML = html;
  return root;
}

function safeUrl(raw, { image = false } = {}) {
  try {
    const url = new URL(String(raw || '').trim());
    if (image) return url.protocol === 'https:' ? url.href : '';
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

function parseSeen(raw) {
  const value = String(raw || '').trim();
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatSeen(raw) {
  const date = parseSeen(raw);
  if (!date) return '';
  const age = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(age / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString([], { day:'2-digit', month:'short' });
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
    country:String(item?.sourcecountry || '').trim().slice(0, 60),
    image:safeUrl(item?.socialimage || item?.image || '', { image:true })
  };
}

const styles = `
.nx-news-pro{width:100%;max-width:none;color:#f4f8fd;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.nx-news-pro *{box-sizing:border-box}.nx-news-pro button,.nx-news-pro input{font:inherit}
.nxnp-shell{display:grid;gap:11px}.nxnp-mast{position:relative;overflow:hidden;padding:18px 16px 16px;border:1px solid rgba(107,181,230,.18);border-radius:22px;background:radial-gradient(circle at 92% 8%,rgba(40,165,230,.18),transparent 36%),linear-gradient(145deg,#0a2137,#061321 62%,#040c15);box-shadow:0 16px 35px rgba(0,0,0,.22)}
.nxnp-mast:after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;background:linear-gradient(90deg,#2ac7ff,rgba(42,199,255,.05))}.nxnp-kicker{display:flex;align-items:center;gap:7px;color:#57d6ff;font-size:8px;font-weight:950;letter-spacing:.17em}.nxnp-kicker i{width:7px;height:7px;border-radius:50%;background:#35e276;box-shadow:0 0 13px rgba(53,226,118,.7)}
.nxnp-mast h2{margin:8px 0 3px;font-size:27px;line-height:.98;letter-spacing:-.045em}.nxnp-mast p{margin:7px 0 0;max-width:33rem;color:#8da4b9;font-size:11px;line-height:1.45}.nxnp-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:13px}.nxnp-controls input{width:100%;height:39px;padding:0 12px;border:1px solid rgba(94,174,226,.18);border-radius:12px;outline:0;background:#061522;color:#eef8ff}.nxnp-controls input:focus{border-color:#2aaee8;box-shadow:0 0 0 2px rgba(42,174,232,.08)}.nxnp-controls button{height:39px;padding:0 14px;border:1px solid rgba(65,184,235,.25);border-radius:12px;background:linear-gradient(145deg,#0c3857,#09243a);color:#6bdcff;font-size:8px;font-weight:950;letter-spacing:.11em}.nxnp-controls button:disabled{opacity:.55}.nxnp-status{margin:0 3px;color:#728ba2;font-size:9px;line-height:1.4}
.nxnp-grid{display:grid;gap:9px}.nxnp-feature{position:relative;overflow:hidden;min-height:238px;border:1px solid rgba(104,180,230,.17);border-radius:22px;background:linear-gradient(145deg,#0b1d2f,#050f1a);box-shadow:0 14px 32px rgba(0,0,0,.2);cursor:pointer;text-align:left}.nxnp-feature__media{position:absolute;inset:0;background:radial-gradient(circle at 75% 20%,rgba(35,171,234,.17),transparent 42%),linear-gradient(145deg,#0b2a43,#071523)}.nxnp-feature__media img{width:100%;height:100%;object-fit:cover;opacity:.56;filter:saturate(.86) contrast(1.04)}.nxnp-feature__veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,8,14,.08) 15%,rgba(2,8,14,.78) 66%,#020910 100%)}.nxnp-feature__body{position:relative;z-index:1;min-height:238px;padding:18px;display:flex;flex-direction:column;justify-content:flex-end}.nxnp-source{display:flex;align-items:center;gap:6px;color:#61d9ff;font-size:8px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.nxnp-source i{width:4px;height:4px;border-radius:50%;background:#39dfff}.nxnp-feature h3{margin:9px 0 0;max-width:620px;font-size:22px;line-height:1.12;letter-spacing:-.035em}.nxnp-feature__open{display:flex;justify-content:space-between;align-items:center;margin-top:11px;color:#9eb1c1;font-size:9px}.nxnp-feature__open b{color:#eaf8ff;font-size:18px}
.nxnp-list{display:grid;gap:7px}.nxnp-story{width:100%;display:grid;grid-template-columns:86px minmax(0,1fr) 22px;gap:10px;align-items:center;padding:8px;border:1px solid rgba(105,172,215,.13);border-radius:16px;background:linear-gradient(145deg,rgba(9,27,44,.97),rgba(4,14,25,.98));color:#f4f8fd;text-align:left;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.02)}.nxnp-thumb{height:67px;overflow:hidden;border-radius:11px;background:radial-gradient(circle at 70% 20%,rgba(48,181,237,.18),transparent 44%),linear-gradient(145deg,#0d314d,#081725);display:grid;place-items:center}.nxnp-thumb img{width:100%;height:100%;object-fit:cover}.nxnp-thumb span{font-size:20px;font-weight:950;color:#46c9fa;letter-spacing:-.06em}.nxnp-story__body{min-width:0}.nxnp-story__meta{display:flex;gap:5px;align-items:center;color:#54c9f4;font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.nxnp-story h3{margin:6px 0 0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;font-size:12px;line-height:1.3;letter-spacing:-.012em}.nxnp-arrow{color:#77a6c0;font-size:21px}.nxnp-empty{padding:26px 14px;border:1px dashed rgba(107,181,230,.16);border-radius:17px;color:#8298aa;text-align:center;font-size:11px}
@media(min-width:560px){.nxnp-list{grid-template-columns:1fr 1fr}.nxnp-story{grid-template-columns:98px minmax(0,1fr) 22px}.nxnp-thumb{height:75px}}
`;

async function fetchLiveNews(query, signal) {
  const params = new URLSearchParams({
    query,
    mode:'ArtList',
    format:'json',
    maxrecords:'40',
    sort:'DateDesc',
    timespan:'24h'
  });
  const response = await fetch(`${GDELT_DOC}?${params.toString()}`, { cache:'no-store', signal });
  if (!response.ok) throw new Error(`Live news HTTP ${response.status}`);
  return response.json();
}

export function renderNewsResilient() {
  const root = node(`<style>${styles}</style><section class="nxnp-shell">
    <header class="nxnp-mast"><div class="nxnp-kicker"><i></i><span>LIVE NEWSROOM • PUBLISHER SOURCES</span></div><h2>News</h2><p>Fresh headlines from the live publisher index. Tap any story to read it from the original source.</p><div class="nxnp-controls"><input type="search" maxlength="120" value="Pakistan" aria-label="News topic" data-news-query><button type="button" data-news-refresh>REFRESH</button></div></header>
    <p class="nxnp-status" data-news-status>Connecting to live news…</p><section class="nxnp-grid" data-news-list><div class="nxnp-empty">Loading latest headlines…</div></section>
  </section>`);

  const status = root.querySelector('[data-news-status]');
  const list = root.querySelector('[data-news-list]');
  const refresh = root.querySelector('[data-news-refresh]');
  const query = root.querySelector('[data-news-query]');
  let revision = 0;
  let disposed = false;
  let controller = null;

  const wireCards = () => {
    list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => {
      if (!openExternal(button.dataset.newsUrl)) status.textContent = 'Could not open that publisher link safely.';
    }));
    list.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.hidden = true; }, { once:true }));
  };

  const renderRows = rows => {
    if (!rows.length) { list.innerHTML = '<div class="nxnp-empty">No fresh publisher stories matched this topic. Try another search.</div>'; return; }
    const [lead, ...rest] = rows;
    const leadImage = lead.image ? `<img src="${escapeHtml(lead.image)}" alt="" loading="eager" referrerpolicy="no-referrer">` : '';
    const feature = `<button class="nxnp-feature" type="button" data-news-url="${escapeHtml(lead.url)}"><span class="nxnp-feature__media">${leadImage}</span><span class="nxnp-feature__veil"></span><span class="nxnp-feature__body"><span class="nxnp-source"><i></i>${escapeHtml(lead.domain)}${lead.country ? ` • ${escapeHtml(lead.country)}` : ''}</span><h3>${escapeHtml(lead.title)}</h3><span class="nxnp-feature__open"><span>${escapeHtml(formatSeen(lead.seen) || 'Latest')}</span><b>↗</b></span></span></button>`;
    const stories = rest.slice(0, 23).map((item, index) => {
      const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${String(index + 2).padStart(2, '0')}</span>`;
      return `<button class="nxnp-story" type="button" data-news-url="${escapeHtml(item.url)}"><span class="nxnp-thumb">${image}</span><span class="nxnp-story__body"><span class="nxnp-story__meta">${escapeHtml(item.domain)}${formatSeen(item.seen) ? ` • ${escapeHtml(formatSeen(item.seen))}` : ''}</span><h3>${escapeHtml(item.title)}</h3></span><span class="nxnp-arrow">›</span></button>`;
    }).join('');
    list.innerHTML = `${feature}<div class="nxnp-list">${stories}</div>`;
    wireCards();
  };

  const load = async () => {
    const q = query.value.trim() || 'Pakistan';
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 14_000);
    refresh.disabled = true;
    refresh.textContent = 'LIVE…';
    status.textContent = `Updating ${q} • latest 24 hours`;
    try {
      const data = await fetchLiveNews(q, controller.signal);
      if (disposed || current !== revision) return;
      const seen = new Set();
      const rows = (Array.isArray(data?.articles) ? data.articles : []).map(normalizeArticle).filter(item => {
        if (!item || seen.has(item.url)) return false;
        seen.add(item.url); return true;
      });
      renderRows(rows);
      status.textContent = `${rows.length} live publisher result${rows.length === 1 ? '' : 's'} • refreshed ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
    } catch (error) {
      if (disposed || current !== revision) return;
      const timedOut = error?.name === 'AbortError';
      list.innerHTML = `<div class="nxnp-empty">${timedOut ? 'Live news took too long to respond.' : 'Live news is temporarily unavailable.'}<br>Tap REFRESH to try again.</div>`;
      status.textContent = timedOut ? 'Live service timeout • no dummy headlines shown' : 'Live service unavailable • no dummy headlines shown';
    } finally {
      clearTimeout(timeout);
      if (!disposed && current === revision) { refresh.disabled = false; refresh.textContent = 'REFRESH'; }
    }
  };

  refresh.addEventListener('click', load);
  query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); load(); } });
  load();
  root.__cleanup = () => { disposed = true; revision += 1; controller?.abort(); };
  return root;
}

export const newsResilientRenderers = Object.freeze({ news:renderNewsResilient });
