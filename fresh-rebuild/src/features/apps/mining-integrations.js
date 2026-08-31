import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

const TASK_SOCIALS = Object.freeze([
  {
    id: 'x',
    label: 'X',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova profile',
    href: 'https://x.com/NexusNovaTools',
    glyph: 'X',
    action: 'FOLLOW'
  },
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@nexusnovatools',
    detail: 'Official NexusNova profile',
    href: 'https://www.instagram.com/nexusnovatools/',
    glyph: 'IG',
    action: 'FOLLOW'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova page',
    href: 'https://web.facebook.com/NexusNovaTools/',
    glyph: 'f',
    action: 'FOLLOW'
  },
  {
    id: 'telegram',
    label: 'Telegram',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova channel',
    href: 'https://t.me/NexusNovaTools',
    glyph: 'TG',
    action: 'JOIN'
  }
]);

function ensureMiningTasksPremiumStyles() {
  if (document.getElementById('nx-mining-tasks-premium-v2')) return;
  const style = document.createElement('style');
  style.id = 'nx-mining-tasks-premium-v2';
  style.textContent = `
    .nx-tasks-premium{
      position:relative;isolation:isolate;display:grid!important;gap:9px!important;padding:0 0 8px!important;
      background:
        radial-gradient(circle at 94% 12%,rgba(44,205,255,.09),transparent 22%),
        radial-gradient(circle at 8% 62%,rgba(126,88,255,.065),transparent 24%);
    }
    .nx-tasks-premium>.nx-reward-hero{
      position:relative;overflow:hidden;min-height:118px;padding:16px 17px 14px;border-color:rgba(67,213,255,.23)!important;
      background:
        radial-gradient(circle at 84% 8%,rgba(89,214,255,.20),transparent 29%),
        radial-gradient(circle at 100% 94%,rgba(125,82,255,.14),transparent 31%),
        linear-gradient(145deg,rgba(13,50,78,.97),rgba(7,24,43,.98) 58%,rgba(8,18,34,.99))!important;
      box-shadow:0 16px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.05),0 0 30px rgba(40,190,255,.045)!important;
    }
    .nx-tasks-premium>.nx-reward-hero::before{
      content:'';position:absolute;right:-38px;top:-58px;width:164px;height:164px;border-radius:50%;
      border:1px solid rgba(118,225,255,.12);box-shadow:inset 0 0 38px rgba(68,194,255,.055),0 0 30px rgba(84,115,255,.055);
      animation:nxTasksOrbit 9s linear infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero::after{
      content:'';position:absolute;right:31px;top:23px;width:7px;height:7px;border-radius:50%;background:#63e9ff;
      box-shadow:0 0 0 6px rgba(99,233,255,.05),0 0 19px rgba(99,233,255,.68);animation:nxTasksPulse 2.4s ease-in-out infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero .nx-eyebrow{position:relative;z-index:1;margin-bottom:7px;color:#70e6ff;letter-spacing:.18em}
    .nx-tasks-premium>.nx-reward-hero>strong{position:relative;z-index:1;display:block;font-size:clamp(27px,7.5vw,38px);letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
    .nx-tasks-premium>.nx-reward-hero>span{position:relative;z-index:1;display:inline-flex;margin-top:10px;padding:4px 8px;border:1px solid rgba(107,221,255,.11);border-radius:999px;background:rgba(6,23,40,.43);color:#a9bed0;font-size:8.5px;font-weight:800;letter-spacing:.035em}

    .nx-community-live{
      position:relative;overflow:hidden;padding:12px!important;border-color:rgba(99,188,255,.15)!important;
      background:linear-gradient(155deg,rgba(10,32,52,.95),rgba(7,19,34,.96))!important;
      box-shadow:0 13px 30px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.03)!important;
    }
    .nx-community-live::before{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 0 42%,rgba(83,216,255,.03) 49%,transparent 57%);transform:translateX(-70%);animation:nxTasksScan 8s ease-in-out infinite;pointer-events:none}
    .nx-community-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .nx-community-head .nx-eyebrow{margin:0}
    .nx-community-live-state{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid rgba(58,224,171,.14);border-radius:999px;background:rgba(39,226,164,.055);color:#8ff0ca;font-size:7px;font-weight:900;letter-spacing:.08em}
    .nx-community-live-state i{width:5px;height:5px;border-radius:50%;background:#35e3a7;box-shadow:0 0 10px rgba(53,227,167,.7);animation:nxTasksPulse 2s ease-in-out infinite}
    .nx-community-grid{position:relative;z-index:1;display:grid;gap:6px}
    .nx-social-mission{
      width:100%;min-width:0;min-height:54px;padding:7px 9px;display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:9px;
      border:1px solid rgba(139,199,237,.10);border-radius:14px;background:linear-gradient(145deg,rgba(15,42,65,.80),rgba(7,24,41,.89));
      color:inherit;text-align:left;box-shadow:inset 0 1px 0 rgba(255,255,255,.022);cursor:pointer;
      transition:transform .15s ease,border-color .15s linear,background .15s linear;
    }
    .nx-social-mission:active{transform:scale(.986)}
    .nx-social-mission:hover{border-color:rgba(91,213,255,.24);background:linear-gradient(145deg,rgba(18,51,76,.88),rgba(8,28,47,.93))}
    .nx-social-glyph{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(109,215,255,.14);border-radius:11px;background:linear-gradient(145deg,rgba(27,108,158,.56),rgba(17,54,94,.72));box-shadow:0 6px 16px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.055);color:#f4fcff;font-size:11px;font-weight:950;letter-spacing:-.03em}
    .nx-social-mission[data-social-task="x"] .nx-social-glyph{background:linear-gradient(145deg,rgba(32,38,48,.96),rgba(4,8,14,.99));border-color:rgba(255,255,255,.13);font-size:15px}
    .nx-social-mission[data-social-task="instagram"] .nx-social-glyph{background:radial-gradient(circle at 69% 72%,rgba(255,188,64,.68),transparent 29%),linear-gradient(145deg,rgba(203,51,126,.88),rgba(100,55,201,.92));border-color:rgba(255,190,230,.17);font-size:8px;letter-spacing:.03em}
    .nx-social-mission[data-social-task="facebook"] .nx-social-glyph{background:linear-gradient(145deg,rgba(52,112,226,.72),rgba(22,63,146,.80));font-size:19px}
    .nx-social-mission[data-social-task="telegram"] .nx-social-glyph{background:linear-gradient(145deg,rgba(45,177,229,.72),rgba(18,89,154,.82));font-size:9px;letter-spacing:.02em}
    .nx-social-copy{min-width:0}
    .nx-social-copy strong{display:block;color:#f2f8ff;font-size:11px;line-height:1.15}
    .nx-social-copy span{display:block;margin-top:3px;color:#8fb0c7;font-size:8.5px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nx-social-copy small{display:block;margin-top:2px;color:#607d95;font-size:7px;line-height:1.15}
    .nx-social-action{min-width:51px;padding:6px 7px;border:1px solid rgba(89,212,255,.16);border-radius:9px;background:rgba(31,137,186,.10);color:#b4edff;font-size:7px;font-weight:950;letter-spacing:.075em;text-align:center}

    .nx-tasks-premium>.nx-tool-card:not(.nx-community-live){
      padding:11px 12px!important;border-radius:16px!important;border-color:rgba(128,192,230,.11)!important;
      background:linear-gradient(150deg,rgba(10,29,48,.90),rgba(6,18,32,.94))!important;
      box-shadow:0 11px 26px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.022)!important;
    }
    .nx-tasks-premium .nx-reward-row{gap:9px}
    .nx-tasks-premium .nx-reward-row>div>strong{font-size:11.5px}
    .nx-tasks-premium .nx-reward-row>div>p{margin:4px 0 0;color:#7893a9;font-size:8.5px;line-height:1.35}
    .nx-tasks-premium .nx-reward-row>button{min-height:40px;padding:0 11px;border-radius:12px;border-color:rgba(80,203,255,.17);background:linear-gradient(145deg,rgba(17,104,157,.56),rgba(13,67,112,.60));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 7px 18px rgba(0,0,0,.12);font-size:7.5px}
    .nx-tasks-premium .nx-tool-meta{margin-top:7px;color:#637e94;font-size:8px;line-height:1.35}

    .nx-task-follow-gate{
      position:fixed;inset:0;z-index:2147483600;display:grid;align-items:end;padding:14px 12px calc(env(safe-area-inset-bottom) + 14px);
      background:rgba(1,7,16,.74);backdrop-filter:blur(9px) saturate(115%);-webkit-backdrop-filter:blur(9px) saturate(115%);
      opacity:0;pointer-events:none;transition:opacity .16s ease;
    }
    .nx-task-follow-gate[hidden]{display:none!important}
    .nx-task-follow-gate.is-open{opacity:1;pointer-events:auto}
    .nx-task-follow-sheet{
      width:min(100%,520px);margin:0 auto;padding:15px;border:1px solid rgba(96,208,255,.19);border-radius:22px;
      background:radial-gradient(circle at 92% 0,rgba(94,95,255,.15),transparent 31%),linear-gradient(155deg,rgba(13,37,59,.995),rgba(5,18,32,.998));
      box-shadow:0 24px 64px rgba(0,0,0,.50),inset 0 1px 0 rgba(255,255,255,.05);transform:translateY(18px) scale(.987);transition:transform .18s cubic-bezier(.2,.8,.2,1);
    }
    .nx-task-follow-gate.is-open .nx-task-follow-sheet{transform:none}
    .nx-task-follow-top{display:flex;align-items:center;justify-content:space-between;gap:11px}
    .nx-task-follow-id{display:flex;align-items:center;gap:10px;min-width:0}
    .nx-task-follow-mark{flex:0 0 42px;width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(114,218,255,.16);border-radius:13px;background:linear-gradient(145deg,rgba(25,106,157,.64),rgba(31,50,110,.74));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 7px 18px rgba(0,0,0,.20);font-size:11px;font-weight:950;color:#fff}
    .nx-task-follow-copy{min-width:0}.nx-task-follow-copy small{display:block;color:#61dffc;font-size:7px;font-weight:900;letter-spacing:.13em}.nx-task-follow-copy strong{display:block;margin-top:3px;font-size:15px;line-height:1.15}.nx-task-follow-copy span{display:block;margin-top:3px;color:#8da9bd;font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nx-task-follow-close{flex:0 0 36px;width:36px;height:36px;border:1px solid rgba(154,204,255,.11);border-radius:11px;background:rgba(11,31,50,.86);color:#b8ccda;font-size:18px;cursor:pointer}
    .nx-task-follow-message{margin:13px 1px 0;color:#9cb2c4;font-size:9.5px;line-height:1.5}
    .nx-task-follow-actions{display:grid;grid-template-columns:82px minmax(0,1fr);gap:7px;margin-top:12px}
    .nx-task-follow-actions button{min-height:44px;border-radius:13px;font-size:8.5px;font-weight:950;letter-spacing:.06em;cursor:pointer}
    .nx-task-follow-cancel{border:1px solid rgba(149,178,203,.12);background:rgba(12,30,48,.76);color:#8ca5b8}
    .nx-task-follow-go{border:1px solid rgba(86,220,255,.24);background:linear-gradient(135deg,rgba(24,135,197,.92),rgba(57,82,199,.84));color:#fff;box-shadow:0 9px 22px rgba(18,96,184,.18),inset 0 1px 0 rgba(255,255,255,.08)}

    @keyframes nxTasksPulse{0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes nxTasksOrbit{to{transform:rotate(360deg)}}
    @keyframes nxTasksScan{0%,18%{transform:translateX(-72%)}62%,100%{transform:translateX(84%)}}
    @media(max-width:380px){
      .nx-social-mission{grid-template-columns:34px minmax(0,1fr) auto;gap:7px;padding:7px 8px;min-height:52px}
      .nx-social-glyph{width:34px;height:34px}.nx-social-action{min-width:46px;padding-inline:5px}
      .nx-tasks-premium>.nx-reward-hero{min-height:112px;padding:15px}
      .nx-task-follow-gate{padding-inline:9px}.nx-task-follow-sheet{padding:13px;border-radius:20px}.nx-task-follow-actions{grid-template-columns:76px minmax(0,1fr)}
    }
    @media(prefers-reduced-motion:reduce){
      .nx-tasks-premium>.nx-reward-hero::before,.nx-tasks-premium>.nx-reward-hero::after,.nx-community-live::before,.nx-community-live-state i,.nx-task-follow-gate,.nx-task-follow-sheet{animation:none!important;transition:none!important}
    }
  `;
  document.head.appendChild(style);
}

