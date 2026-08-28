// NOVA 5.7 Sol — living interaction enhancer.
// Enhances only renderer-owned NOVA controls with truthful, lightweight UX:
// input/busy state, gentle haptics, smart scrolling and useful message actions.
// No fake provider progress, no hidden chain-of-thought and no replacement UI.

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

function previousUserText(article) {
  let row = article?.previousElementSibling || null;
  while (row) {
    if (row.classList?.contains('nx57-clean-msg') && row.classList.contains('user')) return messageText(row);
    row = row.previousElementSibling;
  }
  return '';
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

function flashLabel(button, label, duration = 1100) {
  const previous = button.textContent;
  button.textContent = label;
  setTimeout(() => {
    if (button.isConnected) button.textContent = previous;
  }, duration);
}

function replayMessage(article, screen, button) {
  const text = previousUserText(article);
  const input = screen.querySelector('[data-nx57-input]');
  const send = screen.querySelector('[data-nx57-send]');
  if (!text || !input || !send) {
    flashLabel(button, 'Unavailable');
    return;
  }
  haptic(6);
  input.value = text;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  input.focus();
  if (send.disabled) {
    flashLabel(button, 'Queued in box');
    return;
  }
  send.click();
}

function addMessageActions(article, screen) {
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
    flashLabel(copy, ok ? 'Copied' : 'Copy failed');
  });

  const listen = document.createElement('button');
  listen.type = 'button';
  listen.className = 'nx57-message-action';
  listen.textContent = 'Listen';
  listen.addEventListener('click', () => {
    haptic(5);
    const ok = speakText(messageText(article));
    flashLabel(listen, ok ? 'Playing' : 'Unavailable');
  });

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'nx57-message-action';
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => replayMessage(article, screen, retry));

  actions.append(copy, listen, retry);
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

function bindBusyState(screen) {
  const send = screen.querySelector('[data-nx57-send]');
  const input = screen.querySelector('[data-nx57-input]');
  if (!send || typeof MutationObserver === 'undefined') return;

  const sync = () => {
    const busy = send.disabled === true;
    screen.classList.toggle('nx57-is-busy', busy);
    screen.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (input) input.setAttribute('aria-busy', busy ? 'true' : 'false');
  };
  const observer = new MutationObserver(sync);
  observer.observe(send, {attributes:true, attributeFilter:['disabled']});
  screen.__nx57BusyObserver = observer;
  sync();
}

function bindScroll(screen) {
  const messages = screen.querySelector('[data-nx57-messages]');
  if (!messages) return;

  const jump = document.createElement('button');
  jump.type = 'button';
  jump.className = 'nx57-jump-latest';
  jump.textContent = '↓ Latest';
  jump.setAttribute('aria-label', 'Jump to latest message');
  screen.appendChild(jump);

  let frame = 0;
  let pinnedToBottom = true;
  let savedTop = 0;
  let restoring = false;
  const nearBottom = () => messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;

  const sync = () => {
    frame = 0;
    screen.classList.toggle('nx57-alive-scrolled', messages.scrollTop > 10);
    if (!restoring) {
      pinnedToBottom = nearBottom();
      if (!pinnedToBottom) savedTop = messages.scrollTop;
    }
    jump.classList.toggle('is-visible', !pinnedToBottom);
  };

  messages.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
  }, {passive:true});

  jump.addEventListener('click', () => {
    haptic(5);
    pinnedToBottom = true;
    jump.classList.remove('is-visible');
    messages.scrollTo({top:messages.scrollHeight, behavior:'smooth'});
  });

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(records => {
      if (!records.some(record => record.addedNodes?.length)) return;
      const shouldStick = pinnedToBottom;
      const topBefore = savedTop;
      requestAnimationFrame(() => {
        if (shouldStick) {
          messages.scrollTop = messages.scrollHeight;
          jump.classList.remove('is-visible');
          return;
        }
        restoring = true;
        messages.scrollTop = topBefore;
        jump.classList.add('is-visible');
        requestAnimationFrame(() => { restoring = false; });
      });
    });
    observer.observe(messages, {childList:true});
    screen.__nx57ScrollObserver = observer;
  }
  sync();
}

function bindHaptics(screen) {
  screen.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control || control.disabled || control.classList.contains('nx57-message-action') || control.classList.contains('nx57-jump-latest')) return;
    if (control.matches('[data-nx57-send]')) haptic(9);
    else if (control.matches('[data-nx57-mode],[data-nx57-clean-menu],[data-nx57-new],[data-nx57-drawer-new],[data-nx57-side-action],[data-nx57-action]')) haptic(6);
  });
}

function bindKeyboard(screen) {
  const input = screen.querySelector('[data-nx57-input]');
  if (!input) return;
  input.addEventListener('focus', () => screen.classList.add('nx57-keyboard-focus'));
  input.addEventListener('blur', () => screen.classList.remove('nx57-keyboard-focus'));
  screen.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      return;
    }
    if (event.key !== 'Escape') return;
    const drawer = screen.querySelector('[data-nx57-clean-drawer]');
    const tools = screen.querySelector('[data-nx57-tools]');
    const settings = screen.querySelector('[data-nx57-settings-pop]');
    if (drawer && !drawer.hidden) drawer.hidden = true;
    if (tools && !tools.hidden) tools.hidden = true;
    if (settings && !settings.hidden) settings.hidden = true;
    input.focus();
  });
}

function bindConnectivity(screen) {
  const sync = () => screen.classList.toggle('nx57-offline', navigator.onLine === false);
  window.addEventListener('online', sync, {passive:true});
  window.addEventListener('offline', sync, {passive:true});
  sync();
}

function bindMessageFreshness(screen) {
  const messages = screen.querySelector('[data-nx57-messages]');
  if (!messages || typeof MutationObserver === 'undefined') return;

  messages.querySelectorAll('.nx57-clean-msg.bot').forEach(article => addMessageActions(article, screen));

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (!(added instanceof HTMLElement) || !added.classList.contains('nx57-clean-msg')) continue;
        added.dataset.nx57Fresh = 'true';
        addMessageActions(added, screen);
        if (added.classList.contains('bot')) haptic(4);
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
  bindBusyState(screen);
  bindScroll(screen);
  bindHaptics(screen);
  bindKeyboard(screen);
  bindConnectivity(screen);
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
