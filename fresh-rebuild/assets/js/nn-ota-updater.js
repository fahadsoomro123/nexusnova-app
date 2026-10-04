const REPOSITORY = 'fahadsoomro123/nexusnova-app';
const BRANCH = 'main';
const COMMIT_API = 'https://api.github.com/repos/' + REPOSITORY + '/commits/' + BRANCH;
const RELEASE_API = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
const METADATA_URL = 'https://raw.githubusercontent.com/' + REPOSITORY + '/main/NexusNovaAndroid/app/build/outputs/apk/debug/output-metadata.json';
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
      '@media(max-width:390px){.nn-ota-card{padding:22px;border-radius:21px}.nn-ota-card h2{font-size:19px}}'
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

function openUpdateChannel(url) {
  try {
    if (typeof window.nexusPostNativeAction === 'function') {
      return window.nexusPostNativeAction('openExternal', { url: url });
    }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    return !!opened;
  } catch (error) {
    console.warn('[NexusNova OTA] update handoff failed:', error);
    return false;
  }
}

export class NexusNovaOTAUpdater {
  constructor(options = {}) {
    this.repository = options.repository || REPOSITORY;
    this.branch = options.branch || BRANCH;
    this.commitApi = options.commitApi || COMMIT_API;
    this.releaseApi = options.releaseApi || RELEASE_API;
    this.metadataUrl = options.metadataUrl === false ? '' : (options.metadataUrl || METADATA_URL);
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
      }),
      this.metadataUrl ? this.fetchJson(this.metadataUrl).catch(error => {
        if (error?.name === 'AbortError') throw error;
        return null;
      }) : Promise.resolve(null)
    ]);
    if (this.destroyed) return null;
    const commit = results[0];
    const release = results[1];
    const metadata = results[2];
    const latestCommit = sha40(commit?.sha);
    if (!latestCommit) return { available: false, reason: 'latest-commit-unavailable' };
    const available = !!this.clientCommit && latestCommit !== this.clientCommit;
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const apk = assets.find(asset => /\.apk$/i.test(String(asset?.name || '')) && typeof asset?.browser_download_url === 'string');
    this.latestUpdate = {
      available: available,
      latestCommit: latestCommit,
      shortSha: latestCommit.slice(0, 7),
      latestMessage: String(commit?.commit?.message || 'NexusNova update').split('\n')[0],
      commitUrl: commit?.html_url || ('https://github.com/' + this.repository + '/commit/' + latestCommit),
      releaseUrl: release?.html_url || ('https://github.com/' + this.repository + '/releases'),
      apkUrl: apk?.browser_download_url || '',
      releaseTag: String(release?.tag_name || ''),
      metadata: metadata,
      clientCommit: this.clientCommit,
      clientVersionCode: this.clientVersionCode,
      clientVersionName: this.clientVersionName,
      feature: this.feature
    };
    return this.latestUpdate;
  }

  triggerUpdateDownload(update = this.latestUpdate) {
    if (this.destroyed || !update?.available) return { started: false, reason: 'no-update' };
    const url = update.apkUrl || update.releaseUrl || update.commitUrl;
    if (!url) return { started: false, reason: 'no-endpoint' };
    return { started: openUpdateChannel(url), url: url, method: update.apkUrl ? 'apk-release-asset' : 'release-page' };
  }

  async applyPatch(update = this.latestUpdate) {
    if (this.destroyed || !update?.available) return { applied: false, reason: 'no-update' };
    return { applied: false, reason: 'platform-update-handoff', ...this.triggerUpdateDownload(update) };
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
    const title = document.createElement('h2'); title.textContent = 'New AI Video Studio Update Available';
    const copy = document.createElement('p');
    copy.textContent = 'Update v' + update.shortSha + ' has arrived. Install the latest build to access the newest multi-layer timeline tools.';
    const meta = document.createElement('div'); meta.className = 'nn-ota-meta';
    meta.textContent = 'commit: ' + update.latestCommit + (update.releaseTag ? ' • release: ' + update.releaseTag : '');
    const updateButton = document.createElement('button'); updateButton.className = 'nn-ota-update'; updateButton.type = 'button'; updateButton.textContent = 'Update Now';
    const laterButton = document.createElement('button'); laterButton.className = 'nn-ota-later'; laterButton.type = 'button'; laterButton.textContent = 'Later';
    card.append(badge, title, copy, meta, updateButton, laterButton);
    modal.appendChild(card); document.body.appendChild(modal); this.modal = modal;
    const dismiss = () => { if (this.modal) this.modal.remove(); this.modal = null; };
    updateButton.addEventListener('click', async () => {
      if (this.destroyed) return;
      updateButton.disabled = true; updateButton.textContent = 'Opening Update…';
      const result = await this.applyPatch(update);
      if (this.destroyed) return;
      if (result.started) { copy.textContent = 'The official NexusNova update channel has been opened.'; updateButton.textContent = 'Update Opened'; }
      else { copy.textContent = 'No installable APK release is published for this commit yet. The notification is ready for the next published build.'; updateButton.disabled = false; updateButton.textContent = 'Update Now'; }
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
    this.destroyed = true;
    this.controller.abort();
    this.modalCleanup?.();
    this.modalCleanup = null;
    this.modal = null;
    this.latestUpdate = null;
    this.releaseStyle?.();
    this.releaseStyle = null;
    return true;
  }
}

export default NexusNovaOTAUpdater;