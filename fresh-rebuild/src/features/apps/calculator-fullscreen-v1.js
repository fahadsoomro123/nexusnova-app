const ACTIVE_CLASS = 'nx-calculator-fullscreen-active';
const SCREEN_CLASS = 'nx-calculator-fullscreen-screen';

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalTheme = themeMeta?.content || '#07111f';
const originalScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

function applyTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxCalculatorTheme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f4f6f8' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreTheme() {
  delete document.documentElement.dataset.nxCalculatorTheme;
  if (themeMeta) themeMeta.content = originalTheme;
  if (schemeMeta) schemeMeta.content = originalScheme;
}

function locateCalculator() {
  const calculator = stage?.querySelector('.nx-everyday-calculator');
  if (!calculator) return null;
  const screen = calculator.closest('.nx-screen');
  if (!screen) return null;
  return { screen, calculator };
}

function enhance(screen) {
  if (screen.dataset.calculatorFullscreenV1 === '1') return () => {};
  screen.dataset.calculatorFullscreenV1 = '1';
  screen.classList.add(SCREEN_CLASS);
  document.documentElement.classList.add(ACTIVE_CLASS);
  document.body.classList.add(ACTIVE_CLASS);
  activeScreen = screen;
  applyTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-calculator-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);

  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const onTheme = () => applyTheme();
  lightQuery?.addEventListener?.('change', onTheme);

  return () => {
    lightQuery?.removeEventListener?.('change', onTheme);
    back.remove();
    screen.classList.remove(SCREEN_CLASS);
    delete screen.dataset.calculatorFullscreenV1;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    activeScreen = null;
    restoreTheme();
  };
}

function sync() {
  const found = locateCalculator();
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
    activeCleanup = enhance(found.screen);
  } catch (error) {
    console.error('[NexusNova Calculator] full-screen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    activeScreen = null;
    restoreTheme();
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(sync));
  observer.observe(stage, { childList:true, subtree:true });
  sync();
}
