import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({acceptDownloads:true});
const results = [];

function ok(name, detail='') {
  results.push({name, ok:true, detail});
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
}

async function makePage(html='') {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message || String(error)));
  await page.goto(base + '/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`);
  await page.evaluate(() => {
    window.speechSynthesis = { getVoices:()=>[], cancel(){}, speak(){} };
    window.SpeechSynthesisUtterance = function(text){ this.text=text; };
  });
  return {page, pageErrors};
}

async function add(page, path) {
  await page.addScriptTag({url: `${base}/${path}`});
}

const labels = ['TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'];
const menuHtml = `<div id="moreMenu"><div class="more-inner">${labels.map((label,i)=>`<button class="more-item" data-nxmega="t${i}" type="button"><span>${label}</span></button>`).join('')}</div></div>`;

async function testSmartSearch() {
  const {page,pageErrors} = await makePage(menuHtml);
  await add(page, 'js/nexusnova-allapps-smart-search-v1.js?v=4');
  await page.waitForSelector('#nxAllAppsSmartSearch');
  const checks = {
    'food':'SHOPPING',
    'salary':'BUDGET',
    'ticket':'TRAVEL',
    'dua':'ISLAMIC HUB',
    'quran':'ISLAMIC HUB',
    'quran pak':'ISLAMIC HUB',
    'para':'ISLAMIC HUB',
    'juz':'ISLAMIC HUB',
    'bukhari':'ISLAMIC HUB',
    'hadith':'ISLAMIC HUB',
    'barish':'WEATHER',
    'unknown number':'CALLER',
    'scan receipt':'DOCUMENTS',
    'movie':'WATCH',
    'passport':'PAKISTAN HUB'
  };
  for (const [query,expected] of Object.entries(checks)) {
    const rows = await page.evaluate(q => window.nexusAllAppsSmartSearch(q), query);
    assert.equal(rows[0]?.label, expected, `${query} should map to ${expected}, got ${rows[0]?.label}`);
  }
  assert.equal(await page.evaluate(() => window.nexusAllAppsSmartSearchVersion),'local-first-v2.1');
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('ALL APPS Smart Search', 'hidden tags + Quran/Bukhari intent mappings passed');
  await page.close();
}

async function testSmartSearchDeepRoutes() {
  const html = `
    <div id="moreMenu"><div class="more-inner">
      <button class="more-item" data-nxmega="mega-islamic" type="button"><span>ISLAMIC HUB</span></button>
      <button class="more-item" data-nxmega="ai" type="button"><span>AI</span></button>
    </div></div>
    <section id="tab-mega-islamic">
      <button data-faith="quran" type="button">Quran Pak</button>
      <button data-faith="bukhari" type="button">Sahih Bukhari</button>
      <div id="faith-quran"><select id="nxQuranSurah"><option>Al-Fatihah</option></select></div>
      <div id="faith-bukhari">Bukhari reader</div>
    </section>`;
  const {page,pageErrors} = await makePage(html);
  await page.evaluate(() => {
    window.__quranRouteHits=0;
    window.__bukhariRouteHits=0;
    document.querySelector('[data-faith="quran"]').addEventListener('click',()=>window.__quranRouteHits++);
    document.querySelector('[data-faith="bukhari"]').addEventListener('click',()=>window.__bukhariRouteHits++);
  });
  await add(page, 'js/nexusnova-allapps-smart-search-v1.js?v=4');
  await page.waitForSelector('#nxAllAppsSmartSearch');
  await page.fill('[data-smart-input]','quran');
  await page.click('[data-smart-go]');
  await page.waitForFunction(() => window.__quranRouteHits > 0);
  await page.fill('[data-smart-input]','hadith');
  await page.click('[data-smart-go]');
  await page.waitForFunction(() => window.__bukhariRouteHits > 0);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('ALL APPS Deep Routing', 'Quran → Quran Pak and Hadith → Sahih Bukhari passed');
  await page.close();
}

