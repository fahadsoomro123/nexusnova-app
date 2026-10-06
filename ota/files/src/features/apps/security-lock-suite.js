import { escapeHtml } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const KEY='nexusnova_browser_app_lock_v1';
const LEGACY_KDF=140000;
const CURRENT_KDF=600000;
const AUTO_RELOCK_MS=60000;
const MAX_BACKOFF_MS=60000;
let failures=0,blockedUntil=0,hiddenAt=0;

function node(html){const root=document.createElement('div');root.className='nx-app-body';root.innerHTML=html;return root;}
function bytesToB64(bytes){let text='';bytes.forEach(byte=>{text+=String.fromCharCode(byte);});return btoa(text);}
function b64ToBytes(value){const text=atob(String(value||''));return Uint8Array.from(text,char=>char.charCodeAt(0));}
function readConfig(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&typeof value==='object'&&value.salt&&value.hash?value:null;}catch{return null;}}
function validLegacyPin(pin){return /^\d{4,12}$/.test(String(pin||''));}
function validNewPin(pin){return /^\d{6,12}$/.test(String(pin||''));}
function waitMs(){return Math.max(0,blockedUntil-Date.now());}
function fail(){failures+=1;if(failures<3)return;const exponent=Math.min(5,failures-3);blockedUntil=Date.now()+Math.min(MAX_BACKOFF_MS,2000*(2**exponent));}
function resetFailures(){failures=0;blockedUntil=0;}

async function pinHash(pin,salt,iterations){
  const rounds=Number(iterations);
  if(![LEGACY_KDF,CURRENT_KDF].includes(rounds))throw new Error('Unsupported App Lock security parameters.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:rounds,hash:'SHA-256'},material,256);
  return bytesToB64(new Uint8Array(bits));
}

async function verify(pin){
  if(waitMs()>0)return false;
  const config=readConfig();
  if(!config||!validLegacyPin(pin)||!crypto?.subtle){fail();return false;}
  try{
    const salt=b64ToBytes(config.salt);
    if(salt.length!==16)throw new Error('Invalid salt.');
    const iterations=config.kdfIterations==null?LEGACY_KDF:Number(config.kdfIterations);
    const ok=(await pinHash(pin,salt,iterations))===config.hash;
    if(ok)resetFailures();else fail();
    return ok;
  }catch{fail();return false;}
}

function ensureStyles(){
  if(document.getElementById('nxFreshLockStyles'))return;
  const style=document.createElement('style');style.id='nxFreshLockStyles';style.textContent=`
  .nx-fresh-lock{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.96);backdrop-filter:blur(16px)}
  .nx-fresh-lock__card{width:min(94vw,410px);padding:22px;border-radius:25px;background:linear-gradient(145deg,#0f1f38,#071225);border:1px solid rgba(91,173,255,.25);box-shadow:0 28px 80px rgba(0,0,0,.62);color:#f8fbff}
  .nx-fresh-lock__card h2{margin:0 0 7px}.nx-fresh-lock__card p{color:#8ea7c1;font-size:12px;line-height:1.55}.nx-fresh-lock__card input{width:100%;box-sizing:border-box;margin-top:9px;padding:12px;border-radius:13px;border:1px solid rgba(123,171,226,.22);background:#020b18;color:#fff}.nx-fresh-lock__actions{display:flex;gap:8px;margin-top:12px}.nx-fresh-lock__actions button{flex:1}.nx-fresh-lock__status{min-height:18px;margin-top:9px;color:#ff95a6;font-size:11px;font-weight:700}`;
  document.head.appendChild(style);
}
function show(overlay){ensureStyles();overlay.style.display='flex';document.body.style.overflow='hidden';}
function hide(overlay){overlay.style.display='none';document.body.style.removeProperty('overflow');}

function lockOverlay(){
  let overlay=document.getElementById('nxFreshLockOverlay');if(overlay)return overlay;
  overlay=document.createElement('div');overlay.id='nxFreshLockOverlay';overlay.className='nx-fresh-lock';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.innerHTML=`<div class="nx-fresh-lock__card"><h2>🔐 NexusNova Locked</h2><p>Enter your local NexusNova App Lock PIN. The raw PIN is never stored.</p><input type="password" inputmode="numeric" maxlength="12" autocomplete="off" data-lock-pin placeholder="NexusNova PIN"><div class="nx-fresh-lock__actions"><button class="nx-primary" type="button" data-lock-unlock>UNLOCK</button><button type="button" data-lock-remove>REMOVE LOCK</button></div><div class="nx-fresh-lock__status" data-lock-status></div><p>Browser-side lock only. Android biometric/device credential is a separate native capability.</p></div>`;
  document.body.appendChild(overlay);
  const pin=overlay.querySelector('[data-lock-pin]'),status=overlay.querySelector('[data-lock-status]');
  const unlock=async()=>{
    const value=pin.value;pin.value='';
    if(await verify(value)){status.textContent='';delete overlay.dataset.removeUntil;hide(overlay);return;}
    status.textContent=waitMs()>0?`Too many attempts. Try again in ${Math.ceil(waitMs()/1000)} seconds.`:'Wrong NexusNova PIN.';
  };
  overlay.querySelector('[data-lock-unlock]').addEventListener('click',unlock);
  pin.addEventListener('keydown',event=>{if(event.key==='Enter')unlock();});
  overlay.querySelector('[data-lock-remove]').addEventListener('click',async()=>{
    const value=pin.value;pin.value='';
    if(!(await verify(value))){status.textContent=waitMs()>0?`Too many attempts. Try again in ${Math.ceil(waitMs()/1000)} seconds.`:'Correct PIN required before removing App Lock.';return;}
    const now=Date.now(),until=Number(overlay.dataset.removeUntil||0);
    if(until<now){overlay.dataset.removeUntil=String(now+6000);status.textContent='PIN verified. Enter the PIN and tap REMOVE LOCK again within 6 seconds to confirm.';return;}
    localStorage.removeItem(KEY);delete overlay.dataset.removeUntil;status.textContent='';hide(overlay);window.dispatchEvent(new Event('nexusnova:app-lock-changed'));
  });
  return overlay;
}

export function lockApp(){if(!readConfig())return false;const overlay=lockOverlay();show(overlay);const input=overlay.querySelector('[data-lock-pin]');input.value='';setTimeout(()=>input.focus(),50);return true;}

async function setupPin(first,second){
  if(!crypto?.subtle)throw new Error('Secure browser cryptography is unavailable.');
  if(!validNewPin(first))throw new Error('New PIN must contain 6–12 digits.');
  if(first!==second)throw new Error('PIN confirmation does not match.');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await pinHash(first,salt,CURRENT_KDF);
  localStorage.setItem(KEY,JSON.stringify({salt:bytesToB64(salt),hash,kdfIterations:CURRENT_KDF,createdAt:Date.now(),version:3}));
  resetFailures();window.dispatchEvent(new Event('nexusnova:app-lock-changed'));return true;
}

function installLifecycle(){
  if(window.__nexusFreshAppLockV3)return;window.__nexusFreshAppLockV3=true;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();return;}
    const previous=hiddenAt;hiddenAt=0;
    if(previous&&Date.now()-previous>=AUTO_RELOCK_MS&&readConfig())lockApp();
  });
  if(readConfig())setTimeout(lockApp,180);
}
installLifecycle();

