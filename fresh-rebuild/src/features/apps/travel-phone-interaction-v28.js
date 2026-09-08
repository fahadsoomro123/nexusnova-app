const STYLE_ID='nn-travel-phone-interaction-v28';
const ROOT_SELECTOR='.nn-travel-v19';
const MENU_ID='nn-class-menu-v28';

const CSS=`
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}{height:100%!important;min-height:0!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{min-height:0!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-travel-stage{grid-row:3!important;position:relative!important;align-self:stretch!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden]){position:absolute!important;top:4px!important;bottom:4px!important;left:12px!important;right:12px!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{position:absolute!important;top:var(--nn-v17-hero-height,clamp(108px,17vh,150px))!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;display:grid!important;grid-template-rows:minmax(34px,.58fr) minmax(74px,1.08fr) minmax(48px,.8fr) minmax(48px,.8fr) minmax(40px,.66fr) minmax(48px,.78fr) minmax(48px,.78fr)!important;align-content:stretch!important;gap:6px!important;padding:8px 8px 7px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-trip-top,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-filter-row,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-search-button,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>div:last-child{height:100%!important;min-height:0!important;max-height:none!important}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes .nn-route,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair .nn-control{height:100%!important;min-height:0!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-button{display:grid!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:relative!important;z-index:180!important;min-height:50px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card{padding-bottom:8px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-control.nn-class-control-v28{position:relative!important;overflow:visible!important;z-index:460!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-control.nn-class-control-v28 select[data-flight-cabin]{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)!important}
.nn-class-trigger-v28{width:100%;height:27px;border:0;background:transparent;color:#fff;padding:0;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;font-size:10.5px;font-weight:900;cursor:pointer}
.nn-class-trigger-v28 span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nn-class-trigger-v28 .nn-class-chevron-v28{font-size:13px;color:#ffe5a8;transition:transform .14s ease,filter .14s ease;filter:drop-shadow(0 0 4px rgba(255,196,82,.42))}
.nn-class-trigger-v28[aria-expanded="true"] .nn-class-chevron-v28{transform:rotate(180deg)}
.nn-class-menu-v28{position:absolute;z-index:2600;width:min(282px,calc(100vw - 28px));padding:10px;border-radius:20px;border:1px solid rgba(255,214,136,.72);background:radial-gradient(90% 70% at 12% -8%,rgba(255,188,66,.22),transparent 52%),radial-gradient(70% 70% at 105% 100%,rgba(137,92,255,.22),transparent 58%),linear-gradient(155deg,rgba(21,31,44,.995),rgba(8,18,31,.995) 48%,rgba(15,14,36,.995));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.6),0 22px 46px rgba(0,0,0,.62),0 0 28px rgba(255,175,56,.14);backdrop-filter:blur(18px);transform-origin:80% 0;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-5px) scale(.975);transition:opacity .14s ease,transform .14s ease,visibility .14s ease}
.nn-class-menu-v28[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
.nn-class-menu-v28::before{content:"CABIN CLASS";display:block;padding:1px 4px 8px;color:#ffd47f;font-size:7px;font-weight:950;letter-spacing:.19em;text-shadow:0 0 9px rgba(255,184,68,.35)}
.nn-class-option-v28{--v28-top:#355066;--v28-mid:#1a3347;--v28-low:#0b1b2a;--v28-depth:#07131e;position:relative;width:100%;height:48px;margin:0 0 8px;padding:0 13px;border:1px solid rgba(219,239,250,.34);border-radius:14px;background:radial-gradient(90% 120% at 14% -15%,rgba(255,255,255,.36),transparent 34%),linear-gradient(145deg,var(--v28-top),var(--v28-mid) 52%,var(--v28-low));box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.68),0 4px 0 var(--v28-depth),0 8px 14px rgba(0,0,0,.32);color:#effaff;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;font-weight:900;text-align:left;transform:translateY(-1px);transition:transform .1s ease,filter .1s ease,box-shadow .1s ease}
.nn-class-option-v28:last-child{margin-bottom:0}
.nn-class-option-v28:nth-of-type(1){--v28-top:#16c2a2;--v28-mid:#087565;--v28-low:#063a43;--v28-depth:#063a32}
.nn-class-option-v28:nth-of-type(2){--v28-top:#2aa4de;--v28-mid:#176292;--v28-low:#173451;--v28-depth:#102844}
.nn-class-option-v28:nth-of-type(3){--v28-top:#9566df;--v28-mid:#5d3f9c;--v28-low:#2c2b5e;--v28-depth:#292151}
.nn-class-option-v28:nth-of-type(4){--v28-top:#e6a13d;--v28-mid:#986524;--v28-low:#4a3420;--v28-depth:#4a2c17}
.nn-class-option-v28 .nn-class-check-v28{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;background:rgba(2,12,21,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.16);font-size:12px;color:transparent}
.nn-class-option-v28[aria-selected="true"]{filter:saturate(1.12) brightness(1.08);border-color:rgba(255,244,202,.82);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -1px 0 rgba(0,0,0,.56),0 4px 0 var(--v28-depth),0 9px 18px rgba(0,0,0,.38),0 0 22px rgba(255,193,79,.2)}
.nn-class-option-v28[aria-selected="true"] .nn-class-check-v28{color:#fff;background:linear-gradient(145deg,#ffd15b,#df8c28);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 0 11px rgba(255,186,61,.42)}
.nn-class-option-v28:active{transform:translateY(3px) scale(.994);filter:brightness(.96);box-shadow:inset 0 3px 8px rgba(0,0,0,.34),0 1px 0 var(--v28-depth),0 4px 8px rgba(0,0,0,.28)}
html.nn-travel-v8-active.nn-travel-v8-editing body #nx-app>.nx-dock,html.nn-travel-v17-route-edit body #nx-app>.nx-dock{display:none!important}
html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-travel-frame,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-travel-frame{visibility:visible!important;pointer-events:auto!important;min-height:0!important}
html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden]),html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-panel.nn-flight-panel:not([hidden]){--nn-v17-hero-height:clamp(64px,11vh,82px)!important}
html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{display:grid!important;grid-template-rows:34px 74px 48px 48px 40px 48px 44px!important;align-content:start!important;gap:5px!important;overflow-y:auto!important;padding:7px!important}
html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-trip-top,html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-routes,html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-pair,html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-filter-row,html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-search-button,html.nn-travel-v17-route-edit body #nx-app ${ROOT_SELECTOR} .nn-search-card>div:last-child,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>.nn-trip-top,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>.nn-routes,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>.nn-pair,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>.nn-filter-row,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>.nn-search-button,html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-v28-route-focus .nn-search-card>div:last-child{height:100%!important;min-height:0!important;max-height:none!important}
@media(max-width:390px){.nn-class-menu-v28{width:min(268px,calc(100vw - 24px));padding:8px}.nn-class-option-v28{height:44px;margin-bottom:7px;font-size:10px}.nn-class-option-v28 .nn-class-check-v28{width:22px;height:22px}}
@media(min-height:1000px){
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden]){display:block!important;grid-template-rows:none!important}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{display:grid!important;grid-template-rows:minmax(34px,.58fr) minmax(74px,1.08fr) minmax(48px,.8fr) minmax(48px,.8fr) minmax(40px,.66fr) minmax(48px,.78fr) minmax(48px,.78fr)!important}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-trip-top,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-filter-row,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-search-button,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>div:last-child{min-height:0!important;height:100%!important;max-height:none!important;flex-basis:auto!important}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes .nn-route,html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair .nn-control{min-height:0!important;height:100%!important;max-height:none!important}
}
`;

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=CSS;
  document.head.appendChild(style);
}

