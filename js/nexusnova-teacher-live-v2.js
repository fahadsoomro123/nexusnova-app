/* NexusNova Teacher Toolkit Live v2
   AI-generated lesson plans, quizzes and worksheets using the existing Firebase AI project.
   Attendance and grade calculations remain local/device tools. */
(() => {
  'use strict';
  if (window.__nxTeacherLiveV2) return;
  window.__nxTeacherLiveV2 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let model = null;

  function output() {
    let el = $('nxTeacherLiveOut');
    const tab = $('tab-mega-teacher');
    if (!tab) return null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxTeacherLiveOut';
      el.className = 'card tool-result';
      el.style.marginTop = '12px';
      tab.appendChild(el);
    }
    return el;
  }

  async function getModel() {
    if (model) return model;
    const [{getApps}, aiLib] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js')
    ]);
    const apps = getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const ai = aiLib.getAI(apps[0], {backend:new aiLib.GoogleAIBackend()});
    model = aiLib.getGenerativeModel(ai, {
      model:'gemini-3.6-flash',
      systemInstruction:{parts:[{text:'You are the NexusNova Teacher Toolkit. Create practical classroom material. Match the teacher’s language. Do not invent official syllabus facts, exam papers, marks, citations, or answer keys when the prompt does not provide enough information. Clearly label generated practice material as generated.'}]},
      generationConfig:{temperature:0.45,maxOutputTokens:1800}
    });
    return model;
  }

  async function generate(promptText, title) {
    const el = output();
    if (!el) return;
    el.innerHTML = `<b>${esc(title)}</b><div class="nxmega-muted" style="margin-top:7px">Generating with NexusNova AI…</div>`;
    try {
      const m = await getModel();
      const result = await m.generateContent(promptText);
      const text = String(result?.response?.text?.() || '').trim();
      if (!text) throw new Error('AI returned an empty result.');
      el.innerHTML = `<b>${esc(title)}</b><div style="white-space:pre-wrap;line-height:1.55;margin-top:9px">${esc(text)}</div><div class="nxmega-muted" style="margin-top:10px">Generated classroom material — review before use.</div>`;
    } catch (error) {
      console.error('Teacher Toolkit AI:', error);
      el.innerHTML = `<b>${esc(title)}</b><div style="color:#f87171;margin-top:8px">${esc(error?.message || 'AI generation is unavailable right now.')}</div>`;
    }
  }

  function lessonPlanner() {
    const subject = (prompt('Subject:') || '').trim();
    if (!subject) return;
    const topic = (prompt('Topic / lesson title:') || '').trim();
    if (!topic) return;
    const grade = (prompt('Class / Grade:') || '').trim() || 'Not specified';
    const minutes = Math.max(20,Math.min(120,Number(prompt('Lesson duration in minutes:','40'))||40));
    const language = (prompt('Teaching language: English, Urdu, Sindhi or Roman Urdu','English') || 'English').trim();
    generate(`Create a complete ${minutes}-minute lesson plan.\nSubject: ${subject}\nTopic: ${topic}\nClass/Grade: ${grade}\nTeaching language: ${language}\nInclude learning objectives, prior knowledge, warm-up, teacher explanation, examples, student activity, differentiation for weaker/stronger students, formative assessment, recap and homework. Keep it realistic for a government-school classroom with limited resources.`, `${subject} — ${topic} Lesson Plan`);
  }

  function quizMaker() {
    const topic = (prompt('Quiz topic:') || '').trim();
    if (!topic) return;
    const grade = (prompt('Class / Grade:') || '').trim() || 'Not specified';
    const count = Math.max(3,Math.min(30,Number(prompt('Number of questions:','10'))||10));
    const style = (prompt('Question style: MCQ, short answer, mixed','mixed') || 'mixed').trim();
    generate(`Create GENERATED PRACTICE quiz material, not an official exam paper.\nTopic: ${topic}\nClass/Grade: ${grade}\nQuestions: ${count}\nStyle: ${style}\nInclude a clearly separated answer key with brief explanations. Avoid trick questions and avoid claiming the questions came from an official board unless source text was provided.`, `${topic} — Practice Quiz`);
  }

  function worksheetMaker() {
    const subject = (prompt('Subject:') || '').trim();
    if (!subject) return;
    const topic = (prompt('Worksheet topic:') || '').trim();
    if (!topic) return;
    const grade = (prompt('Class / Grade:') || '').trim() || 'Not specified';
    generate(`Create a printable classroom worksheet.\nSubject: ${subject}\nTopic: ${topic}\nClass/Grade: ${grade}\nInclude student name/date lines, a short concept recap, 3 easy questions, 4 medium questions, 2 application questions, and a teacher answer key at the end. This must be labelled generated practice material, not an official solved paper.`, `${subject} — ${topic} Worksheet`);
  }

  function replaceButton(label,id,handler) {
    const old = Array.from(document.querySelectorAll('#tab-mega-teacher button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === label.toLowerCase()
    );
    if (!old || old.dataset.nxTeacherAi === '1') return;
    const button = old.cloneNode(true);
    button.id = id;
    button.dataset.nxTeacherAi = '1';
    old.replaceWith(button);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();handler();});
  }

  function install() {
    if (!$('tab-mega-teacher')) return;
    replaceButton('Lesson Planner','nxTeacherLessonAI',lessonPlanner);
    replaceButton('Quiz Maker','nxTeacherQuizAI',quizMaker);
    replaceButton('Worksheet Maker','nxTeacherWorksheetAI',worksheetMaker);
  }

  const boot=()=>{install();[1000,2200,4500,8000].forEach(ms=>setTimeout(install,ms));};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();