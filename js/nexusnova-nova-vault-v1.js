/* NexusNova Nova Vault v1
   One free Vault is granted after each natural 24-hour mining completion.
   Vault rewards are server-authoritative; this client never chooses or writes
   reward value. Nova Booster, Nova Rain, Nova Vault and Time Warp share one
   15-second cooldown enforced by the backend and mirrored in the UI. */
(() => {
  'use strict';
  if (window.__nxNovaVaultV1) return;
  window.__nxNovaVaultV1 = true;
  window.nexusNovaVaultVersion = 'nova-vault-v1';

  const COOLDOWN_MS = 15_000;
  const STYLE_ID = 'nxNovaVaultStyle';
  const PANEL_ID = 'nxNovaVaultPanel';
  const FIREBASE_VERSION = '12.1.0';
  const $ = id => document.getElementById(id);

  let modulesPromise = null;
  let authUnsubscribe = null;
  let userUnsubscribe = null;
  let renderTimer = null;
  let busy = '';

  const state = {
    pending: 0,
    booster: 0,
    rain: 0,
    timeWarp: 0,
    cooldownUntil: 0,
    lastReward: '',
    lastRewardAmount: 0
  };

  const cleanInt = value => Math.max(0, Math.floor(Number(value) || 0));
  const cooldownRemainingMs = () => Math.max(0, Number(state.cooldownUntil || 0) - Date.now());
  const inventory = () => Object.freeze({
    booster: cleanInt(state.booster),
    rain: cleanInt(state.rain),
    timeWarp: cleanInt(state.timeWarp),
    pendingVaults: cleanInt(state.pending)
  });

  function currentMining() {
    try {
      if (typeof window.nexusSecureMiningState === 'function') return window.nexusSecureMiningState() || {};
      if (typeof window.NexusNovaMiningBoosters?.status === 'function') return window.NexusNovaMiningBoosters.status() || {};
    } catch (_) {}
    return {};
  }

  function adopt(raw = {}) {
    state.pending = cleanInt(raw.novaVaultPending);
    state.booster = cleanInt(raw.novaBoosterInventory);
    state.rain = cleanInt(raw.novaRainInventory);
    state.timeWarp = cleanInt(raw.novaTimeWarpInventory);
    state.cooldownUntil = cleanInt(raw.novaFeatureCooldownUntil);
    state.lastReward = String(raw.novaLastVaultReward || '').slice(0, 32);
    state.lastRewardAmount = Math.max(0, Number(raw.novaLastVaultAmount) || 0);
    render();
    window.dispatchEvent(new CustomEvent('nexusnova:nova-vault-state', { detail: status() }));
  }

  function installStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:2px 0 18px;padding:15px;border:1px solid rgba(190,125,255,.28);border-radius:22px;background:radial-gradient(circle at 88% 10%,rgba(164,91,255,.17),transparent 34%),linear-gradient(145deg,rgba(8,12,34,.96),rgba(20,12,49,.92));box-shadow:0 18px 46px rgba(52,20,111,.22),inset 0 1px rgba(255,255,255,.04);color:#f5f2ff}
      .nx-vault-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.nx-vault-kicker{font-size:9px;font-weight:950;letter-spacing:.18em;color:#c69cff}.nx-vault-title{margin-top:3px;font-size:17px;font-weight:950}.nx-vault-title small{display:block;margin-top:4px;font-size:9px;font-weight:700;color:#8f83ad;line-height:1.45}.nx-vault-pending{padding:6px 9px;border-radius:999px;background:rgba(186,116,255,.12);border:1px solid rgba(202,154,255,.24);font-size:9px;font-weight:950;color:#e2c7ff;white-space:nowrap}
      .nx-vault-inventory{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}.nx-vault-item{padding:9px 8px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);text-align:center}.nx-vault-item b{display:block;font-size:15px;color:#fff}.nx-vault-item span{display:block;margin-top:2px;font-size:8px;color:#9188a8;font-weight:800;letter-spacing:.05em}
      .nx-vault-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.nx-vault-btn{border:0;border-radius:12px;padding:10px 8px;background:linear-gradient(135deg,#8057ff,#b45cff);color:#fff;font-size:9px;font-weight:950;letter-spacing:.04em;cursor:pointer}.nx-vault-btn.secondary{background:linear-gradient(135deg,#164f9d,#1c9cca)}.nx-vault-btn.warp{background:linear-gradient(135deg,#a34775,#ea7b47)}.nx-vault-btn:disabled{cursor:not-allowed;opacity:.42;filter:saturate(.45)}
      .nx-vault-open{grid-column:1/-1;padding:12px;font-size:10px;background:linear-gradient(135deg,#7246ff,#d05cff)}.nx-vault-status{margin-top:9px;text-align:center;font-size:9px;line-height:1.45;color:#9087a8}.nx-vault-status strong{color:#dbc4ff}.nx-vault-odds{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);font-size:8px;line-height:1.45;color:#716b82;text-align:center}
      @media(max-width:390px){.nx-vault-inventory{grid-template-columns:1fr 1fr 1fr}.nx-vault-actions{grid-template-columns:1fr}.nx-vault-open{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    installStyle();
    let panel = $(PANEL_ID);
    if (panel) return panel;
    const timer = $('timer');
    if (!timer?.parentNode) return null;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="nx-vault-head">
        <div><div class="nx-vault-kicker">NOVA REWARD SYSTEM</div><div class="nx-vault-title">🔐 Nova Vault<small>1 free Vault after every natural 24H mining completion</small></div></div>
        <div class="nx-vault-pending" id="nxVaultPending">0 VAULTS</div>
      </div>
      <div class="nx-vault-inventory">
        <div class="nx-vault-item"><b id="nxVaultBooster">0</b><span>⚡ BOOSTER</span></div>
        <div class="nx-vault-item"><b id="nxVaultRain">0</b><span>☄ NOVA RAIN</span></div>
        <div class="nx-vault-item"><b id="nxVaultWarp">0</b><span>⏩ TIME WARP</span></div>
      </div>
      <div class="nx-vault-actions">
        <button type="button" class="nx-vault-btn nx-vault-open" id="nxVaultOpen">OPEN NOVA VAULT</button>
        <button type="button" class="nx-vault-btn secondary" id="nxVaultUseBooster">USE BOOSTER • -2H</button>
        <button type="button" class="nx-vault-btn secondary" id="nxVaultUseRain">USE NOVA RAIN • -2H</button>
        <button type="button" class="nx-vault-btn warp" id="nxVaultUseWarp">USE 24H TIME WARP</button>
      </div>
      <div class="nx-vault-status" id="nxVaultStatus">Syncing Nova Vault…</div>
      <div class="nx-vault-odds">Vault odds: NVX 60% • Booster 18% • Nova Rain 17% • 24H Time Warp 5% • NVX reward is 1–10. Time Warp never creates another Vault.</div>`;

    const boostPanel = $('nxMiningBoostPanel');
    if (boostPanel?.parentNode) boostPanel.insertAdjacentElement('afterend', panel);
    else timer.insertAdjacentElement('afterend', panel);

    $('nxVaultOpen')?.addEventListener('click', openVault);
    $('nxVaultUseBooster')?.addEventListener('click', () => useBoost('booster'));
    $('nxVaultUseRain')?.addEventListener('click', () => useBoost('rain'));
    $('nxVaultUseWarp')?.addEventListener('click', useTimeWarp);
    return panel;
  }

  function render() {
    if (!installPanel()) return;
    const left = cooldownRemainingMs();
    const mining = currentMining();
    const active = mining.active === true || mining.miningActive === true;
    const complete = active && Number(mining.startedAt ?? mining.miningStartedAt) > 0 && Date.now() - Number(mining.startedAt ?? mining.miningStartedAt) >= 86_400_000;
    const seconds = Math.ceil(left / 1000);

    if ($('nxVaultPending')) $('nxVaultPending').textContent = `${state.pending} VAULT${state.pending === 1 ? '' : 'S'}`;
    if ($('nxVaultBooster')) $('nxVaultBooster').textContent = String(state.booster);
    if ($('nxVaultRain')) $('nxVaultRain').textContent = String(state.rain);
    if ($('nxVaultWarp')) $('nxVaultWarp').textContent = String(state.timeWarp);

    const open = $('nxVaultOpen');
    const booster = $('nxVaultUseBooster');
    const rain = $('nxVaultUseRain');
    const warp = $('nxVaultUseWarp');
    const locked = left > 0 || Boolean(busy);
    if (open) {
      open.disabled = locked || state.pending < 1;
      open.textContent = busy === 'vault' ? 'OPENING SECURE VAULT…' : left > 0 ? `COOLDOWN ${seconds}s` : state.pending > 0 ? 'OPEN NOVA VAULT' : 'NO VAULT READY';
    }
    if (booster) {
      booster.disabled = locked || state.booster < 1 || !active || complete;
      booster.textContent = left > 0 ? `BOOSTER IN ${seconds}s` : state.booster > 0 ? 'USE BOOSTER • -2H' : 'NO BOOSTER IN VAULT';
    }
    if (rain) {
      rain.disabled = locked || state.rain < 1 || !active || complete;
      rain.textContent = left > 0 ? `RAIN IN ${seconds}s` : state.rain > 0 ? 'USE NOVA RAIN • -2H' : 'NO NOVA RAIN IN VAULT';
    }
    if (warp) {
      warp.disabled = locked || state.timeWarp < 1 || !active || complete;
      warp.textContent = left > 0 ? `TIME WARP IN ${seconds}s` : state.timeWarp > 0 ? 'USE 24H TIME WARP' : 'NO TIME WARP IN VAULT';
    }

    const statusNode = $('nxVaultStatus');
    if (statusNode) {
      if (left > 0) statusNode.innerHTML = `<strong>15s shared cooldown active</strong> • next Nova action in ${seconds}s`;
      else if (busy) statusNode.textContent = 'Secure Nova action is processing…';
      else if (state.pending > 0) statusNode.innerHTML = `<strong>${state.pending} free Vault${state.pending === 1 ? '' : 's'} ready</strong> • no ad or payment required to open`;
      else statusNode.textContent = 'Complete a natural 24-hour mining session to earn your next free Nova Vault.';
    }
  }

  async function firebaseModules() {
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`)
      ]);
    }
    return modulesPromise;
  }

  async function secureCallable(name, data = {}) {
    const [appMod, authMod, , fnMod] = await firebaseModules();
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase is not ready yet.');
    const auth = authMod.getAuth(app);
    let user = auth.currentUser;
    if (!user) throw new Error('Please sign in first.');
    await user.reload();
    user = auth.currentUser || user;
    if (!user.emailVerified) throw new Error('Verify your email before using Nova Vault rewards.');
    await user.getIdToken(true);
    if (typeof window.nexusRequireAppCheck !== 'function') throw new Error('Firebase App Check is unavailable.');
    await window.nexusRequireAppCheck();
    return (await fnMod.httpsCallable(fnMod.getFunctions(app), name)(data)).data || {};
  }

  async function showMessage(title, text, icon = 'spark') {
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({ eyebrow:'NOVA VAULT', title, text, icon, buttonText:'OK' });
        return;
      }
    } catch (_) {}
    console.info(`Nova Vault — ${title}: ${text}`);
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || 'Nova action failed.');
    if (/not found|unavailable|internal|functions/i.test(raw)) {
      return 'Nova Vault secure backend is not live on this build yet. No reward value was changed.';
    }
    return raw.replace(/^FirebaseError:\s*/i, '').slice(0, 260);
  }

  async function syncMining(result = {}) {
    try {
      if (typeof window.nexusSecureAdoptMiningState === 'function' && Object.prototype.hasOwnProperty.call(result, 'miningActive')) {
        window.nexusSecureAdoptMiningState(result);
        return;
      }
      await window.nexusSecureSyncMining?.({ force:true });
    } catch (_) {}
  }

  async function runAction(kind, action) {
    if (busy) return null;
    const left = cooldownRemainingMs();
    if (left > 0) {
      await showMessage('Nova Cooldown', `Wait ${Math.ceil(left / 1000)} seconds before using another Booster, Rain, Vault or Time Warp.`, 'security');
      return null;
    }
    busy = kind;
    render();
    try {
      const result = await action();
      if (Number.isFinite(Number(result.balance))) window.nexusApplySecureAccountState?.(result);
      if (Number.isFinite(Number(result.cooldownUntil))) state.cooldownUntil = Number(result.cooldownUntil);
      await syncMining(result);
      return result;
    } catch (error) {
      console.error('NexusNova Nova Vault:', error);
      await showMessage('Nova Action Unavailable', friendlyError(error), 'security');
      return null;
    } finally {
      busy = '';
      render();
    }
  }

  async function openVault() {
    const result = await runAction('vault', () => secureCallable('openNovaVault'));
    if (!result) return null;
    const reward = result.reward || {};
    const type = String(reward.type || 'reward');
    const amount = Number(reward.amount || 0);
    const copy = type === 'nvx'
      ? `You found +${amount.toFixed(0)} NVX.`
      : type === 'booster'
        ? 'You found 1 Nova Booster. It is stored in your Vault inventory.'
        : type === 'rain'
          ? 'You found 1 Nova Rain. It is stored in your Vault inventory.'
          : 'RARE DROP: 1 × 24H Time Warp added to your Vault inventory.';
    await showMessage('Nova Vault Opened', `${copy} A 15-second cooldown is now active.`, type === 'time-warp' ? 'spark' : 'security');
    return result;
  }

  async function useBoost(kind) {
    const requested = String(kind || '').toLowerCase() === 'rain' ? 'rain' : 'booster';
    const result = await runAction(requested, () => secureCallable('useNovaBoost', { kind:requested }));
    if (!result) return null;
    await showMessage(
      requested === 'rain' ? 'Nova Rain Applied' : 'Nova Booster Applied',
      `Mining time reduced by 2 hours. Total reduction this session: ${Number(result.reducedHours || 0)} hours. Next Nova action unlocks in 15 seconds.`,
      'spark'
    );
    return result;
  }

  async function useTimeWarp() {
    const result = await runAction('time-warp', () => secureCallable('useNovaTimeWarp'));
    if (!result) return null;
    await showMessage(
      '24H Time Warp Complete',
      `Current mining session completed and +${Number(result.earned || 24).toFixed(0)} NVX was credited. Time Warp does not create another Vault. Tap START MINING next; NexusNova will show the required ad first, then activate the new session.`,
      'spark'
    );
    return result;
  }

  async function subscribe() {
    if (authUnsubscribe) return;
    try {
      const [appMod, authMod, fsMod] = await firebaseModules();
      const app = appMod.getApps()[0];
      if (!app) return;
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      authUnsubscribe = authMod.onAuthStateChanged(auth, user => {
        try { userUnsubscribe?.(); } catch (_) {}
        userUnsubscribe = null;
        if (!user) {
          adopt({});
          return;
        }
        const ref = fsMod.doc(db, 'users', user.uid);
        userUnsubscribe = fsMod.onSnapshot(ref, snap => {
          if (snap.exists()) adopt(snap.data() || {});
        }, error => console.warn('Nova Vault state watch:', error));
      });
    } catch (error) {
      console.warn('Nova Vault subscription unavailable:', error);
    }
  }

  function status() {
    return Object.freeze({
      version: 'nova-vault-v1',
      pending: state.pending,
      inventory: inventory(),
      cooldownUntil: state.cooldownUntil,
      cooldownRemainingMs: cooldownRemainingMs(),
      busy,
      lastReward: state.lastReward,
      lastRewardAmount: state.lastRewardAmount
    });
  }

  window.NexusNovaVault = Object.freeze({
    open: openVault,
    useBoost,
    useTimeWarp,
    status,
    inventory,
    cooldownRemainingMs,
    cooldownMs: COOLDOWN_MS
  });

  function boot() {
    installPanel();
    render();
    subscribe();
    if (!renderTimer) renderTimer = setInterval(render, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.addEventListener('load', boot, { once:true });
  [400, 1200, 2800].forEach(ms => setTimeout(boot, ms));
  console.info('NexusNova Nova Vault loaded: nova-vault-v1');
})();
