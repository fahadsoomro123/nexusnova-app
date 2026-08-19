import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
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

function openExternal(url) {
  try {
    const parsed = new URL(String(url));
    if (!['https:', 'tel:'].includes(parsed.protocol)) return false;
    if (parsed.protocol === 'https:' && typeof window.nexusPostNativeAction === 'function') {
      if (window.nexusPostNativeAction('openExternal', { url: parsed.href })) return true;
    }
    if (parsed.protocol === 'tel:') window.location.href = parsed.href;
    else window.open(parsed.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

export function renderFamilySuite() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col">
        <label class="nx-field"><span>Name</span><input maxlength="80" data-family-name placeholder="Family member"></label>
        <label class="nx-field"><span>Relation</span><input maxlength="80" data-family-relation placeholder="Parent, spouse, sibling…"></label>
      </div>
      <label class="nx-field"><span>Phone</span><input inputmode="tel" maxlength="18" data-family-phone placeholder="03XXXXXXXXX"></label>
      <button class="nx-primary" type="button" data-family-add>ADD FAMILY MEMBER</button>
      <p class="nx-tool-meta" data-family-status>Trusted family contacts stay on this device for the signed-in NexusNova account.</p>
    </section>

    <section class="nx-stack" data-family-list></section>

    <section class="nx-tool-card">
      <strong>One-time Location Check-in</strong>
      <p class="nx-tool-meta">Gets your current GPS position once and prepares a Google Maps link. NexusNova does not continuously track or upload your coordinates.</p>
      <button class="nx-primary" type="button" data-family-checkin>CREATE LOCATION CHECK-IN</button>
      <article class="nx-list-card" data-family-checkin-status><p>No check-in created.</p></article>
    </section>
  `);

  const name = root.querySelector('[data-family-name]');
  const relation = root.querySelector('[data-family-relation]');
  const phone = root.querySelector('[data-family-phone]');
  const status = root.querySelector('[data-family-status]');
  const list = root.querySelector('[data-family-list]');
  const checkInStatus = root.querySelector('[data-family-checkin-status]');
  let canonicalKey = '';
  let freshKey = '';

  const read = () => canonicalKey ? mergeMembers(canonicalKey, freshKey) : [];
  const write = rows => {
    const clean = rows.map(sanitizeMember).filter(Boolean).slice(-200);
    saveJson(canonicalKey, clean);
    saveJson(freshKey, clean);
  };

  const draw = () => {
    if (!canonicalKey) return;
    const items = read();
    list.innerHTML = items.length ? items.map(item => `
      <article class="nx-list-card">
        <div class="nx-list-card__head">
          <strong>${escapeHtml(item.name)} • ${escapeHtml(item.relation || 'Family')}</strong>
          <button class="nx-icon-button" type="button" data-family-delete="${escapeHtml(item.id)}">×</button>
        </div>
        <p>${escapeHtml(item.phone)}</p>
        <div class="nx-two-col">
          <button class="nx-primary" type="button" data-family-call="${escapeHtml(item.phone)}">CALL</button>
          <button type="button" data-family-wa="${escapeHtml(item.phone)}">WHATSAPP</button>
        </div>
      </article>
    `).join('') : '<div class="nx-empty">No family members added yet.</div>';

    list.querySelectorAll('[data-family-delete]').forEach(button => button.addEventListener('click', () => {
      write(read().filter(item => item.id !== button.dataset.familyDelete));
      status.textContent = 'Family member removed.';
      draw();
    }));
    list.querySelectorAll('[data-family-call]').forEach(button => button.addEventListener('click', () => {
      const value = normalizePhone(button.dataset.familyCall);
      if (value) openExternal(`tel:${value}`);
    }));
    list.querySelectorAll('[data-family-wa]').forEach(button => button.addEventListener('click', () => {
      const value = normalizePhone(button.dataset.familyWa);
      if (!value) return;
      openExternal(`https://wa.me/${encodeURIComponent(value.replace(/^\+/, ''))}`);
    }));
  };

  familyKeys().then(keys => {
    canonicalKey = keys.canonical;
    freshKey = keys.fresh;
    const beforeOld = Array.isArray(loadJson(canonicalKey, [])) ? loadJson(canonicalKey, []).length : 0;
    const beforeFresh = Array.isArray(loadJson(freshKey, [])) ? loadJson(freshKey, []).length : 0;
    const merged = mergeMembers(canonicalKey, freshKey);
    if (merged.length > Math.max(beforeOld, beforeFresh)) {
      status.textContent = 'Previous Family Hub contacts merged into the fresh account-scoped store.';
    }
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
    items.push({ id: uid('family'), name: cleanName, relation: cleanRelation, phone: cleanPhone, createdAt: Date.now() });
    write(items);
    name.value = '';
    relation.value = '';
    phone.value = '';
    status.textContent = 'Family member saved.';
    draw();
  });

  root.querySelector('[data-family-checkin]').addEventListener('click', () => {
    if (!navigator.geolocation) {
      checkInStatus.querySelector('p').textContent = 'Location is not supported on this device.';
      return;
    }
    checkInStatus.querySelector('p').textContent = 'Getting your current location…';
    navigator.geolocation.getCurrentPosition(async position => {
      const lat = Number(position.coords.latitude);
      const lon = Number(position.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        checkInStatus.querySelector('p').textContent = 'GPS returned an invalid location.';
        return;
      }
      const link = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(link);
        copied = true;
      } catch {}
      checkInStatus.innerHTML = `<strong>${copied ? 'Location check-in link copied.' : 'Location link ready.'}</strong><p>Coordinates were not saved.</p><button type="button" data-open-checkin>OPEN MAP</button>`;
      checkInStatus.querySelector('[data-open-checkin]').addEventListener('click', () => openExternal(link));
    }, error => {
      checkInStatus.querySelector('p').textContent = error.code === 1
        ? 'Location permission was denied.'
        : 'Could not get your current location.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });

  return root;
}

export const familySuiteRenderers = Object.freeze({ family: renderFamilySuite });
