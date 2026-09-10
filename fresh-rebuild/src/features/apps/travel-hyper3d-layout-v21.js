const STYLE_ID = 'nn-travel-hyper3d-layout-v21';

const CSS = `
.nn-travel-v19{
  --nn3d-cyan:#27ddff;
  --nn3d-blue:#2d7dff;
  --nn3d-violet:#8d61ff;
  --nn3d-pink:#ff55cc;
  --nn3d-green:#47e7a5;
  --nn3d-amber:#ffbd54;
}

html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card{
  display:flex!important;
  flex-direction:column!important;
  justify-content:flex-start!important;
  align-content:normal!important;
  gap:8px!important;
  padding:10px!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  border-color:rgba(96,220,255,.48)!important;
  background:
    radial-gradient(circle at 10% 0%,rgba(39,221,255,.14),transparent 28%),
    radial-gradient(circle at 100% 18%,rgba(141,97,255,.14),transparent 32%),
    linear-gradient(155deg,#08283f 0%,#041827 48%,#071c2d 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -18px 34px rgba(0,0,0,.2),0 18px 32px rgba(0,0,0,.34)!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-trip-top{flex:0 0 44px!important;height:44px!important;min-height:44px!important;max-height:44px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-routes{flex:0 0 92px!important;height:92px!important;min-height:92px!important;max-height:92px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-routes .nn-route{height:92px!important;min-height:92px!important;max-height:92px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-pair{flex:0 0 72px!important;height:72px!important;min-height:72px!important;max-height:72px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-pair .nn-control{height:72px!important;min-height:72px!important;max-height:72px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-filter-row{flex:0 0 48px!important;height:48px!important;min-height:48px!important;max-height:48px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-filter-row .nn-filter{height:48px!important;min-height:48px!important;max-height:48px!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-search-button{flex:0 0 58px!important;height:58px!important;min-height:58px!important;max-height:58px!important;margin-top:auto!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>div:last-child{flex:0 0 48px!important;height:48px!important;min-height:48px!important;max-height:48px!important;display:grid!important;grid-template-rows:13px 35px!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card .nn-trust{height:35px!important;min-height:35px!important;max-height:35px!important}

.nn-travel-v19 .nn-route,
.nn-travel-v19 .nn-control,
.nn-travel-v19 .nn-filter,
.nn-travel-v19 .nn-search-button,
.nn-travel-v19 .nn-trip-mode,
.nn-travel-v19 .nn-swap{
  position:relative!important;
  transform:translateZ(0)!important;
  transition:transform .13s ease,box-shadow .13s ease,filter .13s ease!important;
}
.nn-travel-v19 .nn-route{
  border-width:1px!important;
  border-color:rgba(93,220,255,.62)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -9px 18px rgba(0,0,0,.18),0 5px 0 #03121d,0 10px 18px rgba(0,0,0,.28),0 0 18px rgba(39,221,255,.11)!important;
}
.nn-travel-v19 .nn-route:last-of-type{
  border-color:rgba(177,122,255,.6)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -9px 18px rgba(0,0,0,.18),0 5px 0 #100a23,0 10px 18px rgba(0,0,0,.28),0 0 18px rgba(141,97,255,.13)!important;
}
.nn-travel-v19 .nn-control{
  border-width:1px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.23),inset 0 -10px 18px rgba(0,0,0,.22),0 5px 0 rgba(1,10,17,.95),0 9px 16px rgba(0,0,0,.3)!important;
}
.nn-travel-v19 .nn-date-pair .nn-control:first-child{background:linear-gradient(145deg,#087eaa 0%,#075070 52%,#06273d 100%)!important;border-color:rgba(55,222,255,.58)!important}
.nn-travel-v19 .nn-date-pair .nn-control:last-child{background:linear-gradient(145deg,#704eb4 0%,#433878 52%,#182743 100%)!important;border-color:rgba(165,127,255,.58)!important}
.nn-travel-v19 .nn-pair:not(.nn-date-pair) .nn-control:first-child{background:linear-gradient(145deg,#0b8868 0%,#0a574f 52%,#082d3b 100%)!important;border-color:rgba(71,231,165,.56)!important}
.nn-travel-v19 .nn-pair:not(.nn-date-pair) .nn-control:last-child{background:linear-gradient(145deg,#a66d1a 0%,#68491c 52%,#2a3038 100%)!important;border-color:rgba(255,189,84,.6)!important}
.nn-travel-v19 .nn-control .ci{filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))}
.nn-travel-v19 .nn-filter-row{gap:6px!important}
.nn-travel-v19 .nn-filter{border-radius:14px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -8px 15px rgba(0,0,0,.2),0 4px 0 #03111b,0 8px 13px rgba(0,0,0,.28)!important}
.nn-travel-v19 .nn-filter:nth-child(1){background:linear-gradient(145deg,#0aa6cf,#075a82 62%,#063149)!important;border-color:rgba(55,224,255,.55)!important}
.nn-travel-v19 .nn-filter:nth-child(2){background:linear-gradient(145deg,#13a77d,#0b6259 62%,#073441)!important;border-color:rgba(74,232,174,.55)!important}
.nn-travel-v19 .nn-filter:nth-child(3){background:linear-gradient(145deg,#7656c9,#493d88 62%,#252d53)!important;border-color:rgba(163,132,255,.55)!important}
.nn-travel-v19 .nn-filter:nth-child(4){background:linear-gradient(145deg,#bb7929,#785022 62%,#34313a)!important;border-color:rgba(255,188,87,.56)!important}
.nn-travel-v19 .nn-search-button{
  border-radius:16px!important;
  border-color:rgba(255,255,255,.54)!important;
  background:radial-gradient(circle at 18% 0%,rgba(255,255,255,.34),transparent 24%),linear-gradient(110deg,#13d9ea 0%,#237ff4 34%,#8158f5 67%,#f04cc3 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 -13px 22px rgba(30,20,95,.24),0 6px 0 #17245d,0 12px 22px rgba(69,91,255,.34),0 0 22px rgba(35,208,255,.2)!important;
  text-shadow:0 1px 2px rgba(0,0,0,.34)!important;
}
.nn-travel-v19 .nn-trip-modes{height:38px!important;border-radius:13px!important;box-shadow:inset 0 2px 6px rgba(0,0,0,.5)}
.nn-travel-v19 .nn-trip-mode{height:32px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.nn-travel-v19 .nn-trip-mode.is-active{background:linear-gradient(135deg,#20d7ed,#2b7ef6 56%,#7b59ed)!important;border-color:rgba(183,240,255,.66)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -8px 15px rgba(26,35,112,.22),0 4px 0 #102c61,0 8px 14px rgba(35,139,255,.28)!important}
.nn-travel-v19 .nn-swap{background:linear-gradient(145deg,#18cbe5,#176dcc 58%,#684bdf)!important;border-color:rgba(192,245,255,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.62),inset 0 -8px 15px rgba(18,32,93,.24),0 5px 0 #10275c,0 9px 16px rgba(44,117,255,.3)!important}
.nn-travel-v19 .nn-route:active,.nn-travel-v19 .nn-control:active,.nn-travel-v19 .nn-filter:active,.nn-travel-v19 .nn-search-button:active,.nn-travel-v19 .nn-trip-mode:active,.nn-travel-v19 .nn-swap:active{
  transform:translateY(4px) scale(.993)!important;
  filter:saturate(1.08) brightness(.98)!important;
  box-shadow:inset 0 3px 9px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.13),0 2px 0 rgba(1,8,15,.95),0 5px 9px rgba(0,0,0,.24)!important;
}
.nn-travel-v19 .nn-status{height:13px!important}
.nn-travel-v19 .nn-trust .big{filter:drop-shadow(0 2px 5px rgba(38,210,255,.28))}

@media(max-width:390px){
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card{gap:6px!important;padding:8px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-trip-top{flex-basis:38px!important;height:38px!important;min-height:38px!important;max-height:38px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-routes{flex-basis:82px!important;height:82px!important;min-height:82px!important;max-height:82px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-routes .nn-route{height:82px!important;min-height:82px!important;max-height:82px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-pair{flex-basis:58px!important;height:58px!important;min-height:58px!important;max-height:58px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-pair .nn-control{height:58px!important;min-height:58px!important;max-height:58px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-filter-row{flex-basis:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-filter-row .nn-filter{height:44px!important;min-height:44px!important;max-height:44px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>.nn-search-button{flex-basis:52px!important;height:52px!important;min-height:52px!important;max-height:52px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card>div:last-child{flex-basis:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;grid-template-rows:13px 31px!important}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-search-card .nn-trust{height:31px!important;min-height:31px!important;max-height:31px!important}
}
`;

function install(){
  let style=document.getElementById(STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=CSS;
    document.head.appendChild(style);
  }
  const root=document.querySelector('.nn-travel-v19');
  if(root) root.dataset.hyper3dLayoutV21='true';
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
