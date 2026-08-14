/* NexusNova mining self-heal v2.
 * Purpose: normal users must never edit Firebase fields by hand.
 * It refreshes the verified Auth claim inside the mining flow, securely closes
 * an expired 24h session using the normal Firestore finish rule, then starts a
 * fresh session using the normal start rule. No arbitrary balance changes.
 */
(async () => {
  'use strict';

  const DAY = 86400000;
  const REWARD = 24;
  let busy = false;

  async function ctx() {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const app = apps[0];
    const auth = authMod.getAuth(app);

    let user = auth.currentUser;
    if (!user) {
      user = await new Promise(resolve => {
        let done = false;
        const unsub = authMod.onAuthStateChanged(auth, value => {
          if (done) return;
          done = true;
          unsub();
          resolve(value || null);
        });
        setTimeout(() => {
          if (done) return;
          done = true;
          unsub();
          resolve(auth.currentUser || null);
        }, 3000);
      });
    }
    if (!user) throw new Error('Please sign in first.');

    // Refresh here, immediately before Firestore writes. This removes the
    // race where the page had verified email state but the rules still saw an
    // older email_verified=false ID token.
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before using NVX mining.');

    if (typeof window.nexusRequireAppCheck === 'function') {
      await window.nexusRequireAppCheck();
    }

    return { user, db: fsMod.getFirestore(app), fsMod };
  }

  async function readState(c) {
    const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
    const snap = await c.fsMod.getDoc(ref);
    if (!snap.exists()) throw new Error('User profile not found.');
    const d = snap.data() || {};
    return {
      ref,
      active: d.miningActive === true,
      startedAt: Number(d.miningStartedAt) || 0,
      balance: Number(d.balance),
      totalMined: Number(d.totalMined)
    };
  }

  async function finishExpired(c) {
    const now = Date.now();
    return c.fsMod.runTransaction(c.db, async tx => {
      const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const d = snap.data() || {};
      const active = d.miningActive === true;
      const started = Number(d.miningStartedAt) || 0;
      const balance = Number(d.balance);
      const total = Number(d.totalMined);
      if (!Number.isFinite(balance) || !Number.isFinite(total)) {
        throw new Error('Account mining data needs repair.');
      }
      if (!active) return { finished:false, balance, totalMined:total };
      if (started <= 0) throw new Error('Mining session timestamp is invalid.');
      if (now - started < DAY) {
        return { finished:false, active:true, startedAt:started, balance, totalMined:total };
      }
      const nextBalance = balance + REWARD;
      const nextTotal = total + REWARD;
      tx.update(ref, {
        balance: nextBalance,
        totalMined: nextTotal,
        miningActive: false,
        miningStartedAt: 0,
        miningLastUpdate: now
      });
      return { finished:true, balance:nextBalance, totalMined:nextTotal, earned:REWARD };
    });
  }

  async function startFresh(c) {
    const now = Date.now();
    return c.fsMod.runTransaction(c.db, async tx => {
      const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const d = snap.data() || {};
      const active = d.miningActive === true;
      const started = Number(d.miningStartedAt) || 0;
      const balance = Number(d.balance);
      const total = Number(d.totalMined);
      if (active) {
        if (started <= 0) throw new Error('Mining session timestamp is invalid.');
        return { started:false, alreadyActive:true, startedAt:started, balance, totalMined:total, miningActive:true };
      }
      if (started !== 0) throw new Error('Mining session needs repair.');
      tx.update(ref, {
        miningActive: true,
        miningStartedAt: now,
        miningLastUpdate: now
      });
      return { started:true, startedAt:now, balance, totalMined:total, miningActive:true };
    });
  }

  function render(result) {
    try { window.nexusApplySecureAccountState?.(result); } catch (_) {}
    if (result?.miningActive || result?.started || result?.alreadyActive) {
      try { window.nexusSecureRenderMining?.(true, result.startedAt); } catch (_) {}
    } else {
      try { window.nexusSecureRenderMining?.(false, 0); } catch (_) {}
    }
  }

  async function healAndStart({ userInitiated = false } = {}) {
    if (busy) return;
    busy = true;
    const button = document.getElementById('mineBtn');
    if (button) button.disabled = true;
    try {
      const c = await ctx();
      let state = await readState(c);

      // Active, not expired: preserve it. Never restart or duplicate-credit.
      if (state.active && state.startedAt > 0 && Date.now() - state.startedAt < DAY) {
        render({
          started:false,
          alreadyActive:true,
          startedAt:state.startedAt,
          balance:state.balance,
          totalMined:state.totalMined,
          miningActive:true
        });
        return;
      }

      // Expired active session: finish exactly once through the existing
      // server-side rule, then start the next session as a separate write.
      if (state.active && state.startedAt > 0 && Date.now() - state.startedAt >= DAY) {
        const finished = await finishExpired(c);
        if (finished?.finished) {
          try { window.nexusApplySecureAccountState?.(finished); } catch (_) {}
        }
      }

      state = await readState(c);
      if (!state.active && state.startedAt === 0) {
        const started = await startFresh(c);
        render(started);
        console.info('NexusNova mining self-heal: fresh session active.');
        return;
      }

      // If a malformed legacy state remains, do not invent a balance change.
      // Surface a precise developer log while keeping normal users out of the
      // Firebase console.
      throw new Error('Mining session state could not be repaired automatically.');
    } catch (error) {
      console.error('NexusNova mining self-heal:', error);
      if (userInitiated && window.NexusNovaUI?.alert) {
        try {
          await window.NexusNovaUI.alert({
            eyebrow:'MINING STATUS',
            title:'Mining Could Not Start',
            text:String(error?.message || 'Secure mining sync failed.'),
            icon:'security',
            buttonText:'Got it'
          });
        } catch (_) {}
      }
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function installClickOwner() {
    const button = document.getElementById('mineBtn');
    if (!button) return;
    button.onclick = () => healAndStart({ userInitiated:true });
    window.nexusSecureStartMining = () => healAndStart({ userInitiated:true });
  }

  async function boot() {
    // rewards-security-v1.js owns the visuals; wait briefly so v2 becomes the
    // final click owner instead of racing it during module startup.
    for (let i = 0; i < 30 && typeof window.nexusSecureRenderMining !== 'function'; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    installClickOwner();
    await healAndStart({ userInitiated:false });
    // Re-assert once after all window load handlers have run.
    setTimeout(installClickOwner, 1800);
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once:true });
})();
