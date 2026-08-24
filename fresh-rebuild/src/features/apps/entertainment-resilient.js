import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const SEPIA_SEARCH = 'https://sepiasearch.org/api/v1/search/videos';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-entertainment-suite';
  root.innerHTML = html;
  return root;
}

function httpsUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function safeEmbed(item) {
  const raw = httpsUrl(item?.embedUrl);
  if (raw) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const youtube = (host === 'www.youtube-nocookie.com' || host === 'www.youtube.com') && /^\/embed\/[A-Za-z0-9_-]{6,20}/.test(url.pathname);
      const dailymotion = (host === 'www.dailymotion.com' || host === 'geo.dailymotion.com') && /\/embed\/video\/[A-Za-z0-9]+/.test(url.pathname);
      if (youtube || dailymotion) return url.href;
    } catch {}
  }

  if (!String(item?.provider || '').startsWith('PeerTube')) return '';
  const source = httpsUrl(item?.externalUrl);
  const id = String(item?.id || '').trim();
  if (!source || !/^[0-9a-f-]{20,50}$/i.test(id)) return '';
  try {
    const origin = new URL(source).origin;
    return `${origin}/videos/embed/${encodeURIComponent(id)}`;
  } catch { return ''; }
}

function directPeerTubeResult(item) {
  const id = String(item?.uuid || '').trim();
  const externalUrl = httpsUrl(item?.url);
  if (!id || !externalUrl) return null;
  let origin = '';
  try { origin = new URL(externalUrl).origin; } catch { return null; }
  const imagePath = String(item?.thumbnailPath || item?.previewPath || '').trim();
  let thumbnail = '';
  try { thumbnail = imagePath ? new URL(imagePath, origin).href : ''; } catch {}
  return {
    kind:'video',
    provider:'PeerTube / Sepia Search',
    live:item?.isLive === true,
    id,
    title:String(item?.name || 'PeerTube video').slice(0, 220),
    creator:String(item?.account?.displayName || item?.account?.name || item?.channel?.displayName || new URL(externalUrl).hostname).slice(0, 120),
    description:String(item?.description || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    durationSeconds:Number(item?.duration) || 0,
    thumbnail,
    externalUrl
  };
}

async function directPeerTubeSearch(query, signal) {
  const params = new URLSearchParams({ search:query, start:'0', count:'18', sort:'-match', nsfw:'false' });
  const response = await fetch(`${SEPIA_SEARCH}?${params}`, { cache:'no-store', signal, headers:{ Accept:'application/json' } });
  if (!response.ok) throw new Error(`PeerTube search HTTP ${response.status}`);
  const json = await response.json();
  return (Array.isArray(json?.data) ? json.data : []).map(directPeerTubeResult).filter(Boolean);
}

function durationText(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function openExternal(raw) {
  const url = httpsUrl(raw);
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

export function renderEntertainmentResilient() {
  const root = node(`
    <section class="nx-ent-shell">
      <section class="nx-ent-hero">
        <div class="nx-ent-hero__copy">
          <p class="nx-eyebrow">ENTERTAINMENT • REAL SOURCES</p>
          <h2>Discover videos, movies & live streams</h2>
          <p>Secure providers are used when configured. Discover also has a real federated PeerTube fallback instead of showing fake results.</p>
        </div>
        <div class="nx-ent-source-row"><span>PeerTube</span><span>YouTube</span><span>TMDB</span><span>Dailymotion</span></div>
        <div class="nx-ent-search">
          <input type="search" maxlength="140" autocomplete="off" data-ent-query placeholder="Song, drama, creator, trailer, topic…">
          <button type="button" data-ent-search>DISCOVER</button>
        </div>
        <div class="nx-ent-filters">
          <button class="active" type="button" data-ent-mode="discover">DISCOVER</button>
          <button type="button" data-ent-mode="live">LIVE</button>
        </div>
        <p class="nx-tool-meta" data-ent-status>Ready. Discover can fall back to real PeerTube search if the Firebase provider backend is unavailable.</p>
      </section>
      <section class="nx-ent-player" data-ent-player hidden></section>
      <section class="nx-ent-results" data-ent-results><div class="nx-empty">Search to load real entertainment results.</div></section>
      <section class="nx-ent-safety"><div><strong>Source policy</strong><span>Real provider data only</span></div><p>No fabricated videos, movie metadata, views or live status.</p></section>
    </section>`);

  const input = root.querySelector('[data-ent-query]');
  const search = root.querySelector('[data-ent-search]');
  const status = root.querySelector('[data-ent-status]');
  const resultsBox = root.querySelector('[data-ent-results]');
  const player = root.querySelector('[data-ent-player]');
  let mode = 'discover';
  let rows = [];
  let revision = 0;
  let controller = null;
  let disposed = false;

  const closePlayer = () => { player.hidden = true; player.replaceChildren(); };

  const play = index => {
    const item = rows[index];
    if (!item || item.kind !== 'video') return;
    const embed = safeEmbed(item);
    if (!embed) {
      if (openExternal(item.externalUrl)) status.textContent = 'This provider video opened in the secure browser because an in-app embed was unavailable.';
      else status.textContent = 'This provider did not return a safe playable URL.';
      return;
    }
    player.innerHTML = `<div class="nx-ent-player__head"><div><span>${escapeHtml(item.provider || 'Video')}</span><strong>${escapeHtml(item.title || 'Video')}</strong></div><button type="button" data-ent-close aria-label="Close player">×</button></div><div class="nx-ent-player__frame"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(item.title || 'Video')}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    player.hidden = false;
    player.querySelector('[data-ent-close]')?.addEventListener('click', closePlayer);
    player.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  const paint = () => {
    resultsBox.innerHTML = rows.length ? rows.map((item, index) => {
      if (item.kind === 'video') {
        const thumb = httpsUrl(item.thumbnail);
        const duration = durationText(item.durationSeconds);
        return `<article class="nx-ent-card nx-ent-card--video"><div class="nx-ent-card__media">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : '<span>VIDEO</span>'}</div><div class="nx-ent-card__body"><div class="nx-ent-card__meta"><span>${escapeHtml(item.provider || 'Video')}</span>${item.live ? '<span>LIVE</span>' : ''}${duration ? `<span>${escapeHtml(duration)}</span>` : ''}</div><strong>${escapeHtml(item.title || 'Video')}</strong><p>${escapeHtml(item.creator || item.description || 'Real provider result')}</p><button type="button" data-ent-play="${index}">${safeEmbed(item) ? 'PLAY IN NEXUSNOVA' : 'OPEN VIDEO'}</button></div></article>`;
      }
      const poster = httpsUrl(item.poster);
      const year = String(item.date || '').slice(0, 4);
      const rating = Number(item.rating);
      return `<article class="nx-ent-card nx-ent-card--screen"><div class="nx-ent-card__poster">${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy">` : `<span>${item.kind === 'tv' ? 'TV' : 'MOVIE'}</span>`}</div><div class="nx-ent-card__body"><div class="nx-ent-card__meta"><span>${escapeHtml(item.provider || 'Metadata')}</span></div><strong>${escapeHtml(item.title || 'Movie / TV')}</strong><p>${escapeHtml([year, rating > 0 ? `★ ${rating.toFixed(1)}` : ''].filter(Boolean).join(' • '))}</p><p class="nx-ent-card__overview">${escapeHtml(item.description || 'Provider metadata result.')}</p></div></article>`;
    }).join('') : '<div class="nx-empty">No real results were returned for this search.</div>';
    resultsBox.querySelectorAll('[data-ent-play]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.entPlay))));
  };

  const run = async () => {
    const query = input.value.trim();
    if (!query) { status.textContent = 'Type something to search first.'; input.focus(); return; }
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    closePlayer();
    search.disabled = true;
    search.textContent = mode === 'live' ? 'CHECKING LIVE…' : 'SEARCHING…';
    resultsBox.innerHTML = '<div class="nx-empty">Loading real provider results…</div>';
    status.textContent = 'Trying secure NexusNova providers…';

    let backendError = null;
    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchEntertainment');
      const response = await call({ query, mode });
      if (disposed || current !== revision) return;
      const data = response?.data || {};
      if (data.ok !== true) throw new Error(data.message || 'Entertainment backend failed.');
      rows = Array.isArray(data.results) ? data.results : [];
      if (rows.length || mode === 'live') {
        paint();
        const providers = (Array.isArray(data.providers) ? data.providers : []).map(row => `${row.provider}: ${row.status}`).join(' • ');
        status.textContent = rows.length ? `${rows.length} real result${rows.length === 1 ? '' : 's'} • ${providers}` : `No live streams returned • ${providers || 'provider responded'}`;
        return;
      }
    } catch (error) {
      backendError = error;
      if (disposed || current !== revision) return;
    }

    if (mode === 'live') {
      rows = [];
      paint();
      status.textContent = `Live provider unavailable: ${String(backendError?.message || 'YouTube Live backend/key is not ready.').replace(/^FirebaseError:\s*/i, '').slice(0, 220)}`;
      return;
    }

    try {
      status.textContent = 'Secure backend unavailable; using real federated PeerTube fallback…';
      rows = await directPeerTubeSearch(query, controller.signal);
      if (disposed || current !== revision) return;
      paint();
      status.textContent = `${rows.length} real PeerTube result${rows.length === 1 ? '' : 's'} • direct fallback active`;
    } catch (error) {
      if (disposed || current !== revision || error?.name === 'AbortError') return;
      rows = [];
      paint();
      status.textContent = `Entertainment providers unavailable: ${String(error?.message || backendError?.message || 'network error').slice(0, 220)}`;
    } finally {
      if (!disposed && current === revision) { search.disabled = false; search.textContent = mode === 'live' ? 'SEARCH LIVE' : 'DISCOVER'; }
    }
  };

  root.querySelectorAll('[data-ent-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.entMode === 'live' ? 'live' : 'discover';
    root.querySelectorAll('[data-ent-mode]').forEach(item => item.classList.toggle('active', item === button));
    search.textContent = mode === 'live' ? 'SEARCH LIVE' : 'DISCOVER';
    closePlayer();
    rows = [];
    resultsBox.innerHTML = `<div class="nx-empty">${mode === 'live' ? 'Search YouTube Live when the secure provider is configured.' : 'Search real provider and PeerTube results.'}</div>`;
  }));
  search.addEventListener('click', run);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); run(); } });

  root.__cleanup = () => {
    disposed = true;
    revision += 1;
    controller?.abort();
    closePlayer();
    rows = [];
  };
  return root;
}

export const entertainmentResilientRenderers = Object.freeze({ entertainment:renderEntertainmentResilient });
