import { firebaseApp } from '../../core/firebase-backend.js';
import { teacherSuiteRenderers } from './teacher-suite.js';

let modelPromise=null;
async function model(){
  if(!modelPromise)modelPromise=import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js').then(aiLib=>{
    const ai=aiLib.getAI(firebaseApp,{backend:new aiLib.GoogleAIBackend()});
    return aiLib.getGenerativeModel(ai,{model:'gemini-3.6-flash',systemInstruction:{parts:[{text:'You are the NexusNova Teacher Toolkit. Create practical classroom material. Match the teacher language. Do not invent official syllabus facts, exam papers, marks, citations, or answer keys when the prompt does not provide enough information. Clearly label generated practice material as generated.'}]},generationConfig:{temperature:.45,maxOutputTokens:1800}});
  }).catch(error=>{modelPromise=null;throw error;});
  return modelPromise;
}
function resultCard(title){const card=document.createElement('article');card.className='nx-list-card';card.innerHTML=`<strong>${title}</strong><p data-ai-teacher-text>Ready.</p>`;return card;}
async function generate(card,prompt){const text=card.querySelector('[data-ai-teacher-text]');text.textContent='Generating classroom material…';try{const m=await model();const response=await m.generateContent(prompt);const out=String(response?.response?.text?.()||'').trim();if(!out)throw new Error('AI returned an empty result.');text.textContent=out;}catch(error){text.textContent=/app.?check|403|permission/i.test(String(error?.message||''))?'AI request was blocked by Firebase App Check / provider configuration.':String(error?.message||'AI generation is unavailable right now.').slice(0,300);}}

export function renderTeacherAISuite(){
  const root=teacherSuiteRenderers.teacher();
  const panel=document.createElement('section');panel.className='nx-tool-card';
  panel.innerHTML=`
    <strong>NexusNova AI Teacher</strong><p class="nx-tool-meta">Real Gemini generation. Review before classroom use. Generated quizzes/worksheets are practice material, not official board papers.</p>
    <div class="nx-two-col"><label class="nx-field"><span>Subject</span><input maxlength="80" data-ai-subject placeholder="Science"></label><label class="nx-field"><span>Class / Grade</span><input maxlength="60" data-ai-grade placeholder="Grade 5"></label></div>
    <label class="nx-field"><span>Topic</span><input maxlength="160" data-ai-topic placeholder="Photosynthesis"></label>
    <div class="nx-two-col"><label class="nx-field"><span>Language</span><select data-ai-language><option>English</option><option>Urdu</option><option>Sindhi</option><option>Roman Urdu</option></select></label><label class="nx-field"><span>Lesson minutes</span><input type="number" min="20" max="120" step="5" value="40" data-ai-minutes></label></div>
    <div class="nx-action-row"><button class="nx-primary" type="button" data-ai-lesson>AI LESSON PLAN</button><button type="button" data-ai-quiz>AI PRACTICE QUIZ</button><button type="button" data-ai-worksheet>AI WORKSHEET</button></div>
    <div class="nx-stack" data-ai-teacher-output></div>`;
  root.prepend(panel);
  const subject=panel.querySelector('[data-ai-subject]'),grade=panel.querySelector('[data-ai-grade]'),topic=panel.querySelector('[data-ai-topic]'),language=panel.querySelector('[data-ai-language]'),minutes=panel.querySelector('[data-ai-minutes]'),output=panel.querySelector('[data-ai-teacher-output]');
  const values=()=>({subject:subject.value.trim(),grade:grade.value.trim(),topic:topic.value.trim(),language:language.value,minutes:Math.max(20,Math.min(120,Number(minutes.value)||40))});
  const run=async(type)=>{
    const v=values();if(!v.subject||!v.grade||!v.topic){output.innerHTML='<div class="nx-empty">Enter subject, class/grade and topic first.</div>';return;}
    const card=resultCard(type==='lesson'?'AI Lesson Plan':type==='quiz'?'AI Practice Quiz':'AI Worksheet');output.prepend(card);
    if(type==='lesson')return generate(card,`Create a complete ${v.minutes}-minute lesson plan.\nSubject: ${v.subject}\nTopic: ${v.topic}\nClass/Grade: ${v.grade}\nTeaching language: ${v.language}\nInclude learning objectives, prior knowledge, warm-up, teacher explanation, examples, student activity, differentiation for weaker/stronger students, formative assessment, recap and homework. Keep it realistic for a government-school classroom with limited resources.`);
    if(type==='quiz')return generate(card,`Create GENERATED PRACTICE quiz material, not an official exam paper.\nSubject: ${v.subject}\nTopic: ${v.topic}\nClass/Grade: ${v.grade}\nLanguage: ${v.language}\nCreate 10 mixed questions and include a clearly separated answer key with brief explanations. Avoid trick questions and do not claim official-board sourcing.`);
    return generate(card,`Create a printable classroom worksheet.\nSubject: ${v.subject}\nTopic: ${v.topic}\nClass/Grade: ${v.grade}\nLanguage: ${v.language}\nInclude student name/date lines, a short concept recap, 3 easy questions, 4 medium questions, 2 application questions, and a teacher answer key. Clearly label it generated practice material, not an official solved paper.`);
  };
  panel.querySelector('[data-ai-lesson]').addEventListener('click',()=>run('lesson'));panel.querySelector('[data-ai-quiz]').addEventListener('click',()=>run('quiz'));panel.querySelector('[data-ai-worksheet]').addEventListener('click',()=>run('worksheet'));
  return root;
}
export const teacherAIRenderers=Object.freeze({teacher:renderTeacherAISuite});
