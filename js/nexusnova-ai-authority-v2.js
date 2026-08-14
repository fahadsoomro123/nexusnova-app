/* NexusNova AI Authority v2
   Late authoritative AI layer:
   - deterministic NVX/mining/profile/wallet answers from live app state
   - account-scoped persistent memory
   - app navigation commands
   - female-first browser speech output
   - Gemini fallback for general questions and image analysis
*/
(() => {
  'use strict';
  if (window.__nxAIAuthorityV2) return;
  window.__nxAIAuthorityV2 = true;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
    authDomain: 'nexusnova-6ade2.firebaseapp.com',
    projectId: 'nexusnova-6ade2',
    storageBucket: 'nexusnova-6ade2.firebasestorage.app',
    messagingSenderId: '49791194817',
    appId: '1:49791194817:web:07f28326e0f15979536640'
  };

  const $ = id => document.getElementById(id);
  let model = null;
  let busy = false;
  let chosenVoice = null;

  function accountId() {
    const direct = String(window.nexusAccountId || '').trim();
    if (direct) return direct.slice(0,160);
    const uid = String($('profileUserId')?.textContent || '').trim();
    if (uid && !/loading|---|unavailable/i.test(uid)) return uid.slice(0,160);
    const email = String($('profileEmail')?.textContent || '').trim().toLowerCase();
    if (email && email.includes('@')) return email.slice(0,160);
    return 'guest';
  }

  const memoryKey = () => `nexusnova_ai_memory_v2:${accountId()}`;
  const notesKey = () => `nexusnova_ai_notes_v2:${accountId()}`;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function memory() {
    const rows = readJson(memoryKey(), []);
    return Array.isArray(rows) ? rows.filter(x => x && (x.role === 'user' || x.role === 'model') && typeof x.text === 'string').slice(-30) : [];
  }

  function saveTurn(role, text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const rows = memory();
    rows.push({role, text:clean.slice(0,5000), at:Date.now()});
    writeJson(memoryKey(), rows.slice(-30));
  }

  function notes() {
    const rows = readJson(notesKey(), []);
    return Array.isArray(rows) ? rows.filter(x => typeof x === 'string').slice(-20) : [];
  }

  function rememberNote(text) {
    const clean = String(text || '').replace(/^\s+|\s+$/g, '').slice(0,500);
    if (!clean) return false;
    const rows = notes();
    if (!rows.some(x => x.toLowerCase() === clean.toLowerCase())) rows.push(clean);
    writeJson(notesKey(), rows.slice(-20));
    return true;
  }

  function setStatus(text, ok = true) {
    for (const id of ['aiConnectionText','aiStatus','aiVoiceStatus']) {
      const el = $(id);
      if (!el) continue;
      if (id === 'aiVoiceStatus' && !/voice|speaking|listening/i.test(text)) continue;
      el.textContent = text;
      if (id !== 'aiVoiceStatus') el.style.color = ok ? 'var(--success,#22c55e)' : 'var(--danger,#ef4444)';
    }
  }

  function addMessage(text, type = 'ai') {
    const box = $('aiBox');
    if (!box) return;
    const wrap = document.createElement('div');
    wrap.className = 'ai-message' + (type === 'user' ? ' user' : '');
    wrap.dataset.nxAuthority = '2';
    const label = document.createElement('div');
    label.className = 'ai-label';
    label.textContent = type === 'user' ? 'You' : 'NexusNova AI';
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.textContent = String(text || '');
    wrap.append(label, bubble);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function parseNumber(text) {
    const match = String(text || '').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function appState() {
    const balanceText = String($('balance')?.textContent || '').trim();
    const balance = parseNumber(balanceText);
    const timer = String($('timer')?.textContent || '').trim();
    const mineButton = String($('btnText')?.textContent || '').trim();
    const profileName = String($('profileName')?.textContent || $('profileDisplayName')?.textContent || '').trim();
    const profileEmail = String($('profileEmail')?.textContent || '').trim();
    const referral = String($('refCodeDisplay')?.textContent || '').trim();
    const walletAddress = String(window.nexusConnectedAddress || window.ethereum?.selectedAddress || '').trim();
    const network = String(window.__nexusOnchainNetwork || $('connectedWalletNetwork')?.textContent || '').trim();
    const cache = window.__nexusOnchainVisibleBalances || {};
    const onchain = Object.entries(cache)
      .filter(([,value]) => Number.isFinite(Number(value)))
      .map(([symbol,value]) => `${symbol}=${Number(value).toLocaleString(undefined,{maximumFractionDigits:8})}`);
    const totalUsd = String($('walletTotalUsd')?.textContent || '').trim();
    const activeTab = document.querySelector('.tab.active')?.id || '';
    return {
      balance,
      balanceText,
      timer,
      mineButton,
      profileName,
      profileEmail,
      referral,
      walletAddress,
      network,
      onchain,
      totalUsd,
      activeTab
    };
  }

  function stateText() {
    const s = appState();
    return [
      `NVX visible balance: ${Number.isFinite(s.balance) ? s.balance : 'unavailable'} NVX`,
      `Mining button: ${s.mineButton || 'unavailable'}`,
      `Mining timer/status: ${s.timer || 'unavailable'}`,
      `Profile name: ${s.profileName || 'unavailable'}`,
      `Profile email: ${s.profileEmail || 'unavailable'}`,
      `Referral: ${s.referral || 'unavailable'}`,
      `External wallet: ${s.walletAddress ? `${s.walletAddress.slice(0,6)}...${s.walletAddress.slice(-4)}` : 'not connected'}`,
      `Wallet network: ${s.network || 'unknown'}`,
      `On-chain balances: ${s.onchain.length ? s.onchain.join(', ') : 'not read'}`,
      `Portfolio: ${s.totalUsd || 'unavailable'}`,
      `Active app section: ${s.activeTab || 'unknown'}`
    ].join('\n');
  }

  function balanceIntent(text) {
    const t = String(text || '').toLowerCase();
    return /(nvx|nexusnova|token|coin|balance|balanc|amount)/i.test(t) &&
      /(mera|mere|meri|my|kitna|kitne|bata|show|what|how much|balance|amount)/i.test(t);
  }

  function walletIntent(text) {
    const t = String(text || '').toLowerCase();
    return /(wallet|eth|ethereum|bnb|matic|polygon|usdt|usdc)/i.test(t) &&
      /(balance|amount|kitna|kitne|mera|mere|my|show|bata|how much)/i.test(t);
  }

  function miningIntent(text) {
    const t = String(text || '').toLowerCase();
    return /(mining|miner|mine)/i.test(t) && /(status|chal|active|remaining|timer|kitna|bata|show|mera|my)/i.test(t);
  }

  function profileIntent(text) {
    const t = String(text || '').toLowerCase();
    return /(profile|naam|name|email|account|who am i|main kaun)/i.test(t) && /(mera|meri|my|show|bata|what|who)/i.test(t);
  }

  function rememberIntent(text) {
    const raw = String(text || '').trim();
    const match = raw.match(/^(?:yaad\s+rakh(?:o|na)?|remember(?:\s+that)?)[,:\s-]+(.+)/i);
    return match?.[1]?.trim() || '';
  }

  function recallIntent(text) {
    return /(kya.*yaad|what.*remember|what do you know about me|mere bare.*yaad|meri baat.*yaad)/i.test(String(text || ''));
  }

  const routes = [
    {rx:/(?:open|khol|kholo).*wallet|wallet.*(?:open|khol)/i, tab:'wallet', label:'Wallet'},
    {rx:/(?:open|khol|kholo).*news|news.*(?:open|khol)/i, tab:'news', label:'News'},
    {rx:/(?:open|khol|kholo).*market|market.*(?:open|khol)/i, tab:'market', label:'Market'},
    {rx:/(?:open|khol|kholo).*profile|profile.*(?:open|khol)/i, tab:'profile', label:'Profile'},
    {rx:/(?:open|khol|kholo).*(?:setting|settings)|settings.*(?:open|khol)/i, tab:'about', label:'Settings'},
    {rx:/(?:open|khol|kholo).*(?:all apps|apps)/i, tab:'__allapps', label:'All Apps'},
    {rx:/(?:open|khol|kholo).*learning|learning.*(?:open|khol)/i, tab:'mega-learning', label:'Learning'},
    {rx:/(?:open|khol|kholo).*teacher|teacher.*(?:open|khol)/i, tab:'mega-teacher', label:'Teacher Toolkit'}
  ];

  function routeCommand(text) {
    const route = routes.find(item => item.rx.test(String(text || '')));
    if (!route) return '';
    if (route.tab === '__allapps') {
      window.nexusBackToAllApps?.();
      document.getElementById('moreBtn')?.click();
    } else if (typeof window.openMoreTab === 'function') {
      window.openMoreTab(route.tab);
    } else {
      window.switchTab?.(route.tab, null);
    }
    return `${route.label} khol diya.`;
  }

  function deterministic(text) {
    const note = rememberIntent(text);
    if (note) {
      rememberNote(note);
      return `Theek hai, maine yaad rakh liya: ${note}`;
    }

    if (recallIntent(text)) {
      const saved = notes();
      const recentUsers = memory().filter(x => x.role === 'user').slice(-5).map(x => x.text);
      if (!saved.length && !recentUsers.length) return 'Abhi is account ke liye koi saved memory nahi hai.';
      const parts = [];
      if (saved.length) parts.push('Saved baatein:\n' + saved.map((x,i) => `${i+1}. ${x}`).join('\n'));
      if (recentUsers.length) parts.push('Recent baatein:\n' + recentUsers.map((x,i) => `${i+1}. ${x}`).join('\n'));
      return parts.join('\n\n');
    }

    const routeReply = routeCommand(text);
    if (routeReply) return routeReply;

    const s = appState();
    if (balanceIntent(text) && !walletIntent(text)) {
      if (Number.isFinite(s.balance)) return `Aapka current NexusNova balance ${s.balance.toLocaleString(undefined,{maximumFractionDigits:4})} NVX hai.`;
      return 'NVX balance abhi app se read nahi ho raha. Main fake balance nahi bataunga.';
    }

    if (walletIntent(text)) {
      if (!s.walletAddress) return 'External wallet abhi connected nahi hai.';
      if (!s.onchain.length) return 'Wallet connected hai, lekin real on-chain balances abhi read nahi hue. Wallet Refresh karo.';
      return `Connected wallet ${s.walletAddress.slice(0,6)}...${s.walletAddress.slice(-4)}\nNetwork: ${s.network || 'EVM'}\n${s.onchain.join('\n')}`;
    }

    if (miningIntent(text)) {
      return `Mining status: ${s.mineButton || 'unknown'}\nTimer/status: ${s.timer || 'unavailable'}\nVisible NVX balance: ${Number.isFinite(s.balance) ? s.balance.toLocaleString(undefined,{maximumFractionDigits:4}) : 'unavailable'}`;
    }

    if (profileIntent(text)) {
      const rows = [];
      if (s.profileName) rows.push(`Name: ${s.profileName}`);
      if (s.profileEmail) rows.push(`Email: ${s.profileEmail}`);
      if (s.referral && !/loading|unavailable|---/i.test(s.referral)) rows.push(`Referral: ${s.referral}`);
      return rows.length ? rows.join('\n') : 'Profile data abhi screen par available nahi hai.';
    }

    return '';
  }

  function detectLanguage(text) {
    if (/[\u0600-\u06FF]/.test(String(text || ''))) return 'ur-PK';
    return 'en-US';
  }

  const FEMALE_HINTS = /(jenny|aria|sonia|zira|samantha|karen|ava|susan|victoria|female|woman|natasha|serena|hazel)/i;
  const MALE_HINTS = /(guy|ryan|david|mark|daniel|alex|male|man)/i;

  function chooseFemaleVoice(lang) {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;
    const wantedUrdu = /^ur/i.test(lang);
    const score = voice => {
      const name = String(voice.name || '');
      const voiceLang = String(voice.lang || '');
      let value = 0;
      if (FEMALE_HINTS.test(name)) value += 100;
      if (MALE_HINTS.test(name)) value -= 80;
      if (/natural|neural|online|premium|enhanced/i.test(name)) value += 45;
      if (wantedUrdu && /^ur/i.test(voiceLang)) value += 60;
      if (!wantedUrdu && /^en/i.test(voiceLang)) value += 35;
      if (/en-US|en-GB|ur-PK/i.test(voiceLang)) value += 12;
      return value;
    };
    return [...voices].sort((a,b) => score(b) - score(a))[0] || voices[0];
  }

  function speak(text) {
    const settings = readJson('nexusnova_settings', {});
    if (settings.aiVoice === false || !('speechSynthesis' in window)) return false;
    const clean = String(text || '').replace(/```[\s\S]*?```/g,' ').replace(/[*_#`]/g,' ').replace(/\s+/g,' ').trim();
    if (!clean) return false;
    const lang = detectLanguage(clean);
    const synth = window.speechSynthesis;
    synth.cancel();
    chosenVoice = chooseFemaleVoice(lang) || chosenVoice;
    const utterance = new SpeechSynthesisUtterance(clean.slice(0,3500));
    utterance.lang = lang;
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.rate = 0.92;
    utterance.pitch = 1.04;
    utterance.volume = 1;
    const status = $('aiVoiceStatus');
    utterance.onstart = () => { if (status) status.textContent = `🔊 Speaking${chosenVoice?.name ? ` • ${chosenVoice.name}` : ''}`; };
    utterance.onend = () => { if (status) status.textContent = 'Voice ready'; };
    utterance.onerror = () => { if (status) status.textContent = 'Voice unavailable in this browser'; };
    try { synth.speak(utterance); return true; } catch (_) { return false; }
  }

  async function initModel() {
    if (model) return model;
    const [{initializeApp,getApps},{getAI,getGenerativeModel,GoogleAIBackend}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js')
    ]);
    const name = 'nexusnova-ai-authority-v2';
    const app = getApps().find(item => item.name === name) || initializeApp(FIREBASE_CONFIG, name);
    const ai = getAI(app, {backend:new GoogleAIBackend()});
    model = getGenerativeModel(ai, {
      model:'gemini-3.6-flash',
      systemInstruction:{parts:[{text:
        'You are NexusNova AI, the built-in assistant inside the NexusNova super app. '+
        'Be concise, practical and friendly. Match the user language; Roman Urdu should stay Roman Urdu. '+
        'You receive live read-only app state and account-scoped remembered notes in every request. '+
        'Use supplied NexusNova state for app questions and never invent balances, mining status, transactions, prices, profile data, caller identity, tickets, rewards or provider data. '+
        'When a feature requires an API/provider/backend, say so clearly. Never request seed phrases, private keys, passwords or secret credentials.'
      }]},
      generationConfig:{temperature:0.5,maxOutputTokens:900}
    });
    return model;
  }

  function firebaseHistory() {
    return memory().slice(-16).map(row => ({
      role: row.role,
      parts:[{text:row.text.slice(0,4000)}]
    }));
  }

  async function imagePart(file) {
    const data = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(new Error('Image could not be read.'));
      reader.readAsDataURL(file);
    });
    return {inlineData:{data,mimeType:file.type || 'image/jpeg'}};
  }

  async function askGemini(text, image) {
    const m = await initModel();
    const savedNotes = notes();
    const prompt =
      `NexusNova LIVE APP STATE (read-only):\n${stateText()}\n\n`+
      `REMEMBERED USER NOTES:\n${savedNotes.length ? savedNotes.map((x,i)=>`${i+1}. ${x}`).join('\n') : 'none'}\n\n`+
      `USER REQUEST:\n${text || 'Analyze the attached image.'}`;
    const chat = m.startChat({history:firebaseHistory()});
    const content = image ? [prompt, await imagePart(image)] : prompt;
    const result = await chat.sendMessage(content);
    return String(result?.response?.text?.() || '').trim();
  }

  async function sendAIMessage() {
    const input = $('aiInput');
    const button = $('aiSendBtn');
    if (!input || !button || busy) return;
    const text = String(input.value || '').trim();
    const image = $('aiImageInput')?.files?.[0] || null;
    if (!text && !image) return;

    busy = true;
    button.disabled = true;
    const oldLabel = button.textContent;
    button.textContent = '...';
    if (text) addMessage(text,'user');
    input.value = '';

    try {
      const direct = text && !image ? deterministic(text) : '';
      if (direct) {
        saveTurn('user', text);
        saveTurn('model', direct);
        addMessage(direct,'ai');
        speak(direct);
        setStatus('NexusNova AI Core V2 ready', true);
        return;
      }

      const reply = await askGemini(text, image);
      const finalReply = reply || 'AI ne empty response diya. Dobara try karo.';
      if (text) saveTurn('user', text);
      saveTurn('model', finalReply);
      addMessage(finalReply,'ai');
      speak(finalReply);
      window.clearAIImage?.();
      setStatus('NexusNova AI Core V2 ready', true);
    } catch (error) {
      console.error('NexusNova AI Authority:', error);
      const raw = String(error?.message || error || '');
      const msg = /app.?check|403|permission|forbidden/i.test(raw)
        ? 'AI request Firebase App Check ki wajah se block hui. App Check web setup/deployment verify karna hoga.'
        : 'AI service abhi response nahi de rahi. App ka balance/profile data change nahi hua.';
      addMessage(msg,'ai');
      setStatus('AI request failed', false);
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = oldLabel || 'Ask';
    }
  }

  window.nexusAISpeakV2 = speak;
  window.nexusAIGetMemoryV2 = () => ({notes:notes(), history:memory()});
  window.nexusAIClearMemoryV2 = () => {
    try { localStorage.removeItem(memoryKey()); localStorage.removeItem(notesKey()); } catch (_) {}
  };

  window.clearNexusAIData = function() {
    if (!confirm('Clear NexusNova AI memory saved locally for this account/device?')) return;
    const keys = ['nexusnova_ai_history','nexusnova_ai_chat','nexusnova_chat_history',memoryKey(),notesKey()];
    keys.forEach(key => { try { localStorage.removeItem(key); } catch (_) {} });
    addMessage('Local AI memory clear kar di gayi.','ai');
  };

  function installAuthority() {
    window.sendAIMessage = sendAIMessage;
    setStatus('NexusNova AI Core V2 ready', true);
    const input = $('aiInput');
    if (input && !input.dataset.nxAuthorityEnter) {
      input.dataset.nxAuthorityEnter = '1';
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendAIMessage();
        }
      });
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => { chosenVoice = null; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(installAuthority,1800), {once:true});
  else setTimeout(installAuthority,1800);
  [2600,5000,9000].forEach(ms => setTimeout(installAuthority,ms));
  document.addEventListener('click', event => {
    const btn = event.target?.closest?.('.more-item,.dock-item,button');
    if (btn && /\bai\b|assistant/i.test(String(btn.textContent || ''))) setTimeout(installAuthority,100);
  }, true);
})();