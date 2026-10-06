// NOVA 5.7 — phone-safe human-feel response reveal.
// Live replies are armed directly from the user's send action, then progressively
// revealed word by word. This avoids relying only on WebView disabled-attribute timing.

const CHARS_PER_SECOND = 38;
const MAX_VISUAL_MS = 24000;
const MIN_VISUAL_MS = 900;
const COMPLETION_GRACE_MS = 2200;
let liveGeneration = false;
let liveUntil = 0;
let lastArmAt = 0;

function activeSendButton() {
  return document.querySelector('[data-nx57-send]');
}

function activeInput() {
  return document.querySelector('[data-nx57-input]');
}

function markGenerationStart(reason = 'unknown') {
  liveGeneration = true;
  liveUntil = Number.POSITIVE_INFINITY;
  lastArmAt = performance.now();
  if (globalThis.__NOVA_HUMAN_RESPONSE__) globalThis.__NOVA_HUMAN_RESPONSE__.lastTrigger = reason;
}

function markGenerationEnd() {
  liveGeneration = false;
  liveUntil = performance.now() + COMPLETION_GRACE_MS;
}

function latestUserText() {
  const rows = document.querySelectorAll('.nx57-clean-msg.user p');
  return String(rows[rows.length - 1]?.textContent || '').trim();
}

function userWantsRomanUrdu() {
  const text = latestUserText().toLowerCase();
  return /(urdu|roman urdu|angrezi|english).{0,28}(nahi|nahe|mat|urdu)/i.test(text)
    || /\b(bhai|mujhe|mery|mere|mera|meri|tum|tu|aap|kia|kya|hai|he|hen|hain|batao|dekho|jao)\b/i.test(text);
}

function cleanFallbackText(value) {
  const full = String(value || '').trim();
  if (!/^Live research succeeded, but the answer model was temporarily unavailable\./i.test(full)) return full;
  if (userWantsRomanUrdu()) {
    return 'Bhai, live web evidence mil gayi thi lekin answer model us waqt response nahi de saka. Main raw search page ko jawab bana kar nahi dikhaunga aur koi current fact banaunga nahi. Dobara try karo; NOVA verified source milne par seedha Roman Urdu me jawab dega.';
  }
  return 'Live web evidence was fetched, but the answer model was temporarily unavailable. NOVA will not show a raw search page as the answer or invent current facts. Please retry.';
}

function shouldAnimate(message) {
  if (!(message instanceof HTMLElement)) return false;
  if (!message.matches('.nx57-clean-msg.bot')) return false;
  const send = activeSendButton();
  return liveGeneration || performance.now() <= liveUntil || Boolean(send?.disabled) || performance.now() - lastArmAt < 30000;
}

function reveal(message) {
  if (!shouldAnimate(message) || message.dataset.nx57HumanReveal === '1') return;
  const p = message.querySelector('p');
  if (!p) return;
  const full = cleanFallbackText(p.textContent);
  if (!full) return;

  message.dataset.nx57HumanReveal = '1';
  message.classList.add('nx57-human-reply', 'is-typing');
  p.textContent = '';

  const duration = Math.max(
    MIN_VISUAL_MS,
    Math.min(MAX_VISUAL_MS, Math.round((full.length / CHARS_PER_SECOND) * 1000))
  );
  const started = performance.now();

  const tick = now => {
    const elapsed = Math.max(0, now - started);
    const progress = Math.min(1, elapsed / duration);
    let end = Math.max(1, Math.floor(full.length * progress));

    if (end < full.length) {
      const nextSpace = full.indexOf(' ', end);
      if (nextSpace > end && nextSpace - end <= 14) end = nextSpace + 1;
    }

    p.textContent = full.slice(0, Math.min(full.length, end));

    const scroller = message.closest('[data-nx57-messages]');
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 220) {
      scroller.scrollTop = scroller.scrollHeight;
    }

    if (progress < 1 && end < full.length) {
      requestAnimationFrame(tick);
      return;
    }

    p.textContent = full;
    message.classList.remove('is-typing');
    message.classList.add('is-complete');
    markGenerationEnd();
    window.dispatchEvent(new CustomEvent('nova57:reply-visible', {
      detail: { chars: full.length, visualMs: duration, charsPerSecond: CHARS_PER_SECOND }
    }));
  };

  requestAnimationFrame(tick);
}

// Capture the user's action before the app clears the input or changes button state.
document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-nx57-send]') : null;
  if (!button) return;
  const value = String(activeInput()?.value || '').trim();
  if (value) markGenerationStart('send-click');
}, true);

document.addEventListener('keydown', event => {
  if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-nx57-input]')) return;
  if (event.key === 'Enter' && !event.shiftKey && String(event.target.value || '').trim()) {
    markGenerationStart('enter-key');
  }
}, true);

const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes' && record.attributeName === 'disabled' && record.target instanceof HTMLElement && record.target.matches('[data-nx57-send]')) {
      if (record.oldValue === null) markGenerationStart('send-disabled');
      else liveUntil = performance.now() + COMPLETION_GRACE_MS;
      continue;
    }

    for (const added of record.addedNodes) {
      if (!(added instanceof HTMLElement)) continue;
      const rows = [];
      if (added.matches?.('.nx57-clean-msg.bot')) rows.push(added);
      added.querySelectorAll?.('.nx57-clean-msg.bot').forEach(row => rows.push(row));
      for (const row of rows) queueMicrotask(() => reveal(row));
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled'],
  attributeOldValue: true
});

globalThis.__NOVA_HUMAN_RESPONSE__ = {
  active: true,
  mode: 'phone-armed-progressive-word-reveal',
  charsPerSecond: CHARS_PER_SECOND,
  maxVisualMs: MAX_VISUAL_MS,
  lastTrigger: null,
  startedAt: new Date().toISOString()
};
