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
  const phi1 = Number(latitude) * Math.PI / 180;
  const phi2 = 21.4225 * Math.PI / 180;
  const lambda1 = Number(longitude) * Math.PI / 180;
  const lambda2 = 39.8262 * Math.PI / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceToKaaba(latitude, longitude) {
  const R = 6371;
  const phi1 = Number(latitude) * Math.PI / 180;
  const phi2 = 21.4225 * Math.PI / 180;
  const dPhi = (21.4225 - Number(latitude)) * Math.PI / 180;
  const dLambda = (39.8262 - Number(longitude)) * Math.PI / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compassPoint(degrees) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  const normalized = (((Number(degrees) || 0) % 360) + 360) % 360;
  return names[Math.round(normalized / 45) % 8];
}

function compactPlace(parts) {
  const seen = new Set();
  return parts.map(value => String(value || '').trim()).filter(value => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
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
    <div class="nxqibla-premium-title"><b>QIBLA COMPASS</b><span> – PREMIUM</span></div>
    <section class="nxqibla-console nxqibla-console--selected" data-qibla-console>
      <header class="nxqibla-head">
        <button class="nxqibla-headbtn nxqibla-back" type="button" data-qibla-back aria-label="Back">‹</button>
        <span class="nxqibla-appicon" data-qibla-appicon aria-hidden="true">⌖</span>
        <div class="nxqibla-headcopy"><strong>Qibla Compass</strong><span>Find direction to Kaaba</span></div>
        <button class="nxqibla-headbtn nxqibla-enable" type="button" data-qibla-enable aria-label="Activate live compass">◎</button>
      </header>

      <div class="nxqibla-layout">
        <aside class="nxqibla-side nxqibla-side--left">
          <article><span>QIBLA DIRECTION</span><strong data-qibla-bearing>—</strong><small data-qibla-point>FROM NORTH</small></article>
          <article><span>DISTANCE</span><strong data-qibla-distance>—</strong><small>TO KAABA</small></article>
          <article><span>LOCATION</span><strong class="nxqibla-location" data-qibla-location>Current location</strong><small data-qibla-coords>—</small></article>
          <article class="nxqibla-health"><span>CALIBRATION</span><strong data-qibla-calibration>Waiting</strong></article>
        </aside>

        <div class="nxqibla-dial-wrap">
          <div class="nxqibla-dial" data-qibla-dial>
            <div class="nxqibla-face-rotor" data-qibla-face-rotor aria-hidden="true">
              <div class="nxqibla-face"></div>
              <div class="nxqibla-clean-face" data-qibla-clean-face></div>
              <i class="nxqibla-mask nxqibla-mask--w" data-qibla-static-w-mask></i>
              <i class="nxqibla-mask nxqibla-mask--sw" data-qibla-static-sw-mask></i>
              <i class="nxqibla-mask nxqibla-mask--kaaba" data-qibla-static-kaaba-mask></i>
            </div>
            <div class="nxqibla-cardinals" data-qibla-cardinals aria-hidden="true">
              <span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span>
            </div>
            <div class="nxqibla-qibla" data-qibla-pointer>
              <span class="nxqibla-kaaba" aria-hidden="true">🕋</span>
              <i></i><b>QIBLA</b>
            </div>
            <div class="nxqibla-heading"><i></i></div>
            <div class="nxqibla-core"><span>LIVE</span><strong>●</strong></div>
          </div>
        </div>

        <aside class="nxqibla-side nxqibla-side--right">
          <article><span>HEADING</span><strong data-qibla-heading>—</strong><small data-qibla-heading-point>—</small></article>
          <article><span>TILT</span><strong data-qibla-tilt>—</strong><small>PHONE ANGLE</small></article>
          <article><span>MAGNETIC FIELD</span><strong class="nxqibla-location" data-qibla-field>Sensor idle</strong><small>DEVICE COMPASS</small></article>
          <article class="nxqibla-health"><span>COMPASS</span><strong data-qibla-strength>Waiting</strong></article>
        </aside>
      </div>
      <p class="nxpi-status" data-qibla-status>Location and orientation are used only while this screen is open.</p>
    </section>
  `, 'nx-qibla-premium');

  const consoleEl = root.querySelector('[data-qibla-console]');
  const rotor = root.querySelector('[data-qibla-face-rotor]');
  const cleanFace = root.querySelector('[data-qibla-clean-face]');
  const staticWMask = root.querySelector('[data-qibla-static-w-mask]');
  const staticSwMask = root.querySelector('[data-qibla-static-sw-mask]');
  const staticKaabaMask = root.querySelector('[data-qibla-static-kaaba-mask]');
  const cardinals = root.querySelector('[data-qibla-cardinals]');
  const pointer = root.querySelector('[data-qibla-pointer]');
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

  if (cleanFace) {
    Object.assign(cleanFace.style, {
      position:'absolute', inset:'12.5%', zIndex:'2', borderRadius:'50%', pointerEvents:'none',
      background:'repeating-conic-gradient(from -1deg,rgba(201,211,219,.16) 0deg .55deg,transparent .7deg 22.5deg),radial-gradient(circle at 50% 50%,#2b3034 0 7%,#171d22 8% 34%,#10161b 35% 68%,#0a1015 69% 100%)',
      boxShadow:'inset 0 0 0 1px rgba(207,218,224,.12),inset 0 0 24px rgba(0,0,0,.72)'
    });
  }
  if (staticWMask) {
    staticWMask.style.setProperty('left','9%','important');
    staticWMask.style.setProperty('top','45.2%','important');
    staticWMask.style.setProperty('width','44%','important');
    staticWMask.style.setProperty('height','8%','important');
    staticWMask.style.setProperty('transform','rotate(-1deg)','important');
    staticWMask.style.setProperty('background','linear-gradient(90deg,#0c1218,#11181e 58%,#161d22)','important');
    staticWMask.style.setProperty('filter','blur(.35px)','important');
  }
  if (staticSwMask) {
    staticSwMask.style.setProperty('left','7%','important');
    staticSwMask.style.setProperty('top','55%','important');
    staticSwMask.style.setProperty('width','45%','important');
    staticSwMask.style.setProperty('height','8%','important');
    staticSwMask.style.setProperty('transform','rotate(-40deg)','important');
    staticSwMask.style.setProperty('background','linear-gradient(90deg,#0b1117,#11181e 58%,#171d22)','important');
    staticSwMask.style.setProperty('filter','blur(.35px)','important');
  }
  if (staticKaabaMask) {
    staticKaabaMask.style.setProperty('left','34.5%','important');
    staticKaabaMask.style.setProperty('top','-1%','important');
    staticKaabaMask.style.setProperty('width','31.5%','important');
    staticKaabaMask.style.setProperty('height','25%','important');
    staticKaabaMask.style.setProperty('border-radius','0 0 48% 48%','important');
    staticKaabaMask.style.setProperty('background','linear-gradient(180deg,#0b1117 0%,#111820 78%,rgba(17,24,32,0) 100%)','important');
    staticKaabaMask.style.setProperty('filter','none','important');
  }

  let bearing = null;
  let heading = 0;
  let listening = false;
  let screen = null;

  queueMicrotask(() => {
    screen = root.closest('.nx-screen');
    screen?.classList.add('nx-qibla-screen');
    const sourceIcon = screen?.querySelector(':scope > .nx-app-head .nx-app-head__icon svg');
    const targetIcon = root.querySelector('[data-qibla-appicon]');
    if (sourceIcon && targetIcon) {
      targetIcon.textContent = '';
      targetIcon.appendChild(sourceIcon.cloneNode(true));
    }
  });

  const shortest = (target, actual) => {
    let delta = ((target - actual + 540) % 360) - 180;
    if (delta === -180) delta = 180;
    return delta;
  };

  const paint = () => {
    if (!Number.isFinite(bearing)) return;
    const relative = shortest(bearing, heading);
    rotor.style.transform = `rotate(${-heading}deg)`;
    cardinals.style.transform = `rotate(${-heading}deg)`;
    pointer.style.transform = `rotate(${relative}deg)`;
    bearingEl.textContent = `${bearing.toFixed(0)}°`;
    pointEl.textContent = `${compassPoint(bearing)} • FROM NORTH`;
    headingEl.textContent = `${heading.toFixed(0)}°`;
    headingPointEl.textContent = `${compassPoint(heading)} • DEVICE`;
    const aligned = Math.abs(relative) <= 3;
    consoleEl.classList.toggle('is-aligned', aligned);
    calibrationEl.textContent = aligned ? '● Excellent' : listening ? '● Active' : 'Ready';
    strengthEl.textContent = aligned ? '● Strong' : listening ? '● Live' : 'Ready';
    enable.classList.toggle('is-live', listening);
    enable.textContent = listening ? '◉' : '◎';
  };

  const onOrientation = event => {
    const webkit = Number(event.webkitCompassHeading);
    if (Number.isFinite(webkit)) heading = webkit;
    else {
      const alpha = Number(event.alpha);
      if (Number.isFinite(alpha)) heading = (360 - alpha) % 360;
    }
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
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
      status.textContent = 'Compass active • only the compass face and Qibla pointer respond to heading.';
      paint();
    } catch (error) {
      status.textContent = error?.message || 'Device orientation is unavailable.';
    }
  };

  currentPosition().then(async position => {
    const lat = Number(position.coords.latitude);
    const lon = Number(position.coords.longitude);
    bearing = bearingToKaaba(lat, lon);
    distanceEl.textContent = `${Math.round(distanceToKaaba(lat, lon)).toLocaleString()} km`;
    coordsEl.textContent = `${lat.toFixed(4)}° • ${lon.toFixed(4)}°`;
    locationEl.textContent = await reversePlace(lat, lon);
    status.textContent = `Location locked • accuracy about ${Math.round(Number(position.coords.accuracy) || 0)} m.`;
    calibrationEl.textContent = 'Ready';
    strengthEl.textContent = 'Ready';
    paint();
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') enableOrientation();
  }).catch(error => {
    status.textContent = error?.message || 'Location permission is required to calculate Qibla.';
  });

  root.querySelector('[data-qibla-back]').addEventListener('click', () => screen?.querySelector(':scope > .nx-app-head [data-app-back]')?.click());
  enable.addEventListener('click', enableOrientation);

  root.__cleanup = () => {
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
    screen?.classList.remove('nx-qibla-screen');
  };
  return root;
}

export const premiumQiblaRenderers = Object.freeze({ qibla: renderQiblaPremium });
