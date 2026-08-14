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

const server = http.createServer((req, res) => {
  const pathname = String(req.url || '/').split('?')[0];

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
