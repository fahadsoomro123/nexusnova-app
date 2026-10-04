const REPOSITORY = 'fahadsoomro123/nexusnova-app';
const BRANCH = 'main';
const COMMIT_API = 'https://api.github.com/repos/' + REPOSITORY + '/commits/' + BRANCH;
const RELEASE_API = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
const STYLE_ID = 'nn-ota-updater-style';
let styleNode = null;
let styleUsers = 0;

function acquireStyle() {
  if (!styleNode) {
    styleNode = document.createElement('style');
    styleNode.id = STYLE_ID;
    styleNode.textContent = [
      '.nn-ota-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;box-sizing:border-box;background:rgba(4,8,18,.74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}',
      '.nn-ota-card{width:min(92vw,430px);padding:26px;box-sizing:border-box;border:1px solid rgba(167,139,250,.35);border-radius:24px;background:linear-gradient(180deg,rgba(31,41,55,.99),rgba(17,24,39,.99));box-shadow:0 30px 90px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.05);color:#f9fafb;text-align:center}',
      '.nn-ota-card[hidden],.nn-ota-modal[hidden]{display:none}',
      '.nn-ota-badge{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 10px;border-radius:999px;background:rgba(109,40,217,.18);border:1px solid rgba(167,139,250,.28);color:#c4b5fd;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}',
      '.nn-ota-card h2{margin:16px 0 10px;font-size:21px;line-height:1.2;letter-spacing:-.02em}',
      '.nn-ota-card p{margin:0 auto 18px;max-width:365px;font-size:13px;line-height:1.6;color:#d1d5db}',
      '.nn-ota-meta{margin:0 auto 18px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.035);color:#9ca3af;font:600 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}',
      '.nn-ota-update{width:100%;min-height:46px;border:0;border-radius:14px;background:#6d28d9;color:#fff;font:800 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 26px rgba(109,40,217,.28)}',
      '.nn-ota-update:disabled{opacity:.62;cursor:wait}',
      '.nn-ota-later{width:100%;margin-top:9px;min-height:40px;border:1px solid rgba(148,163,184,.18);border-radius:13px;background:rgba(255,255,255,.03);color:#cbd5e1;font:700 12px/1 system-ui,sans-serif;cursor:pointer}',
      '.nn-ota-diagnostic{position:fixed;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483646;padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:16px;background:rgba(15,23,42,.96);box-shadow:0 16px 50px rgba(0,0,0,.38);color:#e5e7eb;font:600 10px/1.45 system-ui,sans-serif}',
      '.nn-ota-diagnostic__head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}',
      '.nn-ota-diagnostic__head strong{font-size:10px;letter-spacing:.08em}',
      '.nn-ota-diagnostic__close{width:24px;height:24px;border:0;border-radius:8px;background:rgba(255,255,255,.06);color:#cbd5e1;font-size:17px;line-height:1;cursor:pointer}',
      '.nn-ota-diagnostic__grid{display:grid;gap:5px}',
      '.nn-ota-diagnostic__grid>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px;align-items:center}',
      '.nn-ota-diagnostic span{color:#94a3b8}',
      '.nn-ota-diagnostic code{overflow-wrap:anywhere;color:#f8fafc;font:700 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.nn-ota-diagnostic b{font-size:10px;color:#f8fafc}',
      '.nn-ota-diagnostic .is-match b{color:#86efac}',
      '.nn-ota-diagnostic .is-mismatch b{color:#fca5a5}',
      '@media(max-width:390px){.nn-ota-card{padding:22px;border-radius:21px}.nn-ota-card h2{font-size:19px}.nn-ota-diagnostic{left:8px;right:8px;padding:10px}.nn-ota-diagnostic__grid>div{grid-template-columns:1fr}.nn-ota-diagnostic__grid>div+div{margin-top:2px}}'
    ].join('');
    document.head.appendChild(styleNode);
  }
  styleUsers += 1;
  return function release() {
    styleUsers = Math.max(0, styleUsers - 1);
    if (styleUsers === 0) { styleNode && styleNode.remove(); styleNode = null; }
  };
}

function sha40(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(text) ? text : '';
}

function jsonUrl(url) {
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'otaNonce=' + Date.now();
}

