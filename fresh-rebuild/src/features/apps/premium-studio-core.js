import { firebaseApp } from '../../core/firebase-backend.js';

let aiModulePromise = null;
let pdfPromise = null;

export function ensureStudioStyles() {
  if (document.getElementById('nx-premium-studio-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-premium-studio-v1';
  style.textContent = `
    html:has(.nx-studio),body:has(.nx-studio){overflow:hidden!important;overscroll-behavior:none!important}
    .nx-screen:has(.nx-studio){height:calc(100dvh - 82px)!important;max-height:calc(100dvh - 82px)!important;min-height:0!important;overflow:hidden!important;background:linear-gradient(180deg,#0d1c2a,#07131f)!important}
    .nx-screen:has(.nx-studio)>[data-app-mount]{display:block;height:calc(100% - 86px)!important;min-height:0!important;overflow:hidden!important;padding-bottom:0!important}
    .nx-screen:has(.nx-studio) .nx-app-head{height:78px!important;min-height:78px!important;box-sizing:border-box!important;margin-bottom:6px!important;overflow:hidden!important}
    .nx-screen:has(.nx-studio) .nx-app-head>div>p:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nx-studio{--studio:#62d8ff;--studio2:#4a8dff;position:relative;isolation:isolate;width:100%;height:100%;min-height:0;box-sizing:border-box;overflow:hidden;padding:10px;border:1px solid color-mix(in srgb,var(--studio) 28%,transparent);border-radius:28px;background:radial-gradient(circle at 12% 2%,color-mix(in srgb,var(--studio) 22%,transparent),transparent 31%),radial-gradient(circle at 94% 92%,color-mix(in srgb,var(--studio2) 18%,transparent),transparent 34%),linear-gradient(145deg,#172737 0%,#0d1c2b 42%,#091623 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.17),inset 0 -3px 0 rgba(0,0,0,.36),0 18px 45px rgba(0,0,0,.28)}
    .nx-studio::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(115deg,transparent 28%,rgba(255,255,255,.055) 44%,transparent 58%);transform:translateX(-95%);animation:nxStudioSheen 8s ease-in-out infinite}
    .nx-studio__chrome{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:8px}
    .nx-studio__hero{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:linear-gradient(180deg,rgba(35,58,78,.96),rgba(13,29,43,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -3px 7px rgba(0,0,0,.3),0 7px 17px rgba(0,0,0,.18)}
    .nx-studio__hero small{display:block;color:color-mix(in srgb,var(--studio) 78%,white);font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.nx-studio__hero strong{display:block;margin-top:3px;color:#f7fbff;font-size:14px;line-height:1.05}.nx-studio__hero p{margin:3px 0 0;color:#9fb0c0;font-size:8px;line-height:1.2}.nx-studio__badge{display:grid;place-items:center;min-width:50px;height:36px;padding:0 9px;border:1px solid color-mix(in srgb,var(--studio) 33%,transparent);border-radius:13px;background:linear-gradient(180deg,color-mix(in srgb,var(--studio) 28%,#173047),color-mix(in srgb,var(--studio2) 20%,#0a1a29));box-shadow:inset 0 1px 0 rgba(255,255,255,.19),inset 0 -3px 6px rgba(0,0,0,.31),0 3px 0 rgba(0,0,0,.34);color:#fff;font-size:8px;font-weight:950;letter-spacing:.06em}
    .nx-studio__tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.nx-studio__tab{min-width:0;height:36px;padding:0 5px;border:1px solid rgba(151,179,204,.16);border-radius:12px;background:linear-gradient(180deg,#1a3044,#0b1b29);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -3px 5px rgba(0,0,0,.28),0 3px 0 #06101a;color:#8fa4b7;font-size:7.4px;font-weight:900;letter-spacing:.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-studio__tab.is-active{border-color:color-mix(in srgb,var(--studio) 45%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--studio) 35%,#1a3044),color-mix(in srgb,var(--studio2) 22%,#0b1b29));color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -3px 5px rgba(0,0,0,.25),0 3px 0 color-mix(in srgb,var(--studio) 30%,#04101a),0 0 16px color-mix(in srgb,var(--studio) 14%,transparent)}.nx-studio__tab:active,.nx-studio button:active{transform:translateY(2px)}
    .nx-studio__stage{position:relative;min-height:0;border:1px solid rgba(146,176,201,.12);border-radius:19px;overflow:hidden;background:radial-gradient(circle at 90% 4%,color-mix(in srgb,var(--studio) 9%,transparent),transparent 26%),linear-gradient(160deg,#112438,#081725 72%);box-shadow:inset 0 1px 0 rgba(255,255,255,.075),inset 0 -3px 9px rgba(0,0,0,.3)}
    .nx-studio__panel{display:none;height:100%;min-height:0;padding:10px;box-sizing:border-box;overflow:hidden}.nx-studio__panel.is-active{display:grid;align-content:stretch}.nx-studio__panel>.nx-studio-grid{height:100%;min-height:0;overflow:hidden}
    .nx-studio-grid{display:grid;gap:8px;min-height:0}.nx-studio-grid.two{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}.nx-studio-grid.rows{grid-template-rows:minmax(0,1fr) auto}.nx-studio-card{min-width:0;min-height:0;overflow:hidden;padding:9px;border:1px solid rgba(154,181,206,.12);border-radius:15px;background:linear-gradient(180deg,rgba(25,47,66,.88),rgba(9,24,37,.9));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -2px 5px rgba(0,0,0,.26),0 6px 12px rgba(0,0,0,.12)}
    .nx-studio-card strong{color:#eff8ff;font-size:9px}.nx-studio-card p,.nx-studio-note{margin:4px 0 0;color:#8ea2b5;font-size:7.2px;line-height:1.32}.nx-studio-field{display:grid;gap:4px}.nx-studio-field>span{color:#97aabd;font-size:6.8px;font-weight:850;letter-spacing:.035em}.nx-studio input,.nx-studio textarea,.nx-studio select{width:100%;min-width:0;box-sizing:border-box;border:1px solid rgba(142,172,198,.14);border-radius:10px;background:linear-gradient(180deg,#07131f,#04101a);box-shadow:inset 0 3px 8px rgba(0,0,0,.48),inset 0 -1px 0 rgba(255,255,255,.035);color:#edf7ff;font-size:8px;outline:none}.nx-studio input,.nx-studio select{height:34px;padding:0 9px}.nx-studio textarea{height:72px;padding:8px;resize:none;overflow:hidden}.nx-studio input:focus,.nx-studio textarea:focus,.nx-studio select:focus{border-color:color-mix(in srgb,var(--studio) 45%,transparent);box-shadow:inset 0 3px 8px rgba(0,0,0,.48),0 0 0 2px color-mix(in srgb,var(--studio) 10%,transparent)}
    .nx-studio button{border:1px solid color-mix(in srgb,var(--studio) 22%,rgba(255,255,255,.11));border-radius:11px;background:linear-gradient(180deg,color-mix(in srgb,var(--studio) 28%,#18364a),color-mix(in srgb,var(--studio2) 18%,#0a2130));box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -3px 5px rgba(0,0,0,.27),0 3px 0 #06131d;color:#eaf8ff;font-size:7.3px;font-weight:900;letter-spacing:.02em}.nx-studio button:disabled{opacity:.38;filter:saturate(.3)}.nx-studio-actions{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.nx-studio-actions button{height:34px;padding:0 7px}.nx-studio-primary{background:linear-gradient(180deg,color-mix(in srgb,var(--studio) 67%,#1c5874),color-mix(in srgb,var(--studio2) 48%,#102638))!important;color:white!important}
    .nx-studio-preview{position:relative;display:grid;place-items:center;min-height:0;height:100%;overflow:hidden;border:1px solid rgba(162,192,218,.13);border-radius:14px;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--studio) 12%,transparent),transparent 38%),linear-gradient(135deg,#12283a,#071522);box-shadow:inset 0 0 38px rgba(0,0,0,.36)}.nx-studio-preview canvas,.nx-studio-preview img,.nx-studio-preview video{display:block;max-width:100%;max-height:100%;object-fit:contain;border-radius:10px}.nx-studio-empty{display:grid;place-items:center;text-align:center;padding:16px;color:#6f8799;font-size:8px;line-height:1.45}.nx-studio-status{min-height:22px;max-height:38px;overflow:hidden;padding:6px 8px;border:1px solid rgba(140,169,192,.1);border-radius:9px;background:rgba(4,14,22,.52);color:#8da3b5;font-size:6.8px;line-height:1.25;box-sizing:border-box}.nx-studio-metric{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.nx-studio-metric>div{padding:7px;border:1px solid rgba(147,177,203,.11);border-radius:11px;background:linear-gradient(180deg,#132b3e,#081926);text-align:center}.nx-studio-metric b{display:block;color:#f4fbff;font-size:9px}.nx-studio-metric span{display:block;margin-top:2px;color:#72899b;font-size:6px}.nx-studio-range{display:grid;grid-template-columns:58px minmax(0,1fr) 34px;align-items:center;gap:5px}.nx-studio-range span{color:#8fa5b7;font-size:6.5px}.nx-studio-range output{color:#dff8ff;font-size:6.5px;text-align:right}.nx-studio-range input[type=range]{height:auto;padding:0;box-shadow:none;background:transparent}
    @keyframes nxStudioSheen{0%,28%{transform:translateX(-95%)}68%,100%{transform:translateX(95%)}}
    @media(max-width:520px){.nx-screen:has(.nx-studio) .nx-app-head{height:72px!important;min-height:72px!important}.nx-screen:has(.nx-studio)>[data-app-mount]{height:calc(100% - 78px)!important}.nx-studio{padding:7px;border-radius:23px}.nx-studio__chrome{gap:6px}.nx-studio__hero{padding:8px 9px}.nx-studio__hero p{display:none}.nx-studio__tab{height:32px;font-size:6.7px}.nx-studio__panel{padding:7px}.nx-studio-grid{gap:6px}.nx-studio-grid.two{grid-template-columns:minmax(0,1fr) minmax(0,.72fr)}.nx-studio-card{padding:7px}.nx-studio textarea{height:62px}.nx-studio-actions{gap:4px}.nx-studio-actions button{height:31px;font-size:6.6px}}
    @media(max-height:720px){.nx-screen:has(.nx-studio) .nx-app-head{height:64px!important;min-height:64px!important}.nx-screen:has(.nx-studio)>[data-app-mount]{height:calc(100% - 70px)!important}.nx-studio{padding:6px}.nx-studio__hero{padding:6px 8px}.nx-studio__hero p{display:none}.nx-studio__badge{height:30px}.nx-studio__tab{height:28px}.nx-studio__panel{padding:6px}.nx-studio-card{padding:6px}.nx-studio input,.nx-studio select{height:29px}.nx-studio textarea{height:52px}.nx-studio-actions button{height:28px}.nx-studio-status{min-height:18px;padding:4px 6px}}
    @media(prefers-reduced-motion:reduce){.nx-studio::before{animation:none}}
  `;
  document.head.appendChild(style);
}

export function studioShell({ eyebrow='NEXUSNOVA PRO', title, subtitle='', badge='PRO', accent='#62d8ff', accent2='#4a8dff', tabs=[] }) {
  ensureStudioStyles();
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-studio';
  root.style.setProperty('--studio', accent);
  root.style.setProperty('--studio2', accent2);
  root.innerHTML = `
    <div class="nx-studio__chrome">
      <div class="nx-studio__hero"><div><small>${eyebrow}</small><strong>${title}</strong><p>${subtitle}</p></div><span class="nx-studio__badge">${badge}</span></div>
      <div class="nx-studio__tabs">${tabs.map((tab,i)=>`<button class="nx-studio__tab${i===0?' is-active':''}" type="button" data-studio-tab="${tab.id}">${tab.label}</button>`).join('')}</div>
      <div class="nx-studio__stage">${tabs.map((tab,i)=>`<section class="nx-studio__panel${i===0?' is-active':''}" data-studio-panel="${tab.id}">${tab.html}</section>`).join('')}</div>
    </div>`;
  root.querySelectorAll('[data-studio-tab]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.studioTab;
    root.querySelectorAll('[data-studio-tab]').forEach(el => el.classList.toggle('is-active', el === button));
    root.querySelectorAll('[data-studio-panel]').forEach(el => el.classList.toggle('is-active', el.dataset.studioPanel === id));
  }));
  return root;
}

