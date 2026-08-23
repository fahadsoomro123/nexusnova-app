export function createRouter({ stage, routes, onRoute }) {
  let current = '';
  let renderRevision = 0;

  async function render(route, payload = {}) {
    const revision = ++renderRevision;
    const next = routes[route] ? route : 'mine';
    const factory = routes[next];
    current = next;
    stage.innerHTML = '';

    let result;
    try {
      result = await factory(payload);
    } catch (error) {
      if (revision !== renderRevision) return current;
      throw error;
    }

    // Route factories can be asynchronous (auth, Mine data, lazy-loaded apps).
    // If the user navigated again while this factory was waiting, its result is
    // stale and must never replace the newer screen or rewrite its hash/state.
    if (revision !== renderRevision) return current;

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

  window.addEventListener('popstate', () => { void render(initial()); });

  return {
    render,
    initial,
    get current() { return current; }
  };
}
