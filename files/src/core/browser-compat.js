/* Small compatibility guards for optional WebView/browser APIs.
   These do not fake capabilities; they only prevent an absent optional global
   from throwing before a feature can show its explicit unavailable state. */

if (!('Notification' in globalThis)) {
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    writable: true,
    value: null
  });
}

if (!globalThis.CSS) globalThis.CSS = {};
if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch.codePointAt(0).toString(16)} `);
}
