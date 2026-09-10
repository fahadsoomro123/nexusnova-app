const STYLE_ID='nn-travel-hyper3d-flagship-v25';
const ROOT='.nn-travel-v19';
const TACTILE='.nn-route,.nn-control,.nn-filter,.nn-search-button,.nn-trip-mode,.nn-secondary-action';

const CSS=`
html.nn-travel-v8-active body #nx-app ${ROOT}{--n25-shadow:rgba(0,0,0,.5)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card{
  border:1px solid rgba(124,228,255,.5)!important;
  background:radial-gradient(85% 52% at 4% -2%,rgba(45,221,255,.18),transparent 58%),radial-gradient(70% 52% at 104% 4%,rgba(151,91,255,.16),transparent 62%),linear-gradient(155deg,#0a273b 0%,#041827 48%,#071b2c 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.72),inset 0 0 0 1px rgba(24,103,145,.18),0 18px 36px rgba(0,0,0,.42),0 0 28px rgba(31,178,255,.08)!important
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card::before{content:"";position:absolute;z-index:0;pointer-events:none;left:12px;right:12px;top:1px;height:34%;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.055),transparent)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>*{position:relative;z-index:1}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action{
  --n25-top:#12749a;--n25-mid:#063d56;--n25-low:#041c2c;--n25-depth:#03141f;--n25-glow:rgba(48,219,255,.22);
  position:relative!important;transform-style:preserve-3d!important;transform:translateY(-2px) perspective(720px) rotateX(.7deg)!important;transform-origin:center 72%!important;
  background:radial-gradient(112% 90% at 17% -15%,rgba(255,255,255,.43),transparent 37%),radial-gradient(72% 82% at 90% 120%,rgba(255,255,255,.08),transparent 50%),linear-gradient(148deg,var(--n25-top),var(--n25-mid) 52%,var(--n25-low))!important;
  border:1px solid rgba(211,248,255,.46)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.64),inset 0 -1px 0 rgba(0,0,0,.74),inset -10px -12px 22px rgba(0,0,0,.19),0 1px 0 rgba(255,255,255,.11),0 5px 0 var(--n25-depth),0 10px 18px rgba(0,0,0,.36),0 0 18px var(--n25-glow)!important;
  transition:transform .11s cubic-bezier(.2,.8,.2,1),box-shadow .11s ease,filter .11s ease!important;will-change:transform,box-shadow
}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode::before,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action::before{content:"";position:absolute;z-index:1;pointer-events:none;left:7%;right:7%;top:1px;height:42%;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.07) 52%,transparent);opacity:.56;mix-blend-mode:screen}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode::after,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action::after{content:"";position:absolute;z-index:1;pointer-events:none;left:12%;right:12%;bottom:2px;height:2px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.34),transparent 72%);opacity:.48}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control>*,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter>*,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button>*{position:relative;z-index:3}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:first-child{--n25-top:#1382ac;--n25-mid:#074866;--n25-low:#05253b;--n25-depth:#04243c;--n25-glow:rgba(42,210,255,.31)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:last-of-type{--n25-top:#7b58cb;--n25-mid:#43317f;--n25-low:#1c2048;--n25-depth:#1b1640;--n25-glow:rgba(165,110,255,.29)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-date-pair .nn-control:first-child{--n25-top:#16b2da;--n25-mid:#096b8b;--n25-low:#06384f;--n25-depth:#06364f;--n25-glow:rgba(45,226,255,.3)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-date-pair .nn-control:last-child{--n25-top:#a66de8;--n25-mid:#603f9a;--n25-low:#2b2854;--n25-depth:#2a2058;--n25-glow:rgba(190,128,255,.3)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-pair:not(.nn-date-pair) .nn-control:first-child{--n25-top:#15c18a;--n25-mid:#08775e;--n25-low:#073f41;--n25-depth:#073f37;--n25-glow:rgba(67,241,173,.28)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-pair:not(.nn-date-pair) .nn-control:last-child{--n25-top:#e6a137;--n25-mid:#986425;--n25-low:#44382e;--n25-depth:#4e341b;--n25-glow:rgba(255,194,91,.28)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(1){--n25-top:#1fc3e5;--n25-mid:#0a779f;--n25-low:#07384f;--n25-depth:#06394d}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(2){--n25-top:#1bc08d;--n25-mid:#0b7b63;--n25-low:#073f43;--n25-depth:#073e38}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(3){--n25-top:#936de3;--n25-mid:#5a499f;--n25-low:#2d315d;--n25-depth:#2b2455}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:nth-child(4){--n25-top:#dd9435;--n25-mid:#925f29;--n25-low:#413932;--n25-depth:#4c351f}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button{--n25-depth:#27206c;--n25-glow:rgba(69,181,255,.4);background:radial-gradient(78% 130% at 12% -15%,rgba(255,255,255,.6),transparent 35%),radial-gradient(68% 120% at 94% 128%,rgba(255,255,255,.15),transparent 42%),linear-gradient(104deg,#24e5e8 0%,#2589fa 33%,#7e5df5 67%,#ee50cc 100%)!important;border-color:rgba(236,252,255,.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.84),inset 0 -1px 0 rgba(48,17,95,.66),inset -12px -14px 24px rgba(38,20,102,.17),0 1px 0 rgba(255,255,255,.18),0 6px 0 #27206c,0 13px 25px rgba(40,60,150,.43),0 0 27px rgba(53,208,255,.3)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button .arrow{border:1px solid rgba(255,255,255,.35)!important;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.28),transparent 34%),linear-gradient(160deg,rgba(13,55,143,.82),rgba(38,20,105,.74))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.36),0 3px 7px rgba(0,0,0,.25)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode{--n25-top:#173f59;--n25-mid:#092b40;--n25-low:#051823;--n25-depth:#04131d;--n25-glow:rgba(52,173,228,.1)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode.is-active{--n25-top:#35e2ee;--n25-mid:#1c94ef;--n25-low:#365bd0;--n25-depth:#193f7e;--n25-glow:rgba(50,208,255,.35)}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-tactile-pressed,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-control:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode:active,
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action:active{transform:translateY(3px) perspective(720px) rotateX(-.4deg) scale(.993)!important;filter:saturate(1.04) brightness(.955)!important;box-shadow:inset 0 4px 10px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.18),0 1px 0 var(--n25-depth),0 4px 8px rgba(0,0,0,.28),0 0 10px var(--n25-glow)!important}
@media(hover:hover) and (pointer:fine){html.nn-travel-v8-active body #nx-app ${ROOT} .nn-filter:hover,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button:hover,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-trip-mode:hover,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-secondary-action:hover{transform:translateY(-3px) perspective(720px) rotateX(.85deg)!important;filter:saturate(1.08) brightness(1.035)!important}}

html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travelers-control{z-index:270!important;overflow:visible!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travelers-control select[data-flight-adults]{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger{width:100%;height:26px;border:0;background:transparent;color:#fff;padding:0;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;font-size:10.5px;font-weight:850;cursor:pointer}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-chevron{font-size:12px;color:#dcfff2;transition:transform .15s ease}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-trigger[aria-expanded="true"] .nn-passenger-chevron{transform:rotate(180deg)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover{position:absolute;z-index:950;left:-34px;top:calc(100% + 12px);width:min(278px,76vw);padding:10px;border-radius:18px;border:1px solid rgba(166,244,218,.56);background:radial-gradient(80% 55% at 10% 0%,rgba(63,240,172,.13),transparent 58%),radial-gradient(70% 60% at 100% 100%,rgba(89,152,255,.12),transparent 65%),linear-gradient(155deg,rgba(9,38,42,.99),rgba(4,20,29,.995));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 18px 34px rgba(0,0,0,.58),0 0 25px rgba(59,227,168,.13);transform:translateY(-3px) scale(.985);transform-origin:35% 0;opacity:0;visibility:hidden;pointer-events:none;transition:.14s ease}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row{display:grid;grid-template-columns:minmax(0,1fr) 32px 28px 32px;align-items:center;gap:6px;padding:7px 2px}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row+.nn-passenger-row{border-top:1px solid rgba(112,196,180,.13)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-copy b{display:block;font-size:10px;color:#f2fffb}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-copy small{display:block;margin-top:2px;font-size:7.5px;color:#88b8b0}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-count{text-align:center;font-size:12px;font-weight:950;color:#fff}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step{width:32px;height:32px;border:1px solid rgba(197,255,235,.46);border-radius:10px;color:#effff9;font-size:18px;line-height:1;background:radial-gradient(circle at 35% 20%,rgba(255,255,255,.3),transparent 35%),linear-gradient(145deg,#159d76,#075943 62%,#063238);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 3px 0 #053029,0 6px 11px rgba(0,0,0,.28)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step:active{transform:translateY(2px);box-shadow:inset 0 2px 5px rgba(0,0,0,.28),0 1px 0 #053029}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step:disabled{opacity:.34;filter:grayscale(.35)}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-foot{padding:7px 2px 2px;border-top:1px solid rgba(112,196,180,.16);font-size:7.5px;line-height:1.35;color:#8fbab3}
@media(max-width:390px){html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-popover{left:-30px;width:min(270px,80vw);padding:9px}html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-row{grid-template-columns:minmax(0,1fr) 30px 26px 30px;gap:5px;padding:6px 2px}html.nn-travel-v8-active body #nx-app ${ROOT} .nn-passenger-step{width:30px;height:30px}}
`;

function ensureStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style)}

function populate(select,min,max,one,many){
  if(!(select instanceof HTMLSelectElement)||select.dataset.nn25Options==='true')return;
  const current=Math.max(min,Math.min(max,Number(select.value)||min));
  const frag=document.createDocumentFragment();
  for(let value=min;value<=max;value++){const o=document.createElement('option');o.value=String(value);o.textContent=`${value} ${value===1?one:many}`;frag.appendChild(o)}
  select.replaceChildren(frag);select.value=String(current);select.dataset.nn25Options='true';
}
function hidden(control,attr){let input=control.querySelector(`[${attr}]`);if(!(input instanceof HTMLInputElement)){input=document.createElement('input');input.type='hidden';input.setAttribute(attr,'');input.value='0';control.appendChild(input)}return input}
function summary(s){const p=[`${s.adults} ${s.adults===1?'Adult':'Adults'}`];if(s.children)p.push(`${s.children} ${s.children===1?'Child':'Children'}`);if(s.infants)p.push(`${s.infants} ${s.infants===1?'Infant':'Infants'}`);return p.join(' · ')}

function enhancePassengers(root){
  const select=root.querySelector('select[data-flight-adults]');const control=select?.closest('.nn-control');
  if(!(select instanceof HTMLSelectElement)||!(control instanceof HTMLElement))return;
  populate(select,1,9,'Adult','Adults');if(control.dataset.nn25Passengers==='true')return;
  control.dataset.nn25Passengers='true';control.classList.add('nn-travelers-control');
  const children=hidden(control,'data-flight-children');const infants=hidden(control,'data-flight-infants');
  const s={adults:Number(select.value)||1,children:Number(children.value)||0,infants:Number(infants.value)||0};
  const trigger=document.createElement('button');trigger.type='button';trigger.className='nn-passenger-trigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','dialog');trigger.innerHTML='<span></span><span class="nn-passenger-chevron">⌄</span>';
  const pop=document.createElement('div');pop.className='nn-passenger-popover';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Choose travelers');pop.dataset.open='false';pop.innerHTML=`<div class="nn-passenger-row" data-kind="adults"><div class="nn-passenger-copy"><b>Adults</b><small>Age 12+</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">1</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div><div class="nn-passenger-row" data-kind="children"><div class="nn-passenger-copy"><b>Children</b><small>Age 2–11</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">0</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div><div class="nn-passenger-row" data-kind="infants"><div class="nn-passenger-copy"><b>Infants</b><small>Under 2</small></div><button class="nn-passenger-step" data-delta="-1" type="button">−</button><span class="nn-passenger-count">0</span><button class="nn-passenger-step" data-delta="1" type="button">+</button></div><div class="nn-passenger-foot">Maximum 9 travelers. Infants cannot exceed adults. Final child/infant fare rules are confirmed by the live provider.</div>`;
  control.querySelector('div')?.appendChild(trigger);control.appendChild(pop);
  const sync=()=>{
    s.adults=Math.max(1,Math.min(9,s.adults));s.children=Math.max(0,Math.min(8,s.children));s.infants=Math.max(0,Math.min(Math.min(4,s.adults),s.infants));
    let total=s.adults+s.children+s.infants;if(total>9){let extra=total-9;if(s.children){const cut=Math.min(s.children,extra);s.children-=cut;extra-=cut}if(extra)s.infants=Math.max(0,s.infants-extra)}
    select.value=String(s.adults);children.value=String(s.children);infants.value=String(s.infants);trigger.querySelector('span').textContent=summary(s);
    pop.querySelectorAll('.nn-passenger-row').forEach(row=>{const kind=row.dataset.kind;row.querySelector('.nn-passenger-count').textContent=String(s[kind]);row.querySelector('[data-delta="-1"]').disabled=kind==='adults'?s.adults<=1:s[kind]<=0;row.querySelector('[data-delta="1"]').disabled=(s.adults+s.children+s.infants)>=9||(kind==='infants'&&s.infants>=Math.min(4,s.adults))});
    root.dataset.nn25Adults=String(s.adults);root.dataset.nn25Children=String(s.children);root.dataset.nn25Infants=String(s.infants);
  };
  const close=()=>{pop.dataset.open='false';trigger.setAttribute('aria-expanded','false')};
  trigger.addEventListener('click',e=>{e.stopPropagation();const open=pop.dataset.open!=='true';pop.dataset.open=String(open);trigger.setAttribute('aria-expanded',String(open))});
  pop.addEventListener('click',e=>{const step=e.target.closest('.nn-passenger-step');if(!step)return;const row=step.closest('.nn-passenger-row');const kind=row?.dataset.kind;if(!kind)return;s[kind]+=Number(step.dataset.delta)||0;sync()});
  root.addEventListener('click',e=>{if(!control.contains(e.target))close()});root.addEventListener('keydown',e=>{if(e.key==='Escape')close()});sync();
}

