import { icon } from '../../components/icons.js';
import { backend } from '../../core/backend-adapter.js';

const DAY_SECONDS = 86_400;
const DAY_MS = DAY_SECONDS * 1000;
const DIAGNOSTIC_DISABLE_MINING_CLOCK = true;
let cleanupCurrent = null;

function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '--:--:--';
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatTimeLeft(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s left`;
  if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s left`;
  return `${s}s left`;
}

function projectedBalance(state) {
  if (!Number.isFinite(state.balance)) return null;
  if (!state.active || !state.startedAt) return state.balance;
  const elapsedHours = Math.max(0, (Date.now() - state.startedAt) / 3_600_000);
  return state.balance + Math.min(24, elapsedHours * (Number(state.rate) || 1));
}

function remainingFromState(state) {
  if (!state.active || !state.startedAt) return state.sessionRemainingSeconds ?? DAY_SECONDS;
  return Math.max(0, Math.ceil((DAY_MS - (Date.now() - state.startedAt)) / 1000));
}

function sessionProgress(state) {
  if (!state.active || !state.startedAt) return 0;
  return Math.max(0, Math.min(1, (Date.now() - state.startedAt) / DAY_MS));
}

export async function mineScreen({ openHubApp, beforeMiningRenewal } = {}) {
  cleanupCurrent?.();
  cleanupCurrent = null;

  const root = document.createElement('section');
  root.className = 'nx-screen';
  root.innerHTML = `
    <header class="nx-screen-head">
      <div>
        <p class="nx-eyebrow">NEXUSNOVA NETWORK</p>
        <h1 class="nx-title">Mine</h1>
        <p class="nx-subtitle">Secure 24H NVX mining with tasks, vault rewards and boost tools.</p>
      </div>
      <span class="nx-status-dot" data-mining-dot aria-hidden="true"></span>
    </header>

    <article class="nx-nebula-miner" data-nebula-state="ready" aria-label="NVX mining session">
      <div class="nx-nebula-miner__head">
        <div>
          <span>NVX MINING</span>
          <strong><i data-rate-dot></i><b data-miner-state>SECURE READY</b></strong>
        </div>
        <span class="nx-nebula-miner__sync">SERVER SYNCED</span>
      </div>

      <div class="nx-nebula-miner__layout">
        <div class="nx-nebula-core" data-nebula-core style="--nx-nebula-progress:0deg">
          <div class="nx-nebula-core__aura"></div>
          <div class="nx-nebula-core__orbit nx-nebula-core__orbit--outer"></div>
          <div class="nx-nebula-core__orbit nx-nebula-core__orbit--mid"></div>
          <div class="nx-nebula-core__orbit nx-nebula-core__orbit--inner"></div>
          <div class="nx-nebula-core__center">
            <span class="nx-nebula-core__mark">N</span>
            <strong data-progress-percent>0%</strong>
            <span data-time-left>24h 00m 00s left</span>
            <small>24H SESSION</small>
          </div>
        </div>

        <div class="nx-nebula-readouts">
          <div class="nx-nebula-readout">
            <span>BALANCE</span>
            <strong data-balance>-- <small>NVX</small></strong>
          </div>
          <div class="nx-nebula-readout">
            <span>LIVE RATE</span>
            <strong><b data-rate>--</b> <small>NVX/H</small></strong>
          </div>
        </div>
      </div>

      <div class="nx-nebula-meta">
        <div><span>STAGE</span><strong data-stage>--</strong></div>
        <div><span>VAULTS</span><strong data-vaults>0</strong></div>
        <div><span>SESSION</span><strong data-session>24:00:00</strong></div>
      </div>

      <button class="nx-nebula-action" type="button" data-mine-action disabled>SYNCING SECURE MINING</button>
      <p class="nx-nebula-status" data-mining-status>Checking your secure session…</p>
    </article>

    <section class="nx-mining-tools" aria-label="Mining tools">
      <div class="nx-mining-tools__head">
        <div><p class="nx-eyebrow">MINING ECOSYSTEM</p><h2>NVX tools</h2></div>
        <span>4 CORE TOOLS</span>
      </div>
      <div class="nx-mining-tool-grid">
        <button class="nx-mining-tool nx-mining-tool--featured" type="button" data-open-app="tasks">
          <span class="nx-mining-tool__icon">${icon('tasks')}</span><div><strong>Tasks</strong><span>NVX rewards + community missions</span></div>
        </button>
        <button class="nx-mining-tool nx-mining-tool--boost" type="button" data-open-app="nova-vault">
          <span class="nx-mining-tool__icon">${icon('vault')}</span><div><strong>Nova Vault + 10X</strong><span>Secure boosted reward chance</span></div><b>10X</b>
        </button>
        <button class="nx-mining-tool" type="button" data-open-app="wallet">
          <span class="nx-mining-tool__icon">${icon('wallet')}</span><div><strong>Wallet</strong><span>NVX balance + assets</span></div>
        </button>
        <button class="nx-mining-tool" type="button" data-open-app="market">
          <span class="nx-mining-tool__icon">${icon('market')}</span><div><strong>Market</strong><span>Live asset prices</span></div>
        </button>
      </div>
    </section>
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
    rateDot: root.querySelector('[data-rate-dot]'),
    minerState: root.querySelector('[data-miner-state]'),
    core: root.querySelector('[data-nebula-core]'),
    progressPercent: root.querySelector('[data-progress-percent]'),
    timeLeft: root.querySelector('[data-time-left]'),
    miner: root.querySelector('.nx-nebula-miner')
  };

  let state = await backend.getMiningSnapshot();
  let clockTimer = null;
  let busy = false;

  const paintLiveProgress = () => {
    const remaining = remainingFromState(state);
    const progress = sessionProgress(state);
    const percent = progress * 100;
    const complete = state.active && remaining <= 0;
    const visualPercent = complete ? 100 : percent;

    refs.core.style.setProperty('--nx-nebula-progress', `${visualPercent * 3.6}deg`);
    refs.progressPercent.textContent = `${Math.round(visualPercent * 10) / 10}%`;
    refs.timeLeft.textContent = complete ? 'Session complete' : (state.active ? formatTimeLeft(remaining) : '24h 00m 00s left');
    refs.session.textContent = state.active ? formatClock(remaining) : '24:00:00';
    refs.miner.dataset.nebulaState = complete ? 'complete' : (state.active ? 'active' : 'ready');
  };

  const render = next => {
    state = next || state;
    const balance = projectedBalance(state);
    refs.balance.innerHTML = `${balance == null ? '--' : balance.toFixed(4)} <small>NVX</small>`;
    refs.rate.textContent = Number.isFinite(state.rate) ? Number(state.rate).toFixed(4) : '--';
    refs.stage.textContent = state.halvingStage == null ? '--' : `STAGE ${state.halvingStage}`;
    refs.vaults.textContent = String(state.novaVaultPending || 0);
    refs.dot.dataset.state = state.active ? 'active' : 'idle';
    refs.rateDot.dataset.state = state.active ? 'active' : 'idle';
    refs.minerState.textContent = state.active ? 'LIVE' : 'READY';
    refs.status.textContent = state.statusText || 'Mining status unavailable';

    const remaining = remainingFromState(state);
    paintLiveProgress();

    refs.button.disabled = busy || state.availability === 'unbound' || state.availability === 'error' || (state.active && remaining > 0);
    if (busy) refs.button.textContent = 'WORKING…';
    else if (state.availability === 'error') refs.button.textContent = 'SECURE MINING UNAVAILABLE';
    else if (state.active && remaining <= 0) refs.button.textContent = 'CLAIM & RENEW';
    else if (state.active) refs.button.textContent = 'MINING ACTIVE';
    else refs.button.textContent = 'START 24H MINING';
  };

  const tick = () => {
    if (!state?.active) return;
    const balance = projectedBalance(state);
    refs.balance.innerHTML = `${balance == null ? '--' : balance.toFixed(4)} <small>NVX</small>`;
    paintLiveProgress();
    if (remainingFromState(state) <= 0) render(state);
  };

  render(state);
  if (DIAGNOSTIC_DISABLE_MINING_CLOCK) {
    console.warn('[NexusNova Diagnostic] one-second mining clock disabled for crash isolation');
  } else {
    clockTimer = setInterval(tick, 1000);
  }
  const off = backend.subscribeMining(render);

  const performMiningAction = async () => {
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
  };

  refs.button.addEventListener('click', () => {
    if (busy) return;
    const renewingCompletedSession = state.active && remainingFromState(state) <= 0;
    busy = true;
    render(state);

    const proceed = () => {
      refs.status.textContent = renewingCompletedSession
        ? 'Starting the next secure 24-hour session…'
        : 'Starting secure mining…';
      performMiningAction();
    };

    if (renewingCompletedSession && typeof beforeMiningRenewal === 'function') {
      refs.status.textContent = 'Opening ad before the next 24-hour session…';
      Promise.resolve(beforeMiningRenewal(proceed)).catch(error => {
        console.warn('[NexusNova Fresh] mining renewal ad gate:', error);
        proceed();
      });
      return;
    }

    // Ordinary current-session start remains ad-free by the approved policy.
    proceed();
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
