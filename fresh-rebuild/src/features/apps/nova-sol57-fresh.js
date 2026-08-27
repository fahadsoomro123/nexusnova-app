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

function ensureStyle() {
  if (document.getElementById('nx-nova57-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova57-style';
  style.textContent = `
    .nx57{display:grid;gap:12px}
    .nx57-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .nx57-brand{display:flex;align-items:center;gap:10px}
    .nx57-orb{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#1dd6c2,#4868ff);box-shadow:0 8px 24px rgba(30,190,210,.22);font-weight:900;color:#fff}
    .nx57-title strong{display:block;font-size:16px}.nx57-title span{font-size:11px;opacity:.72}
    .nx57-seg{display:flex;padding:3px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(7,17,31,.55)}
    .nx57-seg button{border:0;background:transparent;color:inherit;padding:7px 12px;border-radius:9px;font-weight:800;font-size:12px}
    .nx57-seg button.is-active{background:rgba(74,110,255,.22);box-shadow:inset 0 0 0 1px rgba(100,130,255,.28)}
    .nx57-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .nx57-controls label{display:grid;gap:5px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.78}
    .nx57-controls select{width:100%;min-width:0;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:#0a1727;color:#eef6ff;padding:9px 8px}
    .nx57-toolbar{display:flex;gap:7px;overflow:auto;padding-bottom:2px}
    .nx57-toolbar button{white-space:nowrap;border:1px solid rgba(148,163,184,.18);background:rgba(11,28,47,.8);color:inherit;border-radius:10px;padding:8px 10px;font-weight:750;font-size:11px}
    .nx57-messages{display:grid;gap:10px;max-height:48vh;min-height:260px;overflow:auto;padding:2px}
    .nx57-msg{max-width:94%;padding:11px 12px;border-radius:16px;border:1px solid rgba(148,163,184,.13);background:rgba(11,27,46,.78)}
    .nx57-msg.user{justify-self:end;background:rgba(49,82,168,.25)}
    .nx57-msg strong{display:block;font-size:10px;opacity:.66;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
    .nx57-msg p{white-space:pre-wrap;margin:0;line-height:1.45;overflow-wrap:anywhere}
    .nx57-compose{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:end}
    .nx57-compose textarea{resize:none;min-height:48px;max-height:160px;border:1px solid rgba(148,163,184,.22);border-radius:15px;background:#091728;color:#f4f8ff;padding:12px}
    .nx57-compose button{width:44px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:#10243b;color:#fff;font-size:18px}
    .nx57-compose .nx57-send{background:linear-gradient(145deg,#2468ff,#30c7b9);border:0}
    .nx57-attachments{display:flex;gap:6px;flex-wrap:wrap}
    .nx57-chip{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;background:rgba(42,70,100,.28);border:1px solid rgba(148,163,184,.13);font-size:10px}
    .nx57-chip button{border:0;background:transparent;color:inherit;font-size:14px}
    .nx57-panel{display:none;border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:11px;background:rgba(7,18,31,.78)}
    .nx57-panel.is-open{display:block}
    .nx57-search{display:grid;grid-template-columns:1fr auto;gap:7px}
    .nx57-search input{border:1px solid rgba(148,163,184,.2);border-radius:10px;background:#091728;color:#fff;padding:9px}
    .nx57-history{display:grid;gap:6px;max-height:220px;overflow:auto;margin-top:8px}
    .nx57-history button{text-align:left;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(17,37,58,.72);color:inherit;padding:8px}
    .nx57-status{font-size:10px;opacity:.72;margin:0}
    .nx57-note{font-size:11px;opacity:.78;line-height:1.4}
    @media(max-width:520px){.nx57-controls{grid-template-columns:1fr}.nx57-messages{max-height:45vh}}
  `;
  document.head.appendChild(style);
}

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx57';
  root.innerHTML = html;
  return root;
}

function safeSettings() {
  const value = loadJson(SETTINGS_KEY, {});
  return {
    mode: value.mode === 'work' ? 'work' : 'chat',
    model: ['NOVA 5.7 Sol','Terra','Luna','NOVA 5.6'].includes(value.model) ? value.model : 'NOVA 5.7 Sol',
    speed: value.speed === 'Fast' ? 'Fast' : 'Standard',
    intelligence: ['Max','Extra High','High','Medium','Light'].includes(value.intelligence) ? value.intelligence : 'High'
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
      ? `Your current NexusNova balance is ${n.toLocaleString(undefined,{maximumFractionDigits:4})} NVX.`
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
  return `You are ${PRODUCT}, the NexusNova AI assistant. ${work}
Match the user's language. The UI profile is ${settings.model}; speed preference is ${settings.speed}; intelligence preference is ${settings.intelligence}.
Never claim to be an OpenAI proprietary model. Never invent account balances, mining data, transactions, live prices, rewards, provider results or completed actions.
Never ask for passwords, seed phrases or private keys. For current/live research, clearly say when live browsing/provider access is not available.`;
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
  ensureStyle();
  const settings = safeSettings();
  const root = node(`
    <section class="nx-panel nx57">
      <div class="nx57-top">
        <div class="nx57-brand"><div class="nx57-orb">N</div><div class="nx57-title"><strong>${PRODUCT}</strong><span>NexusNova intelligence workspace</span></div></div>
        <div class="nx57-seg" role="tablist"><button type="button" data-nx57-mode="chat">CHAT</button><button type="button" data-nx57-mode="work">WORK</button></div>
      </div>
      <div class="nx57-controls">
        <label>Model<select data-nx57-model><option>NOVA 5.7 Sol</option><option>Terra</option><option>Luna</option><option>NOVA 5.6</option></select></label>
        <label>Speed<select data-nx57-speed><option>Standard</option><option>Fast</option></select></label>
        <label>Intelligence<select data-nx57-intelligence><option>Max</option><option>Extra High</option><option>High</option><option>Medium</option><option>Light</option></select></label>
      </div>
      <div class="nx57-toolbar">
        <button type="button" data-nx57-tool="history">RECENTS / SEARCH</button>
        <button type="button" data-nx57-tool="system">SYSTEM CHECK</button>
        <button type="button" data-nx57-tool="video">VIDEO STUDIO</button>
        <button type="button" data-nx57-speak>SPEAK LAST</button>
        <button type="button" data-nx57-clear>CLEAR CHAT</button>
      </div>
      <div class="nx57-panel" data-nx57-panel="history">
        <div class="nx57-search"><input data-nx57-search placeholder="Search recent NOVA messages"><button type="button" data-nx57-search-go>SEARCH</button></div>
        <div class="nx57-history" data-nx57-history></div>
      </div>
      <div class="nx57-panel" data-nx57-panel="system"></div>
      <div class="nx57-panel" data-nx57-panel="video">
        <strong>NOVA Video Studio</strong>
        <p class="nx57-note">Text-to-video / image-to-video surface is provider-ready, but a video-capable cloud backend is not configured in this Android build. NOVA will not show fake video progress or fake results.</p>
      </div>
      <div class="nx57-messages" data-nx57-messages></div>
      <div class="nx57-attachments" data-nx57-files></div>
      <div class="nx57-compose">
        <button type="button" data-nx57-add aria-label="Attach files">＋</button>
        <textarea rows="2" maxlength="5000" data-nx57-input placeholder="Message NOVA 5.7 Sol…"></textarea>
        <button class="nx57-send" type="button" data-nx57-send aria-label="Send">➤</button>
      </div>
      <input type="file" data-nx57-picker multiple hidden>
      <div class="nx57-toolbar"><button type="button" data-nx57-mic>🎙 VOICE</button><button type="button" data-nx57-remember>REMEMBER NOTE</button></div>
      <p class="nx57-status" data-nx57-status>${PRODUCT} ready • Firebase AI cloud route loads only when needed.</p>
    </section>
  `);

  const messages = root.querySelector('[data-nx57-messages]');
  const input = root.querySelector('[data-nx57-input]');
  const send = root.querySelector('[data-nx57-send]');
  const picker = root.querySelector('[data-nx57-picker]');
  const filesBox = root.querySelector('[data-nx57-files]');
  const status = root.querySelector('[data-nx57-status]');
  const search = root.querySelector('[data-nx57-search]');
  const historyBox = root.querySelector('[data-nx57-history]');
  const systemPanel = root.querySelector('[data-nx57-panel="system"]');
  let key = '';
  let history = [];
  let attachments = [];
  let lastReply = '';
  let busy = false;
  let recognition = null;

  const addMessage = (text, role, persist = true) => {
    const div = document.createElement('article');
    div.className = `nx57-msg ${role === 'user' ? 'user' : 'bot'}`;
    div.innerHTML = `<strong>${role === 'user' ? 'You' : PRODUCT}</strong><p></p>`;
    div.querySelector('p').textContent = text;
    messages.appendChild(div);
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
      : '<p class="nx57-note">No matching recent messages.</p>';
    historyBox.querySelectorAll('[data-nx57-history-id]').forEach(button => button.addEventListener('click', () => {
      const turn = history.find(x => x.id === button.dataset.nx57HistoryId);
      if (turn) input.value = turn.text;
    }));
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
      `<span class="nx57-chip">${escapeHtml(file.name)} • ${formatBytes(file.size)} <button type="button" data-nx57-remove="${index}" aria-label="Remove">×</button></span>`
    ).join('');
    filesBox.querySelectorAll('[data-nx57-remove]').forEach(button => button.addEventListener('click', () => {
      attachments.splice(Number(button.dataset.nx57Remove), 1);
      renderFiles();
    }));
  };

  const showPanel = name => {
    root.querySelectorAll('[data-nx57-panel]').forEach(panel => panel.classList.toggle('is-open', panel.dataset.nx57Panel === name && !panel.classList.contains('is-open')));
    if (name === 'history') renderHistory(search.value);
    if (name === 'system') {
      systemPanel.innerHTML = `<strong>System Check</strong><p class="nx57-note">
        Product: ${PRODUCT}<br>
        Online: ${navigator.onLine ? 'yes' : 'no'}<br>
        Voice input: ${voiceSupported() ? 'available' : 'not exposed by this WebView'}<br>
        Speech output: ${'speechSynthesis' in window ? 'available' : 'unavailable'}<br>
        File picker: available • max ${MAX_FILES} files / ${formatBytes(MAX_TOTAL_BYTES)} total<br>
        AI route: Firebase AI cloud provider on demand<br>
        Video provider: not configured
      </p>`;
    }
  };

  const ask = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    status.textContent = `${PRODUCT} thinking…`;
    addMessage(text, 'user');
    input.value = '';
    try {
      let reply = await deterministic(text);
      if (!reply) reply = await providerReply(text, settings, history, attachments);
      lastReply = reply || 'AI returned no text.';
      addMessage(lastReply, 'assistant');
      status.textContent = `${PRODUCT} ready • ${settings.mode === 'work' ? 'Work' : 'Chat'} mode`;
    } catch (error) {
      console.warn('[NexusNova Fresh] NOVA 5.7:', error);
      lastReply = 'AI service is unavailable right now. Your account data was not changed.';
      addMessage(lastReply, 'assistant');
      status.textContent = /app.?check|403|permission/i.test(String(error?.message || ''))
        ? 'AI request blocked by Firebase App Check / provider configuration.'
        : 'AI provider did not respond.';
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
    const recent = history.slice(-10);
    if (recent.length) recent.forEach(turn => addMessage(turn.text, turn.role, false));
    else addMessage(`Assalam-o-Alaikum. I am ${PRODUCT}. Chat or Work mode choose karke apna task bhejein.`, 'assistant', false);
  });

  root.querySelectorAll('[data-nx57-mode]').forEach(button => button.addEventListener('click', () => {
    settings.mode = button.dataset.nx57Mode;
    applySettings();
  }));
  root.querySelector('[data-nx57-model]').addEventListener('change', event => { settings.model = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-speed]').addEventListener('change', event => { settings.speed = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-intelligence]').addEventListener('change', event => { settings.intelligence = event.target.value; applySettings(); });
  root.querySelectorAll('[data-nx57-tool]').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.nx57Tool)));
  root.querySelector('[data-nx57-search-go]').addEventListener('click', () => renderHistory(search.value));
  search.addEventListener('keydown', event => { if (event.key === 'Enter') renderHistory(search.value); });
  root.querySelector('[data-nx57-add]').addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const picked = [...(picker.files || [])];
    let total = attachments.reduce((sum, f) => sum + f.size, 0);
    for (const file of picked) {
      if (attachments.length >= MAX_FILES) break;
      if (file.size <= 0 || total + file.size > MAX_TOTAL_BYTES) continue;
      attachments.push(file);
      total += file.size;
    }
    picker.value = '';
    renderFiles();
    status.textContent = attachments.length ? `${attachments.length} attachment(s) ready. Metadata is sent; file contents are not uploaded by this build.` : `${PRODUCT} ready.`;
  });
  root.querySelector('[data-nx57-speak]').addEventListener('click', () => {
    status.textContent = speak(lastReply) ? 'Speaking last NOVA reply…' : 'Speech output is unavailable.';
  });
  root.querySelector('[data-nx57-clear]').addEventListener('click', () => {
    history = [];
    if (key) saveJson(key, history);
    messages.innerHTML = '';
    lastReply = '';
    addMessage(`New ${PRODUCT} chat started.`, 'assistant', false);
    renderHistory();
  });
  root.querySelector('[data-nx57-remember]').addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { status.textContent = 'Type a note in the message box first.'; return; }
    const notesKey = 'nexus_nova57_notes_v1';
    const notes = loadJson(notesKey, []);
    notes.push(text.slice(0, 1000));
    saveJson(notesKey, notes.slice(-40));
    status.textContent = 'Note remembered on this device.';
  });
  root.querySelector('[data-nx57-mic]').addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { status.textContent = 'Voice input is not exposed by this Android WebView.'; return; }
    try { recognition?.stop?.(); } catch {}
    recognition = new Recognition();
    recognition.lang = 'en-PK';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => { input.value = String(event.results?.[0]?.[0]?.transcript || '').trim(); status.textContent = 'Voice captured.'; };
    recognition.onerror = () => { status.textContent = 'Voice input could not start.'; };
    recognition.onend = () => { recognition = null; };
    recognition.start();
    status.textContent = 'Listening…';
  });
  send.addEventListener('click', ask);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  });

  applySettings();
  root.__cleanup = () => {
    try { recognition?.stop?.(); } catch {}
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };
  return root;
}

export const novaSol57Renderers = Object.freeze({ ai: renderNovaSol57 });
