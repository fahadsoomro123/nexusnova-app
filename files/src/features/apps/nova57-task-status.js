// NOVA 5.7 Sol — renderer-owned truthful activity controller.
// Only real lifecycle/tool events may change the visible activity label.
// It never exposes or reconstructs private chain-of-thought.

const ACTIVITY_EVENT = 'nova57:activity';
const SAFE_STAGES = new Set([
  'Thinking',
  'Searching web',
  'Checking GitHub',
  'Reading files',
  'Verifying',
  'Working',
  'Finalizing'
]);

function safeStage(value) {
  const stage = String(value || '').trim();
  return SAFE_STAGES.has(stage) ? stage : 'Working';
}

export function createTaskStatus(messagesRoot) {
  if (!messagesRoot) throw new Error('Task status requires the NOVA messages container.');

  const row = document.createElement('div');
  row.className = 'nx57-task-status';
  row.hidden = true;
  row.setAttribute('role', 'status');
  row.setAttribute('aria-live', 'polite');
  row.innerHTML = '<span class="nx57-task-status__pulse" aria-hidden="true"></span><span class="nx57-task-status__label">Thinking</span>';
  messagesRoot.appendChild(row);

  const label = row.querySelector('.nx57-task-status__label');
  let active = false;

  const scrollIntoView = () => {
    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch { messagesRoot.scrollTop = messagesRoot.scrollHeight; }
  };

  function setStage(next) {
    if (!active) return;
    label.textContent = safeStage(next);
    scrollIntoView();
  }

  function onActivity(event) {
    if (!active) return;
    const stage = event?.detail?.stage;
    if (stage) setStage(stage);
  }

  try { window.addEventListener(ACTIVITY_EVENT, onActivity); } catch {}

  function start() {
    active = true;
    row.hidden = false;
    label.textContent = 'Thinking';
    scrollIntoView();
  }

  function finish() {
    active = false;
    row.hidden = true;
  }

  function fail() {
    finish();
  }

  function destroy() {
    active = false;
    try { window.removeEventListener(ACTIVITY_EVENT, onActivity); } catch {}
    row.remove();
  }

  return Object.freeze({ row, start, setStage, finish, fail, destroy });
}
