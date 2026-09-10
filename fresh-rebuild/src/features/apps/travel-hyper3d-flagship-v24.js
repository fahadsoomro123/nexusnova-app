const STYLE_ID='nn-travel-hyper3d-flagship-v24';
const ROOT='.nn-travel-v19';
const TACTILE='.nn-route,.nn-control,.nn-filter,.nn-search-button,.nn-trip-mode,.nn-secondary-action';

const CSS=`
html.nn-travel-v8-active body #nx-app ${ROOT}{
  --nn24-obsidian:#020913;
  --nn24-rim:rgba(255,255,255,.58);
  --nn24-shadow:rgba(0,0,0,.52);
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card{
  border:1px solid rgba(124,228,255,.52)!important;
  background:
    radial-gradient(85% 52% at 5% -2%,rgba(53,220,255,.19),transparent 58%),
    radial-gradient(65% 44% at 104% 2%,rgba(157,92,255,.17),transparent 62%),
    linear-gradient(155deg,rgba(11,38,58,.97),rgba(3,18,31,.985) 48%,rgba(5,19,33,.99))!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    inset 0 -1px 0 rgba(0,0,0,.72),
    inset 0 0 0 1px rgba(24,103,145,.22),
    0 18px 36px rgba(0,0,0,.42),
    0 0 28px rgba(31,178,255,.08)!important;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card::before{
  content:"";position:absolute;z-index:0;pointer-events:none;left:12px;right:12px;top:1px;height:36%;border-radius:18px;
  background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,0));
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>*{position:relative;z-index:1}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action{
  --nn24-top:#0c6f91;--nn24-mid:#06374e;--nn24-low:#031724;--nn24-depth:#021019;--nn24-glow:rgba(49,220,255,.24);
  position:relative!important;
  transform-style:preserve-3d!important;
  transform:translateY(-2px) perspective(700px) rotateX(.65deg)!important;
  transform-origin:center 70%!important;
  background:
    radial-gradient(115% 90% at 18% -16%,rgba(255,255,255,.42),transparent 38%),
    radial-gradient(75% 80% at 88% 120%,rgba(255,255,255,.07),transparent 50%),
    linear-gradient(148deg,var(--nn24-top) 0%,var(--nn24-mid) 52%,var(--nn24-low) 100%)!important;
  border:1px solid rgba(207,247,255,.46)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.62),
    inset 0 -1px 0 rgba(0,0,0,.72),
    inset 9px 0 18px rgba(255,255,255,.025),
    inset -10px -12px 22px rgba(0,0,0,.20),
    0 1px 0 rgba(255,255,255,.11),
    0 5px 0 var(--nn24-depth),
    0 10px 18px rgba(0,0,0,.36),
    0 0 18px var(--nn24-glow)!important;
  transition:transform .105s cubic-bezier(.2,.8,.2,1),box-shadow .105s ease,filter .105s ease!important;
  will-change:transform,box-shadow;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action::before{
  content:"";position:absolute;z-index:1;pointer-events:none;left:7%;right:7%;top:1px;height:43%;border-radius:inherit;
  background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,.07) 52%,rgba(255,255,255,0));
  opacity:.55;mix-blend-mode:screen;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action::after{
  content:"";position:absolute;z-index:1;pointer-events:none;left:12%;right:12%;bottom:2px;height:2px;border-radius:50%;
  background:radial-gradient(ellipse,rgba(255,255,255,.32),rgba(255,255,255,0) 72%);opacity:.48;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route>*:not(.nn-passenger-popover),
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control>*:not(.nn-passenger-popover),
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter>*,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button>*{position:relative;z-index:3}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:first-child{--nn24-top:#126f9d;--nn24-mid:#073f61;--nn24-low:#052238;--nn24-depth:#042039;--nn24-glow:rgba(44,210,255,.32)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:last-of-type{--nn24-top:#704fc2;--nn24-mid:#3a2d76;--nn24-low:#191d42;--nn24-depth:#17143a;--nn24-glow:rgba(156,105,255,.29)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-date-pair .nn-control:first-child{--nn24-top:#11a6d1;--nn24-mid:#086384;--nn24-low:#063349;--nn24-depth:#06334d;--nn24-glow:rgba(43,224,255,.30)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-date-pair .nn-control:last-child{--nn24-top:#9a66e0;--nn24-mid:#5a3b91;--nn24-low:#28264f;--nn24-depth:#281d55;--nn24-glow:rgba(181,121,255,.31)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-pair:not(.nn-date-pair) .nn-control:first-child{--nn24-top:#12b982;--nn24-mid:#087158;--nn24-low:#073a3d;--nn24-depth:#073b34;--nn24-glow:rgba(66,240,170,.28)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-pair:not(.nn-date-pair) .nn-control:last-child{--nn24-top:#df982a;--nn24-mid:#8f5c1f;--nn24-low:#3e342b;--nn24-depth:#4a3118;--nn24-glow:rgba(255,190,82,.28)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(1){--nn24-top:#18b9de;--nn24-mid:#086f97;--nn24-low:#07344b;--nn24-depth:#05364a;--nn24-glow:rgba(48,218,255,.25)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(2){--nn24-top:#16b884;--nn24-mid:#0a745d;--nn24-low:#073b3e;--nn24-depth:#073a35;--nn24-glow:rgba(68,234,171,.23)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(3){--nn24-top:#8a66dc;--nn24-mid:#554498;--nn24-low:#292d57;--nn24-depth:#272150;--nn24-glow:rgba(162,130,255,.24)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(4){--nn24-top:#d58c2f;--nn24-mid:#8b5a25;--nn24-low:#3c3530;--nn24-depth:#49311d;--nn24-glow:rgba(255,188,82,.23)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button{
  --nn24-depth:#261f68;--nn24-glow:rgba(70,176,255,.38);
  background:
    radial-gradient(78% 130% at 12% -16%,rgba(255,255,255,.58),transparent 35%),
    radial-gradient(68% 120% at 94% 128%,rgba(255,255,255,.14),transparent 42%),
    linear-gradient(104deg,#22dfe8 0%,#2584f7 33%,#7959f2 67%,#ea4bc8 100%)!important;
  border-color:rgba(232,251,255,.78)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.82),
    inset 0 -1px 0 rgba(48,17,95,.66),
    inset -12px -14px 24px rgba(38,20,102,.18),
    0 1px 0 rgba(255,255,255,.18),
    0 6px 0 #261f68,
    0 13px 25px rgba(40,60,150,.43),
    0 0 26px rgba(53,208,255,.28)!important;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button .arrow{
  border:1px solid rgba(255,255,255,.34)!important;
  background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.26),transparent 34%),linear-gradient(160deg,rgba(13,55,143,.78),rgba(38,20,105,.72))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 3px 7px rgba(0,0,0,.25)!important;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode{--nn24-top:#143a53;--nn24-mid:#08263a;--nn24-low:#041521;--nn24-depth:#03121c;--nn24-glow:rgba(52,173,228,.10)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode.is-active{--nn24-top:#31dded;--nn24-mid:#1a8ce9;--nn24-low:#3156c9;--nn24-depth:#173c79;--nn24-glow:rgba(49,205,255,.34)}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-tactile-pressed,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action:active{
  transform:translateY(3px) perspective(700px) rotateX(-.35deg) scale(.993)!important;
  filter:saturate(1.04) brightness(.96)!important;
  box-shadow:
    inset 0 4px 9px rgba(0,0,0,.32),
    inset 0 1px 0 rgba(255,255,255,.18),
    inset 0 -1px 0 rgba(255,255,255,.05),
    0 1px 0 var(--nn24-depth),
    0 4px 8px rgba(0,0,0,.28),
    0 0 10px var(--nn24-glow)!important;
}
@media(hover:hover) and (pointer:fine){
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:hover,
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button:hover,
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode:hover,
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action:hover{transform:translateY(-3px) perspective(700px) rotateX(.8deg)!important;filter:saturate(1.08) brightness(1.035)!important}
}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travelers-control{z-index:260!important;overflow:visible!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travelers-control select[data-flight-adults]{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger{
  width:100%;height:26px;border:0;background:transparent;color:#fff;padding:0;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;font-size:10.5px;font-weight:850;cursor:pointer;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger .nn-passenger-chevron{font-size:12px;color:#dcfff2;transition:transform .15s ease}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger[aria-expanded="true"] .nn-passenger-chevron{transform:rotate(180deg)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover{
  position:absolute;z-index:900;left:-35px;top:calc(100% + 12px);width:min(278px,76vw);padding:10px;border-radius:18px;
  border:1px solid rgba(166,244,218,.54);
  background:
    radial-gradient(80% 55% at 10% 0%,rgba(63,240,172,.13),transparent 58%),
    radial-gradient(70% 60% at 100% 100%,rgba(89,152,255,.12),transparent 65%),
    linear-gradient(155deg,rgba(9,38,42,.985),rgba(4,20,29,.99));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 18px 34px rgba(0,0,0,.58),0 0 25px rgba(59,227,168,.12);
  transform:translateY(-3px) scale(.985);transform-origin:35% 0;opacity:0;visibility:hidden;pointer-events:none;transition:.14s ease;
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row{display:grid;grid-template-columns:minmax(0,1fr) 32px 28px 32px;align-items:center;gap:6px;padding:7px 2px}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row+.nn-passenger-row{border-top:1px solid rgba(112,196,180,.13)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-copy b{display:block;font-size:10px;color:#f2fffb}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-copy small{display:block;margin-top:2px;font-size:7.5px;color:#88b8b0}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-count{text-align:center;font-size:12px;font-weight:950;color:#fff}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step{
  width:32px;height:32px;border:1px solid rgba(197,255,235,.46);border-radius:10px;color:#effff9;font-size:18px;line-height:1;background:radial-gradient(circle at 35% 20%,rgba(255,255,255,.28),transparent 35%),linear-gradient(145deg,#13936e,#07503f 62%,#062d31);box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 3px 0 #052d28,0 6px 11px rgba(0,0,0,.28)
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step:active{transform:translateY(2px);box-shadow:inset 0 2px 5px rgba(0,0,0,.28),0 1px 0 #052d28}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step:disabled{opacity:.34;filter:grayscale(.35)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-foot{padding:7px 2px 2px;border-top:1px solid rgba(112,196,180,.16);font-size:7.5px;line-height:1.35;color:#8fbab3}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-field.nn-hotel-guests{position:relative;overflow:visible;z-index:250}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-field.nn-hotel-guests select[data-hotel-adults]{max-height:28px}

@media(max-width:390px){
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover{left:-31px;width:min(270px,80vw);padding:9px}
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row{grid-template-columns:minmax(0,1fr) 30px 26px 30px;gap:5px;padding:6px 2px}
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step{width:30px;height:30px}
}
`;

