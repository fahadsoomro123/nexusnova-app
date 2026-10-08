const PLAY_UPDATE_ACTION = 'playUpdatePrompt';

function nativePlayUpdateRequest() {
  try {
    if (typeof window.nexusPostNativeAction !== 'function') {
      return { started: false, reason: 'native-bridge-unavailable' };
    }
    const started = window.nexusPostNativeAction(PLAY_UPDATE_ACTION, {});
    return { started: !!started, method: 'google-play-in-app-update' };
  } catch (error) {
    console.warn('[NexusNova Play Update] request failed:', error);
    return { started: false, reason: 'native-request-failed' };
  }
}

export class NexusNovaOTAUpdater {
  constructor(options = {}) {
    this.feature = options.feature || 'NexusNova';
    this.destroyed = false;
    this.latestUpdate = null;
  }

  readInstalledBuildState() {
    const info = window.NexusNovaNativeInfo || {};
    return {
      commit: String(info.buildCommit || '').trim().toLowerCase(),
      versionCode: Number(info.versionCode || 0) || 0,
      versionName: String(info.versionName || ''),
      source: 'BuildConfig.NEXUS_BUILD_COMMIT'
    };
  }

  async fetchLatestRepositoryState() {
    return null;
  }

  async checkForUpdates() {
    if (this.destroyed) return null;
    this.latestUpdate = {
      available: false,
      nativeManaged: true,
      method: 'google-play-in-app-update',
      feature: this.feature,
      client: this.readInstalledBuildState()
    };
    return this.latestUpdate;
  }

  requestNativeUpdatePrompt() {
    if (this.destroyed) return false;
    return nativePlayUpdateRequest().started;
  }

  triggerUpdateDownload() {
    return { ...nativePlayUpdateRequest() };
  }

  async applyPatch() {
    const result = nativePlayUpdateRequest();
    return { applied: false, ...result };
  }

  async checkAndNotify() {
    if (this.destroyed) return null;
    nativePlayUpdateRequest();
    return this.checkForUpdates();
  }

  showUpdatePopup() {
    return this.requestNativeUpdatePrompt();
  }

  destroy() {
    this.destroyed = true;
    this.latestUpdate = null;
    return true;
  }
}

export default NexusNovaOTAUpdater;
