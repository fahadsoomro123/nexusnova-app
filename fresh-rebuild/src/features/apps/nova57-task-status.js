// NOVA 5.7 Sol — renderer-owned task status controller.
// Shows concise activity states only. It never exposes private chain-of-thought.
// Status changes are tied to the requested operation / real request lifecycle;
// there is no fake timed progression through invented stages.

function workStageForRequest(text = '') {
  const value = String(text || '').toLowerCase();
  if (/github|repo|repository|commit|branch|pull request|\bpr\b/.test(value)) return 'Checking GitHub';
  if (/research|search|latest|current|today|news|trend|web|internet/.test(value)) return 'Searching web';
  if (/file|pdf|document|image|photo|attachment/.test(value)) return 'Reading files';
  if (/code|bug|fix|website|build|deploy|workflow/.test(value)) return 'Working';
  return 'Thinking';
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
  let frame = 0;
  let active = false;

  const scrollIntoView = () => {
    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch { messagesRoot.scrollTop = messagesRoot.scrollHeight; }
  };

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function setStage(next) {
    if (!active) return;
    label.textContent = String(next || 'Thinking');
    scrollIntoView();
  }

  function start(requestText) {
    cancelFrame();
    active = true;
    row.hidden = false;
    label.textContent = 'Thinking';
    scrollIntoView();

    const workStage = workStageForRequest(requestText);
    if (workStage !== 'Thinking') {
      // Allow the initial Thinking state to paint once, then show the actual
      // operation that this request is entering. No periodic/fake cycling.
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (active) setStage(workStage);
      });
    }
  }

  function finish() {
    cancelFrame();
    active = false;
    row.hidden = true;
  }

  function fail() {
    finish();
  }

  function destroy() {
    cancelFrame();
    active = false;
    row.remove();
  }

  return Object.freeze({ row, start, setStage, finish, fail, destroy });
}