function ensureStyle(){
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style)}
}

function fillNumberOptions(select,min,max,labelOne,labelMany){
  if(!(select instanceof HTMLSelectElement)) return;
  const current=Math.max(min,Math.min(max,Number(select.value)||min));
  select.replaceChildren(...Array.from({length:max-min+1},(_,i)=>{
    const value=min+i;const option=document.createElement('option');option.value=String(value);option.textContent=`${value} ${value===1?labelOne:labelMany}`;return option;
  }));
  select.value=String(current);
}

function ensureHidden(control,attr){
  let input=control.querySelector(`[${attr}]`);
  if(!(input instanceof HTMLInputElement)){
    input=document.createElement('input');input.type='hidden';input.setAttribute(attr,'');input.value='0';control.appendChild(input);
  }
  return input;
}

function passengerSummary(state){
  const parts=[`${state.adults} ${state.adults===1?'Adult':'Adults'}`];
  if(state.children) parts.push(`${state.children} ${state.children===1?'Child':'Children'}`);
  if(state.infants) parts.push(`${state.infants} ${state.infants===1?'Infant':'Infants'}`);
  return parts.join(' · ');
}

function enhanceFlightPassengers(root){
  const select=root.querySelector('select[data-flight-adults]');
  const control=select?.closest('.nn-control');
  if(!(select instanceof HTMLSelectElement)||!(control instanceof HTMLElement)) return;
  fillNumberOptions(select,1,9,'Adult','Adults');
  if(control.dataset.nn24Passengers==='true') return;
  control.dataset.nn24Passengers='true';control.classList.add('nn-travelers-control');
  const children=ensureHidden(control,'data-flight-children');
  const infants=ensureHidden(control,'data-flight-infants');
  const state={adults:Number(select.value)||1,children:Number(children.value)||0,infants:Number(infants.value)||0};

  const trigger=document.createElement('button');trigger.type='button';trigger.className='nn-passenger-trigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','dialog');
  trigger.innerHTML='<span></span><span class="nn-passenger-chevron">⌄</span>';
  const pop=document.createElement('div');pop.className='nn-passenger-popover';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Choose travelers');pop.dataset.open='false';
  pop.innerHTML=`
    <div class="nn-passenger-row" data-kind="adults"><div class="nn-passenger-copy"><b>Adults</b><small>Age 12+</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">1</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div>
    <div class="nn-passenger-row" data-kind="children"><div class="nn-passenger-copy"><b>Children</b><small>Age 2–11</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">0</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div>
    <div class="nn-passenger-row" data-kind="infants"><div class="nn-passenger-copy"><b>Infants</b><small>Under 2</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">0</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div>
    <div class="nn-passenger-foot">Maximum 9 travelers per search. Infants cannot exceed adults. Final child/infant fare rules are confirmed by the live provider.</div>`;
  control.querySelector('div')?.appendChild(trigger);control.appendChild(pop);

  const sync=()=>{
    const total=state.adults+state.children+state.infants;
    if(total>9){const excess=total-9;if(state.children>=excess)state.children-=excess;else state.infants=Math.max(0,state.infants-excess)}
    state.adults=Math.max(1,Math.min(9,state.adults));state.children=Math.max(0,Math.min(8,state.children));state.infants=Math.max(0,Math.min(Math.min(4,state.adults),state.infants));
    select.value=String(state.adults);children.value=String(state.children);infants.value=String(state.infants);
    trigger.querySelector('span').textContent=passengerSummary(state);
    pop.querySelectorAll('.nn-passenger-row').forEach(row=>{
      const kind=row.dataset.kind;row.querySelector('.nn-passenger-count').textContent=String(state[kind]);
      const minus=row.querySelector('[data-delta="-1"]');const plus=row.querySelector('[data-delta="1"]');
      minus.disabled=(kind==='adults'?state.adults<=1:state[kind]<=0);
      const totalNow=state.adults+state.children+state.infants;
      plus.disabled=totalNow>=9||(kind==='infants'&&state.infants>=Math.min(4,state.adults));
    });
    root.dataset.nn24Adults=String(state.adults);root.dataset.nn24Children=String(state.children);root.dataset.nn24Infants=String(state.infants);
    select.dispatchEvent(new Event('change',{bubbles:true}));children.dispatchEvent(new Event('change',{bubbles:true}));infants.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const close=()=>{pop.dataset.open='false';trigger.setAttribute('aria-expanded','false')};
  trigger.addEventListener('click',e=>{e.stopPropagation();const open=pop.dataset.open!=='true';pop.dataset.open=String(open);trigger.setAttribute('aria-expanded',String(open))});
  pop.addEventListener('click',e=>{const step=e.target.closest('.nn-passenger-step');if(!step)return;const row=step.closest('.nn-passenger-row');const kind=row?.dataset.kind;if(!kind)return;state[kind]+=Number(step.dataset.delta)||0;sync()});
  root.addEventListener('click',e=>{if(!control.contains(e.target))close()});
  root.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  sync();
}

