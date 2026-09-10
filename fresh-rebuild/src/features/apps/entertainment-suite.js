import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { discoverRenderers } from './discover-apps.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const STORAGE = 'nexusnova_entertainment_recent_v2';

function recent() {
  const rows = loadJson(STORAGE, []);
  return Array.isArray(rows) ? rows.filter(row => row && row.q).slice(0, 6) : [];
}

function remember(q) {
  const clean = String(q || '').trim().slice(0, 140);
  if (!clean) return;
  saveJson(STORAGE, [{ q:clean, at:Date.now() }, ...recent().filter(row => row.q.toLowerCase() !== clean.toLowerCase())].slice(0, 6));
}

function safeMediaUrl(raw, type = 'image') {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:') return '';
    if (type === 'embed') {
      const host = url.hostname.toLowerCase();
      const allowed = host === 'www.youtube-nocookie.com'
        || host === 'www.youtube.com'
        || host === 'www.dailymotion.com'
        || host === 'geo.dailymotion.com';
      return allowed ? url.href : '';
    }
    return url.href;
  } catch { return ''; }
}

function durationText(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (!value) return '';
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function providerMessage(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'Provider status unavailable.';
  return rows.map(row => {
    if (row.status === 'connected') return `${row.provider} ready`;
    if (row.status === 'not-configured') return `${row.provider} key pending`;
    return `${row.provider} unavailable`;
  }).join(' • ');
}

export function renderEntertainmentSuite() {
  const root = discoverRenderers.entertainment();
  root.classList.add('nx-entertainment-suite');

  const shell = document.createElement('div');
  shell.className = 'nx-ent-shell';
  shell.innerHTML = `
    <section class="nx-ent-hero">
      <div class="nx-ent-hero__copy">
        <p class="nx-eyebrow">ENTERTAINMENT • DISCOVER</p>
        <h2>Movies, shows & videos — inside NexusNova</h2>
        <p>Search legal provider metadata and play officially embeddable videos without bouncing through a browser.</p>
      </div>
      <div class="nx-ent-source-row" aria-label="Connected entertainment sources">
        <span>YouTube</span><span>Dailymotion</span><span>TMDB</span>
        <span class="blocked" title="Unlicensed download/streaming sources are not connected">HDHub4u • unsupported</span>
      </div>
      <div class="nx-ent-search">
        <input type="search" maxlength="140" autocomplete="off" data-ent-query placeholder="Movie, drama, song, creator, trailer…">
        <button type="button" data-ent-search>DISCOVER</button>
      </div>
      <div class="nx-ent-filters" role="group" aria-label="Entertainment result filters">
        <button class="active" type="button" data-ent-filter="all">All</button>
        <button type="button" data-ent-filter="video">Videos</button>
        <button type="button" data-ent-filter="screen">Movies & TV</button>
      </div>
      <div class="nx-ent-recent" data-ent-recent></div>
      <p class="nx-tool-meta" data-ent-status>Ready for secure in-app discovery.</p>
    </section>

    <section class="nx-ent-player" data-ent-player hidden></section>
    <section class="nx-ent-results" data-ent-results>
      <div class="nx-empty">Search for entertainment to see live provider results.</div>
    </section>

    <section class="nx-ent-safety">
      <div><strong>Source policy</strong><span>Official / licensed integrations only</span></div>
      <p>HDHub4u was requested, but it is not connected because NexusNova does not route users to unlicensed movie-download or streaming sources.</p>
    </section>
  `;
  root.prepend(shell);

  const query = shell.querySelector('[data-ent-query]');
  const search = shell.querySelector('[data-ent-search]');
  const recentBox = shell.querySelector('[data-ent-recent]');
  const status = shell.querySelector('[data-ent-status]');
  const resultsBox = shell.querySelector('[data-ent-results]');
  const player = shell.querySelector('[data-ent-player]');
  let results = [];
  let filter = 'all';
  let busy = false;

  const drawRecent = () => {
    const rows = recent();
    recentBox.innerHTML = rows.length
      ? `<span>Recent</span>${rows.map((row, index) => `<button type="button" data-ent-recent-index="${index}">${escapeHtml(row.q)}</button>`).join('')}`
      : '<span>No recent searches yet</span>';
    recentBox.querySelectorAll('[data-ent-recent-index]').forEach(button => button.addEventListener('click', () => {
      const row = recent()[Number(button.dataset.entRecentIndex)];
      if (!row) return;
      query.value = row.q;
      run();
    }));
  };

  const visibleResults = () => results.filter(item => {
    if (filter === 'video') return item.kind === 'video';
    if (filter === 'screen') return item.kind === 'movie' || item.kind === 'tv';
    return true;
  });

  const playVideo = index => {
    const item = results[index];
    if (!item || item.kind !== 'video') return;
    const embedUrl = safeMediaUrl(item.embedUrl, 'embed');
    if (!embedUrl) {
      status.textContent = 'This provider did not return a safe embeddable player URL.';
      return;
    }
    player.innerHTML = `
      <div class="nx-ent-player__head">
        <div><span>${escapeHtml(item.provider)}</span><strong>${escapeHtml(item.title)}</strong></div>
        <button type="button" data-ent-player-close aria-label="Close player">×</button>
      </div>
      <div class="nx-ent-player__frame">
        <iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(item.title)}" loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen></iframe>
      </div>
    `;
    player.hidden = false;
    player.querySelector('[data-ent-player-close]')?.addEventListener('click', () => {
      player.hidden = true;
      player.replaceChildren();
    });
    player.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  const paint = () => {
    const rows = visibleResults();
    resultsBox.innerHTML = rows.length ? rows.map(item => {
      const originalIndex = results.indexOf(item);
      if (item.kind === 'video') {
        const thumb = safeMediaUrl(item.thumbnail);
        const duration = durationText(item.durationSeconds);
        return `
          <article class="nx-ent-card nx-ent-card--video">
            <div class="nx-ent-card__media">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : '<span>VIDEO</span>'}</div>
            <div class="nx-ent-card__body">
              <div class="nx-ent-card__meta"><span>${escapeHtml(item.provider)}</span>${duration ? `<span>${escapeHtml(duration)}</span>` : ''}</div>
              <strong>${escapeHtml(item.title || 'Video')}</strong>
              <p>${escapeHtml(item.creator || item.description || 'Official provider result')}</p>
              <button type="button" data-ent-play="${originalIndex}">PLAY IN NEXUSNOVA</button>
            </div>
          </article>`;
      }
      const poster = safeMediaUrl(item.poster);
      const rating = Number(item.rating);
      const year = String(item.date || '').slice(0, 4);
      return `
        <article class="nx-ent-card nx-ent-card--screen">
          <div class="nx-ent-card__poster">${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy">` : `<span>${item.kind === 'tv' ? 'TV' : 'MOVIE'}</span>`}</div>
          <div class="nx-ent-card__body">
            <div class="nx-ent-card__meta"><span>${item.kind === 'tv' ? 'TV SERIES' : 'MOVIE'}</span><span>TMDB</span></div>
            <strong>${escapeHtml(item.title || 'Movie / TV')}</strong>
            <p>${escapeHtml([year, rating > 0 ? `★ ${rating.toFixed(1)}` : ''].filter(Boolean).join(' • '))}</p>
            <p class="nx-ent-card__overview">${escapeHtml(item.description || 'No synopsis supplied by the metadata provider.')}</p>
          </div>
        </article>`;
    }).join('') : '<div class="nx-empty">No results match this filter.</div>';

    resultsBox.querySelectorAll('[data-ent-play]').forEach(button => button.addEventListener('click', () => playVideo(Number(button.dataset.entPlay))));
  };

  const run = async () => {
    const q = query.value.trim();
    if (!q) {
      status.textContent = 'Type a movie, show, song, creator or topic first.';
      query.focus();
      return;
    }
    if (busy) return;
    busy = true;
    search.disabled = true;
    search.textContent = 'SEARCHING…';
    player.hidden = true;
    player.replaceChildren();
    resultsBox.innerHTML = '<div class="nx-empty">Searching official entertainment sources…</div>';
    status.textContent = 'Searching connected providers…';
    remember(q);
    drawRecent();
    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchEntertainment');
      const response = await call({ query:q });
      const data = response?.data || {};
      if (data.ok !== true) throw new Error(data.message || 'Entertainment search failed.');
      results = Array.isArray(data.results) ? data.results : [];
      paint();
      status.textContent = `${results.length} real result${results.length === 1 ? '' : 's'} • ${providerMessage(data.providers)}`;
    } catch (error) {
      results = [];
      resultsBox.innerHTML = '<div class="nx-empty">Entertainment search is unavailable right now.</div>';
      const message = String(error?.message || error || '').replace(/^FirebaseError:\s*/i, '').slice(0, 240);
      status.textContent = /not-found|searchEntertainment/i.test(message)
        ? 'Entertainment backend is prepared but still needs deployment/provider connection.'
        : (message || 'Entertainment search failed.');
    } finally {
      busy = false;
      search.disabled = false;
      search.textContent = 'DISCOVER';
    }
  };

  shell.querySelectorAll('[data-ent-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.entFilter || 'all';
    shell.querySelectorAll('[data-ent-filter]').forEach(item => item.classList.toggle('active', item === button));
    paint();
  }));

  search.addEventListener('click', run);
  query.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });
  drawRecent();

  const oldCleanup = root.__cleanup;
  root.__cleanup = () => {
    player.replaceChildren();
    results = [];
    oldCleanup?.();
  };
  return root;
}

export const entertainmentSuiteRenderers = Object.freeze({ entertainment:renderEntertainmentSuite });
