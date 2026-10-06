function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-location-suite';
  root.innerHTML = html;
  return root;
}

function mapEmbedUrl(latitude, longitude, accuracy = 0) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';
  const span = Math.min(.035, Math.max(.004, (Number(accuracy) || 30) / 65000));
  const west = Math.max(-180, lon - span);
  const east = Math.min(180, lon + span);
  const south = Math.max(-90, lat - span);
  const north = Math.min(90, lat + span);
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    layer: 'mapnik',
    marker: `${lat},${lon}`
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

export function renderLocationSuite() {
  const root = node(`
    <section class="nx-location-hero">
      <div>
        <p class="nx-eyebrow">PRIVATE GPS • IN-APP MAP</p>
        <strong>Your live position, without leaving NexusNova</strong>
        <p class="nx-tool-meta" data-loc-status>Tap locate when you want to read the device GPS. Coordinates are not stored by this screen.</p>
      </div>
      <span class="nx-location-pulse" aria-hidden="true"></span>
    </section>

    <section class="nx-location-stats">
      <article><span>LATITUDE</span><strong data-loc-lat>—</strong></article>
      <article><span>LONGITUDE</span><strong data-loc-lon>—</strong></article>
      <article><span>ACCURACY</span><strong data-loc-accuracy>—</strong></article>
      <article><span>ALTITUDE</span><strong data-loc-altitude>—</strong></article>
    </section>

    <section class="nx-location-actions">
      <button class="nx-primary" type="button" data-loc-refresh>LOCATE ME</button>
      <button type="button" data-loc-copy disabled>COPY COORDINATES</button>
    </section>

    <section class="nx-location-map" data-loc-map hidden>
      <div class="nx-location-map__head">
        <div><span>INTERACTIVE MAP</span><strong data-loc-map-title>Current position</strong></div>
        <span data-loc-updated>—</span>
      </div>
      <div class="nx-location-map__frame"><iframe data-loc-frame title="Your current location on OpenStreetMap" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe></div>
      <footer>Map © OpenStreetMap contributors • GPS coordinates stay in this screen and are not saved.</footer>
    </section>
  `);

  const latEl = root.querySelector('[data-loc-lat]');
  const lonEl = root.querySelector('[data-loc-lon]');
  const accuracyEl = root.querySelector('[data-loc-accuracy]');
  const altitudeEl = root.querySelector('[data-loc-altitude]');
  const status = root.querySelector('[data-loc-status]');
  const refresh = root.querySelector('[data-loc-refresh]');
  const copy = root.querySelector('[data-loc-copy]');
  const map = root.querySelector('[data-loc-map]');
  const frame = root.querySelector('[data-loc-frame]');
  const updated = root.querySelector('[data-loc-updated]');
  let current = null;
  let cancelled = false;

  const getLocation = () => {
    if (!navigator.geolocation) {
      status.textContent = 'Location is not supported on this device.';
      return;
    }
    refresh.disabled = true;
    refresh.textContent = 'LOCATING…';
    status.textContent = 'Getting an accurate GPS fix…';

    navigator.geolocation.getCurrentPosition(position => {
      if (cancelled) return;
      const { latitude, longitude, accuracy, altitude } = position.coords;
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        status.textContent = 'GPS returned invalid coordinates.';
        refresh.disabled = false;
        refresh.textContent = 'LOCATE ME';
        return;
      }

      current = { latitude:lat, longitude:lon, accuracy:Number(accuracy) || 0 };
      latEl.textContent = lat.toFixed(6);
      lonEl.textContent = lon.toFixed(6);
      accuracyEl.textContent = Number.isFinite(Number(accuracy)) ? `${Math.round(Number(accuracy))} m` : '—';
      altitudeEl.textContent = Number.isFinite(Number(altitude)) ? `${Math.round(Number(altitude))} m` : '—';
      status.textContent = 'Live GPS ready • map centered inside NexusNova.';
      copy.disabled = false;
      refresh.disabled = false;
      refresh.textContent = 'REFRESH GPS';

      const src = mapEmbedUrl(lat, lon, accuracy);
      if (src) {
        frame.src = src;
        map.hidden = false;
        updated.textContent = new Date(position.timestamp || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      }
    }, error => {
      if (cancelled) return;
      status.textContent = `Location unavailable: ${error.message || 'permission or GPS error'}`;
      refresh.disabled = false;
      refresh.textContent = 'TRY AGAIN';
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:5000 });
  };

  refresh.addEventListener('click', getLocation);
  copy.addEventListener('click', async () => {
    if (!current) return;
    const text = `${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Coordinates copied.';
    } catch {
      status.textContent = `Coordinates: ${text}`;
    }
  });

  root.__cleanup = () => {
    cancelled = true;
    frame.removeAttribute('src');
    current = null;
  };
  return root;
}

export const locationSuiteRenderers = Object.freeze({ location:renderLocationSuite });
