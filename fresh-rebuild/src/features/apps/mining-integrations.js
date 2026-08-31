import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

const TASK_SOCIALS = Object.freeze([
  {
    id: 'telegram',
    label: 'Telegram',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova channel',
    href: 'https://t.me/NexusNovaTools',
    glyph: 'TG',
    action: 'OPEN'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova page',
    href: 'https://web.facebook.com/NexusNovaTools/',
    glyph: 'f',
    action: 'OPEN'
  },
  {
    id: 'website',
    label: 'NexusNova Tools',
    handle: 'nexusnovatools.com',
    detail: 'Official NexusNova home',
    href: 'https://nexusnovatools.com/',
    glyph: 'N',
    action: 'VISIT'
  }
]);

function ensureMiningTasksPremiumStyles() {
  if (document.getElementById('nx-mining-tasks-premium-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-mining-tasks-premium-v1';
  style.textContent = `
    .nx-tasks-premium{
      position:relative;isolation:isolate;display:flex!important;flex-direction:column!important;gap:10px!important;
      min-height:calc(100dvh - 190px);padding:0 0 8px;overflow:visible;
      background:
        radial-gradient(circle at 92% 12%,rgba(44,205,255,.10),transparent 24%),
        radial-gradient(circle at 5% 70%,rgba(126,88,255,.085),transparent 28%),
        linear-gradient(180deg,rgba(6,18,32,.02),rgba(5,15,28,.28) 64%,rgba(7,19,34,.58));
    }
    .nx-tasks-premium>.nx-reward-hero{
      position:relative;overflow:hidden;min-height:132px;padding:18px 18px 16px;border-color:rgba(67,213,255,.24)!important;
      background:
        radial-gradient(circle at 82% 8%,rgba(89,214,255,.21),transparent 30%),
        radial-gradient(circle at 98% 92%,rgba(125,82,255,.16),transparent 34%),
        linear-gradient(145deg,rgba(13,50,78,.97),rgba(7,24,43,.98) 58%,rgba(8,18,34,.99))!important;
      box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.055),0 0 34px rgba(40,190,255,.055)!important;
    }
    .nx-tasks-premium>.nx-reward-hero::before{
      content:'';position:absolute;right:-34px;top:-51px;width:170px;height:170px;border-radius:50%;
      border:1px solid rgba(118,225,255,.13);box-shadow:inset 0 0 42px rgba(68,194,255,.06),0 0 36px rgba(84,115,255,.06);
      animation:nxTasksOrbit 8s linear infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero::after{
      content:'';position:absolute;right:32px;top:25px;width:8px;height:8px;border-radius:50%;background:#63e9ff;
      box-shadow:0 0 0 7px rgba(99,233,255,.055),0 0 22px rgba(99,233,255,.7);animation:nxTasksPulse 2.4s ease-in-out infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero .nx-eyebrow{position:relative;z-index:1;margin-bottom:8px;color:#70e6ff;letter-spacing:.18em}
    .nx-tasks-premium>.nx-reward-hero>strong{position:relative;z-index:1;display:block;font-size:clamp(28px,8vw,40px);letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 0 24px rgba(77,213,255,.08)}
    .nx-tasks-premium>.nx-reward-hero>span{position:relative;z-index:1;display:inline-flex;margin-top:11px;padding:5px 8px;border:1px solid rgba(107,221,255,.12);border-radius:999px;background:rgba(6,23,40,.46);color:#a9bed0;font-size:9px;font-weight:800;letter-spacing:.035em}

    .nx-community-live{
      position:relative;overflow:hidden;padding:14px!important;border-color:rgba(99,188,255,.16)!important;
      background:linear-gradient(155deg,rgba(10,32,52,.95),rgba(7,19,34,.96))!important;
      box-shadow:0 15px 35px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.035)!important;
    }
    .nx-community-live::before{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 0 41%,rgba(83,216,255,.035) 49%,transparent 58%);transform:translateX(-65%);animation:nxTasksScan 7s ease-in-out infinite;pointer-events:none}
    .nx-community-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .nx-community-head .nx-eyebrow{margin:0}
    .nx-community-live-state{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid rgba(58,224,171,.16);border-radius:999px;background:rgba(39,226,164,.07);color:#8ff0ca;font-size:8px;font-weight:900;letter-spacing:.08em}
    .nx-community-live-state i{width:6px;height:6px;border-radius:50%;background:#35e3a7;box-shadow:0 0 12px rgba(53,227,167,.75);animation:nxTasksPulse 2s ease-in-out infinite}
    .nx-community-grid{position:relative;z-index:1;display:grid;gap:7px}
    .nx-social-mission{
      min-width:0;min-height:60px;padding:9px 10px;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;
      border:1px solid rgba(139,199,237,.11);border-radius:15px;background:linear-gradient(145deg,rgba(15,42,65,.82),rgba(7,24,41,.9));
      color:inherit;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:transform .16s ease,border-color .16s linear,background .16s linear;
    }
    .nx-social-mission:active{transform:scale(.987)}
    .nx-social-mission:hover{border-color:rgba(91,213,255,.25);background:linear-gradient(145deg,rgba(18,51,76,.9),rgba(8,28,47,.94))}
    .nx-social-glyph{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(109,215,255,.15);border-radius:12px;background:radial-gradient(circle at 34% 25%,rgba(100,226,255,.20),transparent 38%),linear-gradient(145deg,rgba(27,108,158,.56),rgba(17,54,94,.72));box-shadow:0 7px 18px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.06);color:#e9fbff;font-size:12px;font-weight:950;letter-spacing:-.03em}
    .nx-social-mission[data-social-task="facebook"] .nx-social-glyph{background:linear-gradient(145deg,rgba(52,112,226,.72),rgba(22,63,146,.78));font-size:20px}
    .nx-social-mission[data-social-task="telegram"] .nx-social-glyph{background:linear-gradient(145deg,rgba(45,177,229,.72),rgba(18,89,154,.8));font-size:10px;letter-spacing:.02em}
    .nx-social-mission[data-social-task="website"] .nx-social-glyph{background:linear-gradient(145deg,rgba(80,91,226,.66),rgba(68,38,154,.74));font-size:16px}
    .nx-social-copy{min-width:0}
    .nx-social-copy strong{display:block;font-size:11.5px;line-height:1.2;color:#f2f8ff}
    .nx-social-copy span{display:block;margin-top:3px;color:#8fb0c7;font-size:9px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nx-social-copy small{display:block;margin-top:2px;color:#607d95;font-size:7.5px;line-height:1.2}
    .nx-social-action{min-width:49px;padding:6px 7px;border:1px solid rgba(89,212,255,.17);border-radius:10px;background:rgba(31,137,186,.11);color:#a9eaff;font-size:7.5px;font-weight:950;letter-spacing:.075em;text-align:center}
    .nx-community-security{position:relative;z-index:1;display:flex;align-items:center;gap:7px;margin:10px 2px 0;color:#708aa0;font-size:8px;line-height:1.35}
    .nx-community-security i{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:#43d8ff;box-shadow:0 0 11px rgba(67,216,255,.5)}

    .nx-tasks-premium>.nx-tool-card:not(.nx-community-live){
      padding:12px 13px!important;border-radius:17px!important;border-color:rgba(128,192,230,.12)!important;
      background:linear-gradient(150deg,rgba(10,29,48,.91),rgba(6,18,32,.95))!important;
      box-shadow:0 12px 30px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.025)!important;
    }
    .nx-tasks-premium .nx-reward-row{gap:10px}
    .nx-tasks-premium .nx-reward-row>div>strong{font-size:12px}
    .nx-tasks-premium .nx-reward-row>div>p{margin:4px 0 0;color:#7893a9;font-size:9px;line-height:1.4}
    .nx-tasks-premium .nx-reward-row>button{min-height:42px;padding:0 12px;border-radius:13px;border-color:rgba(80,203,255,.18);background:linear-gradient(145deg,rgba(17,104,157,.58),rgba(13,67,112,.62));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 20px rgba(0,0,0,.13);font-size:8px}
    .nx-tasks-premium .nx-tool-meta{margin-top:8px;color:#637e94;font-size:8.5px;line-height:1.4}
    .nx-task-network-floor{position:relative;overflow:hidden;min-height:82px;margin-top:auto;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:13px;border:1px solid rgba(96,162,210,.09);border-radius:18px;background:radial-gradient(circle at 92% 20%,rgba(109,78,255,.13),transparent 34%),linear-gradient(145deg,rgba(7,24,41,.74),rgba(6,16,30,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.02)}
    .nx-task-network-floor strong{display:block;color:#cae9f7;font-size:9px;letter-spacing:.1em}
    .nx-task-network-floor span{display:block;margin-top:5px;color:#5e7b91;font-size:8px;line-height:1.35}
    .nx-task-network-core{position:relative;flex:0 0 46px;width:46px;height:46px;border-radius:50%;border:1px solid rgba(95,211,255,.18);box-shadow:inset 0 0 18px rgba(63,198,255,.08),0 0 22px rgba(87,86,255,.08);animation:nxTasksOrbit 7s linear infinite}
    .nx-task-network-core::before,.nx-task-network-core::after{content:'';position:absolute;border-radius:50%}
    .nx-task-network-core::before{inset:10px;border:1px solid rgba(137,104,255,.24)}
    .nx-task-network-core::after{left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);background:#6be4ff;box-shadow:0 0 16px rgba(107,228,255,.75)}

    @keyframes nxTasksPulse{0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes nxTasksOrbit{to{transform:rotate(360deg)}}
    @keyframes nxTasksScan{0%,18%{transform:translateX(-70%)}62%,100%{transform:translateX(82%)}}
    @media(max-width:380px){
      .nx-tasks-premium{min-height:calc(100dvh - 178px)}
      .nx-social-mission{grid-template-columns:36px minmax(0,1fr) auto;gap:8px;padding:8px;min-height:56px}
      .nx-social-glyph{width:36px;height:36px}.nx-social-action{min-width:44px;padding-inline:5px}
      .nx-tasks-premium>.nx-reward-hero{min-height:124px;padding:16px}
    }
    @media(prefers-reduced-motion:reduce){
      .nx-tasks-premium>.nx-reward-hero::before,.nx-tasks-premium>.nx-reward-hero::after,.nx-community-live::before,.nx-community-live-state i,.nx-task-network-core{animation:none!important}
    }
  `;
  document.head.appendChild(style);
}

function socialRowsHtml() {
  return TASK_SOCIALS.map(item => `
    <a class="nx-social-mission" data-social-task="${item.id}" href="${item.href}" target="_blank" rel="noopener noreferrer" aria-label="Open ${item.label} ${item.handle}">
      <span class="nx-social-glyph" aria-hidden="true">${item.glyph}</span>
      <span class="nx-social-copy"><strong>${item.label}</strong><span>${item.handle}</span><small>${item.detail}</small></span>
      <span class="nx-social-action">${item.action}</span>
    </a>
  `).join('');
}

function communityTaskPanel() {
  const section = document.createElement('section');
  section.className = 'nx-tool-card nx-community-live';
  section.innerHTML = `
    <div class="nx-community-head">
      <p class="nx-eyebrow">COMMUNITY NETWORK</p>
      <span class="nx-community-live-state"><i aria-hidden="true"></i>LINKS ONLINE</span>
    </div>
    <div class="nx-community-grid">${socialRowsHtml()}</div>
    <p class="nx-community-security"><i aria-hidden="true"></i>Community mission verification stays server-side; profile opening never credits NVX on the client.</p>
  `;
  return section;
}

function networkFloor() {
  const floor = document.createElement('div');
  floor.className = 'nx-task-network-floor';
  floor.setAttribute('aria-label', 'NexusNova community network status');
  floor.innerHTML = `
    <div><strong>NEXUSNOVA NETWORK</strong><span>Official community destinations connected to Tasks.</span></div>
    <span class="nx-task-network-core" aria-hidden="true"></span>
  `;
  return floor;
}

function enhanceMiningTasks(root) {
  ensureMiningTasksPremiumStyles();
  root.classList.add('nx-tasks-premium');
  root.dataset.socialMissionVerification = 'server-only';

  const hero = root.querySelector('.nx-reward-hero');
  const eyebrow = hero?.querySelector('.nx-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MINING TASKS';
  hero?.insertAdjacentElement('afterend', communityTaskPanel());
  root.appendChild(networkFloor());
}

function rewardText(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

function enhanceMiningNovaVault(root) {
  const panel = document.createElement('section');
  panel.className = 'nx-tool-card';
  panel.innerHTML = `
    <div class="nx-list-card__head">
      <div><p class="nx-eyebrow">SECURE 10X VAULT</p><strong>10X premium reward chance</strong></div>
      <span class="nx-badge" data-10x-credits>0 CREDITS</span>
    </div>
    <p class="nx-tool-meta">A verified rewarded-ad credit unlocks one boosted Vault opening. Premium reward weights are multiplied by 10 on the secure server; the client never chooses the reward.</p>
    <div class="nx-action-row">
      <button type="button" data-10x-watch>WATCH AD FOR 10X</button>
      <button type="button" data-10x-open disabled>OPEN 10X VAULT</button>
    </div>
    <p class="nx-tool-meta" data-10x-status>Checking secure 10X credits…</p>
  `;

  const firstTool = root.querySelector('.nx-tool-card');
  firstTool?.insertAdjacentElement('beforebegin', panel);

  const creditBadge = panel.querySelector('[data-10x-credits]');
  const watchButton = panel.querySelector('[data-10x-watch]');
  const openButton = panel.querySelector('[data-10x-open]');
  const status = panel.querySelector('[data-10x-status]');
  const baseCleanup = root.__cleanup;
  let profileOff = null;
  let credits = 0;
  let busy = false;
  let active = true;

  const paint = () => {
    if (!active) return;
    creditBadge.textContent = `${credits} CREDIT${credits === 1 ? '' : 'S'}`;
    creditBadge.classList.toggle('good', credits > 0);
    watchButton.disabled = busy;
    openButton.disabled = busy || credits < 1;
    openButton.textContent = credits > 0 ? `OPEN 10X VAULT (${credits})` : 'OPEN 10X VAULT';
  };

  const bindCredits = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        credits = Math.max(0, Math.floor(Number(snap.data()?.novaVaultBoostCredits) || 0));
        paint();
        if (!busy) status.textContent = credits > 0
          ? 'Secure 10X credit ready. One pending Nova Vault is also required.'
          : 'Watch the rewarded ad to unlock a secure 10X credit.';
      }, error => {
        if (active) status.textContent = error?.message || 'Could not read 10X credit status.';
      });
      if (!active) unsubscribe();
      else profileOff = unsubscribe;
    } catch (error) {
      if (active) status.textContent = error?.message || 'Could not read 10X credit status.';
    }
  };

  const waitForCredit = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) {
      if (credits > before) return true;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    return active && credits > before;
  };

  watchButton.addEventListener('click', async () => {
    if (!active || busy) return;
    busy = true;
    paint();
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = credits;
      if (active) status.textContent = 'Opening rewarded ad for secure 10X verification…';
      const result = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!result.earned) throw new Error('Ad closed before reward completion. No 10X credit was created.');
      if (!active) return;
      if (result.testMode || nativeAds.status().testMode) {
        status.textContent = '✓ TEST ad completed. TEST ads do not create secure 10X credits; production SSV verification is required.';
        return;
      }
      status.textContent = 'Ad completed • waiting for signed server verification…';
      const verified = await waitForCredit(before);
      if (!active) return;
      if (!verified) throw new Error('The signed 10X credit has not arrived yet. Check again shortly; no client-side credit was created.');
      status.textContent = '✓ Secure 10X credit verified. You can open the boosted Vault now.';
    } catch (error) {
      if (active) status.textContent = error?.message || '10X rewarded flow could not be completed.';
    } finally {
      busy = false;
      paint();
    }
  });

  openButton.addEventListener('click', async () => {
    if (!active || busy || credits < 1) return;
    busy = true;
    paint();
    if (active) status.textContent = 'Opening boosted Vault on the secure server…';
    try {
      await requireFirebaseUser({ write:true });
      const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'openNovaVaultBoosted');
      const response = await call({ source:'fresh-rebuild-10x' });
      const data = response?.data || {};
      if (data.opened !== true || data.boosted !== true) throw new Error('Secure 10X Vault response was invalid.');
      if (active) status.textContent = `✓ 10X Vault opened • ${rewardText(data.reward)}.`;
    } catch (error) {
      if (active) status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
    } finally {
      busy = false;
      paint();
    }
  });

  nativeAds.requestStatus();
  bindCredits();
  paint();
  root.__cleanup = () => {
    active = false;
    profileOff?.();
    profileOff = null;
    baseCleanup?.();
  };
}

export function enhanceMiningApp(id, root) {
  if (!(root instanceof HTMLElement)) return root;
  if (id === 'tasks') enhanceMiningTasks(root);
  else if (id === 'nova-vault' && root.dataset.vaultV3Integrated !== 'true') enhanceMiningNovaVault(root);
  return root;
}
