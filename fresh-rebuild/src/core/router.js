export function createRouter({ stage, routes, beforeRoute, onRoute }) {
  let current = '';
  let renderRevision = 0;

  async function render(route, payload = {}) {
    const revision = ++renderRevision;
    const previous = current;
    const next = routes[route] ? route : 'mine';
    const factory = routes[next];

    // Clean route-owned timers/listeners first, but keep the current DOM visible
    // until the next async route is fully ready. This prevents blank-screen stalls
    // while lazy app modules (notably Nova Drive) are resolving.
    try { beforeRoute?.(next, payload, previous); }
    catch (error) { console.warn('[NexusNova Fresh] route cleanup:', error); }

    current = next;

    let result;
    try {
      result = await factory(payload);
    } catch (error) {
      if (revision !== renderRevision) return current;
      throw error;
    }

    if (revision !== renderRevision) {
      try { result?.__cleanup?.(); }
      catch (error) { console.warn('[NexusNova Fresh] stale route cleanup:', error); }
      return current;
    }

    stage.innerHTML = '';
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
