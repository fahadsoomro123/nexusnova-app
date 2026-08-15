/* NexusNova Guided Onboarding + Private Product Insights v1
   - First-time guided tour for core product areas.
   - Device-local, privacy-safe usage counters only.
   - Never records search text, input values, email, UID, wallet address,
     contacts, exact location, messages, or other personal content.
   - No network analytics provider is contacted by this module.
   - Android native shell never auto-opens a modal tour during startup. */
(() => {
  'use strict';
  if (window.__nxOnboardingInsightsV1) return;
  window.__nxOnboardingInsightsV1 = true;
  window.nexusOnboardingVersion = 'onboarding-insights-v1.1';

  const STATE_KEY = 'nexusnova_onboarding_v1_state';
  const EVENTS_KEY = 'nexusnova_product_events_v1';
  const MAX_EVENTS = 250;
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const IS_ANDROID_NATIVE_SHELL = window.__nexusAndroidShell === true;
  const SAFE_EVENTS = new Set([
    'session_start','tour_open','tour_next','tour_back','tour_complete','tour_skip',
    'nav_open','mine_action','daily_reward_action','growth_action','referral_action',
    'insights_reset'
  ]);

  const STEPS = [
    {
      icon:'✨', kicker:'WELCOME', title:'Meet NexusNova',
      text:'Your daily utility grid brings mining, wallet, tasks, live tools, learning, finance and more into one place.',
      chips:['Mine','Wallet','Tasks','All Apps']
    },
    {
      icon:'⛏️', kicker:'STEP 1', title:'Start your 24H mining session',
      text:'Use the Mine tab to start a secure 24-hour session. Your balance is protected by the app’s verified reward rules.',
      chips:['24H Session','NVX Balance','Secure Rules']
    },
    {
      icon:'👛', kicker:'STEP 2', title:'Connect your wallet when you need it',
      text:'The Wallet tab keeps NVX separate while providing a foundation for supported external crypto wallets and portfolio tools.',
      chips:['Wallet','Portfolio','Deposit / Withdraw']
    },
    {
      icon:'🎯', kicker:'STEP 3', title:'Build real progress',
      text:'Tasks and Growth show daily rewards, missions, streaks and verified referral progress without inventing fake rewards.',
      chips:['Daily Reward','Missions','Growth']
    },
    {
      icon:'🧭', kicker:'STEP 4', title:'Find anything from All Apps',
      text:'Open All Apps and search naturally for tools such as Quran, weather, documents, teacher tools, finance or travel.',
      chips:['Smart Search','43+ Apps','Local First']
    },
    {
      icon:'🔐', kicker:'READY', title:'Explore with privacy in mind',
      text:'This onboarding module stores only simple usage counts on this device. It never records your searches, messages, email, wallet address or exact location.',
      chips:['Device Local','No Search Text','No Personal Content']
    }
  ];

  let stepIndex = 0;
  let overlay = null;
  let insightsCard = null;

  function cleanFeature(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
  }

  function loadEvents() {
    try {
      const raw = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      const cutoff = Date.now() - MAX_AGE_MS;
      return raw.filter(row => row && Number.isFinite(Number(row.t)) && Number(row.t) >= cutoff && SAFE_EVENTS.has(String(row.e || ''))).slice(-MAX_EVENTS);
    } catch (_) { return []; }
  }

  function saveEvents(events) {
    try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS))); } catch (_) {}
  }

  function track(eventName, feature='') {
    if (!SAFE_EVENTS.has(eventName)) return;
    const row = {t:Date.now(), e:eventName};
    const safeFeature = cleanFeature(feature);
    if (safeFeature) row.f = safeFeature;
    const events = loadEvents();
    events.push(row);
    saveEvents(events);
    renderInsights();
  }

  function dateKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function summary() {
    const events = loadEvents();
    const sessions = events.filter(row => row.e === 'session_start').length;
    const activeDays = new Set(events.map(row => dateKey(row.t))).size;
    const navRows = events.filter(row => row.e === 'nav_open' && row.f);
    const featureCounts = new Map();
    navRows.forEach(row => featureCounts.set(row.f, (featureCounts.get(row.f) || 0) + 1));
    const top = [...featureCounts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return {sessions,activeDays,featureOpens:navRows.length,topFeature:top?.[0] || '—',eventCount:events.length};
  }

  function resetInsights() {
    try { localStorage.removeItem(EVENTS_KEY); } catch (_) {}
    track('insights_reset');
    renderInsights();
  }

  function onboardingState() {
    try {
      const value = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_) { return null; }
  }

  function saveOnboardingState(status) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({status,at:Date.now()})); } catch (_) {}
  }

  function ensureStyle() {
    if (document.getElementById('nxOnboardingInsightsStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxOnboardingInsightsStyle';
    style.textContent = `
      #nxOnboardingOverlay{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      #nxOnboardingOverlay[hidden]{display:none!important;pointer-events:none!important;visibility:hidden!important}
      .nx-tour-shell{width:min(520px,100%);border-radius:24px;padding:1px;background:linear-gradient(145deg,rgba(34,211,238,.65),rgba(139,92,246,.6),rgba(15,23,42,.2));box-shadow:0 30px 90px rgba(0,0,0,.46)}
      .nx-tour-card{border-radius:23px;padding:22px;background:radial-gradient(circle at 88% 0%,rgba(34,211,238,.13),transparent 35%),linear-gradient(160deg,#071522,#0b1220 58%,#090f1d);color:#eaf7ff;border:1px solid rgba(255,255,255,.05)}
      .nx-tour-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.nx-tour-badge{font-size:10px;font-weight:950;letter-spacing:.14em;color:#67e8f9}.nx-tour-step{font-size:10px;color:#7890a4;font-weight:800}.nx-tour-icon{font-size:42px;margin-top:20px;filter:drop-shadow(0 10px 22px rgba(34,211,238,.16))}
      .nx-tour-title{font-size:25px;line-height:1.16;font-weight:950;margin-top:10px;color:#f8fafc}.nx-tour-text{font-size:12px;line-height:1.7;color:#91a6b9;margin-top:10px}.nx-tour-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.nx-tour-chip{font-size:9px;font-weight:850;padding:7px 9px;border-radius:999px;background:rgba(15,23,42,.72);border:1px solid rgba(34,211,238,.16);color:#b8d8e7}
      .nx-tour-progress{display:flex;gap:6px;margin-top:20px}.nx-tour-dot{height:5px;flex:1;border-radius:999px;background:#1e293b;transition:.2s}.nx-tour-dot.done{background:linear-gradient(90deg,#22d3ee,#8b5cf6)}
      .nx-tour-actions{display:grid;grid-template-columns:auto 1fr;gap:9px;margin-top:18px}.nx-tour-btn{border:1px solid rgba(148,163,184,.18);border-radius:13px;padding:12px 13px;background:rgba(15,23,42,.75);color:#d9e7f3;font-size:10px;font-weight:950;letter-spacing:.03em;cursor:pointer}.nx-tour-btn.primary{background:linear-gradient(135deg,#0891b2,#7c3aed);border-color:transparent;color:white}.nx-tour-skip{display:block;margin:12px auto 0;border:0;background:none;color:#64748b;font-size:10px;font-weight:800;cursor:pointer;padding:5px 10px}
      #nxPrivateInsightsCard .nx-insight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}#nxPrivateInsightsCard .nx-insight-cell{padding:9px 6px;border-radius:11px;text-align:center;background:rgba(15,23,42,.5);border:1px solid rgba(148,163,184,.09)}#nxPrivateInsightsCard .nx-insight-cell small{display:block;font-size:8px;color:#73899c;text-transform:uppercase;letter-spacing:.06em}#nxPrivateInsightsCard .nx-insight-cell strong{display:block;font-size:12px;color:#eef9ff;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#nxPrivateInsightsCard .nx-insight-note{font-size:9px;line-height:1.5;color:#7d93a7;margin-top:9px}
      @media(max-width:480px){.nx-tour-card{padding:18px}.nx-tour-title{font-size:22px}.nx-tour-actions{grid-template-columns:1fr 1.3fr}#nxPrivateInsightsCard .nx-insight-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    ensureStyle();
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'nxOnboardingOverlay';
    overlay.hidden = true;
    overlay.style.pointerEvents = 'none';
    overlay.style.visibility = 'hidden';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','NexusNova guided app tour');
    overlay.innerHTML = `
      <div class="nx-tour-shell"><div class="nx-tour-card">
        <div class="nx-tour-top"><div class="nx-tour-badge" id="nxTourKicker">WELCOME</div><div class="nx-tour-step" id="nxTourCounter">1/${STEPS.length}</div></div>
        <div class="nx-tour-icon" id="nxTourIcon">✨</div>
        <div class="nx-tour-title" id="nxTourTitle">Meet NexusNova</div>
        <div class="nx-tour-text" id="nxTourText"></div>
        <div class="nx-tour-chips" id="nxTourChips"></div>
        <div class="nx-tour-progress" id="nxTourProgress"></div>
        <div class="nx-tour-actions"><button class="nx-tour-btn" id="nxTourBack" type="button">BACK</button><button class="nx-tour-btn primary" id="nxTourNext" type="button">NEXT</button></div>
        <button class="nx-tour-skip" id="nxTourSkip" type="button">Skip tour</button>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#nxTourBack')?.addEventListener('click', () => {
      if (stepIndex <= 0) return;
      stepIndex -= 1;
      track('tour_back',String(stepIndex));
      renderStep();
    });
    overlay.querySelector('#nxTourNext')?.addEventListener('click', () => {
      if (stepIndex >= STEPS.length - 1) {
        saveOnboardingState('completed');
        track('tour_complete');
        closeTour();
        return;
      }
      stepIndex += 1;
      track('tour_next',String(stepIndex));
      renderStep();
    });
    overlay.querySelector('#nxTourSkip')?.addEventListener('click', () => {
      saveOnboardingState('skipped');
      track('tour_skip');
      closeTour();
    });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        saveOnboardingState('skipped');
        track('tour_skip');
        closeTour();
      }
    });
    return overlay;
  }

  function renderStep() {
    const root = ensureOverlay();
    const step = STEPS[stepIndex] || STEPS[0];
    root.querySelector('#nxTourKicker').textContent = step.kicker;
    root.querySelector('#nxTourCounter').textContent = `${stepIndex + 1}/${STEPS.length}`;
    root.querySelector('#nxTourIcon').textContent = step.icon;
    root.querySelector('#nxTourTitle').textContent = step.title;
    root.querySelector('#nxTourText').textContent = step.text;
    root.querySelector('#nxTourChips').innerHTML = step.chips.map(chip => `<span class="nx-tour-chip">${chip}</span>`).join('');
    root.querySelector('#nxTourProgress').innerHTML = STEPS.map((_,index) => `<i class="nx-tour-dot ${index <= stepIndex ? 'done' : ''}"></i>`).join('');
    const back = root.querySelector('#nxTourBack');
    const next = root.querySelector('#nxTourNext');
    back.disabled = stepIndex === 0;
    back.style.opacity = stepIndex === 0 ? '.45' : '1';
    next.textContent = stepIndex === STEPS.length - 1 ? 'START EXPLORING' : 'NEXT';
  }

  function openTour(manual=false) {
    // In the native app, onboarding is deliberately opt-in from About/Settings.
    // A startup modal can never own the entire Android touch surface again.
    if (IS_ANDROID_NATIVE_SHELL && !manual) return false;
    const root = ensureOverlay();
    stepIndex = 0;
    renderStep();
    root.hidden = false;
    root.style.pointerEvents = 'auto';
    root.style.visibility = 'visible';
    document.documentElement.style.overflow = 'hidden';
    track('tour_open', manual ? 'manual' : 'auto');
    setTimeout(() => root.querySelector('#nxTourNext')?.focus(), 20);
    return true;
  }

  function closeTour() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.style.pointerEvents = 'none';
    overlay.style.visibility = 'hidden';
    document.documentElement.style.overflow = '';
    renderInsights();
  }

  function targetFromButton(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return cleanFeature(button.dataset.nxmega);
    const onclick = String(button.getAttribute?.('onclick') || '');
    const openMore = onclick.match(/openMoreTab\(\s*['"]([^'"]+)['"]/i);
    if (openMore) return cleanFeature(openMore[1]);
    const switchTab = onclick.match(/switchTab\(\s*['"]([^'"]+)['"]/i);
    if (switchTab) return cleanFeature(switchTab[1]);
    if (button.id === 'moreBtn') return 'all-apps';
    return '';
  }

  function bindUsageCapture() {
    if (document.documentElement.dataset.nxPrivateUsageBound === '1') return;
    document.documentElement.dataset.nxPrivateUsageBound = '1';
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('button');
      if (!button) return;
      const nav = button.matches('.dock-item,.more-item') ? targetFromButton(button) : '';
      if (nav) track('nav_open',nav);
      if (button.id === 'mineBtn') track('mine_action','mine');
      if (/daily/i.test(button.id || '') && /reward|bonus/i.test(button.textContent || '')) track('daily_reward_action','daily');
      if (button.id === 'nxOpenGrowthFromProfile' || button.id === 'nxOpenGrowthFromTasks' || button.id === 'nxGrowthMenuBtn') track('growth_action','growth');
      if (button.id === 'nxCopyReferral') track('referral_action','copy');
      if (button.id === 'nxShareReferral') track('referral_action','share');
    }, true);
  }

  function ensureInsightsCard() {
    const host = document.getElementById('tab-about');
    if (!host) return null;
    if (document.getElementById('nxPrivateInsightsCard')) return document.getElementById('nxPrivateInsightsCard');
    const card = document.createElement('div');
    card.id = 'nxPrivateInsightsCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="market-header"><div><h3>🧭 App Tour & Private Insights</h3><div class="market-count">This device only • no personal content</div></div><span style="font-size:9px;color:#22d3ee;font-weight:900">LOCAL</span></div>
      <div class="nx-insight-grid">
        <div class="nx-insight-cell"><small>Sessions</small><strong id="nxInsightSessions">0</strong></div>
        <div class="nx-insight-cell"><small>Active Days</small><strong id="nxInsightDays">0</strong></div>
        <div class="nx-insight-cell"><small>Feature Opens</small><strong id="nxInsightFeatureOpens">0</strong></div>
        <div class="nx-insight-cell"><small>Top Feature</small><strong id="nxInsightTop">—</strong></div>
      </div>
      <div class="nx-insight-note">NexusNova stores these counters only in this browser. Search terms, messages, email, UID, wallet addresses, contacts and exact location are not stored by this insights module.</div>
      <div class="btn-group" style="margin-top:9px"><button class="action-btn primary" id="nxStartAppTour" type="button">START APP TOUR</button><button class="action-btn" id="nxResetPrivateInsights" type="button">RESET LOCAL INSIGHTS</button></div>`;
    host.appendChild(card);
    card.querySelector('#nxStartAppTour')?.addEventListener('click', () => openTour(true));
    card.querySelector('#nxResetPrivateInsights')?.addEventListener('click', () => {
      try { localStorage.removeItem(EVENTS_KEY); } catch (_) {}
      track('insights_reset');
      renderInsights();
    });
    insightsCard = card;
    return card;
  }

  function renderInsights() {
    ensureInsightsCard();
    const s = summary();
    const set = (id,value) => { const node = document.getElementById(id); if (node) node.textContent = String(value); };
    set('nxInsightSessions',s.sessions);
    set('nxInsightDays',s.activeDays);
    set('nxInsightFeatureOpens',s.featureOpens);
    set('nxInsightTop',s.topFeature === '—' ? '—' : s.topFeature.toUpperCase().replace(/-/g,' '));
  }

  function boot() {
    if (!document.body) return;
    ensureStyle();
    ensureOverlay();
    bindUsageCapture();
    track('session_start');
    renderInsights();
    [500,1500,3000,6000].forEach(ms => setTimeout(renderInsights,ms));

    // Web/PWA can keep the optional first-run tour. The Android app must start
    // fully usable; its tour remains available manually from About/Settings.
    if (!IS_ANDROID_NATIVE_SHELL && !onboardingState()) {
      setTimeout(() => {
        if (!onboardingState() && document.getElementById('tab-home')) openTour(false);
      }, 3500);
    }
  }

  window.nexusOpenAppTour = () => openTour(true);
  window.nexusProductInsights = Object.freeze({
    version:'local-private-v1.1', summary, track, reset:resetInsights, openTour:() => openTour(true)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
