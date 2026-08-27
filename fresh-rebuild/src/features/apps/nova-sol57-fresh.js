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

function ensureStyle() {
  if (document.getElementById('nx-nova57-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova57-style';
  style.textContent = `
    .nx57{display:grid;gap:10px;position:relative;min-height:0}
    .nx57-top{display:flex;justify-content:center;align-items:center;padding:2px 0 4px}
    .nx57-seg{display:flex;padding:3px;border:1px solid rgba(148,163,184,.16);border-radius:999px;background:rgba(7,17,31,.55)}
    .nx57-seg button{min-width:86px;border:0;background:transparent;color:inherit;padding:8px 14px;border-radius:999px;font-weight:850;font-size:12px;letter-spacing:.02em}
    .nx57-seg button.is-active{background:rgba(74,110,255,.22);box-shadow:inset 0 0 0 1px rgba(100,130,255,.25)}
    .nx57-messages{display:grid;align-content:start;gap:14px;min-height:300px;max-height:56vh;overflow:auto;padding:4px 3px 8px;scrollbar-width:thin}
    .nx57-msg{max-width:min(92%,760px);line-height:1.52;overflow-wrap:anywhere}
    .nx57-msg.user{justify-self:end;padding:10px 12px;border-radius:18px;background:rgba(49,82,168,.25);border:1px solid rgba(126,151,255,.14)}
    .nx57-msg.bot{justify-self:start;padding:2px 2px}
    .nx57-msg strong{display:block;font-size:10px;opacity:.58;margin-bottom:5px;text-transform:uppercase;letter-spacing:.07em}
    .nx57-msg p{white-space:pre-wrap;margin:0}
    .nx57-attachments{display:flex;gap:6px;flex-wrap:wrap}
    .nx57-chip{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;background:rgba(42,70,100,.25);border:1px solid rgba(148,163,184,.12);font-size:10px}
    .nx57-chip button{border:0;background:transparent;color:inherit;font-size:14px;padding:0 1px}
    .nx57-compose{position:relative;border:1px solid rgba(148,163,184,.2);border-radius:22px;background:#091728;box-shadow:0 10px 28px rgba(0,0,0,.16);padding:10px}
    .nx57-compose textarea{display:block;width:100%;box-sizing:border-box;resize:none;min-height:42px;max-height:150px;border:0;outline:0;background:transparent;color:#f4f8ff;padding:2px 4px 8px;font:500 15px/1.45 system-ui,-apple-system,sans-serif}
    .nx57-compose-row{display:flex;align-items:center;gap:7px;min-width:0}
    .nx57-iconbtn,.nx57-modelbtn{border:1px solid rgba(148,163,184,.17);background:#10243b;color:#fff;height:38px;border-radius:12px;font-weight:800}
    .nx57-iconbtn{width:38px;display:grid;place-items:center;font-size:17px;flex:0 0 auto}
    .nx57-modelbtn{max-width:190px;min-width:0;padding:0 11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
    .nx57-compose-spacer{flex:1 1 auto}
    .nx57-send{width:38px;height:38px;border-radius:50%;border:0;background:linear-gradient(145deg,#2468ff,#30c7b9);color:#fff;font-size:17px;display:grid;place-items:center;flex:0 0 auto}
    .nx57-send:disabled{opacity:.45}
    .nx57-pop{position:absolute;left:10px;bottom:56px;z-index:40;width:min(320px,calc(100vw - 48px));max-height:min(55vh,430px);overflow:auto;border:1px solid rgba(148,163,184,.17);border-radius:16px;background:#0b1726;color:#eef6ff;box-shadow:0 20px 55px rgba(0,0,0,.45);padding:8px}
    .nx57-pop[hidden]{display:none}
    .nx57-modelpop{left:54px}
    .nx57-menu-title{font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.08em;padding:7px 9px 4px}
    .nx57-menu-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;color:inherit;border-radius:11px;padding:10px;text-align:left;font-weight:700;font-size:12px}
    .nx57-menu-btn:hover,.nx57-menu-btn:focus{background:rgba(80,112,150,.16);outline:0}
    .nx57-menu-btn small{font-weight:600;opacity:.58}
    .nx57-menu-btn[disabled]{opacity:.45}
    .nx57-setting{display:grid;gap:6px;padding:8px 9px}
    .nx57-setting span{font-size:10px;opacity:.62;text-transform:uppercase;letter-spacing:.07em}
    .nx57-setting select{width:100%;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:#081421;color:#fff;padding:9px 10px}
    .nx57-route-note{margin:4px 9px 9px;padding:8px 9px;border-radius:10px;background:rgba(45,70,105,.2);font-size:10px;line-height:1.45;opacity:.78}
    .nx57-status{font-size:10px;opacity:.68;margin:0;padding:0 4px;line-height:1.4}
    .nx57-drawer-backdrop{position:fixed;inset:0;z-index:2147482500;background:rgba(1,7,15,.58);backdrop-filter:blur(2px)}
    .nx57-drawer-backdrop[hidden]{display:none}
    .nx57-drawer{position:absolute;left:0;top:0;bottom:0;width:min(88vw,350px);background:#081421;border-right:1px solid rgba(148,163,184,.16);box-shadow:20px 0 60px rgba(0,0,0,.42);padding:14px;overflow:auto}
    .nx57-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
    .nx57-drawer-head strong{font-size:15px}.nx57-drawer-head span{display:block;font-size:10px;opacity:.58;margin-top:2px}
    .nx57-drawer-close{width:34px;height:34px;border-radius:11px;border:1px solid rgba(148,163,184,.16);background:#10243b;color:#fff}
    .nx57-side-nav{display:grid;gap:5px;margin:9px 0 12px}
    .nx57-side-nav button{display:flex;justify-content:space-between;gap:10px;border:0;border-radius:11px;background:transparent;color:inherit;text-align:left;padding:10px;font-weight:750}
    .nx57-side-nav button.is-active{background:rgba(74,110,255,.16)}
    .nx57-side-nav small{opacity:.52}
    .nx57-side-panel{display:none;border-top:1px solid rgba(148,163,184,.12);padding-top:12px}
    .nx57-side-panel.is-open{display:block}
    .nx57-search{display:grid;grid-template-columns:1fr auto;gap:7px}
    .nx57-search input{border:1px solid rgba(148,163,184,.18);border-radius:11px;background:#091728;color:#fff;padding:10px}
    .nx57-search button{border:0;border-radius:11px;background:#16304d;color:#fff;padding:0 12px;font-weight:800}
    .nx57-history{display:grid;gap:6px;max-height:46vh;overflow:auto;margin-top:8px}
    .nx57-history button{text-align:left;border:1px solid rgba(148,163,184,.11);border-radius:11px;background:rgba(17,37,58,.65);color:inherit;padding:9px;font-size:11px}
    .nx57-note{font-size:11px;opacity:.76;line-height:1.5}
    .nx57-system{font-size:11px;line-height:1.65}
    .nx57-system b{font-weight:800}
    @media(max-width:520px){
      .nx57-messages{min-height:270px;max-height:52vh}
      .nx57-modelbtn{max-width:145px}
      .nx57-pop{width:min(300px,calc(100vw - 34px))}
      .nx57-drawer{width:min(91vw,340px)}
    }

    /* NOVA-screen-only safe placement override: keeps SOS away from composer, dock and keyboard. */
    #nxEmergencySosButton{
      top:clamp(150px,38vh,320px)!important;
      bottom:auto!important;
      right:0!important;
    }
    #nxEmergencySosButton[data-active="1"],#nxEmergencySosButton[data-busy="1"]{
      top:clamp(150px,38vh,320px)!important;
      bottom:auto!important;
      right:10px!important;
    }
    #nxEmergencySosEdit{
      top:calc(clamp(150px,38vh,320px) - 42px)!important;
      bottom:auto!important;
      right:15px!important;
    }
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
        <div class="nx57-seg" role="tablist" aria-label="NOVA mode">
          <button type="button" data-nx57-mode="chat">CHAT</button>
          <button type="button" data-nx57-mode="work">WORK</button>
        </div>
      </div>

      <div class="nx57-messages" data-nx57-messages></div>
      <div class="nx57-attachments" data-nx57-files></div>

      <div class="nx57-compose">
        <textarea rows="1" maxlength="5000" data-nx57-input placeholder="Message NOVA 5.7 Sol…"></textarea>
        <div class="nx57-compose-row">
          <button class="nx57-iconbtn" type="button" data-nx57-plus aria-label="Open tools">＋</button>
          <button class="nx57-modelbtn" type="button" data-nx57-model-button aria-label="Model and intelligence settings"></button>
          <span class="nx57-compose-spacer"></span>
          <button class="nx57-iconbtn" type="button" data-nx57-mic aria-label="Voice input">🎙</button>
          <button class="nx57-send" type="button" data-nx57-send aria-label="Send">➤</button>
        </div>

        <div class="nx57-pop" data-nx57-tools hidden>
          <div class="nx57-menu-title">Add & tools</div>
          <button class="nx57-menu-btn" type="button" data-nx57-action="files"><span>📎 Files / photos</span><small>metadata only</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="camera"><span>📷 Camera</span><small>where supported</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="sidebar"><span>☰ Search / Library</span><small>recents & tools</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="system"><span>✓ System Check</span><small>real capability state</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="video"><span>🎬 Video Studio</span><small>backend not connected</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="remember"><span>✦ Remember note</span><small>this device</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="speak"><span>🔊 Speak last</span><small>device TTS</small></button>
          <button class="nx57-menu-btn" type="button" data-nx57-action="clear"><span>＋ New chat</span><small>clear local history</small></button>
        </div>

        <div class="nx57-pop nx57-modelpop" data-nx57-model-menu hidden>
          <div class="nx57-menu-title">NOVA controls</div>
          <label class="nx57-setting"><span>Model</span><select data-nx57-model><option>NOVA 5.7 Sol</option><option>Terra</option><option>Luna</option><option>NOVA 5.6</option></select></label>
          <label class="nx57-setting"><span>Speed</span><select data-nx57-speed><option>Standard</option><option>Fast</option></select></label>
          <label class="nx57-setting"><span>Intelligence</span><select data-nx57-intelligence><option>Max</option><option>Extra High</option><option>High</option><option>Medium</option><option>Light</option></select></label>
          <p class="nx57-route-note">Provider in this build: Firebase AI → Google AI backend → ${PROVIDER_MODEL}. Local PC/Ollama and GitHub agent are not connected yet.</p>
        </div>
      </div>

      <input type="file" data-nx57-picker multiple hidden>
      <input type="file" data-nx57-camera accept="image/*" capture="environment" hidden>
      <p class="nx57-status" data-nx57-status>${PRODUCT} ready • Cloud route available on demand.</p>

      <div class="nx57-drawer-backdrop" data-nx57-drawer hidden>
        <aside class="nx57-drawer" role="dialog" aria-modal="true" aria-label="NOVA library and tools">
          <div class="nx57-drawer-head">
            <div><strong>${PRODUCT}</strong><span>Search, recents & tools</span></div>
            <button class="nx57-drawer-close" type="button" data-nx57-drawer-close aria-label="Close">×</button>
          </div>
          <nav class="nx57-side-nav">
            <button type="button" data-nx57-side="history">Search & Recents <small>local</small></button>
            <button type="button" data-nx57-side="projects">Projects <small>not connected</small></button>
            <button type="button" data-nx57-side="remote">Remote / GitHub <small>Phase B</small></button>
            <button type="button" data-nx57-side="scheduled">Scheduled <small>not connected</small></button>
            <button type="button" data-nx57-side="plugins">Plugins / Tools <small>current</small></button>
            <button type="button" data-nx57-side="system">System Check <small>live state</small></button>
          </nav>

          <section class="nx57-side-panel" data-nx57-side-panel="history">
            <div class="nx57-search"><input data-nx57-search placeholder="Search recent NOVA messages"><button type="button" data-nx57-search-go>SEARCH</button></div>
            <div class="nx57-history" data-nx57-history></div>
          </section>
          <section class="nx57-side-panel" data-nx57-side-panel="projects">
            <p class="nx57-note"><b>Projects</b><br>No remote project workspace is connected in this build. Local chat history remains available.</p>
          </section>
          <section class="nx57-side-panel" data-nx57-side-panel="remote">
            <p class="nx57-note"><b>Remote / GitHub</b><br>Not connected. NOVA cannot read, branch, commit or create PRs from the app yet. This is Phase B.</p>
          </section>
          <section class="nx57-side-panel" data-nx57-side-panel="scheduled">
            <p class="nx57-note"><b>Scheduled</b><br>No NOVA scheduler backend is connected in this Android build.</p>
          </section>
          <section class="nx57-side-panel" data-nx57-side-panel="plugins">
            <p class="nx57-note"><b>Available now</b><br>File picker (metadata only), camera picker where supported, device speech output, WebView voice recognition where exposed, local notes, recent-message search and System Check.</p>
          </section>
          <section class="nx57-side-panel nx57-system" data-nx57-side-panel="system"></section>
        </aside>
      </div>
    </section>
  `);

  const messages = root.querySelector('[data-nx57-messages]');
  const input = root.querySelector('[data-nx57-input]');
  const send = root.querySelector('[data-nx57-send]');
  const picker = root.querySelector('[data-nx57-picker]');
  const camera = root.querySelector('[data-nx57-camera]');
  const filesBox = root.querySelector('[data-nx57-files]');
  const status = root.querySelector('[data-nx57-status]');
  const toolsMenu = root.querySelector('[data-nx57-tools]');
  const modelMenu = root.querySelector('[data-nx57-model-menu]');
  const modelButton = root.querySelector('[data-nx57-model-button]');
  const drawer = root.querySelector('[data-nx57-drawer]');
  const search = root.querySelector('[data-nx57-search]');
  const historyBox = root.querySelector('[data-nx57-history]');
  const systemPanel = root.querySelector('[data-nx57-side-panel="system"]');

  let key = '';
  let history = [];
  let attachments = [];
  let lastReply = '';
  let busy = false;
  let recognition = null;

  const closeMenus = () => {
    toolsMenu.hidden = true;
    modelMenu.hidden = true;
  };

  const autoSize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  };

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
      if (turn) {
        input.value = turn.text;
        autoSize();
        drawer.hidden = true;
        input.focus();
      }
    }));
  };

  const openSide = name => {
    drawer.hidden = false;
    root.querySelectorAll('[data-nx57-side]').forEach(button => button.classList.toggle('is-active', button.dataset.nx57Side === name));
    root.querySelectorAll('[data-nx57-side-panel]').forEach(panel => panel.classList.toggle('is-open', panel.dataset.nx57SidePanel === name));
    if (name === 'history') renderHistory(search.value);
    if (name === 'system') renderSystem();
  };

  const applySettings = () => {
    root.querySelectorAll('[data-nx57-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.nx57Mode === settings.mode));
    root.querySelector('[data-nx57-model]').value = settings.model;
    root.querySelector('[data-nx57-speed]').value = settings.speed;
    root.querySelector('[data-nx57-intelligence]').value = settings.intelligence;
    modelButton.textContent = `${settings.model} · ${settings.intelligence} ▾`;
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

  function renderSystem() {
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
  }

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
      ? `${attachments.length} attachment(s) selected • this build sends metadata only.`
      : `${PRODUCT} ready.`;
  };

  const ask = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    closeMenus();
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
    const recent = history.slice(-10);
    if (recent.length) recent.forEach(turn => addMessage(turn.text, turn.role, false));
    else addMessage(`Assalam-o-Alaikum. I am ${PRODUCT}. Chat ya Work choose karke apna task bhejein.`, 'assistant', false);
  });

  root.querySelectorAll('[data-nx57-mode]').forEach(button => button.addEventListener('click', () => {
    settings.mode = button.dataset.nx57Mode;
    applySettings();
  }));

  root.querySelector('[data-nx57-plus]').addEventListener('click', event => {
    event.stopPropagation();
    const opening = toolsMenu.hidden;
    closeMenus();
    toolsMenu.hidden = !opening;
  });

  modelButton.addEventListener('click', event => {
    event.stopPropagation();
    const opening = modelMenu.hidden;
    closeMenus();
    modelMenu.hidden = !opening;
  });

  root.querySelector('[data-nx57-model]').addEventListener('change', event => { settings.model = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-speed]').addEventListener('change', event => { settings.speed = event.target.value; applySettings(); });
  root.querySelector('[data-nx57-intelligence]').addEventListener('change', event => { settings.intelligence = event.target.value; applySettings(); });

  root.querySelectorAll('[data-nx57-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.nx57Action;
    closeMenus();
    if (action === 'files') picker.click();
    if (action === 'camera') camera.click();
    if (action === 'sidebar') openSide('history');
    if (action === 'system') openSide('system');
    if (action === 'video') {
      openSide('plugins');
      status.textContent = 'Video Studio backend is not configured in this build.';
    }
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
    if (action === 'clear') {
      history = [];
      if (key) saveJson(key, history);
      messages.innerHTML = '';
      lastReply = '';
      addMessage(`New ${PRODUCT} chat started.`, 'assistant', false);
      renderHistory();
      status.textContent = `${PRODUCT} ready.`;
    }
  }));

  picker.addEventListener('change', () => {
    addPickedFiles([...(picker.files || [])]);
    picker.value = '';
  });

  camera.addEventListener('change', () => {
    addPickedFiles([...(camera.files || [])]);
    camera.value = '';
  });

  root.querySelectorAll('[data-nx57-side]').forEach(button => button.addEventListener('click', () => openSide(button.dataset.nx57Side)));
  root.querySelector('[data-nx57-drawer-close]').addEventListener('click', () => { drawer.hidden = true; });
  drawer.addEventListener('click', event => { if (event.target === drawer) drawer.hidden = true; });

  root.querySelector('[data-nx57-search-go]').addEventListener('click', () => renderHistory(search.value));
  search.addEventListener('keydown', event => { if (event.key === 'Enter') renderHistory(search.value); });

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
    if (!event.target.closest('[data-nx57-tools]') && !event.target.closest('[data-nx57-plus]') &&
        !event.target.closest('[data-nx57-model-menu]') && !event.target.closest('[data-nx57-model-button]')) {
      closeMenus();
    }
  });

  applySettings();
  autoSize();
  root.__cleanup = () => {
    try { recognition?.stop?.(); } catch {}
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };
  return root;
}

export const novaSol57Renderers = Object.freeze({ ai: renderNovaSol57 });
