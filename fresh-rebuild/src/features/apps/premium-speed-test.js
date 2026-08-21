import { escapeHtml } from '../../core/local-store.js';

const GAUGE_ARC = 'M 76.87 76.87 A 38 38 0 1 1 76.87 23.13';
const WARMUP_BYTES = 1_500_000;

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
      <defs><linearGradient id="nxGaugeGradient-${kind}" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#20a9ff"/><stop offset="52%" stop-color="#75ddff"/><stop offset="82%" stop-color="#39e0d1"/><stop offset="100%" stop-color="#c95cff"/></linearGradient></defs>
      <path class="nxgauge__track" d="${GAUGE_ARC}" pathLength="100"/>
      <path class="nxgauge__fill" data-gauge-fill d="${GAUGE_ARC}" pathLength="100" style="stroke-dasharray:0 100"/>
      <g class="nxgauge__scale nxgauge__scale--speed"><text x="17" y="79">0</text><text x="11" y="63">1</text><text x="14" y="46">5</text><text x="24" y="30">10</text><text x="42" y="20">20</text><text x="61" y="21">50</text><text x="76" y="31">100</text><text x="86" y="47">250</text><text x="89" y="65">500</text><text x="80" y="81">1G</text></g>
      <g class="nxgauge__needle" data-gauge-needle><line x1="50" y1="51" x2="50" y2="17"/><circle cx="50" cy="51" r="4.5"/><circle cx="50" cy="51" r="1.65"/></g>
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
}

