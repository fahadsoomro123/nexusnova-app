/* NexusNova Learning Engine v1
   Genuine no-key learning tools: Wikimedia knowledge lookup, real web paper search,
   live-summary quiz generation, and a local study planner. */
(() => {
  'use strict';
  if (window.__nxLearningEngineV1) return;
  window.__nxLearningEngineV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function toast(message) {
    let el = $('nxLearningToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxLearningToast';
      el.className = 'nxmega-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function findButton(tabId, label) {
    return Array.from(document.querySelectorAll(`#${tabId} button`)).find(button =>
      String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === String(label).toLowerCase()
    );
  }

  function claim(tabId, label, id, handler) {
    const button = findButton(tabId, label);
    if (!button || button.dataset.nxLearningReady === '1') return false;
    button.onclick = null;
    button.id = id;
    button.dataset.nxLearningReady = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return true;
  }

  function outputFor(tabId) {
    const tab = $(tabId);
    if (!tab) return null;
    let out = tab.querySelector('.nx-learning-output');
    if (out) return out;
    out = document.createElement('div');
    out.className = 'card tool-result nx-learning-output';
    out.style.marginTop = '12px';
    tab.appendChild(out);
    return out;
  }

  function wikiLanguage(text) {
    const value = String(text || '');
    if (/[\u0600-\u06FF]/.test(value)) return 'ur';
    return 'en';
  }

  async function fetchJson(url, timeout = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function wikiSearch(topic) {
    const lang = wikiLanguage(topic);
    const endpoint = `https://${lang}.wikipedia.org/w/api.php`;
    const searchUrl = endpoint + '?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=' + encodeURIComponent(topic);
    const search = await fetchJson(searchUrl);
    const first = search?.query?.search?.[0];
    if (!first?.pageid) throw new Error('No matching learning article found.');

    const pageUrl = endpoint + '?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*&pageids=' + encodeURIComponent(first.pageid);
    const page = await fetchJson(pageUrl);
    const data = page?.query?.pages?.[first.pageid];
    if (!data?.extract) throw new Error('Learning article has no readable summary.');
    return {
      title: data.title || first.title || topic,
      extract: String(data.extract).trim(),
      url: data.fullurl || `https://${lang}.wikipedia.org/?curid=${first.pageid}`,
      lang
    };
  }

  function topicFromMega() {
    return String($('nxMegaStudy')?.value || '').trim();
  }

  async function openLearning() {
    const topic = topicFromMega() || prompt('Topic / question to learn:');
    if (!topic) return;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    out.textContent = 'Loading live learning summary…';
    try {
      const article = await wikiSearch(topic);
      const short = article.extract.length > 2200 ? article.extract.slice(0,2200).replace(/\s+\S*$/, '') + '…' : article.extract;
      out.innerHTML = `<b>${esc(article.title)}</b><div style="margin-top:9px;line-height:1.55">${esc(short)}</div>` +
        `<button type="button" class="tool-btn" data-nx-open-source style="margin-top:12px">Open source article</button>`;
      out.querySelector('[data-nx-open-source]')?.addEventListener('click', () => window.open(article.url, '_blank', 'noopener,noreferrer'));
    } catch (error) {
      console.warn('NexusNova learning lookup:', error);
      out.textContent = 'Live knowledge lookup unavailable right now. Use Search Web or try another topic.';
    }
  }

  function solvedPapers() {
    const board = prompt('Board / university (example: BISE Larkana, Sindh Board):') || 'Sindh board';
    const className = prompt('Class / grade:') || '';
    const subject = prompt('Subject:') || '';
    const year = prompt('Year (optional):') || '';
    const query = [board, className, subject, year, 'past paper solved paper PDF'].filter(Boolean).join(' ');
    const eduQuery = `site:edu.pk ${query}`;
    const pdfQuery = `${query} filetype:pdf`;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    out.innerHTML = `<b>Real solved/past paper search</b><div style="margin-top:7px">${esc(query)}</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">` +
      `<button type="button" class="tool-btn primary" data-paper="edu">Search education sites</button>` +
      `<button type="button" class="tool-btn" data-paper="pdf">Search PDFs</button>` +
      `<button type="button" class="tool-btn" data-paper="web">Search web</button></div>` +
      `<div class="nxmega-muted" style="margin-top:9px">Results come from real websites. NexusNova does not invent paper files.</div>`;
    const openSearch = q => window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
    out.querySelector('[data-paper="edu"]')?.addEventListener('click', () => openSearch(eduQuery));
    out.querySelector('[data-paper="pdf"]')?.addEventListener('click', () => openSearch(pdfQuery));
    out.querySelector('[data-paper="web"]')?.addEventListener('click', () => openSearch(query));
  }

  function hideWord(sentence) {
    const words = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
    const candidates = words.filter(word => word.length >= 6 && !/^https?$/i.test(word));
    if (!candidates.length) return null;
    const answer = [...candidates].sort((a,b) => b.length - a.length)[0];
    const index = sentence.indexOf(answer);
    if (index < 0) return null;
    return {question: sentence.slice(0,index) + '________' + sentence.slice(index + answer.length), answer};
  }

  async function learningQuiz() {
    const topic = topicFromMega() || prompt('Quiz topic:');
    if (!topic) return;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    out.textContent = 'Building quiz from a live knowledge source…';
    try {
      const article = await wikiSearch(topic);
      const sentences = article.extract
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?۔؟])\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 45 && s.length <= 260);
      const questions = [];
      for (const sentence of sentences) {
        const q = hideWord(sentence);
        if (q && !questions.some(x => x.answer.toLowerCase() === q.answer.toLowerCase())) questions.push(q);
        if (questions.length >= 5) break;
      }
      if (!questions.length) throw new Error('Not enough quiz material.');
      out.innerHTML = `<b>${esc(article.title)} — Quick Study Quiz</b>` + questions.map((q,i) =>
        `<div style="margin-top:12px"><b>${i+1}.</b> ${esc(q.question)}<br>` +
        `<button type="button" class="tool-btn" data-answer="${i}" style="margin-top:6px">Show answer</button>` +
        `<span data-answer-text="${i}" style="display:none;margin-left:8px;font-weight:700">${esc(q.answer)}</span></div>`
      ).join('');
      out.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
        const answer = out.querySelector(`[data-answer-text="${button.dataset.answer}"]`);
        if (answer) answer.style.display = answer.style.display === 'none' ? 'inline' : 'none';
      }));
    } catch (error) {
      console.warn('NexusNova quiz:', error);
      out.textContent = 'Could not build a live-source quiz for that topic. Try another topic.';
    }
  }

  function studyPlanner() {
    const subjectsRaw = prompt('Subjects separated by commas (example: English, Math, Science):');
    if (!subjectsRaw) return;
    const subjects = subjectsRaw.split(',').map(x => x.trim()).filter(Boolean).slice(0,12);
    if (!subjects.length) return;
    const examRaw = prompt('Exam date (YYYY-MM-DD):');
    if (!examRaw) return;
    const exam = new Date(examRaw + 'T00:00:00');
    if (!Number.isFinite(exam.getTime())) return toast('Invalid exam date.');
    const today = new Date();
    today.setHours(0,0,0,0);
    const days = Math.ceil((exam - today) / 86400000);
    if (days <= 0) return toast('Choose a future exam date.');
    const minutes = Math.max(20, Math.min(480, Number(prompt('Study minutes per day:', '90')) || 90));
    const shown = Math.min(days, 30);
    const rows = Array.from({length:shown}, (_,i) => {
      const date = new Date(today.getTime() + i * 86400000);
      const subject = subjects[i % subjects.length];
      const secondary = subjects.length > 1 ? subjects[(i + 1) % subjects.length] : '';
      const mainMinutes = secondary ? Math.round(minutes * 0.7) : minutes;
      const secondMinutes = secondary ? minutes - mainMinutes : 0;
      return `<div class="nxmega-item"><div><b>${esc(date.toLocaleDateString())}</b><small>${esc(subject)} — ${mainMinutes} min${secondary ? ` • ${esc(secondary)} — ${secondMinutes} min` : ''}</small></div></div>`;
    }).join('');
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    out.innerHTML = `<b>Study Plan • ${days} day(s) until exam</b>${rows}` +
      (days > shown ? `<div class="nxmega-muted" style="margin-top:8px">First ${shown} days shown. Continue the same subject rotation after that.</div>` : '');
    try {
      localStorage.setItem('nexusnova_study_plan_v1', JSON.stringify({subjects, exam:examRaw, minutes, createdAt:Date.now()}));
    } catch (_) {}
  }

  function install() {
    claim('tab-mega-learning', '📖 Solved Papers', 'nxLearningSolvedPapers', solvedPapers);
    claim('tab-mega-learning', '📝 Quiz', 'nxLearningQuiz', learningQuiz);
    claim('tab-mega-learning', '📅 Study Planner', 'nxLearningPlanner', studyPlanner);
    claim('tab-learn', 'Open Learning', 'nxLearnOpenKnowledge', openLearning);
    claim('tab-learn', 'Open Papers', 'nxLearnOpenPapers', solvedPapers);
  }

  window.nxLearningKnowledge = openLearning;
  window.nxLearningSolvedPapers = solvedPapers;
  window.nxLearningQuiz = learningQuiz;
  window.nxLearningPlanner = studyPlanner;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 900), {once:true});
  else setTimeout(install, 900);
  [1800, 3500, 7000].forEach(ms => setTimeout(install, ms));
})();