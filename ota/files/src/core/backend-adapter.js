import { toggleMiningCloudflare } from './nova-mining-rewards-store.js';

const EMPTY_MINING = Object.freeze({
  availability: 'unbound',
  active: false,
  startedAt: 0,
  balance: null,
  totalMined: null,
  rate: null,
  sessionRemainingSeconds: null,
  sessionComplete: false,
  halvingStage: null,
  novaVaultPending: 0,
  statusText: 'Backend not connected'
});

class BackendAdapter {
  constructor() {
    this.bridge = null;
    this.listeners = new Set();
    this.bridgeUnsubscribe = null;
    this.handleExternalState = this.handleExternalState.bind(this);
    window.addEventListener('nexusnova:mining-state', this.handleExternalState);
    this.attach(window.NexusNovaFreshBridge || null);
  }

  attach(bridge) {
    if (!bridge || typeof bridge !== 'object') return false;
    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
    this.bridge = bridge;
    if (typeof bridge.subscribeMining === 'function') {
      this.bridgeUnsubscribe = bridge.subscribeMining(snapshot => this.emit(this.normalizeMining(snapshot)));
    }
    return true;
  }

  async getMiningSnapshot() {
    if (!this.bridge || typeof this.bridge.getMiningSnapshot !== 'function') {
      return { ...EMPTY_MINING };
    }
    try {
      const raw = await this.bridge.getMiningSnapshot();
      return this.normalizeMining(raw);
    } catch (error) {
      console.error('[NexusNova Fresh] mining snapshot failed', error);
      return { ...EMPTY_MINING, availability: 'error', statusText: error?.message || 'Mining data unavailable' };
    }
  }

  async toggleMining() {
    // Mining mutations are permanently routed through Cloudflare v2. Firebase
    // remains the identity/account store and live snapshot source, but App Check
    // or callable Functions are not required for START / CLAIM & RENEW writes.
    const result = await toggleMiningCloudflare({ source:'fresh-rebuild-cloudflare-v2' });

    // After the Worker commits Firestore, read the canonical normalized snapshot
    // through the existing bridge so the Mine UI receives its usual shape.
    if (this.bridge && typeof this.bridge.getMiningSnapshot === 'function') {
      try {
        const fresh = await this.bridge.getMiningSnapshot();
        const normalized = this.normalizeMining(fresh);
        this.emit(normalized);
        return normalized;
      } catch (error) {
        console.warn('[NexusNova Fresh] post-Cloudflare mining snapshot:', error);
      }
    }

    // Safe fallback if the read channel is temporarily unavailable.
    const normalized = this.normalizeMining({
      availability:'ready',
      active:result?.miningActive === true,
      startedAt:Number(result?.miningStartedAt) || 0,
      balance:result?.balance,
      totalMined:result?.totalMined,
      rate:1,
      novaVaultPending:result?.novaVaultPending,
      statusText:result?.renewed ? 'Mining renewed through Cloudflare' : 'Mining active through Cloudflare'
    });
    this.emit(normalized);
    return normalized;
  }

  subscribeMining(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handleExternalState(event) {
    this.emit(this.normalizeMining(event.detail));
  }

  emit(snapshot) {
    this.listeners.forEach(listener => {
      try { listener(snapshot); } catch (error) { console.error(error); }
    });
  }

  normalizeMining(raw = {}) {
    const numberOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;
    const seconds = numberOrNull(raw.sessionRemainingSeconds);
    return {
      availability: raw.availability || 'ready',
      active: Boolean(raw.active),
      startedAt: Math.max(0, Math.floor(numberOrNull(raw.startedAt) || 0)),
      balance: numberOrNull(raw.balance),
      totalMined: numberOrNull(raw.totalMined),
      rate: numberOrNull(raw.rate),
      sessionRemainingSeconds: seconds == null ? null : Math.max(0, Math.floor(seconds)),
      sessionComplete: Boolean(raw.sessionComplete),
      halvingStage: raw.halvingStage ?? null,
      novaVaultPending: Math.max(0, Math.floor(numberOrNull(raw.novaVaultPending) || 0)),
      statusText: String(raw.statusText || (raw.active ? 'Mining active' : 'Mining idle'))
    };
  }
}

export const backend = new BackendAdapter();
