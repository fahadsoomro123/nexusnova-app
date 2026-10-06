import { listDesignProjects,deleteDesignProject } from './ai-photo-project-store.js';

const STYLE_POS=['0%','14.2857%','28.5714%','42.8571%','57.1429%','71.4286%','85.7143%','100%'];
const FOUR_POS=['0%','33.3333%','66.6667%','100%'];

function ensureReferenceStyles(){
  if(document.getElementById('nx-ai-photo-locked-reference-assets-v1'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-locked-reference-assets-v1';
  style.textContent=`
    .nxps-locked-visual .nxlock-generator{position:relative!important}
    .nxps-locked-visual .nxlock-style-art{background-image:url('./assets/visuals/ai-photo-locked-styles.webp')!important;background-repeat:no-repeat!important;background-size:800% 100%!important;background-color:#111827!important;border-color:transparent!important;font-size:0!important;color:transparent!important}
    .nxps-locked-visual .nxlock-reference-feature{display:block;width:100%;height:auto;aspect-ratio:206/194;min-height:0;border:0;background-image:url('./assets/visuals/ai-photo-locked-featured.webp');background-repeat:no-repeat;background-size:400% 100%;background-color:#101521}
    .nxps-locked-visual .nxlock-feature.has-locked-reference>canvas{display:none!important}
    .nxps-locked-visual .nxlock-recent-item.is-example .nxlock-recent-thumb{height:auto!important;aspect-ratio:206/134;background-image:url('./assets/visuals/ai-photo-locked-recent.webp')!important;background-repeat:no-repeat!important;background-size:400% 100%!important;background-color:#101521!important}
    .nxps-locked-visual .nxlock-prompt textarea::placeholder{color:#aeb5c9!important;opacity:1!important}
    .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-gen-home,.nxps-locked-visual .nxlock-pro{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important}
    .nxps-locked-visual .nxlock-home-glyph{font-size:16px!important;line-height:1!important}
    .nxps-locked-visual .nxlock-pro-glyph{font-size:14px!important;line-height:1!important}

    /* Phone acceptance fix: never inherit dark/disabled text from the host editor. */
    .nxps-locked-visual .nxlock-home,.nxps-locked-visual .nxlock-generator{opacity:1!important;filter:none!important;color:#f8f5ff!important;-webkit-text-fill-color:initial!important}
    .nxps-locked-visual .nxlock-home button,.nxps-locked-visual .nxlock-generator button,.nxps-locked-visual .nxlock-home select,.nxps-locked-visual .nxlock-generator select{opacity:1!important;filter:none!important}
    .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-gen-home,.nxps-locked-visual .nxlock-gen-back{position:relative!important;z-index:5!important;border-color:#8e55ff!important;background:linear-gradient(145deg,#4b2675,#25183d)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;box-shadow:0 0 18px rgba(137,71,255,.2)!important}
    .nxps-locked-visual .nxlock-pro{position:relative!important;z-index:5!important;border-color:#8f49ff!important;background:linear-gradient(145deg,#24163c,#171324)!important;color:#ffd35f!important;-webkit-text-fill-color:#ffd35f!important;box-shadow:0 0 18px rgba(137,71,255,.18)!important}
    .nxps-locked-visual .nxlock-top-title strong,.nxps-locked-visual .nxlock-heading strong,.nxps-locked-visual .nxlock-section-head strong,.nxps-locked-visual .nxlock-card strong,.nxps-locked-visual .nxlock-mini,.nxps-locked-visual .nxlock-feature span,.nxps-locked-visual .nxlock-tool,.nxps-locked-visual .nxlock-recent-copy strong,.nxps-locked-visual .nxlock-recent-item strong,.nxps-locked-visual .nxlock-open-projects,.nxps-locked-visual .nxlock-gen-title strong,.nxps-locked-visual .nxlock-prompt>span,.nxps-locked-visual .nxlock-ratio,.nxps-locked-visual .nxlock-ratio b,.nxps-locked-visual .nxlock-style>span,.nxps-locked-visual .nxlock-styles-head strong,.nxps-locked-visual .nxlock-option{color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important}
    .nxps-locked-visual .nxlock-card p,.nxps-locked-visual .nxlock-heading span,.nxps-locked-visual .nxlock-top-title span,.nxps-locked-visual .nxlock-recent-copy span,.nxps-locked-visual .nxlock-recent-item span,.nxps-locked-visual .nxlock-gen-title span,.nxps-locked-visual .nxlock-ratio small{color:#c7c9d8!important;-webkit-text-fill-color:#c7c9d8!important;opacity:1!important}
    .nxps-locked-visual .nxlock-section-head button,.nxps-locked-visual .nxlock-styles-head span{color:#bd68ff!important;-webkit-text-fill-color:#bd68ff!important;opacity:1!important}
    .nxps-locked-visual .nxlock-icon,.nxps-locked-visual .nxlock-mini b,.nxps-locked-visual .nxlock-tool b{opacity:1!important;-webkit-text-fill-color:currentColor!important}
    .nxps-locked-visual .nxlock-open-projects{border-color:#8647e6!important;background:linear-gradient(145deg,#48246e,#2a1745)!important}

    /* Real, tappable Recent Creation cards and option controls. */
    .nxps-locked-visual .nxlock-recent-item{position:relative!important;cursor:pointer!important;outline:none!important;border-radius:11px!important}
    .nxps-locked-visual .nxlock-recent-item.is-example{cursor:default!important;opacity:.72!important}.nxps-locked-visual .nxlock-recent-item.is-example span{color:#c1a9df!important;-webkit-text-fill-color:#c1a9df!important}
    .nxps-locked-visual .nxlock-recent-item:focus-visible{box-shadow:0 0 0 2px #a259ff!important}
    .nxps-locked-visual .nxfix-recent-menu{position:absolute!important;z-index:6!important;right:5px!important;top:5px!important;width:27px!important;height:27px!important;min-width:27px!important;padding:0!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:50%!important;background:rgba(8,10,18,.78)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:18px!important;line-height:1!important}
    .nxps-locked-visual .nxfix-recent-popover{position:absolute;z-index:120;display:grid;gap:5px;width:122px;padding:7px;border:1px solid rgba(172,112,255,.4);border-radius:12px;background:#151321;box-shadow:0 14px 34px rgba(0,0,0,.55)}
    .nxps-locked-visual .nxfix-recent-popover[hidden]{display:none!important}
    .nxps-locked-visual .nxfix-recent-popover button{height:34px!important;border:0!important;border-radius:8px!important;background:#231a33!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:10px!important;font-weight:800!important}
    .nxps-locked-visual .nxfix-recent-popover button[data-delete]{color:#ff8d9a!important;-webkit-text-fill-color:#ff8d9a!important}

    /* Template library: keep editable canvas preview, add a real visual thumbnail + readable description. */
    .nxps-locked-visual .nxv3-grid{gap:9px!important}
    .nxps-locked-visual .nxv3-card{border-color:rgba(126,99,190,.34)!important;background:#141722!important;box-shadow:inset 0 1px rgba(255,255,255,.04)!important}
    .nxps-locked-visual .nxv3-card>canvas{height:118px!important;aspect-ratio:auto!important;object-fit:contain!important;background:#0b0f18!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy{display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;grid-template-rows:auto auto auto!important;column-gap:8px!important;align-items:start!important;padding:8px!important}
    .nxps-locked-visual .nxfix-template-mini{grid-row:1/4;width:54px;height:54px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background-repeat:no-repeat;background-size:400% 100%;background-color:#101521;box-shadow:0 5px 16px rgba(0,0,0,.28)}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy strong{grid-column:2;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:10px!important;line-height:1.2!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy p{grid-column:2;color:#b8bdcb!important;-webkit-text-fill-color:#b8bdcb!important;font-size:8px!important;line-height:1.35!important;-webkit-line-clamp:2!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy small{grid-column:2;color:#c9aaff!important;-webkit-text-fill-color:#c9aaff!important;font-size:7.5px!important}
    .nxps-locked-visual .nxv3-detail-copy h3{color:#fff!important;-webkit-text-fill-color:#fff!important}.nxps-locked-visual .nxv3-detail-copy p{color:#c0c4d2!important;-webkit-text-fill-color:#c0c4d2!important}

    @media (max-width:520px){
      .nxps-locked-visual .nxlock-top{grid-template-columns:70px minmax(0,1fr) 64px!important;gap:7px!important}
      .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{padding-left:6px!important;padding-right:6px!important}
      .nxps-locked-visual .nxlock-top-title strong{font-size:14px!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
      .nxps-locked-visual .nxlock-top-title span{font-size:9px!important}
      .nxps-locked-visual .nxv3-card>canvas{height:108px!important}
      .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy{grid-template-columns:48px minmax(0,1fr)!important;column-gap:7px!important;padding:7px!important}
      .nxps-locked-visual .nxfix-template-mini{width:48px;height:48px}
    }

    @media (max-width:390px){
      .nxps-locked-visual .nxlock-top{grid-template-columns:66px minmax(0,1fr) 60px!important;gap:6px!important}
      .nxps-locked-visual .nxlock-top-title strong{font-size:13px!important}
      .nxps-locked-visual .nxlock-option select{padding-left:6px!important;padding-right:6px!important;font-size:9px!important}
    }

    @media (max-width:520px) and (min-height:761px){
      .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{height:42px!important}
      .nxps-locked-visual .nxlock-hero{position:relative!important;grid-template-columns:68px minmax(0,1fr)!important;min-height:138px!important;padding:12px 14px!important;gap:12px!important;overflow:hidden!important}
      .nxps-locked-visual .nxlock-hero-logo,.nxps-locked-visual .nxlock-hero-copy{position:relative!important;z-index:2!important}
      .nxps-locked-visual .nxlock-hero-logo{width:64px!important;height:64px!important}
      .nxps-locked-visual .nxlock-hero-logo img{width:56px!important;height:56px!important}
      .nxps-locked-visual .nxlock-hero-glow{position:absolute!important;z-index:1!important;right:-8px!important;top:0!important;bottom:0!important;width:47%!important;height:auto!important;pointer-events:none!important}
      .nxps-locked-visual .nxlock-kicker{font-size:8px!important}
      .nxps-locked-visual .nxlock-hero-copy h1{margin-top:4px!important;font-size:20px!important;line-height:1.02!important}
      .nxps-locked-visual .nxlock-hero-copy p{display:block!important;max-width:232px!important;margin-top:6px!important;font-size:9px!important;line-height:1.35!important}
      .nxps-locked-visual .nxlock-badges{flex-wrap:nowrap!important;gap:5px!important;margin-top:7px!important}
      .nxps-locked-visual .nxlock-badges span{padding:4px 6px!important;font-size:6.4px!important;white-space:nowrap!important}
    }

    /* Exact approved Home reconstruction: source pixels, proportions and hierarchy. */
    .nxps-locked-visual .nxlock-home{
      grid-template-rows:auto auto auto auto auto auto auto auto!important;
      align-content:space-between!important;
      gap:clamp(5px,1.05dvh,10px)!important;
      padding:clamp(6px,1.2dvh,11px) clamp(10px,3.4vw,15px)!important;
      background:radial-gradient(circle at 10% 4%,rgba(73,38,143,.20),transparent 24%),linear-gradient(180deg,#070c16 0%,#070d17 66%,#07101a 100%)!important;
    }
    .nxps-locked-visual .nxlock-top{grid-template-columns:17.7% minmax(0,1fr) 17.1%!important;gap:clamp(6px,2vw,10px)!important;min-height:0!important}
    .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{
      width:100%!important;height:auto!important;aspect-ratio:166/64!important;min-height:0!important;padding:0!important;border:0!important;border-radius:0!important;background-color:transparent!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;box-shadow:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;font-size:0!important;
    }
    .nxps-locked-visual .nxlock-home-btn{background-image:url('./assets/visuals/ai-photo-approved-home-button.webp')!important}
    .nxps-locked-visual .nxlock-pro{aspect-ratio:160/64!important;background-image:url('./assets/visuals/ai-photo-approved-pro-button.webp')!important}
    .nxps-locked-visual .nxlock-top-title strong{overflow:visible!important;color:#f4efff!important;font-size:clamp(12px,3.65vw,16px)!important;font-weight:850!important;line-height:1.04!important;text-overflow:clip!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-top-title strong>span{display:inline!important;margin:0!important;color:#c9a5ff!important;-webkit-text-fill-color:#c9a5ff!important;font:inherit!important;line-height:inherit!important}
    .nxps-locked-visual .nxlock-top-title strong>em{color:#cb6aff!important;-webkit-text-fill-color:#cb6aff!important;font-style:normal!important}
    .nxps-locked-visual .nxlock-top-title>span{margin-top:3px!important;color:#c6b9e9!important;-webkit-text-fill-color:#c6b9e9!important;font-size:clamp(7px,2.15vw,9px)!important;white-space:nowrap!important}

    .nxps-locked-visual .nxlock-hero{position:relative!important;grid-template-columns:clamp(50px,15.2vw,66px) minmax(0,1fr)!important;min-height:0!important;height:clamp(79px,20vw,91px)!important;padding:clamp(7px,1.2dvh,11px) clamp(9px,2.7vw,13px)!important;gap:clamp(8px,2.4vw,12px)!important;overflow:hidden!important;border-color:rgba(96,111,194,.58)!important;border-radius:clamp(12px,3.5vw,17px)!important;background:linear-gradient(110deg,#10182c 0%,#10162a 62%,#0c1530 100%)!important;box-shadow:inset 0 1px rgba(255,255,255,.035)!important}
    .nxps-locked-visual .nxlock-hero::after{content:"";position:absolute;z-index:0;inset:0 0 0 auto;width:31%;background:url('./assets/visuals/ai-photo-approved-home-nebula.webp') center/cover no-repeat;pointer-events:none}
    .nxps-locked-visual .nxlock-hero-logo{position:relative!important;z-index:2!important;width:100%!important;height:auto!important;aspect-ratio:132/126!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
    .nxps-locked-visual .nxlock-hero-logo img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}
    .nxps-locked-visual .nxlock-hero-copy{position:relative!important;z-index:2!important;align-self:center!important}
    .nxps-locked-visual .nxlock-kicker{color:#c074ff!important;-webkit-text-fill-color:#c074ff!important;font-size:clamp(6.5px,1.9vw,8.5px)!important;line-height:1!important;letter-spacing:.17em!important}
    .nxps-locked-visual .nxlock-hero-copy h1{margin:clamp(3px,.55dvh,5px) 0 0!important;font-size:clamp(16px,4.65vw,21px)!important;line-height:1!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-hero-copy p{display:block!important;margin:clamp(3px,.55dvh,5px) 0 0!important;max-width:69%!important;color:#c5c8df!important;-webkit-text-fill-color:#c5c8df!important;font-size:clamp(7px,2.05vw,9px)!important;line-height:1.2!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-badges{flex-wrap:nowrap!important;gap:clamp(4px,1.4vw,7px)!important;margin-top:clamp(4px,.75dvh,7px)!important}
    .nxps-locked-visual .nxlock-badges span{padding:clamp(3px,.45dvh,4px) clamp(5px,1.6vw,8px)!important;border-color:rgba(100,130,220,.58)!important;background:rgba(8,16,35,.54)!important;font-size:clamp(5.3px,1.55vw,7px)!important;line-height:1!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-hero-glow{display:none!important}

    .nxps-locked-visual .nxlock-heading strong{font-size:clamp(13px,4.2vw,18px)!important;line-height:1.05!important}
    .nxps-locked-visual .nxlock-heading span{font-size:clamp(7px,2.35vw,10px)!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-primary{gap:clamp(6px,2vw,10px)!important}
    .nxps-locked-visual .nxlock-primary .nxlock-card{height:clamp(82px,13.6dvh,120px)!important;min-height:0!important;padding:clamp(8px,1.5dvh,13px) clamp(8px,2.6vw,12px)!important;border-radius:clamp(12px,3.8vw,17px)!important;box-shadow:inset 0 1px rgba(255,255,255,.045),0 7px 18px rgba(0,0,0,.12)!important;transition:transform .11s ease,filter .11s ease!important}
    .nxps-locked-visual .nxlock-card:active,.nxps-locked-visual .nxlock-mini:active,.nxps-locked-visual .nxlock-tool:active,.nxps-locked-visual .nxlock-feature:active{transform:scale(.975)!important;filter:brightness(1.1)!important}
    .nxps-locked-visual .nxlock-icon{width:clamp(29px,8.2vw,36px)!important;height:auto!important;aspect-ratio:1!important;border:0!important;border-radius:0!important;background-color:transparent!important;background-image:url('./assets/visuals/ai-photo-approved-primary-icons.webp')!important;background-repeat:no-repeat!important;background-size:300% 100%!important;box-shadow:none!important;font-size:0!important}
    .nxps-locked-visual .nxlock-card:nth-child(1) .nxlock-icon{background-position:0 50%!important}.nxps-locked-visual .nxlock-card:nth-child(2) .nxlock-icon{background-position:50% 50%!important}.nxps-locked-visual .nxlock-card:nth-child(3) .nxlock-icon{background-position:100% 50%!important}
    .nxps-locked-visual .nxlock-card strong{margin-top:clamp(5px,.8dvh,8px)!important;font-size:clamp(9px,2.8vw,12px)!important;line-height:1.05!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-card p{display:block!important;margin:clamp(3px,.55dvh,5px) 0 0!important;font-size:clamp(7px,2.05vw,9px)!important;line-height:1.25!important}
    .nxps-locked-visual .nxlock-arrow{right:clamp(7px,2.1vw,10px)!important;bottom:50%!important;width:8px!important;height:8px!important;transform:translateY(50%) rotate(-45deg)!important;border-right:2px solid #eadcff!important;border-bottom:2px solid #eadcff!important;font-size:0!important}

    .nxps-locked-visual .nxlock-secondary{gap:clamp(6px,2vw,9px)!important}
    .nxps-locked-visual .nxlock-mini{display:grid!important;height:clamp(42px,6.1dvh,52px)!important;min-height:0!important;place-content:center!important;padding:4px!important;border-radius:clamp(10px,3vw,14px)!important;font-size:clamp(7.5px,2.35vw,10px)!important;line-height:1!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 5px 15px rgba(0,0,0,.12)!important}
    .nxps-locked-visual .nxlock-mini b{display:block!important;width:clamp(23px,6.3vw,28px)!important;height:auto!important;aspect-ratio:58/48!important;margin:0 auto clamp(3px,.45dvh,4px)!important;background-image:url('./assets/visuals/ai-photo-approved-secondary-icons.webp')!important;background-repeat:no-repeat!important;background-size:400% 100%!important;font-size:0!important}
    .nxps-locked-visual .nxlock-mini:nth-child(1) b{background-position:0 50%!important}.nxps-locked-visual .nxlock-mini:nth-child(2) b{background-position:33.3333% 50%!important}.nxps-locked-visual .nxlock-mini:nth-child(3) b{background-position:66.6667% 50%!important}.nxps-locked-visual .nxlock-mini:nth-child(4) b{background-position:100% 50%!important}

    .nxps-locked-visual .nxlock-section-head strong{font-size:clamp(12px,3.65vw,16px)!important;line-height:1!important}
    .nxps-locked-visual .nxlock-section-head button{display:flex!important;align-items:center!important;gap:5px!important;padding:0!important;font-size:clamp(7.5px,2.35vw,10px)!important}
    .nxps-locked-visual .nxlock-section-head i,.nxps-locked-visual .nxlock-open-projects i{display:inline-block;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg)}
    .nxps-locked-visual .nxlock-featured-wrap,.nxps-locked-visual .nxlock-quick-wrap{gap:clamp(5px,.8dvh,7px)!important}
    .nxps-locked-visual .nxlock-featured{grid-auto-columns:22.4%!important;gap:2.4%!important}
    .nxps-locked-visual .nxlock-feature{overflow:hidden!important;border:1px solid rgba(71,111,173,.52)!important;border-radius:clamp(8px,2.7vw,12px)!important;background:#0d1626!important;box-shadow:0 6px 18px rgba(0,0,0,.16)!important}
    .nxps-locked-visual .nxlock-reference-feature{border-radius:0!important}
    .nxps-locked-visual .nxlock-feature span{padding:clamp(4px,.65dvh,6px) 4px!important;background:#0d1626!important;font-size:clamp(7px,2.15vw,9.5px)!important;line-height:1!important;text-align:center!important;text-overflow:ellipsis!important}

    .nxps-locked-visual .nxlock-quick{gap:clamp(5px,1.7vw,8px)!important}
    .nxps-locked-visual .nxlock-tool{display:grid!important;height:clamp(48px,6.8dvh,59px)!important;place-content:center!important;padding:4px 2px!important;border-radius:clamp(9px,2.8vw,13px)!important;font-size:clamp(6.4px,1.9vw,8.5px)!important;line-height:1!important;white-space:nowrap!important;box-shadow:inset 0 1px rgba(255,255,255,.045),0 6px 16px rgba(0,0,0,.13)!important}
    .nxps-locked-visual .nxlock-tool b{display:block!important;width:clamp(24px,6.8vw,30px)!important;height:auto!important;aspect-ratio:60/58!important;margin:0 auto clamp(4px,.55dvh,5px)!important;background-image:url('./assets/visuals/ai-photo-approved-quick-icons.webp')!important;background-repeat:no-repeat!important;background-size:600% 100%!important;font-size:0!important}
    .nxps-locked-visual .nxlock-tool:nth-child(1) b{background-position:0 50%!important}.nxps-locked-visual .nxlock-tool:nth-child(2) b{background-position:20% 50%!important}.nxps-locked-visual .nxlock-tool:nth-child(3) b{background-position:40% 50%!important}.nxps-locked-visual .nxlock-tool:nth-child(4) b{background-position:60% 50%!important}.nxps-locked-visual .nxlock-tool:nth-child(5) b{background-position:80% 50%!important}.nxps-locked-visual .nxlock-tool:nth-child(6) b{background-position:100% 50%!important}

    .nxps-locked-visual .nxlock-recent{grid-template-columns:minmax(0,1fr) auto!important;gap:clamp(5px,.85dvh,8px)!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
    .nxps-locked-visual .nxlock-recent-copy strong{font-size:clamp(12px,3.7vw,16px)!important;line-height:1!important}.nxps-locked-visual .nxlock-recent-copy span{margin-top:3px!important;font-size:clamp(7px,2.15vw,9px)!important}
    .nxps-locked-visual .nxlock-open-projects{height:clamp(29px,4.4dvh,38px)!important;padding:0 clamp(8px,2.8vw,13px)!important;border-radius:clamp(9px,2.8vw,13px)!important;font-size:clamp(7.5px,2.25vw,10px)!important}
    .nxps-locked-visual .nxlock-recent-items{gap:clamp(6px,2vw,9px)!important}
    .nxps-locked-visual .nxlock-recent-thumb{display:block!important;width:100%!important;height:auto!important;aspect-ratio:206/134!important;border:1px solid rgba(66,105,161,.48)!important;border-radius:clamp(7px,2.35vw,10px)!important;background:#101521;object-fit:cover!important}
    .nxps-locked-visual .nxlock-recent-item.is-example .nxlock-recent-thumb{position:relative!important;filter:saturate(.86) brightness(.82)!important}
    .nxps-locked-visual .nxlock-recent-item.is-example .nxlock-recent-thumb small{position:absolute;right:4px;top:4px;padding:2px 4px;border-radius:999px;background:rgba(8,10,18,.82);color:#fff;font-size:5px;font-weight:900;letter-spacing:.08em}
    .nxps-locked-visual .nxlock-recent-item strong{margin-top:clamp(3px,.55dvh,5px)!important;font-size:clamp(7.5px,2.35vw,10px)!important;line-height:1!important;text-overflow:ellipsis!important}.nxps-locked-visual .nxlock-recent-item span{margin-top:2px!important;font-size:clamp(6.5px,1.95vw,8.5px)!important;line-height:1!important}

    /* Exact approved Generator header and ratio-card structure from the right-hand target. */
    .nxps-locked-visual .nxlock-gen-head{grid-template-columns:auto minmax(0,1fr) auto!important;gap:clamp(7px,2.2vw,11px)!important}
    .nxps-locked-visual .nxlock-gen-home,.nxps-locked-visual .nxlock-gen-back{width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;padding:0!important;border:0!important;border-radius:0!important;background-color:transparent!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;box-shadow:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;font-size:0!important}
    .nxps-locked-visual .nxlock-gen-home{width:clamp(76px,21.7vw,96px)!important;aspect-ratio:96/44!important;background-image:url('./assets/visuals/ai-photo-approved-generator-home.webp')!important}
    .nxps-locked-visual .nxlock-gen-back{width:clamp(38px,10vw,44px)!important;aspect-ratio:1!important;background-image:url('./assets/visuals/ai-photo-approved-generator-back.webp')!important}
    .nxps-locked-visual .nxlock-gen-title{min-width:0!important}
    .nxps-locked-visual .nxlock-gen-title strong{font-size:clamp(14px,4vw,17px)!important;line-height:1.05!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-gen-title span{font-size:clamp(7.5px,2.15vw,9px)!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-ratios{align-items:start!important}
    .nxps-locked-visual .nxlock-ratio{display:grid!important;grid-template-rows:auto auto!important;gap:clamp(4px,.65dvh,6px)!important;height:auto!important;min-width:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#f2f4fa!important;overflow:visible!important}
    .nxps-locked-visual .nxlock-ratio-tile{display:grid!important;grid-template-rows:auto auto!important;place-content:center!important;gap:3px!important;width:100%!important;height:clamp(48px,6.9dvh,58px)!important;border:1px solid rgba(128,143,179,.62)!important;border-radius:clamp(8px,2.6vw,11px)!important;background:linear-gradient(145deg,#18202e,#111722)!important;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease!important}
    .nxps-locked-visual .nxlock-ratio:active .nxlock-ratio-tile{transform:scale(.97)!important}
    .nxps-locked-visual .nxlock-ratio i{display:block!important;justify-self:center!important;border:1.5px solid #eef2ff!important;border-radius:1px!important;width:11px!important;height:11px!important}
    .nxps-locked-visual .nxlock-ratio[data-r="portrait"] i{width:9px!important;height:13px!important}
    .nxps-locked-visual .nxlock-ratio[data-r="story"] i{width:8px!important;height:15px!important}
    .nxps-locked-visual .nxlock-ratio[data-r="wide"] i{width:16px!important;height:9px!important}
    .nxps-locked-visual .nxlock-ratio[data-r="custom"] i{width:15px!important;height:10px!important;border-style:dashed!important}
    .nxps-locked-visual .nxlock-ratio b{display:block!important;font-size:clamp(9px,2.65vw,11px)!important;line-height:1!important}
    .nxps-locked-visual .nxlock-ratio small{display:block!important;margin:0!important;color:#eef0f7!important;-webkit-text-fill-color:#eef0f7!important;font-size:clamp(7px,2.2vw,9px)!important;line-height:1!important;white-space:nowrap!important}
    .nxps-locked-visual .nxlock-ratio.is-active .nxlock-ratio-tile{border-color:#d099ff!important;background:linear-gradient(145deg,#6b35a4,#382158)!important;box-shadow:0 0 0 2px rgba(174,99,255,.36),0 8px 22px rgba(122,49,222,.32)!important}
    .nxps-locked-visual .nxlock-ratio[aria-disabled="true"] .nxlock-ratio-tile{border-style:dashed!important}
    .nxps-locked-visual .nxlock-ratio:focus-visible{outline:2px solid #d2a4ff!important;outline-offset:3px!important}

    @media(max-height:700px){
      .nxps-locked-visual .nxlock-home{gap:4px!important;padding-top:5px!important;padding-bottom:5px!important}
      .nxps-locked-visual .nxlock-hero{height:79px!important}
      .nxps-locked-visual .nxlock-primary .nxlock-card{height:82px!important}
      .nxps-locked-visual .nxlock-card p{display:block!important}
      .nxps-locked-visual .nxlock-mini{height:42px!important}
      .nxps-locked-visual .nxlock-tool{height:48px!important}
    }
  `;
  document.head.appendChild(style);
}

function applyStyleSprites(root){
  root.querySelectorAll('.nxlock-style-art').forEach((node,index)=>{
    if(index>=STYLE_POS.length)return;
    node.style.backgroundPosition=`${STYLE_POS[index]} 50%`;
    node.dataset.lockedReference='style';
  });
}

function applyFeaturedSprites(root){
  root.querySelectorAll('.nxlock-feature').forEach((card,index)=>{
    if(index>=FOUR_POS.length)return;
    let thumb=card.querySelector('.nxlock-reference-feature');
    if(!thumb){thumb=document.createElement('div');thumb.className='nxlock-reference-feature';card.prepend(thumb)}
    thumb.style.backgroundPosition=`${FOUR_POS[index]} 50%`;
    thumb.dataset.lockedReference='featured';
    card.classList.add('has-locked-reference');
  });
}

function applyRecentSprites(root){
  root.querySelectorAll('.nxlock-recent-item.is-example .nxlock-recent-thumb').forEach(node=>{
    const item=node.closest('.nxlock-recent-item'),index=[...item?.parentElement?.children||[]].indexOf(item);
    if(index<0||index>=FOUR_POS.length)return;
    node.style.backgroundPosition=`${FOUR_POS[index]} 50%`;
    node.dataset.lockedReference='recent';
  });
}

function applyPromptContract(root){
  const prompt=root.querySelector('[data-puter-prompt]');
  if(!prompt)return;
  const placeholder='Example: A premium cinematic portrait in soft window light, realistic skin texture, clean background';
  if(prompt.getAttribute('placeholder')!==placeholder)prompt.setAttribute('placeholder',placeholder);
}

function applyHeaderContract(root){
  const home=root.querySelector('.nxlock-home-btn');
  home?.setAttribute('aria-label','Studio Home');
  const genHome=root.querySelector('.nxlock-gen-home');
  genHome?.setAttribute('aria-label','Studio Home');
  const pro=root.querySelector('.nxlock-pro');
  pro?.setAttribute('aria-label','NexusNova Pro');
}

function applyVisualCustomRatio(root){
  const ratioBox=root.querySelector('.nxlock-ratios');
  if(!ratioBox||ratioBox.querySelector('[data-r="custom"]'))return;
  const button=document.createElement('button');
  button.type='button';button.className='nxlock-ratio nxlock-reference-custom-ratio';button.dataset.r='custom';button.setAttribute('aria-label','Custom aspect ratio is not supported by the current Puter provider');button.setAttribute('aria-disabled','true');button.setAttribute('aria-pressed','false');button.title='Custom ratio is not supported by the current Puter provider.';button.innerHTML='<span class="nxlock-ratio-tile"><i aria-hidden="true"></i><b>Custom</b></span><small>Custom</small>';
  button.addEventListener('click',()=>{const error=root.querySelector('[data-puter-error]');if(!error)return;error.textContent='Custom ratio is not supported by the current Puter provider. Choose Square, Portrait, Story or Landscape.';error.classList.add('is-on')});
  ratioBox.appendChild(button);ratioBox.classList.add('has-custom');
}

function projectSelector(id){
  const escaped=globalThis.CSS?.escape?globalThis.CSS.escape(String(id)):String(id).replace(/["\\]/g,'\\$&');
  return `[data-project="${escaped}"]`;
}

function openSavedProject(root,id){
  if(!id)return;
  root.__nxStudioNavigation?.openWorkspace?.('projects');
  requestAnimationFrame(()=>root.__nxCanvaWorkspaceV3?.openProject?.(id));
}

function ensureRecentPopover(root){
  const home=root.querySelector('.nxlock-home');
  if(!home)return null;
  let pop=home.querySelector('.nxfix-recent-popover');
  if(pop)return pop;
  pop=document.createElement('div');pop.className='nxfix-recent-popover';pop.hidden=true;pop.innerHTML='<button type="button" data-open>Open project</button><button type="button" data-delete>Delete</button>';home.appendChild(pop);
  pop.querySelector('[data-open]').addEventListener('click',()=>{const id=pop.dataset.projectId;pop.hidden=true;openSavedProject(root,id)});
  pop.querySelector('[data-delete]').addEventListener('click',()=>{const id=pop.dataset.projectId;if(!id)return;try{if(!root.__nxCanvaWorkspaceV3?.deleteProject?.(id))deleteDesignProject(id)}catch{}pop.hidden=true;root.querySelector('.nxlock-home-btn')?.click()});
  return pop;
}

function showRecentMenu(root,item,id){
  const home=root.querySelector('.nxlock-home'),pop=ensureRecentPopover(root);if(!home||!pop||!id)return;
  pop.dataset.projectId=id;pop.hidden=false;
  const hr=home.getBoundingClientRect(),ir=item.getBoundingClientRect(),w=122;
  pop.style.left=`${Math.max(8,Math.min(hr.width-w-8,ir.right-hr.left-w))}px`;
  pop.style.top=`${Math.max(8,Math.min(hr.height-82,ir.top-hr.top+28))}px`;
}

function applyRecentInteractions(root){
  const rows=(()=>{try{return listDesignProjects().slice(0,4)}catch{return[]}})();
  root.querySelectorAll('.nxlock-recent-item').forEach((item,index)=>{
    const row=rows[index];if(!row?.id)return;
    item.dataset.nxProjectId=row.id;item.tabIndex=0;item.setAttribute('role','button');
    if(item.dataset.nxRecentBound!=='1'){
      item.dataset.nxRecentBound='1';
      item.addEventListener('click',e=>{if(e.target.closest('.nxfix-recent-menu'))return;openSavedProject(root,item.dataset.nxProjectId)});
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSavedProject(root,item.dataset.nxProjectId)}});
    }
    let menu=item.querySelector('.nxfix-recent-menu');
    if(!menu){menu=document.createElement('button');menu.type='button';menu.className='nxfix-recent-menu';menu.setAttribute('aria-label',`Options for ${row.name||'saved project'}`);menu.textContent='⋮';menu.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showRecentMenu(root,item,item.dataset.nxProjectId)});item.appendChild(menu)}
  });
}