function requestNativeUpdate(update) {
  try {
    if (typeof window.nexusPostNativeAction !== 'function') {
      return { started: false, reason: 'native-bridge-unavailable' };
    }
    if (!update?.apkUrl) {
      return { started: false, reason: 'no-installable-apk' };
    }
    const started = window.nexusPostNativeAction('installUpdate', {
      apkUrl: update.apkUrl
    });
    return { started: !!started, method: 'native-package-installer' };
  } catch (error) {
    console.warn('[NexusNova OTA] native update request failed:', error);
    return { started: false, reason: 'native-request-failed' };
  }
}

export class NexusNovaOTAUpdater {
  constructor(options = {}) {
    this.repository = options.repository || REPOSITORY;
    this.branch = options.branch || BRANCH;
    this.commitApi = options.commitApi || COMMIT_API;
    this.releaseApi = options.releaseApi || RELEASE_API;
    this.feature = options.feature || 'NOVA HUB';
    this.clientCommit = sha40(options.clientCommit || window.NexusNovaNativeInfo?.buildCommit);
    this.clientVersionCode = Number(options.clientVersionCode || window.NexusNovaNativeInfo?.versionCode || 0) || 0;
    this.clientVersionName = String(options.clientVersionName || window.NexusNovaNativeInfo?.versionName || '');
    this.controller = new AbortController();
    this.destroyed = false;
    this.latestUpdate = null;
    this.modal = null;
    this.releaseStyle = null;
    this.modalCleanup = null;
    this.diagnosticPanel = null;
    this.diagnosticState = null;
    this.nativeInstallEventHandler = event => this.handleNativeInstallEvent(event);
    window.addEventListener('nexusnova:ota-install', this.nativeInstallEventHandler, { signal: this.controller.signal });
  }

  async fetchJson(url) {
    if (this.destroyed) return null;
    const response = await fetch(jsonUrl(url), {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json, application/json' },
      signal: this.controller.signal
    });
    if (!response.ok) throw new Error('OTA HTTP ' + response.status);
    return response.json();
  }

  readInstalledBuildState() {
    const info = window.NexusNovaNativeInfo || {};
    return {
      commit: sha40(info.buildCommit),
      versionCode: Number(info.versionCode || 0) || 0,
      versionName: String(info.versionName || ''),
      source: 'BuildConfig.NEXUS_BUILD_COMMIT'
    };
  }

  renderDiagnosticReport(state) {
    if (this.destroyed || !state || !document.body) return;
    if (!this.diagnosticPanel) {
      if (!this.releaseStyle) this.releaseStyle = acquireStyle();
      const panel = document.createElement('section');
      panel.className = 'nn-ota-diagnostic';
      panel.setAttribute('aria-label', 'NexusNova runtime diagnostic');
      panel.innerHTML = '<div class="nn-ota-diagnostic__head"><strong>DIAGNOSTIC RUNTIME STATE</strong><button type="button" class="nn-ota-diagnostic__close" aria-label="Hide diagnostic">×</button></div><div class="nn-ota-diagnostic__grid"></div>';
      document.body.appendChild(panel);
      this.diagnosticPanel = panel;
      const close = panel.querySelector('.nn-ota-diagnostic__close');
      close?.addEventListener('click', () => panel.remove(), { signal: this.controller.signal });
    }
    const grid = this.diagnosticPanel.querySelector('.nn-ota-diagnostic__grid');
    if (!grid) return;
    const status = state.status === 'MATCH' ? 'MATCH' : 'MISMATCH';
    const statusClass = status === 'MATCH' ? 'is-match' : 'is-mismatch';
    grid.innerHTML = [
      '<div><span>Current Device Running Code SHA</span><code>' + (state.installedCommit || 'UNAVAILABLE') + '</code></div>',
      '<div><span>GitHub Repository Latest SHA</span><code>' + (state.latestCommit || 'UNAVAILABLE') + '</code></div>',
      '<div class="' + statusClass + '"><span>Verification Delta Status</span><b>' + status + '</b></div>',
      '<div><span>Checked</span><code>' + state.checkedAt + '</code></div>'
    ].join('');
  }

