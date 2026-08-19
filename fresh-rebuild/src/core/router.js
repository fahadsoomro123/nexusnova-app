export function createRouter({ stage, routes, onRoute }) {
  let current = '';

  async function render(route, payload = {}) {
    const next = routes[route] ? route : 'mine';
    const factory = routes[next];
    current = next;
    stage.innerHTML = '';
    const result = await factory(payload);
    if (typeof result === 'string') stage.innerHTML = result;
    else if (result instanceof Node) stage.appendChild(result);
    stage.dataset.route = next;
    stage.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    onRoute?.(next, payload);
    history.replaceState({ route: next }, '', `#${next}`);
    return next;
  }

  function initial() {
    const hash = location.hash.replace(/^#/, '').trim();
    return routes[hash] ? hash : 'mine';
  }

  window.addEventListener('popstate', () => render(initial()));

  return {
    render,
    initial,
    get current() { return current; }
  };
}
