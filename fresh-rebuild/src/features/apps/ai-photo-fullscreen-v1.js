// AI Photo Studio fullscreen visual activator v1.
// Adds/removes shell classes only; it does not mutate editor controls or logic.

let currentScreen = null;

function deactivate() {
  if (currentScreen) {
    currentScreen.classList.remove('nx-ai-photo-fullscreen-screen');
    delete currentScreen.dataset.aiPhotoFullscreen;
    currentScreen = null;
  }
  document.documentElement.classList.remove('nx-ai-photo-fullscreen-active');
}

function isAiPhotoScreen(screen) {
  if (!screen) return false;
  return Boolean(screen.querySelector('[data-app-mount] .nx-photo-editor'));
}

function activate(screen) {
  if (currentScreen === screen && screen?.dataset.aiPhotoFullscreen === '1') return;
  deactivate();
  if (!screen) return;
  currentScreen = screen;
  screen.dataset.aiPhotoFullscreen = '1';
  screen.classList.add('nx-ai-photo-fullscreen-screen');
  document.documentElement.classList.add('nx-ai-photo-fullscreen-active');
}

function scan() {
  const stage = document.getElementById('nx-stage');
  const screen = stage?.querySelector(':scope > .nx-screen') || null;
  if (screen && isAiPhotoScreen(screen)) {
    activate(screen);
    return;
  }
  if (!currentScreen || currentScreen !== screen || !currentScreen.isConnected) deactivate();
}

const observer = new MutationObserver(() => queueMicrotask(scan));
observer.observe(document.documentElement, { childList:true, subtree:true });
window.addEventListener('pageshow', scan);
scan();