function enhanceHotel(root){const adults=root.querySelector('select[data-hotel-adults]');const rooms=root.querySelector('select[data-hotel-rooms]');populate(adults,1,9,'Adult','Adults');populate(rooms,1,5,'Room','Rooms');if(adults instanceof HTMLSelectElement){const field=adults.closest('.nn-field');if(field&&!field.querySelector('[data-hotel-children]')){const input=document.createElement('input');input.type='hidden';input.setAttribute('data-hotel-children','');input.value='0';field.appendChild(input)}}}

function bindTactile(root){if(root.dataset.nn25Tactile==='true')return;root.dataset.nn25Tactile='true';let pressed=null;const clear=()=>{pressed?.classList.remove('nn-tactile-pressed');pressed=null};root.addEventListener('pointerdown',e=>{const t=e.target.closest(TACTILE);if(!(t instanceof HTMLElement))return;pressed=t;t.classList.add('nn-tactile-pressed')},{passive:true});root.addEventListener('pointerup',clear,{passive:true});root.addEventListener('pointercancel',clear,{passive:true});root.addEventListener('pointerleave',clear,{passive:true})}

function bridgeFetch(){if(globalThis.__nnTravelPassengerFetchV25)return;const original=globalThis.fetch?.bind(globalThis);if(!original)return;globalThis.__nnTravelPassengerFetchV25=true;globalThis.fetch=async(input,init={})=>{try{const url=typeof input==='string'?input:String(input?.url||'');if(typeof init?.body==='string'&&/\/rpc\/(searchWorldwideFlights|searchPakistanAgencyFlights|searchWorldwideHotels)(?:$|\?)/.test(url)){const root=document.querySelector(ROOT);const body=JSON.parse(init.body);if(/searchWorldwideFlights|searchPakistanAgencyFlights/.test(url)){body.children=Number(root?.querySelector('[data-flight-children]')?.value)||0;body.infants=Number(root?.querySelector('[data-flight-infants]')?.value)||0}else body.children=Number(root?.querySelector('[data-hotel-children]')?.value)||0;init={...init,body:JSON.stringify(body)}}}catch{}return original(input,init)}}

function enhance(root){if(!(root instanceof HTMLElement))return;root.dataset.hyper3dFlagshipV25='true';bindTactile(root);enhancePassengers(root);enhanceHotel(root)}
function install(){ensureStyle();bridgeFetch();document.querySelectorAll(ROOT).forEach(enhance)}
install();
const observer=new MutationObserver(()=>queueMicrotask(install));observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(install,300);setTimeout(install,1000);
