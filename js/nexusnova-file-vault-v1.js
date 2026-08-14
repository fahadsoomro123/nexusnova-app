/* NexusNova File Vault v1
   Local encrypted file storage using Web Crypto + IndexedDB.
   The passphrase is never stored by NexusNova. Cloud sync is a separate backend feature. */
(() => {
  'use strict';
  if (window.__nxFileVaultV1) return;
  window.__nxFileVaultV1 = true;

  const $ = id => document.getElementById(id);
  const DB_NAME = 'NexusNovaEncryptedVaultV1';
  const STORE = 'files';
  const MAX_FILE = 25 * 1024 * 1024;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const owner = () => String(window.nexusAccountId || 'guest');

  function status(message, ok = true) {
    const el = $('nxVaultStatus');
    if (!el) return;
    el.textContent = message;
    el.style.color = ok ? '#94a3b8' : '#f87171';
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {keyPath:'id'});
          store.createIndex('owner', 'owner', {unique:false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Vault database unavailable.'));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Vault operation failed.'));
    });
  }

  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'},
      material,
      {name:'AES-GCM', length:256},
      false,
      ['encrypt','decrypt']
    );
  }

  async function encryptFile(file, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plain = await file.arrayBuffer();
    const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);
    return {salt:Array.from(salt), iv:Array.from(iv), encrypted};
  }

  async function decryptRecord(record, passphrase) {
    const salt = new Uint8Array(record.salt || []);
    const iv = new Uint8Array(record.iv || []);
    const key = await deriveKey(passphrase, salt);
    return crypto.subtle.decrypt({name:'AES-GCM', iv}, key, record.encrypted);
  }

  async function putRecord(record) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await requestResult(tx.objectStore(STORE).put(record));
    } finally { db.close(); }
  }

  async function getRecord(id) {
    const db = await openDb();
    try {
      return await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    } finally { db.close(); }
  }

  async function deleteRecord(id) {
    const db = await openDb();
    try {
      await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
    } finally { db.close(); }
  }

  async function listRecords() {
    const db = await openDb();
    try {
      const store = db.transaction(STORE, 'readonly').objectStore(STORE);
      let rows = [];
      if (store.indexNames.contains('owner')) {
        rows = await requestResult(store.index('owner').getAll(owner()));
      } else {
        rows = (await requestResult(store.getAll())).filter(row => row.owner === owner());
      }
      return rows.sort((a,b) => Number(b.createdAt) - Number(a.createdAt));
    } finally { db.close(); }
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(1)} MB`;
  }

  async function render() {
    const list = $('nxVaultList');
    if (!list) return;
    try {
      const rows = await listRecords();
      if (!rows.length) {
        list.innerHTML = '<div class="nxmega-muted">No encrypted files saved on this browser yet.</div>';
        return;
      }
      list.innerHTML = rows.map(row => `
        <div class="nxmega-item" data-vault-id="${esc(row.id)}">
          <div><b>${esc(row.name)}</b><small>${formatBytes(row.size)} · ${esc(row.type || 'file')} · ${new Date(row.createdAt).toLocaleString()}</small></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="action-btn" data-vault-download="${esc(row.id)}">Download</button>
            <button type="button" class="action-btn danger" data-vault-delete="${esc(row.id)}">Delete</button>
          </div>
        </div>`).join('');

      list.querySelectorAll('[data-vault-download]').forEach(button => button.addEventListener('click', () => download(button.dataset.vaultDownload)));
      list.querySelectorAll('[data-vault-delete]').forEach(button => button.addEventListener('click', () => remove(button.dataset.vaultDelete)));
    } catch (error) {
      console.warn('NexusNova vault list:', error);
      list.textContent = 'Encrypted vault storage is unavailable in this browser.';
    }
  }

  async function saveSelected() {
    const files = Array.from($('nxMegaFiles')?.files || []);
    const passphrase = String($('nxVaultPass')?.value || '');
    if (!files.length) return status('Choose one or more files first.', false);
    if (passphrase.length < 6) return status('Use a passphrase with at least 6 characters.', false);
    if (!crypto?.subtle || !window.indexedDB) return status('Encrypted vault is not supported in this browser.', false);

    const invalid = files.find(file => file.size > MAX_FILE);
    if (invalid) return status(`${invalid.name} is larger than the 25 MB local-vault limit.`, false);

    const button = $('nxVaultSave');
    if (button) button.disabled = true;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status(`Encrypting ${i+1}/${files.length}: ${file.name}…`);
        const payload = await encryptFile(file, passphrase);
        await putRecord({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          owner: owner(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          createdAt: Date.now(),
          salt: payload.salt,
          iv: payload.iv,
          encrypted: payload.encrypted
        });
      }
      $('nxMegaFiles').value = '';
      status(`${files.length} file(s) encrypted and saved locally.`);
      await render();
    } catch (error) {
      console.error('NexusNova vault save:', error);
      status('Could not encrypt/save the selected file(s).', false);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function download(id) {
    const passphrase = String($('nxVaultPass')?.value || '');
    if (!passphrase) return status('Enter the vault passphrase before downloading.', false);
    try {
      status('Decrypting file…');
      const record = await getRecord(id);
      if (!record || record.owner !== owner()) throw new Error('File not found.');
      const plain = await decryptRecord(record, passphrase);
      const blob = new Blob([plain], {type:record.type || 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.name || 'vault-file';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      status('File decrypted and downloaded.');
    } catch (error) {
      console.warn('NexusNova vault decrypt:', error);
      status('Could not decrypt. Check the passphrase.', false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this encrypted file from this browser?')) return;
    try {
      const record = await getRecord(id);
      if (!record || record.owner !== owner()) return;
      await deleteRecord(id);
      status('Encrypted file deleted.');
      await render();
    } catch (error) {
      console.warn('NexusNova vault delete:', error);
      status('Could not delete the file.', false);
    }
  }

  function install() {
    const tab = $('tab-mega-vault');
    if (!tab || $('nxVaultPanel')) return false;
    const card = tab.querySelector('.card') || tab;
    const panel = document.createElement('div');
    panel.id = 'nxVaultPanel';
    panel.innerHTML = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,.16)">
        <input id="nxVaultPass" type="password" class="tool-input" autocomplete="new-password" placeholder="Vault passphrase (not stored)">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button id="nxVaultSave" type="button" class="tool-btn primary">Encrypt & Save Selected Files</button>
          <button id="nxVaultRefresh" type="button" class="tool-btn">Refresh Vault</button>
        </div>
        <div id="nxVaultStatus" class="nxmega-muted" style="margin-top:8px">Files stay encrypted in this browser. Keep your passphrase safe; NexusNova cannot recover it.</div>
        <div id="nxVaultList" style="margin-top:10px"></div>
      </div>`;
    card.appendChild(panel);
    $('nxVaultSave')?.addEventListener('click', saveSelected);
    $('nxVaultRefresh')?.addEventListener('click', render);
    render();
    return true;
  }

  const boot = () => {
    install();
    [800,1800,3500,7000].forEach(ms => setTimeout(install, ms));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();