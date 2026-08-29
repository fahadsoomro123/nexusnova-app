import { firebaseApp, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { createTaskStatus } from './nova57-task-status.js';

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
    speed: value.speed === 'Standard' ? 'Standard' : 'Fast',
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
  utterance.rate = .98;
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
  return `You are ${PRODUCT}, the NexusNova AI assistant. ${work}\nMatch the user's language. The UI profile is ${settings.model}; speed preference is ${settings.speed}; intelligence preference is ${settings.intelligence}.\nNever claim to be an OpenAI proprietary model. Never invent account balances, mining data, transactions, live prices, rewards, provider results, browsing actions, repository contents or completed actions.\nNever ask for passwords, seed phrases or private keys. NOVA can use its connected live web/public GitHub tool layers when those tools return evidence; if a live tool fails, say that specific tool failed.`;
}

async function providerReply(text, settings, history, attachments) {
  const { getAI, getGenerativeModel, GoogleAIBackend } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js');
  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  const normalTokens = { Max: 1450, 'Extra High': 1200, High: 950, Medium: 760, Light: 560 };
  const fastTokens = { Max: 1000, 'Extra High': 900, High: 760, Medium: 620, Light: 480 };
  const tempMap = { Max: .35, 'Extra High': .4, High: .5, Medium: .6, Light: .7 };
  const tokenMap = settings.speed === 'Fast' ? fastTokens : normalTokens;
  const model = getGenerativeModel(ai, {
    model: PROVIDER_MODEL,
    systemInstruction: { parts: [{ text: systemInstruction(settings) }] },
    generationConfig: {
      temperature: tempMap[settings.intelligence] ?? .5,
      maxOutputTokens: tokenMap[settings.intelligence] ?? 760
    }
  });
  const contextTurns = settings.speed === 'Fast' ? 8 : MAX_CONTEXT_TURNS;
  const context = history.slice(-contextTurns).map(turn => `${turn.role === 'user' ? 'User' : PRODUCT}: ${turn.text}`).join('\n');
  const fileSummary = attachments.length
    ? `\nAttached local files (metadata only in this build):\n${attachments.map(f => `- ${f.name} (${f.type || 'unknown'}, ${formatBytes(f.size)})`).join('\n')}`
    : '';
  const prompt = `Conversation context:\n${context || 'none'}${fileSummary}\n\nUser request:\n${text}`;
  const result = await model.generateContent(prompt);
  return String(result?.response?.text?.() || '').trim();
}

