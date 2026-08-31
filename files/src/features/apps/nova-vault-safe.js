import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

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

function vaultGlyph() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="7" width="48" height="50" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="32" r="5" fill="currentColor"/><path d="M32 14v8M32 42v8M14 32h8M42 32h8M22 22l5 5M42 22l-5 5M22 42l5-5M42 42l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
}

function boosterGlyph() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8h20l4 7v34l-5 7H23l-5-7V15z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M22 15h24M22 49h24M27 6h10M32 17l-8 17h9l-4 14 13-21h-9l5-10z" fill="currentColor"/><path d="M19 20h4M41 20h4M19 44h4M41 44h4" stroke="currentColor" stroke-width="2"/></svg>';
}

function rainGlyph() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 35h30c7 0 11-4 11-10s-5-10-11-10c-2-7-8-11-16-11-9 0-16 6-18 14C7 19 4 23 4 28c0 4 4 7 13 7Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m17 40-5 9h6l-4 10 11-14h-6l4-5M34 40l-5 9h6l-4 10 11-14h-6l4-5M49 39l-4 7h5l-3 8 9-11h-5l3-4" fill="currentColor"/></svg>';
}

function warpGlyph() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 7h28M18 57h28M21 10c1 12 7 16 11 19-4 3-10 7-11 18M43 10c-1 12-7 16-11 19 4 3 10 7 11 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M25 17h14c-1 6-4 9-7 11-3-2-6-5-7-11Zm2 31c1-7 3-11 5-14 2 3 4 7 5 14Z" fill="currentColor"/></svg>';
}

function playGlyph() {
  return '<svg viewBox="0 0 44 44" aria-hidden="true"><rect x="3" y="5" width="38" height="34" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m18 14 13 8-13 8z" fill="currentColor"/></svg>';
}

function crystalGlyph() {
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 4 15 9 2 18-17 13L7 31l2-18z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m24 9 9 7-4 18H19l-4-18zM9 16h30M19 34l5 9 5-9" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
}

