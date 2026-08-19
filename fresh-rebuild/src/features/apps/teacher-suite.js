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

export function renderTeacherSuite() {
  const root = node(`
    <section class="nx-tool-card">
      <strong>Lesson Plan</strong>
      <div class="nx-two-col">
        <label class="nx-field"><span>Subject</span><input maxlength="80" data-teach-subject placeholder="Science"></label>
        <label class="nx-field"><span>Class</span><input maxlength="40" data-teach-class placeholder="Grade 6"></label>
      </div>
      <label class="nx-field"><span>Topic</span><input maxlength="140" data-teach-topic placeholder="Photosynthesis"></label>
      <label class="nx-field"><span>Extra notes</span><textarea rows="3" maxlength="700" data-teach-notes placeholder="Optional teaching notes"></textarea></label>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-teach-generate>GENERATE OUTLINE</button>
        <button type="button" data-teach-save>SAVE PLAN</button>
      </div>
      <article class="nx-list-card" data-teach-outline hidden><strong>Generated outline</strong><p></p></article>
      <p class="nx-tool-meta" data-teach-status>Outline generator is deterministic and does not invent curriculum facts.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Quiz Generator</strong>
      <div class="nx-two-col">
        <label class="nx-field"><span>Topic</span><input maxlength="140" data-quiz-topic placeholder="Fractions"></label>
        <label class="nx-field"><span>Questions</span><input type="number" min="1" max="30" step="1" value="10" data-quiz-count></label>
      </div>
      <button class="nx-primary" type="button" data-quiz-generate>GENERATE QUIZ</button>
      <article class="nx-list-card" data-quiz-result hidden><strong>Quiz</strong><p></p></article>
    </section>

    <section class="nx-tool-card">
      <strong>Grade Calculator</strong>
      <div class="nx-two-col">
        <label class="nx-field"><span>Marks obtained</span><input type="number" min="0" step="0.01" data-grade-marks></label>
        <label class="nx-field"><span>Total marks</span><input type="number" min="0.01" step="0.01" data-grade-total></label>
      </div>
      <button class="nx-primary" type="button" data-grade-calc>CALCULATE GRADE</button>
      <div class="nx-result" data-grade-result>—</div>
    </section>

    <section class="nx-tool-card">
      <strong>Timetable</strong>
      <label class="nx-field"><span>Weekly timetable / notes</span><textarea rows="7" maxlength="4000" data-timetable placeholder="Monday: 8:00 Math&#10;Monday: 9:00 English"></textarea></label>
      <button class="nx-primary" type="button" data-timetable-save>SAVE TIMETABLE</button>
      <p class="nx-tool-meta" data-timetable-status>Saved on this device for the signed-in NexusNova account.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Saved Lesson Plans</strong>
      <div class="nx-stack" data-teach-list></div>
    </section>
  `);

  const subject = root.querySelector('[data-teach-subject]');
  const className = root.querySelector('[data-teach-class]');
  const topic = root.querySelector('[data-teach-topic]');
  const notes = root.querySelector('[data-teach-notes]');
  const outline = root.querySelector('[data-teach-outline]');
  const teachStatus = root.querySelector('[data-teach-status]');
  const list = root.querySelector('[data-teach-list]');
  const timetable = root.querySelector('[data-timetable]');
  const timetableStatus = root.querySelector('[data-timetable-status]');
  let plansKey = '';
  let timetableKey = '';
  let generated = '';

  const makeOutline = () => {
    const cleanTopic = topic.value.trim() || 'Lesson';
    const cleanClass = className.value.trim();
    const extra = notes.value.trim();
    const lines = [
      `Topic: ${cleanTopic}${cleanClass ? ` • ${cleanClass}` : ''}`,
      '1. Objective: define what students should understand or be able to do.',
      '2. Introduction: connect the topic to prior knowledge or a familiar example.',
      '3. Explanation: teach the main idea in clear steps.',
      '4. Guided practice: solve or discuss examples with the class.',
      '5. Assessment: check understanding with short questions or a task.',
      '6. Homework / follow-up: give a focused practice activity.'
    ];
    if (extra) lines.push(`Teacher notes: ${extra}`);
    generated = lines.join('\n');
    outline.querySelector('p').textContent = generated;
    outline.hidden = false;
    teachStatus.textContent = 'Lesson outline generated.';
  };

  const drawPlans = () => {
    if (!plansKey) return;
    const plans = loadJson(plansKey, []);
    list.innerHTML = plans.length ? plans.slice().reverse().map(plan => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(plan.subject || 'Lesson')} • ${escapeHtml(plan.className || 'Class')}</strong><button class="nx-icon-button" type="button" data-plan-delete="${escapeHtml(plan.id)}">×</button></div>
        <p><b>${escapeHtml(plan.topic || 'Topic')}</b><br>${escapeHtml(plan.objective || plan.outline || '').replace(/\n/g, '<br>')}${plan.notes ? `<br>${escapeHtml(plan.notes).replace(/\n/g, '<br>')}` : ''}</p>
        <small>${new Date(plan.at || Date.now()).toLocaleString()}</small>
      </article>
    `).join('') : '<div class="nx-empty">No lesson plans saved.</div>';
    list.querySelectorAll('[data-plan-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(plansKey, loadJson(plansKey, []).filter(plan => plan.id !== button.dataset.planDelete));
      drawPlans();
    }));
  };

  Promise.all([scopedKey('teacher_v1'), scopedKey('timetable_v1')]).then(([pKey, tKey]) => {
    plansKey = pKey;
    timetableKey = tKey;
    drawPlans();
    const freshValue = loadJson(timetableKey, '');
    if (typeof freshValue === 'string' && freshValue) {
      timetable.value = freshValue;
      return;
    }
    const oldValue = loadJson('nexus_timetable', '');
    if (typeof oldValue === 'string' && oldValue) {
      timetable.value = oldValue;
      saveJson(timetableKey, oldValue);
      timetableStatus.textContent = 'Previous timetable migrated to the fresh account-scoped store.';
    }
  });

  root.querySelector('[data-teach-generate]').addEventListener('click', makeOutline);
  root.querySelector('[data-teach-save]').addEventListener('click', () => {
    if (!plansKey) return;
    if (!topic.value.trim() && !generated) {
      teachStatus.textContent = 'Enter a lesson topic first.';
      return;
    }
    if (!generated) makeOutline();
    const plans = loadJson(plansKey, []);
    plans.push({
      id: uid('lesson'),
      subject: subject.value.trim() || 'General',
      className: className.value.trim() || 'Class',
      topic: topic.value.trim() || 'Lesson',
      objective: generated,
      notes: notes.value.trim(),
      at: new Date().toISOString()
    });
    saveJson(plansKey, plans.slice(-300));
    teachStatus.textContent = 'Lesson plan saved.';
    drawPlans();
  });

  const quizTopic = root.querySelector('[data-quiz-topic]');
  const quizCount = root.querySelector('[data-quiz-count]');
  const quizResult = root.querySelector('[data-quiz-result]');
  root.querySelector('[data-quiz-generate]').addEventListener('click', () => {
    const cleanTopic = quizTopic.value.trim() || 'General Knowledge';
    const count = Math.max(1, Math.min(30, Number(quizCount.value) || 10));
    const questions = Array.from({ length: count }, (_, index) => `${index + 1}. Explain or answer one key concept from ${cleanTopic}.`);
    quizResult.querySelector('p').textContent = questions.join('\n');
    quizResult.hidden = false;
  });

  const marks = root.querySelector('[data-grade-marks]');
  const total = root.querySelector('[data-grade-total]');
  const gradeResult = root.querySelector('[data-grade-result]');
  root.querySelector('[data-grade-calc]').addEventListener('click', () => {
    const m = Number(marks.value);
    const t = Number(total.value);
    if (!Number.isFinite(m) || !Number.isFinite(t) || t <= 0) {
      gradeResult.textContent = 'Enter valid marks and total.';
      return;
    }
    const percentage = Math.max(0, Math.min(100, m / t * 100));
    const grade = percentage >= 80 ? 'A+' : percentage >= 70 ? 'A' : percentage >= 60 ? 'B' : percentage >= 50 ? 'C' : percentage >= 40 ? 'D' : 'F';
    gradeResult.textContent = `${percentage.toFixed(1)}% • Grade ${grade}`;
  });

  root.querySelector('[data-timetable-save]').addEventListener('click', () => {
    if (!timetableKey) return;
    saveJson(timetableKey, timetable.value || '');
    timetableStatus.textContent = 'Timetable saved on this device for this NexusNova account.';
  });

  return root;
}

export const teacherSuiteRenderers = Object.freeze({
  teacher: renderTeacherSuite
});
