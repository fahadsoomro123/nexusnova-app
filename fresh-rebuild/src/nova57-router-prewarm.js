// NOVA 5.7 — background router prewarm.
// Importing the production keyless router starts its existing background discovery
// before the user submits the first prompt. Discovery stays outside foreground work.
import './nova57-pro-keyless-router.js';

globalThis.__NOVA_ROUTER_PREWARM__ = {
  active: true,
  startedAt: new Date().toISOString(),
  mode: 'background-only'
};
