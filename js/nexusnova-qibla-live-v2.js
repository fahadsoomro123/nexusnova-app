/* NexusNova Live Qibla v2 — live location + motion sensor compass. */
(() => {
  'use strict';
  if (window.__nxLiveQiblaV2) return;
  window.__nxLiveQiblaV2 = true;
  const $ = id => document.getElementById(id);
  const KABA = Object.freeze({ lat: 21.422487, lon: 39.826206 });
  const norm = value => ((Number(value) % 360) + 360) % 360;
  const shortest = (from, to) => ((to - from + 540) % 360) - 180;
  function ensureCss(){ if(document.querySelector('link[data-nx-qibla-live-v2]')) return; const l=document.createElement('link');l.rel='stylesheet';l.href='./css/nexusnova-qibla-live-v2.css?v=20260817';l.dataset.nxQiblaLiveV2='1';document.head.appendChild(l);}
  let qiblaBearing = null;
  let qiblaDistanceKm = null;
  let rawHeading = null;
  let smoothHeading = null;
  let qiblaWatchId = null;
  let qiblaSensorStarted = false;
  let qiblaStarting = false;
  let qiblaAligned = false;
  let lastAbsoluteOrientationAt = 0;
  let lastOrientationAt = 0;

  const rad = x => Number(x) * Math.PI / 180;
  const deg = x => Number(x) * 180 / Math.PI;

  function qiblaBearingFor(lat, lon) {
    const p1 = rad(lat), p2 = rad(KABA.lat), dl = rad(KABA.lon - lon);
    return norm(deg(Math.atan2(
      Math.sin(dl) * Math.cos(p2),
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
    )));
  }

  function distanceToKaba(lat, lon) {
    const R = 6371.0088;
    const dLat = rad(KABA.lat - lat);
    const dLon = rad(KABA.lon - lon);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat)) * Math.cos(rad(KABA.lat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function screenAngle() {
    const value = Number(screen.orientation?.angle ?? window.orientation ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function headingFromOrientation(event) {
    const webkit = Number(event.webkitCompassHeading);
    if (Number.isFinite(webkit)) return norm(webkit);
    const alpha = Number(event.alpha);
    if (!Number.isFinite(alpha)) return null;
    return norm(360 - alpha + screenAngle());
  }

  function onOrientation(event) {
    const now = performance.now();
    const isAbsolute = event.type === 'deviceorientationabsolute' || event.absolute === true;
    if (isAbsolute) lastAbsoluteOrientationAt = now;
    else if (now - lastAbsoluteOrientationAt < 900) return;

    const heading = headingFromOrientation(event);
    if (!Number.isFinite(heading)) return;
    rawHeading = heading;
    if (smoothHeading == null) smoothHeading = heading;
    else smoothHeading = norm(smoothHeading + shortest(smoothHeading, heading) * 0.18);
    lastOrientationAt = now;
    renderQibla();
  }

  function renderQibla() {
    const panel = $('tab-qibla');
    if (!panel || qiblaBearing == null) return;
    const heading = Number.isFinite(smoothHeading) ? smoothHeading : 0;
    const rel = norm(qiblaBearing - heading);
    const signed = shortest(0, rel);
    const aligned = Math.abs(signed) <= 4;

    panel.style.setProperty('--nx-qibla-relative', `${signed.toFixed(2)}deg`);
    panel.style.setProperty('--nx-qibla-heading', `${(-heading).toFixed(2)}deg`);
    panel.classList.toggle('nx-qibla-aligned', aligned);
    panel.classList.toggle('nx-qibla-has-heading', Number.isFinite(smoothHeading));

    const arrow = $('qiblaArrow');
    if (arrow) arrow.style.transform = `translate(-50%,-88%) rotate(${signed.toFixed(2)}deg)`;
    const rose = $('nxQiblaRose');
    if (rose) rose.style.transform = `rotate(${(-heading).toFixed(2)}deg)`;
    const bearingEl = $('nxQiblaBearingValue');
    const headingEl = $('nxQiblaHeadingValue');
    const distanceEl = $('nxQiblaDistanceValue');
    if (bearingEl) bearingEl.textContent = `${qiblaBearing.toFixed(1)}°`;
    if (headingEl) headingEl.textContent = Number.isFinite(smoothHeading) ? `${heading.toFixed(0)}°` : '—';
    if (distanceEl) distanceEl.textContent = qiblaDistanceKm == null ? '—' : `${Math.round(qiblaDistanceKm).toLocaleString()} km`;

    const degree = $('qiblaDegree');
    if (degree) {
      if (aligned) degree.innerHTML = '<strong>Qibla aligned</strong><span>Kaaba is straight ahead</span>';
      else {
        const turn = signed > 0 ? 'right' : 'left';
        degree.innerHTML = `<strong>Turn ${Math.abs(signed).toFixed(0)}° ${turn}</strong><span>Follow the golden Kaaba pointer</span>`;
      }
    }

    const status = $('qiblaStatus');
    if (status) {
      if (Number.isFinite(smoothHeading)) {
        status.textContent = aligned ? 'Live compass locked on Qibla.' : 'Live compass • move the phone slowly and keep it flat.';
      } else {
        status.textContent = 'Qibla bearing found. Waiting for the phone compass sensor…';
      }
    }

    if (aligned && !qiblaAligned) {
      qiblaAligned = true;
      try { navigator.vibrate?.(28); } catch (_) {}
    } else if (!aligned) qiblaAligned = false;
  }

  function updateQiblaLocation(position) {
    const lat = Number(position?.coords?.latitude);
    const lon = Number(position?.coords?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    qiblaBearing = qiblaBearingFor(lat, lon);
    qiblaDistanceKm = distanceToKaba(lat, lon);
    const accuracy = Number(position.coords.accuracy);
    const accuracyEl = $('nxQiblaAccuracy');
    if (accuracyEl) accuracyEl.textContent = Number.isFinite(accuracy) ? `GPS ±${Math.round(accuracy)} m` : 'GPS live';
    renderQibla();
  }

  function qiblaLocationError(error) {
    const status = $('qiblaStatus');
    const message = Number(error?.code) === 1
      ? 'Allow location permission to calculate the Qibla from where you are.'
      : 'Live location is unavailable. Check GPS/location and try again.';
    if (status) status.textContent = message;
    $('tab-qibla')?.classList.add('nx-qibla-needs-action');
  }

  async function startOrientationSensors(userGesture = false) {
    if (qiblaSensorStarted) return true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        if (!userGesture) return false;
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Motion permission denied');
      }
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
      window.addEventListener('deviceorientation', onOrientation, true);
      qiblaSensorStarted = true;
      setTimeout(() => {
        if (performance.now() - lastOrientationAt > 2400) {
          const status = $('qiblaStatus');
          if (status && qiblaBearing != null) status.textContent = 'Qibla is calculated, but no compass reading is arriving. Move the phone in a figure-eight to calibrate the sensor.';
        }
      }, 2600);
      return true;
    } catch (_) {
      const status = $('qiblaStatus');
      if (status) status.textContent = 'Motion/compass permission is required for live rotation.';
      return false;
    }
  }

  async function startQibla(userGesture = false) {
    if (qiblaStarting) return;
    qiblaStarting = true;
    const panel = $('tab-qibla');
    panel?.classList.remove('nx-qibla-needs-action');
    if (qiblaWatchId != null) {
      await startOrientationSensors(userGesture);
      renderQibla();
      qiblaStarting = false;
      return;
    }
    const status = $('qiblaStatus');
    if (status) status.textContent = 'Starting live Qibla…';
    try {
      await startOrientationSensors(userGesture);
      if (!navigator.geolocation) throw new Error('Geolocation unsupported');
      if (qiblaWatchId == null) {
        qiblaWatchId = navigator.geolocation.watchPosition(
          updateQiblaLocation,
          qiblaLocationError,
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
      }
      // watchPosition can take a moment; a cached one-shot gives immediate feedback.
      navigator.geolocation.getCurrentPosition(
        updateQiblaLocation,
        () => {},
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    } catch (_) {
      qiblaLocationError({ code: 0 });
    } finally {
      qiblaStarting = false;
    }
  }

  function buildQiblaUi() {
    const tab = $('tab-qibla');
    const wrap = tab?.querySelector('.qibla-wrap');
    if (!tab || !wrap || wrap.dataset.nxQiblaPremium === '1') return false;
    wrap.dataset.nxQiblaPremium = '1';
    tab.classList.add('nx-qibla-premium');

    const hero = tab.querySelector('.hub-hero');
    if (hero) {
      hero.classList.add('nx-qibla-hero');
      const kicker = hero.querySelector('.hub-kicker');
      const title = hero.querySelector('h2');
      const text = hero.querySelector('p');
      if (kicker) kicker.textContent = 'LIVE FAITH COMPASS';
      if (title) title.textContent = 'Qibla Compass';
      if (text) text.textContent = 'Live sensor guidance to the Kaaba from your current location.';
    }

    wrap.innerHTML = `
      <section class="nx-qibla-stage" aria-label="Live Qibla compass">
        <div class="nx-qibla-stage-head">
          <div><small>MAKKAH • KAABA</small><strong id="nxQiblaBearingValue">—</strong></div>
          <span id="nxQiblaAccuracy" class="nx-qibla-live-pill"><i></i>GPS ready</span>
        </div>
        <div class="qibla-compass nx-qibla-compass">
          <div class="nx-qibla-ambient"></div>
          <div id="nxQiblaRose" class="nx-qibla-rose" aria-hidden="true">
            <span class="nx-dir nx-n">N</span><span class="nx-dir nx-e">E</span><span class="nx-dir nx-s">S</span><span class="nx-dir nx-w">W</span>
          </div>
          <div class="nx-qibla-inner-ring" aria-hidden="true"></div>
          <div id="qiblaArrow" class="qibla-arrow nx-qibla-pointer" aria-hidden="true">
            <span class="nx-qibla-pointer-head"><b>◆</b><em>KAABA</em></span>
            <i></i>
          </div>
          <div class="nx-qibla-center" aria-hidden="true"><span></span></div>
          <div class="nx-qibla-phone-heading" aria-hidden="true">▲</div>
        </div>
        <div id="qiblaDegree" class="nx-qibla-guidance"><strong>Finding Qibla…</strong><span>Location and compass will start automatically</span></div>
        <div class="nx-qibla-stats">
          <div><small>PHONE HEADING</small><b id="nxQiblaHeadingValue">—</b></div>
          <div><small>DISTANCE TO KAABA</small><b id="nxQiblaDistanceValue">—</b></div>
        </div>
        <div id="qiblaStatus" class="nx-qibla-status">Ready for live location and motion sensor.</div>
        <button id="nxQiblaStart" class="nx-qibla-enable" type="button"><span>◎</span><b>Enable / Recenter Live Compass</b></button>
      </section>`;

    $('nxQiblaStart')?.addEventListener('click', () => startQibla(true));
    return true;
  }

  window.nxStartQibla = () => startQibla(true);

  function autoStartQiblaIfVisible() {
    const tab = $('tab-qibla');
    if (!tab?.classList.contains('active')) return;
    buildQiblaUi();
    startQibla(false);
  }

  function install(){ ensureCss(); buildQiblaUi(); autoStartQiblaIfVisible(); }
  function observe(){ const tab=$('tab-qibla'); if(!tab||tab.dataset.nxQiblaObservedV2==='1') return; tab.dataset.nxQiblaObservedV2='1'; new MutationObserver(()=>autoStartQiblaIfVisible()).observe(tab,{attributes:true,attributeFilter:['class']}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,1400);setTimeout(observe,1500)},{once:true}); else {setTimeout(install,250);setTimeout(observe,350)}
  [2200,4000].forEach(ms=>setTimeout(()=>{install();observe()},ms));
  window.nexusLiveQibla=Object.freeze({version:'2.0.0',start:()=>startQibla(true)});
})();
