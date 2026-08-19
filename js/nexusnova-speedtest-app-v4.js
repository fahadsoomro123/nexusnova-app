/* NexusNova Internet Speed Test v4
   Standalone ALL APPS utility with real Cloudflare-edge measurements.
   User-facing relocation only: the legacy Tools speed entry is hidden.
*/
(() => {
  'use strict';
  if (window.__nxSpeedTestAppV4) return;
  window.__nxSpeedTestAppV4 = true;

  const VERSION = '4.0.1';
  const TAB_ID = 'tab-speed-test';
  const MENU_ATTR = 'data-nx-speedtest-v4';
  const DOWNLOAD_BYTES = 4_000_000;
  const UPLOAD_BYTES = 1_500_000;
  const GAUGE_MAX = 1000;
  const SCALE = [0, 5, 10, 50, 100, 250, 500, 750, 1000];
  let running = false;
  let lastVisual = 0;
  let targetVisual = 0;
  let raf = 0;

  const $ = id => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const speedIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4.4 17.4a8.4 8.4 0 1 1 15.2 0"/>
      <path d="M7.4 14.4a5.4 5.4 0 0 1 9.2 0" opacity=".7"/>
      <path d="M12 17.2 17.1 10"/>
      <circle cx="12" cy="17.2" r="1.45" fill="currentColor" stroke="none"/>
    </svg>`;

  function ensureCss() {
    if (document.querySelector('link[data-nx-speedtest-app-v4]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-speedtest-app-v4.css?v=20260817-1043';
    link.dataset.nxSpeedtestAppV4 = '1';
    document.head.appendChild(link);
  }

  function hideLegacyToolsSpeed() {
    qsa('#tab-tools .nexus-tool-chip[data-tool="speed"]').forEach(button => {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
    const legacy = $('tool-speed');
    if (legacy) {
      legacy.hidden = true;
      legacy.setAttribute('aria-hidden', 'true');
      legacy.style.setProperty('display', 'none', 'important');
    }
  }

  function ensureMenuTile() {
    const menu = qs('#moreMenu .more-inner');
    if (!menu) return null;
    let tile = qs(`#moreMenu .more-item[${MENU_ATTR}="1"]`);
    if (tile) return tile;

    tile = document.createElement('button');
    tile.className = 'more-item';
    tile.type = 'button';
    tile.setAttribute(MENU_ATTR, '1');
    tile.setAttribute('onclick', "openMoreTab('speed-test')");
    tile.setAttribute('aria-label', 'Open Internet Speed Test');
    tile.innerHTML = `<span class="mi-icon">${speedIcon}</span><span>Speed Test</span>`;

    const tools = qsa('#moreMenu .more-item').find(button =>
      /openMoreTab\(\s*['"]tools['"]\s*\)/.test(String(button.getAttribute('onclick') || ''))
    );
    if (tools?.nextSibling) menu.insertBefore(tile, tools.nextSibling);
    else menu.appendChild(tile);

    tile.addEventListener('click', () => {
      document.body.classList.add('nx-speedtest-launched');
      setTimeout(syncActiveState, 20);
      setTimeout(syncActiveState, 180);
    });
    return tile;
  }

  function ensureTab() {
    let tab = $(TAB_ID);
    if (tab) return tab;
    const main = qs('main.main, main');
    if (!main) return null;

    tab = document.createElement('section');
    tab.id = TAB_ID;
    tab.className = 'tab';
    tab.dataset.speedPhase = 'idle';
    tab.innerHTML = `
      <div class="nx-allapps-back nx-speed4-back-proxy" aria-hidden="true">
        <button type="button" class="tool-btn" onclick="nexusBackToAllApps()">Back to ALL APPS</button>
      </div>

      <div class="nx-speed4-hero nxui-hero">
        <div class="nx-speed4-hero-icon">${speedIcon}</div>
        <div>
          <div class="nx-speed4-kicker">NEXUSNOVA • NETWORK</div>
          <h2>Internet Speed Test</h2>
          <p>Live download, upload, ping and jitter with a clear real-time meter.</p>
        </div>
      </div>

      <div class="nx-speed4-shell">
        <div class="nx-speed4-metrics">
          <div class="nx-speed4-metric">
            <div class="nx-speed4-metric-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v9M8.5 11.5 12 15l3.5-3.5"/></svg>
              <span>Download</span>
            </div>
            <div class="nx-speed4-metric-value"><b id="nxSpeed4Down">—</b><span>Mbps</span></div>
          </div>
          <div class="nx-speed4-metric">
            <div class="nx-speed4-metric-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 18V9M8.5 12.5 12 9l3.5 3.5"/></svg>
              <span>Upload</span>
            </div>
            <div class="nx-speed4-metric-value"><b id="nxSpeed4Up">—</b><span>Mbps</span></div>
          </div>
        </div>

        <div class="nx-speed4-latency">
          <div class="nx-speed4-mini"><i>↯</i><span>Ping <b id="nxSpeed4Ping">—</b> <small>ms</small></span></div>
          <div class="nx-speed4-mini"><i>≈</i><span>Jitter <b id="nxSpeed4Jitter">—</b> <small>ms</small></span></div>
          <div class="nx-speed4-mini"><i>◎</i><span id="nxSpeed4Network">Network</span></div>
        </div>

        <div class="nx-speed4-gauge" id="nxSpeed4Gauge" aria-label="Live internet speed meter">
          <div class="nx-speed4-ring"></div>
          <div class="nx-speed4-progress-ring"></div>
          <div class="nx-speed4-scale-labels" id="nxSpeed4Labels"></div>
          <div class="nx-speed4-needle-wrap"><div class="nx-speed4-needle" id="nxSpeed4Needle"></div></div>
          <div class="nx-speed4-live">
            <b id="nxSpeed4Live">0.00</b>
            <span id="nxSpeed4LiveUnit">Mbps</span>
          </div>
        </div>

        <div class="nx-speed4-status" id="nxSpeed4Status">Ready • tap START SPEED TEST</div>
        <div class="nx-speed4-progress"><i id="nxSpeed4Progress"></i></div>
        <button id="nxSpeed4Start" class="nx-speed4-start" type="button">START SPEED TEST</button>
        <div class="nx-speed4-foot">
          <span>Cloudflare Edge • encrypted connection</span>
          <span>Approx. 5.5 MB per full test</span>
        </div>
      </div>`;
    main.appendChild(tab);

    $('nxSpeed4Start')?.addEventListener('click', runSpeedTest);
    buildScaleLabels();
    refreshNetworkLabel();
    return tab;
  }

  function buildScaleLabels() {
    const box = $('nxSpeed4Labels');
    if (!box || box.dataset.ready === '1') return;
    box.dataset.ready = '1';
    box.innerHTML = '';
    SCALE.forEach(value => {
      const ratio = gaugeRatio(value);
      const theta = (-225 + 270 * ratio) * Math.PI / 180;
      const label = document.createElement('span');
      label.className = 'nx-speed4-scale-label' + ([0, 10, 100, 500, 1000].includes(value) ? ' major' : '');
      label.textContent = value === 1000 ? '1K' : String(value);
      label.style.left = `${50 + Math.cos(theta) * 43.2}%`;
      label.style.top = `${50 + Math.sin(theta) * 43.2}%`;
      box.appendChild(label);
    });
  }

  function refreshNetworkLabel() {
    const label = $('nxSpeed4Network');
    if (!label) return;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = String(connection?.effectiveType || connection?.type || '').trim();
    label.textContent = type ? type.toUpperCase() : 'Network';
  }

  function gaugeRatio(value) {
    const n = Math.max(0, Math.min(GAUGE_MAX, Number(value) || 0));
    return Math.log10(1 + n) / Math.log10(1 + GAUGE_MAX);
  }

  function gaugeNeedleAngle(value) {
    return -135 + 270 * gaugeRatio(value);
  }

  function animateGauge() {
    const needle = $('nxSpeed4Needle');
    const gauge = $('nxSpeed4Gauge');
    if (!needle || !gauge) {
      raf = 0;
      return;
    }
    const delta = targetVisual - lastVisual;
    lastVisual += delta * (Math.abs(delta) > 50 ? 0.26 : 0.18);
    if (Math.abs(delta) < 0.02) lastVisual = targetVisual;
    const ratio = gaugeRatio(lastVisual);
    needle.style.transform = `rotate(${gaugeNeedleAngle(lastVisual).toFixed(2)}deg)`;
    gauge.style.setProperty('--nx-speed-sweep', `${(270 * ratio).toFixed(2)}deg`);
    if (lastVisual !== targetVisual || running) raf = requestAnimationFrame(animateGauge);
    else raf = 0;
  }

  function setLiveSpeed(value, phase = 'download') {
    const numeric = Math.max(0, Number(value) || 0);
    targetVisual = numeric;
    const live = $('nxSpeed4Live');
    if (live) live.textContent = numeric < 10 ? numeric.toFixed(2) : numeric < 100 ? numeric.toFixed(1) : numeric.toFixed(0);
    const tab = $(TAB_ID);
    if (tab) tab.dataset.speedPhase = phase;
    if (!raf) raf = requestAnimationFrame(animateGauge);
  }

  function setProgress(value) {
    const bar = $('nxSpeed4Progress');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  }

  function setStatus(text) {
    const status = $('nxSpeed4Status');
    if (status) status.textContent = text;
  }

  function setMetric(id, value, digits = 1) {
    const target = $(id);
    if (!target) return;
    if (!Number.isFinite(Number(value))) target.textContent = '—';
    else target.textContent = Number(value).toFixed(digits);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function jitterFrom(samples) {
    if (samples.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < samples.length; i += 1) total += Math.abs(samples[i] - samples[i - 1]);
    return total / (samples.length - 1);
  }

  async function timedFetch(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { cache: 'no-store', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function measureLatency() {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      const started = performance.now();
      const response = await timedFetch(`https://speed.cloudflare.com/__down?bytes=0&nx=${Date.now()}-${i}`, 6500);
      if (!response.ok) throw new Error(`Ping HTTP ${response.status}`);
      await response.arrayBuffer();
      samples.push(performance.now() - started);
      setProgress(5 + ((i + 1) / 5) * 15);
    }
    return { ping: median(samples), jitter: jitterFrom(samples), samples };
  }

  async function measureDownload() {
    const response = await timedFetch(`https://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES}&nx=${Date.now()}`, 28000);
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const started = performance.now();
    let bytes = 0;
    let lastAt = started;
    let lastBytes = 0;
    let smoothed = 0;

    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      const elapsed = Math.max(1, performance.now() - started);
      const final = (buffer.byteLength * 8) / (elapsed / 1000) / 1e6;
      setLiveSpeed(final, 'download');
      setMetric('nxSpeed4Down', final, final < 10 ? 2 : 1);
      return final;
    }

    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value?.byteLength || 0;
      const now = performance.now();
      if (now - lastAt >= 75) {
        const elapsed = Math.max(1, now - started);
        const interval = Math.max(1, now - lastAt);
        const instant = ((bytes - lastBytes) * 8) / (interval / 1000) / 1e6;
        const average = (bytes * 8) / (elapsed / 1000) / 1e6;
        smoothed = smoothed ? smoothed * 0.58 + instant * 0.42 : average;
        const shown = Math.max(0, smoothed * 0.55 + average * 0.45);
        setLiveSpeed(shown, 'download');
        setMetric('nxSpeed4Down', shown, shown < 10 ? 2 : 1);
        setProgress(22 + Math.min(46, (bytes / DOWNLOAD_BYTES) * 46));
        lastAt = now;
        lastBytes = bytes;
      }
    }
    const elapsed = Math.max(1, performance.now() - started);
    const final = (bytes * 8) / (elapsed / 1000) / 1e6;
    setLiveSpeed(final, 'download');
    setMetric('nxSpeed4Down', final, final < 10 ? 2 : 1);
    return final;
  }

  function measureUpload() {
    return new Promise((resolve, reject) => {
      const payload = new Uint8Array(UPLOAD_BYTES);
      const xhr = new XMLHttpRequest();
      const started = performance.now();
      let lastAt = started;
      let lastValue = 0;
      xhr.open('POST', `https://speed.cloudflare.com/__up?bytes=${UPLOAD_BYTES}&nx=${Date.now()}`, true);
      xhr.timeout = 26000;
      xhr.upload.onprogress = event => {
        const now = performance.now();
        if (now - lastAt < 75 && event.loaded < (event.total || UPLOAD_BYTES)) return;
        const elapsed = Math.max(1, now - started);
        const value = (event.loaded * 8) / (elapsed / 1000) / 1e6;
        lastValue = value;
        setLiveSpeed(value, 'upload');
        setMetric('nxSpeed4Up', value, value < 10 ? 2 : 1);
        const total = event.lengthComputable && event.total ? event.total : UPLOAD_BYTES;
        setProgress(70 + Math.min(28, (event.loaded / total) * 28));
        lastAt = now;
      };
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Upload HTTP ${xhr.status}`));
          return;
        }
        const elapsed = Math.max(1, performance.now() - started);
        const final = (UPLOAD_BYTES * 8) / (elapsed / 1000) / 1e6;
        const value = final > 0 ? final : lastValue;
        setLiveSpeed(value, 'upload');
        setMetric('nxSpeed4Up', value, value < 10 ? 2 : 1);
        resolve(value);
      };
      xhr.send(payload);
    });
  }

  function connectionSummary(download, upload, ping) {
    if (download >= 300 && upload >= 80 && ping <= 35) return 'Excellent connection';
    if (download >= 100 && ping <= 60) return 'Very fast connection';
    if (download >= 25) return 'Good connection';
    if (download >= 8) return 'Usable connection';
    return 'Slow connection';
  }

  async function runSpeedTest() {
    if (running) return;
    ensureTab();
    const tab = $(TAB_ID);
    const start = $('nxSpeed4Start');
    running = true;
    tab?.classList.add('nx-speed4-running');
    tab?.classList.remove('nx-speed4-complete', 'nx-speed4-error');
    if (start) {
      start.disabled = true;
      start.textContent = 'TESTING…';
    }
    setMetric('nxSpeed4Down', NaN);
    setMetric('nxSpeed4Up', NaN);
    setMetric('nxSpeed4Ping', NaN);
    setMetric('nxSpeed4Jitter', NaN);
    lastVisual = 0;
    targetVisual = 0;
    setLiveSpeed(0, 'ping');
    setProgress(3);

    try {
      setStatus('PING • checking latency and stability…');
      const latency = await measureLatency();
      setMetric('nxSpeed4Ping', latency.ping, 0);
      setMetric('nxSpeed4Jitter', latency.jitter, latency.jitter < 10 ? 1 : 0);
      setProgress(20);

      setStatus('DOWNLOAD • measuring live internet speed…');
      const download = await measureDownload();
      setProgress(69);

      setStatus('UPLOAD • measuring sending speed…');
      const upload = await measureUpload();
      setProgress(100);

      const summary = connectionSummary(download, upload, latency.ping);
      setLiveSpeed(download, 'download');
      setStatus(`${summary} • Ping ${latency.ping.toFixed(0)} ms • Jitter ${latency.jitter.toFixed(1)} ms`);
      tab?.classList.add('nx-speed4-complete');
      if (start) start.textContent = 'TEST AGAIN';
    } catch (error) {
      console.warn('NexusNova Speed Test v4:', error);
      tab?.classList.add('nx-speed4-error');
      setStatus('Speed test interrupted • check your internet connection and try again.');
      if (start) start.textContent = 'TRY AGAIN';
    } finally {
      running = false;
      tab?.classList.remove('nx-speed4-running');
      if (start) start.disabled = false;
      setTimeout(() => setProgress(0), 1400);
      if (!raf) raf = requestAnimationFrame(animateGauge);
    }
  }

  function wrapLegacyShowTool() {
    const current = window.nexusShowTool;
    if (typeof current !== 'function' || current.__nxSpeedRedirectV4) return;
    const wrapped = function(id, ...args) {
      if (String(id) === 'speed') {
        ensureTab();
        if (typeof window.openMoreTab === 'function') return window.openMoreTab('speed-test');
        return false;
      }
      return current.call(this, id, ...args);
    };
    wrapped.__nxSpeedRedirectV4 = true;
    wrapped.__nxPrior = current;
    window.nexusShowTool = wrapped;
  }

  function syncActiveState() {
    const tab = $(TAB_ID);
    if (!tab) return;
    const active = tab.classList.contains('active');
    document.body.classList.toggle('nx-speedtest-open', active);
    if (active) {
      hideLegacyToolsSpeed();
      buildScaleLabels();
      refreshNetworkLabel();
      window.NexusNovaUxSimplify?.refresh?.();
    }
  }

  function installActivationObserver() {
    const tab = $(TAB_ID) || ensureTab();
    if (!tab || tab.__nxSpeed4ActivationObserver) return;
    const observer = new MutationObserver(syncActiveState);
    observer.observe(tab, { attributes:true, attributeFilter:['class'] });
    tab.__nxSpeed4ActivationObserver = observer;
  }

  function install() {
    ensureCss();
    ensureTab();
    ensureMenuTile();
    hideLegacyToolsSpeed();
    wrapLegacyShowTool();
    installActivationObserver();
    syncActiveState();
  }

  window.nexusOpenSpeedTestApp = function() {
    install();
    if (typeof window.openMoreTab === 'function') {
      const result = window.openMoreTab('speed-test');
      setTimeout(syncActiveState, 0);
      return result;
    }
    return false;
  };
  window.nexusRunInternetSpeedTest = runSpeedTest;
  window.NexusNovaSpeedTest = Object.freeze({ version: VERSION, open: window.nexusOpenSpeedTestApp, run: runSpeedTest });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  // Freeze guard: only the Speed Test tab's active-class changes need observation.
  // The old documentElement subtree/class observer reacted to every Nova Hub and
  // navigation class mutation, producing a feedback storm in Android WebView.
  window.addEventListener('nexusnova:tab-changed', event => {
    const name = String(event?.detail?.name || '').replace(/^tab-/, '');
    if (name === 'speed-test' || $(TAB_ID)?.classList.contains('active')) syncActiveState();
  });
  window.addEventListener('pageshow', syncActiveState);
  [300, 900, 1800, 3500, 7000].forEach(ms => setTimeout(install, ms));
})();