function enhanceHotelGuests(root){
  const adults=root.querySelector('select[data-hotel-adults]');
  const rooms=root.querySelector('select[data-hotel-rooms]');
  if(adults instanceof HTMLSelectElement){fillNumberOptions(adults,1,9,'Adult','Adults');const field=adults.closest('.nn-field');if(field)field.classList.add('nn-hotel-guests');if(field&&!field.querySelector('[data-hotel-children]')){const input=document.createElement('input');input.type='hidden';input.setAttribute('data-hotel-children','');input.value='0';field.appendChild(input)}}
  if(rooms instanceof HTMLSelectElement)fillNumberOptions(rooms,1,5,'Room','Rooms');
}

function bindTactile(root){
  if(root.dataset.nn24TactileBound==='true') return;root.dataset.nn24TactileBound='true';
  let pressed=null;
  const clear=()=>{if(pressed){pressed.classList.remove('nn-tactile-pressed');pressed=null}};
  root.addEventListener('pointerdown',e=>{const target=e.target.closest(TACTILE);if(!(target instanceof HTMLElement))return;pressed=target;target.classList.add('nn-tactile-pressed')},{passive:true});
  root.addEventListener('pointerup',clear,{passive:true});root.addEventListener('pointercancel',clear,{passive:true});root.addEventListener('pointerleave',clear,{passive:true});
}

