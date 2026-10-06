import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';
import { entertainmentSuiteRenderers } from './entertainment-suite.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const LIVE_PRESETS = Object.freeze([
  ['Pakistan News', 'Pakistan news live'],
  ['World News', 'world news live'],
  ['Music', 'music live radio'],
  ['Sports', 'sports live'],
  ['Business', 'business news live']
]);

function safeMediaUrl(raw, type = 'image') {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:') return '';
    if (type === 'embed') {
      const host = url.hostname.toLowerCase();
      return host === 'www.youtube-nocookie.com' || host === 'www.youtube.com' ? url.href : '';
    }
    return url.href;
  } catch { return ''; }
}

export function renderEntertainmentLiveSuite() {
  const root = entertainmentSuiteRenderers.entertainment();
  const panel = document.createElement('section');
  panel.className = 'nx-live-channel-panel';
  panel.innerHTML = `
    <div class="nx-live-channel-head">
      <div>
        <p class="nx-eyebrow">LIVE CHANNELS • PROVIDER-HOSTED</p>
        <h2>Watch live streams inside NexusNova</h2>
        <p>Discover currently-live, embeddable streams from supported official platform APIs. NexusNova does not use pirated IPTV/M3U lists.</p>
      </div>
      <span class="nx-live-pill"><i></i> LIVE</span>
    </div>
    <div class="nx-live-channel-search">
      <input type="search" maxlength="140" autocomplete="off" data-live-query placeholder="Search live news, music, sports, channel…">
      <button type="button" data-live-search>SEARCH LIVE</button>
    </div>
    <div class="nx-live-presets">${LIVE_PRESETS.map(([label, query]) => `<button type="button" data-live-preset="${escapeHtml(query)}">${escapeHtml(label)}</button>`).join('')}</div>
    <p class="nx-tool-meta" data-live-status>Choose a category or search a live channel.</p>
    <div class="nx-live-player" data-live-player hidden></div>
    <div class="nx-live-grid" data-live-results></div>
  `;
  root.prepend(panel);

  const input = panel.querySelector('[data-live-query]');
  const search = panel.querySelector('[data-live-search]');
  const status = panel.querySelector('[data-live-status]');
  const resultsBox = panel.querySelector('[data-live-results]');
  const player = panel.querySelector('[data-live-player]');
  let results = [];
  let busy = false;

  const play = index => {
    const item = results[index];
    if (!item) return;
    const embed = safeMediaUrl(item.embedUrl, 'embed');
    if (!embed) {
      status.textContent = 'This live stream is not available as a safe in-app embed.';
      return;
    }
    player.innerHTML = `
      <div class="nx-live-player-head">
        <div><span>LIVE • ${escapeHtml(item.provider || 'YouTube Live')}</span><strong>${escapeHtml(item.title || 'Live stream')}</strong><small>${escapeHtml(item.creator || '')}</small></div>
        <button type="button" data-live-close aria-label="Close live player">×</button>
      </div>
      <div class="nx-live-player-frame"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(item.title || 'Live stream')}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    player.hidden = false;
    player.querySelector('[data-live-close]')?.addEventListener('click', () => {
      player.hidden = true;
      player.replaceChildren();
    });
    player.scrollIntoView({behavior:'smooth', block:'nearest'});
  };

  const paint = () => {
    resultsBox.innerHTML = results.length ? results.map((item, index) => {
      const thumb = safeMediaUrl(item.thumbnail);
      return `
        <article class="nx-live-card">
          <button class="nx-live-card-media" type="button" data-live-play="${index}">
            ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : '<span>LIVE</span>'}
            <b><i></i> LIVE</b>
          </button>
          <div class="nx-live-card-copy">
            <span>${escapeHtml(item.creator || item.provider || 'Live channel')}</span>
            <strong>${escapeHtml(item.title || 'Live stream')}</strong>
            <button type="button" data-live-play="${index}">WATCH IN NEXUSNOVA</button>
          </div>
        </article>`;
    }).join('') : '<div class="nx-empty">No live streams matched this search.</div>';
    resultsBox.querySelectorAll('[data-live-play]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.livePlay))));
  };

  const run = async rawQuery => {
    const query = String(rawQuery || input.value || '').trim();
    if (!query) {
      status.textContent = 'Type a live channel, topic or category first.';
      input.focus();
      return;
    }
    if (busy) return;
    busy = true;
    search.disabled = true;
    search.textContent = 'SEARCHING…';
    input.value = query;
    player.hidden = true;
    player.replaceChildren();
    resultsBox.innerHTML = '<div class="nx-empty">Finding currently-live provider streams…</div>';
    status.textContent = 'Checking live provider results…';
    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchEntertainment');
      const response = await call({query, mode:'live'});
      const data = response?.data || {};
      if (data.ok !== true) throw new Error(data.message || 'Live-channel search failed.');
      results = (Array.isArray(data.results) ? data.results : []).filter(item => item.live === true && item.kind === 'video');
      paint();
      const provider = Array.isArray(data.providers) ? data.providers[0] : null;
      status.textContent = `${results.length} live stream${results.length === 1 ? '' : 's'} • ${provider?.status === 'connected' ? 'YouTube Live ready' : 'live provider key pending/unavailable'}`;
    } catch (error) {
      results = [];
      resultsBox.innerHTML = '<div class="nx-empty">Live-channel search is unavailable right now.</div>';
      const message = String(error?.message || error || '').replace(/^FirebaseError:\s*/i, '').slice(0, 220);
      status.textContent = /not-found|searchEntertainment/i.test(message)
        ? 'Live-channel backend still needs deployment/provider connection.'
        : (message || 'Live-channel search failed.');
    } finally {
      busy = false;
      search.disabled = false;
      search.textContent = 'SEARCH LIVE';
    }
  };

  panel.querySelectorAll('[data-live-preset]').forEach(button => button.addEventListener('click', () => run(button.dataset.livePreset)));
  search.addEventListener('click', () => run());
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });

  const oldCleanup = root.__cleanup;
  root.__cleanup = () => {
    player.replaceChildren();
    results = [];
    oldCleanup?.();
  };
  return root;
}

export const entertainmentLiveRenderers = Object.freeze({entertainment:renderEntertainmentLiveSuite});