function socialRowsHtml() {
  return TASK_SOCIALS.map(item => `
    <button class="nx-social-mission" data-social-task="${item.id}" type="button" aria-label="${item.action} ${item.label} ${item.handle}">
      <span class="nx-social-glyph" aria-hidden="true">${item.glyph}</span>
      <span class="nx-social-copy"><strong>${item.label}</strong><span>${item.handle}</span><small>${item.detail}</small></span>
      <span class="nx-social-action">${item.action}</span>
    </button>
  `).join('');
}

function communityTaskPanel() {
  const section = document.createElement('section');
  section.className = 'nx-tool-card nx-community-live';
  section.innerHTML = `
    <div class="nx-community-head">
      <p class="nx-eyebrow">OFFICIAL COMMUNITY</p>
      <span class="nx-community-live-state"><i aria-hidden="true"></i>ONLINE</span>
    </div>
    <div class="nx-community-grid">${socialRowsHtml()}</div>
  `;
  return section;
}

function followGate() {
  const gate = document.createElement('div');
  gate.className = 'nx-task-follow-gate';
  gate.hidden = true;
  gate.innerHTML = `
    <section class="nx-task-follow-sheet" role="dialog" aria-modal="true" aria-labelledby="nxTaskFollowTitle">
      <div class="nx-task-follow-top">
        <div class="nx-task-follow-id">
          <span class="nx-task-follow-mark" data-follow-mark aria-hidden="true">N</span>
          <span class="nx-task-follow-copy">
            <small data-follow-kicker>OFFICIAL PROFILE</small>
            <strong id="nxTaskFollowTitle" data-follow-title>NexusNova</strong>
            <span data-follow-handle>@NexusNovaTools</span>
          </span>
        </div>
        <button class="nx-task-follow-close" type="button" data-follow-close aria-label="Close">×</button>
      </div>
      <p class="nx-task-follow-message" data-follow-message>Open the official profile, tap Follow there, then return to NexusNova.</p>
      <div class="nx-task-follow-actions">
        <button class="nx-task-follow-cancel" type="button" data-follow-cancel>CANCEL</button>
        <button class="nx-task-follow-go" type="button" data-follow-go>OPEN & FOLLOW</button>
      </div>
    </section>
  `;
  return gate;
}

