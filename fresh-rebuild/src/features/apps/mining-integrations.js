import { callNovaMiningRewards } from '../../core/nova-mining-rewards-store.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

const TASK_SOCIALS = Object.freeze([
  {
    id: 'x',
    label: 'X',
    handle: '@NexusNovaTools',
    href: 'https://x.com/intent/follow?screen_name=NexusNovaTools',
    action: 'FOLLOW'
  },
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@nexusnovatools',
    href: 'https://www.instagram.com/nexusnovatools/',
    action: 'FOLLOW'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: '@NexusNovaTools',
    href: 'https://web.facebook.com/NexusNovaTools/',
    action: 'FOLLOW'
  },
  {
    id: 'telegram',
    label: 'Telegram',
    handle: '@NexusNovaTools',
    href: 'https://t.me/NexusNovaTools',
    action: 'JOIN'
  }
]);

function socialLogoSvg(id) {
  if (id === 'x') return `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.501 11.24h-6.657l-5.214-6.817-5.965 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>`;
  if (id === 'instagram') return `
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="12" r="4.15" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="17.45" cy="6.65" r="1.18"/></svg>`;
  if (id === 'facebook') return `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.82 21v-8h2.68l.4-3.12h-3.08V7.89c0-.9.25-1.52 1.57-1.52h1.68V3.58c-.29-.04-1.29-.12-2.46-.12-2.43 0-4.1 1.49-4.1 4.22v2.2H7.76V13h2.75v8h3.31Z"/></svg>`;
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.55 3.55 18.6 20.1c-.22 1.17-.81 1.46-1.64.91l-4.5-3.32-2.17 2.09c-.24.24-.44.44-.9.44l.32-4.59 8.36-7.55c.36-.32-.08-.5-.56-.18L7.18 14.42l-4.44-1.39c-.97-.3-.99-.97.2-1.44L20.3 4.9c.8-.3 1.5.18 1.25-1.35Z"/></svg>`;
}