function installFetchPassengerBridge(){
  if(globalThis.__nnTravelPassengerFetchV24) return;globalThis.__nnTravelPassengerFetchV24=true;
  const original=globalThis.fetch?.bind(globalThis);if(!original)return;
  globalThis.fetch=async(input,init={})=>{
    try{
      const url=typeof input==='string'?input:String(input?.url||'');
      if(init?.body&&typeof init.body==='string'&&/\/rpc\/(searchWorldwideFlights|searchPakistanAgencyFlights|searchWorldwideHotels)(?:$|\?)/.test(url)){
        const root=document.querySelector(ROOT);const body=JSON.parse(init.body);
        if(/searchWorldwideFlights|searchPakistanAgencyFlights/.test(url)){
          const children=Number(root?.querySelector('[data-flight-children]')?.value)||0;const infants=Number(root?.querySelector('[data-flight-infants]')?.value)||0;
          body.children=children;body.infants=infants;
        }else{
          body.children=Number(root?.querySelector('[data-hotel-children]')?.value)||0;
        }
        init={...init,body:JSON.stringify(body)};
      }
    }catch{}
    return original(input,init);
  };
}

function install(){
  ensureStyle();installFetchPassengerBridge();
  document.querySelectorAll(ROOT).forEach(root=>{
    root.dataset.hyper3dFlagshipV24='true';bindTactile(root);enhanceFlightPassengers(root);enhanceHotelGuests(root);
  });
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(install,250);setTimeout(install,900);