  verifyRuntimeState(repositoryState) {
    const installed = this.readInstalledBuildState();
    const latestCommit = sha40(repositoryState?.sha);
    const status = installed.commit && latestCommit && installed.commit === latestCommit ? 'MATCH' : 'MISMATCH';
    const state = {
      installedCommit: installed.commit,
      latestCommit: latestCommit,
      status: status,
      versionCode: installed.versionCode,
      versionName: installed.versionName,
      checkedAt: new Date().toISOString()
    };
    this.diagnosticState = state;
    console.info('[NexusNova Diagnostic]', JSON.stringify(state));
    this.renderDiagnosticReport(state);
    return state;
  }

  async fetchLatestRepositoryState() {
    const repositoryState = await this.fetchJson(this.commitApi);
    if (this.destroyed) return null;
    return repositoryState;
  }

  async checkForUpdates() {
    if (this.destroyed) return null;
    const results = await Promise.all([
      this.fetchJson(this.commitApi).catch(error => {
        if (error?.name === 'AbortError') throw error;
        console.warn('[NexusNova OTA] latest commit lookup failed:', error);
        return null;
      }),
      this.fetchJson(this.releaseApi).catch(error => {
        if (error?.name === 'AbortError') throw error;
        console.info('[NexusNova OTA] release lookup unavailable:', error);
        return null;
      })
    ]);
    if (this.destroyed) return null;
    const commit = results[0];
    const release = results[1];
    const latestCommit = sha40(commit?.sha);
    if (commit) this.verifyRuntimeState(commit);
    if (!latestCommit) return { available: false, reason: 'latest-commit-unavailable' };
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const apk = assets.find(asset => /\.apk$/i.test(String(asset?.name || '')) && typeof asset?.browser_download_url === 'string');
    const releaseMetadata = assets.find(asset => String(asset?.name || '') === 'output-metadata.json' && typeof asset?.browser_download_url === 'string');
    const available = !!this.clientCommit && latestCommit !== this.clientCommit && !!apk?.browser_download_url;
    this.latestUpdate = {
      available: available,
      latestCommit: latestCommit,
      shortSha: latestCommit.slice(0, 7),
      latestMessage: String(commit?.commit?.message || 'NexusNova update').split('\n')[0],
      commitUrl: commit?.html_url || ('https://github.com/' + this.repository + '/commit/' + latestCommit),
      releaseUrl: release?.html_url || ('https://github.com/' + this.repository + '/releases'),
      apkUrl: apk?.browser_download_url || '',
      releaseTag: String(release?.tag_name || ''),
      metadataUrl: releaseMetadata?.browser_download_url || '',
      clientCommit: this.clientCommit,
      clientVersionCode: this.clientVersionCode,
      clientVersionName: this.clientVersionName,
      feature: this.feature
    };
    return this.latestUpdate;
  }

  triggerUpdateDownload(update = this.latestUpdate) {
    if (this.destroyed || !update?.available) return { started: false, reason: 'no-update' };
    if (!update.apkUrl) return { started: false, reason: 'no-installable-apk' };
    return { ...requestNativeUpdate(update), url: update.apkUrl };
  }

  async applyPatch(update = this.latestUpdate) {
    if (this.destroyed || !update?.available) return { applied: false, reason: 'no-update' };
    return { applied: false, reason: 'native-installer', ...this.triggerUpdateDownload(update) };
  }

