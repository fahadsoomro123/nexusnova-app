/* NexusNova Community League + Progress Center v1
   - Separate privacy-safe public leaderboard mirror (no email/wallet/balance/UID field).
   - Own progress is derived from the secure users/{uid} profile.
   - Public leaderboard writes are validated by Firestore Security Rules.
*/
(() => {
  'use strict';
  if (window.__nxCommunityProgressV1) return;
  window.__nxCommunityProgressV1 = true;

  const FIREBASE_VERSION = '12.1.0';
  const APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
  const AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
  const FS_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;

  let auth = null;
  let db = null;
  let fs = null;
  let ownProfile = null;
  let unsubscribeOwn = null;
  let syncTimer = 0;
  let lastSyncSignature = '';
  let bootedFirebase = false;

  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function ensureStyle() {
    if (document.getElementById('nxCommunityProgressStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxCommunityProgressStyle';
    style.textContent = `
      #tab-leaderboard .nx-league-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 90% 10%,rgba(250,204,21,.16),transparent 32%),linear-gradient(145deg,rgba(10,25,45,.98),rgba(5,15,30,.96));border:1px solid rgba(250,204,21,.18)}
      #tab-leaderboard .nx-league-kicker{font-size:10px;letter-spacing:.16em;color:#facc15;font-weight:900}
      #tab-leaderboard .nx-league-title{font-size:23px;font-weight:950;margin-top:5px;color:#f8fafc}
      #tab-leaderboard .nx-league-sub{margin-top:6px;font-size:12px;color:#8da3b7;line-height:1.5}
      .nx-progress-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}
      .nx-progress-stat{padding:11px 8px;border-radius:14px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.12);text-align:center}
      .nx-progress-stat small{display:block;font-size:9px;color:#71869b;text-transform:uppercase;letter-spacing:.08em}
      .nx-progress-stat strong{display:block;margin-top:5px;font-size:15px;color:#eaf5ff}
      .nx-badge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}
      .nx-badge{display:flex;gap:9px;align-items:center;padding:10px;border-radius:14px;border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);opacity:.55}
      .nx-badge.unlocked{opacity:1;border-color:rgba(34,197,94,.2);background:rgba(22,101,52,.10)}
      .nx-badge-icon{font-size:21px;line-height:1}
      .nx-badge strong{display:block;font-size:11px;color:#f1f5f9}.nx-badge small{display:block;font-size:9px;color:#8295a8;margin-top:2px;line-height:1.35}
      .nx-leader-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 8px;border-bottom:1px solid rgba(148,163,184,.08)}
      .nx-leader-row:last-child{border-bottom:0}.nx-leader-row.me{border-radius:12px;background:rgba(14,165,233,.10);border:1px solid rgba(56,189,248,.18);margin:4px 0}
      .nx-rank{font-weight:950;text-align:center;color:#9fb2c4}.nx-rank.top1{color:#facc15}.nx-rank.top2{color:#dbe4ef}.nx-rank.top3{color:#fb923c}
      .nx-leader-name{min-width:0}.nx-leader-name strong{display:block;color:#ecf8ff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-leader-name small{display:block;color:#70879a;font-size:9px;margin-top:2px}
      .nx-leader-score{text-align:right}.nx-leader-score strong{display:block;color:#67e8f9;font-size:12px}.nx-leader-score small{display:block;color:#6f8496;font-size:9px;margin-top:2px}
      .nx-league-actions{display:flex;gap:8px;margin-top:10px}.nx-league-actions button{flex:1}
      #nxProgressMini .nx-mini-head{display:flex;align-items:center;justify-content:space-between;gap:10px}#nxProgressMini .nx-mini-head b{font-size:13px;color:#eef8ff}#nxProgressMini .nx-mini-head span{font-size:10px;color:#facc15;font-weight:900}
      #nxProgressMini .nx-mini-line{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}#nxProgressMini .nx-mini-cell{text-align:center;padding:8px 5px;border-radius:11px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.1)}#nxProgressMini .nx-mini-cell small{display:block;color:#70879a;font-size:8px;text-transform:uppercase}#nxProgressMini .nx-mini-cell strong{display:block;color:#eaf7ff;margin-top:3px;font-size:12px}
      @media(max-width:560px){.nx-progress-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-badge-grid{grid-template-columns:1fr}.nx-leader-row{grid-template-columns:36px minmax(0,1fr) auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    if (document.getElementById('tab-leaderboard')) return document.getElementById('tab-leaderboard');
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (!main) return null;
    const section = document.createElement('section');
    section.id = 'tab-leaderboard';
    section.className = 'tab';
    section.innerHTML = `
      <div class="card nx-league-hero">
        <div class="nx-league-kicker">NEXUSNOVA COMMUNITY LEAGUE</div>
        <div class="nx-league-title">🏆 Miner Leaderboard</div>
        <div class="nx-league-sub">Compete on verified mining progress. Private account data stays private — the league only publishes your display name and progress stats.</div>
        <div class="nx-progress-grid">
          <div class="nx-progress-stat"><small>Your Rank</small><strong id="nxMyRank">—</strong></div>
          <div class="nx-progress-stat"><small>Total Mined</small><strong id="nxMyMined">0 NVX</strong></div>
          <div class="nx-progress-stat"><small>Daily Streak</small><strong id="nxMyStreak">0 🔥</strong></div>
          <div class="nx-progress-stat"><small>Badges</small><strong id="nxMyBadges">0/6</strong></div>
        </div>
        <div class="nx-league-actions">
          <button class="action-btn primary" type="button" id="nxLeagueRefresh">↻ REFRESH LEAGUE</button>
          <button class="action-btn" type="button" id="nxLeagueProfile">MY PROFILE</button>
        </div>
        <div id="nxLeagueStatus" class="status" style="margin-top:9px">Connecting to secure league…</div>
      </div>

      <div class="card">
        <h3>🎖️ Progress & Achievements</h3>
        <div id="nxBadgeGrid" class="nx-badge-grid"></div>
      </div>

      <div class="card">
        <div class="market-header">
          <div><h3>🌍 Top Miners</h3><div class="market-count">Top 50 • all-time verified mining</div></div>
          <span style="font-size:10px;color:#22c55e">● PRIVACY SAFE</span>
        </div>
        <div id="nxLeaderboardList" style="margin-top:8px"><div class="status">Loading leaderboard…</div></div>
      </div>`;
    main.appendChild(section);
    return section;
  }

  function ensureMenuButton() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || document.getElementById('nxLeaderboardMenuBtn')) return;
    const button = document.createElement('button');
    button.id = 'nxLeaderboardMenuBtn';
    button.type = 'button';
    button.className = 'more-item';
    button.dataset.nxmega = 'leaderboard';
    button.innerHTML = '<span aria-hidden="true">🏆</span><span>LEADERBOARD</span>';
    button.addEventListener('click', openLeague);
    inner.appendChild(button);
  }

  function ensureMiniCard() {
    if (document.getElementById('nxProgressMini')) return;
    const home = document.getElementById('tab-home');
    const stats = home?.querySelector('.stats-grid');
    if (!home || !stats) return;
    const card = document.createElement('div');
    card.id = 'nxProgressMini';
    card.className = 'card';
    card.innerHTML = `
      <div class="nx-mini-head"><b>🏆 Your NexusNova Progress</b><span id="nxMiniLevel">ROOKIE</span></div>
      <div class="nx-mini-line">
        <div class="nx-mini-cell"><small>Rank</small><strong id="nxMiniRank">—</strong></div>
        <div class="nx-mini-cell"><small>Streak</small><strong id="nxMiniStreak">0 🔥</strong></div>
        <div class="nx-mini-cell"><small>Badges</small><strong id="nxMiniBadges">0/6</strong></div>
      </div>
      <button class="action-btn" id="nxMiniLeagueBtn" type="button" style="width:100%;margin-top:9px">OPEN LEADERBOARD & BADGES</button>`;
    stats.insertAdjacentElement('afterend', card);
    card.querySelector('#nxMiniLeagueBtn')?.addEventListener('click', openLeague);
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
    const target = document.getElementById(`tab-${id}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.dock-item').forEach(item => item.classList.remove('active'));
    closeMoreMenu();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function openLeague() {
    ensureUI();
    showTab('leaderboard');
    loadLeaderboard(true).catch(() => {});
  }

  function badgesFor(profile) {
    const mined = num(profile?.totalMined);
    const streak = num(profile?.dailyRewardStreak);
    const tasks = num(profile?.tasksCompleted);
    const sessions = Math.floor(mined / 24);
    return [
      {icon:'⚡',name:'First Reactor',desc:'Complete your first 24h mining reward',ok:mined >= 24},
      {icon:'⛏️',name:'5 Session Miner',desc:'Complete 5 mining reward cycles',ok:sessions >= 5},
      {icon:'💎',name:'250 NVX Club',desc:'Mine at least 250 NVX',ok:mined >= 250},
      {icon:'🔥',name:'3 Day Streak',desc:'Claim daily rewards 3 days in a row',ok:streak >= 3},
      {icon:'🏅',name:'7 Day Streak',desc:'Keep a 7-day daily reward streak',ok:streak >= 7},
      {icon:'🧭',name:'Task Explorer',desc:'Complete at least 3 verified tasks',ok:tasks >= 3}
    ];
  }

  function levelFor(profile) {
    const mined = num(profile?.totalMined);
    if (mined >= 1000) return 'NOVA ELITE';
    if (mined >= 500) return 'PLATINUM';
    if (mined >= 250) return 'GOLD';
    if (mined >= 100) return 'SILVER';
    if (mined >= 24) return 'BRONZE';
    return 'ROOKIE';
  }

  function renderOwn(profile, rankText) {
    if (!profile) return;
    const mined = num(profile.totalMined);
    const streak = num(profile.dailyRewardStreak);
    const badges = badgesFor(profile);
    const unlocked = badges.filter(b => b.ok).length;
    const rank = rankText || document.getElementById('nxMyRank')?.textContent || '—';

    const put = (id, value) => { const el=document.getElementById(id); if (el) el.textContent=value; };
    put('nxMyMined', `${mined.toFixed(0)} NVX`);
    put('nxMyStreak', `${streak} 🔥`);
    put('nxMyBadges', `${unlocked}/${badges.length}`);
    put('nxMyRank', rank);
    put('nxMiniRank', rank);
    put('nxMiniStreak', `${streak} 🔥`);
    put('nxMiniBadges', `${unlocked}/${badges.length}`);
    put('nxMiniLevel', levelFor(profile));

    const grid = document.getElementById('nxBadgeGrid');
    if (grid) grid.innerHTML = badges.map(b => `
      <div class="nx-badge ${b.ok ? 'unlocked' : ''}">
        <div class="nx-badge-icon">${b.icon}</div>
        <div><strong>${esc(b.name)} ${b.ok ? '✓' : '🔒'}</strong><small>${esc(b.desc)}</small></div>
      </div>`).join('');
  }

  function status(text, good=false) {
    const el = document.getElementById('nxLeagueStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = good ? '#22c55e' : '';
  }

  async function waitForFirebaseApp(appMod) {
    for (let i=0;i<40;i++) {
      const apps = appMod.getApps();
      if (apps.length) return apps[0];
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return null;
  }

  function publicShape(profile, timestamp) {
    return {
      name:String(profile?.name || 'Miner User').slice(0,80),
      totalMined:num(profile?.totalMined),
      tasksCompleted:num(profile?.tasksCompleted),
      dailyRewardStreak:num(profile?.dailyRewardStreak),
      updatedAt:timestamp
    };
  }

  function schedulePublicSync(profile) {
    if (!auth?.currentUser || !profile) return;
    const signature = JSON.stringify([
      profile.name || '', num(profile.totalMined), num(profile.tasksCompleted), num(profile.dailyRewardStreak)
    ]);
    if (signature === lastSyncSignature) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncPublicProfile(profile, signature).catch(() => {}), 700);
  }

  async function syncPublicProfile(profile, signature) {
    const user = auth?.currentUser;
    if (!user || !db || !fs) return;
    try {
      await user.reload();
      if (!auth.currentUser?.emailVerified) {
        status('Verify your email to publish your leaderboard position.');
        return;
      }
      await auth.currentUser.getIdToken(true);
      const ref = fs.doc(db, 'leaderboardPublic', user.uid);
      await fs.setDoc(ref, publicShape(profile, fs.serverTimestamp()));
      lastSyncSignature = signature;
      status('League profile verified • rankings are synced securely.', true);
      await loadLeaderboard(false);
    } catch (error) {
      const code = String(error?.code || '');
      if (code.includes('permission-denied')) status('Leaderboard security rules are not published yet. Owner setup required once.');
      else status('Leaderboard sync is temporarily unavailable. Your mining balance is unaffected.');
      console.warn('NexusNova leaderboard sync:', error);
    }
  }

  async function loadLeaderboard(showLoading=true) {
    if (!db || !fs || !auth?.currentUser) return;
    const list = document.getElementById('nxLeaderboardList');
    if (showLoading && list) list.innerHTML = '<div class="status">Loading verified miners…</div>';
    try {
      const q = fs.query(fs.collection(db,'leaderboardPublic'), fs.orderBy('totalMined','desc'), fs.limit(50));
      const snap = await fs.getDocs(q);
      const rows = snap.docs.map(d => ({...d.data(), __docId:d.id}));
      const myUid = auth.currentUser.uid;
      const myIndex = rows.findIndex(row => row.__docId === myUid);
      const rankText = myIndex >= 0 ? `#${myIndex+1}` : (rows.length >= 50 ? '50+' : '—');
      renderOwn(ownProfile, rankText);
      if (!list) return;
      if (!rows.length) {
        list.innerHTML = '<div class="status">The league is ready. Be the first verified miner on the board.</div>';
        return;
      }
      list.innerHTML = rows.map((row,index) => {
        const rank = index + 1;
        const cls = rank===1?'top1':rank===2?'top2':rank===3?'top3':'';
        const mine = row.__docId === myUid ? ' me' : '';
        return `<div class="nx-leader-row${mine}">
          <div class="nx-rank ${cls}">${rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank}</div>
          <div class="nx-leader-name"><strong>${esc(row.name || 'Miner User')}${row.__docId===myUid?' • YOU':''}</strong><small>🔥 ${num(row.dailyRewardStreak)} day streak • ${num(row.tasksCompleted)} tasks</small></div>
          <div class="nx-leader-score"><strong>${num(row.totalMined).toFixed(0)} NVX</strong><small>mined</small></div>
        </div>`;
      }).join('');
    } catch (error) {
      if (list) list.innerHTML = '<div class="status">Leaderboard is waiting for the latest Firestore Rules publication.</div>';
      console.warn('NexusNova leaderboard read:', error);
    }
  }

  async function attachOwnProfile(user) {
    if (unsubscribeOwn) { try { unsubscribeOwn(); } catch (_) {} unsubscribeOwn=null; }
    if (!user || !db || !fs) return;
    const ref = fs.doc(db,'users',user.uid);
    unsubscribeOwn = fs.onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      ownProfile = snap.data();
      renderOwn(ownProfile);
      schedulePublicSync(ownProfile);
    }, error => console.warn('NexusNova progress profile:', error));
    await loadLeaderboard(true).catch(() => {});
  }

  async function bootFirebase() {
    if (bootedFirebase) return;
    bootedFirebase = true;
    try {
      const [appMod, authMod, fsMod] = await Promise.all([import(APP_URL),import(AUTH_URL),import(FS_URL)]);
      const app = await waitForFirebaseApp(appMod);
      if (!app) {
        status('Waiting for NexusNova account services…');
        bootedFirebase = false;
        setTimeout(bootFirebase, 1500);
        return;
      }
      fs = fsMod;
      auth = authMod.getAuth(app);
      db = fsMod.getFirestore(app);
      authMod.onAuthStateChanged(auth, user => {
        if (!user) {
          status('Sign in to join the NexusNova Community League.');
          return;
        }
        attachOwnProfile(user).catch(error => console.warn('NexusNova progress attach:', error));
      });
    } catch (error) {
      bootedFirebase = false;
      status('Community League could not initialize yet.');
      console.warn('NexusNova community init:', error);
      setTimeout(bootFirebase, 2000);
    }
  }

  function ensureUI() {
    ensureStyle();
    ensureSection();
    ensureMenuButton();
    ensureMiniCard();
    const refresh = document.getElementById('nxLeagueRefresh');
    if (refresh && refresh.dataset.nxBound !== '1') {
      refresh.dataset.nxBound='1';
      refresh.addEventListener('click', () => loadLeaderboard(true));
    }
    const profile = document.getElementById('nxLeagueProfile');
    if (profile && profile.dataset.nxBound !== '1') {
      profile.dataset.nxBound='1';
      profile.addEventListener('click', () => showTab('profile'));
    }
  }

  function boot() {
    ensureUI();
    [400,1000,2200,4500].forEach(ms => setTimeout(ensureUI,ms));
    bootFirebase();
  }

  window.nexusOpenLeaderboard = openLeague;
  window.nexusRefreshLeaderboard = () => loadLeaderboard(true);
  window.nexusCommunityProgressVersion = 'league-v1';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();