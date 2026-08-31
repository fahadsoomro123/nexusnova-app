import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';
import { icon } from '../../components/icons.js';

async function secureCall(name, data = {}) {
  await requireFirebaseUser({ write:true });
  const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), name);
  const response = await call(data);
  return response?.data || {};
}

function rewardText(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

function ensureNovaVaultV3Style() {
  if (document.getElementById('nx-nova-vault-v3-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-v3-style';
  style.textContent = `
    .nx-screen.nx-vault-screen-v3{width:100%!important;max-width:none!important;min-height:100dvh!important;margin:0!important;padding:0!important;overflow-x:hidden!important;background:radial-gradient(circle at 50% -12%,rgba(0,147,255,.16),transparent 34%),linear-gradient(180deg,#020914 0%,#020812 48%,#01060e 100%)!important}
    .nx-vault-screen-v3 [data-app-mount]{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
    .nx-vault-head-v3{position:relative!important;display:grid!important;grid-template-columns:58px 58px minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;margin:0!important;padding:18px 18px 16px!important;min-height:106px!important;border:0!important;border-bottom:1px solid rgba(44,159,229,.24)!important;background:linear-gradient(180deg,rgba(5,18,32,.99),rgba(3,13,25,.98))!important;box-shadow:inset 0 -1px 0 rgba(255,255,255,.025),0 12px 28px rgba(0,0,0,.26)!important;box-sizing:border-box!important}
    .nx-vault-head-v3:after{content:'';position:absolute;left:118px;right:118px;bottom:-1px;height:2px;background:linear-gradient(90deg,transparent,#08baff 26%,#5e7cff 50%,#08baff 74%,transparent);opacity:.72;pointer-events:none}
    .nx-vault-head-v3 .nx-back,.nx-vault-head-v3 .nx-app-head__icon{width:56px!important;height:56px!important;min-width:56px!important;border:1px solid rgba(58,170,232,.32)!important;border-radius:15px!important;background:linear-gradient(180deg,#0b2d49 0%,#071827 100%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.11),inset 0 -10px 18px rgba(0,0,0,.24),0 8px 20px rgba(0,0,0,.28)!important;color:#53d9ff!important;display:grid!important;place-items:center!important;padding:0!important}
    .nx-vault-head-v3 .nx-back{font-size:43px!important;line-height:1!important;color:#ecf8ff!important;text-shadow:0 0 12px rgba(61,207,255,.38)}
    .nx-vault-head-v3 .nx-app-head__icon svg{width:30px!important;height:30px!important;filter:drop-shadow(0 0 8px rgba(28,202,255,.52))}
    .nx-vault-head-v3>div{min-width:0!important}
    .nx-vault-head-v3 .nx-eyebrow{margin:0 0 3px!important;color:#39cfff!important;font-size:10px!important;letter-spacing:.22em!important;font-weight:900!important;text-transform:uppercase!important}
    .nx-vault-head-v3 h1{margin:0!important;color:#f4f8ff!important;font-size:clamp(25px,5.6vw,38px)!important;line-height:1.03!important;font-weight:950!important;letter-spacing:-.035em!important;text-shadow:0 2px 0 rgba(0,0,0,.7),0 0 18px rgba(61,153,255,.16)!important}
    .nx-vault-head-v3>div>p:last-child{margin:4px 0 0!important;color:#aabbd0!important;font-size:11px!important;line-height:1.2!important;letter-spacing:.11em!important;text-transform:uppercase!important;font-weight:750!important}
    .nx-vault-head-credit{justify-self:end;align-self:center;min-width:104px;padding:11px 14px;border:1px solid rgba(189,113,255,.36);border-radius:14px;background:linear-gradient(180deg,rgba(41,15,68,.96),rgba(17,8,34,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 22px rgba(170,51,255,.13);text-align:center;color:#fff;box-sizing:border-box}
    .nx-vault-head-credit strong{display:block;font-size:14px;line-height:1;font-weight:950;letter-spacing:.03em}.nx-vault-head-credit span{display:block;margin-top:6px;color:#d65fff;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
    .nx-vault-head-credit.is-active{border-color:rgba(202,93,255,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 28px rgba(177,47,255,.28)}

    .nx-vault-v3{--nv-cyan:#18c8ff;--nv-blue:#087dff;--nv-purple:#b53bff;--nv-line:rgba(67,171,226,.34);width:100%!important;max-width:none!important;box-sizing:border-box!important;display:grid!important;gap:15px!important;margin:0!important;padding:18px 18px calc(112px + env(safe-area-inset-bottom))!important;background:radial-gradient(circle at 15% 9%,rgba(14,126,255,.08),transparent 24%),radial-gradient(circle at 84% 36%,rgba(145,34,255,.08),transparent 23%)!important;color:#eef8ff!important}
    .nx-vault-v3 *{box-sizing:border-box}.nx-vault-v3 button{font-family:inherit}.nx-vault-v3 button:disabled{opacity:.46!important;filter:saturate(.52)!important;cursor:not-allowed!important}
    .nx-vault-panel{position:relative;overflow:hidden;border:1px solid var(--nv-line);border-radius:20px;background:linear-gradient(155deg,rgba(8,31,51,.98),rgba(3,15,27,.99) 62%,rgba(2,10,19,.99));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.9),0 12px 26px rgba(0,0,0,.25)}
    .nx-vault-panel:before{content:'';position:absolute;left:18px;right:18px;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--nv-cyan),#81ebff,var(--nv-cyan),transparent);opacity:.64;pointer-events:none}
    .nx-vault-panel:after{content:'';position:absolute;inset:8px;border:1px solid rgba(117,204,255,.055);border-radius:14px;pointer-events:none}

    .nx-vault-hero-v3{min-height:252px;padding:31px 32px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(145px,.72fr);align-items:center;gap:18px}
    .nx-vault-hero-copy{position:relative;z-index:2}.nx-vault-kicker{margin:0 0 12px;color:var(--nv-cyan);font-size:12px;font-weight:950;letter-spacing:.19em;text-transform:uppercase}.nx-vault-count{display:block;margin:0;color:#f5f8fd;font-size:clamp(52px,13vw,86px);line-height:.9;font-weight:950;letter-spacing:-.055em;text-shadow:0 3px 0 rgba(0,0,0,.7),0 0 28px rgba(31,176,255,.12)}
    .nx-vault-ready{display:block;margin-top:13px;color:#16c9ff;font-size:clamp(18px,4.8vw,29px);font-weight:900;letter-spacing:.06em;text-transform:uppercase}
    .nx-vault-machine{justify-self:end;position:relative;width:min(39vw,210px);aspect-ratio:1.02;border:2px solid rgba(105,189,237,.52);border-radius:24px;background:linear-gradient(145deg,#173c59 0%,#07182a 34%,#0d2e49 70%,#061321 100%);box-shadow:inset 0 0 0 5px rgba(255,255,255,.035),inset 0 -18px 30px rgba(0,0,0,.42),0 0 26px rgba(0,149,255,.17),0 16px 26px rgba(0,0,0,.34);display:grid;place-items:center;transform:perspective(500px) rotateY(-8deg)}
    .nx-vault-machine:before{content:'';position:absolute;inset:17%;border:3px solid #257dad;border-radius:50%;background:radial-gradient(circle,#0b1a28 0 30%,#0a5f93 31% 34%,#071522 35% 50%,#0caeff 51% 54%,#0a1724 55%);box-shadow:inset 0 0 18px #000,0 0 20px rgba(25,194,255,.44)}
    .nx-vault-machine-icon{position:relative;z-index:2;width:28%;color:#44ddff;filter:drop-shadow(0 0 9px rgba(34,201,255,.85))}.nx-vault-machine-icon svg{width:100%;height:100%}

    .nx-vault-summary-v3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.nx-vault-stat{min-height:132px;padding:17px 16px;display:grid;grid-template-columns:54px minmax(0,1fr);align-items:center;gap:12px}.nx-vault-stat-icon{width:52px;height:64px;border:1px solid rgba(42,194,255,.42);border-radius:14px;background:linear-gradient(180deg,#0b5c8f,#072238);display:grid;place-items:center;color:#43d8ff;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 18px rgba(16,176,255,.13)}
    .nx-vault-stat--rain .nx-vault-stat-icon{border-radius:50%;height:52px}.nx-vault-stat--warp{border-color:rgba(178,58,255,.36)}.nx-vault-stat--warp .nx-vault-stat-icon{border-color:rgba(185,71,255,.52);background:linear-gradient(180deg,#4d176f,#1a0b2b);color:#d063ff;box-shadow:0 0 18px rgba(171,37,255,.17)}
    .nx-vault-stat-icon svg{width:30px;height:30px}.nx-vault-stat-copy span{display:block;color:#b8c6d6;font-size:11px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.nx-vault-stat-copy strong{display:block;margin-top:4px;color:#f4f8ff;font-size:34px;line-height:1;font-weight:950;text-shadow:0 2px 0 rgba(0,0,0,.65)}

    .nx-vault-primary-v3{display:grid;grid-template-columns:minmax(0,1.24fr) minmax(250px,.9fr);gap:13px}.nx-vault-open-card,.nx-vault-boost-card{min-height:315px;padding:29px 27px;display:flex;flex-direction:column;justify-content:flex-start}.nx-vault-card-title{margin:0;color:var(--nv-cyan);font-size:18px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}.nx-vault-card-copy{margin:12px 0 0;color:#aabbd0;font-size:13px;line-height:1.55}.nx-vault-open-button{position:relative;margin-top:auto;min-height:84px;width:100%;border:1px solid rgba(63,201,255,.66)!important;border-radius:17px!important;background:linear-gradient(180deg,#0c64a6 0%,#08447b 52%,#073255 100%)!important;color:#fff!important;font-size:clamp(22px,5vw,31px)!important;font-weight:950!important;letter-spacing:.02em!important;text-shadow:0 2px 0 #03233c!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.14),inset 0 -14px 24px rgba(0,0,0,.28),0 0 0 5px rgba(13,119,183,.12),0 0 24px rgba(0,168,255,.2)!important}.nx-vault-open-button:active{transform:translateY(1px) scale(.995)}
    .nx-vault-status{position:relative;z-index:2;margin:13px 0 0;min-height:34px;color:#7fa5c2;font-size:11px;line-height:1.45}.nx-vault-mode{display:inline-flex;align-items:center;gap:6px;margin-top:13px;color:#7fb4d3;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.nx-vault-mode:before{content:'';width:7px;height:7px;border-radius:50%;background:#25caff;box-shadow:0 0 8px #25caff}
    .nx-vault-v3[data-boost-active="true"] .nx-vault-open-card{border-color:rgba(156,75,255,.52);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 28px rgba(137,34,255,.12)}.nx-vault-v3[data-boost-active="true"] .nx-vault-open-button{border-color:rgba(203,91,255,.72)!important;background:linear-gradient(180deg,#7132a4 0%,#4d1f78 53%,#311449 100%)!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -14px 24px rgba(0,0,0,.28),0 0 0 5px rgba(151,52,219,.12),0 0 28px rgba(191,45,255,.24)!important}.nx-vault-v3[data-boost-active="true"] .nx-vault-mode{color:#e36cff}.nx-vault-v3[data-boost-active="true"] .nx-vault-mode:before{background:#d94cff;box-shadow:0 0 10px #cf41ff}

    .nx-vault-boost-card{border-color:rgba(173,59,255,.43);background:linear-gradient(155deg,rgba(25,12,43,.99),rgba(10,8,28,.99) 62%,rgba(6,7,19,.99));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 28px rgba(145,34,255,.11)}.nx-vault-boost-card:before{background:linear-gradient(90deg,transparent,#8138ff,#e165ff,#8138ff,transparent)}.nx-vault-boost-title{color:#e172ff;font-size:22px;font-weight:950;text-align:center;letter-spacing:.04em}.nx-vault-watch{margin-top:auto;min-height:84px;border:1px solid rgba(220,86,255,.75)!important;border-radius:16px!important;background:linear-gradient(180deg,#7b25aa,#57177d 55%,#3b1056)!important;color:#fff!important;font-size:clamp(17px,4vw,24px)!important;font-weight:950!important;letter-spacing:.02em!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -12px 22px rgba(0,0,0,.25),0 0 0 5px rgba(167,50,221,.13),0 0 26px rgba(187,44,255,.25)!important}.nx-vault-watch:before{content:'▶';display:inline-grid;place-items:center;width:30px;height:26px;margin-right:9px;border:1px solid rgba(255,255,255,.6);border-radius:5px;font-size:13px;vertical-align:middle}.nx-vault-boost-state{margin:15px 0 0;text-align:center;color:#cf56f4;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}

    .nx-vault-inventory-panel{padding:24px 22px 22px}.nx-vault-inventory-title{position:relative;z-index:2;display:flex;align-items:center;gap:12px;margin:0 0 17px;color:#1fcfff;font-size:14px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.nx-vault-inventory-title:before,.nx-vault-inventory-title:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(20,202,255,.65))}.nx-vault-inventory-title:after{transform:scaleX(-1)}
    .nx-vault-use-grid{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.nx-vault-use{min-height:92px;padding:13px 10px!important;border:1px solid rgba(38,178,236,.34)!important;border-radius:13px!important;background:linear-gradient(180deg,#082b46,#061929)!important;color:#35d3ff!important;display:grid!important;grid-template-columns:38px minmax(0,1fr)!important;align-items:center!important;gap:9px!important;text-align:left!important;font-size:11px!important;font-weight:950!important;letter-spacing:.02em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}.nx-vault-use svg{width:30px;height:30px;filter:drop-shadow(0 0 7px rgba(35,200,255,.34))}.nx-vault-use--warp{border-color:rgba(174,63,255,.36)!important;color:#d969ff!important;background:linear-gradient(180deg,#24113a,#110b20)!important}.nx-vault-warp-wide{position:relative;z-index:2;margin-top:11px;width:100%;min-height:76px;border:1px solid rgba(43,184,239,.4)!important;border-radius:13px!important;background:linear-gradient(180deg,#082942,#061725)!important;color:#35d4ff!important;font-size:15px!important;font-weight:950!important;letter-spacing:.04em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}.nx-vault-warp-wide span{display:inline-grid;place-items:center;width:42px;height:42px;margin-right:12px;border:2px solid #b54cff;border-radius:50%;color:#e679ff;background:#20102f;box-shadow:0 0 13px rgba(183,67,255,.22)}

    @media(max-width:760px){.nx-vault-head-v3{grid-template-columns:52px 52px minmax(0,1fr) auto;gap:9px;padding:13px 12px 12px;min-height:94px}.nx-vault-head-v3 .nx-back,.nx-vault-head-v3 .nx-app-head__icon{width:50px!important;height:50px!important;min-width:50px!important}.nx-vault-head-credit{min-width:88px;padding:9px 9px}.nx-vault-head-credit strong{font-size:12px}.nx-vault-head-credit span{font-size:8px}.nx-vault-v3{padding:14px 12px calc(108px + env(safe-area-inset-bottom))!important;gap:12px!important}.nx-vault-hero-v3{min-height:220px;padding:24px 21px;grid-template-columns:minmax(0,1fr) 132px}.nx-vault-machine{width:132px}.nx-vault-summary-v3{gap:8px}.nx-vault-stat{min-height:108px;padding:13px 10px;grid-template-columns:42px minmax(0,1fr);gap:8px}.nx-vault-stat-icon{width:40px;height:52px}.nx-vault-stat--rain .nx-vault-stat-icon{height:40px}.nx-vault-stat-icon svg{width:24px;height:24px}.nx-vault-stat-copy span{font-size:9px}.nx-vault-stat-copy strong{font-size:27px}.nx-vault-primary-v3{grid-template-columns:minmax(0,1.12fr) minmax(175px,.88fr);gap:9px}.nx-vault-open-card,.nx-vault-boost-card{min-height:286px;padding:22px 17px}.nx-vault-card-title{font-size:15px}.nx-vault-card-copy{font-size:11px}.nx-vault-open-button,.nx-vault-watch{min-height:72px}.nx-vault-use-grid{gap:7px}.nx-vault-use{min-height:82px;padding:10px 7px!important;grid-template-columns:30px minmax(0,1fr)!important;font-size:9px!important}.nx-vault-use svg{width:24px;height:24px}.nx-vault-warp-wide{min-height:68px;font-size:12px!important}}
    @media(max-width:480px){.nx-vault-head-v3{grid-template-columns:46px 46px minmax(0,1fr) 82px;gap:7px;padding:11px 9px 10px}.nx-vault-head-v3 .nx-back,.nx-vault-head-v3 .nx-app-head__icon{width:44px!important;height:44px!important;min-width:44px!important;border-radius:12px!important}.nx-vault-head-v3 h1{font-size:22px!important}.nx-vault-head-v3>div>p:last-child{font-size:8px!important}.nx-vault-head-v3 .nx-eyebrow{font-size:8px!important}.nx-vault-head-credit{min-width:80px;padding:8px 6px;border-radius:11px}.nx-vault-head-credit strong{font-size:11px}.nx-vault-head-credit span{font-size:7px;margin-top:4px}.nx-vault-hero-v3{min-height:202px;padding:20px 16px;grid-template-columns:minmax(0,1fr) 112px}.nx-vault-count{font-size:48px}.nx-vault-ready{font-size:16px}.nx-vault-machine{width:108px;border-radius:17px}.nx-vault-summary-v3{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.nx-vault-stat{min-height:96px;padding:10px 7px;display:block;text-align:center}.nx-vault-stat-icon{margin:0 auto 7px;width:34px;height:40px;border-radius:10px}.nx-vault-stat--rain .nx-vault-stat-icon{height:34px}.nx-vault-stat-icon svg{width:21px;height:21px}.nx-vault-stat-copy span{font-size:8px;white-space:nowrap}.nx-vault-stat-copy strong{font-size:23px}.nx-vault-primary-v3{grid-template-columns:1fr 1fr;gap:7px}.nx-vault-open-card,.nx-vault-boost-card{min-height:275px;padding:18px 12px}.nx-vault-card-title{font-size:13px}.nx-vault-card-copy{font-size:10px;line-height:1.42}.nx-vault-open-button{min-height:68px;font-size:18px!important}.nx-vault-watch{min-height:68px;font-size:14px!important;padding:9px!important}.nx-vault-watch:before{width:24px;height:21px;margin-right:5px}.nx-vault-boost-title{font-size:17px}.nx-vault-status,.nx-vault-boost-state{font-size:9px}.nx-vault-inventory-panel{padding:19px 11px 16px}.nx-vault-use-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.nx-vault-use{min-height:78px!important;display:block!important;text-align:center!important;font-size:8px!important;padding:9px 4px!important}.nx-vault-use svg{display:block;margin:0 auto 5px}.nx-vault-warp-wide{min-height:62px;font-size:11px!important}.nx-vault-warp-wide span{width:34px;height:34px;margin-right:7px;font-size:10px}}
    @media(max-width:365px){.nx-vault-head-v3{grid-template-columns:42px 42px minmax(0,1fr) 74px}.nx-vault-head-v3 .nx-back,.nx-vault-head-v3 .nx-app-head__icon{width:40px!important;height:40px!important;min-width:40px!important}.nx-vault-head-v3 h1{font-size:19px!important}.nx-vault-head-credit{min-width:70px}.nx-vault-hero-v3{grid-template-columns:minmax(0,1fr) 92px}.nx-vault-machine{width:90px}.nx-vault-count{font-size:43px}.nx-vault-ready{font-size:14px}.nx-vault-primary-v3{grid-template-columns:1fr}.nx-vault-open-card,.nx-vault-boost-card{min-height:240px}}
  `;
  document.head.appendChild(style);
}

export function renderNovaVaultSafe() {
  ensureNovaVaultV3Style();

  const root = document.createElement('div');
  root.className = 'nx-app-body nx-vault-v3';
  root.dataset.vaultV3Integrated = 'true';
  root.dataset.boostActive = 'false';
  root.innerHTML = `
    <section class="nx-vault-panel nx-vault-hero-v3">
      <div class="nx-vault-hero-copy">
        <p class="nx-vault-kicker">NOVA REWARD SYSTEM</p>
        <strong class="nx-vault-count" data-vault-pending>— VAULTS</strong>
        <span class="nx-vault-ready">READY TO OPEN</span>
      </div>
      <div class="nx-vault-machine" aria-hidden="true"><span class="nx-vault-machine-icon">${icon('vault')}</span></div>
    </section>

    <section class="nx-vault-summary-v3" aria-label="Nova Vault inventory">
      <article class="nx-vault-panel nx-vault-stat">
        <span class="nx-vault-stat-icon">${icon('mine')}</span>
        <div class="nx-vault-stat-copy"><span>Booster</span><strong data-vault-booster>—</strong></div>
      </article>
      <article class="nx-vault-panel nx-vault-stat nx-vault-stat--rain">
        <span class="nx-vault-stat-icon">${icon('weather')}</span>
        <div class="nx-vault-stat-copy"><span>Nova Rain</span><strong data-vault-rain>—</strong></div>
      </article>
      <article class="nx-vault-panel nx-vault-stat nx-vault-stat--warp">
        <span class="nx-vault-stat-icon">${icon('clock')}</span>
        <div class="nx-vault-stat-copy"><span>Time Warp</span><strong data-vault-warp>—</strong></div>
      </article>
    </section>

    <section class="nx-vault-primary-v3">
      <article class="nx-vault-panel nx-vault-open-card">
        <h2 class="nx-vault-card-title">OPEN YOUR VAULT</h2>
        <p class="nx-vault-card-copy">Open your earned Nova Vault for a secure server-selected reward.</p>
        <span class="nx-vault-mode" data-vault-mode>NORMAL VAULT MODE</span>
        <button class="nx-vault-open-button" type="button" data-vault-open>OPEN VAULT</button>
        <p class="nx-vault-status" data-vault-status>Syncing secure Nova inventory…</p>
      </article>

      <article class="nx-vault-panel nx-vault-boost-card">
        <h2 class="nx-vault-boost-title">10X BOOST</h2>
        <p class="nx-vault-card-copy">Watch a rewarded ad to upgrade your next Vault opening to the secure 10X reward pool.</p>
        <button class="nx-vault-watch" type="button" data-10x-watch>WATCH AD FOR 10X</button>
        <p class="nx-vault-boost-state" data-10x-status>10X BOOST NOT ACTIVE</p>
      </article>
    </section>

    <section class="nx-vault-panel nx-vault-inventory-panel">
      <h2 class="nx-vault-inventory-title">BOOST INVENTORY</h2>
      <div class="nx-vault-use-grid">
        <button class="nx-vault-use" type="button" data-vault-boost><span>${icon('mine')}</span><b>USE BOOSTER</b></button>
        <button class="nx-vault-use" type="button" data-vault-rain-use><span>${icon('weather')}</span><b>USE NOVA RAIN</b></button>
        <button class="nx-vault-use nx-vault-use--warp" type="button" data-vault-warp-use><span>${icon('clock')}</span><b>USE TIME WARP</b></button>
      </div>
      <button class="nx-vault-warp-wide" type="button" data-vault-warp-use-wide><span>24h</span>USE 24H TIME WARP</button>
    </section>`;

  const refs = {
    pending: root.querySelector('[data-vault-pending]'),
    booster: root.querySelector('[data-vault-booster]'),
    rain: root.querySelector('[data-vault-rain]'),
    warp: root.querySelector('[data-vault-warp]'),
    status: root.querySelector('[data-vault-status]'),
    mode: root.querySelector('[data-vault-mode]'),
    boostStatus: root.querySelector('[data-10x-status]'),
    watch: root.querySelector('[data-10x-watch]'),
    open: root.querySelector('[data-vault-open]')
  };

  const actionButtons = [...root.querySelectorAll('button')];
  let off = null;
  let busy = false;
  let active = true;
  let credits = 0;
  let pendingVaults = 0;
  let shell = null;
  let shellCredit = null;

  const bindShell = () => {
    shell = root.closest('.nx-screen');
    if (!shell || !active) return;
    shell.classList.add('nx-vault-screen-v3');
    const head = shell.querySelector('.nx-app-head');
    if (head) {
      head.classList.add('nx-vault-head-v3');
      const subtitle = head.querySelector('div > p:last-child');
      if (subtitle) subtitle.textContent = 'SECURE MINING REWARDS';
      shellCredit = document.createElement('div');
      shellCredit.className = 'nx-vault-head-credit';
      shellCredit.innerHTML = '<strong>0 CREDITS</strong><span>10X BOOST</span>';
      head.appendChild(shellCredit);
    }
  };

  const paint = () => {
    if (!active) return;
    const boosted = credits > 0;
    root.dataset.boostActive = boosted ? 'true' : 'false';
    refs.mode.textContent = boosted ? '10X BOOST ACTIVE' : 'NORMAL VAULT MODE';
    refs.boostStatus.textContent = boosted
      ? `${credits} SECURE 10X CREDIT${credits === 1 ? '' : 'S'} READY`
      : '10X BOOST NOT ACTIVE';
    refs.open.disabled = busy || pendingVaults < 1;
    refs.watch.disabled = busy || credits >= 3;
    actionButtons.forEach(button => {
      if (button !== refs.open && button !== refs.watch) button.disabled = busy;
    });
    if (shellCredit) {
      shellCredit.classList.toggle('is-active', boosted);
      const strong = shellCredit.querySelector('strong');
      if (strong) strong.textContent = `${credits} CREDIT${credits === 1 ? '' : 'S'}`;
    }
  };

  const setBusy = value => {
    busy = Boolean(value);
    paint();
  };

  const bind = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        const data = snap.data() || {};
        pendingVaults = Math.max(0, Math.floor(Number(data.novaVaultPending) || 0));
        credits = Math.max(0, Math.floor(Number(data.novaVaultBoostCredits) || 0));
        refs.pending.textContent = `${pendingVaults} VAULT${pendingVaults === 1 ? '' : 'S'}`;
        refs.booster.textContent = Math.max(0, Number(data.novaBoosterInventory) || 0);
        refs.rain.textContent = Math.max(0, Number(data.novaRainInventory) || 0);
        refs.warp.textContent = Math.max(0, Number(data.novaTimeWarpInventory) || 0);
        if (!busy) refs.status.textContent = pendingVaults > 0
          ? (credits > 0 ? 'Secure 10X credit detected. OPEN VAULT will use the boosted server reward pool.' : 'Vault ready. OPEN VAULT will use the normal secure reward pool.')
          : 'No Nova Vault is ready yet. Complete a mining session to earn one.';
        paint();
      }, error => {
        if (active) refs.status.textContent = error?.message || 'Could not sync Nova inventory.';
      });
      if (!active) unsubscribe();
      else off = unsubscribe;
    } catch (error) {
      if (active) refs.status.textContent = error?.message || 'Could not sync Nova inventory.';
    }
  };

  const run = async (label, name, data = {}) => {
    if (busy) return null;
    setBusy(true);
    if (active) refs.status.textContent = `${label} • secure server request…`;
    try {
      const result = await secureCall(name, data);
      if (!active) return null;
      const reward = result.reward || {};
      refs.status.textContent = result.opened
        ? `✓ ${result.boosted ? '10X boosted ' : ''}Vault opened • ${rewardText(reward)}`
        : `✓ ${label} completed.`;
      return result;
    } catch (error) {
      if (active) refs.status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
      return null;
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  };

  refs.open.addEventListener('click', async () => {
    if (busy || pendingVaults < 1) return;
    const boosted = credits > 0;
    await run(
      boosted ? 'Opening 10X Boosted Vault' : 'Opening Vault',
      boosted ? 'openNovaVaultBoosted' : 'openNovaVault',
      boosted ? { source:'fresh-rebuild-10x-single-open' } : {}
    );
  });

  refs.watch.addEventListener('click', async () => {
    if (!active || busy || credits >= 3) return;
    setBusy(true);
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = credits;
      refs.boostStatus.textContent = 'OPENING REWARDED AD…';
      const result = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!result.earned) throw new Error('Ad closed before reward completion. No 10X credit was created.');
      if (!active) return;
      if (result.testMode || nativeAds.status().testMode) {
        refs.boostStatus.textContent = 'TEST AD COMPLETE • NO SECURE CREDIT';
        refs.status.textContent = 'TEST ads do not create 10X credits. Production Google SSV verification is required.';
        return;
      }
      refs.boostStatus.textContent = 'WAITING FOR GOOGLE-SIGNED CREDIT…';
      const deadline = Date.now() + 12_000;
      while (active && Date.now() < deadline && credits <= before) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      if (!active) return;
      if (credits <= before) throw new Error('The secure 10X credit has not arrived yet. Check again shortly.');
      refs.boostStatus.textContent = '10X BOOST ACTIVE';
      refs.status.textContent = '✓ Secure 10X credit verified. Your next OPEN VAULT will use the boosted reward pool.';
    } catch (error) {
      if (active) {
        refs.boostStatus.textContent = '10X BOOST NOT ACTIVE';
        refs.status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
      }
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  root.querySelector('[data-vault-boost]').addEventListener('click', () => run('Using Booster', 'useNovaBoost', { kind:'booster' }));
  root.querySelector('[data-vault-rain-use]').addEventListener('click', () => run('Using Nova Rain', 'useNovaBoost', { kind:'rain' }));
  root.querySelector('[data-vault-warp-use]').addEventListener('click', () => run('Using Time Warp', 'useNovaTimeWarp'));
  root.querySelector('[data-vault-warp-use-wide]').addEventListener('click', () => run('Using 24H Time Warp', 'useNovaTimeWarp'));

  nativeAds.requestStatus();
  queueMicrotask(() => { bindShell(); paint(); });
  bind();
  paint();

  root.__cleanup = () => {
    active = false;
    off?.();
    off = null;
    shellCredit?.remove();
    shellCredit = null;
    shell?.classList.remove('nx-vault-screen-v3');
    shell?.querySelector('.nx-app-head')?.classList.remove('nx-vault-head-v3');
    shell = null;
  };
  return root;
}

export const novaVaultSafeRenderers = Object.freeze({ 'nova-vault': renderNovaVaultSafe });