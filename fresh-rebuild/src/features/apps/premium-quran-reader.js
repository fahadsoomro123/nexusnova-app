import { escapeHtml } from '../../core/local-store.js';

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

export function renderQuranPremium() {
  const root = node(`
    <section class="nxquran-console">
      <header><div><span>QURAN READER</span><strong>Focused Reading</strong></div><b data-quran-source>ALQURAN CLOUD</b></header>
      <div class="nxquran-controls">
        <label><span>SURAH</span><select data-quran-surah>${Array.from({ length:114 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select></label>
        <label><span>TRANSLATION</span><select data-quran-edition>
          <option value="ur.jalandhry">Urdu • Jalandhry</option>
          <option value="en.sahih">English • Sahih International</option>
        </select></label>
        <button class="nxpi-action" type="button" data-quran-load>OPEN SURAH</button>
      </div>
      <p class="nxpi-status" data-quran-status>Arabic Uthmani text and the selected published translation are loaded from the source API. NexusNova does not machine-translate scripture.</p>
    </section>
    <section class="nxquran-reader" data-quran-reader></section>
  `, 'nx-quran-premium');

  const surah = root.querySelector('[data-quran-surah]');
  const edition = root.querySelector('[data-quran-edition]');
  const reader = root.querySelector('[data-quran-reader]');
  const status = root.querySelector('[data-quran-status]');
  const button = root.querySelector('[data-quran-load]');
  let busy = false;

  const loadCatalog = async () => {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah', { cache:'force-cache' });
      if (!response.ok) return;
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (!rows.length) return;
      const selected = surah.value;
      surah.innerHTML = rows.map(item => `<option value="${Number(item.number)}">${Number(item.number)} • ${escapeHtml(item.englishName || '')}</option>`).join('');
      surah.value = selected;
    } catch {}
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = 'LOADING';
    status.textContent = 'Loading verified Quran source text…';
    reader.innerHTML = '<div class="nx-empty">Loading source text…</div>';
    try {
      const n = Math.max(1, Math.min(114, Number(surah.value) || 1));
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,${encodeURIComponent(edition.value)}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Quran HTTP ${response.status}`);
      const json = await response.json();
      const sets = json?.data;
      if (!Array.isArray(sets) || sets.length < 2) throw new Error('Quran source response incomplete');
      const arabic = sets.find(item => item.edition?.identifier === 'quran-uthmani') || sets[0];
      const translated = sets.find(item => item !== arabic) || sets[1];
      const verses = Array.isArray(arabic.ayahs) ? arabic.ayahs : [];
      reader.innerHTML = `
        <header class="nxquran-surah-head">
          <div><span>SURAH ${n}</span><strong>${escapeHtml(arabic.englishName || `Surah ${n}`)}</strong><small>${escapeHtml(arabic.englishNameTranslation || '')} • ${escapeHtml(arabic.revelationType || '')}</small></div>
          <b dir="rtl">${escapeHtml(arabic.name || '')}</b>
        </header>
        <div class="nxquran-verses">${verses.map((ayah, index) => `
          <article class="nxquran-verse">
            <span class="nxquran-verse__no">${Number(ayah.numberInSurah)}</span>
            <div class="nxquran-arabic" dir="rtl">${escapeHtml(ayah.text)}</div>
            <div class="nxquran-translation" dir="${edition.value.startsWith('ur.') ? 'rtl' : 'ltr'}">${escapeHtml(translated.ayahs?.[index]?.text || '')}</div>
          </article>`).join('')}</div>`;
      status.textContent = `${verses.length} verses • ${translated.edition?.englishName || edition.value} • source text unchanged`;
      button.textContent = 'RELOAD SURAH';
    } catch (error) {
      reader.innerHTML = '<div class="nx-empty">Quran source is unavailable right now.</div>';
      status.textContent = 'Could not load the scripture source. NexusNova will not substitute generated religious text.';
      button.textContent = 'TRY AGAIN';
      console.warn('[NexusNova Premium] Quran:', error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  };

  button.addEventListener('click', load);
  surah.addEventListener('change', load);
  edition.addEventListener('change', load);
  loadCatalog();
  load();
  return root;
}

export const premiumQuranRenderers = Object.freeze({ quran: renderQuranPremium });
