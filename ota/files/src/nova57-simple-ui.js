// NOVA 5.7 — simple Chat/Work surface.
// Dashboard was retired; all other NOVA chat UI remains owned by the existing renderer.

const style = document.createElement('style');
style.textContent = `
  [data-nx57-control],
  [data-nx57-control-center] { display: none !important; }
  .nx57-clean-screen [data-nx57-chat-panel] { display: flex !important; }
`;
document.head.appendChild(style);

function simplify(root = document) {
  root.querySelectorAll?.('[data-nx57-control]').forEach(node => node.remove());
  root.querySelectorAll?.('[data-nx57-control-center]').forEach(node => node.remove());

  root.querySelectorAll?.('.nx57-clean-screen').forEach(screen => {
    screen.classList.remove('nx57-dashboard-open');
    const header = screen.querySelector('.nx57-clean-header');
    const chat = screen.querySelector('[data-nx57-chat-panel]');
    const status = screen.querySelector('[data-nx57-status]');
    if (header) header.hidden = false;
    if (chat) chat.hidden = false;
    if (status) status.hidden = false;
  });
}

const observer = new MutationObserver(() => simplify(document));
observer.observe(document.documentElement, { childList: true, subtree: true });
simplify(document);

globalThis.__NOVA_SIMPLE_UI__ = {
  active: true,
  dashboard: false,
  modes: ['Chat', 'Work'],
  startedAt: new Date().toISOString()
};
