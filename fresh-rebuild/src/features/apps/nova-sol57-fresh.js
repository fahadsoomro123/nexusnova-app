import { firebaseApp, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const PRODUCT = 'NOVA 5.7 Sol';
const PROVIDER_MODEL = 'gemini-3.6-flash';
const MAX_HISTORY = 80;
const MAX_CONTEXT_TURNS = 14;
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const SETTINGS_KEY = 'nexus_nova57_settings_v1';
const HISTORY_PREFIX = 'nexus_nova57_history_v1_';
const NOTES_KEY = 'nexus_nova57_notes_v1';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx57-clean-screen';
  root.innerHTML = html;
  return root;
}

function safeSettings() {
  const value = loadJson(SETTINGS_KEY, {});
  return {
    mode: value.mode === 'work' ? 'work' : 'chat',
    model: ['NOVA 5.7 Sol', 'Terra', 'Luna', 'NOVA 5.6'].includes(value.model) ? value.model : 'NOVA 5.7 Sol',
    speed: value.speed === 'Fast' ? 'Fast' : 'Standard',
    intelligence: ['Max', 'Extra High', 'High', 'Medium', 'Light'].includes(value.intelligence) ? value.intelligence : 'High'
  };
}

function saveSettings(settings) {
  saveJson(SETTINGS_KEY, settings);
}

async function historyKey() {
  try {
    const user = await requireFirebaseUser();
    return `${HISTORY_PREFIX}${user.uid}`;
  } catch {
    return `${HISTORY_PREFIX}device`;
  }
}

function normalizeHistory(raw) {
  return Array.isArray(raw)
    ? raw.filter(x => x && typeof x.text === 'string' && (x.role === 'user' || x.role === 'assistant')).slice(-MAX_HISTORY)
    : [];
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function speechLanguage(text) {
  return /[\u0600-\u06ff]/.test(String(text || '')) ? 'ur-PK' : 'en-US';
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return false;
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 3500));
  utterance.lang = speechLanguage(text);
  utterance.rate = .96;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

async function deterministic(text) {
  const t = text.toLowerCase();
  if (/(balance|nvx).*(kitna|how much|my|mera)|(?:my|mera).*(balance|nvx)/i.test(t)) {
    const p = await readUserProfile();
    const n = Number(p.balance);
    return Number.isFinite(n)
      ? `Your current NexusNova balance is ${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} NVX.`
      : 'Your NVX balance is unavailable right now.';
  }
  if (/mining.*(status|active|timer)|(?:status|active).*mining/i.test(t)) {
    const p = await readUserProfile();
    if (p.miningActive === true) {
      const left = Math.max(0, 86_400_000 - (Date.now() - (Number(p.miningStartedAt) || 0)));
      return `Mining is active. About ${(left / 3_600_000).toFixed(2)} hours remain in the current 24-hour session.`;
    }
    return 'Mining is currently idle.';
  }
  if (/(?:my|mera|meri).*(name|email|profile)|(?:name|email|profile).*(my|mera|meri)/i.test(t)) {
    const user = await requireFirebaseUser();
    const p = await readUserProfile(user);
    return `Name: ${p.name || user.displayName || 'Unavailable'}\nEmail: ${user.email || 'Unavailable'}`;
  }
  return '';
}

function systemInstruction(settings) {
  const work = settings.mode === 'work'
    ? 'Work mode is active. Prioritize structured coding, website, SEO, research, planning and debugging help.'
    : 'Chat mode is active. Be conversational, useful and concise.';
  return `You are ${PRODUCT}, the NexusNova AI assistant. ${work}\nMatch the user's language. The UI profile is ${settings.model}; speed preference is ${settings.speed}; intelligence preference is ${settings.intelligence}.\nNever claim to be an OpenAI proprietary model. Never invent account balances, mining data, transactions, live prices, rewards, provider results or completed actions.\nNever ask for passwords, seed phrases or private keys. For current/live research, clearly say when live browsing/provider access is not available.`;
}

