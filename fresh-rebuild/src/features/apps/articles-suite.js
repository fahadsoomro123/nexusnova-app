const ARTICLES_FEED_URL = 'https://nexusnovatools.com/articles.json';
const ALLOWED_HOSTS = new Set(['nexusnovatools.com', 'www.nexusnovatools.com']);

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
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

function safeArticleUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return '';
    return url.href;
  } catch {
    return '';
  }
}

function openArticle(url) {
  const safe = safeArticleUrl(url);
  if (!safe) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:safe }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url:safe })) {
      return true;
    }
    window.open(safe, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function normalizeArticle(item) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || '').trim().slice(0, 220);
  const url = safeArticleUrl(item.url);
  if (!title || !url) return null;
  return {
    title,
    url,
    description:String(item.description || '').trim().slice(0, 420),
    publishedAt:String(item.publishedAt || '').trim().slice(0, 80),
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

export function renderArticles() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-list-card__head">
        <div>
          <strong>NexusNova Articles</strong>
          <p class="nx-tool-meta" data-articles-status style="margin-top:3px">Loading articles from nexusnovatools.com…</p>
        </div>
        <button class="nx-secondary nx-fit" type="button" data-articles-refresh>REFRESH</button>
      </div>
    </section>
    <section class="nx-stack" data-articles-list></section>
  `);

  const list = root.querySelector('[data-articles-list]');
  const status = root.querySelector('[data-articles-status]');
  const refresh = root.querySelector('[data-articles-refresh]');
  let busy = false;

  const load = async () => {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    status.textContent = 'Loading latest NexusNova articles…';
    try {
      const response = await fetch(`${ARTICLES_FEED_URL}?v=${Date.now()}`, {
        cache:'no-store',
        headers:{ Accept:'application/json' }
      });
      if (!response.ok) throw new Error(`Article feed HTTP ${response.status}`);
      const data = await response.json();
      const rawItems = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(rawItems)) throw new Error('Article feed format is invalid.');
      const items = rawItems.map(normalizeArticle).filter(Boolean).slice(0, 100);

      if (!items.length) {
        list.innerHTML = '<div class="nx-empty">No NexusNova articles have been published yet.</div>';
        status.textContent = 'Article feed is connected • waiting for the first published article.';
        return;
      }

      list.innerHTML = items.map(item => {
        const date = formatDate(item.publishedAt);
        const meta = [item.category, date, item.author].filter(Boolean).join(' • ');
        return `<button class="nx-news-card" type="button" data-article-url="${escapeHtml(item.url)}">
          <strong>${escapeHtml(item.title)}</strong>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
          <span>${escapeHtml(meta)}</span>
        </button>`;
      }).join('');

      list.querySelectorAll('[data-article-url]').forEach(button => {
        button.addEventListener('click', () => {
          if (!openArticle(button.dataset.articleUrl)) status.textContent = 'Could not open that article safely.';
        });
      });
      status.textContent = `${items.length} website article${items.length === 1 ? '' : 's'} • automatically synced`;
    } catch (error) {
      list.innerHTML = '<div class="nx-empty">NexusNova article feed is unavailable right now.</div>';
      status.textContent = 'Could not load website articles. No fake or cached articles are shown.';
      console.warn('[NexusNova Fresh] articles:', error);
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  };

  refresh.addEventListener('click', load);
  load();
  return root;
}

export const articleRenderers = Object.freeze({ articles:renderArticles });
