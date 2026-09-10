const STYLE_ID='nn-travel-hyper3d-hd-v23';
const HD_HERO_URL='https://assets.science.nasa.gov/dynamicimage/assets/science/esd/climate/2023/12/ImageWall5_1920x1200-80.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1200&w=1920';

const CSS=`
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-routes>.nn-swap{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  pointer-events:none!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-art[data-hd-hero="true"]{
  right:-1%!important;
  top:0!important;
  width:58%!important;
  height:100%!important;
  object-fit:cover!important;
  object-position:center center!important;
  image-rendering:auto!important;
  opacity:.98!important;
  filter:saturate(1.08) contrast(1.07) brightness(.93)!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero::after{
  content:"";
  position:absolute;
  z-index:3;
  top:0;
  right:0;
  width:60%;
  height:100%;
  pointer-events:none;
  background:linear-gradient(90deg,rgba(3,19,34,.76) 0%,rgba(3,19,34,.18) 24%,rgba(3,19,34,.02) 58%,rgba(3,19,34,.12) 100%);
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal{
  position:absolute;
  z-index:6;
  top:9px;
  right:7px;
  width:39%;
  display:grid;
  justify-items:end;
  gap:5px;
  pointer-events:none;
  text-align:right;
  text-shadow:0 2px 7px rgba(0,0,0,.72);
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal b{
  display:inline-flex;
  align-items:center;
  gap:5px;
  min-height:24px;
  padding:4px 8px;
  border:1px solid rgba(116,239,255,.48);
  border-radius:10px;
  color:#e9fbff;
  background:linear-gradient(145deg,rgba(7,60,91,.88),rgba(3,27,48,.82));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 10px rgba(0,0,0,.32),0 0 12px rgba(46,220,255,.16);
  font-size:9px;
  line-height:1;
  letter-spacing:.08em;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal b::before{
  content:"";
  width:7px;
  height:7px;
  border-radius:50%;
  background:#5aff9f;
  box-shadow:0 0 8px rgba(90,255,159,.9);
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal span{
  color:#d7eef8;
  font-size:8.5px;
  line-height:1.32;
  font-weight:760;
  letter-spacing:.015em;
}
@media(max-width:390px){
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal{top:7px;right:5px;width:38%;gap:4px}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal b{min-height:21px;padding:3px 6px;font-size:8px}
  html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-hero-hd-signal span{font-size:7.5px}
}
`;

function ensureSignal(hero){
  if(!(hero instanceof HTMLElement)||hero.querySelector('.nn-hero-hd-signal')) return;
  const signal=document.createElement('div');
  signal.className='nn-hero-hd-signal';
  signal.setAttribute('aria-hidden','true');
  signal.innerHTML='<b>LIVE API</b><span>Real Data.<br>Real Journeys.</span>';
  hero.appendChild(signal);
}

function upgradeHero(root){
  if(!(root instanceof HTMLElement)) return;
  const hero=root.querySelector('.nn-hero');
  const art=hero?.querySelector('.nn-hero-art');
  if(!(hero instanceof HTMLElement)||!(art instanceof HTMLImageElement)) return;
  ensureSignal(hero);
  if(root.dataset.hdHeroSource==='true'){
    art.dataset.hdHero='true';
    return;
  }
  if(art.dataset.hdHeroProbe==='true') return;
  art.dataset.hdHeroProbe='true';
  const probe=new Image();
  probe.decoding='async';
  probe.onload=()=>{
    art.src=HD_HERO_URL;
    art.alt='High definition Earth view';
    art.dataset.hdHero='true';
    art.dataset.hdWidth=String(probe.naturalWidth||0);
    art.dataset.hdHeight=String(probe.naturalHeight||0);
    art.dataset.ready='true';
    root.dataset.hdHeroSource='true';
  };
  probe.onerror=()=>{
    art.dataset.hdHero='fallback';
    root.dataset.hdHeroSource='fallback';
  };
  probe.src=HD_HERO_URL;
}

function install(){
  let style=document.getElementById(STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=CSS;
    document.head.appendChild(style);
  }
  document.querySelectorAll('.nn-travel-v19').forEach(root=>{
    root.dataset.hyper3dHdV23='true';
    upgradeHero(root);
  });
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(install,500);
setTimeout(install,1400);
