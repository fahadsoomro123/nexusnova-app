import { escapeHtml } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const DB_NAME = 'NexusNovaEncryptedVaultV1';
const STORE = 'files';
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 10;
const LEGACY_KDF = 150000;
const CURRENT_KDF = 600000;

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function openDb() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store=db.createObjectStore(STORE,{keyPath:'id'});
        store.createIndex('owner','owner',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Vault database unavailable.'));
  });
}

function dbRequest(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Vault operation failed.'));
  });
}

async function ownerId(){
  const user=await requireFirebaseUser();
  return user.uid;
}

async function deriveKey(passphrase,salt,iterations){
  const count=Number(iterations);
  if(![LEGACY_KDF,CURRENT_KDF].includes(count)) throw new Error('Unsupported vault encryption parameters.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:count,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

async function encryptFile(file,passphrase){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(passphrase,salt,CURRENT_KDF);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,await file.arrayBuffer());
  return {salt:Array.from(salt),iv:Array.from(iv),encrypted,cryptoVersion:2,kdfIterations:CURRENT_KDF};
}

async function decryptRecord(record,passphrase){
  const salt=new Uint8Array(record.salt||[]);
  const iv=new Uint8Array(record.iv||[]);
  if(salt.length!==16||iv.length!==12) throw new Error('Invalid vault encryption parameters.');
  const iterations=record.kdfIterations==null?LEGACY_KDF:Number(record.kdfIterations);
  const key=await deriveKey(passphrase,salt,iterations);
  return crypto.subtle.decrypt({name:'AES-GCM',iv},key,record.encrypted);
}

async function listRecords(owner){
  const db=await openDb();
  try{
    const store=db.transaction(STORE,'readonly').objectStore(STORE);
    const rows=store.indexNames.contains('owner')
      ? await dbRequest(store.index('owner').getAll(owner))
      : (await dbRequest(store.getAll())).filter(row=>row.owner===owner);
    return rows.sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));
  } finally { db.close(); }
}

async function getRecord(id){
  const db=await openDb();
  try{return await dbRequest(db.transaction(STORE,'readonly').objectStore(STORE).get(id));}
  finally{db.close();}
}

async function putRecord(record){
  const db=await openDb();
  try{await dbRequest(db.transaction(STORE,'readwrite').objectStore(STORE).put(record));}
  finally{db.close();}
}

async function removeRecord(id){
  const db=await openDb();
  try{await dbRequest(db.transaction(STORE,'readwrite').objectStore(STORE).delete(id));}
  finally{db.close();}
}