function ensureMiningTasksPremiumStyles() {
  if (document.getElementById('nx-mining-tasks-premium-v3')) return;
  const style = document.createElement('style');
  style.id = 'nx-mining-tasks-premium-v3';
  style.textContent = `
    .nx-tasks-premium{
      position:relative;isolation:isolate;display:grid!important;gap:12px!important;
      min-height:calc(100dvh - 275px);padding:0 0 12px!important;align-content:space-between;
      background:
        radial-gradient(circle at 92% 16%,rgba(143,72,255,.055),transparent 23%),
        radial-gradient(circle at 8% 58%,rgba(0,225,255,.045),transparent 25%)!important;
    }
    .nx-tasks-premium>.nx-reward-hero{
      position:relative;overflow:hidden;min-height:126px;padding:17px 18px 15px!important;
      border:1px solid rgba(255,255,255,.10)!important;border-radius:24px!important;
      background:
        linear-gradient(120deg,rgba(255,255,255,.055),transparent 19% 80%,rgba(255,255,255,.025)),
        radial-gradient(circle at 85% 18%,rgba(0,220,255,.17),transparent 24%),
        radial-gradient(circle at 102% 108%,rgba(145,66,255,.16),transparent 32%),
        linear-gradient(155deg,#11161e 0%,#090d13 48%,#06080d 100%)!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.95),
        0 16px 30px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.7)!important;
    }
    .nx-tasks-premium>.nx-reward-hero::before{
      content:'';position:absolute;right:-44px;top:-68px;width:190px;height:190px;border-radius:50%;
      border:1px solid rgba(161,223,255,.15);
      box-shadow:inset 0 0 46px rgba(0,213,255,.055),0 0 42px rgba(120,62,255,.07);
      animation:nxTasksOrbitV3 10s linear infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero::after{
      content:'';position:absolute;right:38px;top:36px;width:9px;height:9px;border-radius:50%;
      background:#7ef0ff;box-shadow:0 0 0 7px rgba(80,224,255,.055),0 0 22px rgba(74,227,255,.72);
      animation:nxTasksPulseV3 2.6s ease-in-out infinite;pointer-events:none;
    }
    .nx-tasks-premium>.nx-reward-hero .nx-eyebrow{position:relative;z-index:1;margin-bottom:8px;color:#96ebff;letter-spacing:.20em;text-shadow:0 0 16px rgba(71,218,255,.2)}
    .nx-tasks-premium>.nx-reward-hero>strong{position:relative;z-index:1;display:block;font-size:clamp(29px,8vw,40px);line-height:1;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:#f8fbff;text-shadow:0 2px 0 rgba(0,0,0,.65)}
    .nx-tasks-premium>.nx-reward-hero>span{position:relative;z-index:1;display:inline-flex;margin-top:12px;padding:5px 10px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(0,0,0,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.08);color:#aeb8c5;font-size:8.5px;font-weight:900;letter-spacing:.035em}

    .nx-community-live{
      position:relative;overflow:hidden;padding:14px!important;border:1px solid rgba(255,255,255,.095)!important;border-radius:25px!important;
      background:
        linear-gradient(115deg,rgba(255,255,255,.04),transparent 18% 82%,rgba(255,255,255,.025)),
        linear-gradient(155deg,#10141b,#070a0f 60%,#05070b)!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.92),
        0 18px 34px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.65)!important;
    }
    .nx-community-live::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(108deg,transparent 0 43%,rgba(255,255,255,.045) 49%,transparent 56%);transform:translateX(-75%);animation:nxTasksScanV3 8.5s ease-in-out infinite}
    .nx-community-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 1px 12px}
    .nx-community-head .nx-eyebrow{margin:0;color:#d6dde7;letter-spacing:.17em}
    .nx-community-live-state{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid rgba(83,255,187,.13);border-radius:999px;background:linear-gradient(180deg,rgba(76,255,187,.085),rgba(24,116,86,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.06);color:#8ef0c3;font-size:7px;font-weight:950;letter-spacing:.1em}
    .nx-community-live-state i{width:6px;height:6px;border-radius:50%;background:#48e6a8;box-shadow:0 0 13px rgba(72,230,168,.75)}
    .nx-community-grid{position:relative;z-index:1;display:grid;gap:10px}

    .nx-social-mission{
      --brand-rgb:105,215,255;position:relative;overflow:visible;width:100%;min-width:0;min-height:72px;
      padding:9px 10px 9px 9px;display:grid;grid-template-columns:54px minmax(0,1fr) 78px;align-items:center;gap:11px;
      border:1px solid rgba(255,255,255,.10);border-radius:20px;
      background:
        linear-gradient(110deg,rgba(var(--brand-rgb),.10),transparent 32%),
        linear-gradient(180deg,#151a22 0%,#0b0f15 52%,#07090d 100%);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.88),
        0 9px 18px rgba(0,0,0,.32),0 0 0 1px rgba(0,0,0,.7);
      color:inherit;text-decoration:none;transform:translateY(0);transition:transform .11s ease,filter .14s linear,border-color .14s linear;
      -webkit-tap-highlight-color:transparent;
    }
    .nx-social-mission::after{content:'';position:absolute;left:18%;right:18%;bottom:-6px;height:9px;border-radius:50%;background:rgba(var(--brand-rgb),.12);filter:blur(9px);opacity:.65;pointer-events:none}
    .nx-social-mission:hover{filter:brightness(1.08);border-color:rgba(var(--brand-rgb),.26)}
    .nx-social-mission:active{transform:translateY(3px) scale(.994);filter:brightness(.96)}
    .nx-social-mission[data-social-task="x"]{--brand-rgb:255,255,255}
    .nx-social-mission[data-social-task="instagram"]{--brand-rgb:225,73,155}
    .nx-social-mission[data-social-task="facebook"]{--brand-rgb:24,119,242}
    .nx-social-mission[data-social-task="telegram"]{--brand-rgb:34,158,217}

    .nx-social-logo-shell{
      position:relative;width:54px;height:54px;display:grid;place-items:center;border-radius:17px;
      border:1px solid rgba(255,255,255,.16);overflow:hidden;
      box-shadow:inset 0 2px 1px rgba(255,255,255,.18),inset 0 -5px 10px rgba(0,0,0,.28),0 8px 14px rgba(0,0,0,.32),0 0 18px rgba(var(--brand-rgb),.11);
    }
    .nx-social-logo-shell::before{content:'';position:absolute;inset:1px 4px auto 4px;height:38%;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.28),transparent);opacity:.55;pointer-events:none}
    .nx-social-logo-shell svg{position:relative;z-index:1;width:27px;height:27px;fill:currentColor;color:#fff;filter:drop-shadow(0 2px 2px rgba(0,0,0,.38))}
    .nx-social-mission[data-social-task="x"] .nx-social-logo-shell{background:linear-gradient(145deg,#292d34 0%,#08090c 54%,#000 100%);color:#fff}
    .nx-social-mission[data-social-task="instagram"] .nx-social-logo-shell{background:radial-gradient(circle at 68% 72%,#ffd36a 0 15%,transparent 33%),radial-gradient(circle at 26% 92%,#ff5e45 0 12%,transparent 38%),linear-gradient(145deg,#8a3ffc 0%,#d62976 52%,#f77737 100%);color:#fff}
    .nx-social-mission[data-social-task="facebook"] .nx-social-logo-shell{background:linear-gradient(145deg,#4e9cff 0%,#1877f2 52%,#0b4fb7 100%);color:#fff}
    .nx-social-mission[data-social-task="telegram"] .nx-social-logo-shell{background:linear-gradient(145deg,#68cef7 0%,#229ed9 52%,#0d6da8 100%);color:#fff}

    .nx-social-copy{min-width:0;padding-top:1px}
    .nx-social-copy strong{display:block;color:#f7f9fc;font-size:13px;font-weight:900;line-height:1.1;letter-spacing:.01em;text-shadow:0 1px 0 #000}
    .nx-social-copy span{display:block;margin-top:6px;color:#9ea9b7;font-size:9px;font-weight:800;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    .nx-social-action{
      position:relative;min-width:78px;min-height:40px;padding:0 9px;display:grid;place-items:center;border-radius:13px;
      border:1px solid rgba(255,255,255,.18);
      background:
        linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.09) 18%,transparent 19%),
        linear-gradient(180deg,rgba(var(--brand-rgb),.96),rgba(var(--brand-rgb),.68) 58%,rgba(var(--brand-rgb),.46));
      box-shadow:
        inset 0 2px 1px rgba(255,255,255,.38),inset 0 -5px 8px rgba(0,0,0,.30),
        0 5px 0 rgba(0,0,0,.72),0 9px 15px rgba(0,0,0,.34),0 0 18px rgba(var(--brand-rgb),.12);
      color:#fff;font-size:8px;font-weight:1000;letter-spacing:.11em;text-align:center;text-shadow:0 1px 1px rgba(0,0,0,.75);
      transform:translateY(-2px);transition:transform .10s ease,box-shadow .10s ease;
    }
    .nx-social-mission[data-social-task="x"] .nx-social-action{background:linear-gradient(180deg,#f9fbff 0%,#d8dde5 46%,#8d959f 100%);color:#090b0f;text-shadow:0 1px 0 rgba(255,255,255,.65);border-color:rgba(255,255,255,.7)}
    .nx-social-mission:active .nx-social-action{transform:translateY(2px);box-shadow:inset 0 2px 5px rgba(0,0,0,.30),inset 0 -1px 1px rgba(255,255,255,.18),0 1px 0 rgba(0,0,0,.72),0 4px 8px rgba(0,0,0,.28)}

    .nx-tasks-premium>.nx-tool-card:not(.nx-community-live){
      min-height:116px;padding:14px 15px!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:22px!important;
      background:linear-gradient(155deg,#11161d,#080c11 64%,#06080c)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.9),0 14px 26px rgba(0,0,0,.28)!important;
    }
    .nx-tasks-premium .nx-reward-row{gap:12px}
    .nx-tasks-premium .nx-reward-row>div>strong{font-size:13px;color:#f5f7fb}
    .nx-tasks-premium .nx-reward-row>div>p{margin:6px 0 0;color:#7f8b99;font-size:9px;line-height:1.4}
    .nx-tasks-premium .nx-reward-row>button{min-height:48px;padding:0 15px;border:1px solid rgba(111,220,255,.22);border-radius:15px;background:linear-gradient(180deg,#0f668f,#074568 58%,#05344f);box-shadow:inset 0 2px 1px rgba(255,255,255,.16),inset 0 -4px 7px rgba(0,0,0,.28),0 5px 0 #031b2a,0 9px 15px rgba(0,0,0,.25);font-size:8px;transform:translateY(-2px)}
    .nx-tasks-premium .nx-reward-row>button:active{transform:translateY(2px);box-shadow:inset 0 2px 5px rgba(0,0,0,.25),0 1px 0 #031b2a}
    .nx-tasks-premium .nx-tool-meta{margin-top:10px;color:#687482;font-size:8.5px;line-height:1.4}

    @keyframes nxTasksPulseV3{0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes nxTasksOrbitV3{to{transform:rotate(360deg)}}
    @keyframes nxTasksScanV3{0%,17%{transform:translateX(-78%)}61%,100%{transform:translateX(86%)}}
    @media(max-width:380px){
      .nx-tasks-premium{gap:10px!important;min-height:calc(100dvh - 255px)}
      .nx-social-mission{grid-template-columns:48px minmax(0,1fr) 70px;min-height:66px;gap:9px;padding:8px}
      .nx-social-logo-shell{width:48px;height:48px;border-radius:15px}.nx-social-logo-shell svg{width:24px;height:24px}
      .nx-social-action{min-width:70px;min-height:38px;font-size:7px}.nx-social-copy strong{font-size:12px}.nx-social-copy span{font-size:8.4px}
      .nx-tasks-premium>.nx-reward-hero{min-height:120px;padding:16px!important}
    }
    @media(prefers-reduced-motion:reduce){
      .nx-tasks-premium>.nx-reward-hero::before,.nx-tasks-premium>.nx-reward-hero::after,.nx-community-live::before{animation:none!important}
      .nx-social-mission,.nx-social-action{transition:none!important}
    }
  `;
  document.head.appendChild(style);
}

function socialRowsHtml() {
  return TASK_SOCIALS.map(item => `
    <a class="nx-social-mission" data-social-task="${item.id}" href="${item.href}" target="_blank" rel="noopener noreferrer" aria-label="Open ${item.label} ${item.handle}">
      <span class="nx-social-logo-shell" aria-hidden="true">${socialLogoSvg(item.id)}</span>
      <span class="nx-social-copy"><strong>${item.label}</strong><span>${item.handle}</span></span>
      <span class="nx-social-action">${item.action}</span>
    </a>
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

function enhanceMiningTasks(root) {
  ensureMiningTasksPremiumStyles();
  root.classList.add('nx-tasks-premium');

  const hero = root.querySelector('.nx-reward-hero');
  const eyebrow = hero?.querySelector('.nx-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MINING TASKS';
  hero?.insertAdjacentElement('afterend', communityTaskPanel());
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
      const data = await callNovaMiningRewards('openNovaVaultBoosted', { source:'fresh-rebuild-10x' });
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