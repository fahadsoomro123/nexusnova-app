/* NexusNova consent-based Firebase Analytics + retention bridge v1
   Privacy rules:
   - Firebase Analytics is not initialized until the user explicitly opts in.
   - No UID, email, wallet address, search text, message text, contact data,
     exact location, referral code, page URL/query string, or form values are
     sent as custom analytics parameters.
   - Automatic page_view is disabled; NexusNova records only a strict whitelist
     of safe product events/features plus Firebase's consented session signals.
*/
(() => {
  'use strict';
  if (window.__nxAnalyticsV1) return;
  window.__nxAnalyticsV1 = true;
  window.nexusAnalyticsVersion = 'firebase-consent-v1';

  const CONSENT_KEY = 'nexusnova_analytics_consent_v1';
  const PROMPT_DELAY_MS = 3200;
  const LATER_REPROMPT_MS = 30 * 24 * 60 * 60 * 1000;
  const FIREBASE_VERSION = '12.1.0';
  const SAFE_EVENT_NAMES = new Set([
    'nx_app_session',
    'nx_feature_open',
    'nx_mining_action',
    'nx_daily_reward_action',
    'nx_rewarded_ad_action',
    'nx_growth_action',
    'nx_referral_action',
    'nx_onboarding_complete',
    'nx_onboarding_skip',
    'nx_bug_report_open'
  ]);
  const SAFE_FEATURES = new Set([
    'home','mine','mining','wallet','tasks','market','more','all-apps','about',
    'tools','gold-fx','news','chat','ai','location','sos','family','profile','daily',
    'budget','learn','travel','health','smart','qibla','pk-news','watch','browser',
    'caller','settings','super-app','daily-tools','calendar','reminders','finance',
    'weather','learning','pakistan-hub','islamic-hub','bible','habits','savings',
    'contacts','shopping','documents','file-vault','qr-tools','security','marketplace',
    'orders','notifications','teacher-toolkit','growth','leaderboard'
  ]);
  const SAFE_ACTIONS = new Set(['mine','claim','open','share']);
  const SAFE_STATUSES = new Set(['completed','skipped']);

  let adapter = null;
  let initPromise = null;
  let runtimeState = 'off';
  let sessionLogged = false;
  let promptNode = null;

  function safeSlug(value, max = 40) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max);
  }

  function knownFeature(value) {
    const feature = safeSlug(value, 40);
    return SAFE_FEATURES.has(feature) ? feature : '';
  }

  function readConsent() {
    try {
      const value = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      if (!value || typeof value !== 'object') return { status:'unknown', at:0 };
      const status = ['granted','denied','later'].includes(value.status) ? value.status : 'unknown';
      return { status, at:Number(value.at) || 0 };
    } catch (_) {
      return { status:'unknown', at:0 };
    }
  }

  function writeConsent(status) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ status, at:Date.now() }));
    } catch (_) {}
  }

  function consentGranted() {
    return readConsent().status === 'granted';
  }

  function currentFeature() {
    const active = document.querySelector('.tab.active,.tab-content.active,[id^="tab-"][style*="display: block"]');
    if (active?.id) return knownFeature(active.id.replace(/^tab-/, '')) || 'home';
    return 'home';
  }

  function featureFromButton(button) {
    if (!button) return '';
    const dataValue = button.dataset?.nxmega || button.dataset?.target || button.dataset?.tab || '';
    if (dataValue) return knownFeature(dataValue);
    const onclick = String(button.getAttribute?.('onclick') || '');
    const match = onclick.match(/(?:openMoreTab|switchTab)\(\s*['"]([^'"]+)['"]/i);
    if (match) return knownFeature(match[1]);
    if (button.id === 'moreBtn') return 'all-apps';
    return '';
  }

  function cleanParams(params = {}) {
    const out = {};
    if ('feature' in params) {
      const feature = knownFeature(params.feature);
      if (feature) out.feature = feature;
    }
    if ('source' in params) {
      const sourceRaw = safeSlug(params.source, 40);
      const source = sourceRaw === 'web' ? 'web' : knownFeature(sourceRaw);
      if (source) out.source = source;
    }
    if ('action' in params) {
      const action = safeSlug(params.action, 20);
      if (SAFE_ACTIONS.has(action)) out.action = action;
    }
    if ('status' in params) {
      const status = safeSlug(params.status, 20);
      if (SAFE_STATUSES.has(status)) out.status = status;
    }
    return out;
  }

  async function buildAdapter() {
    if (window.__nxAnalyticsTestAdapter?.init) {
      return window.__nxAnalyticsTestAdapter.init();
    }

    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    const analyticsModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`);

    if (!(await analyticsModule.isSupported())) {
      throw new Error('Firebase Analytics is not supported in this browser context.');
    }

    let app = null;
    for (let i = 0; i < 40; i += 1) {
      const apps = appModule.getApps();
      if (apps.length) {
        app = apps[0];
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!app) throw new Error('Firebase app is not ready yet.');

    let analytics;
    try {
      analytics = analyticsModule.initializeAnalytics(app, {
        config: { send_page_view:false }
      });
    } catch (_) {
      analytics = analyticsModule.getAnalytics(app);
    }

    return {
      log(name, params) {
        analyticsModule.logEvent(analytics, name, params);
      },
      setEnabled(enabled) {
        analyticsModule.setAnalyticsCollectionEnabled(analytics, Boolean(enabled));
      },
      setConsent(granted) {
        try {
          analyticsModule.setConsent({
            analytics_storage: granted ? 'granted' : 'denied',
            ad_storage:'denied',
            ad_user_data:'denied',
            ad_personalization:'denied'
          });
        } catch (_) {}
      }
    };
  }

  async function initializeIfAllowed() {
    if (!consentGranted()) {
      runtimeState = 'off';
      renderCards();
      return false;
    }
    if (adapter) return true;
    if (initPromise) return initPromise;

    runtimeState = 'connecting';
    renderCards();
    initPromise = (async () => {
      try {
        adapter = await buildAdapter();
        adapter?.setConsent?.(true);
        adapter?.setEnabled?.(true);
        runtimeState = 'on';
        renderCards();
        logSessionOnce();
        return true;
      } catch (error) {
        console.warn('NexusNova Analytics:', error?.message || error);
        runtimeState = 'unavailable';
        renderCards();
        return false;
      } finally {
        initPromise = null;
      }
    })();
    return initPromise;
  }

  function track(eventName, params = {}) {
    if (!SAFE_EVENT_NAMES.has(eventName) || !consentGranted() || !adapter || runtimeState !== 'on') return false;
    try {
      adapter.log(eventName, cleanParams(params));
      return true;
    } catch (_) {
      return false;
    }
  }

  function logSessionOnce() {
    if (sessionLogged || !adapter || runtimeState !== 'on') return;
    sessionLogged = true;
    track('nx_app_session', { source:'web' });
  }

  async function enable() {
    writeConsent('granted');
    hidePrompt();
    const ok = await initializeIfAllowed();
    renderCards();
    return ok;
  }

  function disable() {
    writeConsent('denied');
    hidePrompt();
    try { adapter?.setConsent?.(false); } catch (_) {}
    try { adapter?.setEnabled?.(false); } catch (_) {}
    runtimeState = 'off';
    renderCards();
    return true;
  }

  function later() {
    writeConsent('later');
    hidePrompt();
    runtimeState = 'off';
    renderCards();
  }

  function statusLabel() {
    const consent = readConsent().status;
    if (runtimeState === 'connecting') return 'CONNECTING';
    if (runtimeState === 'unavailable') return 'UNAVAILABLE';
    if (consent === 'granted' && runtimeState === 'on') return 'ON';
    if (consent === 'later') return 'NOT NOW';
    return 'OFF';
  }

  function ensureStyle() {
    if (document.getElementById('nxAnalyticsStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxAnalyticsStyle';
    style.textContent = `
      .nx-analytics-card{margin-top:12px;padding:14px;border-radius:16px;border:1px solid rgba(34,211,238,.14);background:linear-gradient(150deg,rgba(8,47,73,.24),rgba(15,23,42,.7));color:#e5f7ff}
      .nx-analytics-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.nx-analytics-title{font-size:11px;font-weight:950;letter-spacing:.05em}.nx-analytics-state{font-size:8px;font-weight:950;padding:5px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.2);color:#9bdff1}.nx-analytics-copy{font-size:9px;line-height:1.55;color:#8299ad;margin-top:8px}.nx-analytics-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.nx-analytics-btn{border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:8px 10px;background:#0f172a;color:#dbeafe;font-size:8px;font-weight:900;cursor:pointer}.nx-analytics-btn.primary{background:linear-gradient(135deg,#0891b2,#6d28d9);border-color:transparent;color:#fff}
      #nxAnalyticsPrompt{position:fixed;left:14px;right:14px;bottom:88px;z-index:2147482500;display:flex;justify-content:center;pointer-events:none}#nxAnalyticsPrompt[hidden]{display:none!important}.nx-analytics-prompt-card{width:min(560px,100%);padding:15px;border-radius:18px;border:1px solid rgba(34,211,238,.22);background:linear-gradient(160deg,#071522,#0b1220);box-shadow:0 18px 60px rgba(0,0,0,.42);color:#eaf7ff;pointer-events:auto}.nx-analytics-prompt-title{font-size:12px;font-weight:950}.nx-analytics-prompt-text{font-size:9px;line-height:1.55;color:#91a6b9;margin-top:7px}.nx-analytics-prompt-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:11px}
      #nxAnalyticsPrivacy{position:fixed;inset:0;z-index:2147482600;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82)}#nxAnalyticsPrivacy[hidden]{display:none!important}.nx-analytics-privacy-card{width:min(520px,100%);padding:18px;border-radius:20px;background:#08131f;border:1px solid rgba(34,211,238,.18);color:#eaf7ff;box-shadow:0 28px 90px rgba(0,0,0,.45)}.nx-analytics-privacy-card h3{font-size:16px;margin:0}.nx-analytics-privacy-card p{font-size:10px;line-height:1.65;color:#94a9bb}.nx-analytics-privacy-card strong{color:#dff8ff}.nx-analytics-privacy-close{width:100%;margin-top:7px}
    `;
    document.head.appendChild(style);
  }

  function cardHtml() {
    const on = consentGranted();
    return `
      <div class="nx-analytics-head"><div class="nx-analytics-title">📊 ANONYMOUS USAGE & RETENTION</div><span class="nx-analytics-state">${statusLabel()}</span></div>
      <div class="nx-analytics-copy">${on
        ? 'Anonymous Firebase Analytics is enabled. NexusNova measures sessions, retention and safe feature usage without sending your email, UID, wallet, searches, messages, exact location or form values.'
        : 'Analytics is optional. Device-local insights still work without it. Enable anonymous analytics only if you want to help improve NexusNova.'}</div>
      <div class="nx-analytics-actions">
        <button type="button" class="nx-analytics-btn primary" data-nx-analytics-toggle>${on ? 'DISABLE ANALYTICS' : 'ENABLE ANALYTICS'}</button>
        <button type="button" class="nx-analytics-btn" data-nx-analytics-privacy>PRIVACY DETAILS</button>
      </div>`;
  }

  function ensureCards() {
    ensureStyle();
    const targets = [
      document.getElementById('tab-profile'),
      document.getElementById('tab-about')
    ].filter(Boolean);
    targets.forEach((target, index) => {
      const key = `nxAnalyticsCard-${index}`;
      if (document.getElementById(key)) return;
      const card = document.createElement('section');
      card.id = key;
      card.className = 'nx-analytics-card';
      card.setAttribute('data-nx-analytics-card','1');
      target.appendChild(card);
    });
    renderCards();
  }

  function renderCards() {
    document.querySelectorAll('[data-nx-analytics-card]').forEach(card => {
      card.innerHTML = cardHtml();
      card.querySelector('[data-nx-analytics-toggle]')?.addEventListener('click', async () => {
        if (consentGranted()) disable();
        else await enable();
      });
      card.querySelector('[data-nx-analytics-privacy]')?.addEventListener('click', openPrivacy);
    });
  }

  function ensurePrivacy() {
    ensureStyle();
    let node = document.getElementById('nxAnalyticsPrivacy');
    if (node) return node;
    node = document.createElement('div');
    node.id = 'nxAnalyticsPrivacy';
    node.hidden = true;
    node.innerHTML = `<div class="nx-analytics-privacy-card" role="dialog" aria-modal="true" aria-label="Analytics privacy details">
      <h3>Analytics Privacy</h3>
      <p><strong>Only after you opt in</strong>, NexusNova uses Firebase Analytics for anonymous session/retention measurement and a small whitelist of product events such as opening Wallet, starting Mining, Daily Reward actions, Growth/Referral actions and onboarding completion.</p>
      <p><strong>Not sent by NexusNova custom analytics:</strong> email, Firebase UID, wallet address, referral code, search text, messages, contacts, exact location, page URL/query string or any form input value. Unknown feature names are dropped instead of being sanitized and sent. Advertising storage and ad-personalization consent remain denied.</p>
      <p>You can disable future analytics collection at any time from Profile or Settings. Disabling does not erase aggregate statistics already processed by the analytics service.</p>
      <button type="button" class="nx-analytics-btn nx-analytics-privacy-close">CLOSE</button>
    </div>`;
    document.body.appendChild(node);
    node.querySelector('.nx-analytics-privacy-close')?.addEventListener('click', () => { node.hidden = true; });
    node.addEventListener('click', event => { if (event.target === node) node.hidden = true; });
    return node;
  }

  function openPrivacy() {
    const node = ensurePrivacy();
    node.hidden = false;
  }

  function ensurePrompt() {
    ensureStyle();
    if (promptNode && document.body.contains(promptNode)) return promptNode;
    promptNode = document.createElement('div');
    promptNode.id = 'nxAnalyticsPrompt';
    promptNode.hidden = true;
    promptNode.innerHTML = `<div class="nx-analytics-prompt-card">
      <div class="nx-analytics-prompt-title">Help improve NexusNova?</div>
      <div class="nx-analytics-prompt-text">Allow anonymous usage analytics so we can measure sessions, retention and which app sections are useful. No email, UID, wallet, searches, messages or exact location are included in NexusNova custom analytics.</div>
      <div class="nx-analytics-prompt-actions">
        <button type="button" class="nx-analytics-btn" data-nx-analytics-later>NOT NOW</button>
        <button type="button" class="nx-analytics-btn primary" data-nx-analytics-allow>ALLOW</button>
      </div>
    </div>`;
    document.body.appendChild(promptNode);
    promptNode.querySelector('[data-nx-analytics-later]')?.addEventListener('click', later);
    promptNode.querySelector('[data-nx-analytics-allow]')?.addEventListener('click', enable);
    return promptNode;
  }

  function hidePrompt() {
    if (promptNode) promptNode.hidden = true;
  }

  function maybePrompt() {
    const consent = readConsent();
    if (consent.status === 'granted' || consent.status === 'denied') return;
    if (consent.status === 'later' && Date.now() - consent.at < LATER_REPROMPT_MS) return;
    const root = ensurePrompt();
    const tryShow = () => {
      const tour = document.getElementById('nxOnboardingOverlay');
      if (tour && !tour.hidden) {
        setTimeout(tryShow, 1500);
        return;
      }
      root.hidden = false;
    };
    setTimeout(tryShow, PROMPT_DELAY_MS);
  }

  function bindProductEvents() {
    if (document.documentElement.dataset.nxAnalyticsBound === '1') return;
    document.documentElement.dataset.nxAnalyticsBound = '1';

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('button');
      if (!button) return;

      const feature = button.matches('.dock-item,.more-item') ? featureFromButton(button) : '';
      if (feature) track('nx_feature_open', { feature });

      const id = safeSlug(button.id || '', 60);
      if (id === 'minebtn') track('nx_mining_action', { action:'mine', feature:currentFeature() });
      if (/daily.*reward|reward.*daily/.test(id)) track('nx_daily_reward_action', { action:'claim', feature:currentFeature() });
      if (/rewarded.*ad|watch.*ad/.test(id)) track('nx_rewarded_ad_action', { action:'open', feature:currentFeature() });
      if (/growth|mission/.test(id)) track('nx_growth_action', { action:'open', feature:currentFeature() });
      if (/referral|invite|share.*ref/.test(id)) track('nx_referral_action', { action:'share', feature:currentFeature() });
      if (/bug.*report|report.*problem/.test(id) || button.hasAttribute('data-nx-report-problem')) {
        track('nx_bug_report_open', { source:currentFeature() });
      }

      if (button.id === 'nxTourNext') {
        const counter = document.getElementById('nxTourCounter')?.textContent || '';
        if (/6\s*\/\s*6/.test(counter)) track('nx_onboarding_complete', { status:'completed' });
      }
      if (button.id === 'nxTourSkip') track('nx_onboarding_skip', { status:'skipped' });
    }, true);
  }

  function boot() {
    ensureCards();
    bindProductEvents();
    if (consentGranted()) initializeIfAllowed();
    else maybePrompt();

    [600, 1600, 3200, 6500].forEach(ms => setTimeout(ensureCards, ms));
  }

  window.nexusAnalytics = {
    version:'firebase-consent-v1',
    enable,
    disable,
    consent:() => readConsent().status,
    state:() => runtimeState,
    track,
    openPrivacy
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
