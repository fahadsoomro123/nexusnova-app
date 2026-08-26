/* NexusNova NOVA 5.7 Sol product layer v1
 * Additive late-authoritative layer over the existing NOVA V6 / Work MAX stack.
 * Goals:
 * - own NexusNova product identity (never an OpenAI/GPT impersonation)
 * - truthful runtime capability discovery
 * - consistent model branding across Chat / Work controls
 * - safe request metadata for the paired local gateway
 * - preserve all existing chat, image, voice, Work MAX and fallback owners
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57V1) return;
  window.__nxNovaSol57V1 = true;

  const CFG_KEY = 'nexusnova_nova_ai_mobile_v1';
  const RELEASE = Object.freeze({
    name: 'NOVA 5.7 Sol',
    version: '5.7.0-sol',
    protocol: 'nexusnova-sol/1'
  });
  const $ = id => document.getElementById(id);
  let syncQueued = false;

  function readCfg() {
    try {
      return {
        mode: 'chat',
        endpoint: '',
        token: '',
        uiSpeed: 'fast',
        uiIntelligence: 'max',
        reasoning: 'deep',
        ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}')
      };
    } catch (_) {
      return { mode: 'chat', endpoint: '', token: '', uiSpeed: 'fast', uiIntelligence: 'max', reasoning: 'deep' };
    }
  }

  function paired() {
    const c = readCfg();
    return Boolean(String(c.endpoint || '').trim() && String(c.token || '').trim());
  }

  function capabilities() {
    const modes = new Set(Array.from(document.querySelectorAll('#tab-ai [data-mode]')).map(el => el.dataset.mode));
    return Object.freeze({
      chat: typeof window.sendAIMessage === 'function',
      builtInAI: Boolean(window.nexusAISpeakV2 || $('aiBox')),
      localGateway: paired(),
      secureGatewayTest: Boolean(window.NexusNovaV6ConnectionTest?.run),
      work: Boolean(window.NexusNovaV6) && modes.has('work'),
      backgroundWork: Boolean(window.NexusNovaV6?.pollJob),
      research: modes.has('research'),
      website: modes.has('website'),
      builder: modes.has('builder'),
      power: modes.has('power'),
      web: modes.has('web'),
      dev: modes.has('dev'),
      imageInput: Boolean($('aiImageInput')),
      voiceInput: Boolean($('aiVoiceBtn')),
      voiceOutput: 'speechSynthesis' in window,
      accountMemory: Boolean(window.localStorage),
      liveAppContext: Boolean($('balance') || $('profileName') || $('walletTotalUsd'))
    });
  }

  function modelName(mode = readCfg().mode) {
    if (mode === 'work') return 'NOVA 5.7 Sol Work';
    if (mode === 'research') return 'NOVA 5.7 Sol Research';
    if (mode === 'builder') return 'NOVA 5.7 Sol Builder';
    return RELEASE.name;
  }

  function intelligenceName(value) {
    return ({
      max: 'Max',
      'extra-high': 'Extra High',
      high: 'High',
      medium: 'Medium',
      light: 'Light'
    })[value] || 'Max';
  }

  function responseProfile() {
    const c = readCfg();
    return {
      speed: c.uiSpeed === 'standard' ? 'standard' : 'fast',
      intelligence: ['max', 'extra-high', 'high', 'medium', 'light'].includes(c.uiIntelligence) ? c.uiIntelligence : 'max',
      reasoning: ['deep', 'auto'].includes(c.reasoning) ? c.reasoning : 'deep'
    };
  }

  function publicCapabilityLines() {
    const c = capabilities();
    const rows = [
      ['Chat', c.chat],
      ['Image input', c.imageInput],
      ['Voice input/output', c.voiceInput || c.voiceOutput],
      ['Account memory', c.accountMemory],
      ['Live app context', c.liveAppContext],
      ['Web mode', c.web],
      ['Research', c.research],
      ['Website workflow', c.website],
      ['App Builder', c.builder],
      ['Work / background jobs', c.work && c.backgroundWork],
      ['Paired local gateway', c.localGateway]
    ];
    return rows.map(([name, ok]) => `${ok ? '✓' : '—'} ${name}`).join('\n');
  }

  function showCapabilities() {
    const c = readCfg();
    alert(
      `${RELEASE.name}\n` +
      `NexusNova product release ${RELEASE.version}\n\n` +
      `${publicCapabilityLines()}\n\n` +
      `Mode: ${c.mode || 'chat'}\n` +
      `Profile: ${responseProfile().speed} • ${intelligenceName(c.uiIntelligence)}\n\n` +
      'NOVA is a NexusNova assistant product. It does not claim to be ChatGPT or an OpenAI GPT model.'
    );
  }

  function identityContext() {
    const p = responseProfile();
    return [
      `NOVA product identity: ${RELEASE.name} (${RELEASE.version}), built by NexusNova.`,
      'Never claim that NOVA is ChatGPT, GPT-5.x, an OpenAI model, or an exact copy of those products.',
      'If asked what you are, identify as NOVA 5.7 Sol and distinguish the NexusNova product layer from whichever underlying provider is serving this request.',
      `Requested response profile: speed=${p.speed}; intelligence=${p.intelligence}; reasoning=${p.reasoning}.`,
      'Do not invent unavailable tools, live data, completed actions, balances, jobs, files, web results, or provider/model details.'
    ].join('\n');
  }

  function installFetchBridge() {
    if (window.__nxNovaSol57FetchBridge) return;
    window.__nxNovaSol57FetchBridge = true;
    const previousFetch = window.fetch.bind(window);

    window.fetch = async function(input, init) {
      try {
        const url = String(input?.url || input || '');
        if (url.includes('/api/chat') && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (body && typeof body === 'object') {
            const existingContext = String(body.app_context || '').trim();
            const solContext = identityContext();
            body.app_context = existingContext ? `${existingContext}\n\n${solContext}` : solContext;
            body.nova_client = {
              product: RELEASE.name,
              release: RELEASE.version,
              protocol: RELEASE.protocol,
              profile: responseProfile(),
              capabilities: capabilities()
            };
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch (_) {
        // Never block an existing request because optional Sol metadata failed.
      }
      return previousFetch(input, init);
    };
  }

  function replaceChoiceLabel(value, label) {
    document.querySelectorAll(`#tab-ai .nx-chatstyle-choice[data-pref="model"][data-value="${value}"]`).forEach(button => {
      const span = button.querySelector(':scope > span:first-child');
      if (!span) return;
      const small = span.querySelector('small');
      const current = Array.from(span.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (current) {
        if (current.nodeValue !== label) current.nodeValue = label;
      } else {
        span.insertBefore(document.createTextNode(label), small || null);
      }
    });
  }

  function ensureCapabilitiesItem() {
    const menu = document.querySelector('#tab-ai .nx-nova-plus-menu');
    if (!menu || menu.querySelector('[data-sol57="capabilities"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nx-nova-plus-item';
    button.dataset.sol57 = 'capabilities';
    button.innerHTML = '<span style="width:18px;text-align:center">◉</span><span>NOVA 5.7 Sol<small class="nx-v6-mini">Real capabilities • release • connection status</small></span>';
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      menu.remove();
      showCapabilities();
    };
    menu.appendChild(button);
  }

  function syncBranding() {
    const tab = $('tab-ai');
    if (!tab) return;
    document.body.dataset.novaRelease = '5.7-sol';

    const title = tab.querySelector('.nx-nova-title strong');
    if (title && title.textContent !== RELEASE.name) title.textContent = RELEASE.name;

    const cfg = readCfg();
    const control = $('nxNovaChatStyleControl');
    if (control) {
      const value = `⚡ ${modelName(cfg.mode)} ${intelligenceName(cfg.uiIntelligence)}`;
      if (control.textContent !== value) control.textContent = value;
      control.title = `${RELEASE.name} model, speed and intelligence`;
    }

    replaceChoiceLabel('nova-v6', RELEASE.name);
    replaceChoiceLabel('work-max', 'NOVA 5.7 Sol Work');
    replaceChoiceLabel('research', 'NOVA 5.7 Sol Research');
    replaceChoiceLabel('builder', 'NOVA 5.7 Sol Builder');

    const input = $('aiInput');
    if (input) input.setAttribute('aria-label', `Message ${RELEASE.name}`);
    ensureCapabilitiesItem();
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncBranding();
    });
  }

  function installObserver() {
    const tab = $('tab-ai');
    if (!tab || tab.__nxSol57Observer) return;
    const observer = new MutationObserver(scheduleSync);
    observer.observe(tab, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    tab.__nxSol57Observer = observer;
  }

  function init() {
    installFetchBridge();
    syncBranding();
    installObserver();
    document.dispatchEvent(new CustomEvent('nexusnovasol57ready', { detail: { ...RELEASE } }));
  }

  window.NexusNovaSol57 = Object.freeze({
    ...RELEASE,
    capabilities,
    responseProfile,
    modelName,
    showCapabilities,
    refresh: syncBranding
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  [500, 1200, 2500, 5000, 9000].forEach(ms => setTimeout(scheduleSync, ms));
})();