async function testAI() {
  const html = `
    <div id="balance">123.4567</div><div id="timer">05:12:33</div><div id="btnText">MINING ACTIVE</div>
    <div id="profileName">Runtime User</div><div id="profileEmail">runtime@example.com</div><div id="refCodeDisplay">NVX-RUNTIME</div>
    <div id="walletTotalUsd">$ 0.00</div><div id="aiBox"></div>
    <input id="aiInput"><button id="aiSendBtn">Ask</button><div id="aiVoiceStatus"></div><div id="aiConnectionText"></div><div id="aiStatus"></div>`;
  const {page,pageErrors} = await makePage(html);
  await page.evaluate(() => { window.nexusAccountId='runtime-ai-user'; });
  await add(page, 'js/nexusnova-ai-authority-v2.js?v=2');
  await page.waitForFunction(() => window.__nxAIAuthorityV2 === true && typeof window.sendAIMessage === 'function');

  await page.fill('#aiInput','mera nvx balance kitna he');
  await page.evaluate(() => window.sendAIMessage());
  await page.waitForFunction(() => document.getElementById('aiBox')?.textContent?.includes('123.4567'));
  const balanceText = await page.textContent('#aiBox');
  assert.match(balanceText,/123\.4567\s*NVX/i);

  await page.fill('#aiInput','yaad rakho mera favorite color blue hai');
  await page.evaluate(() => window.sendAIMessage());
  await page.waitForTimeout(120);
  await page.fill('#aiInput','tumhe kya yaad hai?');
  await page.evaluate(() => window.sendAIMessage());
  await page.waitForFunction(() => /favorite color blue/i.test(document.getElementById('aiBox')?.textContent || ''));
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('AI Authority', 'NVX balance + persistent memory deterministic paths passed');
  await page.close();
}

async function testTravel() {
  const html = `<section id="tab-travel"><button>Flight Search</button><button>Train Search</button><button>Bus Search</button><button>Plan Trip</button></section>`;
  const {page,pageErrors} = await makePage(html);
  await add(page, 'js/nexusnova-travel-live-v1.js?v=1');
  await page.waitForSelector('#nxTravelFlightLive');
  await page.click('#nxTravelFlightLive');
  await page.waitForSelector('#nxTravelLiveOut');
  assert.match(await page.textContent('#nxTravelLiveOut'),/Live Flight Search/i);
  assert.match(await page.textContent('#nxTravelLiveOut'),/Google Flights/i);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('Travel', 'real provider handoff UI wired');
  await page.close();
}

async function testLearning() {
  const html = `<section id="tab-mega-learning"><input id="nxMegaStudy"><button>📖 Solved Papers</button><button>📝 Quiz</button><button>📅 Study Planner</button></section><section id="tab-learn"><button>Open Learning</button><button>Open Papers</button></section>`;
  const {page,pageErrors} = await makePage(html);
  await add(page, 'js/nexusnova-learning-engine-v1.js?v=3');
  await page.waitForSelector('#nxLearningSolvedPapers');
  assert.ok(await page.$('#nxLearningQuiz'));
  assert.ok(await page.$('#nxLearningPlanner'));
  assert.ok(await page.$('#nxLearnOpenKnowledge'));
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('Learning', 'Solved Papers + Quiz + Planner handlers wired');
  await page.close();
}

async function testDocuments() {
  const html = `<section id="tab-mega-documents"><input id="nxMegaDoc" type="file"><button>🧾 Receipt Scanner</button><button>📑 PDF Maker</button><div id="nxMegaDocOut"></div></section><input id="aiImageInput" type="file"><input id="aiInput">`;
  const {page,pageErrors} = await makePage(html);
  await page.evaluate(() => {
    window.openMoreTab=()=>{};
    window.handleAIImage=()=>{window.__receiptHandled=true;};
    window.sendAIMessage=()=>{window.__receiptSent=true;};
  });
  await add(page, 'js/nexusnova-documents-live-v1.js?v=1');
  await page.waitForSelector('#nxReceiptScannerLive');

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlRy9sAAAAASUVORK5CYII=', 'base64');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.click('#nxReceiptScannerLive');
  const chooser = await chooserPromise;
  await chooser.setFiles({name:'receipt.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(() => window.__receiptHandled === true && window.__receiptSent === true);
  assert.match(await page.textContent('#nxMegaDocOut'),/sent to NexusNova AI/i);

  await page.locator('#nxMegaDoc').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:png});
  const downloadPromise = page.waitForEvent('download',{timeout:20000});
  await page.click('#nxPdfMakerLive');
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(),'receipt.pdf');
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('Documents', 'receipt AI handoff + real PDF download passed');
  await page.close();
}

