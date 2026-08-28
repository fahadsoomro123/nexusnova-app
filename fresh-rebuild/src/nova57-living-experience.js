// NOVA 5.7 Sol — living interaction enhancer.
// Enhances only renderer-owned NOVA controls: input state, gentle haptics,
// scroll-aware header polish and useful message actions.
// No fake UI, no provider claims, no screen overlays.

const CLEAN_SELECTOR = '.nx-app-body.nx57-clean-screen';
const wired = new WeakSet();

function haptic(ms = 7) {
  try {
    if (navigator?.vibrate) navigator.vibrate(ms);
  } catch {}
}

function messageText(article) {
  return String(article?.querySelector('p')?.textContent || '').trim();
}

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 3500));
    utterance.lang = /[\u0600-\u06ff]/.test(text) ? 'ur-PK' : 'en-US';
    utterance.rate = .98;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function addMessageActions(article) {
  if (!article?.classList?.contains('bot') || article.querySelector('.nx57-message-actions')) return;
  const text = messageText(article);
  if (!text) return;

  const actions = document.createElement('div');
  actions.className = 'nx57-message-actions';
  actions.setAttribute('aria-label', 'Message actions');

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'nx57-message-action';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    haptic(5);
    const ok = await copyText(messageText(article));
    const previous = copy.textContent;
    copy.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => { copy.textContent = previous; }, 1100);
  });

  const listen = document.createElement('button');
  listen.type = 'button';
  listen.className = 'nx57-message-action';
  listen.textContent = 'Listen';
  listen.addEventListener('click', () => {
    haptic(5);
    const ok = speakText(messageText(article));
    const previous = listen.textContent;
    listen.textContent = ok ? 'Playing' : 'Unavailable';
    setTimeout(() => { listen.textContent = previous; }, 1100);
  });

  actions.append(copy, listen);
  article.appendChild(actions);
}

function bindInput(screen) {
  const input = screen.querySelector('[data-nx57-input]');
  const compose = screen.querySelector('.nx57-clean-compose');
  if (!input || !compose) return;

  const sync = () => {
    compose.classList.toggle('nx57-has-text', Boolean(input.value.trim()));
  };
  input.addEventListener('input', sync, {passive:true});
  input.addEventListener('change', sync, {passive:true});
  sync();
}

function bindScroll(screen) {
  const messages = screen.querySelector('[data-nx57-messages]');
  if (!messages) return;
  let frame = 0;
  const sync = () => {
    frame = 0;
    screen.classList.toggle('nx57-alive-scrolled', messages.scrollTop > 10);
  };
  messages.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
  }, {passive:true});
  sync();
}

function bindHaptics(screen) {
  screen.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control || control.disabled || control.classList.contains('nx57-message-action')) return;
    if (control.matches('[data-nx57-send]')) haptic(9);
    else if (control.matches('[data-nx57-mode],[data-nx57-clean-menu],[data-nx57-new],[data-nx57-drawer-new],[data-nx57-side-action],[data-nx57-action]')) haptic(6);
  });
}

function bindKeyboard(screen) {
  const input = screen.querySelector('[data-nx57-input]');
  if (!input) return;
  input.addEventListener('focus', () => screen.classList.add('nx57-keyboard-focus'));
  input.addEventListener('blur', () => screen.classList.remove('nx57-keyboard-focus'));
}

function bindMessageFreshness(screen) {
  const messages = screen.querySelector('[data-nx57-messages]');
  if (!messages || typeof MutationObserver === 'undefined') return;

  messages.querySelectorAll('.nx57-clean-msg.bot').forEach(addMessageActions);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (!(added instanceof HTMLElement) || !added.classList.contains('nx57-clean-msg')) continue;
        added.dataset.nx57Fresh = 'true';
        addMessageActions(added);
        setTimeout(() => { try { delete added.dataset.nx57Fresh; } catch {} }, 700);
      }
    }
  });
  observer.observe(messages, {childList:true});
  screen.__nx57LivingObserver = observer;
}

function wire(screen) {
  if (!screen || wired.has(screen)) return;
  wired.add(screen);
  screen.classList.add('nx57-living-ready');
  bindInput(screen);
  bindScroll(screen);
  bindHaptics(screen);
  bindKeyboard(screen);
  bindMessageFreshness(screen);
}

function scan() {
  document.querySelectorAll(CLEAN_SELECTOR).forEach(wire);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scan, {once:true});
} else {
  scan();
}

if (typeof MutationObserver !== 'undefined') {
  const rootObserver = new MutationObserver(scan);
  rootObserver.observe(document.documentElement, {childList:true, subtree:true});
}
