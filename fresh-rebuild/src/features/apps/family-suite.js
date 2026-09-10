import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-family-suite';
  root.innerHTML = html;
  return root;
}

function normalizePhone(raw) {
  let phone = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^03\d{9}$/.test(phone)) phone = `+92${phone.slice(1)}`;
  return /^\+?\d{7,15}$/.test(phone) ? phone : '';
}

async function familyKeys() {
  try {
    const user = await requireFirebaseUser();
    const accountId = String(user?.uid || '').trim();
    if (!accountId) return { canonical: 'nexusnova_family_members_v1:device', fresh: 'nexus_fresh_family_v1_device' };
    return {
      canonical: `nexusnova_family_members_v1:${accountId}`,
      fresh: `nexus_fresh_family_v1_${accountId}`
    };
  } catch {
    return { canonical: 'nexusnova_family_members_v1:device', fresh: 'nexus_fresh_family_v1_device' };
  }
}

function sanitizeMember(row) {
  const name = String(row?.name || '').trim().slice(0, 80);
  const relation = String(row?.relation || '').trim().slice(0, 80);
  const phone = normalizePhone(row?.phone);
  if (!name || !phone) return null;
  return {
    id: String(row?.id || uid('family')),
    name,
    relation,
    phone,
    createdAt: Number(row?.createdAt) || Date.now()
  };
}

function mergeMembers(canonicalKey, freshKey) {
  const oldRows = loadJson(canonicalKey, []);
  const freshRows = loadJson(freshKey, []);
  const merged = [];
  const seen = new Set();

  [...(Array.isArray(oldRows) ? oldRows : []), ...(Array.isArray(freshRows) ? freshRows : [])].forEach(row => {
    const item = sanitizeMember(row);
    if (!item) return;
    const signature = `${item.name.toLowerCase()}|${item.phone}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    merged.push(item);
  });

  saveJson(canonicalKey, merged.slice(-200));
  saveJson(freshKey, merged.slice(-200));
  return merged;
}

function callPhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return false;
  window.location.href = `tel:${phone}`;
  return true;
}

function openWhatsApp(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return false;
  const url = `https://wa.me/${encodeURIComponent(phone.replace(/^\+/, ''))}`;
  try {
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url })) return true;
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}

