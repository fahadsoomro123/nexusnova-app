// NOVA 5.7 — human-feel response reveal.
// Assistant replies are progressively revealed after they arrive so the UI feels
// streamed instead of flashing the whole response at once. Presentation only.

const CHARS_PER_SECOND = 64;
const MAX_VISUAL_MS = 18000;
const MIN_VISUAL_MS = 700;
const COMPLETION_GRACE_MS = 900;
let liveGeneration = false;
let liveUntil = 0;

function activeSendButton() {
  return document.querySelector('[data-nx57-send]');
}

function markGenerationStart() {
  liveGeneration = true;
  liveUntil = Number.POSITIVE_INFINITY;
}

function markGenerationEnd() {
  liveGeneration = false;
  liveUntil = performance.now() + COMPLETION_GRACE_MS;
}

function shouldAnimate(message) {
  if (!(message instanceof HTMLElement)) return false;
  if (!message.matches('.nx57-clean-msg.bot')) return false;
  const send = activeSendButton();
  return liveGeneration || performance.now() <= liveUntil || Boolean(send?.disabled);
}

function reveal(message) {
  if (!shouldAnimate(message) || message.dataset.nx57HumanReveal === '1') return;
  const p = message.querySelector('p');
  if (!p) return;
  const full = String(p.textContent || '');
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

    // Prefer revealing complete words so the motion looks like natural streaming.
    if (end < full.length) {
      const nextSpace = full.indexOf(' ', end);
      if (nextSpace > end && nextSpace - end <= 10) end = nextSpace + 1;
    }

    p.textContent = full.slice(0, Math.min(full.length, end));

    const scroller = message.closest('[data-nx57-messages]');
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 190) {
      scroller.scrollTop = scroller.scrollHeight;
    }

    if (progress < 1 && end < full.length) {
      requestAnimationFrame(tick);
      return;
    }

    p.textContent = full;
    message.classList.remove('is-typing');
    message.classList.add('is-complete');
    window.dispatchEvent(new CustomEvent('nova57:reply-visible', {
      detail: { chars: full.length, visualMs: duration, charsPerSecond: CHARS_PER_SECOND }
    }));
  };

  requestAnimationFrame(tick);
}

const observer = new MutationObserver(records => {
  // Mutation records preserve order. We use attributeOldValue because by callback
  // time the send button may already have been re-enabled; checking only its current
  // state is exactly what caused completed replies to flash in full on phones.
  for (const record of records) {
    if (record.type === 'attributes' && record.attributeName === 'disabled' && record.target instanceof HTMLElement && record.target.matches('[data-nx57-send]')) {
      if (record.oldValue === null) markGenerationStart();
      else markGenerationEnd();
      continue;
    }

    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches?.('.nx57-clean-msg.bot')) reveal(node);
      node.querySelectorAll?.('.nx57-clean-msg.bot').forEach(reveal);
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
  mode: 'progressive-word-reveal',
  charsPerSecond: CHARS_PER_SECOND,
  maxVisualMs: MAX_VISUAL_MS,
  startedAt: new Date().toISOString()
};
