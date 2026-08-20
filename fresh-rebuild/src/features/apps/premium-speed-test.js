import { escapeHtml } from '../../core/local-store.js';

const GAUGE_ARC = 'M 76.87 76.87 A 38 38 0 1 1 76.87 23.13';

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

function gaugeMarkup(kind, unit) {
  return `<div class="nxgauge nxgauge--${kind}">
    <div class="nxgauge__glass" aria-hidden="true"></div>
    <div class="nxgauge__grid" aria-hidden="true"></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(kind)} gauge">
      <defs>
        <linearGradient id="nxGaugeGradient-${kind}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#20a9ff"/>
          <stop offset="52%" stop-color="#75ddff"/>
          <stop offset="82%" stop-color="#39e0d1"/>
          <stop offset="100%" stop-color="#c95cff"/>
        </linearGradient>
      </defs>
      <path class="nxgauge__track" d="${GAUGE_ARC}" pathLength="100"/>
      <path class="nxgauge__fill" data-gauge-fill d="${GAUGE_ARC}" pathLength="100" style="stroke-dasharray:0 100"/>
      <g class="nxgauge__scale nxgauge__scale--speed">
        <text x="17" y="79">0</text><text x="11" y="63">1</text><text x="14" y="46">5</text>
        <text x="24" y="30">10</text><text x="42" y="20">20</text><text x="61" y="21">50</text>
        <text x="76" y="31">100</text><text x="86" y="47">250</text><text x="89" y="65">500</text><text x="80" y="81">1G</text>
      </g>
      <g class="nxgauge__needle" data-gauge-needle>
        <line x1="50" y1="51" x2="50" y2="17"/>
        <circle cx="50" cy="51" r="4.5"/>
        <circle cx="50" cy="51" r="1.65"/>
      </g>
    </svg>
    <div class="nxgauge__readout"><span data-gauge-mode>READY</span><strong data-gauge-value>0</strong><small>${escapeHtml(unit)}</small></div>
  </div>`;
}

function setGauge(root, ratio, value, mode, decimals = 1) {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  const needle = root.querySelector('[data-gauge-needle]');
  const fill = root.querySelector('[data-gauge-fill]');
  const valueEl = root.querySelector('[data-gauge-value]');
  const modeEl = root.querySelector('[data-gauge-mode]');
  const angle = -135 + safeRatio * 270;
  if (needle) needle.style.transform = `rotate(${angle}deg)`;
  if (fill) fill.style.strokeDasharray = `${(safeRatio * 100).toFixed(2)} 100`;
  if (valueEl) valueEl.textContent = Number(value || 0).toFixed(decimals);
  if (modeEl) modeEl.textContent = mode;
  root.style.setProperty('--gauge-ratio', safeRatio);
}

