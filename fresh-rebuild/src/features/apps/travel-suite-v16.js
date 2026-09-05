import { renderTravelSuite as renderTravelSuiteV15 } from './travel-suite-v15.js';

function ensureV16Styles(){
  if(document.getElementById('nn-travel-flagship-v16')) return;
  const style=document.createElement('style');
  style.id='nn-travel-flagship-v16';
  style.textContent=`
    .nn-travel-v16{
      --v16-bg:#03101c;--v16-card:#071b2a;--v16-card2:#0a2234;--v16-line:#1f536f;--v16-muted:#8faec0;--v16-text:#f5fbff;--v16-accent:#20c6ff;--v16-accent2:#1677ef;
      width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;
      background:radial-gradient(circle at 50% -8%,#0a3459 0,#061d31 25%,#03111f 56%,#020a12 100%)!important;
    }
    .nn-travel-v16 .nn-ref-canvas{
      position:relative!important;left:0!important;top:0!important;transform:none!important;
      width:100%!important;height:100%!important;min-height:0!important;padding:8px 10px 4px!important;
      display:grid!important;grid-template-rows:72px minmax(0,1fr)!important;gap:8px!important;align-content:stretch!important;
    }
    .nn-travel-v16 .nn-dock{
      height:72px!important;min-height:72px!important;padding:6px 6px 6px 54px!important;gap:6px!important;
      border-radius:22px!important;border:1px solid rgba(77,160,206,.38)!important;
      background:linear-gradient(180deg,rgba(10,47,73,.97),rgba(4,27,45,.985))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 22px rgba(0,0,0,.28)!important;
    }
    .nn-travel-v16 .nn-tab{
      height:58px!important;min-height:58px!important;padding:5px 4px!important;gap:3px!important;border-radius:16px!important;
      border:1px solid transparent!important;background:transparent!important;color:#c8deea!important;font-size:12px!important;font-weight:850!important;
      box-shadow:none!important;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease!important;
    }
    .nn-travel-v16 .nn-tab .nn-ref-tab-icon,.nn-travel-v16 .nn-tab .nn-ref-tab-icon svg{width:24px!important;height:24px!important}
    .nn-travel-v16 .nn-tab.is-active{
      color:#fff!important;border-color:rgba(88,221,255,.82)!important;
      background:linear-gradient(150deg,#20c7f5 0%,#1498ed 48%,#1266d9 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 0 18px rgba(21,177,255,.44),0 7px 16px rgba(0,0,0,.22)!important;
    }
    .nn-travel-v16 .nn-api-dot{width:8px!important;height:8px!important;right:7px!important;bottom:8px!important}
    .nn-travel-v16 .nn-travel-back{
      left:6px!important;top:6px!important;width:42px!important;height:58px!important;min-width:42px!important;min-height:58px!important;
      border-radius:15px!important;border:1px solid rgba(87,162,201,.42)!important;background:linear-gradient(180deg,#10344e,#08243a)!important;
      color:#f3fbff!important;font-size:30px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 14px rgba(0,0,0,.2)!important;
    }
    .nn-travel-v16 .nn-stage{height:100%!important;min-height:0!important;padding:0!important;overflow:hidden!important}
    .nn-travel-v16 .nn-panel[hidden]{display:none!important}
    .nn-travel-v16 .nn-panel:not([hidden]){display:grid!important;height:100%!important;min-height:0!important;padding:0!important;gap:8px!important;overflow:hidden!important}

    .nn-travel-v16 .nn-panel[data-panel="flights"]{grid-template-rows:108px 350px minmax(0,1fr)!important;width:100%!important}
    .nn-travel-v16 .nn-ref-hero{
      height:108px!important;min-height:108px!important;padding:16px 17px 13px!important;border-radius:22px!important;
      border:1px solid rgba(67,143,183,.48)!important;background:linear-gradient(110deg,#082943 0%,#041c30 64%,#031625 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 18px rgba(0,0,0,.22)!important;overflow:hidden!important;
    }
    .nn-travel-v16 .nn-locked-hero-right{width:126px!important;height:108px!important;right:0!important;top:0!important;opacity:.9!important}
    .nn-travel-v16 .nn-ref-kicker{font-size:11px!important;letter-spacing:.1em!important;color:#42d8ff!important;line-height:1!important}
    .nn-travel-v16 .nn-ref-title{margin:14px 0 5px!important;font-size:22px!important;line-height:1!important;letter-spacing:-.035em!important;max-width:74%!important;width:auto!important;transform:none!important}
    .nn-travel-v16 .nn-ref-sub{font-size:11px!important;line-height:1.3!important;max-width:71%!important;color:#a8c8da!important}
    .nn-travel-v16 .nn-ref-live{padding:5px 9px!important;font-size:10px!important;right:10px!important;top:12px!important}
    .nn-travel-v16 .nn-ref-live-copy{font-size:10px!important;right:11px!important;top:48px!important}

    .nn-travel-v16 .nn-panel[data-panel="flights"]>.nn-card{
      height:350px!important;min-height:350px!important;padding:11px 14px 10px!important;border-radius:22px!important;
      border:1px solid rgba(62,137,176,.46)!important;background:linear-gradient(145deg,rgba(8,35,52,.99),rgba(3,21,35,.995))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 18px rgba(0,0,0,.23)!important;display:flex!important;flex-direction:column!important;gap:8px!important;
    }
    .nn-travel-v16 .nn-v16-trip-modes{display:flex;gap:5px;height:30px;min-height:30px;align-items:center;padding:2px;border-radius:12px;background:rgba(1,10,18,.56);border:1px solid rgba(83,150,184,.2)}
    .nn-travel-v16 .nn-v16-trip-mode{flex:1;height:24px;border:0;border-radius:9px;background:transparent;color:#9bb9ca;font-size:11px;font-weight:850;letter-spacing:.01em}
    .nn-travel-v16 .nn-v16-trip-mode.is-active{background:linear-gradient(145deg,rgba(28,187,239,.28),rgba(15,104,213,.34));color:#f6fdff;box-shadow:inset 0 0 0 1px rgba(86,214,255,.42)}
    .nn-travel-v16.nn-v16-oneway .nn-return{visibility:hidden!important;pointer-events:none!important}
    .nn-travel-v16 .nn-ref-flight-form{flex:1!important;min-height:0!important;grid-template-rows:69px 66px 65px 52px 18px!important;row-gap:7px!important;column-gap:7px!important}
    .nn-travel-v16 .nn-ref-field{gap:5px!important}
    .nn-travel-v16 .nn-ref-field>span{font-size:10px!important;letter-spacing:.055em!important;color:#a9c2d0!important}
    .nn-travel-v16 .nn-ref-field input,.nn-travel-v16 .nn-ref-field select{
      height:44px!important;min-height:44px!important;border-radius:12px!important;border:1px solid rgba(53,129,169,.55)!important;
      background:linear-gradient(180deg,#061725,#020b12)!important;color:#f5fbff!important;font-size:14px!important;padding:0 11px 0 39px!important;
      box-shadow:inset 0 2px 7px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.025)!important;
    }
    .nn-travel-v16 .nn-ref-field:after{left:12px!important;bottom:12px!important;width:18px!important;height:18px!important}
    .nn-travel-v16 .nn-swap{width:37px!important;height:42px!important;min-width:37px!important;min-height:42px!important;border-radius:12px!important;font-size:20px!important}
    .nn-travel-v16 .nn-ref-search{
      height:50px!important;min-height:50px!important;width:100%!important;margin:0!important;border-radius:14px!important;
      border:1px solid #6beaff!important;background:linear-gradient(100deg,#20cfdf 0%,#139dea 50%,#1769df 100%)!important;
      color:white!important;font-size:14px!important;font-weight:900!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.36),0 0 17px rgba(15,183,255,.28),0 7px 15px rgba(0,0,0,.22)!important;
    }
    .nn-travel-v16 .nn-ref-search:before{width:20px!important;height:20px!important;margin-right:8px!important;vertical-align:-5px!important}
    .nn-travel-v16 .nn-ref-status{height:18px!important;min-height:18px!important;line-height:18px!important;font-size:10px!important;color:#9cc8de!important}

    .nn-travel-v16 .nn-results[data-flight-results]{
      height:100%!important;min-height:0!important;padding:8px!important;border-radius:22px!important;border:1px solid rgba(57,136,177,.48)!important;
      background:linear-gradient(145deg,rgba(6,32,50,.99),rgba(3,19,32,.995))!important;overflow:hidden!important;
    }
    .nn-travel-v16 .nn-ref-results-head{height:48px!important;padding:0 8px 6px!important}
    .nn-travel-v16 .nn-ref-results-title{gap:9px!important}.nn-travel-v16 .nn-ref-results-title>b:first-child{width:26px!important;height:26px!important}
    .nn-travel-v16 .nn-ref-results-title strong{font-size:14px!important}.nn-travel-v16 .nn-ref-results-title small{font-size:9px!important;margin-top:2px!important}.nn-travel-v16 .nn-ref-result-count{font-size:9px!important}
    .nn-travel-v16 .nn-v16-result-tools{display:flex;gap:5px;overflow-x:auto;padding:0 1px 7px;scrollbar-width:none}.nn-travel-v16 .nn-v16-result-tools::-webkit-scrollbar{display:none}
    .nn-travel-v16 .nn-v16-result-tool{flex:none;height:27px;padding:0 10px;border-radius:999px;border:1px solid rgba(77,151,188,.36);background:#071b2b;color:#9fc0d2;font-size:10px;font-weight:850}
    .nn-travel-v16 .nn-v16-result-tool.is-active{border-color:#47d8ff;background:rgba(16,136,210,.27);color:#effbff}
    .nn-travel-v16 .nn-ref-results-list{height:calc(100% - 82px)!important;gap:7px!important;overflow-y:auto!important;padding-bottom:4px!important}
    .nn-travel-v16 .nn-ref-result{min-height:84px!important;height:84px!important;padding:8px 9px!important;grid-template-columns:52px minmax(0,1fr) auto 12px!important;gap:8px!important;border-radius:15px!important}
    .nn-travel-v16 .nn-ref-logo{width:50px!important;height:50px!important;border-radius:10px!important;font-size:9px!important}.nn-travel-v16 .nn-ref-route{font-size:12px!important}.nn-travel-v16 .nn-ref-meta{font-size:9px!important;line-height:1.35!important}.nn-travel-v16 .nn-ref-price{min-width:82px!important}.nn-travel-v16 .nn-ref-price strong{font-size:12px!important}.nn-travel-v16 .nn-ref-live-chip{font-size:8px!important;padding:3px 6px!important;margin-bottom:5px!important}.nn-travel-v16 .nn-ref-arrow{font-size:20px!important}

    .nn-travel-v16 .nn-panel:not([data-panel="flights"]){grid-template-rows:330px minmax(0,1fr)!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"])>.nn-card{height:330px!important;min-height:330px!important;padding:14px!important;border-radius:22px!important;border:1px solid rgba(62,137,176,.44)!important;background:linear-gradient(145deg,rgba(8,35,52,.99),rgba(3,21,35,.995))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 18px rgba(0,0,0,.22)!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"]) .nn-grid{gap:8px!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"]) input,.nn-travel-v16 .nn-panel:not([data-panel="flights"]) select{height:43px!important;min-height:43px!important;font-size:13px!important;border-radius:11px!important;background:linear-gradient(180deg,#061725,#020b12)!important;border-color:rgba(53,129,169,.48)!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"]) textarea{height:58px!important;min-height:58px!important;font-size:12px!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"]) .nn-action{height:48px!important;min-height:48px!important;border-radius:13px!important;font-size:12px!important}
    .nn-travel-v16 .nn-panel:not([data-panel="flights"])>.nn-results{min-height:0!important;overflow-y:auto!important;padding:2px!important}
    .nn-travel-v16 .nn-form-head{margin-bottom:8px!important}.nn-travel-v16 .nn-form-head strong{font-size:14px!important}.nn-travel-v16 .nn-form-head span{font-size:9px!important}
    .nn-travel-v16 .nn-status{font-size:10px!important;line-height:1.3!important}
    .nn-travel-v16 .nn-empty{min-height:88px!important;font-size:11px!important}

    html.nn-travel-visual-lock .nx-dock.global{left:8px!important;right:8px!important;bottom:8px!important;height:62px!important;padding:6px!important;gap:8px!important;border-radius:20px!important}
    html.nn-travel-visual-lock .nx-dock.global button{border-radius:14px!important;font-size:11px!important;gap:8px!important}
    html.nn-travel-visual-lock .nn-bottom-ref-icon,html.nn-travel-visual-lock .nn-bottom-ref-icon svg{width:21px!important;height:21px!important}

    @media (max-width:380px){
      .nn-travel-v16 .nn-ref-canvas{padding-left:7px!important;padding-right:7px!important}.nn-travel-v16 .nn-dock{padding-left:50px!important;gap:4px!important}.nn-travel-v16 .nn-travel-back{width:39px!important}.nn-travel-v16 .nn-tab{font-size:10px!important}.nn-travel-v16 .nn-tab .nn-ref-tab-icon,.nn-travel-v16 .nn-tab .nn-ref-tab-icon svg{width:21px!important;height:21px!important}.nn-travel-v16 .nn-panel[data-panel="flights"]{grid-template-rows:102px 350px minmax(0,1fr)!important}.nn-travel-v16 .nn-ref-title{font-size:19px!important}.nn-travel-v16 .nn-ref-sub{font-size:10px!important}.nn-travel-v16 .nn-ref-field input,.nn-travel-v16 .nn-ref-field select{font-size:12px!important;padding-left:34px!important}.nn-travel-v16 .nn-ref-field:after{left:10px!important;width:16px!important;height:16px!important}.nn-travel-v16 .nn-ref-result{grid-template-columns:45px minmax(0,1fr) auto 10px!important}.nn-travel-v16 .nn-ref-logo{width:44px!important;height:44px!important}.nn-travel-v16 .nn-ref-price{min-width:70px!important}.nn-travel-v16 .nn-ref-price strong{font-size:11px!important}
    }
  `;
  document.head.appendChild(style);
}

