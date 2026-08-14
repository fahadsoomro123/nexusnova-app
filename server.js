const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const NEWS_PROXY_HOSTS = new Set([
  'news.google.com',
  'api.gdeltproject.org',
  'api.rss2json.com',
  'ktnnews.tv',
  'www.ktnnews.tv',
  'sindhtvnews.tv',
  'www.sindhtvnews.tv',
  'urdu.geo.tv',
  'urdu.arynews.tv',
  'express.pk',
  'urdu.samaa.tv',
  'urdu.dunyanews.tv',
  'jang.com.pk',
  'www.jang.com.pk',
  'www.urdupoint.com',
  'urdupoint.com'
]);

function resolvePublicFile(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent((requestUrl || '/').split('?')[0]);
  } catch (_) {
    return null;
  }

  if (pathname === '/') pathname = '/index.html';
  if (pathname.split('/').some(part => part.startsWith('.'))) return null;

  const resolved = path.resolve(ROOT, '.' + pathname);
  if (!resolved.startsWith(ROOT + path.sep)) return null;
  if (!PUBLIC_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return null;
  return resolved;
}

function sendNewsFallback(res, target) {
  let contentType = 'text/plain; charset=utf-8';
  let body = '';
  try {
    const host = new URL(target).hostname.toLowerCase();
    if (host === 'api.gdeltproject.org') {
      contentType = 'application/json; charset=utf-8';
      body = JSON.stringify({ articles: [] });
    } else if (host === 'api.rss2json.com') {
      contentType = 'application/json; charset=utf-8';
      body = JSON.stringify({ status: 'ok', items: [] });
    }
  } catch (_) {}

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-NexusNova-Proxy-Fallback': '1'
  });
  res.end(body);
}

async function handleNewsProxy(req, res) {
  if (typeof fetch !== 'function') {
    sendNewsFallback(res, '');
    return;
  }

  let target = '';
  try {
    const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
    target = requestUrl.searchParams.get('url') || '';
    const parsed = new URL(target);
    if (parsed.protocol !== 'https:' || !NEWS_PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Proxy target not allowed');
      return;
    }
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid proxy target');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 NexusNova/1.0',
        'Accept': 'application/json, application/rss+xml, application/xml, text/xml, text/html, text/plain;q=0.8, */*;q=0.5'
      }
    });

    const length = Number(upstream.headers.get('content-length') || 0);
    if (!upstream.ok || (length && length > 3 * 1024 * 1024)) {
      sendNewsFallback(res, target);
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > 3 * 1024 * 1024) {
      sendNewsFallback(res, target);
      return;
    }

    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch (_) {
    sendNewsFallback(res, target);
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer((req, res) => {
  const pathname = String(req.url || '/').split('?')[0];

  if (pathname === '/nx-news-proxy') {
    handleNewsProxy(req, res);
    return;
  }

  // Browsers request this automatically. NexusNova uses manifest icons instead,
  // so return an empty success instead of a noisy 404 during development.
  if (pathname === '/favicon.ico') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  const filePath = resolvePublicFile(req.url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NexusNova ready on http://localhost:${PORT}`);
});
