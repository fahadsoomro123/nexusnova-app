import {
  createNovaVehiclePairing,
  loadNovaVehicleDashboard,
  revokeNovaVehicle
} from './core/nova-vehicle-premium-store.js';

const attached = new WeakSet();
const POLL_MS = 10_000;

function ago(ms) {
  const value = Math.max(0, Date.now() - (Number(ms) || 0));
  if (!ms) return 'Never';
  if (value < 15_000) return 'Now';
  if (value < 60_000) return `${Math.floor(value / 1000)}s ago`;
  if (value < 3_600_000) return `${Math.floor(value / 60_000)}m ago`;
  return `${Math.floor(value / 3_600_000)}h ago`;
}

function coord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(5) : '—';
}

function isOnline(vehicle) {
  const last = Number(vehicle?.lastSeenAt) || Number(vehicle?.live?.receivedAt) || 0;
  return vehicle?.trackerBound === true && last > 0 && Date.now() - last < 120_000;
}

function openMap(vehicle) {
  const lat = Number(vehicle?.live?.latitude);
  const lng = Number(vehicle?.live?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function styles() {
  return `<style data-nv-premium-style>
  .nxdr3{position:relative!important}
  .nxdr3-bottom{grid-template-columns:minmax(0,1fr) auto auto!important}
  .nxdr3-vehicle{min-width:92px;border:1px solid rgba(146,113,255,.28);border-radius:14px;background:linear-gradient(180deg,rgba(51,36,101,.95),rgba(12,29,57,.96));color:#e8e0ff;font-size:6.5px;font-weight:950;letter-spacing:.055em;padding:0 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 18px rgba(73,70,255,.12)}
  .nxdr3-vehicle[hidden]{display:none!important}
  .nxvp{position:absolute;inset:5px;z-index:80;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:7px;padding:9px;border:1px solid rgba(95,204,255,.22);border-radius:21px;overflow:hidden;background:radial-gradient(circle at 72% 3%,rgba(118,74,255,.2),transparent 30%),radial-gradient(circle at 20% 50%,rgba(37,184,255,.14),transparent 32%),linear-gradient(165deg,#07182b 0%,#020a14 66%,#02060d 100%);box-shadow:0 24px 80px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.06);color:#f5fbff}
  .nxvp[hidden]{display:none!important}.nxvp *{box-sizing:border-box}
  .nxvp-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px}.nxvp-head small{display:block;color:#65ddff;font-size:6px;font-weight:950;letter-spacing:.18em}.nxvp-head strong{display:block;margin-top:2px;font-size:17px;letter-spacing:-.035em}.nxvp-head span{display:block;margin-top:2px;color:#839db2;font-size:7px}.nxvp-close{width:34px;height:34px;border:1px solid rgba(126,185,225,.18);border-radius:12px;background:linear-gradient(160deg,#102940,#061523);color:#d9f3ff;font-size:17px}
  .nxvp-strip{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 8px;border:1px solid rgba(91,183,246,.14);border-radius:14px;background:linear-gradient(145deg,rgba(13,40,66,.88),rgba(5,22,38,.9))}.nxvp-strip strong{display:block;font-size:9px}.nxvp-strip span{display:block;margin-top:2px;color:#7f9db4;font-size:7px}.nxvp-pill{padding:6px 8px;border-radius:999px;border:1px solid rgba(36,229,129,.18);background:rgba(14,79,57,.38);color:#80ffc0;font-size:6px;font-weight:950;letter-spacing:.1em}.nxvp-pill.off{border-color:rgba(255,167,81,.2);background:rgba(99,55,15,.3);color:#ffc981}
  .nxvp-main{min-height:0;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(116px,.88fr);gap:7px}.nxvp-radar,.nxvp-data{min-height:0;border:1px solid rgba(101,181,235,.13);border-radius:18px;background:linear-gradient(155deg,rgba(9,31,51,.92),rgba(3,15,27,.95));overflow:hidden}
  .nxvp-radar{position:relative;display:grid;place-items:center;padding:8px}.nxvp-orbit{position:relative;width:min(100%,27vh,220px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(70,207,255,.25);background:repeating-radial-gradient(circle,transparent 0 19%,rgba(66,184,255,.1) 20% 20.7%),linear-gradient(90deg,transparent 49.5%,rgba(80,200,255,.16) 50%,transparent 50.5%),linear-gradient(transparent 49.5%,rgba(80,200,255,.16) 50%,transparent 50.5%),radial-gradient(circle,rgba(23,144,215,.17),rgba(3,12,22,.3) 69%);box-shadow:inset 0 0 32px rgba(30,172,255,.12),0 0 30px rgba(29,150,255,.09)}.nxvp-orbit:after{content:"";position:absolute;inset:7%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 70%,rgba(68,213,255,.19) 89%,rgba(68,213,255,.45) 100%);mask:radial-gradient(circle,transparent 0 10%,#000 11%);-webkit-mask:radial-gradient(circle,transparent 0 10%,#000 11%)}.nxvp-dot{position:absolute;left:50%;top:50%;width:13px;height:13px;transform:translate(-50%,-50%);border-radius:50%;background:#53e6ff;border:2px solid #dffbff;box-shadow:0 0 0 7px rgba(74,216,255,.09),0 0 22px rgba(74,216,255,.8)}.nxvp-location{position:absolute;left:12px;right:12px;bottom:9px;text-align:center}.nxvp-location strong{display:block;font-size:8px}.nxvp-location span{display:block;margin-top:2px;color:#7395ad;font-size:6.5px}
  .nxvp-data{padding:7px;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-content:start}.nxvp-card{min-width:0;padding:7px 6px;border:1px solid rgba(113,184,234,.1);border-radius:12px;background:rgba(4,20,34,.72)}.nxvp-card span{display:block;color:#7895aa;font-size:6px;font-weight:900;letter-spacing:.06em}.nxvp-card strong{display:block;margin-top:3px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxvp-card.wide{grid-column:1/-1}.nxvp-card.wide strong{font-size:8px}
  .nxvp-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.nxvp-btn{min-height:35px;border:1px solid rgba(91,194,255,.19);border-radius:13px;background:linear-gradient(180deg,rgba(13,61,89,.95),rgba(5,30,49,.97));color:#c9f4ff;font-size:7px;font-weight:950;letter-spacing:.07em}.nxvp-btn.purple{border-color:rgba(155,124,255,.2);background:linear-gradient(180deg,rgba(62,42,111,.92),rgba(24,25,66,.96));color:#eee8ff}.nxvp-btn.danger{border-color:rgba(255,102,122,.18);background:linear-gradient(180deg,rgba(82,30,43,.9),rgba(39,17,26,.95));color:#ffc1cb}.nxvp-btn:disabled{opacity:.5}
  .nxvp-codebox{position:absolute;inset:auto 9px 9px 9px;z-index:3;padding:10px;border:1px solid rgba(103,204,255,.24);border-radius:16px;background:linear-gradient(155deg,rgba(7,31,51,.98),rgba(3,14,27,.99));box-shadow:0 16px 45px rgba(0,0,0,.7)}.nxvp-codebox[hidden]{display:none}.nxvp-codebox small{display:block;color:#78dfff;font-size:6px;font-weight:950;letter-spacing:.14em}.nxvp-code{display:block;margin:5px 0;font-size:23px;letter-spacing:.13em;color:#fff;text-align:center}.nxvp-codebox p{margin:0;color:#8aa4b8;font-size:7px;text-align:center}.nxvp-code-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
  @media(max-height:720px){.nxvp{gap:5px;padding:7px}.nxvp-head strong{font-size:15px}.nxvp-orbit{width:min(100%,23vh,175px)}.nxvp-card{padding:5px}.nxvp-btn{min-height:31px}.nxvp-code{font-size:20px}}
  @media(max-width:355px){.nxdr3-vehicle{min-width:76px;padding:0 5px;font-size:5.8px}.nxvp-main{grid-template-columns:minmax(0,1fr) 112px}.nxvp-orbit{width:min(100%,23vh,170px)}}
  </style>`;
}

function buildPanel(root) {
  root.insertAdjacentHTML('beforeend', `${styles()}<section class="nxvp" data-nv-panel hidden aria-label="Nova Vehicle Premium">
    <header class="nxvp-head"><div><small>PRIVATE VEHICLE TELEMETRY</small><strong>Nova Vehicle Premium</strong><span>Secure companion tracker • owner-only control</span></div><button type="button" class="nxvp-close" data-nv-close aria-label="Close">×</button></header>
    <div class="nxvp-strip"><div><strong data-nv-name>No tracker paired</strong><span data-nv-seen>Pair a hidden NexusNova Tracker phone</span></div><b class="nxvp-pill off" data-nv-online>OFFLINE</b></div>
    <div class="nxvp-main">
      <article class="nxvp-radar"><div class="nxvp-orbit"><i class="nxvp-dot"></i></div><div class="nxvp-location"><strong data-nv-coords>Location —</strong><span data-nv-accuracy>Waiting for secure telemetry</span></div></article>
      <aside class="nxvp-data">
        <div class="nxvp-card"><span>SPEED</span><strong data-nv-speed>0 km/h</strong></div>
        <div class="nxvp-card"><span>BATTERY</span><strong data-nv-battery>—</strong></div>
        <div class="nxvp-card"><span>POWER</span><strong data-nv-power>—</strong></div>
        <div class="nxvp-card"><span>HEADING</span><strong data-nv-heading>—</strong></div>
        <div class="nxvp-card wide"><span>SECURE STATUS</span><strong data-nv-status>No paired tracker yet.</strong></div>
      </aside>
    </div>
    <footer class="nxvp-actions"><button class="nxvp-btn purple" type="button" data-nv-pair>PAIR TRACKER</button><button class="nxvp-btn" type="button" data-nv-map disabled>OPEN MAP</button><button class="nxvp-btn danger" type="button" data-nv-revoke disabled>REVOKE</button></footer>
    <div class="nxvp-codebox" data-nv-codebox hidden><small>ONE-TIME PAIRING CODE • EXPIRES IN 10 MIN</small><strong class="nxvp-code" data-nv-code>—</strong><p>Enter this code once in the private NexusNova Tracker companion app.</p><div class="nxvp-code-actions"><button class="nxvp-btn" type="button" data-nv-copy>COPY CODE</button><button class="nxvp-btn purple" type="button" data-nv-code-close>DONE</button></div></div>
  </section>`);
  return root.querySelector('[data-nv-panel]');
}

function attach(root) {
  if (!(root instanceof HTMLElement) || attached.has(root)) return;
  const footer = root.querySelector('.nxdr3-bottom');
  const recover = root.querySelector('[data-dr-recover]');
  if (!footer || !recover) return;
  attached.add(root);

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'nxdr3-vehicle';
  launcher.textContent = 'NOVA VEHICLE PREMIUM';
  launcher.hidden = true;
  footer.insertBefore(launcher, recover);
  const panel = buildPanel(root);
  if (!panel) return;

  const q = selector => panel.querySelector(selector);
  const nameEl = q('[data-nv-name]');
  const seenEl = q('[data-nv-seen]');
  const onlineEl = q('[data-nv-online]');
  const coordsEl = q('[data-nv-coords]');
  const accuracyEl = q('[data-nv-accuracy]');
  const speedEl = q('[data-nv-speed]');
  const batteryEl = q('[data-nv-battery]');
  const powerEl = q('[data-nv-power]');
  const headingEl = q('[data-nv-heading]');
  const statusEl = q('[data-nv-status]');
  const pairBtn = q('[data-nv-pair]');
  const mapBtn = q('[data-nv-map]');
  const revokeBtn = q('[data-nv-revoke]');
  const codebox = q('[data-nv-codebox]');
  const codeEl = q('[data-nv-code]');
  let current = null;
  let busy = false;
  let polling = null;

  const paint = payload => {
    const vehicles = Array.isArray(payload?.vehicles) ? payload.vehicles : [];
    current = vehicles.find(v => v?.trackerBound) || vehicles[0] || null;
    const live = current?.live || null;
    const online = isOnline(current);
    if (nameEl) nameEl.textContent = current?.displayName || 'No tracker paired';
    if (seenEl) seenEl.textContent = current ? `${current.trackerBound ? 'Tracker paired' : 'Awaiting tracker'} • ${ago(current.lastSeenAt)}` : 'Pair a hidden NexusNova Tracker phone';
    if (onlineEl) {
      onlineEl.textContent = online ? 'ONLINE' : current?.trackerBound ? 'OFFLINE' : 'UNPAIRED';
      onlineEl.classList.toggle('off', !online);
    }
    if (coordsEl) coordsEl.textContent = live ? `${coord(live.latitude)}, ${coord(live.longitude)}` : 'Location —';
    if (accuracyEl) accuracyEl.textContent = live ? `GPS ±${Math.round(live.accuracyM || 0)}m • ${ago(live.receivedAt || current?.lastSeenAt)}` : 'Waiting for secure telemetry';
    if (speedEl) speedEl.textContent = `${Math.round(live?.speedKmh || 0)} km/h`;
    if (batteryEl) batteryEl.textContent = live ? `${Math.round(live.batteryPct || 0)}%` : '—';
    if (powerEl) powerEl.textContent = live ? (live.externalPower || live.charging ? 'CONNECTED' : 'BATTERY') : '—';
    if (headingEl) headingEl.textContent = live ? `${Math.round(live.heading || 0)}°` : '—';
    if (statusEl) statusEl.textContent = online ? 'Encrypted device token accepted • live telemetry healthy.' : current?.trackerBound ? 'Tracker paired but no fresh telemetry in the last 2 minutes.' : current ? 'Pairing created; tracker has not claimed it yet.' : 'No paired tracker yet.';
    if (mapBtn) mapBtn.disabled = !live;
    if (revokeBtn) revokeBtn.disabled = !current?.trackerBound;
    if (pairBtn) pairBtn.textContent = current ? 'PAIR NEW' : 'PAIR TRACKER';
  };

  const probeEntitlement = async () => {
    try {
      const payload = await loadNovaVehicleDashboard();
      if (!root.isConnected || payload?.entitled !== true) return;
      launcher.hidden = false;
      paint(payload);
    } catch {
      launcher.hidden = true;
      panel.hidden = true;
    }
  };

  const refresh = async () => {
    if (busy || panel.hidden) return;
    try {
      const payload = await loadNovaVehicleDashboard();
      if (payload?.entitled !== true) {
        launcher.hidden = true;
        panel.hidden = true;
        return;
      }
      if (root.isConnected) paint(payload);
    } catch (error) {
      if (error?.code === 'premium_required' || error?.status === 403) {
        launcher.hidden = true;
        panel.hidden = true;
        return;
      }
      if (statusEl) statusEl.textContent = error?.message || 'Nova Vehicle Premium is unavailable.';
    }
  };

  const open = () => {
    if (launcher.hidden) return;
    panel.hidden = false;
    refresh();
    clearInterval(polling);
    polling = setInterval(refresh, POLL_MS);
  };
  const close = () => {
    panel.hidden = true;
    codebox.hidden = true;
    clearInterval(polling);
    polling = null;
  };

  launcher.addEventListener('click', open);
  q('[data-nv-close]')?.addEventListener('click', close);
  q('[data-nv-code-close]')?.addEventListener('click', () => { codebox.hidden = true; refresh(); });
  q('[data-nv-copy]')?.addEventListener('click', async () => {
    const code = String(codeEl?.textContent || '').trim();
    if (!code || code === '—') return;
    try { await navigator.clipboard.writeText(code); if (statusEl) statusEl.textContent = 'Pairing code copied.'; } catch { if (statusEl) statusEl.textContent = `Pairing code: ${code}`; }
  });
  pairBtn?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    pairBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Creating secure one-time pairing…';
    try {
      const result = await createNovaVehiclePairing(`Vehicle ${Math.max(1, (current ? 2 : 1))}`);
      if (codeEl) codeEl.textContent = result.pairingCode;
      codebox.hidden = false;
      if (statusEl) statusEl.textContent = `Pairing ready for ${result.vehicleName}.`;
    } catch (error) {
      if (statusEl) statusEl.textContent = error?.message || 'Pairing could not be created.';
    } finally {
      busy = false;
      pairBtn.disabled = false;
    }
  });
  mapBtn?.addEventListener('click', () => {
    if (!openMap(current) && statusEl) statusEl.textContent = 'Live location is not available yet.';
  });
  revokeBtn?.addEventListener('click', async () => {
    if (busy || !current?.vehicleId) return;
    busy = true;
    revokeBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Revoking tracker access…';
    try {
      await revokeNovaVehicle(current.vehicleId);
      current = null;
      await refresh();
    } catch (error) {
      if (statusEl) statusEl.textContent = error?.message || 'Tracker access could not be revoked.';
    } finally {
      busy = false;
      revokeBtn.disabled = !current?.trackerBound;
    }
  });

  probeEntitlement();

  const life = setInterval(() => {
    if (root.isConnected) return;
    clearInterval(life);
    clearInterval(polling);
  }, 1500);
}

function scan(node = document) {
  if (node instanceof HTMLElement && node.matches('.nxdr3')) attach(node);
  node.querySelectorAll?.('.nxdr3').forEach(attach);
}

scan();
new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof HTMLElement) scan(node);
  }));
}).observe(document.documentElement, { childList:true, subtree:true });