function hideLegacyOperationsDesk(root){
  const leaves=[...root.querySelectorAll('*')].filter(el=>el.children.length===0 && /TRAVEL OPERATIONS DESK/i.test(el.textContent||''));
  for(const leaf of leaves){
    let box=leaf.parentElement;
    while(box && box!==root && box.parentElement!==root && !box.classList.contains('nn-ref-canvas')) box=box.parentElement;
    if(box && box!==root && !box.classList.contains('nn-dock')) box.style.display='none';
  }
}

function installTripModes(root){
  const form=root.querySelector('.nn-ref-flight-form');
  const card=form?.parentElement;
  if(!form||!card||card.querySelector('.nn-v16-trip-modes')) return;
  const modes=document.createElement('div');
  modes.className='nn-v16-trip-modes';
  modes.setAttribute('role','group');
  modes.setAttribute('aria-label','Flight trip type');
  modes.innerHTML='<button type="button" class="nn-v16-trip-mode is-active" data-v16-trip-mode="roundtrip">Round trip</button><button type="button" class="nn-v16-trip-mode" data-v16-trip-mode="oneway">One way</button>';
  card.insertBefore(modes,form);
  modes.addEventListener('click',event=>{
    const button=event.target.closest('[data-v16-trip-mode]');
    if(!button) return;
    const oneway=button.dataset.v16TripMode==='oneway';
    modes.querySelectorAll('[data-v16-trip-mode]').forEach(b=>b.classList.toggle('is-active',b===button));
    root.classList.toggle('nn-v16-oneway',oneway);
    const ret=root.querySelector('[data-flight-return]');
    if(oneway && ret) ret.value='';
  });
}

