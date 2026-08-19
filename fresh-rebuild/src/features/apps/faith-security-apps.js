import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function openExternal(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:parsed.href }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal',{url:parsed.href})) return true;
    window.open(parsed.href,'_blank','noopener,noreferrer');
    return true;
  } catch { return false; }
}

const HADITH_COLLECTIONS = [
  ['bukhari','Sahih al-Bukhari','صحیح بخاری'],['muslim','Sahih Muslim','صحیح مسلم'],['abudawud','Sunan Abu Dawud','سنن ابو داؤد'],['tirmidhi','Jami at-Tirmidhi','جامع ترمذی'],['nasai','Sunan an-Nasa’i','سنن نسائی'],['ibnmajah','Sunan Ibn Majah','سنن ابن ماجہ'],['malik','Muwatta Imam Malik','موطا امام مالک']
];

export function renderQuran() {
  const root=node(`
    <section class="nx-tool-card"><div class="nx-two-col"><label class="nx-field"><span>Surah</span><select data-quran-surah>${Array.from({length:114},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label><label class="nx-field"><span>Translation</span><select data-quran-edition><option value="ur.jalandhry">Urdu • Jalandhry</option><option value="en.sahih">English • Sahih International</option></select></label></div><button class="nx-primary" type="button" data-quran-load>LOAD SURAH</button><p class="nx-tool-meta" data-quran-status>Arabic Uthmani text and selected published translation are loaded from AlQuran Cloud. NexusNova does not machine-translate scripture.</p></section>
    <section class="nx-scripture-reader" data-quran-reader></section>`);
  const surah=root.querySelector('[data-quran-surah]'),edition=root.querySelector('[data-quran-edition]'),reader=root.querySelector('[data-quran-reader]'),status=root.querySelector('[data-quran-status]');let busy=false;
  const load=async()=>{if(busy)return;busy=true;status.textContent='Loading Quran source text…';reader.innerHTML='<div class="nx-empty">Loading…</div>';try{const n=Math.max(1,Math.min(114,Number(surah.value)||1));const response=await fetch(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,${encodeURIComponent(edition.value)}`,{cache:'no-store'});if(!response.ok)throw new Error(`Quran HTTP ${response.status}`);const json=await response.json();const sets=json?.data;if(!Array.isArray(sets)||sets.length<2)throw new Error('Quran source response incomplete');const arabic=sets.find(x=>x.edition?.identifier==='quran-uthmani')||sets[0];const translated=sets.find(x=>x!==arabic)||sets[1];const verses=arabic.ayahs||[];reader.innerHTML=`<header><strong>${escapeHtml(arabic.englishName||arabic.name||`Surah ${n}`)}</strong><span>${escapeHtml(arabic.name||'')}</span></header>`+verses.map((ayah,index)=>`<article class="nx-verse"><span class="nx-verse-no">${ayah.numberInSurah}</span><div class="nx-arabic-text" dir="rtl">${escapeHtml(ayah.text)}</div><div class="nx-translation" dir="${edition.value.startsWith('ur.')?'rtl':'ltr'}">${escapeHtml(translated.ayahs?.[index]?.text||'')}</div></article>`).join('');status.textContent=`${verses.length} verses • ${escapeHtml(translated.edition?.englishName||edition.value)} • source text unchanged`;}catch(error){reader.innerHTML='<div class="nx-empty">Quran source is unavailable right now.</div>';status.textContent='Could not load the scripture source. NexusNova will not substitute generated religious text.';console.warn('[NexusNova Fresh] Quran:',error);}finally{busy=false;}};root.querySelector('[data-quran-load]').addEventListener('click',load);load();return root;
}

function hadithText(data) {
  const item=Array.isArray(data?.hadiths)?data.hadiths[0]:(data?.hadith||data);
  return String(item?.text||item?.hadith||'').trim();
}

export function renderHadith() {
  const root=node(`<section class="nx-tool-card"><label class="nx-field"><span>Collection</span><select data-hadith-collection>${HADITH_COLLECTIONS.map(row=>`<option value="${row[0]}">${row[2]} • ${row[1]}</option>`).join('')}</select></label><div class="nx-inline-field"><input type="number" min="1" step="1" data-hadith-number value="1"><button type="button" data-hadith-load>LOAD</button></div><p class="nx-tool-meta" data-hadith-status>Arabic + Urdu source editions via the same fawazahmed0 Hadith API used by the previous NexusNova reader.</p></section><section class="nx-scripture-reader" data-hadith-reader></section>`);
  const collection=root.querySelector('[data-hadith-collection]'),number=root.querySelector('[data-hadith-number]'),reader=root.querySelector('[data-hadith-reader]'),status=root.querySelector('[data-hadith-status]');let busy=false;
  const load=async()=>{if(busy)return;busy=true;const id=collection.value,n=Math.max(1,Math.floor(Number(number.value)||1)),meta=HADITH_COLLECTIONS.find(row=>row[0]===id)||HADITH_COLLECTIONS[0];status.textContent=`Loading ${meta[1]}…`;reader.innerHTML='<div class="nx-empty">Loading source text…</div>';try{const base='https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';const [arResponse,urResponse]=await Promise.all([fetch(`${base}/ara-${id}/${n}.min.json`,{cache:'no-store'}),fetch(`${base}/urd-${id}/${n}.min.json`,{cache:'no-store'})]);if(!arResponse.ok||!urResponse.ok)throw new Error('Hadith source unavailable');const [arabic,urdu]=await Promise.all([arResponse.json(),urResponse.json()]);const arText=hadithText(arabic),urText=hadithText(urdu);if(!arText&&!urText)throw new Error('Hadith text missing');reader.innerHTML=`<header><strong>${escapeHtml(meta[1])} • ${n}</strong><span>${escapeHtml(meta[2])}</span></header><article class="nx-verse"><div class="nx-arabic-text" dir="rtl">${escapeHtml(arText)}</div><div class="nx-translation" dir="rtl">${escapeHtml(urText)}</div></article>`;status.textContent=`${meta[2]} • Hadith ${n} • Arabic + Urdu source text`;}catch(error){reader.innerHTML='<div class="nx-empty">This Hadith number could not be loaded.</div>';status.textContent='Try another number or check the connection.';console.warn('[NexusNova Fresh] Hadith:',error);}finally{busy=false;}};root.querySelector('[data-hadith-load]').addEventListener('click',load);collection.addEventListener('change',load);load();return root;
}

export function renderIslamic() {
  const root=node(`<section class="nx-tool-card nx-tasbih"><p class="nx-eyebrow">DAILY DHIKR</p><strong data-tasbih-count>0</strong><div class="nx-action-row"><button type="button" data-tasbih-add>COUNT +1</button><button type="button" data-tasbih-reset>RESET</button><button type="button" data-islamic-source>URDU LIBRARY</button></div><p class="nx-tool-meta">Qibla, Prayer Times, Quran and Hadith are also direct first-class Nova Hub apps.</p></section>`);let count=0;const display=root.querySelector('[data-tasbih-count]');root.querySelector('[data-tasbih-add]').addEventListener('click',()=>{display.textContent=String(++count);if(navigator.vibrate)navigator.vibrate(20);});root.querySelector('[data-tasbih-reset]').addEventListener('click',()=>{count=0;display.textContent='0';});root.querySelector('[data-islamic-source]').addEventListener('click',()=>openExternal('https://islamhouse.com/read/ur'));return root;
}

export function renderUrduLibrary() {
  const books=[['Tafsir collections','قرآن تفاسیر اردو'],['Seerah collections','سیرت النبی اردو'],['Fiqh references','فقہ اردو عربی'],['Islamic history','اسلامی تاریخ اردو'],['Nahj al-Balagha','نہج البلاغہ اردو']];
  const root=node(`<section class="nx-tool-card"><p class="nx-tool-meta">NexusNova opens source/archive searches rather than copying copyrighted or unverifiable editions into the app.</p></section><section class="nx-stack">${books.map(([title,query])=>`<button class="nx-news-card" type="button" data-library-query="${escapeHtml(query)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(query)}</span></button>`).join('')}</section>`);root.querySelectorAll('[data-library-query]').forEach(button=>button.addEventListener('click',()=>openExternal(`https://archive.org/search?query=${encodeURIComponent(button.dataset.libraryQuery)}`)));return root;
}

async function secureCall(name,data={}) {
  const user=await requireFirebaseUser({write:true});
  const call=httpsCallable(getFunctions(firebaseApp,'us-central1'),name);
  const response=await call(data);
  return response?.data||{};
}

export function renderNovaVault() {
  const root=node(`<section class="nx-vault-hero nx-panel"><p class="nx-eyebrow">NOVA REWARD SYSTEM</p><strong data-vault-pending>— VAULTS</strong><span>Server-authoritative rewards • no client-side reward selection</span></section><div class="nx-summary-grid nx-vault-inventory"><div><span>Booster</span><strong data-vault-booster>—</strong></div><div><span>Nova Rain</span><strong data-vault-rain>—</strong></div><div><span>Time Warp</span><strong data-vault-warp>—</strong></div></div><section class="nx-tool-card"><div class="nx-action-row"><button type="button" data-vault-open>OPEN VAULT</button><button type="button" data-vault-boost>USE BOOSTER</button><button type="button" data-vault-rain-use>USE RAIN</button></div><button class="nx-secondary" type="button" data-vault-warp-use style="margin-top:8px">USE 24H TIME WARP</button><p class="nx-tool-meta" data-vault-status>Syncing secure Nova inventory…</p></section>`);
  const pending=root.querySelector('[data-vault-pending]'),booster=root.querySelector('[data-vault-booster]'),rain=root.querySelector('[data-vault-rain]'),warp=root.querySelector('[data-vault-warp]'),status=root.querySelector('[data-vault-status]');let off=null,busy=false;
  const bind=async()=>{try{const user=await requireFirebaseUser();off=onSnapshot(doc(firestoreDb,'users',user.uid),snap=>{const data=snap.data()||{};pending.textContent=`${Math.max(0,Number(data.novaVaultPending)||0)} VAULTS`;booster.textContent=Math.max(0,Number(data.novaBoosterInventory)||0);rain.textContent=Math.max(0,Number(data.novaRainInventory)||0);warp.textContent=Math.max(0,Number(data.novaTimeWarpInventory)||0);});}catch(error){status.textContent=error.message;}};bind();
  const run=async(label,name,data={})=>{if(busy)return;busy=true;status.textContent=`${label} • secure server request…`;try{const result=await secureCall(name,data);const reward=result.reward||{};status.textContent=result.opened?`✓ Vault opened • ${reward.type||'reward'} ${Number(reward.amount||0)||''}`:`✓ ${label} completed.`;}catch(error){status.textContent=String(error?.message||error).replace(/^FirebaseError:\s*/i,'').slice(0,260);}finally{busy=false;}};
  root.querySelector('[data-vault-open]').addEventListener('click',()=>run('Opening Vault','openNovaVault'));
  root.querySelector('[data-vault-boost]').addEventListener('click',()=>run('Using Booster','useNovaBoost',{kind:'booster'}));
  root.querySelector('[data-vault-rain-use]').addEventListener('click',()=>run('Using Nova Rain','useNovaBoost',{kind:'rain'}));
  root.querySelector('[data-vault-warp-use]').addEventListener('click',()=>run('Using Time Warp','useNovaTimeWarp'));
  root.__cleanup=()=>off?.();return root;
}

function openVaultDb() {
  return new Promise((resolve,reject)=>{const request=indexedDB.open('nexusnova-fresh-vault',1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
function dbRequest(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function bytesToBase64(bytes){let binary='';const arr=new Uint8Array(bytes);for(let i=0;i<arr.length;i+=0x8000)binary+=String.fromCharCode(...arr.subarray(i,i+0x8000));return btoa(binary);}
function base64ToBytes(value){const binary=atob(value);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
async function deriveVaultKey(passphrase,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function vaultRows(){const db=await openVaultDb();return dbRequest(db.transaction('files','readonly').objectStore('files').getAll());}

export function renderFileVault() {
  const root=node(`<section class="nx-tool-card"><label class="nx-field"><span>Vault passphrase</span><input type="password" autocomplete="off" data-file-pass placeholder="Required to encrypt/decrypt"></label><label class="nx-file-picker"><input type="file" data-file-input><strong>Encrypt a file</strong><span>Local AES-GCM vault • maximum 3 MB per file</span></label><button class="nx-primary" type="button" data-file-encrypt>ENCRYPT & STORE LOCALLY</button><p class="nx-tool-meta" data-file-status>Passphrases are never stored. Losing the passphrase means NexusNova cannot recover the file.</p></section><section class="nx-stack" data-file-list></section><section class="nx-tool-card" data-file-preview hidden></section>`);
  const pass=root.querySelector('[data-file-pass]'),input=root.querySelector('[data-file-input]'),list=root.querySelector('[data-file-list]'),status=root.querySelector('[data-file-status]'),preview=root.querySelector('[data-file-preview]');
  const draw=async()=>{try{const rows=(await vaultRows()).sort((a,b)=>b.at-a.at);list.innerHTML=rows.length?rows.map(row=>`<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(row.name)}</strong><button class="nx-icon-button" type="button" data-file-delete="${escapeHtml(row.id)}">×</button></div><p>${escapeHtml(row.type||'file')} • ${(row.size/1024).toFixed(1)} KB • encrypted</p><button class="nx-secondary" type="button" data-file-open="${escapeHtml(row.id)}">DECRYPT PREVIEW</button></article>`).join(''):'<div class="nx-empty">Encrypted local vault is empty.</div>';list.querySelectorAll('[data-file-delete]').forEach(button=>button.addEventListener('click',async()=>{const db=await openVaultDb();await dbRequest(db.transaction('files','readwrite').objectStore('files').delete(button.dataset.fileDelete));draw();}));list.querySelectorAll('[data-file-open]').forEach(button=>button.addEventListener('click',async()=>{if(!pass.value){status.textContent='Enter the vault passphrase first.';return;}try{const db=await openVaultDb();const row=await dbRequest(db.transaction('files','readonly').objectStore('files').get(button.dataset.fileOpen));const salt=base64ToBytes(row.salt),iv=base64ToBytes(row.iv),cipher=base64ToBytes(row.cipher);const key=await deriveVaultKey(pass.value,salt);const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);preview.hidden=false;if((row.type||'').startsWith('text/')||/\.(txt|md)$/i.test(row.name)){preview.textContent=new TextDecoder().decode(clear).slice(0,30000);}else if((row.type||'').startsWith('image/')){const img=new Image();img.alt=row.name;img.src=URL.createObjectURL(new Blob([clear],{type:row.type}));preview.replaceChildren(img);}else preview.textContent='Decryption succeeded. Preview is available for text and image files in this build.';status.textContent='✓ File decrypted in memory only.';}catch{status.textContent='Decryption failed. Check the passphrase or encrypted data.';}}));}catch(error){status.textContent=`Vault storage error: ${error.message||error}`;}};
  root.querySelector('[data-file-encrypt]').addEventListener('click',async()=>{const file=input.files?.[0];if(!file||!pass.value){status.textContent='Choose a file and enter a passphrase.';return;}if(file.size>3*1024*1024){status.textContent='File is larger than the 3 MB fresh-vault limit.';return;}try{const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await deriveVaultKey(pass.value,salt),clear=await file.arrayBuffer(),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,clear),row={id:uid('vault-file'),name:file.name.slice(0,180),type:file.type.slice(0,100),size:file.size,at:Date.now(),salt:bytesToBase64(salt),iv:bytesToBase64(iv),cipher:bytesToBase64(cipher)};const db=await openVaultDb();await dbRequest(db.transaction('files','readwrite').objectStore('files').put(row));input.value='';status.textContent='✓ File encrypted with AES-GCM and stored locally.';draw();}catch(error){status.textContent=`Encryption failed: ${error.message||error}`;}});draw();return root;
}

export function renderSecurity() {
  const root=node(`<section class="nx-tool-card"><div class="nx-setting-row"><div><strong>Secure origin</strong><span>${escapeHtml(location.origin)}</span></div><span class="nx-badge" data-sec-origin>CHECK</span></div><div class="nx-setting-row"><div><strong>Web Crypto</strong><span>AES-GCM / PBKDF2 support</span></div><span class="nx-badge" data-sec-crypto>CHECK</span></div><div class="nx-setting-row"><div><strong>Email verification</strong><span>Required for value-bearing actions</span></div><span class="nx-badge" data-sec-email>CHECK</span></div><div class="nx-setting-row"><div><strong>Native privileged bridge</strong><span>Available only on trusted Android top-level app pages</span></div><span class="nx-badge" data-sec-native>CHECK</span></div></section><p class="nx-tool-meta" data-sec-status>Checking security state…</p>`);const secure=root.querySelector('[data-sec-origin]'),cryptoBadge=root.querySelector('[data-sec-crypto]'),email=root.querySelector('[data-sec-email]'),native=root.querySelector('[data-sec-native]'),status=root.querySelector('[data-sec-status]');const set=(el,ok,yes='READY',no='UNAVAILABLE')=>{el.textContent=ok?yes:no;el.classList.toggle('good',ok);};set(secure,location.protocol==='https:','HTTPS','NOT HTTPS');set(cryptoBadge,Boolean(globalThis.crypto?.subtle));set(native,typeof window.NexusAndroid?.postMessage==='function','ANDROID','WEB ONLY');requireFirebaseUser().then(async user=>{await user.reload();set(email,(user.emailVerified===true),'VERIFIED','UNVERIFIED');status.textContent='Security state reflects this device/session. No fake “100% secure” rating is used.';}).catch(error=>{status.textContent=error.message;});return root;
}

export function renderNotifications() {
  const root=node(`<section class="nx-tool-card"><div class="nx-setting-row"><div><strong>Browser notifications</strong><span data-notify-permission>${'Notification' in window?Notification.permission:'unsupported'}</span></div><span class="nx-badge" data-notify-badge>CHECK</span></div><div class="nx-action-row"><button type="button" data-notify-enable>ENABLE</button><button type="button" data-notify-test>TEST LOCAL</button><button type="button" data-notify-settings>REFRESH</button></div><p class="nx-tool-meta" data-notify-status>FCM/push delivery requires the existing provider/native setup; this screen does not claim background push until verified.</p></section>`);const permission=root.querySelector('[data-notify-permission]'),badge=root.querySelector('[data-notify-badge]'),status=root.querySelector('[data-notify-status]');const paint=()=>{const p='Notification' in window?Notification.permission:'unsupported';permission.textContent=p;badge.textContent=p==='granted'?'READY':p.toUpperCase();badge.classList.toggle('good',p==='granted');};root.querySelector('[data-notify-enable]').addEventListener('click',async()=>{if(!('Notification'in window)){status.textContent='Notifications are unsupported in this browser.';return;}try{await Notification.requestPermission();paint();}catch(error){status.textContent=error.message;}});root.querySelector('[data-notify-test]').addEventListener('click',()=>{if(Notification?.permission==='granted'){new Notification('NexusNova',{body:'Local notification test successful.'});status.textContent='Local notification sent.';}else status.textContent='Enable notifications first.';});root.querySelector('[data-notify-settings]').addEventListener('click',paint);paint();return root;
}

export function renderGrowth() {
  const root=node(`<section class="nx-tool-card nx-migration-card"><h2>Growth Center</h2><p>Referral attribution was intentionally disabled in the security audit until server-side proof exists. This fresh build does not fabricate referral earnings.</p><div class="nx-migration-status"><i></i><span>Server-verified referrals not launched</span></div></section>`);return root;
}

export function renderMarketplace() {
  return node(`<section class="nx-tool-card nx-migration-card"><h2>Marketplace backend required</h2><p>The previous audit found no production listing/payment backend. NexusNova will not show fake sellers, prices, inventory or payments. The fresh premium UI shell is reserved until the real commerce backend is connected.</p><div class="nx-migration-status"><i></i><span>External setup required</span></div></section>`);
}

export function renderOrders() {
  const root=node(`<section class="nx-tool-card"><label class="nx-field"><span>Manual order/reference</span><input maxlength="100" data-order-ref placeholder="Order ID or reference"></label><label class="nx-field"><span>Note / status</span><input maxlength="180" data-order-note placeholder="e.g. Awaiting dispatch"></label><button class="nx-primary" type="button" data-order-add>ADD MANUAL TRACKER</button><p class="nx-tool-meta">Manual personal tracker only. No courier/order backend is connected.</p></section><section class="nx-stack" data-order-list></section>`);const ref=root.querySelector('[data-order-ref]'),note=root.querySelector('[data-order-note]'),list=root.querySelector('[data-order-list]');let key='nexus_fresh_orders_device';requireFirebaseUser().then(user=>{key=`nexus_fresh_orders_${user.uid}`;draw();}).catch(()=>draw());const draw=()=>{const rows=loadJson(key,[]);list.innerHTML=rows.length?rows.map(row=>`<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(row.ref)}</strong><button class="nx-icon-button" type="button" data-order-delete="${escapeHtml(row.id)}">×</button></div><p>${escapeHtml(row.note||'No status')}</p></article>`).join(''):'<div class="nx-empty">No manual order references.</div>';list.querySelectorAll('[data-order-delete]').forEach(button=>button.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(row=>row.id!==button.dataset.orderDelete));draw();}));};root.querySelector('[data-order-add]').addEventListener('click',()=>{if(!ref.value.trim())return;const rows=loadJson(key,[]);rows.push({id:uid('order'),ref:ref.value.trim(),note:note.value.trim()});saveJson(key,rows.slice(-200));ref.value=note.value='';draw();});draw();return root;
}

export const faithSecurityRenderers = Object.freeze({
  quran:renderQuran,
  hadith:renderHadith,
  islamic:renderIslamic,
  'urdu-library':renderUrduLibrary,
  'nova-vault':renderNovaVault,
  'file-vault':renderFileVault,
  security:renderSecurity,
  notifications:renderNotifications,
  growth:renderGrowth,
  marketplace:renderMarketplace,
  orders:renderOrders
});
