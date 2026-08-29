// NOVA 5.7 — human-feel response reveal.
// Assistant replies are progressively revealed after they arrive so the UI feels
// like a real streamed answer instead of flashing the whole response at once.
// This is presentation-only; it does not alter provider routing or generation.

const CHARS_PER_SECOND = 82;
const MAX_VISUAL_MS = 14000;
const MIN_VISUAL_MS = 520;

function activeSendButton() {
  return document.querySelector('[data-nx57-send]');
}

function shouldAnimate(message) {
  if (!(message instanceof HTMLElement)) return false;
  if (!message.matches('.nx57-clean-msg.bot')) return false;
  const send = activeSendButton();
  return Boolean(send?.disabled);
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

    if (end < full.length) {
      const nextSpace = full.indexOf(' ', end);
      if (nextSpace > end && nextSpace - end <= 9) end = nextSpace + 1;
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
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches?.('.nx57-clean-msg.bot')) reveal(node);
      node.querySelectorAll?.('.nx57-clean-msg.bot').forEach(reveal);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
globalThis.__NOVA_HUMAN_RESPONSE__ = {
  active: true,
  charsPerSecond: CHARS_PER_SECOND,
  maxVisualMs: MAX_VISUAL_MS,
  startedAt: new Date().toISOString()
};
