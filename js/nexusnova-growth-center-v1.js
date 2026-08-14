/* NexusNova Growth Center v1
   Privacy-safe referral attribution + derived missions + reward activity snapshot.
   No referral NVX or mining multiplier is minted client-side. */
(() => {
  'use strict';
  if (window.__nxGrowthCenterV1) return;
  window.__nxGrowthCenterV1 = true;

  const FIREBASE_VERSION = '12.1.0';
  const APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
  const AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
  const FS_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;

  let auth = null;
  let db = null;
  let fs = null;
  let user = null;
  let profile = null;
  let referralCode = '';
  let referralRows = [];
  let ownReferral = null;
  let unsubscribeProfile = null;
  let booting = false;

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function hash32(input) {
    let h = 2166136261;
    const text = String(input || '');
    for (let i=0;i<text.length;i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).toUpperCase().padStart(7,'0');
  }

  function candidateCodes(uid) {
    const a = hash32(uid);
    const b = hash32(`${uid}:NEXUSNOVA`);
    return [`NVX-${a}${b.slice(0,2)}`, `NVX-${b}${a.slice(0,2)}`];
  }

  function ensureStyle() {
    if (document.getElementById('nxGrowthStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxGrowthStyle';
    style.textContent = `
      #tab-growth .nx-growth-hero{background:radial-gradient(circle at 88% 4%,rgba(168,85,247,.18),transparent 30%),linear-gradient(145deg,rgba(10,25,45,.98),rgba(6,17,32,.97));border:1px solid rgba(168,85,247,.22)}
      .nx-growth-kicker{font-size:10px;letter-spacing:.14em;color:#c084fc;font-weight:950}.nx-growth-title{font-size:23px;font-weight:950;color:#f8fafc;margin-top:5px}.nx-growth-sub{font-size:11px;color:#8499ad;line-height:1.55;margin-top:6px}
      .nx-growth-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.nx-growth-stat{padding:11px 7px;text-align:center;border-radius:14px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.11)}.nx-growth-stat small{display:block;color:#71869a;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.nx-growth-stat strong{display:block;color:#eef7ff;margin-top:5px;font-size:15px}
      .nx-ref-code{display:flex;align-items:center;gap:8px;margin-top:10px}.nx-ref-code code{flex:1;min-width:0;padding:11px 12px;border-radius:12px;background:rgba(2,8,23,.7);border:1px solid rgba(139,92,246,.2);font-weight:900;color:#ddd6fe;overflow:hidden;text-overflow:ellipsis}.nx-ref-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      .nx-mission{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-radius:13px;background:rgba(15,23,42,.52);border:1px solid rgba(148,163,184,.1);margin-top:7px}.nx-mission.done{background:rgba(22,101,52,.10);border-color:rgba(34,197,94,.22)}.nx-mission-icon{font-size:20px;text-align:center}.nx-mission strong{display:block;font-size:11px;color:#f1f5f9}.nx-mission small{display:block;font-size:9px;color:#7f93a6;margin-top:2px;line-height:1.4}.nx-mission-state{font-size:9px;font-weight:900;color:#94a3b8}.nx-mission.done .nx-mission-state{color:#4ade80}
      .nx-growth-bar{height:8px;border-radius:999px;background:rgba(51,65,85,.65);overflow:hidden;margin-top:9px}.nx-growth-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#22d3ee);width:0;transition:width .35s ease}
      .nx-activity{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.08)}.nx-activity:last-child{border-bottom:0}.nx-activity-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(30,41,59,.7);font-size:17px}.nx-activity-main{min-width:0;flex:1}.nx-activity-main strong{display:block;font-size:11px;color:#edf7ff}.nx-activity-main small{display:block;font-size:9px;color:#788da1;margin-top:2px;line-height:1.4}.nx-activity-value{font-size:10px;font-weight:900;color:#67e8f9;text-align:right}
      .nx-growth-note{padding:10px 11px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.16);font-size:10px;color:#d9b96e;line-height:1.45;margin-top:10px}
      #nxGrowthMini{margin-top:12px}.nx-growth-mini-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}.nx-growth-mini-cell{text-align:center;padding:8px 5px;border-radius:11px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.1)}.nx-growth-mini-cell small{display:block;font-size:8px;color:#70879a;text-transform:uppercase}.nx-growth-mini-cell strong{display:block;font-size:12px;color:#eaf7ff;margin-top:3px}
      @media(max-width:560px){.nx-growth-grid{grid-template-columns:1fr}.nx-ref-actions{grid-template-columns:1fr}.nx-mission{grid-template-columns:30px minmax(0,1fr) auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    if (document.getElementById('tab-growth')) return document.getElementById('tab-growth');
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (!main) return null;
    const section = document.createElement('section');
    section.id = 'tab-growth';
    section.className = 'tab';
    section.innerHTML = `
      <div class="card nx-growth-hero">
        <div class="nx-growth-kicker">NEXUSNOVA GROWTH CENTER</div>
        <div class="nx-growth-title">🚀 Referrals, Missions & Activity</div>
        <div class="nx-growth-sub">Real growth metrics without fake rewards. Referral verification requires a verified email and the referred miner's first completed 24h mining cycle.</div>
        <div class="nx-growth-grid">
          <div class="nx-growth-stat"><small>Verified Referrals</small><strong id="nxVerifiedRefs">0</strong></div>
          <div class="nx-growth-stat"><small>Missions</small><strong id="nxMissionScore">0/0</strong></div>
          <div class="nx-growth-stat"><small>Referral Tier</small><strong id="nxReferralTier">STARTER</strong></div>
        </div>
        <div id="nxGrowthStatus" class="status" style="margin-top:10px">Connecting to growth services…</div>
      </div>

      <div class="card">
        <h3>🤝 Referral Center</h3>
        <div class="nx-growth-sub">Share your personal link. A referral becomes verified only after the new account verifies email and completes its first mining cycle.</div>
        <div class="nx-ref-code"><code id="nxReferralCode">Preparing code…</code></div>
        <div class="nx-ref-actions">
          <button class="action-btn primary" id="nxCopyReferral" type="button">COPY REFERRAL LINK</button>
          <button class="action-btn" id="nxShareReferral" type="button">SHARE INVITE</button>
        </div>
        <div class="nx-growth-grid">
          <div class="nx-growth-stat"><small>Total Joined</small><strong id="nxTotalRefs">0</strong></div>
          <div class="nx-growth-stat"><small>Pending</small><strong id="nxPendingRefs">0</strong></div>
          <div class="nx-growth-stat"><small>Verified</small><strong id="nxVerifiedRefs2">0</strong></div>
        </div>
        <div id="nxOwnReferralStatus" class="nx-growth-note">No referral attribution on this account.</div>
        <div class="nx-growth-note">Referral mining multipliers and referral NVX rewards are intentionally OFF until stronger anti-abuse controls are launched. Counts shown here are genuine attribution metrics.</div>
      </div>

      <div class="card">
        <div class="market-header"><div><h3>🎯 Mission Center</h3><div class="market-count">Derived from secure account progress</div></div><span id="nxMissionPercent" style="font-size:10px;color:#c084fc;font-weight:900">0%</span></div>
        <div class="nx-growth-bar"><i id="nxMissionBar"></i></div>
        <div id="nxMissionList" style="margin-top:9px"></div>
      </div>

      <div class="card">
        <div class="market-header"><div><h3>📜 Reward Activity</h3><div class="market-count">Verified account checkpoints • not a fake transaction ledger</div></div></div>
        <div id="nxRewardActivity" style="margin-top:7px"></div>
      </div>`;
    main.appendChild(section);
    return section;
  }

  function ensureMenuButton() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || document.getElementById('nxGrowthMenuBtn')) return;
    const button = document.createElement('button');
    button.id = 'nxGrowthMenuBtn';
    button.type = 'button';
    button.className = 'more-item';
    button.dataset.nxmega = 'growth';
    button.innerHTML = '<span aria-hidden="true">🚀</span><span>GROWTH</span>';
    button.addEventListener('click', openGrowth);
    inner.appendChild(button);
  }

  function ensureProfileCard() {
    if (document.getElementById('nxGrowthMini')) return;
    const profileTab = document.getElementById('tab-profile');
    if (!profileTab) return;
    const card = document.createElement('div');
    card.id = 'nxGrowthMini';
    card.className = 'card';
    card.innerHTML = `
      <div class="market-header"><div><h3>🚀 Growth & Community</h3><div class="market-count">Referrals • missions • reward activity</div></div><span style="font-size:10px;color:#22c55e">LIVE</span></div>
      <div class="nx-growth-mini-row">
        <div class="nx-growth-mini-cell"><small>Verified</small><strong id="nxMiniVerifiedRefs">0</strong></div>
        <div class="nx-growth-mini-cell"><small>Missions</small><strong id="nxMiniMissionScore">0/0</strong></div>
        <div class="nx-growth-mini-cell"><small>Tier</small><strong id="nxMiniReferralTier">STARTER</strong></div>
      </div>
      <button class="action-btn primary" type="button" id="nxOpenGrowthFromProfile" style="width:100%;margin-top:9px">OPEN GROWTH CENTER</button>`;
    profileTab.appendChild(card);
    card.querySelector('#nxOpenGrowthFromProfile')?.addEventListener('click', openGrowth);
  }

  function ensureTasksCard() {
    if (document.getElementById('nxMissionMiniTasks')) return;
    const tasks = document.getElementById('tab-tasks');
    if (!tasks) return;
    const card = document.createElement('div');
    card.id = 'nxMissionMiniTasks';
    card.className = 'card';
    card.innerHTML = `<div class="market-header"><div><h3>🎯 Mission Progress</h3><div class="market-count">Complete real NexusNova milestones</div></div><strong id="nxTasksMissionScore" style="color:#c084fc">0/0</strong></div><button class="action-btn" type="button" id="nxOpenGrowthFromTasks" style="width:100%;margin-top:9px">VIEW MISSIONS & REFERRALS</button>`;
    tasks.appendChild(card);
    card.querySelector('#nxOpenGrowthFromTasks')?.addEventListener('click', openGrowth);
  }

  function closeMoreMenu() {
    const menu = document.getElementById('moreMenu');
    if (!menu) return;
    menu.classList.remove('show','open','active');
    menu.setAttribute('aria-hidden','true');
    if (menu.style.display === 'block' || menu.style.display === 'flex') menu.style.display = 'none';
  }

  function showTab(id) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${id}`)?.classList.add('active');
    document.querySelectorAll('.dock-item').forEach(item => item.classList.remove('active'));
    closeMoreMenu();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function openGrowth() {
    ensureUI();
    showTab('growth');
    refreshAll().catch(() => {});
  }

  function setText(id, value) {
    const target = document.getElementById(id);
    if (target) target.textContent = String(value);
  }

  function status(text, good=false) {
    const target = document.getElementById('nxGrowthStatus');
    if (!target) return;
    target.textContent = text;
    target.style.color = good ? '#22c55e' : '';
  }

  async function waitForFirebaseApp(appMod) {
    for (let i=0;i<40;i++) {
      const apps = appMod.getApps();
      if (apps.length) return apps[0];
      await new Promise(resolve => setTimeout(resolve,250));
    }
    return null;
  }

  async function ensureOwnCode() {
    if (!user || !db || !fs) return '';
    for (const code of candidateCodes(user.uid)) {
      const ref = fs.doc(db,'referralCodes',code);
      const snap = await fs.getDoc(ref);
      if (snap.exists()) {
        if (snap.data()?.ownerUid === user.uid) return code;
        continue;
      }
      try {
        await fs.setDoc(ref,{ownerUid:user.uid,code,createdAt:fs.serverTimestamp()});
        return code;
      } catch (error) {
        if (String(error?.code || '').includes('permission-denied')) throw error;
      }
    }
    throw new Error('Could not allocate a unique referral code.');
  }

  async function loadReferralRows() {
    if (!user || !db || !fs) return [];
    const q = fs.query(
      fs.collection(db,'referrals'),
      fs.where('referrerUid','==',user.uid),
      fs.limit(100)
    );
    const snap = await fs.getDocs(q);
    referralRows = snap.docs.map(d => ({...d.data(),__id:d.id}));
    return referralRows;
  }

  async function loadOwnReferral() {
    if (!user || !db || !fs) return null;
    const snap = await fs.getDoc(fs.doc(db,'referrals',user.uid));
    ownReferral = snap.exists() ? snap.data() : null;
    return ownReferral;
  }

  async function maybeVerifyOwnReferral() {
    if (!ownReferral || ownReferral.status !== 'pending' || !user || !profile) return;
    await user.reload();
    user = auth.currentUser || user;
    if (!user?.emailVerified || num(profile.totalMined) < 24) return;
    try {
      await user.getIdToken(true);
      await fs.updateDoc(fs.doc(db,'referrals',user.uid),{
        status:'verified',
        verifiedAt:fs.serverTimestamp()
      });
      ownReferral = {...ownReferral,status:'verified'};
    } catch (error) {
      console.warn('NexusNova referral verification:', error);
    }
  }

  function referralTier(verified) {
    if (verified >= 25) return 'NOVA PARTNER';
    if (verified >= 10) return 'AMBASSADOR';
    if (verified >= 3) return 'BUILDER';
    return 'STARTER';
  }

  function referralStats() {
    const total = referralRows.length;
    const verified = referralRows.filter(row => row.status === 'verified').length;
    const pending = Math.max(0,total-verified);
    return {total,verified,pending,tier:referralTier(verified)};
  }

  function isProfileCompleteEnough(data) {
    const name = String(data?.name || '').trim();
    const detail = String(data?.bio || data?.city || data?.country || '').trim();
    return Boolean(name && name.toLowerCase() !== 'miner user' && data?.photoDataUrl && detail);
  }

  function missions() {
    const stats = referralStats();
    const lastDaily = num(profile?.lastDailyReward);
    return [
      {icon:'✉️',name:'Verify Your Email',desc:'Unlock secure value-bearing account actions',done:Boolean(user?.emailVerified)},
      {icon:'🧑',name:'Complete Your Profile',desc:'Add a name, photo and at least one profile detail',done:isProfileCompleteEnough(profile)},
      {icon:'⚡',name:'Complete First Mining Cycle',desc:'Finish your first verified 24-hour mining session',done:num(profile?.totalMined) >= 24},
      {icon:'🎁',name:'Claim a Daily Reward',desc:'Use the secure daily reward at least once',done:lastDaily > 0},
      {icon:'🔥',name:'Build a 3-Day Streak',desc:'Claim daily rewards three days in a row',done:num(profile?.dailyRewardStreak) >= 3},
      {icon:'🤝',name:'Invite One Verified Miner',desc:'Friend verifies email and completes first mining cycle',done:stats.verified >= 1},
      {icon:'🧭',name:'Complete 3 Verified Tasks',desc:'Reach three verified community/task completions',done:num(profile?.tasksCompleted) >= 3}
    ];
  }

  function renderReferral() {
    const stats = referralStats();
    setText('nxReferralCode',referralCode || 'Unavailable');
    setText('nxTotalRefs',stats.total);
    setText('nxPendingRefs',stats.pending);
    setText('nxVerifiedRefs',stats.verified);
    setText('nxVerifiedRefs2',stats.verified);
    setText('nxMiniVerifiedRefs',stats.verified);
    setText('nxReferralTier',stats.tier);
    setText('nxMiniReferralTier',stats.tier);

    const own = document.getElementById('nxOwnReferralStatus');
    if (own) {
      if (!ownReferral) own.textContent = 'This account was not created through a NexusNova referral link.';
      else if (ownReferral.status === 'verified') own.textContent = '✓ Your referral attribution is verified.';
      else {
        const email = user?.emailVerified ? '✓ email verified' : 'email verification pending';
        const mining = num(profile?.totalMined) >= 24 ? '✓ first mining cycle complete' : 'first 24h mining cycle pending';
        own.textContent = `Referral pending • ${email} • ${mining}.`;
      }
    }
  }

  function renderMissions() {
    const rows = missions();
    const done = rows.filter(row => row.done).length;
    const percent = rows.length ? Math.round(done / rows.length * 100) : 0;
    setText('nxMissionScore',`${done}/${rows.length}`);
    setText('nxMiniMissionScore',`${done}/${rows.length}`);
    setText('nxTasksMissionScore',`${done}/${rows.length}`);
    setText('nxMissionPercent',`${percent}%`);
    const bar = document.getElementById('nxMissionBar');
    if (bar) bar.style.width = `${percent}%`;
    const list = document.getElementById('nxMissionList');
    if (list) list.innerHTML = rows.map(row => `
      <div class="nx-mission ${row.done ? 'done' : ''}">
        <div class="nx-mission-icon">${row.icon}</div>
        <div><strong>${esc(row.name)}</strong><small>${esc(row.desc)}</small></div>
        <div class="nx-mission-state">${row.done ? 'DONE ✓' : 'OPEN'}</div>
      </div>`).join('');
  }

  function formatDate(value) {
    const ms = value?.toMillis?.() ?? Number(value || 0);
    if (!ms) return '';
    try { return new Date(ms).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}); }
    catch (_) { return new Date(ms).toLocaleString(); }
  }

  function renderActivity() {
    const container = document.getElementById('nxRewardActivity');
    if (!container) return;
    const stats = referralStats();
    const items = [];
    const mined = num(profile?.totalMined);
    if (mined > 0) items.push({icon:'⛏️',title:'Verified Mining Total',desc:'Authoritative total earned from completed mining cycles.',value:`${mined.toFixed(0)} NVX`});
    const lastDaily = num(profile?.lastDailyReward);
    if (lastDaily > 0) items.push({icon:'🎁',title:'Latest Daily Reward',desc:`Last secure daily claim • ${formatDate(lastDaily)}`,value:'+5 NVX'});
    const streak = num(profile?.dailyRewardStreak);
    if (streak > 0) items.push({icon:'🔥',title:'Current Daily Streak',desc:'Consecutive secure daily reward progress.',value:`${streak} days`});
    if (stats.total > 0) items.push({icon:'🤝',title:'Referral Network',desc:`${stats.pending} pending • ${stats.verified} verified`,value:`${stats.total} joined`});
    const tasks = num(profile?.tasksCompleted);
    if (tasks > 0) items.push({icon:'🧭',title:'Verified Tasks',desc:'Authoritative task completion total.',value:String(tasks)});
    if (!items.length) items.push({icon:'✨',title:'No reward checkpoints yet',desc:'Complete mining, daily rewards or verified referrals and activity will appear here.',value:'READY'});
    container.innerHTML = items.map(item => `
      <div class="nx-activity"><div class="nx-activity-icon">${item.icon}</div><div class="nx-activity-main"><strong>${esc(item.title)}</strong><small>${esc(item.desc)}</small></div><div class="nx-activity-value">${esc(item.value)}</div></div>`).join('');
  }

  function referralLink() {
    if (!referralCode) return '';
    return `${window.location.origin}${window.location.pathname.replace(/page2\.html.*$/i,'index.html')}?ref=${encodeURIComponent(referralCode)}`;
  }

  async function copyReferral() {
    const link = referralLink();
    if (!link) return;
    await navigator.clipboard?.writeText?.(link);
    status('Referral link copied. Share it with a real new user.', true);
  }

  async function shareReferral() {
    const link = referralLink();
    if (!link) return;
    const payload = {title:'Join NexusNova',text:'Join NexusNova with my referral link.',url:link};
    if (navigator.share) {
      try { await navigator.share(payload); return; } catch (_) {}
    }
    await copyReferral();
  }

  async function refreshAll() {
    if (!user || !db || !fs) return;
    status('Refreshing verified growth metrics…');
    try {
      referralCode = await ensureOwnCode();
      await Promise.all([loadReferralRows(),loadOwnReferral()]);
      await maybeVerifyOwnReferral();
      if (ownReferral?.status === 'verified') await loadOwnReferral();
      renderReferral();
      renderMissions();
      renderActivity();
      status('Growth metrics synced securely.', true);
    } catch (error) {
      const denied = String(error?.code || '').includes('permission-denied');
      status(denied ? 'Growth Center security rules are not published yet. Owner setup required once.' : 'Growth metrics are temporarily unavailable.');
      console.warn('NexusNova Growth Center:', error);
      renderMissions();
      renderActivity();
    }
  }

  async function attachProfile(nextUser) {
    if (unsubscribeProfile) { try { unsubscribeProfile(); } catch (_) {} unsubscribeProfile = null; }
    user = nextUser;
    if (!user) return;
    const ref = fs.doc(db,'users',user.uid);
    unsubscribeProfile = fs.onSnapshot(ref,snap => {
      if (!snap.exists()) return;
      profile = snap.data();
      renderMissions();
      renderActivity();
      refreshAll().catch(() => {});
    },error => console.warn('NexusNova growth profile:',error));
  }

  async function bootFirebase() {
    if (booting) return;
    booting = true;
    try {
      const [appMod,authMod,fsMod] = await Promise.all([import(APP_URL),import(AUTH_URL),import(FS_URL)]);
      const app = await waitForFirebaseApp(appMod);
      if (!app) throw new Error('Firebase app is not ready.');
      auth = authMod.getAuth(app);
      db = fsMod.getFirestore(app);
      fs = fsMod;
      authMod.onAuthStateChanged(auth,nextUser => {
        if (!nextUser) { status('Sign in to use referrals and missions.'); return; }
        attachProfile(nextUser).catch(error => console.warn('NexusNova growth attach:',error));
      });
    } catch (error) {
      booting = false;
      status('Growth Center is waiting for account services…');
      setTimeout(bootFirebase,1800);
    }
  }

  function ensureUI() {
    ensureStyle();
    ensureSection();
    ensureMenuButton();
    ensureProfileCard();
    ensureTasksCard();
    const copy = document.getElementById('nxCopyReferral');
    if (copy && copy.dataset.nxBound !== '1') { copy.dataset.nxBound='1'; copy.addEventListener('click',()=>copyReferral().catch(()=>{})); }
    const share = document.getElementById('nxShareReferral');
    if (share && share.dataset.nxBound !== '1') { share.dataset.nxBound='1'; share.addEventListener('click',()=>shareReferral().catch(()=>{})); }
  }

  function boot() {
    ensureUI();
    [350,900,1800,3600,6500].forEach(ms => setTimeout(ensureUI,ms));
    bootFirebase();
  }

  window.nexusOpenGrowthCenter = openGrowth;
  window.nexusRefreshGrowthCenter = () => refreshAll();
  window.nexusGrowthCenterVersion = 'growth-v1';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();