export function installAiPhotoLockedReferenceAssetsV1(root){
  if(!root||root.__nxLockedReferenceAssetsV1)return()=>{};
  root.__nxLockedReferenceAssetsV1=true;ensureReferenceStyles();
  const apply=()=>{applyStyleSprites(root);applyFeaturedSprites(root);applyRecentSprites(root);applyPromptContract(root);applyHeaderContract(root);applyVisualCustomRatio(root);applyRecentInteractions(root)};
  apply();
  const observer=new MutationObserver(apply);observer.observe(root,{childList:true,subtree:true});
  const dismiss=e=>{const pop=root.querySelector('.nxfix-recent-popover');if(pop&&!pop.hidden&&!e.target.closest('.nxfix-recent-popover')&&!e.target.closest('.nxfix-recent-menu'))pop.hidden=true};
  root.addEventListener('click',dismiss,true);
  return()=>{observer.disconnect();root.removeEventListener('click',dismiss,true);root.querySelectorAll('[data-locked-reference]').forEach(node=>node.removeAttribute('data-locked-reference'));root.querySelectorAll('.has-locked-reference').forEach(node=>node.classList.remove('has-locked-reference'));root.querySelectorAll('.nxlock-reference-custom-ratio,.nxfix-recent-menu,.nxfix-recent-popover').forEach(node=>node.remove());delete root.__nxLockedReferenceAssetsV1};
}
