import { escapeHtml } from '../../core/local-store.js';

const GAUGE_ARC = 'M 76.87 76.87 A 38 38 0 1 1 76.87 23.13';
const WARMUP_BYTES = 1_500_000;
const SPEED_MARKS = [0,1,5,10,20,50,100,250,500,1000];

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

function speedPolar(radius, ratio) {
  const degree = -135 + Math.max(0,Math.min(1,ratio)) * 270;
  const angle = (degree - 90) * Math.PI / 180;
  return [50 + Math.cos(angle) * radius, 51 + Math.sin(angle) * radius];
}

function speedFaceMarkup() {
  const decorativeTicks = [];
  for (let i = 0; i <= 54; i += 1) {
    const ratio = i / 54;
    const outer = speedPolar(43.2, ratio);
    const inner = speedPolar(i % 6 === 0 ? 38.6 : i % 3 === 0 ? 40.2 : 41.2, ratio);
    decorativeTicks.push(`<line x1="${outer[0].toFixed(2)}" y1="${outer[1].toFixed(2)}" x2="${inner[0].toFixed(2)}" y2="${inner[1].toFixed(2)}" stroke="${ratio > .78 ? '#b950ff' : ratio > .52 ? '#36d9ff' : '#7597ad'}" stroke-width="${i % 6 === 0 ? .75 : .3}" opacity="${i % 6 === 0 ? .9 : .52}"/>`);
  }
  const labels = SPEED_MARKS.map(value => {
    const ratio = speedRatio(value);
    const [x,y] = speedPolar(34.5,ratio);
    const label = value === 1000 ? '1G' : String(value);
    return `<text x="${x.toFixed(2)}" y="${(y+1.45).toFixed(2)}" text-anchor="middle" fill="#f2f7fa" font-size="4" font-weight="760">${label}</text>`;
  }).join('');
  const rays = [14,23,32,41,50,59,68,77,86].map(x => `<line x1="50" y1="75" x2="${x}" y2="91" stroke="#27b8ff" stroke-width=".3" opacity=".28"/>`).join('');
  const floor = [78,82,86,90].map((y,index) => `<path d="M ${16+index*4} ${y} Q 50 ${y-4-index} ${84-index*4} ${y}" fill="none" stroke="${index > 1 ? '#8b4dff' : '#31cfff'}" stroke-width=".28" opacity=".25"/>`).join('');

  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <defs>
      <radialGradient id="nxSpeedInner" cx="50%" cy="47%" r="58%"><stop offset="0" stop-color="#0c2236"/><stop offset=".52" stop-color="#071523"/><stop offset="1" stop-color="#040b13"/></radialGradient>
      <linearGradient id="nxSpeedArc" x1="0" y1=".4" x2="1" y2=".8"><stop offset="0" stop-color="#35ccff"/><stop offset=".58" stop-color="#46dfff"/><stop offset="1" stop-color="#a847ff"/></linearGradient>
      <filter id="nxSpeedArcGlow"><feGaussianBlur stdDeviation="1.25"/></filter>
    </defs>
    <path d="M12 77 A43 43 0 1 1 88 77 L88 91 Q50 96 12 91 Z" fill="url(#nxSpeedInner)" stroke="#12304b" stroke-width=".7"/>
    <path d="M15 78 A40 40 0 1 1 85 78" fill="none" stroke="url(#nxSpeedArc)" stroke-width="2.1" opacity=".32" filter="url(#nxSpeedArcGlow)"/>
    <path d="M15 78 A40 40 0 1 1 85 78" fill="none" stroke="url(#nxSpeedArc)" stroke-width=".55" opacity=".9"/>
    <g>${decorativeTicks.join('')}</g>
    <g font-family="Arial,system-ui,sans-serif">${labels}</g>
    <g>${rays}${floor}</g>
  </svg>`;
}

function prepareLiveSpeedFace(gauge) {
  const glass = gauge.querySelector('.nxgauge__glass');
  const grid = gauge.querySelector('.nxgauge__grid');
  const oldScale = gauge.querySelector('.nxgauge__scale--speed');
  const track = gauge.querySelector('.nxgauge__track');
  const fill = gauge.querySelector('.nxgauge__fill');
  if (glass) glass.style.setProperty('display','none','important');
  if (grid) grid.style.setProperty('display','none','important');
  if (oldScale) oldScale.style.setProperty('visibility','hidden','important');
  if (track) track.style.setProperty('visibility','hidden','important');
  if (fill) fill.style.setProperty('visibility','hidden','important');

  const face = document.createElement('div');
  face.className = 'nxspeed-live-face';
  face.setAttribute('aria-hidden','true');
  face.innerHTML = speedFaceMarkup();
  Object.assign(face.style, {
    position:'absolute',left:'50%',top:'52%',width:'88%',height:'88%',transform:'translate(-50%,-50%)',zIndex:'2',pointerEvents:'none',overflow:'hidden',
    borderRadius:'49% 49% 18% 18% / 55% 55% 17% 17%',boxShadow:'inset 0 0 30px rgba(0,0,0,.5)'
  });
  gauge.appendChild(face);

  const gaugeSvg = gauge.querySelector('svg');
  if (gaugeSvg) {
    gaugeSvg.style.setProperty('position','relative','important');
    gaugeSvg.style.setProperty('z-index','4','important');
  }
  const needleLine = gauge.querySelector('[data-gauge-needle] line');
  const needleCircles = gauge.querySelectorAll('[data-gauge-needle] circle');
  if (needleLine) {
    needleLine.style.setProperty('stroke','#aaf8ff','important');
    needleLine.style.setProperty('stroke-width','2.35','important');
    needleLine.style.setProperty('stroke-linecap','round','important');
    needleLine.style.setProperty('filter','drop-shadow(0 0 2px #7deeff) drop-shadow(0 0 7px rgba(42,207,255,.95))','important');
  }
  if (needleCircles[0]) {
    needleCircles[0].style.setProperty('fill','#10202a','important');
    needleCircles[0].style.setProperty('stroke','#98f1ff','important');
    needleCircles[0].style.setProperty('stroke-width','1','important');
  }
  if (needleCircles[1]) {
    needleCircles[1].style.setProperty('fill','#9cf5ff','important');
    needleCircles[1].style.setProperty('stroke','#e8feff','important');
    needleCircles[1].style.setProperty('stroke-width','.5','important');
  }
  return face;
}

export function renderSpeedTestPremium() {
  const root = node(`
    <section class="nxspeed-console nxspeed-console--sample-b">
      <header><div><span>NEXUSNOVA NETWORK</span><strong>Precision Speed Test</strong></div><b>METER SAMPLE B</b></header>
      <div class="nxspeed-network-state"><i></i><span data-speed-quality>READY</span></div>
      ${gaugeMarkup('speed', 'Mbps')}
      <section class="nxspeed-metrics" data-speed-metrics>
        <article class="is-download"><span>DOWNLOAD</span><strong data-speed-down>—</strong><i></i></article>
        <article class="is-upload"><span>UPLOAD</span><strong data-speed-up>—</strong><i></i></article>
        <article class="is-ping"><span>PING</span><strong data-speed-ping>—</strong><i></i></article>
        <article class="is-jitter"><span>JITTER</span><strong data-speed-jitter>—</strong><i></i></article>
      </section>
      <button class="nxpi-action nxspeed-start" type="button" data-speed-start><b data-speed-start-label>RUN SPEED TEST</b><span aria-hidden="true">›</span></button>
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
  const liveFace = prepareLiveSpeedFace(gauge);
  const down = root.querySelector('[data-speed-down]');
  const up = root.querySelector('[data-speed-up]');
  const ping = root.querySelector('[data-speed-ping]');
  const jitterEl = root.querySelector('[data-speed-jitter]');
  const qualityEl = root.querySelector('[data-speed-quality]');
  const start = root.querySelector('[data-speed-start]');
  const startLabel = root.querySelector('[data-speed-start-label]');
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
      const current = (event.loaded * 8) / (Math.max(1,performance.now()-started)/1000)/1e6;
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
    startLabel.textContent = 'TEST IN PROGRESS';
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
      startLabel.textContent = 'RUN AGAIN';
    } catch (error) {
      if (error?.name !== 'AbortError') {
        qualityEl.textContent = 'INTERRUPTED';
        status.textContent = 'Speed test interrupted. Check the connection and try again.';
        startLabel.textContent = 'TRY AGAIN';
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
    liveFace.remove();
    samplePill?.remove();
    screen?.classList.remove('nx-speed-screen');
  };
  return root;
}

export const premiumSpeedRenderers = Object.freeze({ 'speed-test': renderSpeedTestPremium });