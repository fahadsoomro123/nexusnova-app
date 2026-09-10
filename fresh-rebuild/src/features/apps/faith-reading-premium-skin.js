import { islamicSuiteRenderers } from './islamic-suite.js';
import { premiumQuranRenderers } from './premium-quran-reader.js';
import { hadithSafeRenderers } from './hadith-safe.js';
import { urduLibraryRenderers } from './urdu-library-suite.js';

function ensureFaithReadingSkin() {
  if (document.getElementById('nx-faith-reading-desk-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-faith-reading-desk-v1';
  style.textContent = `
    .nx-faith-desk{--frx:50%;--fry:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--frx) var(--fry),rgba(69,205,169,.10),transparent 25%),radial-gradient(circle at 91% 88%,rgba(63,163,255,.06),transparent 29%),linear-gradient(145deg,#15261f,#0a1814 58%,#07100d);box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -2px rgba(0,0,0,.76)}
    .nx-faith-desk--quran{background:radial-gradient(circle at var(--frx) var(--fry),rgba(72,218,186,.095),transparent 24%),radial-gradient(circle at 90% 88%,rgba(201,164,78,.045),transparent 29%),linear-gradient(145deg,#15251f,#0a1714 58%,#070f0d)}.nx-faith-desk--hadith{background:radial-gradient(circle at var(--frx) var(--fry),rgba(65,199,173,.09),transparent 24%),radial-gradient(circle at 90% 88%,rgba(79,171,220,.05),transparent 29%),linear-gradient(145deg,#152422,#0a1615 58%,#07100f)}.nx-faith-desk--library{background:radial-gradient(circle at var(--frx) var(--fry),rgba(130,166,230,.09),transparent 24%),radial-gradient(circle at 90% 88%,rgba(86,211,184,.055),transparent 29%),linear-gradient(145deg,#18242a,#0b161a 58%,#071014)}
    .nx-faith-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.032) 50%,transparent 58%);transform:translateX(-74%);animation:nxFaithSheen 11s ease-in-out infinite}
    .nx-faith-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(111,201,178,.12);border-radius:15px;background:linear-gradient(180deg,rgba(17,39,32,.97),rgba(7,20,16,.97));box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -2px rgba(0,0,0,.42),0 5px 12px rgba(0,0,0,.13)}.nx-faith-head>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-faith-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#65e7b2;box-shadow:0 0 0 3px rgba(101,231,178,.06),0 0 12px rgba(101,231,178,.34);animation:nxFaithLed 2.4s ease-in-out infinite}.nx-faith-copy{min-width:0}.nx-faith-copy strong{display:block;color:#eefcf7;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-faith-copy small{display:block;margin-top:2px;color:#71877d;font-size:5.8px;letter-spacing:.045em}.nx-faith-badge{padding:5px 7px;border:1px solid rgba(106,210,183,.11);border-radius:999px;background:rgba(72,190,158,.05);color:#a6ead4;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-faith-viewport{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 7px;scrollbar-width:thin}.nx-faith-viewport::-webkit-scrollbar{width:4px}.nx-faith-viewport::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(102,194,167,.18)}.nx-faith-viewport>.nx-app-body{max-width:none!important;padding:0!important}
    .nx-faith-desk button{border-radius:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -4px 6px rgba(0,0,0,.17),0 3px 0 rgba(2,13,10,.55),0 7px 11px rgba(0,0,0,.10)!important}.nx-faith-desk button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.24),0 1px 0 rgba(2,13,10,.55)!important}.nx-faith-desk input,.nx-faith-desk select{border:1px solid rgba(105,192,170,.11)!important;border-radius:12px!important;background:linear-gradient(180deg,#071511,#030b08)!important;color:#eefaf6!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.46),inset 0 -1px rgba(255,255,255,.03)!important}
    .nx-faith-desk--islamic .nx-tool-card{margin-bottom:7px!important;padding:11px!important;border:1px solid rgba(94,194,163,.105)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(78,220,174,.025),transparent 27%),linear-gradient(155deg,#11261e,#071710 68%,#050e0a)!important;box-shadow:inset 0 1px rgba(255,255,255,.065),inset 0 -3px rgba(0,0,0,.34),0 4px 0 rgba(2,10,7,.40),0 9px 17px rgba(0,0,0,.10)!important}.nx-faith-desk--islamic .nx-islamic-action-grid button{border-color:rgba(94,200,166,.10)!important;background:linear-gradient(180deg,#15362b,#0b2119)!important}.nx-faith-desk--islamic .nx-islamic-output{max-height:290px;overflow:auto;overscroll-behavior:contain}.nx-faith-desk--islamic .nx-ramadan-days,.nx-faith-desk--islamic .nx-islamic-names{max-height:250px;overflow:auto;overscroll-behavior:contain}
    .nx-faith-desk--quran .nxquran-console{position:sticky;top:0;z-index:5;margin:0 0 7px!important;border:1px solid rgba(91,199,165,.12)!important;border-radius:19px!important;background:linear-gradient(155deg,rgba(43,101,79,.15),rgba(7,24,17,.97))!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -3px rgba(0,0,0,.34),0 7px 16px rgba(0,0,0,.12)!important;backdrop-filter:blur(8px)}.nx-faith-desk--quran .nxquran-reader{border-radius:18px!important;background:linear-gradient(180deg,rgba(7,22,16,.94),rgba(4,13,9,.96))!important}.nx-faith-desk--quran .nxquran-surah-head{border-color:rgba(105,196,166,.10)!important;background:linear-gradient(180deg,#10291f,#081812)!important;box-shadow:inset 0 1px rgba(255,255,255,.055),0 4px 0 rgba(2,10,7,.34)!important}.nx-faith-desk--quran .nxquran-verse{border-color:rgba(102,190,159,.085)!important;background:linear-gradient(155deg,rgba(255,255,255,.022),transparent 30%),linear-gradient(180deg,#0e211a,#07140f)!important;box-shadow:inset 0 1px rgba(255,255,255,.045),inset 0 -2px rgba(0,0,0,.26),0 3px 0 rgba(2,9,6,.30)!important}.nx-faith-desk--quran .nxquran-arabic{font-size:clamp(1.38rem,5.6vw,1.82rem)!important;line-height:2.05!important;color:#fbfffd!important;text-shadow:0 1px 0 rgba(0,0,0,.5)}.nx-faith-desk--quran .nxquran-translation{font-size:.88rem!important;line-height:1.72!important;color:#c1d4cc!important}
    .nx-faith-desk--hadith .nx-tool-card{position:sticky;top:0;z-index:5;margin:0 0 7px!important;padding:10px!important;border:1px solid rgba(91,190,165,.11)!important;border-radius:18px!important;background:linear-gradient(155deg,rgba(49,107,88,.13),rgba(7,22,18,.97))!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 6px 15px rgba(0,0,0,.11)!important;backdrop-filter:blur(8px)}.nx-faith-desk--hadith .nx-scripture-reader{border:1px solid rgba(93,183,162,.10)!important;border-radius:18px!important;background:linear-gradient(180deg,#0d211d,#071512)!important;box-shadow:inset 0 1px rgba(255,255,255,.05),inset 0 -3px rgba(0,0,0,.28),0 7px 16px rgba(0,0,0,.10)!important}.nx-faith-desk--hadith .nx-verse{border-color:rgba(94,180,159,.085)!important;background:linear-gradient(180deg,#10231f,#081713)!important}.nx-faith-desk--hadith .nx-arabic-text{font-size:clamp(1.26rem,5.1vw,1.68rem)!important;line-height:2!important;color:#fbfffd!important}.nx-faith-desk--hadith .nx-translation{font-size:.9rem!important;line-height:1.8!important;color:#c5d8d1!important}
    .nx-faith-desk--library .nx-lib-hero{position:sticky;top:0;z-index:5;border:1px solid rgba(113,164,210,.12)!important;border-radius:19px!important;background:linear-gradient(155deg,rgba(45,74,101,.18),rgba(8,22,28,.97))!important;box-shadow:inset 0 1px rgba(255,255,255,.065),0 7px 16px rgba(0,0,0,.12)!important;backdrop-filter:blur(8px)}.nx-faith-desk--library .nx-lib-card{border:1px solid rgba(105,170,200,.10)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(255,255,255,.025),transparent 28%),linear-gradient(180deg,#10242b,#07161b)!important;box-shadow:inset 0 1px rgba(255,255,255,.05),inset 0 -2px rgba(0,0,0,.30),0 3px 0 rgba(2,9,12,.36)!important}.nx-faith-desk--library .nx-lib-reader{border:1px solid rgba(103,177,204,.11)!important;border-radius:18px!important;background:linear-gradient(180deg,#10232a,#071419)!important;box-shadow:inset 0 1px rgba(255,255,255,.055),0 8px 18px rgba(0,0,0,.12)!important}.nx-faith-desk--library .nx-lib-frame{border-radius:14px!important;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(119,189,214,.08),0 7px 17px rgba(0,0,0,.15)}
    @keyframes nxFaithSheen{0%,28%{transform:translateX(-74%)}68%,100%{transform:translateX(74%)}}@keyframes nxFaithLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-faith-desk{padding:5px}.nx-faith-head{padding:7px 8px}.nx-faith-copy small{display:none}.nx-faith-desk--islamic .nx-tool-card{padding:9px!important}.nx-faith-desk--quran .nxquran-arabic{font-size:1.34rem!important}.nx-faith-desk--hadith .nx-arabic-text{font-size:1.24rem!important}}
    @media(max-height:720px){.nx-faith-desk{min-height:0}.nx-faith-head{padding:5px 7px}.nx-faith-copy small{display:none}.nx-faith-desk--islamic .nx-islamic-output{max-height:210px}.nx-faith-desk--islamic .nx-ramadan-days,.nx-faith-desk--islamic .nx-islamic-names{max-height:180px}}
    @media(prefers-reduced-motion:reduce){.nx-faith-desk::before,.nx-faith-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureFaithReadingSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-faith-desk ${className}`;
  const head = document.createElement('div');
  head.className = 'nx-faith-head';
  head.innerHTML = `<div><i class="nx-faith-led"></i><span class="nx-faith-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-faith-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-faith-viewport';
  viewport.append(body);
  root.append(head, viewport);
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--frx', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--fry', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  const baseCleanup = body.__cleanup;
  root.__cleanup = () => { root.removeEventListener('pointermove', move); baseCleanup?.(); };
  return root;
}

export const faithReadingPremiumRenderers = Object.freeze({
  islamic: () => wrap(islamicSuiteRenderers.islamic, 'nx-faith-desk--islamic', 'FAITH DAILY DESK', 'TASBEEH • ALADHAN LIVE UTILITIES • FOCUSED READERS', 'SOURCE SAFE'),
  quran: () => wrap(premiumQuranRenderers.quran, 'nx-faith-desk--quran', 'QURAN READING DESK', 'UTHMANI ARABIC • PUBLISHED TRANSLATION • SOURCE UNCHANGED', 'ALQURAN CLOUD'),
  hadith: () => wrap(hadithSafeRenderers.hadith, 'nx-faith-desk--hadith', 'HADITH READING DESK', 'ARABIC + URDU SOURCE EDITIONS • ABORT-SAFE LOADING', 'SOURCE TEXT'),
  'urdu-library': () => wrap(urduLibraryRenderers['urdu-library'], 'nx-faith-desk--library', 'URDU LIBRARY READING ROOM', 'INTERNET ARCHIVE • IN-APP READER • RIGHTS RESPECTED', 'LIVE CATALOG')
});