function ensureNovaVaultReferenceStyle() {
  if (document.getElementById('nx-nova-vault-reference-v4-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-reference-v4-style';
  style.textContent = `
    .nx-screen.nx-vault-screen-v4{width:100%!important;max-width:none!important;min-height:100dvh!important;margin:0!important;padding:0!important;overflow-x:hidden!important;background:radial-gradient(circle at 50% -8%,rgba(0,134,220,.17),transparent 32%),linear-gradient(180deg,#020914 0%,#010711 62%,#01060d 100%)!important;color:#eef8ff!important}
    .nx-vault-screen-v4 [data-app-mount]{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:transparent!important}
    .nx-vault-head-v4{position:relative!important;display:grid!important;grid-template-columns:minmax(52px,9.2vw) minmax(52px,9.2vw) minmax(0,1fr) minmax(112px,22vw)!important;align-items:center!important;gap:1.25vw!important;height:9.15dvh!important;min-height:112px!important;max-height:140px!important;margin:0!important;padding:1.05dvh 1.45vw!important;border:0!important;border-bottom:1px solid rgba(19,140,211,.34)!important;border-radius:0!important;background:linear-gradient(180deg,#061625 0%,#03101d 100%)!important;box-shadow:inset 0 -1px 0 rgba(110,217,255,.08),0 10px 28px rgba(0,0,0,.34)!important;box-sizing:border-box!important}
    .nx-vault-head-v4:before{content:'';position:absolute;left:22%;right:24%;bottom:0;height:2px;background:linear-gradient(90deg,transparent,#0dbfff 26%,#6fdcff 50%,#0dbfff 74%,transparent);opacity:.88;pointer-events:none}
    .nx-vault-head-v4 .nx-back,.nx-vault-head-v4 .nx-app-head__icon{width:100%!important;height:auto!important;aspect-ratio:1!important;min-width:0!important;border:2px solid rgba(73,164,217,.42)!important;border-radius:7px!important;background:linear-gradient(145deg,#103b5d 0%,#061828 45%,#0b2941 100%)!important;box-shadow:inset 0 0 0 3px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.18),0 0 18px rgba(0,171,255,.13),0 7px 14px rgba(0,0,0,.4)!important;color:#47dbff!important;display:grid!important;place-items:center!important;padding:0!important}
    .nx-vault-head-v4 .nx-back{font-size:clamp(34px,6vw,58px)!important;line-height:.8!important;color:#f3fbff!important;text-shadow:0 0 10px rgba(45,205,255,.5)}
    .nx-vault-head-v4 .nx-app-head__icon svg{width:48%!important;height:48%!important;filter:drop-shadow(0 0 7px rgba(42,205,255,.65))}
    .nx-vault-head-v4>div{min-width:0!important;text-align:center!important}
    .nx-vault-head-v4 .nx-eyebrow{display:none!important}
    .nx-vault-head-v4 h1{margin:0!important;white-space:nowrap!important;color:#f5f8fd!important;font-size:clamp(18px,4.25vw,44px)!important;line-height:1!important;font-weight:950!important;letter-spacing:.005em!important;text-transform:uppercase!important;text-shadow:0 2px 0 #000,0 0 14px rgba(101,183,255,.18)!important}
    .nx-vault-head-v4>div>p:last-child{margin:.65dvh 0 0!important;white-space:nowrap!important;color:#b7c9dd!important;font-size:clamp(9px,1.7vw,18px)!important;line-height:1!important;letter-spacing:.11em!important;text-transform:uppercase!important;font-weight:850!important}
    .nx-vault-head-credit-v4{justify-self:end;width:100%;height:72%;min-height:68px;display:grid;grid-template-columns:34% 1fr;align-items:center;padding:.65dvh .75vw;border:2px solid rgba(185,77,245,.48);border-radius:6px;background:linear-gradient(145deg,#261039 0%,#10091f 54%,#1a0b2d 100%);box-shadow:inset 0 0 0 3px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.1),0 0 18px rgba(191,58,255,.15);color:#e45dff;box-sizing:border-box}
    .nx-vault-head-credit-v4 i{display:grid;place-items:center;width:100%;aspect-ratio:1;color:#d45cff;filter:drop-shadow(0 0 8px rgba(212,76,255,.65))}.nx-vault-head-credit-v4 i svg{width:78%;height:78%}.nx-vault-head-credit-v4 div{text-align:center;min-width:0}.nx-vault-head-credit-v4 strong{display:block;white-space:nowrap;color:#fff;font-size:clamp(11px,2vw,21px);line-height:1;font-weight:950}.nx-vault-head-credit-v4 span{display:block;margin-top:.55dvh;white-space:nowrap;color:#d65dff;font-size:clamp(8px,1.35vw,14px);line-height:1;font-weight:950;letter-spacing:.06em;text-transform:uppercase}.nx-vault-head-credit-v4.is-active{border-color:rgba(226,88,255,.82);box-shadow:inset 0 0 0 3px rgba(0,0,0,.25),0 0 24px rgba(203,57,255,.26)}

    .nx-vault-v4{--v4-cyan:#15c8ff;--v4-blue:#0788ff;--v4-purple:#c046ff;--v4-line:rgba(84,181,231,.5);width:100%!important;max-width:none!important;min-height:90.85dvh!important;margin:0!important;padding:1.15dvh 0 calc(6.5dvh + env(safe-area-inset-bottom))!important;display:grid!important;grid-template-rows:21.0dvh 10.1dvh 26.3dvh 21.4dvh!important;gap:1.15dvh!important;justify-items:center!important;align-content:start!important;box-sizing:border-box!important;background:radial-gradient(circle at 20% 8%,rgba(0,134,255,.08),transparent 28%),radial-gradient(circle at 82% 47%,rgba(151,32,255,.07),transparent 27%),linear-gradient(180deg,#020a14 0%,#010711 100%)!important;color:#edf8ff!important}
    .nx-vault-v4 *{box-sizing:border-box}.nx-vault-v4 button{font-family:inherit}.nx-vault-v4 button:disabled{opacity:.48!important;filter:saturate(.5)!important}
    .nx-v4-panel{position:relative;overflow:hidden;border:2px solid rgba(78,173,224,.45);border-radius:7px;background:linear-gradient(145deg,#071b2b 0%,#03101c 58%,#020a13 100%);box-shadow:inset 0 0 0 4px rgba(0,0,0,.4),inset 0 0 0 5px rgba(97,190,239,.07),inset 0 1px 0 rgba(255,255,255,.13),0 7px 18px rgba(0,0,0,.35)}
    .nx-v4-panel:before{content:'';position:absolute;inset:4px;pointer-events:none;background:linear-gradient(90deg,var(--v4-cyan),transparent 11%,transparent 89%,var(--v4-cyan)) top/100% 2px no-repeat,linear-gradient(90deg,var(--v4-cyan),transparent 11%,transparent 89%,var(--v4-cyan)) bottom/100% 2px no-repeat,linear-gradient(180deg,var(--v4-cyan),transparent 16%,transparent 84%,var(--v4-cyan)) left/2px 100% no-repeat,linear-gradient(180deg,var(--v4-cyan),transparent 16%,transparent 84%,var(--v4-cyan)) right/2px 100% no-repeat;opacity:.46}
    .nx-v4-panel:after{content:'';position:absolute;left:26%;right:26%;top:0;height:2px;background:linear-gradient(90deg,transparent,#45d9ff,#078cff,#45d9ff,transparent);box-shadow:0 0 10px rgba(34,196,255,.45);pointer-events:none}

    .nx-v4-hero{width:92.6%;height:100%;padding:2.4dvh 5.2vw;display:grid;grid-template-columns:minmax(0,58%) minmax(0,34%);gap:5%;align-items:center}
    .nx-v4-hero-copy{position:relative;z-index:2;min-width:0}.nx-v4-kicker{margin:0 0 1.3dvh;color:var(--v4-cyan);font-size:clamp(11px,2.15vw,22px);font-weight:950;letter-spacing:.17em;text-transform:uppercase;white-space:nowrap}.nx-v4-count-line{display:flex;align-items:baseline;gap:1.35vw;white-space:nowrap;color:#f3f7fc;font-size:clamp(42px,9.35vw,94px);line-height:.88;font-weight:950;letter-spacing:-.045em;text-shadow:0 3px 0 #000,0 0 22px rgba(38,174,255,.13)}.nx-v4-count-line b{font:inherit}.nx-v4-ready{display:block;margin-top:1.6dvh;color:#16c8ff;font-size:clamp(15px,3.05vw,31px);line-height:1;font-weight:950;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
    .nx-v4-machine{justify-self:end;position:relative;width:31vw;max-width:300px;min-width:142px;aspect-ratio:1.08;border:3px solid rgba(98,185,231,.58);border-radius:8px;background:linear-gradient(135deg,#1a405c 0%,#071826 25%,#0c2d45 68%,#06121e 100%);box-shadow:inset 0 0 0 5px rgba(0,0,0,.42),inset 0 0 0 7px rgba(123,204,246,.06),inset -18px -12px 28px rgba(0,0,0,.45),0 0 22px rgba(0,161,255,.19),9px 12px 0 rgba(1,7,13,.75);display:grid;place-items:center;color:#32d7ff}
    .nx-v4-machine:before{content:'';position:absolute;inset:17%;border:4px solid #1d6e9d;border-radius:50%;background:radial-gradient(circle,#07131d 0 23%,#0f3a55 24% 34%,#0a1620 35% 47%,#008ed1 48% 52%,#05121c 53% 67%,#0c5b85 68% 72%,#07131c 73%);box-shadow:inset 0 0 14px #000,0 0 17px rgba(18,191,255,.47)}.nx-v4-machine:after{content:'';position:absolute;right:-8%;top:12%;bottom:12%;width:9%;border:2px solid rgba(76,164,215,.38);background:linear-gradient(180deg,#0d334e,#03111f 45%,#0a2941);box-shadow:inset 0 0 7px #000}.nx-v4-machine svg{position:relative;z-index:2;width:31%;height:31%;filter:drop-shadow(0 0 8px rgba(34,206,255,.75))}

    .nx-v4-stats{width:92.3%;height:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2.05%}.nx-v4-stat{height:100%;padding:1.15dvh 2.5vw;display:grid;grid-template-columns:35% minmax(0,1fr);align-items:center;gap:7%}.nx-v4-stat-icon{width:100%;max-width:82px;aspect-ratio:.82;display:grid;place-items:center;color:#38d9ff;border:2px solid rgba(51,187,240,.42);border-radius:8px;background:linear-gradient(180deg,#0a5a87,#061c2c);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 15px rgba(23,180,255,.17)}.nx-v4-stat-icon svg{width:74%;height:74%}.nx-v4-stat--rain .nx-v4-stat-icon{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#0b4666,#061725)}.nx-v4-stat--warp{border-color:rgba(183,59,248,.5);background:linear-gradient(145deg,#0b1420 0%,#0b0a18 55%,#170922 100%)}.nx-v4-stat--warp:after{background:linear-gradient(90deg,transparent,#a33bff,#e45cff,#a33bff,transparent)}.nx-v4-stat--warp .nx-v4-stat-icon{color:#d85cff;border-color:rgba(207,82,255,.52);background:linear-gradient(180deg,#51156c,#1b0929);box-shadow:0 0 15px rgba(183,45,255,.18)}.nx-v4-stat-copy span{display:block;color:#c6d2e0;font-size:clamp(9px,1.85vw,19px);line-height:1;font-weight:900;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap}.nx-v4-stat-copy strong{display:block;margin-top:.65dvh;color:#f3f7fc;font-size:clamp(25px,4.9vw,50px);line-height:.95;font-weight:950;text-shadow:0 2px 0 #000}

    .nx-v4-primary{width:96.4%;height:100%;display:grid;grid-template-columns:minmax(0,56%) minmax(0,40.7%);gap:2.2%}.nx-v4-open,.nx-v4-boost{height:100%;padding:3.0dvh 3.4vw 2.05dvh;display:flex;flex-direction:column}.nx-v4-title{margin:0;color:var(--v4-cyan);font-size:clamp(14px,2.85vw,29px);line-height:1;font-weight:950;letter-spacing:.035em;text-transform:uppercase}.nx-v4-copy{margin:1.55dvh 0 0;color:#b5c5d8;font-size:clamp(10px,2.05vw,21px);line-height:1.48}.nx-v4-mode{display:none}.nx-v4-open-button{position:relative;margin-top:auto;width:100%;height:8.6dvh;min-height:76px;border:2px solid rgba(66,196,247,.72)!important;border-radius:7px!important;background:linear-gradient(180deg,#0b66a9 0%,#084774 51%,#062b47 100%)!important;color:#fff!important;font-size:clamp(19px,3.8vw,39px)!important;font-weight:950!important;letter-spacing:.01em!important;text-shadow:0 2px 0 #032238!important;box-shadow:inset 0 0 0 5px rgba(0,0,0,.25),inset 0 2px 0 rgba(255,255,255,.18),inset 0 -17px 25px rgba(0,0,0,.27),0 0 0 5px rgba(12,127,194,.11),0 0 22px rgba(0,176,255,.2)!important}.nx-v4-open-button:before{content:'N';position:absolute;left:50%;top:-20px;transform:translateX(-50%) rotate(45deg);width:40px;height:40px;display:grid;place-items:center;border:2px solid rgba(72,206,255,.7);background:linear-gradient(145deg,#0a527c,#061928);box-shadow:inset 0 0 0 3px rgba(0,0,0,.35),0 0 10px rgba(20,190,255,.27);color:#63e2ff;font-size:17px;line-height:1}.nx-v4-open-button:after{content:'N';position:absolute;left:50%;top:-20px;transform:translateX(-50%);width:40px;height:40px;display:grid;place-items:center;color:#63e2ff;font-size:17px;line-height:40px;text-align:center}.nx-v4-open-button:active,.nx-v4-watch:active{transform:translateY(1px)}.nx-v4-status{margin:1.25dvh 0 0;min-height:2.5dvh;color:#85a8c3;font-size:clamp(8px,1.6vw,16px);line-height:1.38}
    .nx-vault-v4[data-boost-active="true"] .nx-v4-open{border-color:rgba(190,68,255,.58)}.nx-vault-v4[data-boost-active="true"] .nx-v4-open-button{border-color:rgba(217,85,255,.77)!important;background:linear-gradient(180deg,#812caf,#5c197d 52%,#38104d 100%)!important;box-shadow:inset 0 0 0 5px rgba(0,0,0,.25),inset 0 2px 0 rgba(255,255,255,.17),0 0 25px rgba(193,43,255,.3)!important}

    .nx-v4-boost{border-color:rgba(185,62,248,.55);background:linear-gradient(145deg,#160b25 0%,#0b0818 54%,#10061b 100%)}.nx-v4-boost:before{background:linear-gradient(90deg,#a13cff,transparent 11%,transparent 89%,#a13cff) top/100% 2px no-repeat,linear-gradient(90deg,#a13cff,transparent 11%,transparent 89%,#a13cff) bottom/100% 2px no-repeat,linear-gradient(180deg,#a13cff,transparent 16%,transparent 84%,#a13cff) left/2px 100% no-repeat,linear-gradient(180deg,#a13cff,transparent 16%,transparent 84%,#a13cff) right/2px 100% no-repeat;opacity:.48}.nx-v4-boost:after{background:linear-gradient(90deg,transparent,#8434ff,#e05cff,#8434ff,transparent)}.nx-v4-boost-title{margin:0;color:#df5dff;font-size:clamp(17px,3.35vw,34px);line-height:1;font-weight:950;letter-spacing:.035em;text-align:center;text-transform:uppercase}.nx-v4-watch{margin-top:auto;width:100%;height:8.6dvh;min-height:76px;border:2px solid rgba(220,86,255,.8)!important;border-radius:7px!important;background:linear-gradient(180deg,#7d24a9 0%,#581776 54%,#3a0e4f 100%)!important;color:#fff!important;font-size:clamp(15px,2.9vw,30px)!important;font-weight:950!important;line-height:1.05!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:1.2vw!important;text-align:left!important;box-shadow:inset 0 0 0 5px rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.16),0 0 21px rgba(207,55,255,.25)!important}.nx-v4-watch svg{width:20%;max-width:43px;height:auto}.nx-v4-boost-state{margin:1.1dvh 0 0;color:#d14eff;font-size:clamp(9px,1.7vw,17px);font-weight:950;text-align:center;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}

    .nx-v4-inventory{width:97%;height:100%;padding:1.7dvh 3.4vw 2.05dvh;display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,.76fr);gap:1.35dvh}.nx-v4-inventory-title{display:flex;align-items:center;justify-content:center;gap:2.1vw;color:var(--v4-cyan);font-size:clamp(14px,2.7vw,28px);line-height:1;font-weight:950;letter-spacing:.07em;text-transform:uppercase}.nx-v4-inventory-title:before,.nx-v4-inventory-title:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(24,195,255,.72))}.nx-v4-inventory-title:after{background:linear-gradient(90deg,rgba(24,195,255,.72),transparent)}.nx-v4-inventory-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.5vw}.nx-v4-inv-button,.nx-v4-warp-button{border:2px solid rgba(49,176,225,.48)!important;border-radius:7px!important;background:linear-gradient(180deg,#082b43,#041522)!important;color:#27ccff!important;box-shadow:inset 0 0 0 4px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.08)!important;font-weight:950!important;text-transform:uppercase!important}.nx-v4-inv-button{display:grid!important;grid-template-columns:36% 1fr!important;align-items:center!important;gap:6%!important;padding:1dvh 1.4vw!important;font-size:clamp(9px,1.9vw,19px)!important;text-align:left!important}.nx-v4-inv-button span{display:grid;place-items:center;color:#38d7ff}.nx-v4-inv-button svg{width:74%;max-width:58px;height:auto}.nx-v4-inv-button--warp{border-color:rgba(190,58,248,.48)!important;background:linear-gradient(180deg,#250c35,#0e0819)!important;color:#e05cff!important}.nx-v4-inv-button--warp span{color:#d95aff}.nx-v4-warp-button{display:flex!important;align-items:center!important;justify-content:center!important;gap:2.4vw!important;font-size:clamp(12px,2.4vw,25px)!important}.nx-v4-24h{width:54px;max-width:12vw;aspect-ratio:1;border:3px solid #ce45ff;border-radius:50%;display:grid;place-items:center;color:#f2b4ff;background:radial-gradient(circle,#38104f,#12081e);box-shadow:0 0 14px rgba(205,55,255,.25);font-size:clamp(10px,1.85vw,19px);text-transform:none}

    @media(max-width:430px){
      .nx-vault-head-v4{grid-template-columns:13.5vw 13.5vw minmax(0,1fr) 24vw!important;gap:1.6vw!important;padding-left:2.2vw!important;padding-right:2.2vw!important}.nx-vault-head-v4 h1{font-size:4.15vw!important}.nx-vault-head-v4>div>p:last-child{font-size:1.72vw!important}.nx-vault-head-credit-v4{min-height:0!important;height:70%!important;padding:.45dvh .35vw!important}.nx-vault-head-credit-v4 strong{font-size:2.35vw!important}.nx-vault-head-credit-v4 span{font-size:1.7vw!important}
      .nx-v4-hero{padding-left:4.2vw;padding-right:4.2vw;grid-template-columns:minmax(0,59%) minmax(0,35%);gap:4%}.nx-v4-kicker{font-size:2.25vw}.nx-v4-count-line{font-size:9.4vw}.nx-v4-ready{font-size:3.0vw}.nx-v4-machine{width:31.5vw;min-width:0}
      .nx-v4-stat{padding-left:1.8vw;padding-right:1.8vw;grid-template-columns:39% minmax(0,1fr);gap:5%}.nx-v4-stat-copy span{font-size:1.85vw}.nx-v4-stat-copy strong{font-size:5vw}
      .nx-v4-primary{grid-template-columns:minmax(0,56.2%) minmax(0,41.2%);gap:1.8%}.nx-v4-open,.nx-v4-boost{padding-left:3vw;padding-right:3vw}.nx-v4-title{font-size:2.9vw}.nx-v4-copy{font-size:2.02vw}.nx-v4-open-button{font-size:3.9vw}.nx-v4-boost-title{font-size:3.35vw}.nx-v4-watch{font-size:2.85vw}.nx-v4-status{font-size:1.55vw}.nx-v4-boost-state{font-size:1.72vw}
      .nx-v4-inv-button{font-size:1.87vw!important}.nx-v4-warp-button{font-size:2.4vw!important}
    }
  `;
  document.head.appendChild(style);
}

function installReferenceHeader(root, creditGetter, activeRef) {
  queueMicrotask(() => {
    if (!activeRef()) return;
    const screen = root.closest('.nx-screen');
    const head = screen?.querySelector('.nx-app-head');
    if (!screen || !head) return;
    screen.classList.remove('nx-vault-screen-v3');
    screen.classList.add('nx-vault-screen-v4');
    head.classList.remove('nx-vault-head-v3');
    head.classList.add('nx-vault-head-v4');
    const title = head.querySelector('h1');
    const description = head.querySelector('div > p:last-child');
    if (title) title.textContent = 'NOVA VAULT + 10X';
    if (description) description.textContent = 'SECURE MINING REWARDS';
    head.querySelector('[data-vault-head-credit]')?.remove();
    const credit = document.createElement('div');
    credit.className = 'nx-vault-head-credit-v4';
    credit.dataset.vaultHeadCredit = 'true';
    credit.innerHTML = `<i>${crystalGlyph()}</i><div><strong data-v4-credit-count>0 CREDITS</strong><span>10X BOOST</span></div>`;
    head.appendChild(credit);
    creditGetter(credit);
  });
}

export function renderNovaVaultSafe() {
  ensureNovaVaultReferenceStyle();
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-vault-v4';
  root.dataset.vaultV3Integrated = 'true';
  root.dataset.boostActive = 'false';
  root.innerHTML = `
    <section class="nx-v4-panel nx-v4-hero">
      <div class="nx-v4-hero-copy">
        <p class="nx-v4-kicker">NOVA REWARD SYSTEM</p>
        <div class="nx-v4-count-line"><b data-vault-pending>—</b><span>VAULTS</span></div>
        <strong class="nx-v4-ready">READY TO OPEN</strong>
      </div>
      <div class="nx-v4-machine" aria-hidden="true">${vaultGlyph()}</div>
    </section>

    <section class="nx-v4-stats" aria-label="Nova Vault inventory summary">
      <article class="nx-v4-panel nx-v4-stat">
        <span class="nx-v4-stat-icon">${boosterGlyph()}</span>
        <div class="nx-v4-stat-copy"><span>BOOSTER</span><strong data-vault-booster>—</strong></div>
      </article>
      <article class="nx-v4-panel nx-v4-stat nx-v4-stat--rain">
        <span class="nx-v4-stat-icon">${rainGlyph()}</span>
        <div class="nx-v4-stat-copy"><span>NOVA RAIN</span><strong data-vault-rain>—</strong></div>
      </article>
      <article class="nx-v4-panel nx-v4-stat nx-v4-stat--warp">
        <span class="nx-v4-stat-icon">${warpGlyph()}</span>
        <div class="nx-v4-stat-copy"><span>TIME WARP</span><strong data-vault-warp>—</strong></div>
      </article>
    </section>

    <section class="nx-v4-primary">
      <article class="nx-v4-panel nx-v4-open">
        <h2 class="nx-v4-title">OPEN YOUR VAULT</h2>
        <p class="nx-v4-copy">Open your earned Nova Vault for a secure server-selected reward.</p>
        <span class="nx-v4-mode" data-vault-mode>NORMAL VAULT MODE</span>
        <button class="nx-v4-open-button" type="button" data-vault-open>OPEN VAULT</button>
        <p class="nx-v4-status" data-vault-status>Syncing secure Nova inventory…</p>
      </article>

      <article class="nx-v4-panel nx-v4-boost">
        <h2 class="nx-v4-boost-title">10X BOOST</h2>
        <p class="nx-v4-copy">Watch a rewarded ad to upgrade your next Vault opening to 10X rewards.</p>
        <button class="nx-v4-watch" type="button" data-vault-watch>${playGlyph()}<span>WATCH AD<br>FOR 10X</span></button>
        <strong class="nx-v4-boost-state" data-vault-boost-state>10X BOOST NOT ACTIVE</strong>
      </article>
    </section>

    <section class="nx-v4-panel nx-v4-inventory">
      <div class="nx-v4-inventory-title">BOOST INVENTORY</div>
      <div class="nx-v4-inventory-row">
        <button class="nx-v4-inv-button" type="button" data-vault-boost><span>${boosterGlyph()}</span><b>USE BOOSTER</b></button>
        <button class="nx-v4-inv-button" type="button" data-vault-rain-use><span>${rainGlyph()}</span><b>USE NOVA RAIN</b></button>
        <button class="nx-v4-inv-button nx-v4-inv-button--warp" type="button" data-vault-warp-use><span>${warpGlyph()}</span><b>USE TIME WARP</b></button>
      </div>
      <button class="nx-v4-warp-button" type="button" data-vault-warp-use><span class="nx-v4-24h">24h</span><b>USE 24H TIME WARP</b></button>
    </section>`;

  const refs = {
    pending: root.querySelector('[data-vault-pending]'),
    booster: root.querySelector('[data-vault-booster]'),
    rain: root.querySelector('[data-vault-rain]'),
    warp: root.querySelector('[data-vault-warp]'),
    open: root.querySelector('[data-vault-open]'),
    watch: root.querySelector('[data-vault-watch]'),
    status: root.querySelector('[data-vault-status]'),
    mode: root.querySelector('[data-vault-mode]'),
    boostState: root.querySelector('[data-vault-boost-state]'),
    boostButtons: [...root.querySelectorAll('[data-vault-boost]')],
    rainButtons: [...root.querySelectorAll('[data-vault-rain-use]')],
    warpButtons: [...root.querySelectorAll('[data-vault-warp-use]')]
  };

  let off = null;
  let active = true;
  let busy = false;
  let pending = 0;
  let booster = 0;
  let rain = 0;
  let warp = 0;
  let credits = 0;
  let headCredit = null;

  installReferenceHeader(root, credit => {
    headCredit = credit;
    paint();
  }, () => active);

  const paint = () => {
    if (!active) return;
    refs.pending.textContent = String(pending);
    refs.booster.textContent = String(booster);
    refs.rain.textContent = String(rain);
    refs.warp.textContent = String(warp);
    root.dataset.boostActive = credits > 0 ? 'true' : 'false';
    refs.open.textContent = 'OPEN VAULT';
    refs.open.disabled = busy || pending < 1;
    refs.watch.disabled = busy || credits >= 3;
    refs.boostButtons.forEach(button => { button.disabled = busy || booster < 1; });
    refs.rainButtons.forEach(button => { button.disabled = busy || rain < 1; });
    refs.warpButtons.forEach(button => { button.disabled = busy || warp < 1; });
    refs.mode.textContent = credits > 0 ? `10X BOOST ACTIVE • ${credits} CREDIT${credits === 1 ? '' : 'S'}` : 'NORMAL VAULT MODE';
    refs.boostState.textContent = credits > 0 ? `10X BOOST ACTIVE • ${credits} CREDIT${credits === 1 ? '' : 'S'}` : '10X BOOST NOT ACTIVE';
    if (headCredit) {
      headCredit.classList.toggle('is-active', credits > 0);
      const count = headCredit.querySelector('[data-v4-credit-count]');
      if (count) count.textContent = `${credits} CREDIT${credits === 1 ? '' : 'S'}`;
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
        pending = Math.max(0, Math.floor(Number(data.novaVaultPending) || 0));
        booster = Math.max(0, Math.floor(Number(data.novaBoosterInventory) || 0));
        rain = Math.max(0, Math.floor(Number(data.novaRainInventory) || 0));
        warp = Math.max(0, Math.floor(Number(data.novaTimeWarpInventory) || 0));
        credits = Math.max(0, Math.floor(Number(data.novaVaultBoostCredits) || 0));
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

  const waitForCredit = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) {
      if (credits > before) return true;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    return active && credits > before;
  };

  refs.open.addEventListener('click', async () => {
    if (!active || busy || pending < 1) return;
    const boosted = credits > 0;
    setBusy(true);
    refs.status.textContent = boosted ? 'Opening 10X boosted Vault on the secure server…' : 'Opening Vault on the secure server…';
    try {
      const result = await secureCall(boosted ? 'openNovaVaultBoosted' : 'openNovaVault', boosted ? { source:'fresh-rebuild-reference-v4' } : {});
      if (!active) return;
      refs.status.textContent = `✓ ${boosted ? '10X ' : ''}Vault opened • ${rewardText(result.reward)}.`;
    } catch (error) {
      if (active) refs.status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  refs.watch.addEventListener('click', async () => {
    if (!active || busy || credits >= 3) return;
    setBusy(true);
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = credits;
      if (active) refs.status.textContent = 'Opening rewarded ad for secure 10X verification…';
      const result = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!result.earned) throw new Error('Ad closed before reward completion. No 10X credit was created.');
      if (!active) return;
      if (result.testMode || nativeAds.status().testMode) {
        refs.status.textContent = '✓ TEST ad completed. TEST ads do not create secure 10X credits; production SSV verification is required.';
        return;
      }
      refs.status.textContent = 'Ad completed • waiting for signed server verification…';
      const verified = await waitForCredit(before);
      if (!active) return;
      if (!verified) throw new Error('The signed 10X credit has not arrived yet. Check again shortly; no client-side credit was created.');
      refs.status.textContent = '✓ Secure 10X boost active. OPEN VAULT will use the boosted reward pool.';
    } catch (error) {
      if (active) refs.status.textContent = error?.message || '10X rewarded flow could not be completed.';
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  const runInventory = async (label, name, data = {}) => {
    if (!active || busy) return;
    setBusy(true);
    refs.status.textContent = `${label} • secure server request…`;
    try {
      await secureCall(name, data);
      if (active) refs.status.textContent = `✓ ${label} completed.`;
    } catch (error) {
      if (active) refs.status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  };

  refs.boostButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Booster', 'useNovaBoost', { kind:'booster' })));
  refs.rainButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Nova Rain', 'useNovaBoost', { kind:'rain' })));
  refs.warpButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Time Warp', 'useNovaTimeWarp')));

  nativeAds.requestStatus();
  bind();
  paint();

  root.__cleanup = () => {
    active = false;
    off?.();
    off = null;
    headCredit?.remove();
    headCredit = null;
  };
  return root;
}

export const novaVaultSafeRenderers = Object.freeze({ 'nova-vault': renderNovaVaultSafe });
