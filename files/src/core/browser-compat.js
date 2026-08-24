/* Small compatibility guards for optional WebView/browser APIs.
   These do not grant or simulate capabilities; they only provide an explicit
   unsupported sentinel where older WebViews omit an optional global entirely. */

if (!('Notification' in globalThis)) {
  const unsupportedNotification = Object.freeze({
    permission: 'unsupported',
    requestPermission: async () => 'unsupported'
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    writable: true,
    value: unsupportedNotification
  });
}

if (!globalThis.CSS) globalThis.CSS = {};
if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch.codePointAt(0).toString(16)} `);
}
