/* NexusNova Referral Capture v1
   Converts a referral landing-code saved before signup into one immutable
   Firestore referral relationship after authentication. No NVX is minted. */
(() => {
  'use strict';
  if (window.__nxReferralCaptureV1) return;
  window.__nxReferralCaptureV1 = true;

  const KEY = 'nexusnova_pending_referral_v1';
  const FIREBASE_VERSION = '12.1.0';
  const codePattern = /^NVX-[A-Z0-9]{8,16}$/;
  let running = false;

  function cleanCode(value) {
    const code = String(value || '').trim().toUpperCase();
    return codePattern.test(code) ? code : '';
  }

  function pendingCode() {
    try { return cleanCode(localStorage.getItem(KEY)); }
    catch (_) { return ''; }
  }

  function clearPending() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  function note(text, good=false) {
    const target = document.getElementById('nxGrowthStatus');
    if (!target) return;
    target.textContent = text;
    if (good) target.style.color = '#22c55e';
  }

  async function waitForApp(appMod) {
    for (let i=0;i<40;i++) {
      const apps = appMod.getApps();
      if (apps.length) return apps[0];
      await new Promise(resolve => setTimeout(resolve,250));
    }
    return null;
  }

  async function capture(user, db, fs) {
    const code = pendingCode();
    if (!code || !user || running) return;
    running = true;
    try {
      const ownRef = fs.doc(db,'referrals',user.uid);
      const ownSnap = await fs.getDoc(ownRef);
      if (ownSnap.exists()) {
        clearPending();
        return;
      }

      const profileSnap = await fs.getDoc(fs.doc(db,'users',user.uid));
      if (!profileSnap.exists()) return;
      const createdAt = profileSnap.data()?.createdAt;
      const createdMs = createdAt?.toMillis?.() || 0;
      if (createdMs && Date.now() - createdMs > 24 * 60 * 60 * 1000) {
        clearPending();
        note('Referral link expired for this existing account.');
        return;
      }

      const codeSnap = await fs.getDoc(fs.doc(db,'referralCodes',code));
      if (!codeSnap.exists()) {
        clearPending();
        note('That referral code is not active.');
        return;
      }

      const referrerUid = String(codeSnap.data()?.ownerUid || '');
      if (!referrerUid || referrerUid === user.uid) {
        clearPending();
        note('Self-referrals are not allowed.');
        return;
      }

      await fs.setDoc(ownRef,{
        referredUid:user.uid,
        referrerUid,
        code,
        status:'pending',
        createdAt:fs.serverTimestamp()
      });
      clearPending();
      note('Referral attached. It verifies after email verification + first completed mining cycle.', true);
      window.nexusRefreshGrowthCenter?.();
    } catch (error) {
      const denied = String(error?.code || '').includes('permission-denied');
      if (!denied) clearPending();
      console.warn('NexusNova referral capture:', error);
    } finally {
      running = false;
    }
  }

  async function boot() {
    const code = pendingCode();
    if (!code) return;
    try {
      const [appMod,authMod,fsMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);
      const app = await waitForApp(appMod);
      if (!app) return;
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      authMod.onAuthStateChanged(auth,user => {
        if (user) capture(user,db,fsMod).catch(() => {});
      });
    } catch (error) {
      console.warn('NexusNova referral capture init:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();