import { renderTravelSuite as renderTravelSuiteV13 } from './travel-suite-v13.js';

const ICONS = Object.freeze({
  plane: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M2.5 13.2 9.4 16l1.2 5.3 2-1.1.7-4.1 4-2.3 3.6 1.7 1.6-1.5-4.1-3.7.6-4.6-1.8-1-2.6 3.8-7.1-2.8L8.2 7.7l4.8 3.1-4.6 2.1-3.5-1.8-2.4 2.1Z%27/%3E%3C/svg%3E")',
  calendar: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M7 2h2v2h6V2h2v2h2.2A2.8 2.8 0 0 1 22 6.8v12.4A2.8 2.8 0 0 1 19.2 22H4.8A2.8 2.8 0 0 1 2 19.2V6.8A2.8 2.8 0 0 1 4.8 4H7V2Zm-2.2 7v10.2c0 .44.36.8.8.8h12.8a.8.8 0 0 0 .8-.8V9H4.8Zm2.1 2h2.4v2.4H6.9V11Zm3.9 0h2.4v2.4h-2.4V11Zm3.9 0h2.4v2.4h-2.4V11Zm-7.8 4h2.4v2.4H6.9V15Zm3.9 0h2.4v2.4h-2.4V15Z%27/%3E%3C/svg%3E")',
  person: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M12 2.5a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 10c5.3 0 8 2.7 8 6.1V21H4v-2.4c0-3.4 2.7-6.1 8-6.1Z%27/%3E%3C/svg%3E")',
  seat: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M6 2.8A2.8 2.8 0 0 1 8.8 5.6v6.1h8.7a3.5 3.5 0 0 1 3.5 3.5v4H8.3A5.3 5.3 0 0 1 3 13.9V5.6A2.8 2.8 0 0 1 5.8 2.8H6Zm-1 10.8v.3a3.3 3.3 0 0 0 3.3 3.3H19v-2a1.5 1.5 0 0 0-1.5-1.5H5ZM8 21h2v1H8v-1Zm9 0h2v1h-2v-1Z%27/%3E%3C/svg%3E")',
  coins: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M9 3c4 0 7 1.4 7 3.3S13 9.6 9 9.6 2 8.2 2 6.3 5 3 9 3Zm-7 6c1.5 1.1 4 1.8 7 1.8s5.5-.7 7-1.8v2.1c0 1.9-3 3.3-7 3.3s-7-1.4-7-3.3V9Zm0 4.8c1.5 1.1 4 1.8 7 1.8 1.5 0 2.9-.2 4.1-.6a6.2 6.2 0 0 0-.1 1.1c0 .7.1 1.4.3 2-1.2.3-2.7.5-4.3.5-4 0-7-1.4-7-3.3v-1.5Zm15.3-1.3A4.7 4.7 0 1 1 17.3 22a4.7 4.7 0 0 1 0-9.5Zm-.8 2v1.1h-1v1.5h1v3h1.6v-3h1v-1.5h-1v-1.1h-1.6Z%27/%3E%3C/svg%3E")',
  search: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath fill=%27black%27 d=%27M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm5.8 10.9L22 21.6 20.6 23 14.9 17.3l1.4-1.4Z%27/%3E%3C/svg%3E")'
});

