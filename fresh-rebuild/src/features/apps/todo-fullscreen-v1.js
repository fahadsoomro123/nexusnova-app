const ACTIVE_HTML_CLASS = 'nx-todo-v1-active';
const SCREEN_CLASS = 'nx-todo-v1-screen';

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalThemeColor = themeMeta?.content || '#07111f';
const originalColorScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

function applyTodoTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxTodoTheme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f5f7fb' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreThemeMeta() {
  delete document.documentElement.dataset.nxTodoTheme;
  if (themeMeta) themeMeta.content = originalThemeColor;
  if (schemeMeta) schemeMeta.content = originalColorScheme;
}

function todoScreenFromStage() {
  const todoRoot = stage?.querySelector('.nx-todo-pro');
  if (!todoRoot) return null;
  const screen = todoRoot.closest('.nx-screen');
  if (!screen) return null;
  return { screen, todoRoot };
}

function enhanceTodo(screen) {
  if (screen.dataset.todoV1Enhanced === '1') return () => {};

  screen.dataset.todoV1Enhanced = '1';
  screen.classList.add(SCREEN_CLASS);
  document.documentElement.classList.add(ACTIVE_HTML_CLASS);
  document.body.classList.add(ACTIVE_HTML_CLASS);
  activeScreen = screen;
  applyTodoTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-todo-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);

  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const themeListener = () => applyTodoTheme();
  lightQuery?.addEventListener?.('change', themeListener);

  return () => {
    lightQuery?.removeEventListener?.('change', themeListener);
    back.remove();
    screen.classList.remove(SCREEN_CLASS);
    delete screen.dataset.todoV1Enhanced;
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    activeScreen = null;
    restoreThemeMeta();
  };
}

function syncTodoEnhancement() {
  const found = todoScreenFromStage();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }

  if (activeScreen === found.screen && activeCleanup) return;

  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }

  try {
    activeCleanup = enhanceTodo(found.screen);
  } catch (error) {
    console.error('[NexusNova To-Do] full-screen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    restoreThemeMeta();
    activeScreen = null;
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(syncTodoEnhancement));
  observer.observe(stage, { childList:true, subtree:true });
  syncTodoEnhancement();
}
