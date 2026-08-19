const EMPTY_MINING = Object.freeze({
  availability: 'unbound',
  active: false,
  balance: null,
  totalMined: null,
  rate: null,
  sessionRemainingSeconds: null,
  halvingStage: null,
  statusText: 'Backend not connected'
});

class BackendAdapter {
  constructor() {
    this.bridge = null;
    this.listeners = new Set();
    this.handleExternalState = this.handleExternalState.bind(this);
    window.addEventListener('nexusnova:mining-state', this.handleExternalState);
    this.attach(window.NexusNovaFreshBridge || null);
  }

  attach(bridge) {
    if (!bridge || typeof bridge !== 'object') return false;
    this.bridge = bridge;
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
      return { ...EMPTY_MINING, availability: 'error', statusText: 'Mining data unavailable' };
    }
  }

  async toggleMining() {
    if (!this.bridge || typeof this.bridge.toggleMining !== 'function') {
      throw new Error('Mining backend adapter is not connected yet.');
    }
    const result = await this.bridge.toggleMining();
    const normalized = this.normalizeMining(result);
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
      balance: numberOrNull(raw.balance),
      totalMined: numberOrNull(raw.totalMined),
      rate: numberOrNull(raw.rate),
      sessionRemainingSeconds: seconds == null ? null : Math.max(0, Math.floor(seconds)),
      halvingStage: raw.halvingStage ?? null,
      statusText: String(raw.statusText || (raw.active ? 'Mining active' : 'Mining idle'))
    };
  }
}

export const backend = new BackendAdapter();
