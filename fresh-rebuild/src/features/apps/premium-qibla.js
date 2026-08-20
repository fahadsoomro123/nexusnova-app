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
      maximumAge: 45000,
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

export function renderQiblaPremium() {
  const root = node(`
    <section class="nxqibla-console" data-qibla-console>
      <header><div><span>PRECISION QIBLA</span><strong>Live Direction Instrument</strong></div><b data-qibla-lock>LOCATING</b></header>
      <div class="nxqibla-dial">
        <div class="nxqibla-cardinals" data-qibla-cardinals>
          <span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span>
        </div>
        <div class="nxqibla-qibla" data-qibla-pointer><i></i><b>QIBLA</b></div>
        <div class="nxqibla-heading"><i></i></div>
        <div class="nxqibla-core"><span>KAABA</span><strong>◈</strong></div>
      </div>
      <section class="nxqibla-readouts">
        <article><span>QIBLA</span><strong data-qibla-bearing>—</strong></article>
        <article><span>HEADING</span><strong data-qibla-heading>—</strong></article>
        <article><span>OFFSET</span><strong data-qibla-offset>—</strong></article>
        <article><span>GPS</span><strong data-qibla-accuracy>—</strong></article>
      </section>
      <button class="nxpi-action" type="button" data-qibla-enable>ACTIVATE LIVE COMPASS</button>
      <p class="nxpi-status" data-qibla-status>Location and orientation are used only while this screen is open.</p>
    </section>
  `, 'nx-qibla-premium');

  const consoleEl = root.querySelector('[data-qibla-console]');
  const cardinals = root.querySelector('[data-qibla-cardinals]');
  const pointer = root.querySelector('[data-qibla-pointer]');
  const lock = root.querySelector('[data-qibla-lock]');
  const bearingEl = root.querySelector('[data-qibla-bearing]');
  const headingEl = root.querySelector('[data-qibla-heading]');
  const offsetEl = root.querySelector('[data-qibla-offset]');
  const accuracyEl = root.querySelector('[data-qibla-accuracy]');
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
    cardinals.style.transform = `rotate(${-heading}deg)`;
    pointer.style.transform = `rotate(${relative}deg)`;
    bearingEl.textContent = `${bearing.toFixed(1)}°`;
    headingEl.textContent = `${heading.toFixed(1)}°`;
    offsetEl.textContent = `${Math.abs(relative).toFixed(1)}° ${relative > 0 ? 'RIGHT' : relative < 0 ? 'LEFT' : ''}`.trim();
    const aligned = Math.abs(relative) <= 3;
    consoleEl.classList.toggle('is-aligned', aligned);
    lock.textContent = aligned ? 'ALIGNED' : listening ? 'LIVE' : 'READY';
  };

  const onOrientation = event => {
    const webkit = Number(event.webkitCompassHeading);
    if (Number.isFinite(webkit)) heading = webkit;
    else {
      const alpha = Number(event.alpha);
      if (Number.isFinite(alpha)) heading = (360 - alpha) % 360;
    }
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
      status.textContent = 'Compass active • keep the phone flat and away from magnets or metal.';
      paint();
    } catch (error) {
      status.textContent = error?.message || 'Device orientation is unavailable.';
    }
  };

  currentPosition().then(position => {
    bearing = bearingToKaaba(position.coords.latitude, position.coords.longitude);
    accuracyEl.textContent = `${Math.round(Number(position.coords.accuracy) || 0)} m`;
    status.textContent = 'Location locked. Activate the live compass for real-time heading.';
    lock.textContent = 'READY';
    paint();
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') {
      enableOrientation();
    }
  }).catch(error => {
    lock.textContent = 'NO GPS';
    status.textContent = error?.message || 'Location permission is required to calculate Qibla.';
  });

  enable.addEventListener('click', enableOrientation);
  root.__cleanup = () => {
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
  };
  return root;
}

export const premiumQiblaRenderers = Object.freeze({ qibla: renderQiblaPremium });
