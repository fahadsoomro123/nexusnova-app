const ACTIVE_CLASS = 'nx-calculator-fullscreen-active';
const SCREEN_CLASS = 'nx-calculator-fullscreen-screen';
const PRO_SIZE_STYLE_ID = 'nx-calculator-pro-size-v2';

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalTheme = themeMeta?.content || '#07111f';
const originalScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

function ensureProLabSizing() {
  if (document.getElementById(PRO_SIZE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRO_SIZE_STYLE_ID;
  style.textContent = `
    /* Pro Lab has more functions, but it must still use real phone space instead of tiny keys. */
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calculator-pro {
      padding-left:5px!important;
      padding-right:5px!important;
      grid-template-rows:auto auto clamp(102px,16dvh,138px) auto auto minmax(0,1fr) auto!important;
      gap:5px!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank:not([hidden]) {
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      grid-auto-rows:minmax(0,1fr)!important;
      gap:4px!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key] {
      width:100%!important;
      height:100%!important;
      min-height:0!important;
      padding:0 3px!important;
      border-radius:12px!important;
      font-size:clamp(10px,3vw,15px)!important;
      line-height:1!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key].equals {
      font-size:clamp(15px,4.2vw,21px)!important;
    }
    @media (max-height:720px) {
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calculator-pro {
        grid-template-rows:auto auto clamp(90px,14dvh,108px) auto auto minmax(0,1fr) auto!important;
        gap:4px!important;
      }
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank:not([hidden]) {
        gap:3px!important;
      }
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key] {
        font-size:clamp(9px,2.7vw,13px)!important;
      }
    }
    @media (max-height:620px) {
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-everyday-calculator[data-calc-profile="pro"] .nx-calculator-pro {
        grid-template-rows:auto auto 84px auto auto minmax(0,1fr)!important;
      }
    }
  `;
  document.head.appendChild(style);
}

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
  ensureProLabSizing();
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