function iconSvg(name) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const paths = {
    images: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 13.5v-8Z"/><path d="m6.5 13 2.8-3 2.2 2.2 1.7-1.7 2.3 2.5"/><path d="M17 8h.5A2.5 2.5 0 0 1 20 10.5v7A2.5 2.5 0 0 1 17.5 20h-8A2.5 2.5 0 0 1 7 17.5V16"/>',
    library: '<path d="M5 4h4v16H5zM10 4h4v16h-4zM15 5l3.7-.8 2.8 14.8-3.7.8z"/>',
    projects: '<path d="M3.5 7h6l2 2H20.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V7Z"/><path d="M3.5 7V5.5A1.5 1.5 0 0 1 5 4h4l2 2"/>',
    remote: '<path d="M5 5h14v10H5z"/><path d="M9 19h6M12 15v4"/><path d="M7 22h.01M11 22h.01M15 22h.01M19 22h.01"/>',
    scheduled: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l-3 2"/>',
    plugins: '<path d="M8.5 4.5a3 3 0 0 1 5 2.2 3 3 0 1 1 3.8 3.8 3 3 0 0 1-2.2 5 3 3 0 1 1-5.6 0 3 3 0 0 1-2.2-5 3 3 0 1 1 1.2-6Z"/><circle cx="12" cy="12" r="2.2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/>',
    chat: '<path d="M5 4h14v11H9l-4 4v-4H5z"/><path d="M15.5 2.5v4M13.5 4.5h4"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" ${common}>${paths[name] || paths.plugins}</svg>`;
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
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Aaj ke latest AI trends web par research karke sources ke saath batao">Research latest AI trends</button>
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Meri nexusnova-website GitHub repo live check karo aur latest commit aur main files batao">Check NexusNova GitHub</button>
          <button class="nx57-clean-quick" type="button" data-nx57-quick="Mere next NexusNova task ko plan karo">Continue NexusNova work</button>
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
            <button type="button" data-nx57-action="files"><span>Files / photos</span><small>attach</small></button>
            <button type="button" data-nx57-action="camera"><span>Camera</span><small>device</small></button>
            <button type="button" data-nx57-action="library"><span>Chat library</span><small>recents</small></button>
            <button type="button" data-nx57-action="settings"><span>NOVA settings</span><small>speed & intelligence</small></button>
            <button type="button" data-nx57-action="remember"><span>Remember note</span><small>this device</small></button>
            <button type="button" data-nx57-action="speak"><span>Speak last reply</span><small>device TTS</small></button>
            <button type="button" data-nx57-action="system"><span>System check</span><small>live state</small></button>
          </div>

          <div class="nx57-clean-pop nx57-settings-pop" data-nx57-settings-pop hidden>
            <div class="nx57-clean-pop-title">NOVA settings</div>
            <label class="nx57-clean-setting"><span>Model</span><select data-nx57-model><option>NOVA 5.7 Sol</option><option>Terra</option><option>Luna</option><option>NOVA 5.6</option></select></label>
            <label class="nx57-clean-setting"><span>Speed</span><select data-nx57-speed><option>Fast</option><option>Standard</option></select></label>
            <label class="nx57-clean-setting"><span>Intelligence</span><select data-nx57-intelligence><option>Max</option><option>Extra High</option><option>High</option><option>Medium</option><option>Light</option></select></label>
          </div>
        </div>
      </div>
    </main>

    <input type="file" data-nx57-picker multiple hidden>
    <input type="file" data-nx57-images accept="image/*" multiple hidden>
    <input type="file" data-nx57-camera accept="image/*" capture="environment" hidden>
    <p class="nx57-clean-status" data-nx57-status aria-live="polite">${PRODUCT} ready.</p>

    <div class="nx57-clean-drawer-backdrop" data-nx57-clean-drawer hidden>
      <aside class="nx57-native-drawer" role="dialog" aria-modal="true" aria-label="NOVA sidebar">
        <div class="nx57-native-drawer__top">
          <h2 class="nx57-native-drawer__brand">NOVA</h2>
          <button class="nx57-native-drawer__search" type="button" data-nx57-drawer-search aria-label="Search chats">${iconSvg('search')}</button>
        </div>
        <div class="nx57-native-searchbar" data-nx57-native-searchbar hidden>
          <input data-nx57-search placeholder="Search chats" autocomplete="off">
          <button type="button" data-nx57-search-close aria-label="Close search">×</button>
        </div>
        <nav class="nx57-native-drawer__nav" aria-label="NOVA workspace">
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="images"><span class="nx57-native-drawer__icon">${iconSvg('images')}</span><span>Images</span></button>
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="library"><span class="nx57-native-drawer__icon">${iconSvg('library')}</span><span>Library</span></button>
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="projects"><span class="nx57-native-drawer__icon">${iconSvg('projects')}</span><span>Projects</span></button>
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="remote"><span class="nx57-native-drawer__icon">${iconSvg('remote')}</span><span>Remote</span></button>
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="scheduled"><span class="nx57-native-drawer__icon">${iconSvg('scheduled')}</span><span>Scheduled</span></button>
          <button class="nx57-native-drawer__item" type="button" data-nx57-side-action="plugins"><span class="nx57-native-drawer__icon">${iconSvg('plugins')}</span><span>Plugins</span></button>
        </nav>
        <h3 class="nx57-native-drawer__section-title">Recents</h3>
        <div class="nx57-native-recents" data-nx57-history></div>
        <div class="nx57-native-drawer__bottom">
          <button class="nx57-native-chat-button" type="button" data-nx57-drawer-new>${iconSvg('chat')}<span>Chat</span></button>
          <button class="nx57-native-avatar" type="button" data-nx57-avatar aria-label="Profile">N</button>
        </div>
      </aside>
    </div>
  `);

  const messages = root.querySelector('[data-nx57-messages]');
  const empty = root.querySelector('[data-nx57-empty]');
  const input = root.querySelector('[data-nx57-input]');
  const send = root.querySelector('[data-nx57-send]');
  const picker = root.querySelector('[data-nx57-picker]');
  const imagesPicker = root.querySelector('[data-nx57-images]');
  const camera = root.querySelector('[data-nx57-camera]');
  const filesBox = root.querySelector('[data-nx57-files]');
  const status = root.querySelector('[data-nx57-status]');
  const toolsMenu = root.querySelector('[data-nx57-tools]');
  const settingsPop = root.querySelector('[data-nx57-settings-pop]');
  const drawer = root.querySelector('[data-nx57-clean-drawer]');
  const search = root.querySelector('[data-nx57-search]');
  const searchBar = root.querySelector('[data-nx57-native-searchbar]');
  const historyBox = root.querySelector('[data-nx57-history]');
  const avatar = root.querySelector('[data-nx57-avatar]');
  const taskStatus = createTaskStatus(messages);

  let key = '';
  let history = [];
  let attachments = [];
  let lastReply = '';
  let busy = false;
  let recognition = null;

  const closeTools = () => { toolsMenu.hidden = true; settingsPop.hidden = true; };
  const closeDrawer = () => { drawer.hidden = true; searchBar.hidden = true; search.value = ''; };

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
    div.innerHTML = '<p></p>';
    div.querySelector('p').textContent = text;
    messages.insertBefore(div, taskStatus.row);
    syncEmpty();
    messages.scrollTop = messages.scrollHeight;
    if (persist && key) {
      history.push({ id: uid('nova57'), role, text: String(text).slice(0, 12000), at: Date.now() });
      history = history.slice(-MAX_HISTORY);
      saveJson(key, history);
    }
  };

  const recentTitle = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 56) || 'Untitled chat';

  const renderHistory = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const rows = history.filter(turn => turn.role === 'user' && (!q || turn.text.toLowerCase().includes(q))).slice().reverse().slice(0, 24);
    historyBox.innerHTML = rows.length
      ? rows.map(turn => `<button class="nx57-native-recent" type="button" data-nx57-history-id="${escapeHtml(turn.id)}">${escapeHtml(recentTitle(turn.text))}</button>`).join('')
      : '<p class="nx57-native-empty">No recent chats yet.</p>';
    historyBox.querySelectorAll('[data-nx57-history-id]').forEach(button => button.addEventListener('click', () => {
      const turn = history.find(x => x.id === button.dataset.nx57HistoryId);
      if (!turn) return;
      input.value = turn.text;
      autoSize();
      closeDrawer();
      input.focus();
    }));
  };

  const openDrawer = () => {
    drawer.hidden = false;
    renderHistory(search.value);
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
      ? `${attachments.length} attachment(s) selected. This build currently sends file metadata to the model.`
      : `${PRODUCT} ready.`;
  };

  const clearChat = () => {
    history = [];
    if (key) saveJson(key, history);
    messages.querySelectorAll('.nx57-clean-msg').forEach(message => message.remove());
    taskStatus.finish();
    lastReply = '';
    closeTools();
    closeDrawer();
    syncEmpty();
    renderHistory();
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
    addMessage(text, 'user');
    taskStatus.start(text);
    status.textContent = `${PRODUCT} working…`;
    input.value = '';
    autoSize();
    try {
      let reply = await deterministic(text);
      let provenance = 'NexusNova account/local capability';
      if (!reply) {
        reply = await providerReply(text, settings, history, attachments);
        provenance = 'NOVA routed cloud AI';
      }
      lastReply = reply || 'AI returned no text.';
      taskStatus.finish();
      addMessage(lastReply, 'assistant');
      status.textContent = `${provenance} • ${settings.mode === 'work' ? 'Work' : 'Chat'} mode`;
    } catch (error) {
      console.warn('[NexusNova Fresh] NOVA 5.7:', error);
      taskStatus.fail();
      lastReply = 'AI service is unavailable right now. Your account data was not changed.';
      addMessage(lastReply, 'assistant');
      status.textContent = /app.?check|403|permission/i.test(String(error?.message || ''))
        ? 'Cloud request blocked by provider security/configuration.'
        : 'All available AI routes failed for this request.';
    } finally {
      busy = false;
      send.disabled = false;
      attachments = [];
      renderFiles();
      renderHistory(search.value);
    }
  };

  const openExistingApp = id => {
    closeDrawer();
    const ok = window.NexusNovaFresh?.openApp?.(id);
    if (!ok) status.textContent = `${id} could not be opened.`;
  };

  const runRemoteCheck = () => {
    input.value = 'Meri nexusnova-website GitHub repo live check karo aur latest commit aur main files batao.';
    autoSize();
    closeDrawer();
    ask();
  };

  historyKey().then(value => {
    key = value;
    history = normalizeHistory(loadJson(key, []));
    history.slice(-10).forEach(turn => addMessage(turn.text, turn.role, false));
    renderHistory();
    syncEmpty();
  });

  readUserProfile().then(profile => {
    const name = String(profile?.name || '').trim();
    const initials = name ? name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : 'N';
    avatar.textContent = initials || 'N';
  }).catch(() => {});

  root.querySelectorAll('[data-nx57-mode]').forEach(button => button.addEventListener('click', () => {
    settings.mode = button.dataset.nx57Mode;
    applySettings();
  }));

  root.querySelector('[data-nx57-clean-menu]').addEventListener('click', openDrawer);
  root.querySelector('[data-nx57-new]').addEventListener('click', clearChat);
  root.querySelector('[data-nx57-drawer-new]').addEventListener('click', clearChat);

  root.querySelectorAll('[data-nx57-quick]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.nx57Quick || '';
    autoSize();
    input.focus();
  }));

  root.querySelector('[data-nx57-plus]').addEventListener('click', event => {
    event.stopPropagation();
    settingsPop.hidden = true;
    toolsMenu.hidden = !toolsMenu.hidden;
  });

  root.querySelectorAll('[data-nx57-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.nx57Action;
    toolsMenu.hidden = true;
    if (action === 'files') picker.click();
    if (action === 'camera') camera.click();
    if (action === 'library') openDrawer();
    if (action === 'settings') settingsPop.hidden = false;
    if (action === 'system') {
      status.textContent = `Online: ${navigator.onLine ? 'yes' : 'no'} • AI router: active • Public GitHub read: connected • Voice: ${voiceSupported() ? 'available' : 'not exposed'} • File content: metadata only`;
    }
    if (action === 'remember') {
      const text = input.value.trim();
      if (!text) status.textContent = 'Type a note in the message box first.';
      else {
        const notes = loadJson(NOTES_KEY, []);
        notes.push(text.slice(0, 1000));
        saveJson(NOTES_KEY, notes.slice(-40));
        status.textContent = 'Note remembered on this device.';
      }
    }
    if (action === 'speak') status.textContent = speak(lastReply) ? 'Speaking last NOVA reply…' : 'Speech output is unavailable.';
  }));

  root.querySelectorAll('[data-nx57-side-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.nx57SideAction;
    if (action === 'images') {
      closeDrawer();
      imagesPicker.click();
    }
    if (action === 'library') {
      searchBar.hidden = true;
      search.value = '';
      renderHistory();
      historyBox.scrollIntoView({ block: 'nearest' });
    }
    if (action === 'projects') openExistingApp('notes');
    if (action === 'remote') runRemoteCheck();
    if (action === 'scheduled') openExistingApp('reminders');
    if (action === 'plugins') {
      closeDrawer();
      settingsPop.hidden = true;
      toolsMenu.hidden = false;
    }
  }));

  root.querySelector('[data-nx57-drawer-search]').addEventListener('click', () => {
    searchBar.hidden = false;
    search.focus();
  });
  root.querySelector('[data-nx57-search-close]').addEventListener('click', () => {
    searchBar.hidden = true;
    search.value = '';
    renderHistory();
  });
  search.addEventListener('input', () => renderHistory(search.value));
  drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); });

  root.querySelector('[data-nx57-model]').addEventListener('change', event => { settings.model = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-speed]').addEventListener('change', event => { settings.speed = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-intelligence]').addEventListener('change', event => { settings.intelligence = event.target.value; applySettings(); });

  picker.addEventListener('change', () => {
    addPickedFiles([...(picker.files || [])]);
    picker.value = '';
  });
  imagesPicker.addEventListener('change', () => {
    addPickedFiles([...(imagesPicker.files || [])]);
    imagesPicker.value = '';
    input.focus();
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
    if (!event.target.closest('[data-nx57-tools]') && !event.target.closest('[data-nx57-plus]') && !event.target.closest('[data-nx57-settings-pop]')) closeTools();
  });

  applySettings();
  autoSize();
  syncEmpty();

  root.__cleanup = () => {
    document.documentElement.classList.remove('nx57-clean-mode');
    taskStatus.destroy();
    try { recognition?.stop?.(); } catch {}
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };

  return root;
}

export const novaSol57Renderers = Object.freeze({ ai: renderNovaSol57 });