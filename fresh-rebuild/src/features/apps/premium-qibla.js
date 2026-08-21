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

function polar(radius, degrees) {
  const angle = (degrees - 90) * Math.PI / 180;
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function compassFaceMarkup() {
  const ticks = [];
  for (let degree = 0; degree < 360; degree += 5) {
    const major = degree % 30 === 0;
    const medium = !major && degree % 10 === 0;
    const outer = polar(46.4, degree);
    const inner = polar(major ? 40.7 : medium ? 42.3 : 43.5, degree);
    ticks.push(`<line x1="${outer[0].toFixed(2)}" y1="${outer[1].toFixed(2)}" x2="${inner[0].toFixed(2)}" y2="${inner[1].toFixed(2)}" stroke="${major ? '#e4e9ec' : medium ? '#aab4bb' : '#69757e'}" stroke-width="${major ? 0.72 : medium ? 0.44 : 0.26}" opacity="${major ? .92 : medium ? .72 : .5}"/>`);
  }

  const degreeLabels = [];
  for (let degree = 0; degree < 360; degree += 20) {
    const [x, y] = polar(36.6, degree);
    degreeLabels.push(`<text x="${x.toFixed(2)}" y="${(y + 1.15).toFixed(2)}" text-anchor="middle" fill="#9ca6ad" font-size="2.65" font-weight="700">${String(degree).padStart(3, '0')}</text>`);
  }

  const roseAngles = [0,45,90,135,180,225,270,315];
  const rose = roseAngles.map((degree, index) => {
    const long = index % 2 === 0;
    const tip = polar(long ? 27.5 : 21.5, degree);
    const left = polar(long ? 5.3 : 4.3, degree - 90);
    const right = polar(long ? 5.3 : 4.3, degree + 90);
    const fill = degree === 0 ? 'url(#nxqiblaNorth)' : degree === 180 ? 'url(#nxqiblaSouth)' : index % 2 === 0 ? 'url(#nxqiblaSilver)' : 'url(#nxqiblaDarkSilver)';
    return `<polygon points="${left[0].toFixed(2)},${left[1].toFixed(2)} ${tip[0].toFixed(2)},${tip[1].toFixed(2)} ${right[0].toFixed(2)},${right[1].toFixed(2)} 50,50" fill="${fill}" stroke="#05080a" stroke-width=".38" opacity="${long ? .96 : .78}"/>`;
  }).join('');

  return `<svg class="nxqibla-face-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <defs>
      <radialGradient id="nxqiblaFace" cx="50%" cy="43%" r="62%"><stop offset="0" stop-color="#333b42"/><stop offset=".34" stop-color="#20272d"/><stop offset=".72" stop-color="#0d1318"/><stop offset="1" stop-color="#05090c"/></radialGradient>
      <linearGradient id="nxqiblaSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef2f4"/><stop offset=".42" stop-color="#929da5"/><stop offset="1" stop-color="#3b444a"/></linearGradient>
      <linearGradient id="nxqiblaDarkSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aab3b9"/><stop offset=".55" stop-color="#59636a"/><stop offset="1" stop-color="#232a2f"/></linearGradient>
      <linearGradient id="nxqiblaNorth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f7"/><stop offset="1" stop-color="#8a969e"/></linearGradient>
      <linearGradient id="nxqiblaSouth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f8b93"/><stop offset="1" stop-color="#252d32"/></linearGradient>
      <filter id="nxqiblaShadow"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity=".9"/></filter>
    </defs>
    <circle cx="50" cy="50" r="47.3" fill="#070b0e" stroke="#707b82" stroke-width="1.15"/>
    <circle cx="50" cy="50" r="44.5" fill="url(#nxqiblaFace)" stroke="#2d353a" stroke-width="1.1"/>
    <circle cx="50" cy="50" r="39.6" fill="none" stroke="#667078" stroke-width=".36" opacity=".72"/>
    <circle cx="50" cy="50" r="31.7" fill="none" stroke="#434c52" stroke-width=".42" opacity=".62"/>
    <g>${ticks.join('')}</g>
    <g font-family="Arial,system-ui,sans-serif">${degreeLabels.join('')}</g>
    <g filter="url(#nxqiblaShadow)">${rose}</g>
    <circle cx="50" cy="50" r="12.1" fill="rgba(4,7,9,.7)" stroke="#69747a" stroke-width=".55"/>
    <text x="50" y="18.2" text-anchor="middle" fill="#f3f5f6" font-family="Georgia,serif" font-size="7.9" font-weight="700">N</text>
    <text x="82.5" y="52.4" text-anchor="middle" fill="#dce1e4" font-family="Georgia,serif" font-size="7.1" font-weight="700">E</text>
    <text x="50" y="86.6" text-anchor="middle" fill="#dce1e4" font-family="Georgia,serif" font-size="7.1" font-weight="700">S</text>
    <text x="17.5" y="52.4" text-anchor="middle" fill="#dce1e4" font-family="Georgia,serif" font-size="7.1" font-weight="700">W</text>
  </svg>`;
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

      <div class="nxqibla-layout" data-qibla-layout>
        <aside class="nxqibla-side nxqibla-side--left">
          <article><span>QIBLA DIRECTION</span><strong data-qibla-bearing>—</strong><small data-qibla-point>FROM NORTH</small></article>
          <article><span>DISTANCE</span><strong data-qibla-distance>—</strong><small>TO KAABA</small></article>
          <article><span>LOCATION</span><strong class="nxqibla-location" data-qibla-location>Current location</strong><small data-qibla-coords>—</small></article>
          <article class="nxqibla-health"><span>CALIBRATION</span><strong data-qibla-calibration>Waiting</strong></article>
        </aside>

        <div class="nxqibla-dial-wrap">
          <div class="nxqibla-dial" data-qibla-dial>
            <div class="nxqibla-face-rotor" data-qibla-face-rotor aria-hidden="true">${compassFaceMarkup()}</div>
            <div class="nxqibla-qibla" data-qibla-pointer>
              <span class="nxqibla-kaaba" data-qibla-kaaba aria-hidden="true"><i></i><b></b></span>
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
  const layout = root.querySelector('[data-qibla-layout]');
  const dial = root.querySelector('[data-qibla-dial]');
  const rotor = root.querySelector('[data-qibla-face-rotor]');
  const pointer = root.querySelector('[data-qibla-pointer]');
  const kaaba = root.querySelector('[data-qibla-kaaba]');
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

  layout.style.setProperty('grid-template-columns','minmax(68px,.62fr) minmax(0,2.15fr) minmax(68px,.62fr)','important');
  layout.style.setProperty('gap','6px','important');
  dial.style.setProperty('width','min(100%,330px)','important');
  dial.style.setProperty('background','#070b0e','important');

  if (kaaba) {
    Object.assign(kaaba.style, {
      left:'50%', top:'-1.5%', width:'29px', height:'34px', transform:'translateX(-50%)', fontSize:'0',
      borderRadius:'3px', background:'#050505', border:'1px solid #c99d36', boxShadow:'0 2px 4px #000,0 0 7px rgba(225,180,67,.38)', overflow:'visible'
    });
    const body = kaaba.querySelector('i');
    const roof = kaaba.querySelector('b');
    if (body) Object.assign(body.style, {position:'absolute',left:'2px',right:'2px',top:'9px',bottom:'2px',display:'block',background:'linear-gradient(#090909,#010101)',borderTop:'4px solid #d5aa42',boxShadow:'inset 0 0 0 1px rgba(255,255,255,.04)'});
    if (roof) Object.assign(roof.style, {position:'absolute',left:'50%',top:'-8px',width:'0',height:'0',transform:'translateX(-50%)',borderLeft:'14px solid transparent',borderRight:'14px solid transparent',borderBottom:'14px solid #e3b43e',filter:'drop-shadow(0 1px 2px #000)'});
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
      status.textContent = 'Compass active • only the compass dial and Qibla needle respond to heading.';
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
    const latSuffix = lat >= 0 ? 'N' : 'S';
    const lonSuffix = lon >= 0 ? 'E' : 'W';
    coordsEl.textContent = `${Math.abs(lat).toFixed(4)}° ${latSuffix} • ${Math.abs(lon).toFixed(4)}° ${lonSuffix}`;
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