export function openSecure(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:') return false;
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:parsed.href }));
      return true;
    }
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch { return false; }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(name || 'nexusnova-export').replace(/[^a-z0-9._-]+/gi,'-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1800);
}

export function fileToInline(file, maxMb=15) {
  if (!file) return Promise.reject(new Error('Choose a file first.'));
  if (file.size > maxMb * 1024 * 1024) return Promise.reject(new Error(`File must be ${maxMb} MB or smaller.`));
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) return reject(new Error('Invalid file data.'));
      resolve({ mimeType:file.type || 'application/octet-stream', data:value.slice(comma+1) });
    };
    reader.readAsDataURL(file);
  });
}

export async function aiModel(systemInstruction='Be accurate. Do not invent missing information.') {
  if (!aiModulePromise) {
    aiModulePromise = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js').catch(error => { aiModulePromise=null; throw error; });
  }
  const ai = await aiModulePromise;
  return ai.getGenerativeModel(ai.getAI(firebaseApp,{backend:new ai.GoogleAIBackend()}),{
    model:'gemini-3.6-flash',
    systemInstruction:{parts:[{text:String(systemInstruction||'Be accurate. Do not invent missing information.')}]},
    generationConfig:{temperature:.3,maxOutputTokens:1800}
  });
}

export function pdfLib() {
  if (window.PDFLib?.PDFDocument) return Promise.resolve(window.PDFLib);
  if (pdfPromise) return pdfPromise;
  pdfPromise = new Promise((resolve,reject)=>{
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    script.onload = () => window.PDFLib?.PDFDocument ? resolve(window.PDFLib) : reject(new Error('PDF engine did not initialize.'));
    script.onerror = () => reject(new Error('PDF engine could not load.'));
    document.head.appendChild(script);
  }).catch(error => { pdfPromise=null; throw error; });
  return pdfPromise;
}

export function safeName(value, fallback='nexusnova') {
  return (String(value || fallback).replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'') || fallback).slice(0,80);
}