function visible(el){
  if(!(el instanceof HTMLElement)) return false;
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
}

function routeInput(root){
  const active=document.activeElement;
  return active instanceof HTMLInputElement&&root.contains(active)&&Boolean(active.closest('.nn-route'))?active:null;
}

function syncGeometry(root){
  if(!(root instanceof HTMLElement)||!root.isConnected) return;
  root.style.setProperty('height','100%','important');
  root.style.setProperty('min-height','0','important');
  const frame=root.querySelector('.nn-travel-frame');
  if(!(frame instanceof HTMLElement)) return;
  const active=routeInput(root);
  root.classList.toggle('nn-v28-route-focus',Boolean(active));
  const rr=root.getBoundingClientRect();
  const visual=window.visualViewport;
  const dock=document.querySelector('#nx-app>.nx-dock')||document.querySelector('.nx-dock');
  let height=0;
  if(active){
    const visualBottom=(visual?.offsetTop||0)+(visual?.height||window.innerHeight||rr.height);
    height=Math.max(300,Math.floor(visualBottom-rr.top));
  }else if(dock instanceof HTMLElement&&visible(dock)){
    height=Math.max(1,Math.floor(dock.getBoundingClientRect().top-rr.top-6));
  }else{
    height=Math.max(1,Math.floor((window.innerHeight||rr.height)-rr.top-68));
  }
  frame.style.setProperty('height',`${height}px`,'important');
  frame.style.setProperty('min-height','0','important');
  const stage=root.querySelector('.nn-travel-stage');
  const panel=root.querySelector('.nn-flight-panel:not([hidden])');
  const hero=panel?.querySelector('.nn-hero');
  const card=panel?.querySelector('.nn-search-card');
  if(stage instanceof HTMLElement&&panel instanceof HTMLElement&&hero instanceof HTMLElement&&card instanceof HTMLElement&&!active){
    const tab=root.querySelector('.nn-tab-dock');
    const frameRect=frame.getBoundingClientRect();
    const tabRect=tab instanceof HTMLElement?tab.getBoundingClientRect():null;
    const stageTop=Math.max(1,Math.round((tabRect?.bottom||frameRect.top+rr.width*.187)-frameRect.top));
    let heroHeight=Number(root.dataset.v28ApprovedHeroHeight||0);
    if(!(heroHeight>0)){
      heroHeight=Math.max(64,Math.round(hero.getBoundingClientRect().height||0));
      root.dataset.v28ApprovedHeroHeight=String(heroHeight);
    }
    stage.style.setProperty('position','absolute','important');
    stage.style.setProperty('top',`${stageTop}px`,'important');
    stage.style.setProperty('bottom','0','important');
    stage.style.setProperty('left','0','important');
    stage.style.setProperty('right','0','important');
    stage.style.setProperty('height','auto','important');
    panel.style.setProperty('position','absolute','important');
    panel.style.setProperty('top','4px','important');
    panel.style.setProperty('bottom','4px','important');
    panel.style.setProperty('left',rr.width<=380?'8px':'12px','important');
    panel.style.setProperty('right',rr.width<=380?'8px':'12px','important');
    panel.style.setProperty('height','auto','important');
    panel.style.setProperty('--nn-v17-hero-height',`${heroHeight}px`,'important');
    hero.style.setProperty('position','absolute','important');
    hero.style.setProperty('top','0','important');
    hero.style.setProperty('height',`${heroHeight}px`,'important');
    card.style.setProperty('position','absolute','important');
    card.style.setProperty('top',`${heroHeight}px`,'important');
    card.style.setProperty('bottom','0','important');
    card.style.setProperty('height','auto','important');
    card.style.setProperty('min-height','0','important');
    root.dataset.v28HeroHeight=String(heroHeight);
    root.dataset.v28StageTop=String(stageTop);
  }
  root.style.setProperty('--nn-v17-frame-height',`${height}px`,'important');
  root.style.setProperty('--nn-v8-frame-height',`${height}px`,'important');
  root.style.setProperty('--nn-travel-frame-height',`${height}px`,'important');
  root.dataset.phoneInteractionV28='true';
  root.dataset.v28FrameHeight=String(height);
  root.dataset.v28RouteFocus=active?'true':'false';
  const cardNow=root.querySelector('.nn-search-card');
  const search=root.querySelector('.nn-search-button');
  if(cardNow instanceof HTMLElement&&search instanceof HTMLElement&&!active){
    cardNow.scrollTop=0;
    const cardRect=cardNow.getBoundingClientRect(),buttonRect=search.getBoundingClientRect();
    if(buttonRect.bottom>cardRect.bottom+1) cardNow.scrollTop=Math.max(0,buttonRect.bottom-cardRect.bottom+cardNow.scrollTop+8);
    const dockRect=dock instanceof HTMLElement&&visible(dock)?dock.getBoundingClientRect():null;
    const panelRect=panel instanceof HTMLElement?panel.getBoundingClientRect():null;
    root.dataset.v28CardBottom=String(Math.round(cardRect.bottom));
    root.dataset.v28SearchBottom=String(Math.round(buttonRect.bottom));
    if(panelRect) root.dataset.v28PanelBottom=String(Math.round(panelRect.bottom));
    if(dockRect) root.dataset.v28VisibleGap=String(Math.round(dockRect.top-Math.max(cardRect.bottom,panelRect?.bottom||0)));
  }
  if(cardNow instanceof HTMLElement&&active){
    const routes=root.querySelector('.nn-routes');
    const target=routes instanceof HTMLElement?Math.max(0,routes.offsetTop-4):0;
    cardNow.scrollTop=target;
  }
}

