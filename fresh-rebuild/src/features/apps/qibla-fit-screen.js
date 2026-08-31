import { qiblaSafeV2Renderers } from './premium-qibla-safe-v2.js';

function ensureQiblaFitStyles() {
  if (document.getElementById('nx-qibla-fit-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-qibla-fit-v1';
  style.textContent = `
    html.nx-qibla-fit-active,html.nx-qibla-fit-active body{height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;overscroll-behavior:none!important}
    html.nx-qibla-fit-active body .nx-app{height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;overflow:hidden!important}
    html.nx-qibla-fit-active body .nx-stage{height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;padding:0 0 calc(var(--nx-dock-height) + var(--nx-safe-bottom))!important;overflow:hidden!important;overscroll-behavior:none!important}
    html.nx-qibla-fit-active .nx-screen.nx2-qibla-screen{width:100%!important;height:calc(100dvh - var(--nx-dock-height) - var(--nx-safe-bottom))!important;min-height:0!important;max-height:calc(100dvh - var(--nx-dock-height) - var(--nx-safe-bottom))!important;margin:0!important;overflow:hidden!important;overscroll-behavior:none!important}
    html.nx-qibla-fit-active .nx-screen.nx2-qibla-screen>[data-app-mount]{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qibla{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;padding:0!important;margin:0!important;overflow:hidden!important;overscroll-behavior:none!important;scrollbar-width:none!important}
    html.nx-qibla-fit-active .nx2-qibla::-webkit-scrollbar{display:none!important}
    html.nx-qibla-fit-active .nx2-qb-page{position:relative!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:7px 6px 6px!important;border-radius:0!important;overflow:hidden!important;overscroll-behavior:none!important}
    html.nx-qibla-fit-active .nx2-qb-head{grid-template-columns:38px 42px minmax(0,1fr) 38px 38px!important;gap:4px!important;min-width:0!important;align-items:center!important}
    html.nx-qibla-fit-active .nx2-qb-btn,html.nx-qibla-fit-active .nx2-qb-icon{height:40px!important;min-width:0!important;border-radius:12px!important}
    html.nx-qibla-fit-active .nx2-qb-btn{font-size:23px!important}
    html.nx-qibla-fit-active .nx2-qb-icon svg{width:31px!important;height:31px!important}
    html.nx-qibla-fit-active .nx2-qb-title{min-width:0!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-title strong{font-size:16px!important;line-height:1!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-title span{margin-top:3px!important;font-size:8px!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-grid{display:grid!important;grid-template-columns:minmax(68px,24%) minmax(0,52%) minmax(68px,24%)!important;gap:4px!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:5px 0 0!important;overflow:hidden!important;align-items:stretch!important}
    html.nx-qibla-fit-active .nx2-qb-side{min-width:0!important;min-height:0!important;overflow:hidden!important;gap:4px!important;align-content:stretch!important}
    html.nx-qibla-fit-active .nx2-qb-side--left{display:grid!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;height:100%!important}
    html.nx-qibla-fit-active .nx2-qb-side--right{display:grid!important;grid-template-rows:minmax(0,.82fr) minmax(0,1.18fr)!important;height:100%!important;gap:4px!important;justify-content:stretch!important}
    html.nx-qibla-fit-active .nx2-qb-side--left .nx2-qb-card:nth-child(1),html.nx-qibla-fit-active .nx2-qb-side--left .nx2-qb-card:nth-child(2),html.nx-qibla-fit-active .nx2-qb-side--left .nx2-qb-card:nth-child(3),html.nx-qibla-fit-active .nx2-qb-side--left .nx2-qb-card:nth-child(4),html.nx-qibla-fit-active .nx2-qb-side--right>.nx2-qb-card:first-child,html.nx-qibla-fit-active .nx2-qb-mag{height:auto!important;min-height:0!important}
    html.nx-qibla-fit-active .nx2-qb-card{min-width:0!important;min-height:0!important;padding:clamp(5px,1.15dvh,8px) 6px!important;border-radius:12px!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-card span{font-size:clamp(5.8px,.9dvh,7px)!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-card strong{margin-top:clamp(3px,.7dvh,6px)!important;font-size:clamp(11px,2.15dvh,17px)!important;line-height:1.02!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-card small{margin-top:3px!important;font-size:clamp(5.5px,.85dvh,7px)!important;line-height:1.15!important}
    html.nx-qibla-fit-active .nx2-qb-place{font-size:clamp(7.5px,1.35dvh,10px)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;white-space:normal!important}
    html.nx-qibla-fit-active .nx2-qb-green{font-size:clamp(8px,1.35dvh,10.5px)!important}
    html.nx-qibla-fit-active .nx2-qb-art{height:clamp(20px,4.7dvh,34px)!important;margin-top:clamp(3px,.7dvh,6px)!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-cal-orb{width:clamp(18px,3.8dvh,27px)!important;height:clamp(18px,3.8dvh,27px)!important;margin-top:clamp(3px,.7dvh,7px)!important;border-width:2px!important}
    html.nx-qibla-fit-active .nx2-qb-cal-orb::after{inset:5px!important}
    html.nx-qibla-fit-active .nx2-qb-visual{display:grid!important;place-items:center!important;min-width:0!important;min-height:0!important;height:100%!important;padding:0!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-compass{width:min(118%,34dvh)!important;max-width:118%!important;aspect-ratio:1!important;margin:auto!important;transform:none!important;filter:drop-shadow(0 12px 16px rgba(0,0,0,.43)) drop-shadow(0 0 14px rgba(33,128,184,.07))!important}
    html.nx-qibla-fit-active .nx2-qb-svg{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;overflow:visible!important}
    html.nx-qibla-fit-active .nx2-qb-mag-grid{grid-template-columns:14px minmax(0,1fr)!important;gap:clamp(4px,.8dvh,8px) 4px!important;margin-top:clamp(5px,1dvh,10px)!important;font-size:clamp(6px,1.05dvh,8.5px)!important;min-width:0!important}
    html.nx-qibla-fit-active .nx2-qb-mag-grid span{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-statusline{margin-top:clamp(5px,1dvh,10px)!important;padding-top:clamp(4px,.8dvh,8px)!important;font-size:clamp(5.5px,.9dvh,7px)!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-statusline strong,html.nx-qibla-fit-active .nx2-qb-statusline small{margin-top:4px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    html.nx-qibla-fit-active .nx2-qb-ready{display:block!important;height:26px!important;min-height:26px!important;margin:4px 0 0!important;padding:5px 8px!important;border-radius:9px!important;overflow:hidden!important}
    html.nx-qibla-fit-active .nx2-qb-ready-icon,html.nx-qibla-fit-active .nx2-qb-ready strong,html.nx-qibla-fit-active .nx2-qb-ready-art{display:none!important}
    html.nx-qibla-fit-active .nx2-qb-ready>div:nth-child(2){min-width:0!important}
    html.nx-qibla-fit-active .nx2-qb-ready p{margin:0!important;color:#93a9b8!important;font-size:7px!important;line-height:15px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    @media(max-height:620px){
      html.nx-qibla-fit-active .nx2-qb-page{padding:4px!important}
      html.nx-qibla-fit-active .nx2-qb-head{grid-template-columns:34px 36px minmax(0,1fr) 34px 34px!important;gap:3px!important}
      html.nx-qibla-fit-active .nx2-qb-btn,html.nx-qibla-fit-active .nx2-qb-icon{height:35px!important;border-radius:10px!important}
      html.nx-qibla-fit-active .nx2-qb-icon svg{width:27px!important;height:27px!important}
      html.nx-qibla-fit-active .nx2-qb-title strong{font-size:14px!important}
      html.nx-qibla-fit-active .nx2-qb-title span{display:none!important}
      html.nx-qibla-fit-active .nx2-qb-grid{margin-top:3px!important;gap:3px!important}
      html.nx-qibla-fit-active .nx2-qb-side{gap:3px!important}
      html.nx-qibla-fit-active .nx2-qb-card small,html.nx-qibla-fit-active .nx2-qb-art{display:none!important}
      html.nx-qibla-fit-active .nx2-qb-card{padding:4px 5px!important}
      html.nx-qibla-fit-active .nx2-qb-compass{width:min(112%,31dvh)!important;max-width:112%!important}
      html.nx-qibla-fit-active .nx2-qb-ready{height:22px!important;min-height:22px!important;margin-top:3px!important;padding:3px 6px!important}
      html.nx-qibla-fit-active .nx2-qb-ready p{font-size:6px!important;line-height:14px!important}
    }
  `;
  document.head.appendChild(style);
}

export function renderQiblaFitScreen() {
  ensureQiblaFitStyles();
  const root = qiblaSafeV2Renderers.qibla?.();
  if (!(root instanceof HTMLElement)) return root;

  document.documentElement.classList.add('nx-qibla-fit-active');
  document.body.classList.add('nx-qibla-fit-active');
  const baseCleanup = root.__cleanup;
  let cleaned = false;

  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.documentElement.classList.remove('nx-qibla-fit-active');
    document.body.classList.remove('nx-qibla-fit-active');
    baseCleanup?.();
  };

  return root;
}

export const qiblaFitRenderers = Object.freeze({ qibla: renderQiblaFitScreen });
