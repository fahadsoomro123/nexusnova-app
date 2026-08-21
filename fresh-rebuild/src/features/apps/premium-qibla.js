function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx2-qibla';
  root.innerHTML = html;
  return root;
}

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
      ...options
    });
  });
}

function bearingToKaaba(latitude, longitude) {
  const p1 = Number(latitude) * Math.PI / 180;
  const p2 = 21.4225 * Math.PI / 180;
  const l1 = Number(longitude) * Math.PI / 180;
  const l2 = 39.8262 * Math.PI / 180;
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceToKaaba(latitude, longitude) {
  const R = 6371;
  const p1 = Number(latitude) * Math.PI / 180;
  const p2 = 21.4225 * Math.PI / 180;
  const dp = (21.4225 - Number(latitude)) * Math.PI / 180;
  const dl = (39.8262 - Number(longitude)) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compassPoint(degrees) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  const d = (((Number(degrees) || 0) % 360) + 360) % 360;
  return names[Math.round(d / 45) % 8];
}

function compactPlace(parts) {
  const seen = new Set();
  return parts.map(v => String(v || '').trim()).filter(v => {
    const key = v.toLowerCase();
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3).join(', ');
}

async function reversePlace(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`, { cache:'no-store' });
    if (r.ok) {
      const j = await r.json();
      const place = compactPlace([j.locality || j.city || j.principalSubdivision, j.principalSubdivision, j.countryName]);
      if (place) return place;
    }
  } catch {}
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { cache:'no-store' });
    if (r.ok) {
      const p = (await r.json())?.features?.[0]?.properties || {};
      const place = compactPlace([p.city || p.town || p.village || p.name, p.state, p.country]);
      if (place) return place;
    }
  } catch {}
  return 'Current GPS location';
}

function polar(radius, degrees) {
  const a = (degrees - 90) * Math.PI / 180;
  return [500 + Math.cos(a) * radius, 500 + Math.sin(a) * radius];
}

function qiblaCompassSvg() {
  const ticks = [];
  for (let d = 0; d < 360; d += 2) {
    const major = d % 20 === 0;
    const medium = !major && d % 10 === 0;
    const [x1,y1] = polar(447,d);
    const [x2,y2] = polar(major ? 405 : medium ? 418 : 428,d);
    ticks.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${major ? '#eef4f8' : '#8ba0af'}" stroke-width="${major ? 3.2 : medium ? 2 : 1.2}" opacity="${major ? .95 : medium ? .72 : .55}"/>`);
  }
  const labels = [];
  for (let d = 0; d < 360; d += 20) {
    const [x,y] = polar(370,d);
    labels.push(`<text x="${x.toFixed(1)}" y="${(y+10).toFixed(1)}" text-anchor="middle" fill="#cbd7df" font-size="25" font-weight="700">${String(d).padStart(3,'0')}</text>`);
  }
  const star = [];
  for (let d = 0; d < 360; d += 45) {
    const long = d % 90 === 0;
    const [tx,ty] = polar(long ? 270 : 205,d);
    const [lx,ly] = polar(long ? 62 : 48,d-90);
    const [rx,ry] = polar(long ? 62 : 48,d+90);
    star.push(`<polygon points="500,500 ${lx.toFixed(1)},${ly.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}" fill="${long ? 'url(#qbSilver)' : 'url(#qbDarkSilver)'}" stroke="#07101a" stroke-width="4"/>`);
  }
  return `<svg class="nx2-qb-svg" viewBox="0 0 1000 1000" role="img" aria-label="Live Qibla compass"><defs><radialGradient id="qbFace" cx="48%" cy="42%" r="66%"><stop offset="0" stop-color="#18304a"/><stop offset=".45" stop-color="#0f2235"/><stop offset="1" stop-color="#06111d"/></radialGradient><linearGradient id="qbRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6edf2"/><stop offset=".22" stop-color="#65717a"/><stop offset=".5" stop-color="#18232c"/><stop offset=".76" stop-color="#bac4ca"/><stop offset="1" stop-color="#323b42"/></linearGradient><linearGradient id="qbSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbfd"/><stop offset=".45" stop-color="#aab9c4"/><stop offset="1" stop-color="#364653"/></linearGradient><linearGradient id="qbDarkSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9eb0bd"/><stop offset=".5" stop-color="#475867"/><stop offset="1" stop-color="#172431"/></linearGradient><linearGradient id="qbGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a6"/><stop offset=".32" stop-color="#f2c44f"/><stop offset=".68" stop-color="#aa6918"/><stop offset="1" stop-color="#ffdc68"/></linearGradient><filter id="qbGlow"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="qbShadow"><feDropShadow dx="0" dy="11" stdDeviation="12" flood-color="#000" flood-opacity=".9"/></filter></defs><g data-qb-rotor filter="url(#qbShadow)"><circle cx="500" cy="500" r="478" fill="#050a10" stroke="url(#qbRing)" stroke-width="24"/><circle cx="500" cy="500" r="452" fill="url(#qbFace)" stroke="#677783" stroke-width="4"/><circle cx="500" cy="500" r="411" fill="none" stroke="#7c8c96" stroke-width="2" opacity=".75"/><circle cx="500" cy="500" r="337" fill="none" stroke="#31495d" stroke-width="2"/>${ticks.join('')}${labels.join('')}<g>${star.join('')}</g><text x="500" y="230" text-anchor="middle" fill="#f3f3ee" font-family="Georgia,serif" font-size="70" font-weight="700">N</text><text x="770" y="524" text-anchor="middle" fill="#eee" font-family="Georgia,serif" font-size="66" font-weight="700">E</text><text x="500" y="807" text-anchor="middle" fill="#eee" font-family="Georgia,serif" font-size="66" font-weight="700">S</text><text x="230" y="524" text-anchor="middle" fill="#eee" font-family="Georgia,serif" font-size="66" font-weight="700">W</text><circle cx="500" cy="500" r="81" fill="#0a1118" stroke="url(#qbRing)" stroke-width="12"/><circle cx="500" cy="500" r="42" fill="url(#qbGold)" stroke="#1c1305" stroke-width="8"/><circle cx="500" cy="500" r="23" fill="#12191e" stroke="#f0ce72" stroke-width="5"/></g><g data-qb-pointer filter="url(#qbGlow)"><line x1="500" y1="500" x2="500" y2="126" stroke="url(#qbGold)" stroke-width="16" stroke-linecap="round"/><polygon points="500,76 458,150 542,150" fill="url(#qbGold)" stroke="#6e430e" stroke-width="5"/><g transform="translate(450 18)"><polygon points="50,0 18,32 82,32" fill="#f3c94f" stroke="#7a4c0b" stroke-width="4"/><rect x="18" y="31" width="64" height="64" rx="4" fill="#050505" stroke="#d7aa35" stroke-width="4"/><rect x="18" y="48" width="64" height="10" fill="#d7aa35"/><rect x="35" y="68" width="12" height="27" fill="#b47715"/><rect x="55" y="68" width="10" height="14" fill="#b47715"/></g></g><g class="nx2-qb-device-arrow"><polygon points="500,96 484,128 516,128" fill="#eaf8ff"/></g></svg>`;
}