function mapEmbedUrl(latitude, longitude, accuracy = 0) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';
  const span = Math.min(.035, Math.max(.004, (Number(accuracy) || 30) / 65000));
  const params = new URLSearchParams({
    bbox: `${lon - span},${lat - span},${lon + span},${lat + span}`,
    layer: 'mapnik',
    marker: `${lat},${lon}`
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function shareMapUrl(latitude, longitude) {
  const lat = Number(latitude).toFixed(6);
  const lon = Number(longitude).toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
}

export function renderFamilySuite() {
  const root = node(`
    <section class="nx-family-hero">
      <div><p class="nx-eyebrow">FAMILY • PRIVATE CONTACTS</p><strong>Your trusted people in one place</strong><p class="nx-tool-meta" data-family-status>Contacts stay on this device for the signed-in NexusNova account.</p></div>
      <span data-family-count>0</span>
    </section>

    <section class="nx-family-add">
      <div class="nx-family-fields">
        <label><span>Name</span><input maxlength="80" data-family-name placeholder="Family member"></label>
        <label><span>Relation</span><input maxlength="80" data-family-relation placeholder="Parent, spouse…"></label>
        <label class="wide"><span>Phone</span><input inputmode="tel" maxlength="18" data-family-phone placeholder="03XXXXXXXXX"></label>
      </div>
      <button class="nx-primary" type="button" data-family-add>ADD MEMBER</button>
    </section>

    <section class="nx-family-list" data-family-list></section>

    <section class="nx-family-checkin">
      <div class="nx-family-checkin__head">
        <div><p class="nx-eyebrow">ONE-TIME CHECK-IN</p><strong>Share where you are — only when you choose</strong></div>
        <span>GPS</span>
      </div>
      <p class="nx-tool-meta">Reads your current position once. NexusNova does not continuously track or save your coordinates.</p>
      <button class="nx-primary" type="button" data-family-checkin>CREATE LOCATION CHECK-IN</button>
      <div class="nx-family-checkin__map" data-family-map hidden>
        <iframe data-family-map-frame title="Family check-in map" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
        <div class="nx-family-checkin__info"><div><strong data-family-coords>—</strong><span data-family-updated>—</span></div><button type="button" data-family-copy-checkin>COPY CHECK-IN</button></div>
      </div>
      <p class="nx-tool-meta" data-family-checkin-status>No check-in created.</p>
    </section>
  `);

  const name = root.querySelector('[data-family-name]');
  const relation = root.querySelector('[data-family-relation]');
  const phone = root.querySelector('[data-family-phone]');
  const status = root.querySelector('[data-family-status]');
  const list = root.querySelector('[data-family-list]');
  const count = root.querySelector('[data-family-count]');
  const checkInButton = root.querySelector('[data-family-checkin]');
  const checkInStatus = root.querySelector('[data-family-checkin-status]');
  const checkInMap = root.querySelector('[data-family-map]');
  const checkInFrame = root.querySelector('[data-family-map-frame]');
  const checkInCoords = root.querySelector('[data-family-coords]');
  const checkInUpdated = root.querySelector('[data-family-updated]');
  const copyCheckIn = root.querySelector('[data-family-copy-checkin]');
  let canonicalKey = '';
  let freshKey = '';
  let currentCheckIn = null;
  let cancelled = false;

  const read = () => canonicalKey ? mergeMembers(canonicalKey, freshKey) : [];
  const write = rows => {
    const clean = rows.map(sanitizeMember).filter(Boolean).slice(-200);
    saveJson(canonicalKey, clean);
    saveJson(freshKey, clean);
  };

  const draw = () => {
    if (!canonicalKey) return;
    const items = read();
    count.textContent = String(items.length);
    list.innerHTML = items.length ? items.map(item => `
      <article class="nx-family-member">
        <div class="nx-family-member__avatar">${escapeHtml(item.name.slice(0, 1).toUpperCase())}</div>
        <div class="nx-family-member__body"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.relation || 'Family')} • ${escapeHtml(item.phone)}</span></div>
        <div class="nx-family-member__actions">
          <button type="button" data-family-call="${escapeHtml(item.phone)}">CALL</button>
          <button type="button" data-family-wa="${escapeHtml(item.phone)}">WHATSAPP</button>
          <button class="danger" type="button" data-family-delete="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">×</button>
        </div>
      </article>
    `).join('') : '<div class="nx-empty">No family members added yet.</div>';

    list.querySelectorAll('[data-family-delete]').forEach(button => button.addEventListener('click', () => {
      write(read().filter(item => item.id !== button.dataset.familyDelete));
      status.textContent = 'Family member removed.';
      draw();
    }));
    list.querySelectorAll('[data-family-call]').forEach(button => button.addEventListener('click', () => callPhone(button.dataset.familyCall)));
    list.querySelectorAll('[data-family-wa]').forEach(button => button.addEventListener('click', () => openWhatsApp(button.dataset.familyWa)));
  };

  familyKeys().then(keys => {
    canonicalKey = keys.canonical;
    freshKey = keys.fresh;
    const beforeOld = Array.isArray(loadJson(canonicalKey, [])) ? loadJson(canonicalKey, []).length : 0;
    const beforeFresh = Array.isArray(loadJson(freshKey, [])) ? loadJson(freshKey, []).length : 0;
    const merged = mergeMembers(canonicalKey, freshKey);
    if (merged.length > Math.max(beforeOld, beforeFresh)) status.textContent = 'Previous Family Hub contacts merged into the fresh account-scoped store.';
    draw();
  });

  root.querySelector('[data-family-add]').addEventListener('click', () => {
    if (!canonicalKey) return;
    const cleanName = name.value.trim().slice(0, 80);
    const cleanRelation = relation.value.trim().slice(0, 80);
    const cleanPhone = normalizePhone(phone.value);
    if (!cleanName || !cleanPhone) {
      status.textContent = 'Enter a name and a valid 7–15 digit phone number.';
      return;
    }
    const items = read();
    items.push({ id:uid('family'), name:cleanName, relation:cleanRelation, phone:cleanPhone, createdAt:Date.now() });
    write(items);
    name.value = '';
    relation.value = '';
    phone.value = '';
    status.textContent = 'Family member saved.';
    draw();
  });

  checkInButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      checkInStatus.textContent = 'Location is not supported on this device.';
      return;
    }
    checkInButton.disabled = true;
    checkInButton.textContent = 'LOCATING…';
    checkInStatus.textContent = 'Getting your current GPS position…';
    navigator.geolocation.getCurrentPosition(position => {
      if (cancelled) return;
      const lat = Number(position.coords.latitude);
      const lon = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy) || 0;
      const embed = mapEmbedUrl(lat, lon, accuracy);
      if (!embed) {
        checkInStatus.textContent = 'GPS returned an invalid location.';
        checkInButton.disabled = false;
        checkInButton.textContent = 'CREATE LOCATION CHECK-IN';
        return;
      }
      currentCheckIn = { lat, lon, url:shareMapUrl(lat, lon) };
      checkInFrame.src = embed;
      checkInCoords.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      checkInUpdated.textContent = `Accuracy ${Math.round(accuracy || 0)} m • ${new Date(position.timestamp || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
      checkInMap.hidden = false;
      checkInStatus.textContent = 'One-time check-in ready. Coordinates were not saved.';
      checkInButton.disabled = false;
      checkInButton.textContent = 'REFRESH CHECK-IN';
    }, error => {
      if (cancelled) return;
      checkInStatus.textContent = error.code === 1 ? 'Location permission was denied.' : 'Could not get your current location.';
      checkInButton.disabled = false;
      checkInButton.textContent = 'TRY AGAIN';
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:30000 });
  });

  copyCheckIn.addEventListener('click', async () => {
    if (!currentCheckIn) return;
    const text = `My current location: ${currentCheckIn.lat.toFixed(6)}, ${currentCheckIn.lon.toFixed(6)}\n${currentCheckIn.url}`;
    try {
      await navigator.clipboard.writeText(text);
      checkInStatus.textContent = 'Check-in copied. You can paste it into a message to a trusted person.';
    } catch {
      checkInStatus.textContent = `Check-in: ${currentCheckIn.lat.toFixed(6)}, ${currentCheckIn.lon.toFixed(6)}`;
    }
  });

  root.__cleanup = () => {
    cancelled = true;
    checkInFrame.removeAttribute('src');
    currentCheckIn = null;
  };
  return root;
}

export const familySuiteRenderers = Object.freeze({ family:renderFamilySuite });
