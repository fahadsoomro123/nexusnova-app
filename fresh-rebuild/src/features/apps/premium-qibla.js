function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
      ...options
    });
  });
}

function bearingToKaaba(latitude, longitude) {
  const φ1 = Number(latitude) * Math.PI / 180;
  const φ2 = 21.4225 * Math.PI / 180;
  const λ1 = Number(longitude) * Math.PI / 180;
  const λ2 = 39.8262 * Math.PI / 180;
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceToKaaba(latitude, longitude) {
  const R = 6371;
  const φ1 = Number(latitude) * Math.PI / 180;
  const φ2 = 21.4225 * Math.PI / 180;
  const dφ = (21.4225 - Number(latitude)) * Math.PI / 180;
  const dλ = (39.8262 - Number(longitude)) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compassPoint(degrees) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  return names[Math.round((((Number(degrees) || 0) % 360) + 360) % 360 / 45) % 8];
}

function compactPlace(parts) {
  const seen = new Set();
  return parts.map(value => String(value || '').trim()).filter(value => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 3).join(', ');
}

async function reversePlace(lat, lon) {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`, { cache:'no-store' });
    if (response.ok) {
      const json = await response.json();
      const place = compactPlace([json.locality || json.city || json.principalSubdivision, json.principalSubdivision, json.countryName]);
      if (place) return place;
    }
  } catch {}
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { cache:'no-store' });
    if (response.ok) {
      const props = (await response.json())?.features?.[0]?.properties || {};
      const place = compactPlace([props.city || props.town || props.village || props.name, props.state, props.country]);
      if (place) return place;
    }
  } catch {}
  return 'Current GPS location';
}

export function renderQiblaPremium() {
  const root = node(`
    <section class="nxqibla-console nxqibla-console--selected" data-qibla-console>
      <header><div><span>QIBLA COMPASS</span><strong>Find direction to Kaaba</strong></div><b data-qibla-lock>LOCATING</b></header>
      <div class="nxqibla-layout" data-qibla-layout>
        <aside class="nxqibla-side nxqibla-side--left" data-qibla-left>
          <article><span>QIBLA DIRECTION</span><strong data-qibla-bearing>—</strong><small data-qibla-point>FROM NORTH</small></article>
          <article><span>DISTANCE</span><strong data-qibla-distance>—</strong><small>TO KAABA</small></article>
          <article><span>LOCATION</span><strong data-qibla-location>Current location</strong><small data-qibla-coords>—</small></article>
          <article class="nxqibla-health"><span>CALIBRATION</span><strong data-qibla-calibration>Waiting</strong></article>
        </aside>
        <div class="nxqibla-dial-wrap" data-qibla-dial-wrap>
          <div class="nxqibla-dial">
            <div class="nxqibla-degree-ring" aria-hidden="true"></div>
            <div class="nxqibla-cardinals" data-qibla-cardinals>
              <span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span>
            </div>
            <div class="nxqibla-qibla" data-qibla-pointer><span class="nxqibla-kaaba" aria-hidden="true">🕋</span><i></i><b>QIBLA</b></div>
            <div class="nxqibla-heading"><i></i></div>
            <div class="nxqibla-core"><span>LIVE</span><strong>●</strong></div>
          </div>
        </div>
        <aside class="nxqibla-side nxqibla-side--right" data-qibla-right>
          <article><span>HEADING</span><strong data-qibla-heading>—</strong><small data-qibla-heading-point>—</small></article>
          <article><span>TILT</span><strong data-qibla-tilt>—</strong><small>PHONE ANGLE</small></article>
          <article><span>MAGNETIC FIELD</span><strong data-qibla-field>Sensor idle</strong><small>DEVICE COMPASS</small></article>
          <article class="nxqibla-health"><span>COMPASS</span><strong data-qibla-strength>Waiting</strong></article>
        </aside>
      </div>
      <button class="nxpi-action" type="button" data-qibla-enable>ACTIVATE LIVE COMPASS</button>
      <p class="nxpi-status" data-qibla-status>Location and orientation are used only while this screen is open.</p>
    </section>
  `, 'nx-qibla-premium');

  queueMicrotask(() => {
    const host = root.closest('.nx-screen');
    if (!host) return;
    const h1 = host.querySelector(':scope > .nx-app-head h1');
    const sub = host.querySelector(':scope > .nx-app-head p:not(.nx-eyebrow)');
    if (h1) h1.textContent = 'Qibla Compass';
    if (sub) sub.textContent = 'Find direction to Kaaba';
  });

  const layout = root.querySelector('[data-qibla-layout]');
  const left = root.querySelector('[data-qibla-left]');
  const right = root.querySelector('[data-qibla-right]');
  const dialWrap = root.querySelector('[data-qibla-dial-wrap]');
  layout.style.gridTemplateColumns = 'minmax(72px,.72fr) minmax(0,1.75fr) minmax(72px,.72fr)';
  layout.style.alignItems = 'center';
  left.style.order = '1'; dialWrap.style.order = '2'; right.style.order = '3';
  const dial = root.querySelector('.nxqibla-dial');
  dial.style.width = 'min(55vw,360px)';
  dial.style.contain = 'layout paint';

  const dock = document.querySelector('.nx-dock');
  const dockStyle = dock?.getAttribute('style') ?? null;
  if (dock) {
    dock.style.position = 'fixed';
    dock.style.transform = 'translateX(-50%)';
    dock.style.willChange = 'auto';
  }

  const consoleEl = root.querySelector('[data-qibla-console]');
  const cardinals = root.querySelector('[data-qibla-cardinals]');
  const pointer = root.querySelector('[data-qibla-pointer]');
  const lock = root.querySelector('[data-qibla-lock]');
  const bearingEl = root.querySelector('[data-qibla-bearing]');
  const pointEl = root.querySelector('[data-qibla-point]');
  const distanceEl = root.querySelector('[data-qibla-distance]');
  const locationEl = root.querySelector('[data-qibla-location]');
  const coordsEl = root.querySelector('[data-qibla-coords]');
  const headingEl = root.querySelector('[data-qibla-heading]');
  const headingPointEl = root.querySelector('[data-qibla-heading-point]');
  const tiltEl = root.querySelector('[data-qibla-tilt]');
  const fieldEl = root.querySelector('[data-qibla-field]');
  const calibrationEl = root.querySelector('[data-qibla-calibration]');
  const strengthEl = root.querySelector('[data-qibla-strength]');
  const status = root.querySelector('[data-qibla-status]');
  const enable = root.querySelector('[data-qibla-enable]');
  let bearing = null;
  let heading = 0;
  let listening = false;

  const shortest = (target, actual) => {
    let delta = ((target - actual + 540) % 360) - 180;
    if (delta === -180) delta = 180;
    return delta;
  };

  const paint = () => {
    if (!Number.isFinite(bearing)) return;
    const relative = shortest(bearing, heading);
    cardinals.style.transformOrigin = '50% 50%';
    pointer.style.transformOrigin = '50% 50%';
    cardinals.style.transform = `rotate(${-heading}deg)`;
    pointer.style.transform = `rotate(${relative}deg)`;
    bearingEl.textContent = `${bearing.toFixed(0)}°`;
    pointEl.textContent = `${compassPoint(bearing)} • FROM NORTH`;
    headingEl.textContent = `${heading.toFixed(0)}°`;
    headingPointEl.textContent = compassPoint(heading);
    const aligned = Math.abs(relative) <= 3;
    consoleEl.classList.toggle('is-aligned', aligned);
    lock.textContent = aligned ? 'ON TARGET' : listening ? 'LIVE' : 'READY';
    calibrationEl.textContent = aligned ? 'Excellent' : listening ? 'Active' : 'Ready';
    strengthEl.textContent = aligned ? 'Strong' : listening ? 'Live' : 'Ready';
  };

  const onOrientation = event => {
    const webkit = Number(event.webkitCompassHeading);
    if (Number.isFinite(webkit)) heading = webkit;
    else {
      const alpha = Number(event.alpha);
      if (Number.isFinite(alpha)) heading = (360 - alpha) % 360;
    }
    const beta = Number(event.beta), gamma = Number(event.gamma);
    if (Number.isFinite(beta) || Number.isFinite(gamma)) {
      const tilt = Math.sqrt((Number.isFinite(beta) ? beta : 0) ** 2 + (Number.isFinite(gamma) ? gamma : 0) ** 2);
      tiltEl.textContent = `${Math.round(Math.min(90, tilt))}°`;
    }
    fieldEl.textContent = 'Normal';
    paint();
  };

  const enableOrientation = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Motion permission was not granted.');
      }
      if (!listening) {
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
        window.addEventListener('deviceorientation', onOrientation, true);
        listening = true;
      }
      enable.textContent = 'LIVE COMPASS ACTIVE';
      fieldEl.textContent = 'Normal';
      status.textContent = 'Compass active • only the dial and Qibla needle move.';
      paint();
    } catch (error) {
      status.textContent = error?.message || 'Device orientation is unavailable.';
    }
  };

  currentPosition().then(async position => {
    const lat = Number(position.coords.latitude), lon = Number(position.coords.longitude);
    bearing = bearingToKaaba(lat, lon);
    distanceEl.textContent = `${Math.round(distanceToKaaba(lat, lon)).toLocaleString()} km`;
    coordsEl.textContent = `${lat.toFixed(4)}° N • ${lon.toFixed(4)}° E`;
    locationEl.textContent = await reversePlace(lat, lon);
    status.textContent = `Location locked • accuracy about ${Math.round(Number(position.coords.accuracy) || 0)} m.`;
    lock.textContent = 'READY'; calibrationEl.textContent = 'Ready'; strengthEl.textContent = 'Ready'; paint();
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') enableOrientation();
  }).catch(error => {
    lock.textContent = 'NO GPS';
    status.textContent = error?.message || 'Location permission is required to calculate Qibla.';
  });

  enable.addEventListener('click', enableOrientation);
  root.__cleanup = () => {
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
    if (dock) {
      if (dockStyle === null) dock.removeAttribute('style'); else dock.setAttribute('style', dockStyle);
    }
  };
  return root;
}

export const premiumQiblaRenderers = Object.freeze({ qibla: renderQiblaPremium });
