import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function scopedKey(name) {
  try {
    const user = await requireFirebaseUser();
    return `nexus_fresh_${name}_${user.uid}`;
  } catch {
    return `nexus_fresh_${name}_device`;
  }
}

function wikiLanguage(text) {
  return /[\u0600-\u06ff]/.test(String(text || '')) ? 'ur' : 'en';
}

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function wikiSearch(topic) {
  const lang = wikiLanguage(topic);
  const endpoint = `https://${lang}.wikipedia.org/w/api.php`;
  const search = await fetchJson(`${endpoint}?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(topic)}`);
  const first = search?.query?.search?.[0];
  if (!first?.pageid) throw new Error('No matching learning article found.');
  const page = await fetchJson(`${endpoint}?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*&pageids=${encodeURIComponent(first.pageid)}`);
  const data = page?.query?.pages?.[first.pageid];
  if (!data?.extract) throw new Error('Learning article has no readable summary.');
  return {
    title: data.title || first.title || topic,
    extract: String(data.extract).trim(),
    url: data.fullurl || `https://${lang}.wikipedia.org/?curid=${first.pageid}`
  };
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (!/^https:$/.test(parsed.protocol)) return false;
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url: parsed.href })) return true;
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function hideWord(sentence) {
  const words = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const candidates = words.filter(word => word.length >= 6 && !/^https?$/i.test(word));
  if (!candidates.length) return null;
  const answer = [...candidates].sort((a, b) => b.length - a.length)[0];
  const index = sentence.indexOf(answer);
  if (index < 0) return null;
  return { question: `${sentence.slice(0, index)}________${sentence.slice(index + answer.length)}`, answer };
}

