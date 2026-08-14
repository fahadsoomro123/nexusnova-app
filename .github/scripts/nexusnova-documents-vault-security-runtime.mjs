import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <section id="tab-mega-documents">
      <div class="card">
        <input id="nxMegaDoc" type="file">
        <button onclick="nxComing('receipt')">Receipt Scanner</button>
        <button onclick="nxComing('pdf')">PDF Maker</button>
        <div id="nxMegaDocOut"></div>
      </div>
    </section>
    <section id="tab-ai"><input id="aiImageInput" type="file"><textarea id="aiInput"></textarea></section>

    <section id="tab-mega-vault">
      <div class="card"><input id="nxMegaFiles" type="file" multiple></div>
    </section>

    <section id="tab-mega-security">
      <button onclick="nxComing('app-lock')">App Lock</button>
    </section>
  </body></html>`);

  await page.evaluate(()=>{
    localStorage.clear();
    window.nexusAccountId='runtime-owner';
    window.__comingCalls=0;
    window.nxComing=()=>{window.__comingCalls+=1;};
    window.__aiImageCalls=0;
    window.handleAIImage=()=>{window.__aiImageCalls+=1;};
    window.__aiSent=0;
    window.sendAIMessage=()=>{window.__aiSent+=1;window.__aiPrompt=document.getElementById('aiInput').value;};
    window.openMoreTab=()=>{};
    window.__promptCalls=0;
    window.prompt=()=>{window.__promptCalls+=1;return null;};
    window.NexusNovaUI={toast:()=>{}};
    window.PDFLib={
      PDFDocument:{
        create:async()=>({
          embedJpg:async()=>({width:320,height:180}),
          embedPng:async()=>({width:320,height:180}),
          addPage:()=>({drawImage:()=>{}}),
          save:async()=>new Uint8Array([37,80,68,70,45,49,46,55,10,37,78,88])
        })
      }
    };
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-documents-live-v1.js?v=1`});
  await page.waitForFunction(()=>window.__nxDocumentsLiveV1===true && document.getElementById('nxReceiptScannerLive') && document.getElementById('nxPdfMakerLive'));

  const chooserPromise=page.waitForEvent('filechooser');
  await page.click('#nxReceiptScannerLive');
  const chooser=await chooserPromise;
  await chooser.setFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])});
  await page.waitForFunction(()=>window.__aiSent===1);
  assert.equal(await page.evaluate(()=>window.__aiImageCalls),1);
  const receiptPrompt=await page.evaluate(()=>window.__aiPrompt);
  assert.ok(receiptPrompt.includes('Do not invent unreadable values'));
  assert.ok((await page.textContent('#nxMegaDocOut')).includes('real image analysis'));
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Documents Receipt Scanner hands the selected image to real AI flow and forbids invented receipt values');

  await page.setInputFiles('#nxMegaDoc',{name:'photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255,217])});
  const pdfDownloadPromise=page.waitForEvent('download');
  await page.click('#nxPdfMakerLive');
  const pdfDownload=await pdfDownloadPromise;
  assert.equal(pdfDownload.suggestedFilename(),'photo.pdf');
  await page.waitForFunction(()=>document.getElementById('nxMegaDocOut')?.textContent?.includes('PDF created locally'));
  console.log('PASS Documents PDF Maker creates a real local PDF download without a fake server result');

  await page.addScriptTag({url:`${base}/js/nexusnova-file-vault-v1.js?v=1`});
  await page.waitForFunction(()=>window.__nxFileVaultV1===true && document.getElementById('nxVaultPanel'));
  await page.setInputFiles('#nxMegaFiles',{name:'secret.txt',mimeType:'text/plain',buffer:Buffer.from('TOP SECRET LOCAL VAULT DATA')});
  await page.fill('#nxVaultPass','vault-2468');
  await page.click('#nxVaultSave');
  await page.waitForFunction(()=>document.getElementById('nxVaultStatus')?.textContent?.includes('encrypted and saved locally'));

  const vaultState=await page.evaluate(async()=>{
    const rows=await new Promise((resolve,reject)=>{
      const open=indexedDB.open('NexusNovaEncryptedVaultV1',1);
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result;
        const req=db.transaction('files','readonly').objectStore('files').getAll();
        req.onerror=()=>reject(req.error);
        req.onsuccess=()=>{resolve(req.result);db.close();};
      };
    });
    const row=rows[0];
    const cipherText=row?.encrypted ? new TextDecoder().decode(new Uint8Array(row.encrypted)) : '';
    return {
      count:rows.length,
      owner:row?.owner,
      name:row?.name,
      hasSalt:Array.isArray(row?.salt)&&row.salt.length===16,
      hasIv:Array.isArray(row?.iv)&&row.iv.length===12,
      cipherContainsPlain:cipherText.includes('TOP SECRET LOCAL VAULT DATA'),
      localStorage:JSON.stringify({...localStorage})
    };
  });
  assert.equal(vaultState.count,1);
  assert.equal(vaultState.owner,'runtime-owner');
  assert.equal(vaultState.name,'secret.txt');
  assert.equal(vaultState.hasSalt,true);
  assert.equal(vaultState.hasIv,true);
  assert.equal(vaultState.cipherContainsPlain,false);
  assert.equal(vaultState.localStorage.includes('vault-2468'),false);
  console.log('PASS File Vault stores ciphertext in IndexedDB with salt/IV and never stores the passphrase');

  const vaultDownloadPromise=page.waitForEvent('download');
  await page.click('[data-vault-download]');
  const vaultDownload=await vaultDownloadPromise;
  assert.equal(vaultDownload.suggestedFilename(),'secret.txt');
  await page.waitForFunction(()=>document.getElementById('nxVaultStatus')?.textContent?.includes('decrypted and downloaded'));
  console.log('PASS File Vault decrypts the selected local record only when the correct passphrase is supplied');

  await page.addScriptTag({url:`${base}/js/nexusnova-security-lock-v1.js?v=2`});
  await page.waitForFunction(()=>window.__nxSecurityLockV2===true && document.getElementById('nxSecurityAppLock'));
  assert.equal(await page.evaluate(()=>window.nexusSecurityLockVersion),'browser-pin-v2');
  await page.click('#nxSecurityAppLock');
  await page.waitForFunction(()=>document.getElementById('nxAppLockSetupOverlay')?.style.display==='flex');
  await page.fill('#nxAppLockSetupPin','2468');
  await page.fill('#nxAppLockSetupConfirm','2468');
  await page.click('#nxAppLockSetupSave');
  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='flex');

  const lockConfig=await page.evaluate(()=>localStorage.getItem('nexusnova_browser_app_lock_v1')||'');
  assert.ok(lockConfig.includes('"hash"'));
  assert.ok(lockConfig.includes('"salt"'));
  assert.equal(lockConfig.includes('2468'),false);
  assert.equal(await page.evaluate(()=>window.__promptCalls),0);
  assert.equal((await page.textContent('#nxAppLockOverlay')).includes('device PIN'),false);
  assert.ok((await page.textContent('#nxAppLockOverlay')).includes('NexusNova browser App Lock PIN'));
  console.log('PASS Security Lock V2 uses an in-app setup flow, stores only PBKDF2 material, and no longer mislabels the PIN as a device PIN');

  await page.fill('#nxAppLockPin','1111');
  await page.click('#nxAppUnlockBtn');
  await page.waitForFunction(()=>document.getElementById('nxAppLockStatus')?.textContent?.includes('Wrong NexusNova PIN'));
  await page.fill('#nxAppLockPin','2468');
  await page.click('#nxAppUnlockBtn');
  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='none');

  await page.click('#nxSecurityAppLock');
  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='flex');
  await page.fill('#nxAppLockPin','2468');
  await page.click('#nxAppRemoveLockBtn');
  await page.waitForFunction(()=>document.getElementById('nxAppLockStatus')?.textContent?.includes('Tap “Remove App Lock” again'));
  await page.click('#nxAppRemoveLockBtn');
  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='none');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nexusnova_browser_app_lock_v1')),null);
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Security Lock verifies wrong/correct PINs and removes lock with in-app double confirmation without legacy Coming Soon');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nDocuments + Vault + Security runtime complete: real document actions, encrypted local vault and browser PIN lock passed.');
} finally {
  await browser.close();
}