  handleNativeInstallEvent(event) {
    if (this.destroyed || !this.modal) return;
    const detail = event?.detail || {};
    const copy = this.modal.querySelector('.nn-ota-card p');
    const button = this.modal.querySelector('.nn-ota-update');
    if (!copy || !button) return;

    const eventName = String(detail.event || '');
    if (eventName === 'download-start') {
      copy.textContent = 'Downloading the signed NexusNova update in the background…';
      button.textContent = 'Downloading…';
      button.disabled = true;
    } else if (eventName === 'download-progress') {
      const percent = Math.max(0, Math.min(100, Number(detail.percent || 0)));
      copy.textContent = 'Downloading update package… ' + percent + '%';
      button.textContent = percent >= 100 ? 'Verifying…' : 'Downloading… ' + percent + '%';
    } else if (eventName === 'download-complete') {
      copy.textContent = 'Update package downloaded. Verifying package identity and signature…';
      button.textContent = 'Verifying…';
    } else if (eventName === 'install-staged') {
      copy.textContent = 'Opening Android system installer…';
      button.textContent = 'Installer Ready';
    } else if (eventName === 'install-prompt') {
      copy.textContent = 'Android is ready to confirm this signed update.';
      button.textContent = 'Installer Open';
    } else if (eventName === 'success') {
      copy.textContent = 'Update installed successfully. NexusNova will restart with the new build.';
      button.textContent = 'Installed';
    } else if (eventName === 'cancelled') {
      copy.textContent = 'Update download cancelled.';
      button.textContent = 'Update Now';
      button.disabled = false;
    } else if (eventName === 'failure') {
      copy.textContent = String(detail.message || 'The update could not be installed safely.');
      button.textContent = 'Update Now';
      button.disabled = false;
    }
  }

  showUpdatePopup(update = this.latestUpdate) {
    if (this.destroyed || !update?.available || this.modal) return false;
    if (!this.releaseStyle) this.releaseStyle = acquireStyle();
    const modal = document.createElement('div');
    modal.className = 'nn-ota-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const card = document.createElement('div');
    card.className = 'nn-ota-card';
    const badge = document.createElement('div'); badge.className = 'nn-ota-badge'; badge.textContent = 'UPDATE';
    const title = document.createElement('h2'); title.textContent = (this.feature === 'AI Video Studio' ? 'New AI Video Studio Update Available' : 'New NOVA HUB Update Available') + ' (v' + update.shortSha + ')';
    const copy = document.createElement('p');
    copy.textContent = this.feature === 'AI Video Studio' ? 'Please update to continue.' : 'A newer NexusNova build is available. Please update to continue.';
    const meta = document.createElement('div'); meta.className = 'nn-ota-meta';
    meta.textContent = 'commit: ' + update.latestCommit + (update.releaseTag ? ' • release: ' + update.releaseTag : '');
    const updateButton = document.createElement('button'); updateButton.className = 'nn-ota-update'; updateButton.type = 'button'; updateButton.textContent = 'Update Now';
    const laterButton = document.createElement('button'); laterButton.className = 'nn-ota-later'; laterButton.type = 'button'; laterButton.textContent = 'Later';
    card.append(badge, title, copy, meta, updateButton, laterButton);
    modal.appendChild(card); document.body.appendChild(modal); this.modal = modal;
    const dismiss = () => { if (this.modal) this.modal.remove(); this.modal = null; };
    updateButton.addEventListener('click', async () => {
      if (this.destroyed) return;
      updateButton.disabled = true; updateButton.textContent = 'Starting secure download…';
      copy.textContent = 'Preparing the signed NexusNova update…';
      const result = await this.applyPatch(update);
      if (this.destroyed) return;
      if (!result.started) {
        copy.textContent = result.reason === 'native-bridge-unavailable'
          ? 'Native installer unavailable in this build.'
          : 'The signed APK could not be started for installation.';
        updateButton.disabled = false;
        updateButton.textContent = 'Update Now';
      }
    }, { signal: this.controller.signal });
    laterButton.addEventListener('click', dismiss, { signal: this.controller.signal });
    modal.addEventListener('click', event => { if (event.target === modal) dismiss(); }, { signal: this.controller.signal });
    this.modalCleanup = dismiss;
    requestAnimationFrame(() => updateButton.focus());
    return true;
  }

  async checkAndNotify() {
    const update = await this.checkForUpdates();
    if (update?.available) this.showUpdatePopup(update);
    return update;
  }

  destroy() {
    if (this.destroyed) return false;
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        window.nexusPostNativeAction('cancelUpdate', {});
      }
    } catch (_) {}
    this.destroyed = true;
    this.controller.abort();
    this.modalCleanup?.();
    this.modalCleanup = null;
    this.modal = null;
    this.latestUpdate = null;
    this.diagnosticPanel?.remove();
    this.diagnosticPanel = null;
    this.diagnosticState = null;
    this.releaseStyle?.();
    this.releaseStyle = null;
    return true;
  }
}

export default NexusNovaOTAUpdater;