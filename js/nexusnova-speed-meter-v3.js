/* NexusNova Speed Meter v3 — premium live gauge driven by real transfer progress. */
(() => {
  'use strict';
  if(window.__nxSpeedMeterV3) return;
  window.__nxSpeedMeterV3=true;
  const $=id=>document.getElementById(id);
  function ensureCss(){if(document.querySelector('link[data-nx-speed-v3]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./css/nexusnova-speed-meter-v3.css?v=20260817';l.dataset.nxSpeedV3='1';document.head.appendChild(l);}
  const SPEED_MAX = 500;
  let speedVisual = 0;
  let speedTarget = 0;
  let speedRaf = 0;
  let speedRunning = false;

  function speedAngle(value) {
    const v = Math.max(0, Math.min(SPEED_MAX, Number(value) || 0));
    const ratio = Math.log10(1 + v) / Math.log10(1 + SPEED_MAX);
    return -126 + 252 * ratio;
  }

  function animateNeedle() {
    const needle = document.querySelector('#tool-speed .nx-speed-needle-v3');
    if (!needle) { speedRaf = 0; return; }
    const delta = speedTarget - speedVisual;
    speedVisual += delta * (Math.abs(delta) > 30 ? 0.28 : 0.2);
    if (Math.abs(delta) < 0.03) speedVisual = speedTarget;
    needle.style.transform = `translateX(-50%) rotate(${speedAngle(speedVisual).toFixed(2)}deg)`;
    const glow = document.querySelector('#tool-speed .nx-speed-live-dot');
    if (glow) glow.style.setProperty('--nx-speed-load', String(Math.min(1, speedVisual / 200)));
    if (speedVisual !== speedTarget || speedRunning) speedRaf = requestAnimationFrame(animateNeedle);
    else speedRaf = 0;
  }

  function setSpeedValue(value, phase) {
    const v = Math.max(0, Number(value) || 0);
    speedTarget = v;
    const main = $('nxSpeedMain');
    if (main) {
      let valueEl = main.querySelector('b');
      if (!valueEl) {
        main.innerHTML = '<b>0.00</b><span>Mbps</span>';
        valueEl = main.querySelector('b');
      }
      if (valueEl) valueEl.textContent = v < 10 ? v.toFixed(2) : v.toFixed(1);
    }
    const panel = $('tool-speed');
    if (panel && phase) panel.dataset.speedPhase = phase;
    if (!speedRaf) speedRaf = requestAnimationFrame(animateNeedle);
  }

  function setSpeedProgress(percent) {
    const bar = $('nxSpeedBar');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function buildSpeedUi() {
    const panel = $('tool-speed');
    const gauge = panel?.querySelector('.nx-speed-gauge');
    const start = $('nxSpeedStart');
    if (!panel || !gauge || !start) return false;
    panel.classList.remove('nx-speed-v2');
    panel.classList.add('nx-speed-v3');

    if (panel.dataset.nxSpeedPremium !== '1') {
      panel.dataset.nxSpeedPremium = '1';
      const main = $('nxSpeedMain');
      if (main && !main.querySelector('b')) main.innerHTML = '<b>0.00</b><span>Mbps</span>';
      const heading = panel.querySelector('h3');
      const sub = heading?.nextElementSibling;
      if (heading) heading.innerHTML = '<span class="nx-speed-brand-mark">↯</span><span><small>NETWORK PERFORMANCE</small>Internet Speed Test</span>';
      if (sub) sub.textContent = 'Live throughput against Cloudflare edge infrastructure.';
      start.textContent = 'START LIVE TEST';

      gauge.insertAdjacentHTML('afterbegin', `
        <div class="nx-speed-cockpit" aria-hidden="true">
          <div class="nx-speed-arc nx-speed-arc-base"></div>
          <div class="nx-speed-arc nx-speed-arc-glow"></div>
          <div class="nx-speed-ticks"></div>
          <div class="nx-speed-scale-labels">
            <span style="--p:0">0</span><span style="--p:.18">5</span><span style="--p:.36">25</span><span style="--p:.56">100</span><span style="--p:.77">250</span><span style="--p:1">500+</span>
          </div>
          <div class="nx-speed-needle-v3"><i></i></div>
          <div class="nx-speed-live-dot"><i></i></div>
          <div class="nx-speed-phase-label">LIVE THROUGHPUT</div>
        </div>`);

      gauge.querySelector('.nx-speed-grid')?.classList.add('nx-speed-grid-v3');
      const down = $('nxSpeedDown')?.closest('.nx-speed-stat');
      const up = $('nxSpeedUp')?.closest('.nx-speed-stat');
      const ping = $('nxSpeedPing')?.closest('.nx-speed-stat');
      if (down) { down.dataset.metric='download'; down.querySelector('small').textContent='DOWNLOAD'; }
      if (up) { up.dataset.metric='upload'; up.querySelector('small').textContent='UPLOAD'; }
      if (ping) { ping.dataset.metric='ping'; ping.querySelector('small').textContent='PING'; }
    }

    start.onclick = event => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      runPremiumSpeedTest();
    };
    return true;
  }

  async function pingTest() {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const response = await fetch(`https://speed.cloudflare.com/__down?bytes=0&x=${Date.now()}-${i}`, { cache:'no-store' });
      await response.arrayBuffer();
      samples.push(performance.now() - start);
    }
    samples.sort((a,b) => a-b);
    return samples[Math.floor(samples.length / 2)];
  }

  async function liveDownloadTest() {
    const response = await fetch(`https://speed.cloudflare.com/__down?bytes=6000000&x=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const started = performance.now();
    let bytes = 0;
    let lastPaint = started;
    let lastBytes = 0;
    let rolling = 0;

    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      const elapsed = Math.max(1, performance.now() - started);
      const final = (buffer.byteLength * 8) / (elapsed / 1000) / 1e6;
      setSpeedValue(final, 'download');
      return final;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.byteLength || 0;
      const now = performance.now();
      const elapsed = Math.max(1, now - started);
      if (now - lastPaint >= 70) {
        const chunkBytes = bytes - lastBytes;
        const chunkMs = Math.max(1, now - lastPaint);
        const instant = (chunkBytes * 8) / (chunkMs / 1000) / 1e6;
        const average = (bytes * 8) / (elapsed / 1000) / 1e6;
        rolling = rolling ? (rolling * 0.58 + instant * 0.42) : average;
        const shown = Math.max(0, rolling * 0.55 + average * 0.45);
        setSpeedValue(shown, 'download');
        if ($('nxSpeedDown')) $('nxSpeedDown').textContent = shown.toFixed(1);
        setSpeedProgress(22 + Math.min(43, (bytes / 6000000) * 43));
        lastPaint = now;
        lastBytes = bytes;
      }
    }
    const elapsed = Math.max(1, performance.now() - started);
    const final = (bytes * 8) / (elapsed / 1000) / 1e6;
    setSpeedValue(final, 'download');
    if ($('nxSpeedDown')) $('nxSpeedDown').textContent = final.toFixed(1);
    return final;
  }

  function liveUploadTest() {
    return new Promise((resolve, reject) => {
      const size = 2_000_000;
      const body = new Uint8Array(size);
      const xhr = new XMLHttpRequest();
      const started = performance.now();
      let lastShown = 0;
      let lastAt = started;

      xhr.open('POST', `https://speed.cloudflare.com/__up?bytes=${size}&x=${Date.now()}`, true);
      xhr.timeout = 20000;
      xhr.upload.onprogress = event => {
        const now = performance.now();
        if (now - lastAt < 65 && event.loaded < event.total) return;
        const elapsed = Math.max(1, now - started);
        const measured = (event.loaded * 8) / (elapsed / 1000) / 1e6;
        lastShown = measured;
        setSpeedValue(measured, 'upload');
        if ($('nxSpeedUp')) $('nxSpeedUp').textContent = measured.toFixed(1);
        const ratio = event.lengthComputable && event.total ? event.loaded / event.total : event.loaded / size;
        setSpeedProgress(68 + Math.min(29, ratio * 29));
        lastAt = now;
      };
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Upload HTTP ${xhr.status}`));
        const elapsed = Math.max(1, performance.now() - started);
        const final = (size * 8) / (elapsed / 1000) / 1e6;
        const value = final > 0 ? final : lastShown;
        setSpeedValue(value, 'upload');
        if ($('nxSpeedUp')) $('nxSpeedUp').textContent = value.toFixed(1);
        resolve(value);
      };
      xhr.send(body);
    });
  }

  async function runPremiumSpeedTest() {
    if (speedRunning) return;
    buildSpeedUi();
    const start = $('nxSpeedStart'), status = $('nxSpeedStatus'), panel = $('tool-speed');
    speedRunning = true;
    speedTarget = 0;
    speedVisual = 0;
    panel?.classList.add('nx-speed-testing');
    panel?.classList.remove('nx-speed-complete','nx-speed-error');
    if (start) start.disabled = true;
    if ($('nxSpeedDown')) $('nxSpeedDown').textContent = '—';
    if ($('nxSpeedUp')) $('nxSpeedUp').textContent = '—';
    if ($('nxSpeedPing')) $('nxSpeedPing').textContent = '—';
    setSpeedValue(0, 'ping');
    setSpeedProgress(5);

    try {
      if (status) status.textContent = 'PING • finding the nearest edge…';
      const ping = await pingTest();
      if ($('nxSpeedPing')) $('nxSpeedPing').textContent = ping.toFixed(0);
      setSpeedProgress(20);

      if (status) status.textContent = 'DOWNLOAD • measuring live throughput…';
      const down = await liveDownloadTest();
      setSpeedProgress(67);

      if (status) status.textContent = 'UPLOAD • measuring live throughput…';
      const up = await liveUploadTest();
      setSpeedProgress(100);

      const final = down >= up ? down : up;
      setSpeedValue(final, 'complete');
      if (status) status.textContent = `COMPLETE • ${ping.toFixed(0)} ms latency`;
      panel?.classList.add('nx-speed-complete');
      if (start) start.textContent = 'TEST AGAIN';
    } catch (error) {
      console.warn('NexusNova premium speed test:', error);
      panel?.classList.add('nx-speed-error');
      if (status) status.textContent = 'Test interrupted • check your connection and try again.';
    } finally {
      speedRunning = false;
      panel?.classList.remove('nx-speed-testing');
      if (start) start.disabled = false;
      setTimeout(() => setSpeedProgress(0), 1500);
      if (!speedRaf) speedRaf = requestAnimationFrame(animateNeedle);
    }
  }
  window.nexusPremiumSpeedTest = runPremiumSpeedTest;

  function install(){ensureCss();buildSpeedUi();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1500),{once:true}); else setTimeout(install,300);
  new MutationObserver(()=>{if(!$('tool-speed')?.dataset.nxSpeedPremium)install()}).observe(document.documentElement,{childList:true,subtree:true});
  [2200,4000,7000].forEach(ms=>setTimeout(install,ms));
})();
