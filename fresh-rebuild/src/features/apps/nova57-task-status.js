// NOVA 5.7 Sol — renderer-owned task status controller.
// Shows concise activity states only. It never exposes private chain-of-thought.

const DEFAULT_STAGES = ['Thinking', 'Working', 'Finalizing'];

export function taskStagesForRequest(text = '') {
  const value = String(text || '').toLowerCase();
  if (/github|repo|repository|commit|branch|pull request|\bpr\b/.test(value)) {
    return ['Thinking', 'Checking GitHub', 'Verifying', 'Finalizing'];
  }
  if (/research|search|latest|current|today|news|trend|web|internet/.test(value)) {
    return ['Thinking', 'Searching web', 'Checking sources', 'Finalizing'];
  }
  if (/file|pdf|document|image|photo|attachment/.test(value)) {
    return ['Thinking', 'Reading files', 'Verifying', 'Finalizing'];
  }
  if (/code|bug|fix|website|build|deploy|workflow/.test(value)) {
    return ['Thinking', 'Working', 'Verifying', 'Finalizing'];
  }
  return DEFAULT_STAGES;
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
  let timer = 0;
  let stages = DEFAULT_STAGES;
  let index = 0;

  const scrollIntoView = () => {
    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch { messagesRoot.scrollTop = messagesRoot.scrollHeight; }
  };

  function setStage(next) {
    label.textContent = String(next || 'Thinking');
    scrollIntoView();
  }

  function start(requestText) {
    stopTimer();
    stages = taskStagesForRequest(requestText);
    index = 0;
    row.hidden = false;
    setStage(stages[index]);
    timer = window.setInterval(() => {
      if (index >= stages.length - 1) return;
      index += 1;
      setStage(stages[index]);
    }, 2200);
  }

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = 0;
  }

  function finish() {
    stopTimer();
    row.hidden = true;
  }

  function fail() {
    stopTimer();
    row.hidden = true;
  }

  function destroy() {
    stopTimer();
    row.remove();
  }

  return Object.freeze({ row, start, setStage, finish, fail, destroy });
}
