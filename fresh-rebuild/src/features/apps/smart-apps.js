import { firebaseApp, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { loadJson } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function openFreshApp(id) {
  if (typeof window.NexusNovaFresh?.openApp !== 'function') return false;
  window.NexusNovaFresh.openApp(id);
  return true;
}

async function getAccountId() {
  try {
    const user = await requireFirebaseUser();
    return String(user?.uid || '').trim() || 'device';
  } catch {
    return 'device';
  }
}

let modelPromise = null;
async function getSmartModel() {
  if (!modelPromise) {
    modelPromise = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js').then(({ getAI, getGenerativeModel, GoogleAIBackend }) => {
      const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
      return getGenerativeModel(ai, {
        model: 'gemini-3.6-flash',
        systemInstruction: {
          parts: [{
            text: 'You are Nova AI inside NexusNova Smart Hub. Be concise and match the user language. Never invent balances, mining status, weather, news, prices, rewards, schedules, document contents, or provider results. Never ask for passwords, seed phrases or private keys.'
          }]
        },
        generationConfig: { temperature: .45, maxOutputTokens: 1000 }
      });
    }).catch(error => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function fileToInlineData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) return reject(new Error('Invalid file data.'));
      resolve({ mimeType: file.type, data: value.slice(comma + 1) });
    };
    reader.readAsDataURL(file);
  });
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return false;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const female = /female|zira|samantha|victoria|karen|moira|tessa|google uk english female|microsoft.*female/i;
  const voice = [...voices].sort((a, b) => (female.test(b.name) ? 2 : 0) - (female.test(a.name) ? 2 : 0))[0];
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 3500));
  utterance.lang = /[\u0600-\u06ff]/.test(text) ? 'ur-PK' : 'en-US';
  if (voice) utterance.voice = voice;
  utterance.rate = .94;
  utterance.pitch = 1.03;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

async function buildDailyBriefPrompt() {
  const id = await getAccountId();
  const profile = await readUserProfile().catch(() => ({}));
  const now = Date.now();

  const calendar = loadJson(`nexus_fresh_calendar_v1_${id}`, [])
    .filter(item => new Date(item?.at).getTime() >= now)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(0, 5);

  const reminders = loadJson(`nexus_fresh_reminders_v1_${id}`, [])
    .filter(item => !item?.fired && new Date(item?.at).getTime() >= now)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(0, 5);

  const habits = loadJson(`nexus_fresh_habits_v1_${id}`, []).slice(0, 8);
  const expenses = loadJson('nexus_expenses_v1', []);
  const billsRaw = loadJson('nexus_bills_v1', []);
  const month = new Date();
  const monthExpenses = expenses.filter(item => {
    const d = new Date(item?.at);
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });
  const expenseTotal = monthExpenses.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const dueBills = (Array.isArray(billsRaw) ? billsRaw : [])
    .filter(item => item && item.done !== true && /^\d{4}-\d{2}-\d{2}$/.test(String(item.due || '')) && String(item.due) <= today)
    .slice(0, 8);

  const miningStartedAt = Number(profile?.miningStartedAt) || 0;
  const miningLeftMs = profile?.miningActive === true && miningStartedAt
    ? Math.max(0, 86_400_000 - (Date.now() - miningStartedAt))
    : 0;

  const eventText = calendar.length
    ? calendar.map(item => `${item.title || 'Event'} @ ${new Date(item.at).toLocaleString()}`).join('; ')
    : 'none';
  const reminderText = reminders.length
    ? reminders.map(item => `${item.title || 'Reminder'} @ ${new Date(item.at).toLocaleString()}`).join('; ')
    : 'none';
  const habitText = habits.length
    ? habits.map(item => `${item.name || 'Habit'}: ${Array.isArray(item.days) ? item.days.length : 0} recorded check-ins`).join('; ')
    : 'none';
  const billText = dueBills.length
    ? dueBills.map(item => `${String(item.title || 'Bill').slice(0,120)} due ${item.due}${Number(item.amount) > 0 ? ` amount ${Number(item.amount)}` : ''}`).join('; ')
    : 'none due or overdue';
  const balance = Number(profile?.balance);

  return `Build my concise NexusNova daily brief in Roman Urdu. Use only the real app data below. Do not invent missing information.\n` +
    `NVX balance: ${Number.isFinite(balance) ? balance : 'unavailable'}\n` +
    `Mining: ${profile?.miningActive === true ? `active, about ${(miningLeftMs / 3_600_000).toFixed(2)} hours remaining` : 'idle or unavailable'}\n` +
    `Upcoming events: ${eventText}\n` +
    `Upcoming reminders: ${reminderText}\n` +
    `Bills due/overdue: ${billText}\n` +
    `This month logged expenses total: ${expenseTotal}\n` +
    `Habits: ${habitText}\n` +
    `Weather data: not supplied\nNews data: not supplied\n` +
    `Give a short priority list for today. Clearly say weather/news are not included rather than guessing them.`;
}

