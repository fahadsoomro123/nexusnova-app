// Compatibility tombstone for older cached NexusNova app loaders.
//
// Nova Internet Speed is intentionally absent from the current app registry.
// Older cached app-screen.js versions may still import this module path, so an
// empty renderer map is kept to preserve module-graph compatibility without
// restoring the removed Speed Test UI or behavior.
export const speedSafeV2Renderers = Object.freeze({});
