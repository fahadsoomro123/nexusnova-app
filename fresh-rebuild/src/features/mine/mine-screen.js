import { icon } from '../../components/icons.js';
import { createGauge } from '../../components/instrument-gauge.js';
import { backend } from '../../core/backend-adapter.js';

const DAY_SECONDS = 86_400;
let cleanupCurrent = null;

function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '--:--:--';
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function projectedBalance(state) {
  if (!Number.isFinite(state.balance)) return null;
  if (!state.active || !state.startedAt) return state.balance;
  const elapsedHours = Math.max(0, (Date.now() - state.startedAt) / 3_600_000);
  return state.balance + Math.min(24, elapsedHours * (Number(state.rate) || 1));
}

function remainingFromState(state) {
  if (!state.active || !state.startedAt) return state.sessionRemainingSeconds ?? DAY_SECONDS;
  return Math.max(0, Math.ceil((86_400_000 - (Date.now() - state.startedAt)) / 1000));
}

export async function mineScreen({ openHubApp } = {}) {
  cleanupCurrent?.();
  cleanupCurrent = null;

  const root = document.createElement('section');
  root.className = 'nx-screen';
  root.innerHTML = `
    <header class="nx-screen-head">
      <div>
        <p class="nx-eyebrow">NEXUSNOVA NETWORK</p>
        <h1 class="nx-title">Mine</h1>
        <p class="nx-subtitle">Compact secure mining. No filler, no duplicate panels.</p>
      </div>
      <span class="nx-status-dot" data-mining-dot aria-hidden="true"></span>
    </header>

    <article class="nx-panel nx-miner" aria-label="NVX mining session">
      <div class="nx-miner-grid">
        <div>
          <div class="nx-balance-label">NVX Balance</div>
          <div class="nx-balance" data-balance>-- <small>NVX</small></div>
          <div class="nx-rate">Rate <strong data-rate>--</strong> NVX/h</div>
        </div>
        <div class="nx-gauge-wrap" data-gauge-wrap>${createGauge({ value: 0, min: 0, max: 1, unit: 'NVX/H' })}</div>
      </div>

      <div class="nx-session">
        <div class="nx-metric"><span>Session</span><strong data-session>--:--:--</strong></div>
        <div class="nx-metric"><span>Stage</span><strong data-stage>--</strong></div>
        <div class="nx-metric"><span>Vaults</span><strong data-vaults>0</strong></div>
      </div>

      <button class="nx-primary" type="button" data-mine-action disabled>SYNCING SECURE MINING</button>
      <p class="nx-subtitle" data-mining-status style="margin-bottom:0">Checking your secure session…</p>
    </article>

    <div class="nx-quick-grid" aria-label="Core quick access">
      <button class="nx-quick" type="button" data-open-app="wallet">${icon('wallet')}<strong>Wallet</strong><span>Assets & portfolio</span></button>
      <button class="nx-quick" type="button" data-open-app="tasks">${icon('tasks')}<strong>Rewards</strong><span>Daily & tasks</span></button>
      <button class="nx-quick" type="button" data-open-app="market">${icon('market')}<strong>Market</strong><span>Top assets</span></button>
    </div>
  `;

  const refs = {
    balance: root.querySelector('[data-balance]'),
    rate: root.querySelector('[data-rate]'),
    session: root.querySelector('[data-session]'),
    stage: root.querySelector('[data-stage]'),
    vaults: root.querySelector('[data-vaults]'),
    status: root.querySelector('[data-mining-status]'),
    button: root.querySelector('[data-mine-action]'),
    dot: root.querySelector('[data-mining-dot]'),
    gauge: root.querySelector('[data-gauge-wrap]')
  };

  let state = await backend.getMiningSnapshot();
  let clockTimer = null;
  let busy = false;

  const render = next => {
    state = next || state;
    const balance = projectedBalance(state);
    refs.balance.innerHTML = `${balance == null ? '--' : balance.toFixed(4)} <small>NVX</small>`;
    refs.rate.textContent = Number.isFinite(state.rate) ? Number(state.rate).toFixed(4) : '--';
    refs.stage.textContent = state.halvingStage == null ? '--' : `STAGE ${state.halvingStage}`;
    refs.vaults.textContent = String(state.novaVaultPending || 0);
    refs.dot.dataset.state = state.active ? 'active' : 'idle';
    refs.status.textContent = state.statusText || 'Mining status unavailable';
    refs.gauge.innerHTML = createGauge({ value: Number(state.rate) || 0, min: 0, max: Math.max(1, Number(state.rate) || 1), unit: 'NVX/H' });

    const remaining = remainingFromState(state);
    refs.session.textContent = state.active ? formatClock(remaining) : '24:00:00';

    refs.button.disabled = busy || state.availability === 'unbound' || state.availability === 'error' || (state.active && remaining > 0);
    if (busy) refs.button.textContent = 'WORKING…';
    else if (state.availability === 'error') refs.button.textContent = 'SECURE MINING UNAVAILABLE';
    else if (state.active && remaining <= 0) refs.button.textContent = 'CLAIM + START NEXT';
    else if (state.active) refs.button.textContent = 'MINING ACTIVE';
    else refs.button.textContent = 'START 24H MINING';
  };

  const tick = () => {
    if (!state?.active) return;
    const remaining = remainingFromState(state);
    refs.session.textContent = formatClock(remaining);
    const balance = projectedBalance(state);
    refs.balance.innerHTML = `${balance == null ? '--' : balance.toFixed(4)} <small>NVX</small>`;
    if (remaining <= 0) render(state);
  };

  render(state);
  clockTimer = setInterval(tick, 1000);
  const off = backend.subscribeMining(render);

  refs.button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    render(state);
    try {
      state = await backend.toggleMining();
      render(state);
    } catch (error) {
      refs.status.textContent = error?.message || 'Mining action failed.';
      state = { ...state, availability: state.availability === 'unbound' ? 'error' : state.availability };
      render(state);
    } finally {
      busy = false;
      render(state);
    }
  });

  root.querySelectorAll('[data-open-app]').forEach(button => {
    button.addEventListener('click', () => openHubApp?.(button.dataset.openApp));
  });

  cleanupCurrent = () => {
    clearInterval(clockTimer);
    off?.();
  };

  return root;
}
