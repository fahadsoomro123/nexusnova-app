/* NexusNova NOVA AI V6 secure connection diagnostic.
 * Isolated, test-first layer: verifies HTTPS gateway reachability and then
 * performs one authenticated /api/chat request without changing normal chat flow.
 */
(() => {
  'use strict';
  if (window.__nxNovaAIV6ConnectionTestV1) return;
  window.__nxNovaAIV6ConnectionTestV1 = true;

  const CFG_KEY = 'nexusnova_nova_ai_mobile_v1';
  const TEST_MESSAGE = 'NEXUSNOVA_V6_CONNECTION_TEST. Reply briefly that the connection is working.';

  function readCfg() {
    try {
      return { mode: 'chat', endpoint: '', token: '', useGateway: true, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') };
    } catch (_) {
      return { mode: 'chat', endpoint: '', token: '', useGateway: true };
    }
  }

  function saveCfg(patch) {
    const next = { ...readCfg(), ...patch };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function normalizeEndpoint(value) {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) throw new Error('Endpoint missing.');
    try {
      const u = new URL(raw);
      const local = ['localhost', '127.0.0.1'].includes(u.hostname);
      if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) {
        throw new Error('Use HTTPS for phone connection.');
      }
      return u.origin + u.pathname.replace(/\/$/, '');
    } catch (error) {
      throw new Error(error.message || 'Invalid endpoint.');
    }
  }

  async function fetchJson(url, options, timeout) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, cache: 'no-store', signal: ctrl.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Connection timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function run(endpointValue, tokenValue) {
    const endpoint = normalizeEndpoint(endpointValue);
    const token = String(tokenValue || '').trim();
    if (!token) throw new Error('Pairing token missing.');

    saveCfg({ endpoint, token, useGateway: true });

    const health = await fetchJson(endpoint + '/health', { method: 'GET' }, 10000);
    const chat = await fetchJson(endpoint + '/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NexusNova-Token': token
      },
      body: JSON.stringify({
        message: TEST_MESSAGE,
        mode: 'chat',
        history: [],
        app_context: 'NexusNova mobile V6 secure connection diagnostic. No GitHub write action requested.',
        connection_test: true
      })
    }, 180000);

    const reply = String(chat.reply || '').trim();
    if (!reply) throw new Error('Gateway responded but NOVA V6 returned no reply.');

    return {
      model: chat.model || health.model || 'NOVA V6',
      githubWrites: Boolean(chat.github_writes ?? health.github_writes),
      reply
    };
  }

  async function handleTest(button) {
    const sheet = button.closest('.nx-nova-sheet-backdrop');
    if (!sheet || button.disabled) return;
    const endpoint = sheet.querySelector('#nxNovaEndpoint')?.value || '';
    const token = sheet.querySelector('#nxNovaToken')?.value || '';
    const status = sheet.querySelector('#nxNovaSheetStatus');
    const previous = button.textContent;

    button.disabled = true;
    button.textContent = 'Testing V6…';
    if (status) status.textContent = 'Testing gateway, pairing token and Ollama response…';

    try {
      const result = await run(endpoint, token);
      if (status) {
        status.textContent = `Secure V6 connected • ${result.model} • gateway + authenticated request + Ollama OK • GitHub writes ${result.githubWrites ? 'ON' : 'OFF'}`;
      }
      const subtitle = document.getElementById('nxNovaAISubtitle');
      if (subtitle) subtitle.textContent = `Local ${result.model} • V6 verified`;
    } catch (error) {
      if (status) status.textContent = `V6 connection failed: ${error.message || error}`;
    } finally {
      button.disabled = false;
      button.textContent = previous || 'Test connection';
    }
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-test]');
    if (!button || !button.closest('.nx-nova-sheet-backdrop')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleTest(button);
  }, true);

  window.NexusNovaV6ConnectionTest = { run, version: '1.0.0' };
})();