function median(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jitter(values) {
  if (values.length < 2) return 0;
  const diffs = [];
  for (let i = 1; i < values.length; i += 1) diffs.push(Math.abs(values[i] - values[i - 1]));
  return median(diffs);
}

function speedRatio(value) {
  return Math.log10(1 + Math.max(0, Math.min(1000, Number(value) || 0))) / Math.log10(1001);
}

function downloadBytesFor(mbps) {
  if (mbps >= 400) return 25_000_000;
  if (mbps >= 150) return 16_000_000;
  if (mbps >= 50) return 10_000_000;
  if (mbps >= 15) return 6_000_000;
  return 3_000_000;
}

function uploadBytesFor(mbps) {
  if (mbps >= 400) return 12_000_000;
  if (mbps >= 150) return 8_000_000;
  if (mbps >= 50) return 5_000_000;
  if (mbps >= 15) return 3_000_000;
  return 1_500_000;
}

export function renderSpeedTestPremium() {
  const root = node(`
    <section class="nxspeed-console nxspeed-console--sample-b">
      <header><div><span>NEXUSNOVA NETWORK</span><strong>Precision Speed Test</strong></div><b>METER SAMPLE B</b></header>
      <div class="nxspeed-network-state"><i></i><span data-speed-quality>READY</span></div>
      ${gaugeMarkup('speed', 'Mbps')}
      <section class="nxspeed-metrics" data-speed-metrics>
        <article><span>DOWNLOAD</span><strong data-speed-down>—</strong><i></i></article>
        <article><span>UPLOAD</span><strong data-speed-up>—</strong><i></i></article>
        <article><span>PING</span><strong data-speed-ping>—</strong><i></i></article>
        <article><span>JITTER</span><strong data-speed-jitter>—</strong><i></i></article>
      </section>
      <button class="nxpi-action nxspeed-start" type="button" data-speed-start>RUN SPEED TEST</button>
      <div class="nxspeed-foot"><span>NexusNova Server • Auto Select</span><span>Connection • Live</span></div>
      <p class="nxpi-status" data-speed-status>Cloudflare Edge live throughput test.</p>
    </section>
  `, 'nx-speed-premium');

  let screen = null;
  let samplePill = null;
  queueMicrotask(() => {
    screen = root.closest('.nx-screen');
    screen?.classList.add('nx-speed-screen');
    const head = screen?.querySelector(':scope > .nx-app-head');
    const h1 = head?.querySelector('h1');
    const sub = head?.querySelector('p:not(.nx-eyebrow)');
    if (h1) h1.textContent = 'Speed Test';
    if (sub) sub.textContent = 'Network speed instrument';
    if (head && !head.querySelector('.nx-speed-sample-pill')) {
      samplePill = document.createElement('span');
      samplePill.className = 'nx-speed-sample-pill';
      samplePill.textContent = 'METER SAMPLE B';
      head.appendChild(samplePill);
    }
  });

  const gauge = root.querySelector('.nxgauge');
  const glass = gauge.querySelector('.nxgauge__glass');
  const embeddedNeedleMask = gauge.querySelector('.nxgauge__grid');
  const embeddedStatusMask = document.createElement('i');
  embeddedStatusMask.setAttribute('aria-hidden', 'true');
  Object.assign(embeddedStatusMask.style, {
    position:'absolute', left:'0', top:'0', width:'43%', height:'9%', zIndex:'2', pointerEvents:'none',
    background:'linear-gradient(90deg,#07131f 0%,#07131f 72%,rgba(7,19,31,0) 100%)'
  });
  gauge.appendChild(embeddedStatusMask);

  if (glass) {
    glass.style.setProperty('display','block','important');
    glass.style.setProperty('position','absolute','important');
    glass.style.setProperty('left','50%','important');
    glass.style.setProperty('top','58%','important');
    glass.style.setProperty('width','58%','important');
    glass.style.setProperty('height','39%','important');
    glass.style.setProperty('transform','translate(-50%,-50%)','important');
    glass.style.setProperty('border-radius','50%','important');
    glass.style.setProperty('z-index','1','important');
    glass.style.setProperty('pointer-events','none','important');
    glass.style.setProperty('background','radial-gradient(ellipse at 50% 48%,#0b1b2c 0%,#081522 58%,#06101a 100%)','important');
    glass.style.setProperty('box-shadow','inset 0 0 35px rgba(0,0,0,.45),0 0 22px rgba(27,129,194,.05)','important');
  }
  if (embeddedNeedleMask) {
    embeddedNeedleMask.style.setProperty('display','block','important');
    embeddedNeedleMask.style.setProperty('position','absolute','important');
    embeddedNeedleMask.style.setProperty('left','49%','important');
    embeddedNeedleMask.style.setProperty('top','49%','important');
    embeddedNeedleMask.style.setProperty('width','32%','important');
    embeddedNeedleMask.style.setProperty('height','7%','important');
    embeddedNeedleMask.style.setProperty('transform-origin','0 50%','important');
    embeddedNeedleMask.style.setProperty('transform','rotate(-34deg)','important');
    embeddedNeedleMask.style.setProperty('border-radius','999px','important');
    embeddedNeedleMask.style.setProperty('z-index','2','important');
    embeddedNeedleMask.style.setProperty('pointer-events','none','important');
    embeddedNeedleMask.style.setProperty('background','linear-gradient(90deg,#081522 0%,#0a1b2b 72%,rgba(10,27,43,.2) 100%)','important');
    embeddedNeedleMask.style.setProperty('filter','blur(.2px)','important');
  }
  const gaugeSvg = gauge.querySelector('svg');
  if (gaugeSvg) {
    gaugeSvg.style.setProperty('position','relative','important');
    gaugeSvg.style.setProperty('z-index','3','important');
  }

  const down = root.querySelector('[data-speed-down]');
  const up = root.querySelector('[data-speed-up]');
  const ping = root.querySelector('[data-speed-ping]');
  const jitterEl = root.querySelector('[data-speed-jitter]');
  const qualityEl = root.querySelector('[data-speed-quality]');
  const start = root.querySelector('[data-speed-start]');
  const status = root.querySelector('[data-speed-status]');
  let running = false;
  let aborter = null;

  const paintSpeed = (value, mode) => {
    const n = Math.max(0, Number(value) || 0);
    setGauge(gauge, speedRatio(n), n, mode, n < 10 ? 2 : n < 100 ? 1 : 0);
  };

  const latency = async signal => {
    const samples = [];
    for (let i = 0; i < 7; i += 1) {
      const t = performance.now();
      const response = await fetch(`https://speed.cloudflare.com/__down?bytes=0&nx=${Date.now()}-${i}`, { cache:'no-store', signal });
      if (!response.ok) throw new Error(`Ping HTTP ${response.status}`);
      await response.arrayBuffer();
      samples.push(performance.now() - t);
      paintSpeed(0, `PING ${i + 1}/7`);
    }
    const stable = samples.length > 2 ? samples.slice(1) : samples;
    return { ping:median(stable), jitter:jitter(stable) };
  };

  const downloadSample = async (bytesTarget, signal, label) => {
    const started = performance.now();
    const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytesTarget}&nx=${Date.now()}-${Math.random()}`, { cache:'no-store', signal });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    let bytes = 0;
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      return (buffer.byteLength * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
    }
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value?.byteLength || 0;
      const current = (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      down.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      paintSpeed(current, label);
    }
    return (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
  };

  const download = async signal => {
    const warm = await downloadSample(WARMUP_BYTES, signal, 'WARMING UP');
    const bytesTarget = downloadBytesFor(warm);
    const samples = [];
    for (let i = 0; i < 2; i += 1) samples.push(await downloadSample(bytesTarget, signal, '↓ DOWNLOAD'));
    return median(samples);
  };

  const uploadSample = (bytesTarget, signal) => new Promise((resolve, reject) => {
    const payload = new Uint8Array(bytesTarget);
    const xhr = new XMLHttpRequest();
    const started = performance.now();
    const cleanupSignal = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once:true });
    xhr.open('POST', `https://speed.cloudflare.com/__up?bytes=${bytesTarget}&nx=${Date.now()}-${Math.random()}`, true);
    xhr.timeout = 30000;
    xhr.upload.onprogress = event => {
      const current = (event.loaded * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      up.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      paintSpeed(current, '↑ UPLOAD');
    };
    xhr.onerror = () => { cleanupSignal(); reject(new Error('Upload network error')); };
    xhr.onabort = () => { cleanupSignal(); reject(new DOMException('Aborted', 'AbortError')); };
    xhr.ontimeout = () => { cleanupSignal(); reject(new Error('Upload timeout')); };
    xhr.onload = () => {
      cleanupSignal();
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Upload HTTP ${xhr.status}`));
      resolve((bytesTarget * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6);
    };
    xhr.send(payload);
  });

  const upload = async (signal, downloadMbps) => {
    const bytesTarget = uploadBytesFor(downloadMbps);
    const samples = [];
    for (let i = 0; i < 2; i += 1) samples.push(await uploadSample(bytesTarget, signal));
    return median(samples);
  };

  start.addEventListener('click', async () => {
    if (running) return;
    running = true;
    aborter = new AbortController();
    start.disabled = true;
    start.textContent = 'TEST IN PROGRESS';
    qualityEl.textContent = 'MEASURING';
    down.textContent = up.textContent = ping.textContent = jitterEl.textContent = '—';
    paintSpeed(0, 'CALIBRATING');
    try {
      status.textContent = 'Measuring latency and connection stability…';
      const l = await latency(aborter.signal);
      ping.textContent = `${l.ping.toFixed(0)} ms`;
      jitterEl.textContent = `${l.jitter.toFixed(1)} ms`;
      status.textContent = 'Measuring sustained live download throughput…';
      const d = await download(aborter.signal);
      down.textContent = `${d < 10 ? d.toFixed(2) : d.toFixed(1)} Mbps`;
      status.textContent = 'Measuring sustained live upload throughput…';
      const u = await upload(aborter.signal, d);
      up.textContent = `${u < 10 ? u.toFixed(2) : u.toFixed(1)} Mbps`;
      const quality = d >= 300 && u >= 80 && l.ping <= 35 ? 'OPTIMAL CONNECTION' : d >= 100 ? 'VERY FAST' : d >= 25 ? 'GOOD CONNECTION' : d >= 8 ? 'USABLE CONNECTION' : 'SLOW CONNECTION';
      qualityEl.textContent = quality;
      paintSpeed(d, '↓ DOWNLOAD');
      status.textContent = `${quality} • ping ${l.ping.toFixed(0)} ms • jitter ${l.jitter.toFixed(1)} ms`;
      start.textContent = 'RUN AGAIN';
    } catch (error) {
      if (error?.name !== 'AbortError') {
        qualityEl.textContent = 'INTERRUPTED';
        status.textContent = 'Speed test interrupted. Check the connection and try again.';
        start.textContent = 'TRY AGAIN';
        console.warn('[NexusNova Premium] speed test:', error);
      }
    } finally {
      running = false;
      start.disabled = false;
      aborter = null;
    }
  });

  root.__cleanup = () => {
    aborter?.abort();
    samplePill?.remove();
    screen?.classList.remove('nx-speed-screen');
  };
  return root;
}

export const premiumSpeedRenderers = Object.freeze({ 'speed-test': renderSpeedTestPremium });
