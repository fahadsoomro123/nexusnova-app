/* NexusNova Teacher Toolkit Live v3
   AI-generated lesson plans, quizzes and worksheets using the existing Firebase AI project.
   Uses NexusNova Premium UI instead of browser prompt dialogs. */
(() => {
  'use strict';
  if (window.__nxTeacherLiveV3) return;
  window.__nxTeacherLiveV3 = true;
  window.__nxTeacherLiveV2 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let model = null;
  let uiPromise = null;

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done, 1200);
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

  function output() {
    let el = $('nxTeacherLiveOut');
    const tab = $('tab-mega-teacher');
    if (!tab) return null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxTeacherLiveOut';
      el.className = 'card tool-result nx-premium-result-host';
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

  async function generate(promptText, title, iconName) {
    const el = output();
    if (!el) return;
    const ui = await getUI().catch(() => null);
    if (ui) {
      el.innerHTML = ui.resultShell({title, subtitle:'NexusNova AI Teacher Toolkit', icon:iconName, bodyHtml:'<div class="nxui-hint" style="font-size:12px">Generating classroom material…</div>'});
    } else {
      el.innerHTML = `<b>${esc(title)}</b><div class="nxmega-muted" style="margin-top:7px">Generating with NexusNova AI…</div>`;
    }
    try {
      const m = await getModel();
      const result = await m.generateContent(promptText);
      const text = String(result?.response?.text?.() || '').trim();
      if (!text) throw new Error('AI returned an empty result.');
      const body = `<div style="white-space:pre-wrap;line-height:1.68">${esc(text)}</div>`;
      if (ui) el.innerHTML = ui.resultShell({title, subtitle:'Generated classroom material', icon:iconName, bodyHtml:body, footer:'Review before classroom use.'});
      else el.innerHTML = `<b>${esc(title)}</b>${body}<div class="nxmega-muted" style="margin-top:10px">Generated classroom material — review before use.</div>`;
    } catch (error) {
      console.error('Teacher Toolkit AI:', error);
      const msg = esc(error?.message || 'AI generation is unavailable right now.');
      if (ui) el.innerHTML = ui.resultShell({title:'Could not generate material', subtitle:title, icon:'teacher', bodyHtml:`<div style="color:#ff9aac">${msg}</div>`});
      else el.innerHTML = `<b>${esc(title)}</b><div style="color:#f87171;margin-top:8px">${msg}</div>`;
    }
  }

  async function lessonPlanner() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT',
      title:'Build a Lesson Plan',
      subtitle:'Tell NexusNova what you are teaching. The lesson will be generated for your class with practical classroom steps.',
      icon:'lesson',
      submitText:'Generate Lesson Plan',
      fields:[
        {name:'subject',label:'Subject',icon:'subject',placeholder:'e.g. English, Science, Sindhi',required:true},
        {name:'topic',label:'Lesson Topic',icon:'lesson',placeholder:'e.g. Photosynthesis',required:true},
        {name:'grade',label:'Class / Grade',icon:'school',placeholder:'e.g. Grade 5',required:true},
        {name:'minutes',label:'Lesson Duration',icon:'duration',type:'number',value:'40',min:20,max:120,step:5,required:true,hint:'20–120 minutes'},
        {name:'language',label:'Teaching Language',icon:'language',type:'select',value:'English',options:['English','Urdu','Sindhi','Roman Urdu'],wide:true}
      ]
    });
    if (!data) return;
    const minutes = Math.max(20,Math.min(120,Number(data.minutes)||40));
    generate(`Create a complete ${minutes}-minute lesson plan.\nSubject: ${data.subject}\nTopic: ${data.topic}\nClass/Grade: ${data.grade}\nTeaching language: ${data.language}\nInclude learning objectives, prior knowledge, warm-up, teacher explanation, examples, student activity, differentiation for weaker/stronger students, formative assessment, recap and homework. Keep it realistic for a government-school classroom with limited resources.`, `${data.subject} — ${data.topic} Lesson Plan`, 'lesson');
  }

  async function quizMaker() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT',
      title:'Create a Practice Quiz',
      subtitle:'Choose the topic, class and question style. NexusNova will generate a classroom-ready practice quiz with an answer key.',
      icon:'quiz',
      submitText:'Generate Quiz',
      fields:[
        {name:'topic',label:'Quiz Topic',icon:'quiz',placeholder:'e.g. Fractions, Parts of Speech',required:true,wide:true},
        {name:'grade',label:'Class / Grade',icon:'school',placeholder:'e.g. Grade 6',required:true},
        {name:'count',label:'Questions',icon:'number',type:'number',value:'10',min:3,max:30,required:true},
        {name:'style',label:'Question Style',icon:'questions',type:'select',value:'Mixed',options:['Mixed','MCQ','Short answer'],wide:true}
      ]
    });
    if (!data) return;
    const count = Math.max(3,Math.min(30,Number(data.count)||10));
    generate(`Create GENERATED PRACTICE quiz material, not an official exam paper.\nTopic: ${data.topic}\nClass/Grade: ${data.grade}\nQuestions: ${count}\nStyle: ${data.style}\nInclude a clearly separated answer key with brief explanations. Avoid trick questions and avoid claiming the questions came from an official board unless source text was provided.`, `${data.topic} — Practice Quiz`, 'quiz');
  }

  async function worksheetMaker() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT',
      title:'Make a Student Worksheet',
      subtitle:'Create a printable worksheet with an attractive classroom structure and teacher answer key.',
      icon:'worksheet',
      submitText:'Generate Worksheet',
      fields:[
        {name:'subject',label:'Subject',icon:'subject',placeholder:'e.g. Mathematics',required:true},
        {name:'grade',label:'Class / Grade',icon:'school',placeholder:'e.g. Grade 4',required:true},
        {name:'topic',label:'Worksheet Topic',icon:'worksheet',placeholder:'e.g. Multiplication tables',required:true,wide:true}
      ]
    });
    if (!data) return;
    generate(`Create a printable classroom worksheet.\nSubject: ${data.subject}\nTopic: ${data.topic}\nClass/Grade: ${data.grade}\nInclude student name/date lines, a short concept recap, 3 easy questions, 4 medium questions, 2 application questions, and a teacher answer key at the end. This must be labelled generated practice material, not an official solved paper.`, `${data.subject} — ${data.topic} Worksheet`, 'worksheet');
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
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(handler()).catch(error=>console.error('Teacher Toolkit action:',error));
    });
  }

  function install() {
    if (!$('tab-mega-teacher')) return;
    replaceButton('Lesson Planner','nxTeacherLessonAI',lessonPlanner);
    replaceButton('Quiz Maker','nxTeacherQuizAI',quizMaker);
    replaceButton('Worksheet Maker','nxTeacherWorksheetAI',worksheetMaker);
  }

  const boot=()=>{getUI().catch(()=>{});install();[1000,2200,4500,8000].forEach(ms=>setTimeout(install,ms));};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();