export function renderLearningSuite() {
  const root = node(`
    <section class="nx-tool-card">
      <strong>Live Learning</strong>
      <label class="nx-field"><span>Topic or question</span><input maxlength="220" data-learn-topic placeholder="What do you want to learn?"></label>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-learn-summary>LIVE SUMMARY</button>
        <button type="button" data-learn-quiz>BUILD QUIZ</button>
      </div>
      <p class="nx-tool-meta" data-learn-status>Summaries and quizzes use a live Wikipedia knowledge source. NexusNova does not invent paper files or source articles.</p>
      <article class="nx-list-card" data-learn-output hidden></article>
    </section>

    <section class="nx-tool-card">
      <strong>Solved / Past Papers</strong>
      <label class="nx-field"><span>Board / University</span><input maxlength="120" data-paper-board placeholder="BISE Larkana, University of Sindh…"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Class / Program</span><input maxlength="80" data-paper-class placeholder="Grade 10 or B.Ed"></label>
        <label class="nx-field"><span>Subject</span><input maxlength="100" data-paper-subject placeholder="Mathematics"></label>
      </div>
      <label class="nx-field"><span>Year (optional)</span><input type="number" min="1990" max="2100" data-paper-year placeholder="2025"></label>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-paper-edu>EDUCATION SITES</button>
        <button type="button" data-paper-pdf>PDF SEARCH</button>
      </div>
      <button type="button" data-paper-web>FULL WEB SEARCH</button>
      <p class="nx-tool-meta" data-paper-status>Search details are turned into real web queries; no solved paper is fabricated inside NexusNova.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Study Planner</strong>
      <label class="nx-field"><span>Subjects</span><input maxlength="300" data-plan-subjects placeholder="English, Math, Science"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Exam date</span><input type="date" data-plan-exam></label>
        <label class="nx-field"><span>Minutes/day</span><input type="number" min="20" max="480" value="90" data-plan-minutes></label>
      </div>
      <button class="nx-primary" type="button" data-plan-build>CREATE STUDY PLAN</button>
      <div class="nx-stack" data-plan-list></div>
    </section>

    <section class="nx-tool-card">
      <strong>Flashcards</strong>
      <div class="nx-two-col">
        <label class="nx-field"><span>Question / term</span><input maxlength="220" data-card-q></label>
        <label class="nx-field"><span>Answer</span><input maxlength="500" data-card-a></label>
      </div>
      <button class="nx-primary" type="button" data-card-add>ADD FLASHCARD</button>
    </section>
    <section class="nx-stack" data-card-list></section>
  `);

  const topic = root.querySelector('[data-learn-topic]');
  const output = root.querySelector('[data-learn-output]');
  const learnStatus = root.querySelector('[data-learn-status]');

  const setBusy = (button, busy, normal) => {
    button.disabled = busy;
    button.textContent = busy ? 'LOADING…' : normal;
  };

  const summaryButton = root.querySelector('[data-learn-summary]');
  summaryButton.addEventListener('click', async () => {
    const value = topic.value.trim();
    if (!value) { learnStatus.textContent = 'Enter a topic first.'; return; }
    setBusy(summaryButton, true, 'LIVE SUMMARY');
    output.hidden = true;
    learnStatus.textContent = 'Loading a live knowledge summary…';
    try {
      const article = await wikiSearch(value);
      const short = article.extract.length > 2200 ? `${article.extract.slice(0, 2200).replace(/\s+\S*$/, '')}…` : article.extract;
      output.innerHTML = `<strong>${escapeHtml(article.title)}</strong><p>${escapeHtml(short)}</p><button type="button" data-open-source>OPEN SOURCE ARTICLE</button>`;
      output.hidden = false;
      output.querySelector('[data-open-source]').addEventListener('click', () => openExternal(article.url));
      learnStatus.textContent = 'Live source summary ready.';
    } catch (error) {
      learnStatus.textContent = `Live knowledge lookup unavailable: ${error.message || 'request failed'}`;
    } finally {
      setBusy(summaryButton, false, 'LIVE SUMMARY');
    }
  });

  const quizButton = root.querySelector('[data-learn-quiz]');
  quizButton.addEventListener('click', async () => {
    const value = topic.value.trim();
    if (!value) { learnStatus.textContent = 'Enter a topic first.'; return; }
    setBusy(quizButton, true, 'BUILD QUIZ');
    output.hidden = true;
    learnStatus.textContent = 'Reading a live knowledge source for quiz material…';
    try {
      const article = await wikiSearch(value);
      const sentences = article.extract.replace(/\s+/g, ' ').split(/(?<=[.!?۔؟])\s+/).map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 260);
      const questions = [];
      for (const sentence of sentences) {
        const q = hideWord(sentence);
        if (q && !questions.some(item => item.answer.toLowerCase() === q.answer.toLowerCase())) questions.push(q);
        if (questions.length >= 5) break;
      }
      if (!questions.length) throw new Error('Not enough quiz material.');
      output.innerHTML = `<strong>${escapeHtml(article.title)} • Quick Quiz</strong><div class="nx-stack" style="margin-top:10px">${questions.map((q, i) => `<article class="nx-list-card"><p><b>${i + 1}.</b> ${escapeHtml(q.question)}</p><button type="button" data-answer="${i}">SHOW ANSWER</button><strong data-answer-text="${i}" hidden>${escapeHtml(q.answer)}</strong></article>`).join('')}</div>`;
      output.hidden = false;
      output.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
        const answer = output.querySelector(`[data-answer-text="${button.dataset.answer}"]`);
        answer.hidden = !answer.hidden;
        button.textContent = answer.hidden ? 'SHOW ANSWER' : 'HIDE ANSWER';
      }));
      learnStatus.textContent = '5 live-source practice questions ready.';
    } catch (error) {
      learnStatus.textContent = `Could not build a live-source quiz: ${error.message || 'request failed'}`;
    } finally {
      setBusy(quizButton, false, 'BUILD QUIZ');
    }
  });

  const paperBoard = root.querySelector('[data-paper-board]');
  const paperClass = root.querySelector('[data-paper-class]');
  const paperSubject = root.querySelector('[data-paper-subject]');
  const paperYear = root.querySelector('[data-paper-year]');
  const paperStatus = root.querySelector('[data-paper-status]');
  const paperQuery = prefix => {
    const board = paperBoard.value.trim();
    if (!board) { paperStatus.textContent = 'Enter a board or university first.'; return ''; }
    const parts = [board, paperClass.value.trim(), paperSubject.value.trim(), paperYear.value.trim(), 'past paper solved paper PDF'].filter(Boolean);
    return `${prefix || ''}${parts.join(' ')}`.trim();
  };
  root.querySelector('[data-paper-edu]').addEventListener('click', () => {
    const q = paperQuery('site:edu.pk '); if (q) openExternal(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  });
  root.querySelector('[data-paper-pdf]').addEventListener('click', () => {
    const q = paperQuery(''); if (q) openExternal(`https://www.google.com/search?q=${encodeURIComponent(`${q} filetype:pdf`)}`);
  });
  root.querySelector('[data-paper-web]').addEventListener('click', () => {
    const q = paperQuery(''); if (q) openExternal(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  });

  const planSubjects = root.querySelector('[data-plan-subjects]');
  const planExam = root.querySelector('[data-plan-exam]');
  const planMinutes = root.querySelector('[data-plan-minutes]');
  const planList = root.querySelector('[data-plan-list]');
  let plannerKey = '';
  scopedKey('study_plan_v1').then(key => {
    plannerKey = key;
    const saved = loadJson(key, []);
    if (Array.isArray(saved) && saved.length) {
      planList.innerHTML = saved.map(row => `<article class="nx-list-card"><strong>${escapeHtml(row.date)} • ${escapeHtml(row.subject)}</strong><p>${escapeHtml(row.detail)}</p></article>`).join('');
    }
  });
  root.querySelector('[data-plan-build]').addEventListener('click', () => {
    const subjects = planSubjects.value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 12);
    const exam = new Date(`${planExam.value}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.ceil((exam - today) / 86_400_000);
    if (!subjects.length || !Number.isFinite(exam.getTime()) || days <= 0) {
      planList.innerHTML = '<div class="nx-empty">Enter subjects and choose a future exam date.</div>';
      return;
    }
    const minutes = Math.max(20, Math.min(480, Number(planMinutes.value) || 90));
    const shown = Math.min(days, 30);
    const rows = Array.from({ length: shown }, (_, i) => {
      const date = new Date(today.getTime() + i * 86_400_000);
      const main = subjects[i % subjects.length];
      const secondary = subjects.length > 1 ? subjects[(i + 1) % subjects.length] : '';
      const mainMinutes = secondary ? Math.round(minutes * .7) : minutes;
      const secondMinutes = secondary ? minutes - mainMinutes : 0;
      return {
        date: date.toLocaleDateString(),
        subject: main,
        detail: secondary ? `${mainMinutes} min ${main} • ${secondMinutes} min ${secondary}` : `${minutes} min ${main}`
      };
    });
    planList.innerHTML = rows.map(row => `<article class="nx-list-card"><strong>${escapeHtml(row.date)} • ${escapeHtml(row.subject)}</strong><p>${escapeHtml(row.detail)}</p></article>`).join('');
    if (plannerKey) saveJson(plannerKey, rows);
  });

  const q = root.querySelector('[data-card-q]');
  const a = root.querySelector('[data-card-a]');
  const cardList = root.querySelector('[data-card-list]');
  let cardsKey = '';
  const drawCards = () => {
    if (!cardsKey) return;
    const cards = loadJson(cardsKey, []);
    cardList.innerHTML = cards.length ? cards.map(card => `<article class="nx-flash-card" data-card-id="${escapeHtml(card.id)}"><strong>${escapeHtml(card.q)}</strong><p hidden>${escapeHtml(card.a)}</p><span>Tap to reveal</span><button class="nx-icon-button" type="button" data-card-delete="${escapeHtml(card.id)}">×</button></article>`).join('') : '<div class="nx-empty">No flashcards yet.</div>';
    cardList.querySelectorAll('.nx-flash-card').forEach(card => card.addEventListener('click', event => {
      if (event.target.closest('[data-card-delete]')) return;
      const p = card.querySelector('p'); const hint = card.querySelector('span');
      p.hidden = !p.hidden; hint.textContent = p.hidden ? 'Tap to reveal' : 'Tap to hide';
    }));
    cardList.querySelectorAll('[data-card-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(cardsKey, loadJson(cardsKey, []).filter(card => card.id !== button.dataset.cardDelete));
      drawCards();
    }));
  };
  scopedKey('flashcards_v1').then(key => { cardsKey = key; drawCards(); });
  root.querySelector('[data-card-add]').addEventListener('click', () => {
    if (!cardsKey || !q.value.trim() || !a.value.trim()) return;
    const cards = loadJson(cardsKey, []);
    cards.push({ id: uid('card'), q: q.value.trim(), a: a.value.trim() });
    saveJson(cardsKey, cards.slice(-500));
    q.value = ''; a.value = ''; drawCards();
  });

  return root;
}

export const learningSuiteRenderers = Object.freeze({
  learning: renderLearningSuite
});
