const { app, BrowserWindow, shell, session } = require('electron');
const http = require('http');
const crypto = require('crypto');

const APP_URL = 'https://fahadsoomro123.github.io/nexusnova-app/page2.html';
const TRUSTED_ORIGIN = 'https://fahadsoomro123.github.io';
const OLLAMA_ORIGIN = 'http://127.0.0.1:11434';
const GATEWAY_HOST = '127.0.0.1';
const GATEWAY_PORT = 17777;
const CFG_KEY = 'nexusnova_nova_ai_mobile_v1';
const gatewayToken = crypto.randomBytes(24).toString('hex');

let gatewayServer = null;
let activeModel = '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': TRUSTED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, X-NexusNova-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (_) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function ollamaJson(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const response = await fetch(`${OLLAMA_ORIGIN}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: ctrl.signal
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!response.ok) throw new Error(payload.error || text || `Ollama HTTP ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function modelNames(tags) {
  return Array.isArray(tags?.models)
    ? tags.models.map(item => String(item?.name || item?.model || '').trim()).filter(Boolean)
    : [];
}

async function chooseModel() {
  const tags = await ollamaJson('/api/tags');
  const names = modelNames(tags);
  const priorities = [
    /^qwen3:4b-instruct(?:$|-)/i,
    /^qwen3:4b(?:$|-)/i,
    /^gpt-oss:20b(?:$|-)/i
  ];
  for (const pattern of priorities) {
    const found = names.find(name => pattern.test(name));
    if (found) return found;
  }
  return names[0] || '';
}

function cleanReply(text) {
  let out = String(text || '');
  out = out.replace(/<think>[\s\S]*?<\/think>\s*/gi, '');
  out = out.replace(/^\s*Thinking\.\.\.[\s\S]*?\.\.\.done thinking\.\s*/i, '');
  out = out.replace(/^\s*<\/think>\s*/i, '');
  return out.trim();
}

function systemPrompt(model, mode) {
  const modeHint = mode === 'dev'
    ? 'Prioritize coding, debugging and software-engineering help.'
    : mode === 'web'
      ? 'Be explicit that live web research requires an available web/search tool; do not invent fresh facts.'
      : 'Be a concise, helpful general assistant.';
  return [
    'You are NOVA 5.7 Sol, the NexusNova assistant interface running with a local Ollama model.',
    `Underlying local model: ${model}.`,
    'Never claim to be OpenAI, ChatGPT, GPT-5, or another proprietary service.',
    'If asked what underlying model is running, state the exact Ollama model name above.',
    'Reply in the user\'s language when practical, including Roman Urdu.',
    modeHint
  ].join(' ');
}

async function handleChat(body) {
  const model = await chooseModel();
  if (!model) throw new Error('No Ollama model is installed. Install qwen3:4b-instruct or another supported model first.');
  activeModel = model;

  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const messages = [
    { role: 'system', content: systemPrompt(model, body.mode) },
    ...history
      .filter(row => row && (row.role === 'user' || row.role === 'assistant'))
      .map(row => ({ role: row.role, content: String(row.content || '').slice(0, 7000) })),
    { role: 'user', content: String(body.message || '').slice(0, 12000) }
  ];

  const result = await ollamaJson('/api/chat', {
    model,
    messages,
    stream: false,
    think: false,
    keep_alive: '10m',
    options: {
      temperature: 0.6,
      num_ctx: 4096
    }
  });

  const reply = cleanReply(result?.message?.content || result?.response || '');
  return {
    reply: reply || 'No response.',
    model,
    provider: 'ollama-local',
    github_writes: false
  };
}

function authorized(req) {
  return String(req.headers['x-nexusnova-token'] || '') === gatewayToken;
}

function startGateway() {
  if (gatewayServer) return Promise.resolve();
  gatewayServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${GATEWAY_HOST}:${GATEWAY_PORT}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      return res.end();
    }

    if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized local NOVA request.' });

    try {
      if (url.pathname === '/api/health' || url.pathname === '/api/connection-test') {
        const model = await chooseModel();
        activeModel = model;
        return sendJson(res, 200, {
          ok: Boolean(model),
          provider: 'ollama-local',
          model: model || null,
          endpoint: OLLAMA_ORIGIN
        });
      }

      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, await handleChat(body));
      }

      return sendJson(res, 404, { error: 'Unsupported local NOVA endpoint.' });
    } catch (error) {
      return sendJson(res, 503, {
        error: error?.name === 'AbortError'
          ? 'Local Ollama request timed out.'
          : String(error?.message || error || 'Local Ollama unavailable.')
      });
    }
  });

  return new Promise((resolve, reject) => {
    gatewayServer.once('error', reject);
    gatewayServer.listen(GATEWAY_PORT, GATEWAY_HOST, resolve);
  });
}

function isTrustedUrl(raw) {
  try { return new URL(raw).origin === TRUSTED_ORIGIN; }
  catch (_) { return false; }
}

function desktopBootstrapScript() {
  const endpoint = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
  return `(() => {
    try {
      const key = ${JSON.stringify(CFG_KEY)};
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...current, endpoint: ${JSON.stringify(endpoint)}, token: ${JSON.stringify(gatewayToken)}, useGateway: true }));
    } catch (_) {}

    document.body.classList.add('nova-desktop-host');
    if (!document.getElementById('novaDesktopHostStyle')) {
      const style = document.createElement('style');
      style.id = 'novaDesktopHostStyle';
      style.textContent = [
        '.nova-desktop-host .top-header,.nova-desktop-host .ticker-wrap{display:none!important}',
        '.nova-desktop-host .main{max-width:none!important;width:100%!important;padding-top:0!important}',
        '.nova-desktop-host #tab-ai{display:block!important;min-height:100vh!important}',
        '.nova-desktop-host #tab-ai .ai-main-card{min-height:100vh!important}',
        '.nova-desktop-host .tab:not(#tab-ai){display:none!important}'
      ].join('');
      document.head.appendChild(style);
    }

    const openNova = () => {
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      const ai = document.getElementById('tab-ai');
      if (ai) {
        ai.classList.add('active');
        ai.style.display = 'block';
      }
      window.dispatchEvent(new Event('resize'));
    };
    openNova();
    setTimeout(openNova, 500);
    setTimeout(openNova, 1500);
  })();`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#111214',
    title: 'NOVA 5.7 Sol',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedUrl(url)) return { action: 'allow' };
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedUrl(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(desktopBootstrapScript(), true).catch(() => {});
  });

  win.loadURL(APP_URL).catch(() => {});
  return win;
}

app.whenReady().then(async () => {
  const allowedPermissions = new Set(['media', 'fullscreen', 'clipboard-sanitized-write']);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl || webContents.getURL();
    callback(isTrustedUrl(origin) && allowedPermissions.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return isTrustedUrl(requestingOrigin || webContents?.getURL?.() || '') && allowedPermissions.has(permission);
  });

  try { await startGateway(); }
  catch (error) { console.error('NOVA local gateway unavailable:', error); }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (gatewayServer) {
    try { gatewayServer.close(); } catch (_) {}
    gatewayServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