function bindSocialMissions(root, gate) {
  const mark = gate.querySelector('[data-follow-mark]');
  const kicker = gate.querySelector('[data-follow-kicker]');
  const title = gate.querySelector('[data-follow-title]');
  const handle = gate.querySelector('[data-follow-handle]');
  const message = gate.querySelector('[data-follow-message]');
  const go = gate.querySelector('[data-follow-go]');
  const close = gate.querySelector('[data-follow-close]');
  const cancel = gate.querySelector('[data-follow-cancel]');
  let activeItem = null;

  const hide = () => {
    gate.classList.remove('is-open');
    activeItem = null;
    window.setTimeout(() => { if (!gate.classList.contains('is-open')) gate.hidden = true; }, 170);
  };

  const show = item => {
    activeItem = item;
    mark.textContent = item.glyph;
    kicker.textContent = item.action === 'JOIN' ? 'OFFICIAL CHANNEL' : 'OFFICIAL PROFILE';
    title.textContent = item.label;
    handle.textContent = item.handle;
    message.textContent = item.action === 'JOIN'
      ? 'Open the official Telegram channel, tap Join there, then return to NexusNova.'
      : `Open the official ${item.label} profile, tap Follow there, then return to NexusNova.`;
    go.textContent = item.action === 'JOIN' ? 'OPEN & JOIN' : 'OPEN & FOLLOW';
    gate.hidden = false;
    requestAnimationFrame(() => gate.classList.add('is-open'));
  };

  root.querySelectorAll('.nx-social-mission[data-social-task]').forEach(button => {
    const item = TASK_SOCIALS.find(entry => entry.id === button.dataset.socialTask);
    if (item) button.addEventListener('click', () => show(item));
  });

  close.addEventListener('click', hide);
  cancel.addEventListener('click', hide);
  gate.addEventListener('click', event => { if (event.target === gate) hide(); });
  go.addEventListener('click', () => {
    const item = activeItem;
    if (!item) return;
    const opened = window.open(item.href, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.assign(item.href);
    hide();
  });
}

function enhanceMiningTasks(root) {
  ensureMiningTasksPremiumStyles();
  root.classList.add('nx-tasks-premium');

  const hero = root.querySelector('.nx-reward-hero');
  const eyebrow = hero?.querySelector('.nx-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MINING TASKS';

  const community = communityTaskPanel();
  const gate = followGate();
  hero?.insertAdjacentElement('afterend', community);
  root.appendChild(gate);
  bindSocialMissions(root, gate);
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