async function providerReply(text, settings, history, attachments) {
  const { getAI, getGenerativeModel, GoogleAIBackend } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js');
  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  const tokenMap = { Max: 1600, 'Extra High': 1300, High: 1000, Medium: 800, Light: 600 };
  const tempMap = { Max: .35, 'Extra High': .4, High: .5, Medium: .6, Light: .7 };
  const model = getGenerativeModel(ai, {
    model: PROVIDER_MODEL,
    systemInstruction: { parts: [{ text: systemInstruction(settings) }] },
    generationConfig: {
      temperature: tempMap[settings.intelligence] ?? .5,
      maxOutputTokens: tokenMap[settings.intelligence] ?? 1000
    }
  });
  const context = history.slice(-MAX_CONTEXT_TURNS).map(turn => `${turn.role === 'user' ? 'User' : PRODUCT}: ${turn.text}`).join('\n');
  const fileSummary = attachments.length
    ? `\nAttached local files (metadata only in this build):\n${attachments.map(f => `- ${f.name} (${f.type || 'unknown'}, ${formatBytes(f.size)})`).join('\n')}`
    : '';
  const prompt = `Conversation context:\n${context || 'none'}${fileSummary}\n\nUser request:\n${text}`;
  const result = await model.generateContent(prompt);
  return String(result?.response?.text?.() || '').trim();
}

