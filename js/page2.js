/* NexusNova App Check bootstrap */
const meta = document.querySelector('meta[name="nexusnova-app-check-site-key"]');
if (meta) {
  meta.setAttribute('content', '6LfEc4QtAAAAAOohkqSv0p76iwPTeHI98hqVlwIs');
}
await import('./page2-core.js?v=appcheck-1');