function formatBytes(bytes){
  const n=Number(bytes)||0;
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

export function renderFileVaultSuite(){
  const root=node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Vault passphrase</span><input type="password" autocomplete="off" autocapitalize="none" spellcheck="false" data-vault-pass placeholder="12+ characters; never stored"></label>
      <label class="nx-file-picker"><input type="file" multiple data-vault-files><strong>Choose files to encrypt</strong><span>AES-GCM • max 25 MB each • up to 10 files per batch</span></label>
      <div class="nx-two-col"><button class="nx-primary" type="button" data-vault-save>ENCRYPT & SAVE</button><button type="button" data-vault-refresh>REFRESH</button></div>
      <p class="nx-tool-meta" data-vault-status>Uses the original account-scoped NexusNova encrypted vault. Passphrases are never stored or recoverable by NexusNova.</p>
    </section>
    <section class="nx-stack" data-vault-list><div class="nx-empty">Loading encrypted vault…</div></section>
  `);

  const pass=root.querySelector('[data-vault-pass]');
  const files=root.querySelector('[data-vault-files]');
  const status=root.querySelector('[data-vault-status]');
  const list=root.querySelector('[data-vault-list]');
  const save=root.querySelector('[data-vault-save]');
  let owner='';

  const clearPass=()=>{pass.value='';};
  const draw=async()=>{
    try{
      owner=owner||await ownerId();
      const rows=await listRecords(owner);
      list.innerHTML=rows.length?rows.map(row=>`
        <article class="nx-list-card">
          <div class="nx-list-card__head"><strong>${escapeHtml(row.name||'Encrypted file')}</strong><button class="nx-icon-button" type="button" data-vault-delete="${escapeHtml(row.id)}">×</button></div>
          <p>${escapeHtml(row.type||'file')} • ${formatBytes(row.size)} • encrypted • ${new Date(Number(row.createdAt)||Date.now()).toLocaleString()}</p>
          <button class="nx-primary" type="button" data-vault-download="${escapeHtml(row.id)}">DECRYPT & DOWNLOAD</button>
        </article>`).join(''):'<div class="nx-empty">No encrypted files saved for this account.</div>';

      list.querySelectorAll('[data-vault-download]').forEach(button=>button.addEventListener('click',async()=>{
        if(!pass.value){status.textContent='Enter the vault passphrase before downloading.';return;}
        try{
          const record=await getRecord(button.dataset.vaultDownload);
          if(!record||record.owner!==owner)throw new Error('File not found for this account.');
          status.textContent='Decrypting file in memory…';
          const clear=await decryptRecord(record,pass.value);
          const blob=new Blob([clear],{type:record.type||'application/octet-stream'});
          const url=URL.createObjectURL(blob);
          const link=document.createElement('a');
          link.href=url;link.download=record.name||'vault-file';document.body.appendChild(link);link.click();link.remove();
          setTimeout(()=>URL.revokeObjectURL(url),1500);
          status.textContent='File decrypted and handed to download.';
        }catch(error){status.textContent='Could not decrypt. Check the passphrase.';console.warn('[NexusNova Fresh] vault decrypt:',error);}
        finally{clearPass();}
      }));

      list.querySelectorAll('[data-vault-delete]').forEach(button=>button.addEventListener('click',async()=>{
        try{
          const record=await getRecord(button.dataset.vaultDelete);
          if(!record||record.owner!==owner)return;
          await removeRecord(record.id);
          status.textContent='Encrypted file deleted from this device.';
          await draw();
        }catch(error){status.textContent='Could not delete the encrypted file.';}
      }));
    }catch(error){list.innerHTML='<div class="nx-empty">Encrypted vault storage is unavailable.</div>';status.textContent=String(error?.message||error).slice(0,240);}
  };

  save.addEventListener('click',async()=>{
    const selected=[...(files.files||[])];
    if(!selected.length){status.textContent='Choose one or more files first.';return;}
    if(selected.length>MAX_FILES){status.textContent=`Choose at most ${MAX_FILES} files per batch.`;return;}
    if(pass.value.length<12){status.textContent='Use a passphrase with at least 12 characters for new files.';return;}
    const tooLarge=selected.find(file=>file.size>MAX_FILE);
    if(tooLarge){status.textContent=`${tooLarge.name} is larger than 25 MB.`;return;}
    if(!crypto?.subtle||!window.indexedDB){status.textContent='Encrypted vault is not supported on this device.';return;}
    save.disabled=true;
    try{
      owner=owner||await ownerId();
      for(let index=0;index<selected.length;index++){
        const file=selected[index];
        status.textContent=`Encrypting ${index+1}/${selected.length}: ${file.name}…`;
        const payload=await encryptFile(file,pass.value);
        await putRecord({
          id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,
          owner,
          name:file.name.slice(0,180),
          type:(file.type||'application/octet-stream').slice(0,100),
          size:file.size,
          createdAt:Date.now(),
          cryptoVersion:payload.cryptoVersion,
          kdfIterations:payload.kdfIterations,
          salt:payload.salt,
          iv:payload.iv,
          encrypted:payload.encrypted
        });
      }
      files.value='';
      status.textContent=`${selected.length} file(s) encrypted and saved locally.`;
      await draw();
    }catch(error){status.textContent='Could not encrypt/save the selected file(s).';console.warn('[NexusNova Fresh] vault save:',error);}
    finally{clearPass();save.disabled=false;}
  });

  root.querySelector('[data-vault-refresh]').addEventListener('click',draw);
  draw();
  return root;
}

export const fileVaultSuiteRenderers=Object.freeze({'file-vault':renderFileVaultSuite});
