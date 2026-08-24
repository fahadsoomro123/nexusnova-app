import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';

async function secureCall(name, data = {}) {
  await requireFirebaseUser({ write:true });
  const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), name);
  const response = await call(data);
  return response?.data || {};
}

export function renderNovaVaultSafe() {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = `
    <section class="nx-vault-hero nx-panel">
      <p class="nx-eyebrow">NOVA REWARD SYSTEM</p>
      <strong data-vault-pending>— VAULTS</strong>
      <span>Server-authoritative rewards • no client-side reward selection</span>
    </section>
    <div class="nx-summary-grid nx-vault-inventory">
      <div><span>Booster</span><strong data-vault-booster>—</strong></div>
      <div><span>Nova Rain</span><strong data-vault-rain>—</strong></div>
      <div><span>Time Warp</span><strong data-vault-warp>—</strong></div>
    </div>
    <section class="nx-tool-card">
      <div class="nx-action-row">
        <button type="button" data-vault-open>OPEN VAULT</button>
        <button type="button" data-vault-boost>USE BOOSTER</button>
        <button type="button" data-vault-rain-use>USE RAIN</button>
      </div>
      <button class="nx-secondary" type="button" data-vault-warp-use style="margin-top:8px">USE 24H TIME WARP</button>
      <p class="nx-tool-meta" data-vault-status>Syncing secure Nova inventory…</p>
    </section>`;

  const pending = root.querySelector('[data-vault-pending]');
  const booster = root.querySelector('[data-vault-booster]');
  const rain = root.querySelector('[data-vault-rain]');
  const warp = root.querySelector('[data-vault-warp]');
  const status = root.querySelector('[data-vault-status]');
  const actionButtons = [...root.querySelectorAll('[data-vault-open],[data-vault-boost],[data-vault-rain-use],[data-vault-warp-use]')];
  let off = null;
  let busy = false;
  let active = true;

  const setBusy = value => {
    busy = Boolean(value);
    actionButtons.forEach(button => { button.disabled = busy; });
  };

  const bind = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        const data = snap.data() || {};
        pending.textContent = `${Math.max(0, Number(data.novaVaultPending) || 0)} VAULTS`;
        booster.textContent = Math.max(0, Number(data.novaBoosterInventory) || 0);
        rain.textContent = Math.max(0, Number(data.novaRainInventory) || 0);
        warp.textContent = Math.max(0, Number(data.novaTimeWarpInventory) || 0);
      }, error => {
        if (active) status.textContent = error?.message || 'Could not sync Nova inventory.';
      });
      if (!active) unsubscribe();
      else off = unsubscribe;
    } catch (error) {
      if (active) status.textContent = error?.message || 'Could not sync Nova inventory.';
    }
  };

  const run = async (label, name, data = {}) => {
    if (busy) return;
    setBusy(true);
    if (active) status.textContent = `${label} • secure server request…`;
    try {
      const result = await secureCall(name, data);
      if (!active) return;
      const reward = result.reward || {};
      status.textContent = result.opened
        ? `✓ Vault opened • ${reward.type || 'reward'} ${Number(reward.amount || 0) || ''}`
        : `✓ ${label} completed.`;
    } catch (error) {
      if (active) status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  };

  root.querySelector('[data-vault-open]').addEventListener('click', () => run('Opening Vault', 'openNovaVault'));
  root.querySelector('[data-vault-boost]').addEventListener('click', () => run('Using Booster', 'useNovaBoost', { kind:'booster' }));
  root.querySelector('[data-vault-rain-use]').addEventListener('click', () => run('Using Nova Rain', 'useNovaBoost', { kind:'rain' }));
  root.querySelector('[data-vault-warp-use]').addEventListener('click', () => run('Using Time Warp', 'useNovaTimeWarp'));

  bind();
  root.__cleanup = () => {
    active = false;
    off?.();
    off = null;
  };
  return root;
}

export const novaVaultSafeRenderers = Object.freeze({ 'nova-vault': renderNovaVaultSafe });