const qiblaStyles = `.nx2-qibla-screen>.nx-app-head{display:none!important}.nx2-qibla{display:block!important;width:100%!important;max-width:none!important;padding:0 0 28px!important;color:#f6f9fc;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.nx2-qibla *{box-sizing:border-box}.nx2-qibla button{font:inherit}.nx2-qb-page{padding:20px 16px 10px;border-radius:0;background:radial-gradient(circle at 50% 34%,rgba(0,97,162,.16),transparent 28%),linear-gradient(#030d17,#020a12);overflow:hidden}.nx2-qb-head{display:grid;grid-template-columns:52px 66px minmax(0,1fr) 52px 52px;gap:10px;align-items:center}.nx2-qb-btn,.nx2-qb-icon{height:52px;border:1px solid #234762;border-radius:16px;background:linear-gradient(145deg,#071724,#03101a);box-shadow:inset 0 1px rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.28)}.nx2-qb-btn{display:grid;place-items:center;color:#f4f8fb;font-size:30px;cursor:pointer}.nx2-qb-icon{display:grid;place-items:center;color:#35d9ff}.nx2-qb-icon svg{width:40px;height:40px;filter:drop-shadow(0 0 10px rgba(29,205,255,.5))}.nx2-qb-title strong{display:block;font-size:25px;line-height:1.05;letter-spacing:-.03em}.nx2-qb-title span{display:block;margin-top:6px;color:#9caec0;font-size:13px}.nx2-qb-menu{font-size:25px;letter-spacing:1px}.nx2-qb-grid{display:grid;grid-template-columns:minmax(92px,22%) minmax(0,56%) minmax(92px,22%);gap:12px;align-items:center;margin-top:30px}.nx2-qb-side{display:grid;gap:12px}.nx2-qb-card{min-height:142px;padding:14px 13px;border:1px solid #19415d;border-radius:18px;background:linear-gradient(150deg,rgba(5,26,42,.96),rgba(2,14,25,.98));box-shadow:inset 0 1px rgba(255,255,255,.035)}.nx2-qb-card span{display:block;color:#42cfff;font-size:9px;font-weight:800;letter-spacing:.04em}.nx2-qb-card strong{display:block;margin-top:12px;color:#f5f8fb;font-size:25px;line-height:1.05}.nx2-qb-card small{display:block;margin-top:7px;color:#9eb0c1;font-size:9px;line-height:1.35}.nx2-qb-card .nx2-qb-place{font-size:13px;line-height:1.28}.nx2-qb-card .nx2-qb-green{color:#35ec5d;font-size:15px}.nx2-qb-visual{position:relative;min-width:0}.nx2-qb-compass{width:min(100%,590px);aspect-ratio:1;margin:auto}.nx2-qb-svg{display:block;width:100%;height:100%;overflow:visible}.nx2-qb-mini{margin-top:14px;height:62px;position:relative}.nx2-qb-mini::before{content:"";position:absolute;left:16%;right:16%;top:30px;border-top:1px solid #154361}.nx2-qb-mini::after{content:"";position:absolute;left:50%;top:14px;width:14px;height:14px;border:3px solid #35bfff;border-radius:50%;transform:translateX(-50%);box-shadow:0 0 16px #159cff}.nx2-qb-mag{min-height:250px}.nx2-qb-mag-grid{display:grid;grid-template-columns:20px 1fr;gap:8px;margin-top:15px;color:#f1f5f8;font-size:11px}.nx2-qb-mag-grid b{color:#38cfff}.nx2-qb-statusline{margin-top:14px;padding-top:14px;border-top:1px solid #244256;color:#9fb0bf;font-size:10px}.nx2-qb-ready{display:grid;grid-template-columns:94px minmax(0,1fr) 180px;gap:18px;align-items:center;margin-top:28px;padding:18px 22px;border:1px solid #173f5a;border-radius:20px;background:linear-gradient(145deg,#061a2b,#03101b)}.nx2-qb-ready-icon{width:82px;height:82px;border:2px solid #20baff;border-radius:50%;display:grid;place-items:center;color:#35e5ff;font-size:40px;box-shadow:0 0 28px rgba(0,177,255,.28),inset 0 0 24px rgba(0,183,255,.16)}.nx2-qb-ready strong{display:block;font-size:17px}.nx2-qb-ready p{margin:7px 0 0;color:#9daec0;font-size:12px;line-height:1.45}.nx2-qb-ready-art{height:86px;border-radius:15px;background:linear-gradient(155deg,transparent 42%,rgba(0,130,216,.22)),radial-gradient(circle at 65% 70%,rgba(0,181,255,.26),transparent 32%);position:relative;overflow:hidden}.nx2-qb-ready-art::after{content:"KAABA";position:absolute;right:18px;bottom:18px;color:#32cfff;font-weight:900;letter-spacing:.12em}@media(max-width:700px){.nx2-qb-page{padding:16px 10px 12px}.nx2-qb-head{grid-template-columns:48px 56px minmax(0,1fr) 48px 48px;gap:7px}.nx2-qb-btn,.nx2-qb-icon{height:48px;border-radius:15px}.nx2-qb-title strong{font-size:21px}.nx2-qb-title span{font-size:11px}.nx2-qb-grid{grid-template-columns:minmax(78px,22%) minmax(0,56%) minmax(78px,22%);gap:7px;margin-top:22px}.nx2-qb-side{gap:8px}.nx2-qb-card{min-height:111px;padding:10px 8px;border-radius:15px}.nx2-qb-card span{font-size:7px}.nx2-qb-card strong{margin-top:8px;font-size:17px}.nx2-qb-card small{font-size:7px}.nx2-qb-card .nx2-qb-place{font-size:10px}.nx2-qb-card .nx2-qb-green{font-size:11px}.nx2-qb-mag{min-height:228px}.nx2-qb-ready{grid-template-columns:72px minmax(0,1fr);padding:15px;gap:12px}.nx2-qb-ready-icon{width:64px;height:64px;font-size:30px}.nx2-qb-ready-art{display:none}.nx2-qb-ready strong{font-size:14px}.nx2-qb-ready p{font-size:10px}}`;