export function renderNovaSol57() {
  document.documentElement.classList.add('nx57-clean-mode');
  const settings = safeSettings();
  const root = node(`
    <header class="nx57-clean-header" aria-label="NOVA controls">
      <button class="nx57-clean-circle" type="button" data-nx57-clean-menu aria-label="Open NOVA sidebar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 16h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="nx57-clean-seg" role="tablist" aria-label="NOVA mode">
        <button type="button" data-nx57-mode="chat">Chat</button>
        <button type="button" data-nx57-mode="work">Work</button>
      </div>
      <button class="nx57-clean-circle" type="button" data-nx57-new aria-label="New NOVA chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11.5a7 7 0 1 1-2.05-4.95M19 5v6h-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </header>

    <main class="nx57-clean-main">
      <div class="nx57-clean-messages" data-nx57-messages>
        <div class="nx57-clean-empty" data-nx57-empty>
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Check build workflow changes">Check build workflow changes</button>
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Review my NexusNova project status">Review NexusNova project status</button>
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Help me with my next NexusNova task">Continue my next NexusNova task</button>
        </div>
      </div>

      <div class="nx57-clean-footer">
        <div class="nx57-clean-files" data-nx57-files></div>
        <div class="nx57-clean-compose-wrap">
          <div class="nx57-clean-compose">
            <button class="nx57-clean-plus" type="button" data-nx57-plus aria-label="Open tools">＋</button>
            <textarea rows="1" maxlength="5000" data-nx57-input placeholder="Ask NOVA"></textarea>
            <button class="nx57-clean-mic" type="button" data-nx57-mic aria-label="Voice input">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3M9 21h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button class="nx57-clean-send" type="button" data-nx57-send aria-label="Send">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4.5 14-2.5-5-7-2Z" fill="currentColor"/><path d="m12 14 7-9" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="nx57-clean-pop" data-nx57-tools hidden>
            <div class="nx57-clean-pop-title">Add & tools</div>
            <button type="button" data-nx57-action="files"><span>Files / photos</span><small>metadata only</small></button>
            <button type="button" data-nx57-action="camera"><span>Camera</span><small>where supported</small></button>
            <button type="button" data-nx57-action="search"><span>Search & recents</span><small>local</small></button>
            <button type="button" data-nx57-action="settings"><span>NOVA settings</span><small>model & intelligence</small></button>
            <button type="button" data-nx57-action="remember"><span>Remember note</span><small>this device</small></button>
            <button type="button" data-nx57-action="speak"><span>Speak last reply</span><small>device TTS</small></button>
            <button type="button" data-nx57-action="system"><span>System check</span><small>live capability state</small></button>
          </div>
        </div>
      </div>
    </main>

    <input type="file" data-nx57-picker multiple hidden>
    <input type="file" data-nx57-camera accept="image/*" capture="environment" hidden>
    <p class="nx57-clean-status" data-nx57-status aria-live="polite">${PRODUCT} ready.</p>

    <div class="nx57-clean-drawer-backdrop" data-nx57-clean-drawer hidden>
      <aside class="nx57-clean-drawer" role="dialog" aria-modal="true" aria-label="NOVA sidebar">
        <div class="nx57-clean-drawer-head">
          <div><strong>${PRODUCT}</strong><span>Search, tools & workspace</span></div>
          <button class="nx57-clean-drawer-close" type="button" data-nx57-clean-drawer-close aria-label="Close">×</button>
        </div>

        <nav class="nx57-clean-nav">
          <button type="button" data-nx57-clean-side="history"><span>Search & Recents</span><small>local</small></button>
          <button type="button" data-nx57-clean-side="settings"><span>NOVA Settings</span><small>local</small></button>
          <button type="button" data-nx57-clean-side="remote"><span>Remote / GitHub</span><small>not connected</small></button>
          <button type="button" data-nx57-clean-side="scheduled"><span>Scheduled</span><small>not connected</small></button>
          <button type="button" data-nx57-clean-side="tools"><span>Plugins / Tools</span><small>current</small></button>
          <button type="button" data-nx57-clean-side="system"><span>System Check</span><small>live</small></button>
          <button type="button" data-nx57-clean-side="hub"><span>Back to Nova Hub</span><small>exit</small></button>
        </nav>

        <section class="nx57-clean-panel" data-nx57-clean-panel="history">
          <div class="nx57-clean-search"><input data-nx57-search placeholder="Search recent NOVA messages"><button type="button" data-nx57-search-go>Search</button></div>
          <div class="nx57-clean-history" data-nx57-history></div>
        </section>

        <section class="nx57-clean-panel" data-nx57-clean-panel="settings">
          <label class="nx57-clean-setting"><span>Model</span><select data-nx57-model><option>NOVA 5.7 Sol</option><option>Terra</option><option>Luna</option><option>NOVA 5.6</option></select></label>
          <label class="nx57-clean-setting"><span>Speed</span><select data-nx57-speed><option>Standard</option><option>Fast</option></select></label>
          <label class="nx57-clean-setting"><span>Intelligence</span><select data-nx57-intelligence><option>Max</option><option>Extra High</option><option>High</option><option>Medium</option><option>Light</option></select></label>
          <div class="nx57-clean-provider">Current cloud provider: Firebase AI → Google AI backend → ${PROVIDER_MODEL}. Local PC/Ollama and GitHub agent are not connected yet.</div>
        </section>

        <section class="nx57-clean-panel" data-nx57-clean-panel="remote">
          <p class="nx57-clean-note"><b>Remote / GitHub</b><br>Not connected. NOVA cannot read repositories, create branches, commit changes or create PRs from the app yet.</p>
        </section>

        <section class="nx57-clean-panel" data-nx57-clean-panel="scheduled">
          <p class="nx57-clean-note"><b>Scheduled</b><br>No NOVA scheduler backend is connected in this Android build.</p>
        </section>

        <section class="nx57-clean-panel" data-nx57-clean-panel="tools">
          <p class="nx57-clean-note"><b>Available now</b><br>Local recents, file picker metadata, camera picker where supported, device speech output, WebView voice recognition where exposed, local notes and system check.</p>
        </section>

        <section class="nx57-clean-panel nx57-clean-system" data-nx57-clean-panel="system"></section>
      </aside>
    </div>
  `);

  const messages = root.querySelector('[data-nx57-messages]');
  const empty = root.querySelector('[data-nx57-empty]');
  const input = root.querySelector('[data-nx57-input]');
  const send = root.querySelector('[data-nx57-send]');
  const picker = root.querySelector('[data-nx57-picker]');
  const camera = root.querySelector('[data-nx57-camera]');
  const filesBox = root.querySelector('[data-nx57-files]');
  const status = root.querySelector('[data-nx57-status]');
  const toolsMenu = root.querySelector('[data-nx57-tools]');
  const drawer = root.querySelector('[data-nx57-clean-drawer]');
  const search = root.querySelector('[data-nx57-search]');
  const historyBox = root.querySelector('[data-nx57-history]');
  const systemPanel = root.querySelector('[data-nx57-clean-panel="system"]');

  let key = '';
  let history = [];
  let attachments = [];
  let lastReply = '';
  let busy = false;
  let recognition = null;

  const closeTools = () => { toolsMenu.hidden = true; };
  const closeDrawer = () => { drawer.hidden = true; };

  const autoSize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  };

  const syncEmpty = () => {
    empty.hidden = Boolean(messages.querySelector('.nx57-clean-msg'));
  };

  const addMessage = (text, role, persist = true) => {
    const div = document.createElement('article');
    div.className = `nx57-clean-msg ${role === 'user' ? 'user' : 'bot'}`;
    div.innerHTML = `<strong>${role === 'user' ? 'You' : PRODUCT}</strong><p></p>`;
    div.querySelector('p').textContent = text;
    messages.insertBefore(div, empty);
    syncEmpty();
    messages.scrollTop = messages.scrollHeight;
    if (persist && key) {
      history.push({ id: uid('nova57'), role, text: String(text).slice(0, 12000), at: Date.now() });
      history = history.slice(-MAX_HISTORY);
      saveJson(key, history);
    }
  };

  const renderHistory = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const rows = history.filter(turn => !q || turn.text.toLowerCase().includes(q)).slice().reverse();
    historyBox.innerHTML = rows.length
      ? rows.map(turn => `<button type="button" data-nx57-history-id="${escapeHtml(turn.id)}"><b>${turn.role === 'user' ? 'You' : PRODUCT}</b><br>${escapeHtml(turn.text.slice(0, 180))}</button>`).join('')
      : '<p class="nx57-clean-note">No matching recent messages.</p>';
    historyBox.querySelectorAll('[data-nx57-history-id]').forEach(button => button.addEventListener('click', () => {
      const turn = history.find(x => x.id === button.dataset.nx57HistoryId);
      if (!turn) return;
      input.value = turn.text;
      autoSize();
      closeDrawer();
      input.focus();
    }));
  };

  const renderSystem = () => {
    systemPanel.innerHTML = `
      <b>System Check</b><br>
      Product: ${PRODUCT}<br>
      Online: ${navigator.onLine ? 'yes' : 'no'}<br>
      Cloud AI: Firebase AI / ${PROVIDER_MODEL}<br>
      Local AI / Ollama: not connected<br>
      GitHub agent: not connected<br>
      Voice input: ${voiceSupported() ? 'available' : 'not exposed by this WebView'}<br>
      Speech output: ${'speechSynthesis' in window ? 'available' : 'unavailable'}<br>
      File picker: available • max ${MAX_FILES} files / ${formatBytes(MAX_TOTAL_BYTES)} total<br>
      File content processing: metadata only in this build<br>
      Video provider: not configured
    `;
  };

  const openPanel = name => {
    if (name === 'hub') {
      closeDrawer();
      const hub = document.querySelector('.nx-dock__item[data-route="hub"]');
      if (hub) hub.click();
      else window.history.back();
      return;
    }
    drawer.hidden = false;
    root.querySelectorAll('[data-nx57-clean-side]').forEach(button => button.classList.toggle('is-active', button.dataset.nx57CleanSide === name));
    root.querySelectorAll('[data-nx57-clean-panel]').forEach(panel => panel.classList.toggle('is-open', panel.dataset.nx57CleanPanel === name));
    if (name === 'history') renderHistory(search.value);
    if (name === 'system') renderSystem();
  };

  const applySettings = () => {
    root.querySelectorAll('[data-nx57-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.nx57Mode === settings.mode));
    root.querySelector('[data-nx57-model]').value = settings.model;
    root.querySelector('[data-nx57-speed]').value = settings.speed;
    root.querySelector('[data-nx57-intelligence]').value = settings.intelligence;
    saveSettings(settings);
  };

  const renderFiles = () => {
    filesBox.innerHTML = attachments.map((file, index) =>
      `<span class="nx57-clean-chip">${escapeHtml(file.name)} • ${formatBytes(file.size)} <button type="button" data-nx57-remove="${index}" aria-label="Remove">×</button></span>`
    ).join('');
    filesBox.querySelectorAll('[data-nx57-remove]').forEach(button => button.addEventListener('click', () => {
      attachments.splice(Number(button.dataset.nx57Remove), 1);
      renderFiles();
    }));
  };

  const addPickedFiles = picked => {
    let total = attachments.reduce((sum, f) => sum + f.size, 0);
    for (const file of picked) {
      if (attachments.length >= MAX_FILES) break;
      if (file.size <= 0 || total + file.size > MAX_TOTAL_BYTES) continue;
      attachments.push(file);
      total += file.size;
    }
    renderFiles();
    status.textContent = attachments.length
      ? `${attachments.length} attachment(s) selected. This build sends metadata only.`
      : `${PRODUCT} ready.`;
  };

  const clearChat = () => {
    history = [];
    if (key) saveJson(key, history);
    messages.querySelectorAll('.nx57-clean-msg').forEach(message => message.remove());
    lastReply = '';
    closeTools();
    closeDrawer();
    syncEmpty();
    status.textContent = `${PRODUCT} ready.`;
    input.value = '';
    autoSize();
    input.focus();
  };

  const ask = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    closeTools();
    status.textContent = `${PRODUCT} thinking…`;
    addMessage(text, 'user');
    input.value = '';
    autoSize();
    try {
      let reply = await deterministic(text);
      let provenance = 'NexusNova account/local capability';
      if (!reply) {
        reply = await providerReply(text, settings, history, attachments);
        provenance = `Cloud • Firebase AI • ${PROVIDER_MODEL}`;
      }
      lastReply = reply || 'AI returned no text.';
      addMessage(lastReply, 'assistant');
      status.textContent = `${provenance} • ${settings.mode === 'work' ? 'Work' : 'Chat'} mode`;
    } catch (error) {
      console.warn('[NexusNova Fresh] NOVA 5.7:', error);
      lastReply = 'AI service is unavailable right now. Your account data was not changed.';
      addMessage(lastReply, 'assistant');
      status.textContent = /app.?check|403|permission/i.test(String(error?.message || ''))
        ? 'Cloud request blocked by Firebase App Check / provider configuration.'
        : 'Cloud AI provider did not respond.';
    } finally {
      busy = false;
      send.disabled = false;
      attachments = [];
      renderFiles();
    }
  };

  historyKey().then(value => {
    key = value;
    history = normalizeHistory(loadJson(key, []));
    history.slice(-10).forEach(turn => addMessage(turn.text, turn.role, false));
    syncEmpty();
  });

  root.querySelectorAll('[data-nx57-mode]').forEach(button => button.addEventListener('click', () => {
    settings.mode = button.dataset.nx57Mode;
    applySettings();
  }));

  root.querySelector('[data-nx57-clean-menu]').addEventListener('click', () => openPanel('history'));
  root.querySelector('[data-nx57-new]').addEventListener('click', clearChat);

  root.querySelectorAll('[data-nx57-quick]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.nx57Quick || '';
    autoSize();
    input.focus();
  }));

  root.querySelector('[data-nx57-plus]').addEventListener('click', event => {
    event.stopPropagation();
    toolsMenu.hidden = !toolsMenu.hidden;
  });

  root.querySelectorAll('[data-nx57-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.nx57Action;
    closeTools();
    if (action === 'files') picker.click();
    if (action === 'camera') camera.click();
    if (action === 'search') openPanel('history');
    if (action === 'settings') openPanel('settings');
    if (action === 'system') openPanel('system');
    if (action === 'remember') {
      const text = input.value.trim();
      if (!text) {
        status.textContent = 'Type a note in the message box first.';
      } else {
        const notes = loadJson(NOTES_KEY, []);
        notes.push(text.slice(0, 1000));
        saveJson(NOTES_KEY, notes.slice(-40));
        status.textContent = 'Note remembered on this device.';
      }
    }
    if (action === 'speak') status.textContent = speak(lastReply) ? 'Speaking last NOVA reply…' : 'Speech output is unavailable.';
  }));

  root.querySelectorAll('[data-nx57-clean-side]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.nx57CleanSide)));
  root.querySelector('[data-nx57-clean-drawer-close]').addEventListener('click', closeDrawer);
  drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); });

  root.querySelector('[data-nx57-model]').addEventListener('change', event => { settings.model = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-speed]').addEventListener('change', event => { settings.speed = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-intelligence]').addEventListener('change', event => { settings.intelligence = event.target.value; applySettings(); });

  root.querySelector('[data-nx57-search-go]').addEventListener('click', () => renderHistory(search.value));
  search.addEventListener('keydown', event => { if (event.key === 'Enter') renderHistory(search.value); });

  picker.addEventListener('change', () => {
    addPickedFiles([...(picker.files || [])]);
    picker.value = '';
  });

  camera.addEventListener('change', () => {
    addPickedFiles([...(camera.files || [])]);
    camera.value = '';
  });

  root.querySelector('[data-nx57-mic]').addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      status.textContent = 'Voice input is not exposed by this Android WebView.';
      return;
    }
    try { recognition?.stop?.(); } catch {}
    recognition = new Recognition();
    recognition.lang = 'en-PK';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      input.value = String(event.results?.[0]?.[0]?.transcript || '').trim();
      autoSize();
      status.textContent = 'Voice captured.';
    };
    recognition.onerror = () => { status.textContent = 'Voice input could not start.'; };
    recognition.onend = () => { recognition = null; };
    recognition.start();
    status.textContent = 'Listening…';
  });

  input.addEventListener('input', autoSize);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  });
  send.addEventListener('click', ask);

  root.addEventListener('click', event => {
    if (!event.target.closest('[data-nx57-tools]') && !event.target.closest('[data-nx57-plus]')) closeTools();
  });

  applySettings();
  autoSize();
  syncEmpty();

  root.__cleanup = () => {
    document.documentElement.classList.remove('nx57-clean-mode');
    try { recognition?.stop?.(); } catch {}
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };
  return root;
}

export const novaSol57Renderers = Object.freeze({ ai: renderNovaSol57 });
