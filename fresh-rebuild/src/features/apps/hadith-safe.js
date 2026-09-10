import { escapeHtml } from '../../core/local-store.js';

const HADITH_COLLECTIONS = [
  ['bukhari','Sahih al-Bukhari','صحیح بخاری'],
  ['muslim','Sahih Muslim','صحیح مسلم'],
  ['abudawud','Sunan Abu Dawud','سنن ابو داؤد'],
  ['tirmidhi','Jami at-Tirmidhi','جامع ترمذی'],
  ['nasai','Sunan an-Nasa’i','سنن نسائی'],
  ['ibnmajah','Sunan Ibn Majah','سنن ابن ماجہ'],
  ['malik','Muwatta Imam Malik','موطا امام مالک']
];

function hadithText(data) {
  const item = Array.isArray(data?.hadiths) ? data.hadiths[0] : (data?.hadith || data);
  return String(item?.text || item?.hadith || '').trim();
}

export function renderHadithSafe() {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = `
    <section class="nx-tool-card">
      <label class="nx-field"><span>Collection</span><select data-hadith-collection>${HADITH_COLLECTIONS.map(row => `<option value="${row[0]}">${row[2]} • ${row[1]}</option>`).join('')}</select></label>
      <div class="nx-inline-field"><input type="number" min="1" step="1" data-hadith-number value="1"><button type="button" data-hadith-load>LOAD</button></div>
      <p class="nx-tool-meta" data-hadith-status>Arabic + Urdu source editions via the fawazahmed0 Hadith API.</p>
    </section>
    <section class="nx-scripture-reader" data-hadith-reader></section>`;

  const collection = root.querySelector('[data-hadith-collection]');
  const number = root.querySelector('[data-hadith-number]');
  const reader = root.querySelector('[data-hadith-reader]');
  const status = root.querySelector('[data-hadith-status]');
  const loadButton = root.querySelector('[data-hadith-load]');
  let revision = 0;
  let controller = null;
  let active = true;

  const load = async () => {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const id = collection.value;
    const n = Math.max(1, Math.floor(Number(number.value) || 1));
    const meta = HADITH_COLLECTIONS.find(row => row[0] === id) || HADITH_COLLECTIONS[0];
    loadButton.disabled = true;
    status.textContent = `Loading ${meta[1]}…`;
    reader.innerHTML = '<div class="nx-empty">Loading source text…</div>';
    try {
      const base = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
      const [arResponse, urResponse] = await Promise.all([
        fetch(`${base}/ara-${id}/${n}.min.json`, { cache:'no-store', signal }),
        fetch(`${base}/urd-${id}/${n}.min.json`, { cache:'no-store', signal })
      ]);
      if (!arResponse.ok || !urResponse.ok) throw new Error('Hadith source unavailable');
      const [arabic, urdu] = await Promise.all([arResponse.json(), urResponse.json()]);
      if (!active || current !== revision) return;
      const arText = hadithText(arabic);
      const urText = hadithText(urdu);
      if (!arText && !urText) throw new Error('Hadith text missing');
      reader.innerHTML = `<header><strong>${escapeHtml(meta[1])} • ${n}</strong><span>${escapeHtml(meta[2])}</span></header><article class="nx-verse"><div class="nx-arabic-text" dir="rtl">${escapeHtml(arText)}</div><div class="nx-translation" dir="rtl">${escapeHtml(urText)}</div></article>`;
      status.textContent = `${meta[2]} • Hadith ${n} • Arabic + Urdu source text`;
    } catch (error) {
      if (!active || current !== revision || error?.name === 'AbortError') return;
      reader.innerHTML = '<div class="nx-empty">This Hadith number could not be loaded.</div>';
      status.textContent = 'Try another number or check the connection.';
      console.warn('[NexusNova Fresh] Hadith:', error);
    } finally {
      if (active && current === revision) loadButton.disabled = false;
    }
  };

  loadButton.addEventListener('click', load);
  collection.addEventListener('change', load);
  load();

  root.__cleanup = () => {
    active = false;
    revision += 1;
    controller?.abort();
    controller = null;
  };
  return root;
}

export const hadithSafeRenderers = Object.freeze({ hadith: renderHadithSafe });