function installReliableSwap(root){
  const swap=root.querySelector('.nn-swap');
  if(!swap||swap.dataset.v16Swap==='true') return;
  swap.dataset.v16Swap='true';
  swap.addEventListener('click',()=>{
    const from=root.querySelector('[data-flight-origin]');
    const to=root.querySelector('[data-flight-destination]');
    if(!from||!to) return;
    const value=from.value;from.value=to.value;to.value=value;
  },true);
}

function parsePrice(card){
  const text=card.querySelector('.nn-ref-price strong')?.textContent||'';
  const value=Number(text.replace(/[^0-9.]/g,''));
  return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
}
function parseDuration(card){
  const text=card.querySelector('.nn-ref-meta')?.textContent||'';
  const h=Number((text.match(/(\d+)h/)||[])[1]||0),m=Number((text.match(/(\d+)m/)||[])[1]||0);
  const total=h*60+m;return total||Number.MAX_SAFE_INTEGER;
}
function sortFlightCards(box,mode){
  const list=box.querySelector('.nn-ref-results-list');if(!list)return;
  const cards=[...list.querySelectorAll('.nn-ref-result')];if(!cards.length)return;
  cards.forEach(card=>card.hidden=false);
  if(mode==='direct'){
    cards.forEach(card=>{card.hidden=!/non-stop|direct/i.test(card.textContent||'')});
    return;
  }
  const score=card=>{
    if(mode==='cheapest') return parsePrice(card);
    if(mode==='fastest') return parseDuration(card);
    return parsePrice(card)+(parseDuration(card)*45)+(/non-stop|direct/i.test(card.textContent||'')?0:12000);
  };
  cards.sort((a,b)=>score(a)-score(b)).forEach(card=>list.appendChild(card));
}
function installResultTools(root){
  const box=root.querySelector('[data-flight-results]');if(!box)return;
  const ensure=()=>{
    if(box.querySelector('.nn-v16-result-tools')||!box.querySelector('.nn-ref-result')) return;
    const tools=document.createElement('div');
    tools.className='nn-v16-result-tools';
    tools.innerHTML='<button type="button" class="nn-v16-result-tool is-active" data-v16-sort="best">Best</button><button type="button" class="nn-v16-result-tool" data-v16-sort="cheapest">Cheapest</button><button type="button" class="nn-v16-result-tool" data-v16-sort="fastest">Fastest</button><button type="button" class="nn-v16-result-tool" data-v16-sort="direct">Direct</button>';
    const list=box.querySelector('.nn-ref-results-list');
    if(list) box.insertBefore(tools,list);
    tools.addEventListener('click',event=>{
      const button=event.target.closest('[data-v16-sort]');if(!button)return;
      tools.querySelectorAll('[data-v16-sort]').forEach(b=>b.classList.toggle('is-active',b===button));
      sortFlightCards(box,button.dataset.v16Sort);
    });
  };
  ensure();
  const observer=new MutationObserver(()=>queueMicrotask(ensure));
  observer.observe(box,{childList:true,subtree:true});
  const previousCleanup=root.__cleanup;
  root.__cleanup=()=>{observer.disconnect();previousCleanup?.()};
}

function enforceActivePanel(root){
  const apply=name=>{
    const active=['flights','hotels','ground','plan'].includes(name)?name:'flights';
    root.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==active);
  };
  root.addEventListener('click',event=>{
    const tab=event.target.closest?.('[data-travel-tab]');if(!tab)return;
    queueMicrotask(()=>apply(tab.dataset.travelTab));
  },true);
  apply(root.querySelector('[data-travel-tab].is-active')?.dataset.travelTab||'flights');
}

export function renderTravelSuite(){
  ensureV16Styles();
  const root=renderTravelSuiteV15();
  root.classList.add('nn-travel-v16');
  root.dataset.flagship='v16-benchmark-inspired';
  hideLegacyOperationsDesk(root);
  installTripModes(root);
  installReliableSwap(root);
  installResultTools(root);
  enforceActivePanel(root);
  return root;
}

export const travelSuiteRenderers=Object.freeze({travel:renderTravelSuite});