function median(values) {
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jitter(values) {
  if (values.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < values.length; i += 1) total += Math.abs(values[i] - values[i - 1]);
  return total / (values.length - 1);
}

function speedRatio(value) {
  return Math.log10(1 + Math.max(0, Math.min(1000, Number(value) || 0))) / Math.log10(1001);
}

export function renderSpeedTestPremium() {
  const DOWNLOAD_BYTES = 4_000_000;
  const UPLOAD_BYTES = 1_500_000;
  const root = node(`
    <section class="nxspeed-console nxspeed-console--sample-b">
      <header><div><span>NEXUSNOVA NETWORK</span><strong>Precision Speed Test</strong></div><b>METER SAMPLE B</b></header>
      <div class="nxspeed-network-state"><i></i><span data-speed-quality>READY</span></div>
      ${gaugeMarkup('speed', 'Mbps')}
      <section class="nxspeed-metrics">
        <article><span>DOWNLOAD</span><strong data-speed-down>—</strong><i></i></article>
        <article><span>UPLOAD</span><strong data-speed-up>—</strong><i></i></article>
        <article><span>PING</span><strong data-speed-ping>—</strong><i></i></article>
        <article><span>JITTER</span><strong data-speed-jitter>—</strong><i></i></article>
      </section>
      <button class="nxpi-action nxspeed-start" type="button" data-speed-start>RUN SPEED TEST</button>
      <div class="nxspeed-foot"><span>NexusNova Server • Auto Select</span><span>Live connection</span></div>
      <p class="nxpi-status" data-speed-status>Cloudflare Edge throughput test • approximately 5.5 MB per complete run.</p>
    </section>
  `, 'nx-speed-premium');

  const gauge = root.querySelector('.nxgauge');
  const down = root.querySelector('[data-speed-down]');
  const up = root.querySelector('[data-speed-up]');
  const ping = root.querySelector('[data-speed-ping]');
  const jitterEl = root.querySelector('[data-speed-jitter]');
  const qualityEl = root.querySelector('[data-speed-quality]');
  const start = root.querySelector('[data-speed-start]');
  const status = root.querySelector('[data-speed-status]');
  let running = false;

  const paintSpeed = (value, mode) => {
    const n = Math.max(0, Number(value) || 0);
    setGauge(gauge, speedRatio(n), n, mode, n < 10 ? 2 : n < 100 ? 1 : 0);
  };

  const latency = async () => {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      const t = performance.now();
      const response = await fetch(`https://speed.cloudflare.com/__down?bytes=0&nx=${Date.now()}-${i}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Ping HTTP ${response.status}`);
      await response.arrayBuffer();
      samples.push(performance.now() - t);
      paintSpeed(0, `PING ${i + 1}/5`);
    }
    return { ping:median(samples), jitter:jitter(samples) };
  };

  const download = async () => {
    const started = performance.now();
    const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES}&nx=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    let bytes = 0;
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      return (buffer.byteLength * 8) / ((performance.now() - started) / 1000) / 1e6;
    }
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value?.byteLength || 0;
      const current = (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      down.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      paintSpeed(current, 'DOWNLOAD');
    }
    return (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
  };

  const upload = () => new Promise((resolve, reject) => {
    const payload = new Uint8Array(UPLOAD_BYTES);
    const xhr = new XMLHttpRequest();
    const started = performance.now();
    xhr.open('POST', `https://speed.cloudflare.com/__up?bytes=${UPLOAD_BYTES}&nx=${Date.now()}`, true);
    xhr.timeout = 26000;
    xhr.upload.onprogress = event => {
      const current = (event.loaded * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      up.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      paintSpeed(current, 'UPLOAD');
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.ontimeout = () => reject(new Error('Upload timeout'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload HTTP ${xhr.status}`));
        return;
      }
      resolve((UPLOAD_BYTES * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6);
    };
    xhr.send(payload);
  });

  start.addEventListener('click', async () => {
    if (running) return;
    running = true;
    start.disabled = true;
    start.textContent = 'TEST IN PROGRESS';
    qualityEl.textContent = 'MEASURING';
    down.textContent = up.textContent = ping.textContent = jitterEl.textContent = '—';
    paintSpeed(0, 'CALIBRATING');
    try {
      status.textContent = 'Measuring latency and connection stability…';
      const l = await latency();
      ping.textContent = `${l.ping.toFixed(0)} ms`;
      jitterEl.textContent = `${l.jitter.toFixed(1)} ms`;

      status.textContent = 'Measuring live download throughput…';
      const d = await download();
      down.textContent = `${d < 10 ? d.toFixed(2) : d.toFixed(1)} Mbps`;

      status.textContent = 'Measuring live upload throughput…';
      const u = await upload();
      up.textContent = `${u < 10 ? u.toFixed(2) : u.toFixed(1)} Mbps`;

      const quality = d >= 300 && u >= 80 && l.ping <= 35 ? 'OPTIMAL CONNECTION'
        : d >= 100 ? 'VERY FAST'
        : d >= 25 ? 'GOOD CONNECTION'
        : d >= 8 ? 'USABLE CONNECTION'
        : 'SLOW CONNECTION';
      qualityEl.textContent = quality;
      paintSpeed(d, 'DOWNLOAD');
      status.textContent = `${quality} • ping ${l.ping.toFixed(0)} ms • jitter ${l.jitter.toFixed(1)} ms`;
      start.textContent = 'RUN AGAIN';
    } catch (error) {
      qualityEl.textContent = 'INTERRUPTED';
      status.textContent = 'Speed test interrupted. Check the connection and try again.';
      start.textContent = 'TRY AGAIN';
      console.warn('[NexusNova Premium] speed test:', error);
    } finally {
      running = false;
      start.disabled = false;
    }
  });

  return root;
}

export const premiumSpeedRenderers = Object.freeze({ 'speed-test': renderSpeedTestPremium });
