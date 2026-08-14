/* NexusNova automatic legacy mining-session recovery.
 * Runs only for authenticated users and uses Firestore transactions.
 * Expired valid sessions roll forward atomically: +24 NVX for the completed
 * 24h session, then a fresh 24h session starts. Malformed legacy state is
 * repaired without touching balances.
 */
(async () => {
  'use strict';

  const DAY = 86400000;
  const REWARD = 24;

  async function modules() {
    return Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
  }

  async function currentUser(authMod, auth) {
    try { await window.nexusAuthFreshReady; } catch (_) {}
    if (auth.currentUser) return auth.currentUser;
    return await new Promise(resolve => {
      let done = false;
      const unsub = authMod.onAuthStateChanged(auth, user => {
        if (done) return;
        done = true;
        unsub();
        resolve(user || null);
      });
      setTimeout(() => {
        if (done) return;
        done = true;
        unsub();
        resolve(auth.currentUser || null);
      }, 3000);
    });
  }

  async function recover() {
    try {
      const [appMod, authMod, fsMod] = await modules();
      const apps = appMod.getApps();
      if (!apps.length) return;
      const app = apps[0];
      const auth = authMod.getAuth(app);
      const user = await currentUser(authMod, auth);
      if (!user) return;

      await user.reload();
      await user.getIdToken(true);
      if (!user.emailVerified) return;

      if (typeof window.nexusRequireAppCheck === 'function') {
        await window.nexusRequireAppCheck();
      }

      const db = fsMod.getFirestore(app);
      const ref = fsMod.doc(db, 'users', user.uid);
      const now = Date.now();

      const result = await fsMod.runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return {action:'none'};
        const d = snap.data() || {};
        const active = d.miningActive === true;
        const started = Number(d.miningStartedAt);
        const balance = Number(d.balance);
        const total = Number(d.totalMined);

        if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(total) || total < 0) {
          return {action:'none'};
        }

        // Normal non-expired session: nothing to repair.
        if (active && Number.isFinite(started) && started > 0 && now - started < DAY) {
          return {action:'active', startedAt:started, balance, totalMined:total, miningActive:true};
        }

        // Valid expired legacy session: credit exactly one completed 24h reward
        // and immediately start a fresh session. Rules make this atomic and
        // replay-safe because the timestamp is replaced with the current time.
        if (active && Number.isFinite(started) && started > 0 && now - started >= DAY) {
          const nextBalance = balance + REWARD;
          const nextTotal = total + REWARD;
          tx.update(ref, {
            balance: nextBalance,
            totalMined: nextTotal,
            miningActive: true,
            miningStartedAt: now,
            miningLastUpdate: now
          });
          return {action:'rolled', startedAt:now, balance:nextBalance, totalMined:nextTotal, earned:REWARD, miningActive:true};
        }

        // Malformed legacy state (for example active=true with missing/zero
        // timestamp, or inactive with a stray timestamp): reset session fields
        // only. Never change balance/totalMined in this repair path.
        const strayStarted = Number.isFinite(started) ? started : 0;
        if ((active && strayStarted <= 0) || (!active && strayStarted !== 0)) {
          tx.update(ref, {
            miningActive: false,
            miningStartedAt: 0,
            miningLastUpdate: now
          });
          return {action:'repaired', startedAt:0, balance, totalMined:total, miningActive:false};
        }

        return {action:'none'};
      });

      if (result.action === 'rolled' || result.action === 'active') {
        try { window.nexusApplySecureAccountState?.(result); } catch (_) {}
        try { window.nexusSecureRenderMining?.(true, result.startedAt); } catch (_) {}
      } else if (result.action === 'repaired') {
        try { window.nexusApplySecureAccountState?.(result); } catch (_) {}
        try { window.nexusSecureRenderMining?.(false, 0); } catch (_) {}
      }

      if (result.action !== 'none') {
        console.info('NexusNova mining recovery:', result.action);
      }
    } catch (error) {
      console.warn('NexusNova mining recovery deferred:', error);
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(recover, 900);
  } else {
    window.addEventListener('load', () => setTimeout(recover, 900), {once:true});
  }
})();