function iconMarkup() { return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M38 8c-8 1-14 8-14 16 0 9 7 16 16 16 5 0 10-2 13-6-2 11-12 20-24 20-14 0-25-11-25-25 0-13 10-24 23-25 4 0 8 1 11 4z" fill="none" stroke="currentColor" stroke-width="3" opacity=".9"/><rect x="20" y="30" width="24" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 36h24M28 41v8" stroke="currentColor" stroke-width="2"/></svg>`; }

export function renderQiblaPremium() {
  const root = node(`<style>${qiblaStyles}</style><section class="nx2-qb-page"><header class="nx2-qb-head"><button class="nx2-qb-btn" type="button" data-qb-back aria-label="Back">‹</button><div class="nx2-qb-icon">${iconMarkup()}</div><div class="nx2-qb-title"><strong>Qibla Compass</strong><span>Find direction to Kaaba</span></div><button class="nx2-qb-btn" type="button" data-qb-enable aria-label="Activate compass">⌾</button><button class="nx2-qb-btn nx2-qb-menu" type="button" data-qb-menu aria-label="Compass menu">⋮</button></header><section class="nx2-qb-grid"><aside class="nx2-qb-side"><article class="nx2-qb-card"><span>QIBLA DIRECTION</span><strong data-qb-bearing>—</strong><small>From North</small><div class="nx2-qb-mini"></div></article><article class="nx2-qb-card"><span>DISTANCE</span><strong><b data-qb-distance>—</b> <small style="display:inline">km</small></strong><small>TO KAABA</small></article><article class="nx2-qb-card"><span>LOCATION</span><strong class="nx2-qb-place" data-qb-location>Locating…</strong><small data-qb-coords>—</small><div class="nx2-qb-mini"></div></article><article class="nx2-qb-card"><span>CALIBRATION</span><strong class="nx2-qb-green" data-qb-calibration>● Waiting</strong><small>Compass accuracy</small></article></aside><div class="nx2-qb-visual"><div class="nx2-qb-compass">${qiblaCompassSvg()}</div></div><aside class="nx2-qb-side"><article class="nx2-qb-card"><span>HEADING</span><strong data-qb-heading>—</strong><small data-qb-heading-point>From North</small><div class="nx2-qb-mini"></div></article><article class="nx2-qb-card nx2-qb-mag"><span>MAGNETOMETER</span><div class="nx2-qb-mag-grid"><b>X</b><span data-qb-mag-x>— µT</span><b>Y</b><span data-qb-mag-y>— µT</span><b>Z</b><span data-qb-mag-z>— µT</span></div><div class="nx2-qb-statusline">STATUS<br><strong class="nx2-qb-green" data-qb-field>Sensor unavailable</strong><small data-qb-strength>Field strength —</small></div></article></aside></section><section class="nx2-qb-ready"><div class="nx2-qb-ready-icon">✓</div><div><strong>Compass is ready</strong><p data-qb-status>Location and orientation are used only while this screen is open.</p></div><div class="nx2-qb-ready-art"></div></section></section>`);
  let screen = null, bearing = NaN, heading = 0, listening = false, magnetometer = null;
  const rotor=root.querySelector('[data-qb-rotor]'),pointer=root.querySelector('[data-qb-pointer]'),bearingEl=root.querySelector('[data-qb-bearing]'),distanceEl=root.querySelector('[data-qb-distance]'),locationEl=root.querySelector('[data-qb-location]'),coordsEl=root.querySelector('[data-qb-coords]'),headingEl=root.querySelector('[data-qb-heading]'),headingPointEl=root.querySelector('[data-qb-heading-point]'),calibrationEl=root.querySelector('[data-qb-calibration]'),statusEl=root.querySelector('[data-qb-status]'),fieldEl=root.querySelector('[data-qb-field]'),strengthEl=root.querySelector('[data-qb-strength]'),enableBtn=root.querySelector('[data-qb-enable]');
  queueMicrotask(() => { screen=root.closest('.nx-screen'); screen?.classList.add('nx2-qibla-screen'); });
  const shortest=(target,actual)=>{let delta=((target-actual+540)%360)-180;if(delta===-180)delta=180;return delta;};
  const paint=()=>{rotor?.setAttribute('transform',`rotate(${-heading.toFixed(2)} 500 500)`);if(Number.isFinite(bearing))pointer?.setAttribute('transform',`rotate(${shortest(bearing,heading).toFixed(2)} 500 500)`);if(Number.isFinite(bearing))bearingEl.textContent=`${Math.round(bearing)}°`;headingEl.textContent=`${Math.round(heading)}°`;headingPointEl.textContent=`${compassPoint(heading)} • From North`;const aligned=Number.isFinite(bearing)&&Math.abs(shortest(bearing,heading))<=3;calibrationEl.textContent=aligned?'● Excellent':listening?'● Active':'● Ready';enableBtn.textContent=listening?'◉':'⌾';};
  const onOrientation=event=>{const webkit=Number(event.webkitCompassHeading),alpha=Number(event.alpha);if(Number.isFinite(webkit))heading=webkit;else if(Number.isFinite(alpha))heading=(360-alpha+360)%360;paint();};
  const startMagnetometer=()=>{if(!('Magnetometer' in window)||magnetometer)return;try{magnetometer=new window.Magnetometer({frequency:10});magnetometer.addEventListener('reading',()=>{const x=Number(magnetometer.x),y=Number(magnetometer.y),z=Number(magnetometer.z);root.querySelector('[data-qb-mag-x]').textContent=Number.isFinite(x)?`${x.toFixed(1)} µT`:'— µT';root.querySelector('[data-qb-mag-y]').textContent=Number.isFinite(y)?`${y.toFixed(1)} µT`:'— µT';root.querySelector('[data-qb-mag-z]').textContent=Number.isFinite(z)?`${z.toFixed(1)} µT`:'— µT';const strength=Math.sqrt(x*x+y*y+z*z);if(Number.isFinite(strength)){fieldEl.textContent=strength>=20&&strength<=80?'Normal':'Check field';strengthEl.textContent=`Field strength ${strength.toFixed(1)} µT`;}});magnetometer.addEventListener('error',()=>{fieldEl.textContent='Sensor unavailable';});magnetometer.start();}catch{fieldEl.textContent='Sensor unavailable';}};
  const enableSensors=async()=>{try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const permission=await DeviceOrientationEvent.requestPermission();if(permission!=='granted')throw new Error('Motion permission was not granted.');}if(!listening){window.addEventListener('deviceorientationabsolute',onOrientation,true);window.addEventListener('deviceorientation',onOrientation,true);listening=true;}startMagnetometer();statusEl.textContent='Point the golden arrow towards the Kaaba for the correct Qibla direction.';paint();}catch(error){statusEl.textContent=error?.message||'Device orientation is unavailable.';}};
  currentPosition().then(async position=>{const lat=Number(position.coords.latitude),lon=Number(position.coords.longitude);bearing=bearingToKaaba(lat,lon);distanceEl.textContent=Math.round(distanceToKaaba(lat,lon)).toLocaleString();const ns=lat>=0?'N':'S',ew=lon>=0?'E':'W';coordsEl.textContent=`${Math.abs(lat).toFixed(4)}° ${ns} • ${Math.abs(lon).toFixed(4)}° ${ew}`;locationEl.textContent=await reversePlace(lat,lon);statusEl.textContent='Compass is ready. Point the golden arrow towards the Kaaba.';paint();if(typeof DeviceOrientationEvent==='undefined'||typeof DeviceOrientationEvent.requestPermission!=='function')enableSensors();}).catch(error=>{statusEl.textContent=error?.message||'Location permission is required to calculate Qibla.';});
  root.querySelector('[data-qb-back]').addEventListener('click',()=>screen?.querySelector(':scope > .nx-app-head [data-app-back]')?.click());root.querySelector('[data-qb-enable]').addEventListener('click',enableSensors);root.querySelector('[data-qb-menu]').addEventListener('click',()=>{statusEl.textContent='Compass uses live GPS and device orientation only while this screen is open.';});
  root.__cleanup=()=>{window.removeEventListener('deviceorientationabsolute',onOrientation,true);window.removeEventListener('deviceorientation',onOrientation,true);try{magnetometer?.stop?.();}catch{}screen?.classList.remove('nx2-qibla-screen');};return root;
}

export const premiumQiblaRenderers = Object.freeze({ qibla: renderQiblaPremium });
