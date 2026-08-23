import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const API = 'https://api.aladhan.com/v1';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-islamic-suite';
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

async function fetchAlAdhan(path) {
  const response = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Prayer API HTTP ${response.status}`);
  const json = await response.json();
  if (json?.code !== 200 || !json?.data) throw new Error('Prayer API returned incomplete data.');
  return json.data;
}

async function liveTimings() {
  const position = await getLocation();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const data = await fetchAlAdhan(`/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
  if (!data?.timings || !data?.date) throw new Error('Prayer API returned incomplete timing data.');
  return data;
}

function cleanTime(value) {
  return String(value || '—').replace(/\s*\([^)]*\)\s*$/, '').trim() || '—';
}

async function liveRamadanCalendar() {
  const position = await getLocation();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const today = await fetchAlAdhan(`/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
  const currentHijri = today?.date?.hijri || {};
  const currentYear = Number(currentHijri.year);
  const currentMonth = Number(currentHijri.month?.number);
  if (!Number.isFinite(currentYear) || !Number.isFinite(currentMonth)) throw new Error('Current Hijri date is unavailable.');

  const ramadanYear = currentMonth > 9 ? currentYear + 1 : currentYear;
  const calendar = await fetchAlAdhan(`/hijriCalendar/${ramadanYear}/9?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
  const rows = Array.isArray(calendar) ? calendar : [];
  if (!rows.length) throw new Error('Ramadan calendar returned no days.');
  return { rows, ramadanYear };
}

export function renderIslamicSuite() {
  const root = node(`
    <section class="nx-tool-card nx-tasbih nx-islamic-hero">
      <div>
        <p class="nx-eyebrow">DAILY DHIKR</p>
        <strong data-islamic-count>0</strong>
        <span>Tasbeeh</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-islamic-add>COUNT +1</button>
        <button type="button" data-islamic-reset>RESET</button>
      </div>
      <p class="nx-tool-meta" data-islamic-count-status>Tasbeeh count is saved on this device for the signed-in account.</p>
    </section>

    <section class="nx-tool-card nx-islamic-utilities">
      <div class="nx-islamic-section-head">
        <div><p class="nx-eyebrow">LIVE • LOCATION AWARE</p><strong>Islamic Utilities</strong></div>
        <span>AlAdhan</span>
      </div>
      <div class="nx-islamic-action-grid">
        <button type="button" data-islamic-hijri><b>Hijri</b><span>Current date</span></button>
        <button type="button" data-islamic-sehri><b>Sehri / Iftar</b><span>Today</span></button>
        <button type="button" data-islamic-names><b>99 Names</b><span>Asma al-Husna</span></button>
        <button class="nx-islamic-featured" type="button" data-islamic-ramadan><b>Ramadan</b><span>Full calendar</span></button>
      </div>
      <p class="nx-tool-meta">Hijri, prayer-time and name data comes from AlAdhan / Islamic Network. NexusNova does not fabricate religious source data.</p>
      <article class="nx-list-card nx-islamic-output" data-islamic-output><p>Select a live utility.</p></article>
    </section>

    <section class="nx-tool-card nx-islamic-reading">
      <div class="nx-islamic-section-head"><div><p class="nx-eyebrow">FAITH & READING</p><strong>Open a focused reader</strong></div></div>
      <div class="nx-islamic-action-grid">
        <button type="button" data-faith-app="prayer-times"><b>Prayer Times</b><span>Daily schedule</span></button>
        <button type="button" data-faith-app="qibla"><b>Qibla</b><span>Direction</span></button>
        <button type="button" data-faith-app="quran"><b>Quran</b><span>Reader</span></button>
        <button type="button" data-faith-app="hadith"><b>Hadith</b><span>Collections</span></button>
      </div>
      <button class="nx-islamic-wide" type="button" data-faith-app="urdu-library">URDU LIBRARY</button>
    </section>
  `);

  const countEl = root.querySelector('[data-islamic-count]');
  const countStatus = root.querySelector('[data-islamic-count-status]');
  const output = root.querySelector('[data-islamic-output]');
  let tasbeehKey = '';
  let count = 0;
  let ramadanBusy = false;

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
      output.innerHTML = `<div class="nx-islamic-result"><span>HIJRI DATE</span><strong>${escapeHtml(h.day || '')} ${escapeHtml(month)} ${escapeHtml(h.year || '')} AH</strong><p>Gregorian: ${escapeHtml(g.date || data.date?.readable || '')}</p><small>Source: AlAdhan / Islamic Network live calendar data.</small></div>`;
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
      const sehri = cleanTime(timings.Imsak || timings.Fajr);
      const iftar = cleanTime(timings.Maghrib || timings.Sunset);
      output.innerHTML = `<div class="nx-islamic-result"><span>SEHRI / IFTAR</span><strong>${escapeHtml(hijri.day || '')} ${escapeHtml(hijri.month?.en || '')}</strong><div class="nx-islamic-time-pair"><div><span>SEHRI</span><b>${escapeHtml(sehri)}</b></div><div><span>IFTAR</span><b>${escapeHtml(iftar)}</b></div></div><small>Live location-based source. Local mosque/authority timing can differ by a few minutes.</small></div>`;
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
      output.innerHTML = `<div class="nx-islamic-result"><span>ASMA AL-HUSNA</span><strong>99 Names of Allah</strong><div class="nx-stack nx-islamic-names" style="margin-top:10px">${rows.map(item => {
        const number = item.number ?? item.id ?? '';
        const arabic = item.name || item.arabic || '';
        const transliteration = item.transliteration || item.en?.name || '';
        const meaning = item.en?.meaning || item.en?.translation || item.meaning || '';
        return `<article class="nx-list-card"><strong>${escapeHtml(number)}. ${escapeHtml(arabic)}</strong><p>${escapeHtml(transliteration)}${meaning ? ` • ${escapeHtml(meaning)}` : ''}</p></article>`;
      }).join('')}</div><small>Source: AlAdhan / Islamic Network Asma al-Husna API.</small></div>`;
    } catch (error) {
      setText(`99 Names unavailable: ${error.message || 'request failed'}`);
    }
  });

  root.querySelector('[data-islamic-ramadan]').addEventListener('click', async () => {
    if (ramadanBusy) return;
    ramadanBusy = true;
    setText('Loading your live Ramadan calendar…');
    try {
      const { rows, ramadanYear } = await liveRamadanCalendar();
      const timezone = String(rows[0]?.meta?.timezone || '').trim();
      output.innerHTML = `
        <div class="nx-ramadan-calendar">
          <header class="nx-ramadan-head">
            <div><span>RAMADAN • LIVE CALENDAR</span><strong>Ramadan ${escapeHtml(ramadanYear)} AH</strong><p>${rows.length} days${timezone ? ` • ${escapeHtml(timezone)}` : ''}</p></div>
            <div class="nx-ramadan-moon">☾</div>
          </header>
          <div class="nx-ramadan-columns"><span>DAY</span><span>DATE</span><span>SEHRI</span><span>IFTAR</span></div>
          <div class="nx-ramadan-days">${rows.map((day, index) => {
            const hijri = day?.date?.hijri || {};
            const gregorian = day?.date?.gregorian || {};
            const timings = day?.timings || {};
            const dayNo = hijri.day || String(index + 1);
            const gregorianText = gregorian.date || day?.date?.readable || '';
            const sehri = cleanTime(timings.Imsak || timings.Fajr);
            const fajr = cleanTime(timings.Fajr);
            const iftar = cleanTime(timings.Maghrib || timings.Sunset);
            const isha = cleanTime(timings.Isha);
            return `<article class="nx-ramadan-day"><b>${escapeHtml(dayNo)}</b><div><strong>${escapeHtml(gregorianText)}</strong><span>Fajr ${escapeHtml(fajr)} • Isha ${escapeHtml(isha)}</span></div><strong>${escapeHtml(sehri)}</strong><strong>${escapeHtml(iftar)}</strong></article>`;
          }).join('')}</div>
          <footer>Location-based AlAdhan timings • local mosque or authority timing may differ by a few minutes.</footer>
        </div>`;
    } catch (error) {
      setText(`Ramadan calendar unavailable: ${error.message || 'request failed'}`);
    } finally {
      ramadanBusy = false;
    }
  });

  root.querySelectorAll('[data-faith-app]').forEach(button => button.addEventListener('click', () => {
    if (!openFreshApp(button.dataset.faithApp)) setText('Fresh app navigation is unavailable.');
  }));

  return root;
}

export const islamicSuiteRenderers = Object.freeze({
  islamic: renderIslamicSuite
});