function schedule(root){
  syncGeometry(root);
  requestAnimationFrame(()=>syncGeometry(root));
  for(const ms of [60,180,420,900]) setTimeout(()=>syncGeometry(root),ms);
}

function closeMenu(root){
  const menu=root?.querySelector(`#${MENU_ID}`);
  const trigger=root?.querySelector('.nn-class-trigger-v28');
  if(menu instanceof HTMLElement) menu.dataset.open='false';
  if(trigger instanceof HTMLButtonElement) trigger.setAttribute('aria-expanded','false');
}

function positionMenu(root,control,menu){
  const rr=root.getBoundingClientRect(),cr=control.getBoundingClientRect();
  const width=Math.min(282,Math.max(230,rr.width-28));
  menu.style.width=`${width}px`;
  let left=cr.right-rr.left-width;
  left=Math.max(12,Math.min(left,rr.width-width-12));
  let top=cr.bottom-rr.top+8;
  const maxTop=Math.max(12,rr.height-menu.offsetHeight-12);
  if(top>maxTop) top=Math.max(12,cr.top-rr.top-menu.offsetHeight-8);
  menu.style.left=`${Math.round(left)}px`;
  menu.style.top=`${Math.round(top)}px`;
}

function enhanceClass(root){
  const select=root.querySelector('select[data-flight-cabin]');
  if(!(select instanceof HTMLSelectElement)||select.dataset.classV28==='true') return;
  select.dataset.classV28='true';
  const control=select.closest('.nn-control');
  const host=select.parentElement;
  if(!(control instanceof HTMLElement)||!(host instanceof HTMLElement)) return;
  control.classList.add('nn-class-control-v28');
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='nn-class-trigger-v28';
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span></span><span class="nn-class-chevron-v28" aria-hidden="true">⌄</span>';
  host.appendChild(trigger);
  const menu=document.createElement('div');
  menu.id=MENU_ID;
  menu.className='nn-class-menu-v28';
  menu.dataset.open='false';
  menu.setAttribute('role','listbox');
  menu.setAttribute('aria-label','Cabin class');
  root.appendChild(menu);
  const refresh=()=>{
    const selected=select.selectedOptions[0];
    trigger.querySelector('span').textContent=selected?.textContent||'Economy';
    menu.querySelectorAll('.nn-class-option-v28').forEach(btn=>btn.setAttribute('aria-selected',btn.dataset.value===select.value?'true':'false'));
  };
  for(const option of [...select.options]){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='nn-class-option-v28';
    btn.dataset.value=option.value;
    btn.setAttribute('role','option');
    btn.innerHTML=`<span>${option.textContent}</span><span class="nn-class-check-v28" aria-hidden="true">✓</span>`;
    btn.addEventListener('click',()=>{
      select.value=option.value;
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
      refresh();
      closeMenu(root);
    });
    menu.appendChild(btn);
  }
  trigger.addEventListener('click',event=>{
    event.preventDefault();
    const opening=menu.dataset.open!=='true';
    closeMenu(root);
    if(opening){
      menu.dataset.open='true';
      trigger.setAttribute('aria-expanded','true');
      requestAnimationFrame(()=>positionMenu(root,control,menu));
    }
  });
  select.addEventListener('change',refresh);
  document.addEventListener('pointerdown',event=>{
    if(!root.isConnected) return;
    if(event.target instanceof Node&&!menu.contains(event.target)&&!trigger.contains(event.target)) closeMenu(root);
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu(root)},true);
  refresh();
}

function bind(root){
  if(!(root instanceof HTMLElement)||root.dataset.phoneInteractionBoundV28==='true') return;
  root.dataset.phoneInteractionBoundV28='true';
  enhanceClass(root);
  const run=()=>schedule(root);
  root.addEventListener('focusin',run,true);
  root.addEventListener('focusout',run,true);
  window.visualViewport?.addEventListener('resize',run);
  window.visualViewport?.addEventListener('scroll',run);
  window.addEventListener('resize',run);
  window.addEventListener('orientationchange',run);
  schedule(root);
}

function scan(){
  document.querySelectorAll(ROOT_SELECTOR).forEach(root=>{
    enhanceClass(root);
    bind(root);
    schedule(root);
  });
}

installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
