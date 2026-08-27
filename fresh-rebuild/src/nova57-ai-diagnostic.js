const NOVA_WARN_PREFIX = '[NexusNova Fresh] NOVA 5.7:';
const originalWarn = console.warn.bind(console);

function cleanDiagnostic(error) {
  const parts = [error?.name, error?.code, error?.status, error?.message]
    .filter(value => value !== undefined && value !== null && String(value).trim())
    .map(value => String(value).trim());
  let text = parts.join(' | ') || String(error || 'Unknown provider error');
  text = text
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, '[token redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 700);
}

function showDiagnostic(diagnostic) {
  window.setTimeout(() => {
    const root = document.querySelector('.nx57-clean-screen');
    if (!root) return;

    const status = root.querySelector('[data-nx57-status]');
    if (status) status.textContent = `AI diagnostic: ${diagnostic}`;

    const messages = root.querySelector('[data-nx57-messages]');
    const empty = root.querySelector('[data-nx57-empty]');
    if (!messages) return;

    let card = messages.querySelector('[data-nx57-ai-diagnostic]');
    if (!card) {
      card = document.createElement('article');
      card.className = 'nx57-clean-msg bot';
      card.dataset.nx57AiDiagnostic = '1';
      card.innerHTML = '<strong>NOVA diagnostic</strong><p></p>';
      messages.insertBefore(card, empty || null);
    }
    const text = card.querySelector('p');
    if (text) text.textContent = diagnostic;
    messages.scrollTop = messages.scrollHeight;
  }, 0);
}

console.warn = (...args) => {
  try {
    if (String(args[0] || '').includes(NOVA_WARN_PREFIX)) {
      const error = args.find((value, index) => index > 0 && value && (value.message || value.code || value.name)) || args[1];
      showDiagnostic(cleanDiagnostic(error));
    }
  } catch {}
  originalWarn(...args);
};
