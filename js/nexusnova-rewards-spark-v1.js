/* NexusNova Spark Rewards v1
   Secure daily reward fallback for the no-cost Firebase plan.
   Daily reward mutations are constrained by Firestore Security Rules.
   Unverifiable community/ad rewards never mint NVX. */
(() => {
  'use strict';
  if (window.__nxRewardsSparkV1) return;
  window.__nxRewardsSparkV1 = true;

  const DAY = 86_400_000;
  const DAILY = 5;
  let modulesPromise = null;
  let uiPromise = null;
  let dailyPromise = null;

  const el = id => document.getElementById(id);

  async function modules() {
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
      ]);
    }
    return modulesPromise;
  }

  async function waitForUser(authMod, auth) {
    if (auth.currentUser) return auth.currentUser;
    return new Promise(resolve => {
      let settled = false;
      const unsubscribe = authMod.onAuthStateChanged(auth, user => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(user || null);
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(auth.currentUser || null);
      }, 3000);
    });
  }

  async function context() {
    const [appMod, authMod, fsMod] = await modules();
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const app = apps[0];
    const auth = authMod.getAuth(app);
    let user = await waitForUser(authMod, auth);
    if (!user) throw new Error('Please sign in first.');
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before claiming NVX rewards.');
    if (typeof window.nexusRequireAppCheck !== 'function') throw new Error('App Check is unavailable. Reload NexusNova and try again.');
    await window.nexusRequireAppCheck();
    return {user, db:fsMod.getFirestore(app), fsMod};
  }

  async function ui() {
    if (window.NexusNovaUI) return window.NexusNovaUI;
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve, reject) => {
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI is unavailable.'));
      const existing = document.querySelector('script[data-nx-premium-ui]');
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done, 1200);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not load.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function message({eyebrow='REWARDS', title, text, icon='spark', buttonText='Got it'}) {
    try {
      const api = await ui();
      await api.alert({eyebrow,title,text,icon,buttonText});
    } catch (_) {
      console.info(`${title}: ${text}`);
    }
  }

  function remainingText(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    return `${hours}h ${minutes}m`;
  }

  function rewardError(error) {
    const code = String(error?.code || '');
    const raw = String(error?.message || error || 'Daily reward could not be claimed.');
    if (/permission-denied/i.test(code) || /missing or insufficient permissions/i.test(raw)) {
      return 'Daily Reward security rules are not live yet. The app owner needs to publish the current Firestore rules once; normal users will not need Firebase access.';
    }
    if (/app.?check/i.test(raw)) return 'Firebase App Check could not verify this reward request.';
    return raw;
  }

  async function claimDaily() {
    if (dailyPromise) return dailyPromise;
    const button = el('dailyBtn');
    if (button) button.disabled = true;

    dailyPromise = (async () => {
      try {
        const ctx = await context();
        const now = Date.now();
        const result = await ctx.fsMod.runTransaction(ctx.db, async tx => {
          const ref = ctx.fsMod.doc(ctx.db, 'users', ctx.user.uid);
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('User profile not found.');
          const data = snap.data() || {};
          const balance = Number(data.balance);
          const last = Number(data.lastDailyReward);
          const streak0 = Number(data.dailyRewardStreak);
          if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(last) || last < 0 || !Number.isFinite(streak0) || streak0 < 0) {
            throw new Error('Daily reward account data needs repair. No NVX was changed.');
          }
          if (now - last < DAY) {
            const wait = DAY - (now - last);
            const error = new Error(`Daily reward already claimed. Try again in ${remainingText(wait)}.`);
            error.code = 'daily-cooldown';
            throw error;
          }
          const streak = last > 0 && now - last <= DAY * 2 ? streak0 + 1 : 1;
          const nextBalance = balance + DAILY;
          tx.update(ref, {
            balance: nextBalance,
            lastDailyReward: now,
            dailyRewardStreak: streak
          });
          return {claimed:true,reward:DAILY,balance:nextBalance,streak,lastDailyReward:now};
        });

        try { window.nexusApplySecureAccountState?.(result); } catch (error) { console.warn('Daily reward display sync:', error); }
        try { window.updateDailyButton?.(); } catch (_) {}
        await message({
          eyebrow:'DAILY REWARD',
          title:'Reward Added',
          text:`+${DAILY.toFixed(2)} NVX added securely. Daily streak: ${Number(result.streak || 1)}.`,
          icon:'spark',
          buttonText:'Great'
        });
        return result;
      } catch (error) {
        console.warn('NexusNova daily reward:', error);
        await message({
          eyebrow:'DAILY REWARD',
          title:error?.code === 'daily-cooldown' ? 'Already Claimed' : 'Reward Unavailable',
          text:rewardError(error),
          icon:'security'
        });
        throw error;
      } finally {
        if (button) button.disabled = false;
        try { window.updateDailyButton?.(); } catch (_) {}
      }
    })().finally(() => { dailyPromise = null; });
    return dailyPromise;
  }

  async function explainTask(taskId) {
    const id = String(taskId || '');
    if (id === 'task1') {
      await message({
        eyebrow:'COMMUNITY TASK',
        title:'Verification Not Connected Yet',
        text:'Telegram membership must be verified by a real server or bot before NVX can be awarded. NexusNova will not issue a fake task reward.',
        icon:'security'
      });
      return {claimed:false,taskId:id};
    }
    await message({eyebrow:'COMMUNITY TASK',title:'Task Unavailable',text:'This task does not have a verified reward campaign yet.',icon:'security'});
    return {claimed:false,taskId:id};
  }

  async function explainRewardedAd() {
    await message({
      eyebrow:'WATCH AD BONUS',
      title:'Rewarded Ads Setup Pending',
      text:'A real rewarded-ad provider and ad unit are not connected yet. No +2.5 NVX will be issued until an ad is genuinely completed and verified.',
      icon:'security'
    });
    return {rewarded:false};
  }

  function polishTaskButtons() {
    const buttons = Array.from(document.querySelectorAll('#tab-tasks button'));
    const ad = buttons.find(button => /watch\s*ad/i.test(String(button.textContent || '')));
    if (ad) {
      ad.title = 'Reward activates after a real rewarded-ad provider is connected.';
      ad.dataset.nxRewardState = 'provider-pending';
    }
  }

  function install() {
    window.nexusSecureClaimDaily = claimDaily;
    window.claimDailyReward = claimDaily;
    window.completeTask = explainTask;
    window.watchAdReward = explainRewardedAd;
    window.nexusRewardsEngineVersion = 'spark-secure-v1';
    polishTaskButtons();
  }

  install();
  window.addEventListener('load', install, {once:true});
  [500,1400,3000,6000].forEach(ms => setTimeout(install, ms));
  console.info('NexusNova rewards engine loaded: spark-secure-v1');
})();