export function renderSecurityLockSuite(){
  const root=node(`
    <section class="nx-tool-card">
      <div class="nx-setting-row"><div><strong>Browser App Lock</strong><span>PBKDF2 PIN hash • auto re-lock after 60 sec background</span></div><span class="nx-badge" data-lock-badge>CHECK</span></div>
      <div class="nx-two-col"><label class="nx-field"><span>New PIN</span><input type="password" inputmode="numeric" minlength="6" maxlength="12" data-setup-pin></label><label class="nx-field"><span>Confirm PIN</span><input type="password" inputmode="numeric" minlength="6" maxlength="12" data-setup-confirm></label></div>
      <div class="nx-two-col"><button class="nx-primary" type="button" data-lock-enable>ENABLE / LOCK NOW</button><button type="button" data-lock-now>LOCK NOW</button></div>
      <p class="nx-tool-meta" data-lock-info>Existing older NexusNova PIN records remain compatible. New records use PBKDF2 600,000 rounds.</p>
    </section>
    <section class="nx-tool-card">
      <div class="nx-setting-row"><div><strong>Secure origin</strong><span>${escapeHtml(location.origin)}</span></div><span class="nx-badge" data-sec-origin>CHECK</span></div>
      <div class="nx-setting-row"><div><strong>Web Crypto</strong><span>AES-GCM / PBKDF2</span></div><span class="nx-badge" data-sec-crypto>CHECK</span></div>
      <div class="nx-setting-row"><div><strong>Email verification</strong><span>Required for protected writes</span></div><span class="nx-badge" data-sec-email>CHECK</span></div>
      <div class="nx-setting-row"><div><strong>Native bridge</strong><span>Trusted Android app pages only</span></div><span class="nx-badge" data-sec-native>CHECK</span></div>
      <p class="nx-tool-meta" data-sec-status>Checking current security state…</p>
    </section>`);

  const badge=root.querySelector('[data-lock-badge]'),info=root.querySelector('[data-lock-info]');
  const paintLock=()=>{const enabled=Boolean(readConfig());badge.textContent=enabled?'ENABLED':'OFF';badge.classList.toggle('good',enabled);};
  paintLock();window.addEventListener('nexusnova:app-lock-changed',paintLock);
  root.querySelector('[data-lock-enable]').addEventListener('click',async()=>{
    if(readConfig()){lockApp();return;}
    try{await setupPin(root.querySelector('[data-setup-pin]').value,root.querySelector('[data-setup-confirm]').value);root.querySelector('[data-setup-pin]').value='';root.querySelector('[data-setup-confirm]').value='';info.textContent='App Lock enabled. Locking now…';paintLock();lockApp();}
    catch(error){info.textContent=error.message||'Could not enable App Lock.';}
  });
  root.querySelector('[data-lock-now]').addEventListener('click',()=>{if(!lockApp())info.textContent='Create a 6–12 digit PIN first.';});

  const set=(el,ok,yes,no)=>{el.textContent=ok?yes:no;el.classList.toggle('good',ok);};
  set(root.querySelector('[data-sec-origin]'),location.protocol==='https:','HTTPS','NOT HTTPS');
  set(root.querySelector('[data-sec-crypto]'),Boolean(globalThis.crypto?.subtle),'READY','UNAVAILABLE');
  set(root.querySelector('[data-sec-native]'),typeof window.NexusAndroid?.postMessage==='function','ANDROID','WEB ONLY');
  requireFirebaseUser().then(async user=>{await user.reload();set(root.querySelector('[data-sec-email]'),user.emailVerified===true,'VERIFIED','UNVERIFIED');root.querySelector('[data-sec-status]').textContent='Security state reflects this device/session; no fake security score is used.';}).catch(error=>{root.querySelector('[data-sec-status]').textContent=error.message;});
  root.__cleanup=()=>window.removeEventListener('nexusnova:app-lock-changed',paintLock);
  return root;
}

export const securityLockSuiteRenderers=Object.freeze({security:renderSecurityLockSuite});
