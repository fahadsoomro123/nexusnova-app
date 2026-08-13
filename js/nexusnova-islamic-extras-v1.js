/* NexusNova Islamic Hub Extras v1
   Genuine browser/API features using Islamic Network / AlAdhan.
   No fabricated prayer times, Hijri dates, or Asma al-Husna data. */
(() => {
  'use strict';
  if (window.__nxIslamicExtrasV1) return;
  window.__nxIslamicExtrasV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const API = 'https://api.aladhan.com/v1';

  function output() {
    return $('nxMegaPrayerOut');
  }

  function setOut(html, asText = false) {
    const out = output();
    if (!out) return;
    if (asText) out.textContent = html;
    else out.innerHTML = html;
  }

  function button(label) {
    const wanted = label.toLowerCase();
    return Array.from(document.querySelectorAll('#tab-mega-islamic button')).find(btn =>
      String(btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === wanted
    );
  }

  function claim(label, id, handler) {
    const btn = button(label);
    if (!btn || btn.dataset.nxIslamicReady === '1') return false;
    btn.id = id;
    btn.dataset.nxIslamicReady = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return true;
  }

  function geolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location is not supported in this browser.'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      });
    });
  }

  async function liveTimings() {
    const pos = await geolocation();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const url = `${API}/timings?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error(`Prayer API HTTP ${response.status}`);
    const json = await response.json();
    if (json?.code !== 200 || !json?.data?.timings || !json?.data?.date) {
      throw new Error('Prayer API returned incomplete data.');
    }
    return json.data;
  }

  async function showHijri() {
    setOut('Loading current Hijri date…', true);
    try {
      const data = await liveTimings();
      const h = data.date.hijri || {};
      const g = data.date.gregorian || {};
      const month = h.month?.en || h.month?.ar || '';
      setOut(
        `<strong>${esc(h.day || '')} ${esc(month)} ${esc(h.year || '')} AH</strong>` +
        `<div style="margin-top:6px">Gregorian: ${esc(g.date || data.date.readable || '')}</div>` +
        `<small style="display:block;margin-top:7px">Source: AlAdhan / Islamic Network live calendar data.</small>`
      );
    } catch (error) {
      setOut(`Hijri date unavailable: ${error.message || 'request failed'}`, true);
    }
  }

  async function showSehriIftar() {
    setOut('Loading Sehri / Iftar times for your location…', true);
    try {
      const data = await liveTimings();
      const t = data.timings || {};
      const h = data.date.hijri || {};
      const sehri = t.Imsak || t.Fajr || '—';
      const iftar = t.Maghrib || t.Sunset || '—';
      setOut(
        `<strong>Sehri / Iftar — ${esc(h.day || '')} ${esc(h.month?.en || '')}</strong>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">` +
          `<div class="nxmega-item"><div><b>Sehri / Imsak</b><small>${esc(sehri)}</small></div></div>` +
          `<div class="nxmega-item"><div><b>Iftar / Maghrib</b><small>${esc(iftar)}</small></div></div>` +
        `</div>` +
        `<small style="display:block;margin-top:8px">Calculated live for your coordinates. Local mosque/authority timings may differ by a few minutes.</small>`
      );
    } catch (error) {
      setOut(`Sehri / Iftar unavailable: ${error.message || 'request failed'}`, true);
    }
  }

  function openRamadanCalendar() {
    const year = new Date().getFullYear();
    const url = `https://aladhan.com/ramadan-calendar/${year}`;
    if (typeof window.nxOpenExternal === 'function') window.nxOpenExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
    setOut(`Opened the official AlAdhan Ramadan calendar for ${year}.`, true);
  }

  async function showNames() {
    setOut('Loading Asma al-Husna…', true);
    try {
      const response = await fetch(`${API}/asmaAlHusna`, {cache:'force-cache'});
      if (!response.ok) throw new Error(`Asma API HTTP ${response.status}`);
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (!rows.length) throw new Error('No names returned.');
      setOut(
        `<strong>99 Names of Allah — live source</strong>` +
        `<div style="display:grid;gap:7px;margin-top:10px;max-height:420px;overflow:auto">` +
        rows.map(item => {
          const num = item.number ?? item.id ?? '';
          const arabic = item.name || item.arabic || '';
          const translit = item.transliteration || item.en?.name || '';
          const meaning = item.en?.meaning || item.en?.translation || item.meaning || '';
          return `<div class="nxmega-item"><div><b>${esc(num)}. ${esc(arabic)}</b>` +
            `<small>${esc(translit)}${meaning ? ` — ${esc(meaning)}` : ''}</small></div></div>`;
        }).join('') +
        `</div><small style="display:block;margin-top:8px">Source: AlAdhan / Islamic Network Asma al-Husna API.</small>`
      );
    } catch (error) {
      setOut(`99 Names unavailable: ${error.message || 'request failed'}`, true);
    }
  }

  function install() {
    if (!$('tab-mega-islamic')) return;
    claim('Hijri Calendar', 'nxIslamicHijriLive', showHijri);
    claim('Ramadan', 'nxIslamicRamadanLive', openRamadanCalendar);
    claim('Sehri / Iftar', 'nxIslamicSehriIftarLive', showSehriIftar);
    claim('99 Names & Duas', 'nxIslamicNamesLive', showNames);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 1400), {once:true});
  } else {
    setTimeout(install, 1400);
  }
  [2200, 4000, 7000].forEach(ms => setTimeout(install, ms));
})();