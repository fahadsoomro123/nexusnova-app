// NOVA 5.7 — human-feel response reveal.
// Active assistant replies are progressively revealed after they arrive, avoiding
// abrupt full-text flashes while keeping the added visual delay tightly bounded.

const MAX_VISUAL_MS = 1150;
const MIN_VISUAL_MS = 260;
const FRAME_MS = 16;

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

  const duration = Math.max(MIN_VISUAL_MS, Math.min(MAX_VISUAL_MS, 220 + full.length * 1.35));
  const frames = Math.max(1, Math.round(duration / FRAME_MS));
  let frame = 0;

  const tick = () => {
    frame += 1;
    const eased = 1 - Math.pow(1 - Math.min(1, frame / frames), 2.15);
    let end = Math.max(1, Math.round(full.length * eased));
    if (end < full.length) {
      const nextSpace = full.indexOf(' ', end);
      if (nextSpace > end && nextSpace - end <= 10) end = nextSpace + 1;
    }
    p.textContent = full.slice(0, Math.min(full.length, end));
    const scroller = message.closest('[data-nx57-messages]');
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 180) {
      scroller.scrollTop = scroller.scrollHeight;
    }
    if (end < full.length) requestAnimationFrame(tick);
    else {
      p.textContent = full;
      message.classList.remove('is-typing');
      message.classList.add('is-complete');
      window.dispatchEvent(new CustomEvent('nova57:reply-visible', { detail: { chars: full.length, visualMs: duration } }));
    }
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
globalThis.__NOVA_HUMAN_RESPONSE__ = { active: true, maxVisualMs: MAX_VISUAL_MS, startedAt: new Date().toISOString() };
