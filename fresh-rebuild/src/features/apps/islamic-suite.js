import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const API = 'https://api.aladhan.com/v1';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function scopedKey(name) {
  try {
    const user = await requireFirebaseUser();
    return `nexus_fresh_${name}_${user.uid}`;
  } catch {
    return `nexus_fresh_${name}_device`;
  }
}

function openFreshApp(id) {
  if (typeof window.NexusNovaFresh?.openApp !== 'function') return false;
  window.NexusNovaFresh.openApp(id);
  return true;
}

function openExternal(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action: 'open', url: parsed.href }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url: parsed.href })) return true;
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    });
  });
}

async function liveTimings() {
  const position = await getLocation();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const response = await fetch(`${API}/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Prayer API HTTP ${response.status}`);
  const json = await response.json();
  if (json?.code !== 200 || !json?.data?.timings || !json?.data?.date) throw new Error('Prayer API returned incomplete data.');
  return json.data;
}

export function renderIslamicSuite() {
  const root = node(`
    <section class="nx-tool-card nx-tasbih">
      <p class="nx-eyebrow">DAILY DHIKR</p>
      <strong data-islamic-count>0</strong>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-islamic-add>COUNT +1</button>
        <button type="button" data-islamic-reset>RESET</button>
      </div>
      <p class="nx-tool-meta" data-islamic-count-status>Tasbeeh count is saved on this device for the signed-in account.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Live Islamic Utilities</strong>
      <div class="nx-two-col">
        <button type="button" data-islamic-hijri>HIJRI DATE</button>
        <button type="button" data-islamic-sehri>SEHRI / IFTAR</button>
      </div>
      <div class="nx-two-col">
        <button type="button" data-islamic-names>99 NAMES</button>
        <button type="button" data-islamic-ramadan>RAMADAN CALENDAR</button>
      </div>
      <p class="nx-tool-meta">Hijri/timing/name data comes from AlAdhan / Islamic Network. NexusNova does not fabricate religious source data.</p>
      <article class="nx-list-card" data-islamic-output><p>Select a live utility.</p></article>
    </section>

    <section class="nx-tool-card">
      <strong>Faith & Reading</strong>
      <div class="nx-two-col">
        <button type="button" data-faith-app="prayer-times">PRAYER TIMES</button>
        <button type="button" data-faith-app="qibla">QIBLA</button>
      </div>
      <div class="nx-two-col">
        <button type="button" data-faith-app="quran">QURAN</button>
        <button type="button" data-faith-app="hadith">HADITH</button>
      </div>
      <button type="button" data-faith-app="urdu-library">URDU LIBRARY</button>
    </section>
  `);

  const countEl = root.querySelector('[data-islamic-count]');
  const countStatus = root.querySelector('[data-islamic-count-status]');
  const output = root.querySelector('[data-islamic-output]');
  let tasbeehKey = '';
  let count = 0;

  scopedKey('tasbeeh_v1').then(key => {
    tasbeehKey = key;
    const saved = loadJson(key, null);
    if (Number.isFinite(Number(saved))) {
      count = Math.max(0, Number(saved));
    } else {
      const legacy = Number(localStorage.getItem('nexus_tasbeeh') || 0);
      count = Number.isFinite(legacy) ? Math.max(0, legacy) : 0;
      saveJson(key, count);
      if (count > 0) countStatus.textContent = 'Previous Tasbeeh count migrated to the fresh account-scoped store.';
    }
    countEl.textContent = String(count);
  });

  root.querySelector('[data-islamic-add]').addEventListener('click', () => {
    count += 1;
    countEl.textContent = String(count);
    if (tasbeehKey) saveJson(tasbeehKey, count);
    if (navigator.vibrate) navigator.vibrate(20);
  });

  root.querySelector('[data-islamic-reset]').addEventListener('click', () => {
    count = 0;
    countEl.textContent = '0';
    if (tasbeehKey) saveJson(tasbeehKey, 0);
  });

  const setText = text => {
    output.innerHTML = '<p></p>';
    output.querySelector('p').textContent = text;
  };

  root.querySelector('[data-islamic-hijri]').addEventListener('click', async () => {
    setText('Loading current Hijri date…');
    try {
      const data = await liveTimings();
      const h = data.date?.hijri || {};
      const g = data.date?.gregorian || {};
      const month = h.month?.en || h.month?.ar || '';
      output.innerHTML = `<strong>${escapeHtml(h.day || '')} ${escapeHtml(month)} ${escapeHtml(h.year || '')} AH</strong><p>Gregorian: ${escapeHtml(g.date || data.date?.readable || '')}</p><small>Source: AlAdhan / Islamic Network live calendar data.</small>`;
    } catch (error) {
      setText(`Hijri date unavailable: ${error.message || 'request failed'}`);
    }
  });

  root.querySelector('[data-islamic-sehri]').addEventListener('click', async () => {
    setText('Loading Sehri / Iftar times for your location…');
    try {
      const data = await liveTimings();
      const timings = data.timings || {};
      const hijri = data.date?.hijri || {};
      const sehri = timings.Imsak || timings.Fajr || '—';
      const iftar = timings.Maghrib || timings.Sunset || '—';
      output.innerHTML = `<strong>Sehri / Iftar • ${escapeHtml(hijri.day || '')} ${escapeHtml(hijri.month?.en || '')}</strong><p>Sehri / Imsak: ${escapeHtml(sehri)}<br>Iftar / Maghrib: ${escapeHtml(iftar)}</p><small>Live location-based source. Local mosque/authority timing can differ by a few minutes.</small>`;
    } catch (error) {
      setText(`Sehri / Iftar unavailable: ${error.message || 'request failed'}`);
    }
  });

  root.querySelector('[data-islamic-names]').addEventListener('click', async () => {
    setText('Loading Asma al-Husna…');
    try {
      const response = await fetch(`${API}/asmaAlHusna`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Asma API HTTP ${response.status}`);
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (!rows.length) throw new Error('No names returned.');
      output.innerHTML = `<strong>99 Names of Allah • live source</strong><div class="nx-stack" style="margin-top:10px">${rows.map(item => {
        const number = item.number ?? item.id ?? '';
        const arabic = item.name || item.arabic || '';
        const transliteration = item.transliteration || item.en?.name || '';
        const meaning = item.en?.meaning || item.en?.translation || item.meaning || '';
        return `<article class="nx-list-card"><strong>${escapeHtml(number)}. ${escapeHtml(arabic)}</strong><p>${escapeHtml(transliteration)}${meaning ? ` • ${escapeHtml(meaning)}` : ''}</p></article>`;
      }).join('')}</div><small>Source: AlAdhan / Islamic Network Asma al-Husna API.</small>`;
    } catch (error) {
      setText(`99 Names unavailable: ${error.message || 'request failed'}`);
    }
  });

  root.querySelector('[data-islamic-ramadan]').addEventListener('click', () => {
    const year = new Date().getFullYear();
    if (openExternal(`https://aladhan.com/ramadan-calendar/${year}`)) setText(`Opened the official AlAdhan Ramadan calendar for ${year}.`);
    else setText('Could not open Ramadan calendar.');
  });

  root.querySelectorAll('[data-faith-app]').forEach(button => button.addEventListener('click', () => {
    if (!openFreshApp(button.dataset.faithApp)) setText('Fresh app navigation is unavailable.');
  }));

  return root;
}

export const islamicSuiteRenderers = Object.freeze({
  islamic: renderIslamicSuite
});