export function renderSmartHub() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-smart-ai>OPEN NOVA AI</button>
        <button type="button" data-smart-docs>OPEN DOCUMENTS</button>
      </div>
      <p class="nx-tool-meta">Smart Hub connects AI, voice, file understanding and a real-data daily brief without loading the legacy UI.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Camera / Documents AI</strong>
      <p class="nx-tool-meta">Select an image or PDF. The file is sent to the configured Firebase AI provider for analysis only when you press Analyze.</p>
      <input type="file" accept="image/*,application/pdf" data-smart-file>
      <label class="nx-field"><span>What should Nova AI do?</span><input maxlength="500" data-smart-file-prompt value="Explain the important contents of this file. Do not invent anything that is not visible in it."></label>
      <button class="nx-primary" type="button" data-smart-analyze>ANALYZE FILE</button>
      <p class="nx-tool-meta" data-smart-file-status>No file selected.</p>
      <article class="nx-list-card" data-smart-file-result hidden><strong>Nova AI result</strong><p></p></article>
    </section>

    <section class="nx-tool-card">
      <strong>AI Daily Brief</strong>
      <p class="nx-tool-meta">Uses your real NexusNova balance/mining state plus saved events, reminders, bills, expenses and habits. Missing weather/news are never guessed.</p>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-smart-brief>BUILD BRIEF</button>
        <button type="button" data-smart-speak disabled>SPEAK BRIEF</button>
      </div>
      <p class="nx-tool-meta" data-smart-brief-status>Ready.</p>
      <article class="nx-list-card" data-smart-brief-result hidden><strong>Today</strong><p></p></article>
    </section>
  `);

  const fileInput = root.querySelector('[data-smart-file]');
  const filePrompt = root.querySelector('[data-smart-file-prompt]');
  const analyze = root.querySelector('[data-smart-analyze]');
  const fileStatus = root.querySelector('[data-smart-file-status]');
  const fileResult = root.querySelector('[data-smart-file-result]');
  const brief = root.querySelector('[data-smart-brief]');
  const briefStatus = root.querySelector('[data-smart-brief-status]');
  const briefResult = root.querySelector('[data-smart-brief-result]');
  const speakBrief = root.querySelector('[data-smart-speak]');
  let lastBrief = '';

  root.querySelector('[data-smart-ai]').addEventListener('click', () => {
    if (!openFreshApp('ai')) briefStatus.textContent = 'Fresh navigation is not ready.';
  });
  root.querySelector('[data-smart-docs]').addEventListener('click', () => {
    if (!openFreshApp('documents')) briefStatus.textContent = 'Fresh navigation is not ready.';
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileStatus.textContent = file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file selected.';
  });

  analyze.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      fileStatus.textContent = 'Choose an image or PDF first.';
      return;
    }
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      fileStatus.textContent = 'Only images and PDF files are supported here.';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      fileStatus.textContent = 'Choose a file smaller than 8 MB.';
      return;
    }

    analyze.disabled = true;
    analyze.textContent = 'ANALYZING…';
    fileStatus.textContent = 'Reading selected file and contacting Nova AI…';
    fileResult.hidden = true;
    try {
      const [model, inlineData] = await Promise.all([getSmartModel(), fileToInlineData(file)]);
      const result = await model.generateContent([
        { inlineData },
        { text: filePrompt.value.trim() || 'Explain this file accurately. Do not invent missing content.' }
      ]);
      const text = String(result?.response?.text?.() || '').trim() || 'AI returned no text.';
      fileResult.querySelector('p').textContent = text;
      fileResult.hidden = false;
      fileStatus.textContent = 'Analysis complete.';
    } catch (error) {
      fileStatus.textContent = /app.?check|403|permission/i.test(String(error?.message || ''))
        ? 'AI request was blocked by Firebase App Check / provider configuration.'
        : 'AI file analysis is unavailable right now.';
      console.warn('[NexusNova Fresh] Smart file AI:', error);
    } finally {
      analyze.disabled = false;
      analyze.textContent = 'ANALYZE FILE';
    }
  });

  brief.addEventListener('click', async () => {
    brief.disabled = true;
    brief.textContent = 'BUILDING…';
    briefStatus.textContent = 'Reading real NexusNova data…';
    briefResult.hidden = true;
    speakBrief.disabled = true;
    try {
      const [model, prompt] = await Promise.all([getSmartModel(), buildDailyBriefPrompt()]);
      const result = await model.generateContent(prompt);
      lastBrief = String(result?.response?.text?.() || '').trim() || 'AI returned no text.';
      briefResult.querySelector('p').textContent = lastBrief;
      briefResult.hidden = false;
      briefStatus.textContent = 'Daily brief built from available NexusNova data.';
      speakBrief.disabled = !lastBrief;
    } catch (error) {
      lastBrief = '';
      briefStatus.textContent = /app.?check|403|permission/i.test(String(error?.message || ''))
        ? 'Daily brief was blocked by Firebase App Check / provider configuration.'
        : 'Daily brief AI is unavailable right now.';
      console.warn('[NexusNova Fresh] Smart brief:', error);
    } finally {
      brief.disabled = false;
      brief.textContent = 'BUILD BRIEF';
    }
  });

  speakBrief.addEventListener('click', () => {
    if (!speak(lastBrief)) briefStatus.textContent = 'Speech is unavailable on this device.';
  });

  return root;
}

export const smartRenderers = Object.freeze({
  smart: renderSmartHub
});
