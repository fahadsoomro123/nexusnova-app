const SOS_CONTACT_KEY = 'nexusnova_emergency_sos_contact_v1';
const SOS_STYLE_ID = 'nx-emergency-sos-style-v1';
const SOS_BUTTON_ID = 'nxEmergencySosButton';
const SOS_MODAL_ID = 'nxEmergencySosModal';

function normalizePhone(raw) {
  let phone = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^03\d{9}$/.test(phone)) phone = `+92${phone.slice(1)}`;
  return /^\+?\d{7,15}$/.test(phone) ? phone : '';
}

function familyContacts() {
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || '';
    if (!key.startsWith('nexusnova_family_members_v1:') && !key.startsWith('nexus_fresh_family_v1_')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed)) continue;
      parsed.forEach(row => {
        const name = String(row?.name || '').trim().slice(0, 80);
        const relation = String(row?.relation || '').trim().slice(0, 80);
        const phone = normalizePhone(row?.phone);
        if (!name || !phone) return;
        const signature = `${name.toLowerCase()}|${phone}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        rows.push({ name, relation, phone });
      });
    } catch {}
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function storedContact() {
  try {
    const row = JSON.parse(localStorage.getItem(SOS_CONTACT_KEY) || 'null');
    const phone = normalizePhone(row?.phone);
    const name = String(row?.name || '').trim().slice(0, 80);
    return phone ? { phone, name: name || phone } : null;
  } catch {
    return null;
  }
}

function saveContact(contact) {
  const phone = normalizePhone(contact?.phone);
  if (!phone) return false;
  localStorage.setItem(SOS_CONTACT_KEY, JSON.stringify({
    phone,
    name: String(contact?.name || phone).trim().slice(0, 80)
  }));
  return true;
}

function injectStyles() {
  if (document.getElementById(SOS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SOS_STYLE_ID;
  style.textContent = `
#${SOS_BUTTON_ID}{position:fixed;right:14px;bottom:calc(86px + env(safe-area-inset-bottom));z-index:2147483000;width:58px;height:58px;border:0;border-radius:50%;background:linear-gradient(145deg,#ff5252,#b60018 72%);color:#fff;font:900 17px/1 system-ui,-apple-system,sans-serif;letter-spacing:.7px;box-shadow:0 10px 30px rgba(181,0,24,.45),inset 0 1px 0 rgba(255,255,255,.35);display:grid;place-items:center;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}
#${SOS_BUTTON_ID}:active{transform:scale(.94)}
#${SOS_BUTTON_ID}[data-busy="1"]{opacity:.72;pointer-events:none}
#${SOS_MODAL_ID}{position:fixed;inset:0;z-index:2147483200;background:rgba(1,7,15,.76);backdrop-filter:blur(7px);display:grid;place-items:center;padding:20px}
#${SOS_MODAL_ID}[hidden]{display:none}
.nx-sos-card{width:min(430px,100%);border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#0b1624;color:#eef7ff;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:20px}
.nx-sos-card h2{margin:0 0 8px;font:800 24px/1.15 system-ui,-apple-system,sans-serif}.nx-sos-card p{margin:0 0 16px;color:#a9bac8;font:500 14px/1.55 system-ui,-apple-system,sans-serif}
.nx-sos-field{display:grid;gap:7px;margin:12px 0}.nx-sos-field span{font:700 12px/1 system-ui,-apple-system,sans-serif;color:#c9d6e0}.nx-sos-field select,.nx-sos-field input{width:100%;box-sizing:border-box;border:1px solid #26394b;border-radius:12px;background:#07111d;color:#fff;padding:13px 12px;font:600 15px system-ui,-apple-system,sans-serif;outline:none}
.nx-sos-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:16px}.nx-sos-actions button{border:0;border-radius:13px;padding:13px 10px;font:800 13px system-ui,-apple-system,sans-serif;cursor:pointer}.nx-sos-cancel{background:#172638;color:#dbe8f2}.nx-sos-send{background:#d90c27;color:#fff}.nx-sos-note{margin-top:12px!important;font-size:12px!important;color:#8da1b2!important}
`;
  document.head.appendChild(style);
}

function smsUri(phone, body) {
  return `sms:${phone}?body=${encodeURIComponent(body)}`;
}

function mapUrl(lat, lon) {
  const a = Number(lat).toFixed(6);
  const b = Number(lon).toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(a)}&mlon=${encodeURIComponent(b)}#map=17/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
}

function emergencyMessage(position) {
  const time = new Date().toLocaleString();
  if (!position) {
    return `EMERGENCY SOS — I may be in danger. Please contact me or check on me immediately. My live GPS location could not be obtained. Time: ${time}`;
  }
  const lat = Number(position.coords.latitude);
  const lon = Number(position.coords.longitude);
  const accuracy = Math.round(Number(position.coords.accuracy) || 0);
  return `EMERGENCY SOS — I may be in danger. Please contact me or check on me immediately.\nLocation: ${lat.toFixed(6)}, ${lon.toFixed(6)}\nMap: ${mapUrl(lat, lon)}\nAccuracy: about ${accuracy} m\nTime: ${time}`;
}

function currentPosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000
    });
  });
}

async function copyFallback(text) {
  try { await navigator.clipboard.writeText(text); } catch {}
}

async function sendTo(contact, button) {
  if (!contact?.phone) return;
  button.dataset.busy = '1';
  const original = button.textContent;
  button.textContent = 'GPS';
  try { navigator.vibrate?.([90, 70, 90]); } catch {}
  const position = await currentPosition();
  const message = emergencyMessage(position);
  await copyFallback(message);
  button.textContent = 'SEND';
  setTimeout(() => {
    window.location.href = smsUri(contact.phone, message);
    setTimeout(() => {
      button.dataset.busy = '0';
      button.textContent = original;
    }, 900);
  }, 60);
}

function setupModal(button) {
  let modal = document.getElementById(SOS_MODAL_ID);
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = SOS_MODAL_ID;
  modal.hidden = true;
  modal.innerHTML = `
    <div class="nx-sos-card" role="dialog" aria-modal="true" aria-labelledby="nxSosTitle">
      <h2 id="nxSosTitle">Emergency SOS</h2>
      <p>Choose one trusted contact. After setup, tapping the red SOS button gets your current GPS location and opens an emergency SMS to that contact.</p>
      <label class="nx-sos-field"><span>Family contact</span><select data-sos-select><option value="">Choose saved contact</option></select></label>
      <label class="nx-sos-field"><span>Or phone number</span><input data-sos-phone inputmode="tel" maxlength="18" placeholder="03XXXXXXXXX"></label>
      <label class="nx-sos-field"><span>Name</span><input data-sos-name maxlength="80" placeholder="Trusted person"></label>
      <div class="nx-sos-actions"><button class="nx-sos-cancel" type="button" data-sos-cancel>CANCEL</button><button class="nx-sos-send" type="button" data-sos-save>SET & SEND SOS</button></div>
      <p class="nx-sos-note" data-sos-status>Coordinates are read only when SOS is pressed and are not stored by this module.</p>
    </div>`;
  document.body.appendChild(modal);

  const select = modal.querySelector('[data-sos-select]');
  const phone = modal.querySelector('[data-sos-phone]');
  const name = modal.querySelector('[data-sos-name]');
  const status = modal.querySelector('[data-sos-status]');
  const refresh = () => {
    const contacts = familyContacts();
    select.innerHTML = '<option value="">Choose saved contact</option>' + contacts.map((item, i) => `<option value="${i}">${item.name}${item.relation ? ` — ${item.relation}` : ''} • ${item.phone}</option>`).join('');
    select._contacts = contacts;
  };
  refresh();

  select.addEventListener('change', () => {
    const item = select._contacts?.[Number(select.value)];
    if (!item) return;
    phone.value = item.phone;
    name.value = item.name;
  });
  modal.querySelector('[data-sos-cancel]').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
  modal.querySelector('[data-sos-save]').addEventListener('click', async () => {
    const contact = { phone: normalizePhone(phone.value), name: name.value.trim() || phone.value.trim() };
    if (!contact.phone) {
      status.textContent = 'Enter or choose a valid phone number.';
      return;
    }
    saveContact(contact);
    modal.hidden = true;
    await sendTo(contact, button);
  });
  modal._refreshContacts = refresh;
  return modal;
}

function bootEmergencySos() {
  if (document.getElementById(SOS_BUTTON_ID)) return;
  injectStyles();
  const button = document.createElement('button');
  button.id = SOS_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'SOS';
  button.setAttribute('aria-label', 'Send emergency SOS to trusted contact');
  document.body.appendChild(button);
  const modal = setupModal(button);

  button.addEventListener('click', async () => {
    const contact = storedContact();
    if (!contact) {
      modal._refreshContacts?.();
      modal.hidden = false;
      return;
    }
    await sendTo(contact, button);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEmergencySos, { once: true });
else bootEmergencySos();
