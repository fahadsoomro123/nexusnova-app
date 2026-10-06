import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function scopedKey(name) {
  try {
    const user = await requireFirebaseUser();
    return `nexus_fresh_${name}_${user.uid}`;
  } catch {
    return `nexus_fresh_${name}_device`;
  }
}

function expiryLabel(value) {
  if (!value) return 'No expiry date';
  const at = new Date(`${value}T23:59:59`).getTime();
  if (!Number.isFinite(at)) return 'Invalid expiry date';
  const days = Math.ceil((at - Date.now()) / 86_400_000);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function renderDocumentsSuite() {
  const root = node(`
    <section class="nx-tool-card">
      <strong>Document Viewer</strong>
      <label class="nx-file-picker">
        <input type="file" multiple accept="application/pdf,text/plain,text/markdown,image/*" data-doc-files>
        <strong>Choose documents</strong>
        <span>PDF, text, markdown or images • max 5 files per selection</span>
      </label>
      <p class="nx-tool-meta" data-doc-status>Files stay in memory for this screen unless another backend is explicitly connected.</p>
    </section>
    <section class="nx-stack" data-doc-list></section>
    <section class="nx-tool-card" data-doc-preview hidden></section>

    <section class="nx-tool-card">
      <strong>Document Expiry Reminders</strong>
      <label class="nx-field"><span>Document</span><input maxlength="120" data-exp-doc-name placeholder="Passport, ID card, license…"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Expiry date</span><input type="date" data-exp-doc-date></label>
        <label class="nx-field"><span>Note</span><input maxlength="240" data-exp-doc-note placeholder="Renewal details"></label>
      </div>
      <button class="nx-primary" type="button" data-exp-doc-add>ADD REMINDER</button>
      <p class="nx-tool-meta" data-exp-doc-status>Expiry reminders are saved on this device for the signed-in NexusNova account.</p>
    </section>
    <section class="nx-stack" data-exp-doc-list></section>
  `);

  const input = root.querySelector('[data-doc-files]');
  const list = root.querySelector('[data-doc-list]');
  const preview = root.querySelector('[data-doc-preview]');
  const status = root.querySelector('[data-doc-status]');
  let files = [];
  let activeObjectUrl = '';

  const revokePreviewUrl = () => {
    if (!activeObjectUrl) return;
    try { URL.revokeObjectURL(activeObjectUrl); } catch {}
    activeObjectUrl = '';
  };

  const drawFiles = () => {
    list.innerHTML = files.length ? files.map((file, index) => `
      <button class="nx-doc-row" type="button" data-doc-index="${index}">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${escapeHtml(file.type || 'unknown')} • ${(file.size / 1024).toFixed(1)} KB</span>
      </button>
    `).join('') : '<div class="nx-empty">No documents selected.</div>';

    list.querySelectorAll('[data-doc-index]').forEach(button => button.addEventListener('click', async () => {
      const file = files[Number(button.dataset.docIndex)];
      if (!file) return;
      revokePreviewUrl();
      preview.hidden = false;
      if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
        if (file.size > 1_000_000) {
          preview.textContent = 'Text preview limited to files under 1 MB.';
          return;
        }
        preview.textContent = (await file.text()).slice(0, 20_000);
      } else if (file.type.startsWith('image/')) {
        const img = new Image();
        img.alt = file.name;
        activeObjectUrl = URL.createObjectURL(file);
        img.src = activeObjectUrl;
        preview.replaceChildren(img);
      } else {
        preview.textContent = 'PDF metadata is available above. Full PDF rendering is not enabled in this fresh screen.';
      }
    }));
  };

  input.addEventListener('change', () => {
    files = [...input.files].slice(0, 5);
    status.textContent = `${files.length} file${files.length === 1 ? '' : 's'} selected • no upload performed`;
    preview.hidden = true;
    revokePreviewUrl();
    drawFiles();
  });
  drawFiles();

  const reminderName = root.querySelector('[data-exp-doc-name]');
  const reminderDate = root.querySelector('[data-exp-doc-date]');
  const reminderNote = root.querySelector('[data-exp-doc-note]');
  const reminderStatus = root.querySelector('[data-exp-doc-status]');
  const reminderList = root.querySelector('[data-exp-doc-list]');
  let reminderKey = '';

  const drawReminders = () => {
    if (!reminderKey) return;
    const rows = loadJson(reminderKey, []).slice().sort((a, b) => {
      const aa = a.expiry ? new Date(`${a.expiry}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
      const bb = b.expiry ? new Date(`${b.expiry}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
      return aa - bb;
    });
    reminderList.innerHTML = rows.length ? rows.map(row => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(row.name)}</strong><button class="nx-icon-button" type="button" data-exp-doc-delete="${escapeHtml(row.id)}">×</button></div>
        <p>${row.expiry ? `Expiry: ${escapeHtml(row.expiry)} • ${escapeHtml(expiryLabel(row.expiry))}` : 'No expiry date'}${row.note ? `<br>${escapeHtml(row.note)}` : ''}</p>
      </article>
    `).join('') : '<div class="nx-empty">No document expiry reminders.</div>';

    reminderList.querySelectorAll('[data-exp-doc-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(reminderKey, loadJson(reminderKey, []).filter(row => row.id !== button.dataset.expDocDelete));
      drawReminders();
    }));
  };

  scopedKey('document_reminders_v1').then(key => {
    reminderKey = key;
    const fresh = loadJson(key, null);
    if (Array.isArray(fresh)) {
      drawReminders();
      return;
    }
    const legacy = loadJson('nexus_docs', []);
    if (Array.isArray(legacy) && legacy.length) {
      const migrated = legacy.map(row => ({
        id: uid('document'),
        name: String(row?.name || '').trim().slice(0, 120) || 'Document',
        expiry: String(row?.expiry || '').slice(0, 10),
        note: String(row?.note || '').trim().slice(0, 240)
      }));
      saveJson(key, migrated.slice(-300));
      reminderStatus.textContent = 'Previous document reminders migrated to the fresh account-scoped store.';
    } else {
      saveJson(key, []);
    }
    drawReminders();
  });

  root.querySelector('[data-exp-doc-add]').addEventListener('click', () => {
    if (!reminderKey) return;
    const name = reminderName.value.trim().slice(0, 120);
    if (!name) {
      reminderStatus.textContent = 'Enter a document name.';
      return;
    }
    const rows = loadJson(reminderKey, []);
    rows.push({
      id: uid('document'),
      name,
      expiry: reminderDate.value || '',
      note: reminderNote.value.trim().slice(0, 240)
    });
    saveJson(reminderKey, rows.slice(-300));
    reminderName.value = '';
    reminderDate.value = '';
    reminderNote.value = '';
    reminderStatus.textContent = 'Document reminder saved.';
    drawReminders();
  });

  root.__cleanup = () => {
    revokePreviewUrl();
    files = [];
  };
  return root;
}

export const documentsSuiteRenderers = Object.freeze({
  documents: renderDocumentsSuite
});
