/* NexusNova Android UX Repair v1
   Android-only presentation guard. It never writes mining, NVX, Vault inventory,
   or Firestore reward state. Reward authority stays with the existing engines.
*/
(() => {
  'use strict';
  if (window.__nxAndroidUxRepairV1) return;
  window.__nxAndroidUxRepairV1 = true;

  const DAY = 86_400_000;
  const STYLE_ID = 'nxVaultRevealStyleV1';
  const OVERLAY_ID = 'nxVaultRevealV1';
  const $ = id => document.getElementById(id);

  /* ---------------- Fast Android splash release ---------------- */
  function releaseSplash() {
    const splash = $('nxSplash');
    if (!splash || !splash.isConnected) return;
    splash.classList.remove('nx-startup-hold');
    splash.classList.add('hide');
    splash.style.pointerEvents = 'none';
    splash.style.visibility = 'hidden';
    splash.style.opacity = '0';
    setTimeout(() => {
      try { splash.remove(); } catch (_) {}
    }, 220);
  }

  function scheduleFastSplash() {
    const elapsed = Number(globalThis.performance?.now?.() || 0);
    // Local APK assets should feel immediate. Keep a short branding beat but
    // never wait for slow network/Firebase/market/ad resources to finish.
    setTimeout(releaseSplash, Math.max(0, 900 - elapsed));
    setTimeout(releaseSplash, 1350);
  }

  /* ---------------- Canonical main mining button label ---------------- */
  function repairMiningButton() {
    let state = null;
    try { state = window.nexusSecureMiningState?.() || null; } catch (_) {}
    if (!state || state.known !== true) return;

    const button = $('mineBtn');
    const text = $('btnText');
    if (!button || !text) return;

    const active = state.active === true || state.miningActive === true;
    const startedAt = Number(state.startedAt ?? state.miningStartedAt) || 0;
    const elapsed = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
    const previewOffsetMs = Math.max(0, Number(state.previewOffsetMs) || 0);
    const displayElapsed = elapsed + previewOffsetMs;

    let label = 'START MINING';
    let visualState = 'ready';
    if (active && startedAt > 0 && elapsed >= DAY) {
      label = 'CLAIM + START NEXT';
      visualState = 'complete';
    } else if (active && startedAt > 0 && previewOffsetMs > 0 && displayElapsed >= DAY) {
      label = 'TEST BOOST PREVIEW COMPLETE';
      visualState = 'active';
    } else if (active && startedAt > 0) {
      label = 'MINING ACTIVE';
      visualState = 'active';
    }

    if (text.textContent !== label) text.textContent = label;
    button.dataset.state = visualState;
    button.classList.toggle('active', visualState === 'active');
  }

  /* ---------------- Nova Vault reward reveal ---------------- */
  function randomUnit() {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] / 4294967296;
    } catch (_) {
      return Math.random();
    }
  }

  function testReward() {
    const roll = randomUnit();
    if (roll < 0.60) {
      return { type:'nvx', amount:1 + Math.floor(randomUnit() * 10), test:true };
    }
    if (roll < 0.78) return { type:'booster', amount:1, test:true };
    if (roll < 0.95) return { type:'rain', amount:1, test:true };
    return { type:'time-warp', amount:1, test:true };
  }

  function rewardMeta(input = {}) {
    const raw = String(input.type || 'reward').toLowerCase();
    const type = raw === 'timewarp' || raw === 'time_warp' ? 'time-warp' : raw;
    const amount = Math.max(0, Number(input.amount) || 0);

    if (type === 'nvx') {
      return {
        type,
        icon:'NVX',
        kicker:'NOVA TOKEN DROP',
        title:`+${Math.max(1, Math.round(amount))} NVX`,
        detail:input.test ? 'TEST reward preview' : 'Added to your NVX balance',
        rare:false
      };
    }
    if (type === 'booster') {
      return {
        type,
        icon:'⚡',
        kicker:'NOVA BOOSTER',
        title:'BOOSTER ×1',
        detail:input.test ? 'TEST reward preview' : 'Stored in your Vault inventory',
        rare:false
      };
    }
    if (type === 'rain') {
      return {
        type,
        icon:'☄',
        kicker:'NOVA RAIN',
        title:'NOVA RAIN ×1',
        detail:input.test ? 'TEST reward preview' : 'Stored in your Vault inventory',
        rare:false
      };
    }
    if (type === 'time-warp') {
      return {
        type,
        icon:'⏩',
        kicker:'RARE DROP',
        title:'24H TIME WARP ×1',
        detail:input.test ? 'TEST rare reward preview' : 'Stored in your Vault inventory',
        rare:true
      };
    }
    return {
      type:'reward',
      icon:'✦',
      kicker:'NOVA VAULT',
      title:'REWARD UNLOCKED',
      detail:input.test ? 'TEST reward preview' : 'Reward secured',
      rare:false
    };
  }

  function installRevealStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 42%,rgba(23,102,255,.20),rgba(1,8,22,.94) 55%,rgba(0,3,10,.985));backdrop-filter:blur(10px);overflow:hidden;color:#f7fbff;opacity:0;animation:nxVrBackdrop .28s ease forwards}
      #${OVERLAY_ID}.rare{background:radial-gradient(circle at 50% 42%,rgba(169,89,255,.30),rgba(8,5,27,.95) 55%,rgba(2,1,12,.99))}
      .nx-vr-scene{position:relative;width:min(92vw,430px);height:min(78vh,620px);min-height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;isolation:isolate}
      .nx-vr-stars{position:absolute;inset:0;pointer-events:none}.nx-vr-star{position:absolute;left:50%;top:43%;width:5px;height:5px;border-radius:50%;background:#bcecff;box-shadow:0 0 14px #4db9ff;opacity:0;transform:rotate(var(--r)) translateY(-42px);animation:nxVrStar 1.35s var(--d) ease-out forwards}.rare .nx-vr-star{background:#f1d2ff;box-shadow:0 0 16px #b66cff}
      .nx-vr-beam{position:absolute;left:50%;top:39%;width:220px;height:310px;transform:translate(-50%,-45%) scaleY(.05);transform-origin:50% 80%;clip-path:polygon(43% 0,57% 0,100% 100%,0 100%);background:linear-gradient(to bottom,rgba(188,244,255,.92),rgba(28,157,255,.20) 58%,transparent);filter:blur(3px);opacity:0;animation:nxVrBeam 1.55s .62s cubic-bezier(.2,.82,.2,1) forwards}.rare .nx-vr-beam{background:linear-gradient(to bottom,rgba(249,220,255,.95),rgba(164,83,255,.25) 58%,transparent)}
      .nx-vr-vault{position:relative;width:190px;height:150px;border-radius:28px;background:linear-gradient(145deg,#102a4a,#071426 58%,#0a1d36);border:1px solid rgba(111,202,255,.52);box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 45px rgba(22,133,255,.22),inset 0 0 0 5px rgba(6,16,32,.72),inset 0 1px rgba(255,255,255,.18);perspective:800px;animation:nxVrVaultIn .5s cubic-bezier(.17,.88,.28,1.25) both,nxVrVaultShake .45s .45s ease both}
      .rare .nx-vr-vault{border-color:rgba(214,150,255,.58);box-shadow:0 30px 80px rgba(0,0,0,.58),0 0 52px rgba(164,83,255,.28),inset 0 0 0 5px rgba(18,7,35,.72)}
      .nx-vr-vault::before{content:'NOVA';position:absolute;left:50%;top:15px;transform:translateX(-50%);font-size:10px;letter-spacing:.28em;font-weight:1000;color:#7ecbff;z-index:8}.rare .nx-vr-vault::before{color:#d6a8ff}
      .nx-vr-door{position:absolute;top:39px;width:50%;height:111px;background:linear-gradient(145deg,#143a63,#0a203a);border-top:1px solid rgba(131,216,255,.38);box-shadow:inset 0 0 24px rgba(0,0,0,.35);z-index:5;backface-visibility:hidden}.nx-vr-door.left{left:0;border-radius:0 4px 0 26px;transform-origin:left center;animation:nxVrDoorLeft .78s .62s cubic-bezier(.2,.75,.18,1) forwards}.nx-vr-door.right{right:0;border-radius:4px 0 26px 0;transform-origin:right center;animation:nxVrDoorRight .78s .62s cubic-bezier(.2,.75,.18,1) forwards}.rare .nx-vr-door{background:linear-gradient(145deg,#352055,#170e31)}
      .nx-vr-lock{position:absolute;left:50%;top:78px;z-index:9;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#dbf8ff 0 8%,#48c7ff 10% 23%,#0b62bd 25% 52%,#051426 54%);border:1px solid #95e4ff;box-shadow:0 0 26px rgba(45,184,255,.62);animation:nxVrLock .75s .38s ease forwards}.rare .nx-vr-lock{background:radial-gradient(circle,#fff1ff 0 8%,#d38aff 10% 23%,#7438bc 25% 52%,#170b29 54%);border-color:#e4bcff;box-shadow:0 0 30px rgba(190,104,255,.64)}
      .nx-vr-reward{position:absolute;left:50%;top:43%;width:min(86vw,330px);transform:translate(-50%,68px) scale(.35);opacity:0;text-align:center;z-index:12;animation:nxVrReward 1s 1.02s cubic-bezier(.16,.86,.25,1.18) forwards}
      .nx-vr-icon{width:108px;height:108px;margin:0 auto;border-radius:34px;display:grid;place-items:center;background:linear-gradient(145deg,#147dff,#47ddff);border:1px solid rgba(255,255,255,.62);box-shadow:0 22px 65px rgba(24,165,255,.45),inset 0 1px rgba(255,255,255,.45);font-size:48px;font-weight:1000;letter-spacing:-.05em;color:#fff}.rare .nx-vr-icon{background:linear-gradient(145deg,#8746ff,#d26cff);box-shadow:0 22px 70px rgba(170,76,255,.52),inset 0 1px rgba(255,255,255,.44)}.nx-vr-icon.nvx{font-size:25px;letter-spacing:.06em}
      .nx-vr-kicker{margin-top:18px;font-size:10px;font-weight:1000;letter-spacing:.22em;color:#74d6ff}.rare .nx-vr-kicker{color:#d6a4ff}.nx-vr-title{margin-top:7px;font-size:30px;line-height:1.05;font-weight:1000;color:#fff;text-shadow:0 6px 28px rgba(0,0,0,.6)}.nx-vr-detail{margin-top:9px;font-size:12px;font-weight:800;color:#abc2db}.nx-vr-test{margin-top:10px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,204,103,.30);background:rgba(255,181,46,.08);font-size:9px;font-weight:1000;letter-spacing:.12em;color:#ffd98d}
      .nx-vr-bottom{position:absolute;left:0;right:0;bottom:14px;text-align:center;z-index:20;opacity:0;animation:nxVrBottom .36s 1.85s ease forwards}.nx-vr-status{font-size:10px;color:#7893af;margin-bottom:12px}.nx-vr-continue{pointer-events:auto;border:0;border-radius:15px;min-width:180px;padding:13px 24px;background:linear-gradient(135deg,#167dff,#39bfff);color:#fff;font-size:12px;font-weight:1000;letter-spacing:.08em;box-shadow:0 12px 34px rgba(18,125,255,.28)}.rare .nx-vr-continue{background:linear-gradient(135deg,#8248ff,#c05fff)}
      @keyframes nxVrBackdrop{to{opacity:1}}@keyframes nxVrVaultIn{0%{opacity:0;transform:translateY(80px) scale(.62)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes nxVrVaultShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px) rotate(-1.5deg)}50%{transform:translateX(7px) rotate(1.5deg)}75%{transform:translateX(-4px)}}@keyframes nxVrLock{0%,58%{transform:translate(-50%,-50%) scale(1) rotate(0)}80%{transform:translate(-50%,-50%) scale(1.25) rotate(45deg);opacity:1}100%{transform:translate(-50%,-50%) scale(.2) rotate(90deg);opacity:0}}@keyframes nxVrDoorLeft{to{transform:perspective(700px) rotateY(-108deg);opacity:.18}}@keyframes nxVrDoorRight{to{transform:perspective(700px) rotateY(108deg);opacity:.18}}@keyframes nxVrBeam{0%{opacity:0;transform:translate(-50%,-45%) scaleY(.05)}35%{opacity:.95}100%{opacity:0;transform:translate(-50%,-52%) scaleY(1.2)}}@keyframes nxVrReward{0%{opacity:0;transform:translate(-50%,68px) scale(.35)}60%{opacity:1;transform:translate(-50%,-150px) scale(1.08)}100%{opacity:1;transform:translate(-50%,-142px) scale(1)}}@keyframes nxVrStar{0%{opacity:0;transform:rotate(var(--r)) translateY(-42px) scale(.4)}25%{opacity:1}100%{opacity:0;transform:rotate(var(--r)) translateY(-230px) scale(1.5)}}@keyframes nxVrBottom{to{opacity:1}}
      @media(max-height:620px){.nx-vr-scene{min-height:440px;height:92vh}.nx-vr-vault{transform:scale(.88)}.nx-vr-reward{top:47%}.nx-vr-title{font-size:25px}.nx-vr-bottom{bottom:2px}}
      @media(prefers-reduced-motion:reduce){#${OVERLAY_ID},#${OVERLAY_ID} *{animation-duration:.01ms!important;animation-delay:0s!important}.nx-vr-reward{opacity:1;transform:translate(-50%,-142px) scale(1)}.nx-vr-bottom{opacity:1}}
    `;
    document.head.appendChild(style);
  }

  function playVaultReveal(input = {}) {
    installRevealStyle();
    $(OVERLAY_ID)?.remove();

    const reward = rewardMeta(input);
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = reward.rare ? 'rare' : '';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Nova Vault reward: ${reward.title}`);

    const stars = Array.from({ length: reward.rare ? 22 : 18 }, (_, i) => {
      const rotation = Math.round((360 / (reward.rare ? 22 : 18)) * i);
      const delay = (i % 7) * 0.035;
      return `<i class="nx-vr-star" style="--r:${rotation}deg;--d:${delay}s"></i>`;
    }).join('');

    overlay.innerHTML = `
      <div class="nx-vr-scene">
        <div class="nx-vr-stars">${stars}</div>
        <div class="nx-vr-beam"></div>
        <div class="nx-vr-vault">
          <div class="nx-vr-door left"></div>
          <div class="nx-vr-door right"></div>
          <div class="nx-vr-lock">✦</div>
        </div>
        <div class="nx-vr-reward">
          <div class="nx-vr-icon ${reward.type === 'nvx' ? 'nvx' : ''}">${reward.icon}</div>
          <div class="nx-vr-kicker">${reward.kicker}</div>
          <div class="nx-vr-title">${reward.title}</div>
          <div class="nx-vr-detail">${reward.detail}</div>
          ${input.test ? '<div class="nx-vr-test">TEST PREVIEW • PRODUCTION BALANCE UNCHANGED</div>' : ''}
        </div>
        <div class="nx-vr-bottom">
          <div class="nx-vr-status">${input.test ? 'Vault animation test completed safely' : 'Reward confirmed securely • 15s Nova cooldown active'}</div>
          <button type="button" class="nx-vr-continue">CONTINUE</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    try { navigator.vibrate?.([35,45,70]); } catch (_) {}

    return new Promise(resolve => {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        overlay.style.transition = 'opacity .22s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 230);
        resolve(input);
      };
      overlay.querySelector('.nx-vr-continue')?.addEventListener('click', close, { once:true });
      overlay.addEventListener('click', event => {
        if (event.target === overlay && Date.now() - openedAt > 1800) close();
      });
      const openedAt = Date.now();
      setTimeout(close, 5600);
    });
  }

  window.NexusNovaVaultReveal = Object.freeze({
    play: playVaultReveal,
    testReward
  });

  scheduleFastSplash();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleFastSplash();
      repairMiningButton();
    }, { once:true });
  } else {
    repairMiningButton();
  }

  // A bounded + lightweight label guard is enough to beat stale late renderers
  // without creating a document-wide MutationObserver loop on Android WebView.
  [180,500,1000,1800,3000,5000,8000].forEach(ms => setTimeout(repairMiningButton, ms));
  setInterval(repairMiningButton, 1000);
  window.addEventListener('nexusnova:nova-vault-state', repairMiningButton);
  window.addEventListener('focus', repairMiningButton);
})();
