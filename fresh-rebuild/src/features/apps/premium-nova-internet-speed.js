// Compatibility tombstone for older cached NexusNova app loaders.
//
// The Nova Internet Speed app has been removed from the current registry and
// must not be rendered. Keep this module path alive because older installed or
// cached app-screen.js versions may still statically import it. Returning an
// empty renderer map prevents one missing module from taking down every Nova
// Hub app during a mixed-version/OTA cache window.
export const premiumNovaInternetSpeedRenderers = Object.freeze({});
