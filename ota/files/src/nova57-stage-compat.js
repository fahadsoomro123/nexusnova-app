const STAGE_ID = 'nx-stage';
const ACTIVE_CLASS = 'nx57-stage-active';

function syncNovaStage() {
  const stage = document.getElementById(STAGE_ID);
  if (!stage) return;
  const active = Boolean(stage.querySelector('.nx57-shell-premium'));
  stage.classList.toggle(ACTIVE_CLASS, active);
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
}

function installNovaStageCompat() {
  const stage = document.getElementById(STAGE_ID);
  if (!stage) return;
  syncNovaStage();
  const observer = new MutationObserver(syncNovaStage);
  observer.observe(stage, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installNovaStageCompat, { once: true });
} else {
  installNovaStageCompat();
}
