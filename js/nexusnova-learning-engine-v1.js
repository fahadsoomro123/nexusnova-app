/* NexusNova Learning Engine v3
   Genuine no-key learning tools with premium in-app forms instead of browser prompts. */
(() => {
  'use strict';
  if (window.__nxLearningEngineV3) return;
  window.__nxLearningEngineV3 = true;
  window.__nxLearningEngineV2 = true;
  window.__nxLearningEngineV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let uiPromise = null;

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1200);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  function toast(message) {
    if (window.NexusNovaUI) return window.NexusNovaUI.toast(message);
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
      Promise.resolve(handler()).catch(error=>console.error('Learning action:',error));
    });
    return true;
  }

  function outputFor(tabId) {
    const tab = $(tabId);
    if (!tab) return null;
    let out = tab.querySelector('.nx-learning-output');
    if (out) return out;
    out = document.createElement('div');
    out.className = 'card tool-result nx-learning-output nx-premium-result-host';
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
    return {title:data.title || first.title || topic, extract:String(data.extract).trim(), url:data.fullurl || `https://${lang}.wikipedia.org/?curid=${first.pageid}`, lang};
  }

  function topicFromMega() {
    return String($('nxMegaStudy')?.value || '').trim();
  }

  async function requestTopic(title, subtitle, iconName) {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'LEARNING HUB', title, subtitle, icon:iconName, submitText:'Continue',
      fields:[{name:'topic',label:'Topic or Question',icon:'subject',placeholder:'What do you want to learn?',required:true,wide:true}]
    });
    return data?.topic || '';
  }

  async function openLearning() {
    const topic = topicFromMega() || await requestTopic('Explore a Learning Topic','Search a real knowledge source and get a readable study summary inside NexusNova.','subject');
    if (!topic) return;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    const ui = await getUI().catch(()=>null);
    if (ui) out.innerHTML = ui.resultShell({title:'Searching knowledge source',subtitle:topic,icon:'search',bodyHtml:'<div class="nxui-hint" style="font-size:12px">Loading a live learning summary…</div>'});
    else out.textContent = 'Loading live learning summary…';
    try {
      const article = await wikiSearch(topic);
      const short = article.extract.length > 2200 ? article.extract.slice(0,2200).replace(/\s+\S*$/, '') + '…' : article.extract;
      const body = `<div style="line-height:1.68">${esc(short)}</div><button type="button" class="tool-btn primary" data-nx-open-source style="margin-top:14px;width:100%">Open source article</button>`;
      out.innerHTML = ui ? ui.resultShell({title:article.title,subtitle:'Live knowledge summary',icon:'subject',bodyHtml:body,footer:'Source article opens externally.'}) : `<b>${esc(article.title)}</b>${body}`;
      out.querySelector('[data-nx-open-source]')?.addEventListener('click', () => {
        const opener = window.nxOpenExternal;
        if (typeof opener === 'function') opener(article.url);
        else window.open(article.url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      console.warn('NexusNova learning lookup:', error);
      const body = '<div style="color:#ff9aac">Live knowledge lookup unavailable right now. Use Search Web or try another topic.</div>';
      out.innerHTML = ui ? ui.resultShell({title:'Learning source unavailable',subtitle:topic,icon:'search',bodyHtml:body}) : 'Live knowledge lookup unavailable right now. Use Search Web or try another topic.';
    }
  }

  function openWebSearch(query) {
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    if (typeof window.nxOpenExternal === 'function') window.nxOpenExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function solvedPapers() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'REAL PAPER SEARCH',
      title:'Find Solved / Past Papers',
      subtitle:'Choose your board or university and study details. NexusNova will build a real web/PDF search — it will not invent paper files.',
      icon:'university',
      submitText:'Build Paper Search',
      fields:[
        {name:'board',label:'Board / University',icon:'university',placeholder:'e.g. BISE Larkana, University of Sindh',required:true,wide:true,hint:'Use the official board or university name for better results.'},
        {name:'className',label:'Class / Grade / Program',icon:'school',placeholder:'e.g. Grade 10 or B.Ed'},
        {name:'subject',label:'Subject',icon:'subject',placeholder:'e.g. Mathematics'},
        {name:'year',label:'Year (optional)',icon:'calendar',type:'number',placeholder:'e.g. 2025',min:1990,max:2100}
      ]
    });
    if (!data) return;
    const board = data.board || 'Sindh board';
    const query = [board, data.className, data.subject, data.year, 'past paper solved paper PDF'].filter(Boolean).join(' ');
    const eduQuery = `site:edu.pk ${query}`;
    const pdfQuery = `${query} filetype:pdf`;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    const body = `<div style="display:grid;gap:9px"><div style="padding:12px;border-radius:14px;background:rgba(17,74,135,.16);border:1px solid rgba(93,167,255,.18)"><b>${esc(board)}</b><div style="margin-top:5px;color:#9db6d0;font-size:12px">${esc([data.className,data.subject,data.year].filter(Boolean).join(' • ') || 'General paper search')}</div></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px"><button type="button" class="tool-btn primary" data-paper="edu">Education Sites</button><button type="button" class="tool-btn" data-paper="pdf">PDF Files</button><button type="button" class="tool-btn" data-paper="web">Full Web</button></div></div>`;
    out.innerHTML = ui.resultShell({title:'Real Solved / Past Paper Search',subtitle:'Search prepared from your study details',icon:'university',bodyHtml:body,footer:'Results come from real websites. NexusNova does not invent paper files.'});
    out.querySelector('[data-paper="edu"]')?.addEventListener('click', () => openWebSearch(eduQuery));
    out.querySelector('[data-paper="pdf"]')?.addEventListener('click', () => openWebSearch(pdfQuery));
    out.querySelector('[data-paper="web"]')?.addEventListener('click', () => openWebSearch(query));
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
    const topic = topicFromMega() || await requestTopic('Build a Study Quiz','NexusNova will use a live knowledge summary and create a quick fill-in study quiz.','quiz');
    if (!topic) return;
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    const ui = await getUI().catch(()=>null);
    if (ui) out.innerHTML = ui.resultShell({title:'Building Study Quiz',subtitle:topic,icon:'quiz',bodyHtml:'<div class="nxui-hint" style="font-size:12px">Reading a live knowledge source…</div>'});
    else out.textContent = 'Building quiz from a live knowledge source…';
    try {
      const article = await wikiSearch(topic);
      const sentences = article.extract.replace(/\s+/g, ' ').split(/(?<=[.!?۔؟])\s+/).map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 260);
      const questions = [];
      for (const sentence of sentences) {
        const q = hideWord(sentence);
        if (q && !questions.some(x => x.answer.toLowerCase() === q.answer.toLowerCase())) questions.push(q);
        if (questions.length >= 5) break;
      }
      if (!questions.length) throw new Error('Not enough quiz material.');
      const body = questions.map((q,i) => `<div style="margin-top:${i?14:0}px;padding:12px;border-radius:14px;background:rgba(7,25,47,.72);border:1px solid rgba(95,168,255,.15)"><b>${i+1}.</b> ${esc(q.question)}<br><button type="button" class="tool-btn" data-answer="${i}" style="margin-top:8px">Show answer</button><span data-answer-text="${i}" style="display:none;margin-left:8px;font-weight:800;color:#7dccff">${esc(q.answer)}</span></div>`).join('');
      out.innerHTML = ui ? ui.resultShell({title:`${article.title} — Quick Study Quiz`,subtitle:'5 live-source practice questions',icon:'quiz',bodyHtml:body}) : `<b>${esc(article.title)} — Quick Study Quiz</b>${body}`;
      out.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
        const answer = out.querySelector(`[data-answer-text="${button.dataset.answer}"]`);
        if (answer) answer.style.display = answer.style.display === 'none' ? 'inline' : 'none';
      }));
    } catch (error) {
      console.warn('NexusNova quiz:', error);
      const body = '<div style="color:#ff9aac">Could not build a live-source quiz for that topic. Try another topic.</div>';
      out.innerHTML = ui ? ui.resultShell({title:'Quiz unavailable',subtitle:topic,icon:'quiz',bodyHtml:body}) : 'Could not build a live-source quiz for that topic. Try another topic.';
    }
  }

  async function studyPlanner() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'STUDY PLANNER',
      title:'Plan Your Study Days',
      subtitle:'Add subjects, exam date and daily study time. NexusNova will build a simple rotating schedule.',
      icon:'calendar',
      submitText:'Create Study Plan',
      fields:[
        {name:'subjectsRaw',label:'Subjects',icon:'subject',placeholder:'English, Math, Science',required:true,wide:true,hint:'Separate multiple subjects with commas.'},
        {name:'examRaw',label:'Exam Date',icon:'calendar',type:'date',required:true},
        {name:'minutes',label:'Minutes per Day',icon:'duration',type:'number',value:'90',min:20,max:480,required:true}
      ]
    });
    if (!data) return;
    const subjects = data.subjectsRaw.split(',').map(x => x.trim()).filter(Boolean).slice(0,12);
    if (!subjects.length) return toast('Add at least one subject.');
    const exam = new Date(data.examRaw + 'T00:00:00');
    if (!Number.isFinite(exam.getTime())) return toast('Choose a valid exam date.');
    const today = new Date();
    today.setHours(0,0,0,0);
    const days = Math.ceil((exam - today) / 86400000);
    if (days <= 0) return toast('Choose a future exam date.');
    const minutes = Math.max(20, Math.min(480, Number(data.minutes) || 90));
    const shown = Math.min(days, 30);
    const rows = Array.from({length:shown}, (_,i) => {
      const date = new Date(today.getTime() + i * 86400000);
      const subject = subjects[i % subjects.length];
      const secondary = subjects.length > 1 ? subjects[(i + 1) % subjects.length] : '';
      const mainMinutes = secondary ? Math.round(minutes * 0.7) : minutes;
      const secondMinutes = secondary ? minutes - mainMinutes : 0;
      return `<div style="display:flex;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(120,170,225,.12)"><div style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(39,126,255,.14);color:#70bdff">${ui.icon('calendar')}</div><div><b>${esc(date.toLocaleDateString())}</b><div style="color:#9ab3ce;font-size:11px;margin-top:3px">${esc(subject)} — ${mainMinutes} min${secondary ? ` • ${esc(secondary)} — ${secondMinutes} min` : ''}</div></div></div>`;
    }).join('');
    const out = outputFor($('tab-mega-learning') ? 'tab-mega-learning' : 'tab-learn');
    if (!out) return;
    out.innerHTML = ui.resultShell({title:`Study Plan • ${days} day(s) until exam`,subtitle:`${subjects.length} subject(s) • ${minutes} min/day`,icon:'calendar',bodyHtml:rows + (days > shown ? `<div class="nxui-hint" style="margin-top:10px">First ${shown} days shown. Continue the same subject rotation after that.</div>` : '')});
    try { localStorage.setItem('nexusnova_study_plan_v1', JSON.stringify({subjects, exam:data.examRaw, minutes, createdAt:Date.now()})); } catch (_) {}
  }

  function loadLateModule() {
    if (!document.getElementById('tab-mega-islamic')) return;
    if (document.querySelector('script[data-nx-islamic-extras]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-islamic-extras-v1.js?v=1';
    script.setAttribute('data-nx-islamic-extras', '1');
    script.onerror = () => console.warn('NexusNova Islamic extras failed to load.');
    document.body.appendChild(script);
  }

  function install() {
    claim('tab-mega-learning', '📖 Solved Papers', 'nxLearningSolvedPapers', solvedPapers);
    claim('tab-mega-learning', '📝 Quiz', 'nxLearningQuiz', learningQuiz);
    claim('tab-mega-learning', '📅 Study Planner', 'nxLearningPlanner', studyPlanner);
    claim('tab-learn', 'Open Learning', 'nxLearnOpenKnowledge', openLearning);
    claim('tab-learn', 'Open Papers', 'nxLearnOpenPapers', solvedPapers);
    loadLateModule();
  }

  window.nxLearningKnowledge = openLearning;
  window.nxLearningSolvedPapers = solvedPapers;
  window.nxLearningQuiz = learningQuiz;
  window.nxLearningPlanner = studyPlanner;

  const boot = () => { getUI().catch(()=>{}); setTimeout(install, 900); [1800,3500,7000].forEach(ms => setTimeout(install, ms)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();