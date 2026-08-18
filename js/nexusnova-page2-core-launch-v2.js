/* NexusNova page2 core launch v2
   Only the minimum auth/Firebase core is awaited by page2.js. Optional modules
   are deliberately excluded so Android's native main-frame watchdog is not held
   by the full dashboard feature stack.
*/
if (!window.__nxPage2CoreLaunchV2) {
  window.__nxPage2CoreLaunchV2 = true;

  const host = String(window.location.hostname || '').toLowerCase();
  const referrer = String(document.referrer || '').toLowerCase();
  const isDevHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('--3000--') ||
    host.includes('webcontainer') ||
    host.endsWith('.webcontainer.io') ||
    host.endsWith('.webcontainer-api.io') ||
    host.endsWith('.stackblitz.io') ||
    host === 'stackblitz.com' ||
    host.endsWith('.stackblitz.com') ||
    referrer.includes('stackblitz.com');

  if (isDevHost) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const meta = document.querySelector('meta[name="nexusnova-app-check-site-key"]');
  if (meta) meta.setAttribute('content', '6LfEc4QtAAAAAOohkqSv0p76iwPTeHI98hqVlwIs');

  const nativeShell = typeof window.NexusAndroid?.postMessage === 'function';
  if (nativeShell) {
    try {
      const [appMod, authMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
      ]);
      const firebaseConfig = {
        apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
        authDomain: 'nexusnova-6ade2.firebaseapp.com',
        projectId: 'nexusnova-6ade2',
        storageBucket: 'nexusnova-6ade2.firebasestorage.app',
        messagingSenderId: '49791194817',
        appId: '1:49791194817:web:07f28326e0f15979536640',
        measurementId: 'G-YLPFKWSS12'
      };
      const app = appMod.getApps().find(item => item?.name === '[DEFAULT]') || appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const timeout = new Promise(resolve => setTimeout(resolve, 3000));

      if (typeof auth.authStateReady === 'function') {
        await Promise.race([auth.authStateReady(), timeout]);
      } else if (!auth.currentUser) {
        await Promise.race([
          new Promise(resolve => {
            let stop = () => {};
            stop = authMod.onAuthStateChanged(auth, () => {
              try { stop(); } catch (_) {}
              resolve();
            });
          }),
          timeout
        ]);
      }
    } catch (error) {
      console.warn('NexusNova Android Auth resume guard:', error);
    }
  }

  // Must register before page2-core so Daily Reward events cannot be consumed by
  // the legacy rewarded/mining compatibility stack.
  try {
    await import('./nexusnova-daily-ad-test-v1.js?v=5');
  } catch (error) {
    console.warn('NexusNova Daily Reward ad gate:', error);
  }

  await import('./page2-core.js?v=appcheck-debug-10');
  window.__nxPage2CoreReadyV2 = true;
}