function ensureV14Styles(){
  if(document.getElementById('nn-travel-reference-v14')) return;
  const style=document.createElement('style');
  style.id='nn-travel-reference-v14';
  style.textContent=`
    .nn-travel-v12.nn-travel-v13.nn-travel-v14{
      background:radial-gradient(circle at 50% -12%,#0a3761 0,#061c33 25%,#03111f 61%,#020a12 100%)!important
    }
    .nn-travel-v14 .nn-ref-canvas{padding:0 8px!important;gap:2px!important}
    .nn-travel-v14 .nn-dock{
      height:96px!important;padding:7px 8px 7px 80px!important;gap:10px!important;
      border:1px solid #19597d!important;border-radius:27px!important;
      background:linear-gradient(180deg,rgba(7,50,82,.99),rgba(3,27,48,.995))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 8px 24px rgba(0,0,0,.30),0 0 20px rgba(0,145,255,.10)!important
    }
    .nn-travel-v14 .nn-tab{
      height:77px!important;min-height:77px!important;border-radius:18px!important;
      border-color:#205b7e!important;background:linear-gradient(180deg,#123a58,#09263f)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 7px 15px rgba(0,0,0,.22)!important;
      color:#e8f6ff!important;font-size:14px!important;font-weight:800!important;gap:5px!important
    }
    .nn-travel-v14 .nn-tab.is-active{
      border-color:#5be6ff!important;
      background:linear-gradient(145deg,#25cef7 0%,#1497ed 48%,#0867d8 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 0 0 1px rgba(46,211,255,.38),0 0 24px rgba(11,183,255,.72),0 9px 18px rgba(0,0,0,.28)!important
    }
    .nn-travel-v14 .nn-tab .nn-ref-tab-icon,
    .nn-travel-v14 .nn-tab .nn-ref-tab-icon svg{width:30px!important;height:30px!important}
    .nn-travel-v14 .nn-api-dot{width:10px!important;height:10px!important;right:9px!important;bottom:12px!important}
    .nn-travel-v14 .nn-travel-back{
      left:10px!important;top:15px!important;width:55px!important;height:56px!important;
      min-width:55px!important;min-height:56px!important;border-radius:16px!important;
      border-color:#286589!important;background:linear-gradient(180deg,#103552,#08253c)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 7px 16px rgba(0,0,0,.24)!important;
      font-size:33px!important
    }

    .nn-travel-v14 .nn-panel[data-panel="flights"]{width:521px!important;justify-self:start!important;grid-template-rows:140px 398px minmax(0,1fr)!important}
    .nn-travel-v14 .nn-ref-hero{
      height:135px!important;min-height:135px!important;padding:21px 21px 17px!important;
      border:1px solid #2b7094!important;border-radius:25px!important;
      background:radial-gradient(circle at 67% 19%,rgba(26,108,171,.20),transparent 38%),linear-gradient(105deg,#062640 0%,#03192b 66%,#031725 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 20px rgba(0,0,0,.24)!important
    }
    .nn-travel-v14 .nn-locked-hero-right{right:0!important;top:0!important;width:154px!important;height:135px!important;z-index:2!important;object-fit:fill!important}
    .nn-travel-v14 .nn-ref-kicker{z-index:5!important;font-size:13px!important;letter-spacing:.11em!important;line-height:1!important;color:#2bd4ff!important;transform:translateY(1px)!important}
    .nn-travel-v14 .nn-ref-kicker:before{font-size:18px!important;color:#26d2ff!important}
    .nn-travel-v14 .nn-ref-title{
      position:relative!important;z-index:5!important;margin:19px 0 5px!important;
      max-width:390px!important;width:390px!important;white-space:nowrap!important;overflow:visible!important;
      font-size:24px!important;line-height:1!important;font-weight:900!important;letter-spacing:-.055em!important;
      transform:scaleX(.94)!important;transform-origin:left center!important;color:#f5fbff!important;
      text-shadow:0 1px 0 rgba(255,255,255,.03)!important
    }
    .nn-travel-v14 .nn-ref-sub{position:relative!important;z-index:5!important;max-width:360px!important;font-size:13px!important;line-height:1.35!important;color:#9ecbe4!important}

    .nn-travel-v14 .nn-panel[data-panel="flights"]>.nn-card{
      height:388px!important;min-height:388px!important;padding:11px 20px 9px!important;border-radius:23px!important;
      border:1px solid #28688a!important;
      background:radial-gradient(circle at 48% -6%,rgba(67,153,191,.13),transparent 39%),linear-gradient(145deg,#0a3047 0%,#061f33 44%,#031827 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 20px rgba(0,0,0,.24)!important
    }
    .nn-travel-v14 .nn-ref-flight-form{grid-template-rows:82px 74px 74px 63px 22px!important;row-gap:13px!important;column-gap:8px!important}
    .nn-travel-v14 .nn-ref-field{gap:7px!important}
    .nn-travel-v14 .nn-ref-field>span{font-size:12px!important;line-height:1!important;color:#d9edf8!important;font-weight:800!important}
    .nn-travel-v14 .nn-ref-field input,
    .nn-travel-v14 .nn-ref-field select{
      height:50px!important;min-height:50px!important;border:1px solid #286b91!important;border-radius:12px!important;
      background:linear-gradient(180deg,#071b2c,#03121f)!important;color:#f4fbff!important;
      padding:0 13px 0 46px!important;font-size:16px!important;font-weight:500!important;
      box-shadow:inset 0 2px 8px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.025)!important
    }
    .nn-travel-v14 .nn-ref-field:after{
      content:""!important;left:15px!important;bottom:14px!important;width:21px!important;height:21px!important;
      background:#c8efff!important;filter:drop-shadow(0 0 5px rgba(74,204,255,.22))!important;
      -webkit-mask-repeat:no-repeat!important;mask-repeat:no-repeat!important;
      -webkit-mask-position:center!important;mask-position:center!important;
      -webkit-mask-size:contain!important;mask-size:contain!important
    }
    .nn-travel-v14 .nn-from:after,.nn-travel-v14 .nn-to:after{-webkit-mask-image:${ICONS.plane}!important;mask-image:${ICONS.plane}!important}
    .nn-travel-v14 .nn-depart:after,.nn-travel-v14 .nn-return:after{-webkit-mask-image:${ICONS.calendar}!important;mask-image:${ICONS.calendar}!important}
    .nn-travel-v14 .nn-adults:after{-webkit-mask-image:${ICONS.person}!important;mask-image:${ICONS.person}!important}
    .nn-travel-v14 .nn-cabin:after{-webkit-mask-image:${ICONS.seat}!important;mask-image:${ICONS.seat}!important}
    .nn-travel-v14 .nn-currency:after{-webkit-mask-image:${ICONS.coins}!important;mask-image:${ICONS.coins}!important}
    .nn-travel-v14 .nn-swap{
      width:39px!important;height:47px!important;min-width:39px!important;min-height:47px!important;margin-bottom:1px!important;
      border:1px solid #2381ad!important;border-radius:11px!important;background:linear-gradient(180deg,#0b5a82,#073b5c)!important;
      color:#2fdcff!important;font-size:23px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 6px 12px rgba(0,0,0,.24)!important
    }
    .nn-travel-v14 .nn-ref-search{
      height:59px!important;min-height:59px!important;margin-left:-5px!important;margin-right:-5px!important;width:calc(100% + 10px)!important;
      border:1px solid #64e9ff!important;border-radius:15px!important;
      background:linear-gradient(100deg,#21d6e9 0%,#11a2f4 48%,#1473eb 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.42),0 0 22px rgba(18,186,255,.37),0 9px 18px rgba(0,0,0,.28)!important;
      font-size:17px!important;font-weight:900!important;letter-spacing:.04em!important
    }
    .nn-travel-v14 .nn-ref-search:before{
      content:""!important;display:inline-block!important;width:26px!important;height:26px!important;margin-right:12px!important;vertical-align:-7px!important;
      background:#fff!important;-webkit-mask-image:${ICONS.search}!important;mask-image:${ICONS.search}!important;
      -webkit-mask-repeat:no-repeat!important;mask-repeat:no-repeat!important;-webkit-mask-position:center!important;mask-position:center!important;-webkit-mask-size:contain!important;mask-size:contain!important
    }
    .nn-travel-v14 .nn-ref-status{font-size:12px!important;line-height:22px!important;color:#9bd7f5!important}

    .nn-travel-v14 .nn-results[data-flight-results]{
      width:100%!important;height:100%!important;padding:6px!important;border:1px solid #286d91!important;border-radius:23px!important;
      background:radial-gradient(circle at 31% -8%,rgba(26,111,162,.13),transparent 37%),linear-gradient(145deg,#072c46 0%,#041c31 46%,#031727 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 18px rgba(0,0,0,.24)!important
    }
    .nn-travel-v14 .nn-ref-results-head{height:67px!important;padding:2px 16px 8px!important}
    .nn-travel-v14 .nn-ref-results-title{gap:16px!important}
    .nn-travel-v14 .nn-ref-results-title>b:first-child{
      font-size:0!important;width:36px!important;height:36px!important;display:inline-block!important;background:#28cfff!important;
      -webkit-mask-image:${ICONS.plane}!important;mask-image:${ICONS.plane}!important;-webkit-mask-repeat:no-repeat!important;mask-repeat:no-repeat!important;
      -webkit-mask-position:center!important;mask-position:center!important;-webkit-mask-size:contain!important;mask-size:contain!important;transform:none!important
    }
    .nn-travel-v14 .nn-ref-results-title strong{font-size:18px!important;font-weight:800!important;color:#f2f9ff!important}
    .nn-travel-v14 .nn-ref-results-title small{font-size:12px!important;color:#94c8e3!important;margin-top:4px!important}
    .nn-travel-v14 .nn-ref-result-count{font-size:12px!important;color:#9dcae5!important}
    .nn-travel-v14 .nn-ref-results-list{height:calc(100% - 67px)!important;gap:7px!important}
    .nn-travel-v14 .nn-ref-result{
      min-height:95px!important;height:95px!important;padding:9px 10px 9px 14px!important;gap:10px!important;
      border:1px solid #2d82aa!important;border-radius:15px!important;
      background:linear-gradient(110deg,#0a3b58 0%,#082d47 52%,#051d31 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 5px 11px rgba(0,0,0,.22)!important
    }
    .nn-travel-v14 .nn-ref-logo{width:62px!important;height:62px!important;border-radius:10px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 6px 12px rgba(0,0,0,.23)!important}
    .nn-travel-v14 .nn-ref-route{font-size:14px!important;font-weight:800!important;color:#f5f9fc!important}
    .nn-travel-v14 .nn-ref-meta{font-size:11px!important;line-height:1.45!important;color:#c1dceb!important}
    .nn-travel-v14 .nn-ref-provider{color:#7fc4ec!important}
    .nn-travel-v14 .nn-ref-price{min-width:100px!important}
    .nn-travel-v14 .nn-ref-price strong{font-size:14px!important;font-weight:800!important;color:#f7fbff!important}
    .nn-travel-v14 .nn-ref-live-chip{padding:4px 8px!important;margin-bottom:7px!important;font-size:10px!important;border-color:rgba(57,230,135,.45)!important;background:rgba(5,78,59,.58)!important;color:#68f4a6!important}
    .nn-travel-v14 .nn-ref-arrow{font-size:26px!important;color:#c6e7f7!important}

    html.nn-travel-visual-lock .nx-dock.global{
      left:8px!important;right:8px!important;bottom:49px!important;height:70px!important;padding:7px!important;gap:10px!important;
      border:1px solid #16658e!important;border-radius:22px!important;
      background:linear-gradient(180deg,rgba(6,50,82,.99),rgba(3,29,50,.995))!important;
      box-shadow:0 10px 24px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.07),0 0 18px rgba(0,145,255,.09)!important
    }
    html.nn-travel-visual-lock .nx-dock.global button{border-radius:15px!important;font-size:13px!important;font-weight:900!important;color:#bfe1f3!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important}
    html.nn-travel-visual-lock .nx-dock.global button:last-child{border:1px solid #25c7ff!important;background:linear-gradient(120deg,#0d6ea7,#075c93)!important;color:#f1fbff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 0 14px rgba(0,175,255,.16)!important}
    html.nn-travel-visual-lock .nn-bottom-ref-icon{width:26px;height:26px;display:grid;place-items:center;color:#8fcaf0;filter:drop-shadow(0 0 5px rgba(52,178,255,.25))}
    html.nn-travel-visual-lock .nn-bottom-ref-icon svg{width:26px;height:26px;display:block}
    html.nn-travel-visual-lock .nx-dock.global button:last-child .nn-bottom-ref-icon{color:#f4fbff}
  `;
  document.head.appendChild(style);
}

function installBottomDockReference(){
  const dock=document.querySelector('.nx-dock.global:not([hidden])') || document.querySelector('.nx-dock.global');
  if(!dock) return;
  const buttons=[...dock.querySelectorAll('button')];
  if(buttons.length<2) return;
  buttons[0].innerHTML='<span class="nn-bottom-ref-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.6"/><path fill="currentColor" stroke="none" d="M13.3 3.8 7.6 13h3.7l-.8 7.2 5.9-9.7h-3.8l.7-6.7Z"/></svg></span><span>MINE</span>';
  buttons[1].innerHTML='<span class="nn-bottom-ref-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"/><path d="M8.5 16V8l7 8V8"/></svg></span><span>NOVA HUB</span>';
}

export function renderTravelSuite(){
  const root=renderTravelSuiteV13();
  root.classList.add('nn-travel-v14');
  root.dataset.referenceVisual='v14-reference-material-pass';
  ensureV14Styles();
  queueMicrotask(installBottomDockReference);
  return root;
}

export const travelSuiteRenderers=Object.freeze({travel:renderTravelSuite});
