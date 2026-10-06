const ACTIVE_HTML_CLASS = 'nx-notes-v1-active';
const SCREEN_CLASS = 'nx-notes-v1-screen';

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalThemeColor = themeMeta?.content || '#07111f';
const originalColorScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

function applyNotesTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxNotesTheme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f5f7fb' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreThemeMeta() {
  delete document.documentElement.dataset.nxNotesTheme;
  if (themeMeta) themeMeta.content = originalThemeColor;
  if (schemeMeta) schemeMeta.content = originalColorScheme;
}

function notesScreenFromStage() {
  const notesRoot = stage?.querySelector('.nx-notes-pro');
  if (!notesRoot) return null;
  const screen = notesRoot.closest('.nx-screen');
  if (!screen) return null;
  return { screen, notesRoot };
}

function enhanceNotes(screen) {
  if (screen.dataset.notesV1Enhanced === '1') return () => {};

  screen.dataset.notesV1Enhanced = '1';
  screen.classList.add(SCREEN_CLASS);
  document.documentElement.classList.add(ACTIVE_HTML_CLASS);
  document.body.classList.add(ACTIVE_HTML_CLASS);
  activeScreen = screen;
  applyNotesTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-notes-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);

  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const themeListener = () => applyNotesTheme();
  lightQuery?.addEventListener?.('change', themeListener);

  return () => {
    lightQuery?.removeEventListener?.('change', themeListener);
    back.remove();
    screen.classList.remove(SCREEN_CLASS);
    delete screen.dataset.notesV1Enhanced;
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    activeScreen = null;
    restoreThemeMeta();
  };
}

function syncNotesEnhancement() {
  const found = notesScreenFromStage();
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
    activeCleanup = enhanceNotes(found.screen);
  } catch (error) {
    console.error('[NexusNova Notes] full-screen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    restoreThemeMeta();
    activeScreen = null;
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(syncNotesEnhancement));
  observer.observe(stage, { childList:true, subtree:true });
  syncNotesEnhancement();
}
