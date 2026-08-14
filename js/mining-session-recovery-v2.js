/* NexusNova mining self-heal v2.
 * Normal users must never edit Firebase fields by hand.
 * Firestore is authoritative: stale legacy timers cannot overwrite the real
 * mining session. Verified Auth is refreshed immediately before secure writes.
 */
(async () => {
  'use strict';

  const DAY = 86400000;
  const REWARD = 24;
  let busy = false;
  let baseRender = null;
  let unsubscribeState = null;
  const authority = { known:false, active:false, startedAt:0 };

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

    // Refresh at the exact point mining reads/writes Firestore. This avoids a
    // race with an ID token minted before email verification.
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before using NVX mining.');

    if (typeof window.nexusRequireAppCheck === 'function') {
      await window.nexusRequireAppCheck();
    }

    return { user, db: fsMod.getFirestore(app), fsMod };
  }

  function normalize(data = {}) {
    return {
      active: data.miningActive === true,
      startedAt: Number(data.miningStartedAt) || 0,
      balance: Number(data.balance),
      totalMined: Number(data.totalMined)
    };
  }

  function setAuthority(active, startedAt) {
    authority.known = true;
    authority.active = active === true;
    authority.startedAt = authority.active ? (Number(startedAt) || 0) : 0;
    window.nexusMiningAuthoritativeState = {
      active: authority.active,
      startedAt: authority.startedAt
    };
  }

  function installRenderGuard() {
    const current = window.nexusSecureRenderMining;
    if (typeof current !== 'function') return false;
    if (current.__nxAuthoritativeGuard) return true;
    baseRender = current;
    const guarded = function(active, startedAt) {
      if (authority.known) {
        return baseRender(authority.active, authority.active ? authority.startedAt : 0);
      }
      return baseRender(active, startedAt);
    };
    guarded.__nxAuthoritativeGuard = true;
    window.nexusSecureRenderMining = guarded;
    return true;
  }

  function renderState(state) {
    setAuthority(state.active === true, state.startedAt);
    try {
      window.nexusApplySecureAccountState?.({
        balance: state.balance,
        totalMined: state.totalMined,
        miningActive: state.active === true,
        startedAt: state.startedAt
      });
    } catch (_) {}
    installRenderGuard();
    const renderer = window.nexusSecureRenderMining;
    if (typeof renderer === 'function') {
      try { renderer(authority.active, authority.startedAt); } catch (_) {}
    }
  }

  async function readState(c) {
    const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
    const snap = await c.fsMod.getDoc(ref);
    if (!snap.exists()) throw new Error('User profile not found.');
    return { ref, ...normalize(snap.data() || {}) };
  }

  async function finishExpired(c) {
    const now = Date.now();
    return c.fsMod.runTransaction(c.db, async tx => {
      const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const d = normalize(snap.data() || {});
      if (!Number.isFinite(d.balance) || !Number.isFinite(d.totalMined)) {
        throw new Error('Account mining data needs repair.');
      }
      if (!d.active) return { finished:false, ...d };
      if (d.startedAt <= 0) throw new Error('Mining session timestamp is invalid.');
      if (now - d.startedAt < DAY) return { finished:false, ...d };

      const nextBalance = d.balance + REWARD;
      const nextTotal = d.totalMined + REWARD;
      tx.update(ref, {
        balance: nextBalance,
        totalMined: nextTotal,
        miningActive: false,
        miningStartedAt: 0,
        miningLastUpdate: now
      });
      return {
        finished:true,
        active:false,
        startedAt:0,
        balance:nextBalance,
        totalMined:nextTotal,
        earned:REWARD
      };
    });
  }

  async function startFresh(c) {
    const now = Date.now();
    return c.fsMod.runTransaction(c.db, async tx => {
      const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const d = normalize(snap.data() || {});
      if (!Number.isFinite(d.balance) || !Number.isFinite(d.totalMined)) {
        throw new Error('Account mining data needs repair.');
      }
      if (d.active) {
        if (d.startedAt <= 0) throw new Error('Mining session timestamp is invalid.');
        return { started:false, alreadyActive:true, ...d };
      }
      if (d.startedAt !== 0) throw new Error('Mining session needs repair.');
      tx.update(ref, {
        miningActive: true,
        miningStartedAt: now,
        miningLastUpdate: now
      });
      return {
        started:true,
        active:true,
        startedAt:now,
        balance:d.balance,
        totalMined:d.totalMined,
        miningActive:true
      };
    });
  }

  async function sync({ startIfInactive = false, userInitiated = false } = {}) {
    if (busy) return;
    busy = true;
    const button = document.getElementById('mineBtn');
    if (button) button.disabled = true;
    try {
      const c = await ctx();
      let state = await readState(c);
      renderState(state);

      // A valid running session stays exactly as it is.
      if (state.active && state.startedAt > 0 && Date.now() - state.startedAt < DAY) {
        return;
      }

      // Expired legacy/current session: finish once with the normal secure
      // finish rule. On passive boot we stop here; a user tap can then start a
      // fresh 24h session immediately.
      if (state.active && state.startedAt > 0 && Date.now() - state.startedAt >= DAY) {
        const finished = await finishExpired(c);
        state = {
          active:false,
          startedAt:0,
          balance:Number(finished.balance),
          totalMined:Number(finished.totalMined)
        };
        renderState(state);
      }

      state = await readState(c);
      renderState(state);

      if (!state.active && state.startedAt === 0 && startIfInactive) {
        const started = await startFresh(c);
        renderState({
          active:true,
          startedAt:Number(started.startedAt) || Date.now(),
          balance:Number(started.balance),
          totalMined:Number(started.totalMined)
        });
        console.info('NexusNova mining self-heal: fresh session active.');
        return;
      }

      if (!state.active && state.startedAt === 0) return;
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
    installRenderGuard();
    const button = document.getElementById('mineBtn');
    if (!button) return;
    button.onclick = () => sync({ startIfInactive:true, userInitiated:true });
    window.nexusSecureStartMining = () => sync({ startIfInactive:true, userInitiated:true });
  }

  async function startFirestoreWatch(c) {
    try { unsubscribeState?.(); } catch (_) {}
    const ref = c.fsMod.doc(c.db, 'users', c.user.uid);
    let lastKey = '';
    unsubscribeState = c.fsMod.onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const state = normalize(snap.data() || {});
      const key = [state.active, state.startedAt, state.balance, state.totalMined].join('|');
      if (key === lastKey) return;
      lastKey = key;
      renderState(state);
    }, error => {
      console.warn('NexusNova mining state watch:', error);
    });
  }

  async function boot() {
    // Wait until the visual/reward module exists, then become the final click
    // owner and guard its renderer against stale page2-core timestamps.
    for (let i = 0; i < 40 && typeof window.nexusSecureRenderMining !== 'function'; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    installClickOwner();

    try {
      const c = await ctx();
      await startFirestoreWatch(c);
    } catch (error) {
      console.warn('NexusNova mining watch deferred:', error);
    }

    // Passive boot repairs/finishes an expired session but does not start a new
    // one without the user's tap.
    await sync({ startIfInactive:false, userInitiated:false });

    // Old modules also attach load handlers. Re-assert after they have all run.
    setTimeout(() => {
      installClickOwner();
      if (authority.known && typeof window.nexusSecureRenderMining === 'function') {
        try { window.nexusSecureRenderMining(authority.active, authority.startedAt); } catch (_) {}
      }
    }, 2200);
    setTimeout(installClickOwner, 5000);
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once:true });
})();