async function testFileVault() {
  const html = `<section id="tab-mega-vault"><div class="card"><input id="nxMegaFiles" type="file" multiple></div></section>`;
  const {page,pageErrors} = await makePage(html);
  const vaultPassphrase='NexusVault#123';
  await page.evaluate(() => { window.nexusAccountId='runtime-vault-user'; });
  await add(page, 'js/nexusnova-file-vault-v1.js?v=1');
  await page.waitForSelector('#nxVaultPanel');
  await page.locator('#nxMegaFiles').setInputFiles({name:'secret.txt',mimeType:'text/plain',buffer:Buffer.from('NexusNova runtime encrypted file')});
  await page.fill('#nxVaultPass',vaultPassphrase);
  await page.click('#nxVaultSave');
  await page.waitForFunction(() => /encrypted and saved locally/i.test(document.getElementById('nxVaultStatus')?.textContent || ''), null, {timeout:25000});
  assert.match(await page.textContent('#nxVaultList'),/secret\.txt/i);
  const recordMeta = await page.evaluate(async () => {
    const req=indexedDB.open('NexusNovaEncryptedVaultV1',1);
    const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('files','readonly');
    const rows=await new Promise((resolve,reject)=>{const r=tx.objectStore('files').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    db.close();
    const row=rows.find(x=>x.owner==='runtime-vault-user');
    return row ? {name:row.name, encryptedBytes:row.encrypted?.byteLength || 0, hasSalt:Array.isArray(row.salt)&&row.salt.length===16, kdfIterations:Number(row.kdfIterations||0)} : null;
  });
  assert.equal(recordMeta?.name,'secret.txt');
  assert.ok(recordMeta?.encryptedBytes > 0);
  assert.equal(recordMeta?.hasSalt,true);
  assert.equal(recordMeta?.kdfIterations,600000);
  // Save intentionally clears the passphrase; a real user must re-enter it
  // before decryption/download.
  await page.fill('#nxVaultPass',vaultPassphrase);
  const downloadPromise=page.waitForEvent('download',{timeout:25000});
  await page.click('[data-vault-download]');
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'secret.txt');
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('File Vault', 'AES-GCM + 600k PBKDF2 IndexedDB save + explicit-passphrase decrypt download passed');
  await page.close();
}

async function testSecurityLock() {
  const html = `<section id="tab-mega-security"><button>Account</button><button>Privacy / Settings</button><button>Permission Manager</button><button>Wallet Security</button><button>App Lock</button><button>Data Backup</button></section>`;
  const {page,pageErrors} = await makePage(html);
  await add(page, 'js/nexusnova-security-lock-v1.js?v=2');
  await page.waitForSelector('#nxSecurityAppLock');
  assert.equal(await page.evaluate(() => window.nexusSecurityLockVersion),'browser-pin-v3');

  await page.click('#nxSecurityAppLock');
  await page.waitForFunction(() => document.getElementById('nxAppLockSetupOverlay')?.style.display === 'flex', null, {timeout:20000});
  await page.fill('#nxAppLockSetupPin','123456');
  await page.fill('#nxAppLockSetupConfirm','123456');
  await page.click('#nxAppLockSetupSave');
  await page.waitForFunction(() => document.getElementById('nxAppLockOverlay')?.style.display === 'flex', null, {timeout:25000});

  const config = await page.evaluate(() => JSON.parse(localStorage.getItem('nexusnova_browser_app_lock_v1') || 'null'));
  assert.ok(config?.hash && config?.salt);
  assert.equal(Number(config?.kdfIterations),600000);
  assert.equal(JSON.stringify(config).includes('123456'),false);

  await page.fill('#nxAppLockPin','123456');
  await page.click('#nxAppUnlockBtn');
  await page.waitForFunction(() => document.getElementById('nxAppLockOverlay')?.style.display === 'none', null, {timeout:25000});
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('Security App Lock', '6-digit PIN + 600k PBKDF2 storage + unlock passed');
  await page.close();
}

async function testLateLoaderChain() {
  const marketplaceButtons=['Browse Categories','My Listings','Favorites','Seller Dashboard','Post New Item','Buy / Sell'];
  const orderButtons=['All Orders','Processing','Shipped','Out for Delivery','Delivered','Return / Refund'];
  const teacherButtons=['Lesson Planner','Quiz Maker','Worksheet Maker','Attendance'];
  const html = `${menuHtml}
    <div id="balance">5.0000</div><div id="timer">MINER OFFLINE</div><input id="aiInput"><input id="aiImageInput" type="file"><div id="aiBox"></div><button id="aiSendBtn">Ask</button><div id="aiVoiceStatus"></div><div id="aiConnectionText"></div><div id="aiStatus"></div>
    <section id="tab-smart"><button>Open Camera</button><button>Build Brief</button></section>
    <section id="tab-mega-documents"><input id="nxMegaDoc" type="file"><button>🧾 Receipt Scanner</button><button>📑 PDF Maker</button><div id="nxMegaDocOut"></div></section>
    <section id="tab-mega-vault"><div class="card"><input id="nxMegaFiles" type="file" multiple></div></section>
    <section id="tab-mega-security">${['Account','Privacy / Settings','Permission Manager','Wallet Security','App Lock','Data Backup'].map(x=>`<button>${x}</button>`).join('')}</section>
    <section id="tab-mega-marketplace">${marketplaceButtons.map(x=>`<button>${x}</button>`).join('')}</section>
    <section id="tab-mega-orders">${orderButtons.map(x=>`<button>${x}</button>`).join('')}</section>
    <section id="tab-mega-teacher">${teacherButtons.map(x=>`<button>${x}</button>`).join('')}<input id="nxMegaGrades"><button id="nxMegaGradeBtn">Calculate Average</button><div id="nxMegaGradeOut"></div></section>
    <section id="tab-mega-learning"><input id="nxMegaStudy"><button>📖 Solved Papers</button><button>📝 Quiz</button><button>📅 Study Planner</button></section>
    <section id="tab-learn"><button>Open Learning</button><button>Open Papers</button></section>
    <section id="tab-travel"><button>Flight Search</button><button>Train Search</button><button>Bus Search</button><button>Plan Trip</button></section>
    <section id="tab-mega-islamic"></section>`;
  const {page,pageErrors} = await makePage(html);
  await page.evaluate(() => { window.openMoreTab=()=>{}; window.switchTab=()=>{}; window.handleAIImage=()=>{}; });
  await add(page, 'js/nexusnova-super-app-v1.js');
  await page.evaluate(() => window.dispatchEvent(new Event('load')));
  await page.waitForTimeout(5200);
  const flags = await page.evaluate(() => ({
    learning:!!window.__nxLearningEngineV1,
    ai:!!window.__nxAIAuthorityV2,
    travel:!!window.__nxTravelLiveV1,
    smart:!!window.__nxSmartLiveV3,
    docs:!!window.__nxDocumentsLiveV1,
    vault:!!window.__nxFileVaultV1,
    security:!!window.__nxSecurityLockV1,
    marketplace:!!window.__nxMarketplaceLiveV1,
    orders:!!window.__nxOrdersLiveV1,
    teacher:!!window.__nxTeacherLiveV2,
    search:!!window.__nxAllAppsSmartSearchV2
  }));
  for (const [name,value] of Object.entries(flags)) assert.equal(value,true,`${name} late module did not load`);
  assert.ok(await page.$('#nxAllAppsSmartSearch'));
  assert.ok(await page.$('#nxMarketBrowse'));
  assert.ok(await page.$('#nxSecurityAppLock'));
  assert.ok(await page.$('#nxTeacherLessonAI'));
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  ok('Late module chain', 'Super-App → Smart Live → downstream modules passed');
  await page.close();
}

try {
  await testSmartSearch();
  await testSmartSearchDeepRoutes();
  await testAI();
  await testTravel();
  await testLearning();
  await testDocuments();
  await testFileVault();
  await testSecurityLock();
  await testLateLoaderChain();
  console.log(`\nRuntime smoke complete: ${results.length}/${results.length} passed.`);
} finally {
  await browser.close();
}
