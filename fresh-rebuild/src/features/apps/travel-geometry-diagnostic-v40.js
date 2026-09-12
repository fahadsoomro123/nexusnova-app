// TEMPORARY PHONE-VISIBLE DIAGNOSTIC ONLY.
// Read-only geometry probe. It must never block touch or react to its own DOM writes.
const PANEL_ID='nn-travel-geometry-diagnostic-v40';
const ROOT_SELECTOR='.nn-travel-v19';
const BIG_GAP_PX=80;
const REFRESH_MS=800;

const OUTLINES=[
  '#ff5252','#ff9f43','#ffe66d','#5cffb0',
  '#4ddcff','#6c8cff','#b67cff','#ff6bd6'
];

let lastPanelText='';
let rafQueued=false;

function round(value){
  return Number.isFinite(value)?Math.round(value):null;
}

function visible(el){
  if(!(el instanceof HTMLElement)) return false;
  const r=el.getBoundingClientRect();
  const s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
}

function ensurePanel(){
  let panel=document.getElementById(PANEL_ID);
  if(panel) return panel;
  panel=document.createElement('pre');
  panel.id=PANEL_ID;
  panel.setAttribute('aria-hidden','true');
  panel.style.cssText=[
    'position:fixed','left:4px','top:4px','z-index:2147483647',
    'margin:0','max-width:calc(100vw - 8px)','max-height:72vh','overflow:auto',
    'box-sizing:border-box','padding:7px 8px','border:1px solid #27f58b',
    'border-radius:7px','background:rgba(0,0,0,.92)','color:#27f58b',
    'font:8px/1.32 monospace','letter-spacing:-.02em','white-space:pre-wrap',
    'pointer-events:none','touch-action:none','user-select:none',
    'box-shadow:0 8px 24px rgba(0,0,0,.55)'
  ].join(';');
  document.body.appendChild(panel);
  return panel;
}

function clearPanel(){
  const panel=document.getElementById(PANEL_ID);
  if(panel) panel.remove();
  lastPanelText='';
}

function clearOutlines(){
  document.querySelectorAll('[data-nn-v40-diag-outline]').forEach(el=>{
    if(el instanceof HTMLElement){
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
      delete el.dataset.nnV40DiagOutline;
    }
  });
}

function item(label,el){
  if(!(el instanceof HTMLElement)) return {label,el:null};
  const r=el.getBoundingClientRect();
  const s=getComputedStyle(el);
  return {
    label,
    el,
    top:round(r.top),
    bottom:round(r.bottom),
    height:round(r.height),
    position:s.position,
    overflowY:s.overflowY,
    cssHeight:s.height,
    minHeight:s.minHeight,
    maxHeight:s.maxHeight,
    display:s.display
  };
}

function paint(){
  rafQueued=false;
  const root=document.querySelector(ROOT_SELECTOR);
  if(!(root instanceof HTMLElement)||!visible(root)){
    clearOutlines();
    clearPanel();
    return;
  }

  const stage=document.querySelector('#nx-app > .nx-stage');
  const screen=root.closest('.nx-screen');
  const mount=root.closest('[data-app-mount]');
  const frame=root.querySelector(':scope > .nn-travel-frame')||root.querySelector('.nn-travel-frame');
  const travelStage=root.querySelector('.nn-travel-stage');
  const flightPanel=root.querySelector('.nn-flight-panel:not([hidden])');
  const card=flightPanel?.querySelector(':scope > .nn-search-card')||root.querySelector('.nn-search-card');
  const dock=document.querySelector('#nx-app > .nx-dock');
  const dockRect=dock instanceof HTMLElement?dock.getBoundingClientRect():null;
  const dockTop=dockRect?round(dockRect.top):null;

  const chain=[
    item('#nx-stage',stage),
    item('.nx-screen',screen),
    item('[data-app-mount]',mount),
    item('.nn-travel-v19',root),
    item('.nn-travel-frame',frame),
    item('.nn-travel-stage',travelStage),
    item('.nn-flight-panel',flightPanel),
    item('.nn-search-card',card)
  ];

  clearOutlines();
  chain.forEach((entry,index)=>{
    if(!(entry.el instanceof HTMLElement)) return;
    entry.el.dataset.nnV40DiagOutline='true';
    entry.el.style.setProperty('outline',`1px solid ${OUTLINES[index]}`,'important');
    entry.el.style.setProperty('outline-offset',`${Math.min(index,3)}px`,'important');
  });

  let firstBig=-1;
  let previousGap=null;
  chain.forEach((entry,index)=>{
    if(entry.bottom==null||dockTop==null) return;
    const gap=dockTop-entry.bottom;
    entry.gap=gap;
    const jump=previousGap==null?0:gap-previousGap;
    entry.jump=jump;
    if(firstBig<0&&gap>=BIG_GAP_PX&&(previousGap==null||previousGap<BIG_GAP_PX||jump>=BIG_GAP_PX)) firstBig=index;
    previousGap=gap;
  });

  const vv=window.visualViewport;
  const lines=[
    'TRAVEL GEOMETRY V40 SAFE — READ ONLY',
    `innerH:${round(window.innerHeight)} vvH:${round(vv?.height)} vvTop:${round(vv?.offsetTop)||0}`,
    `dockTop:${dockTop??'NA'} dockBottom:${dockRect?round(dockRect.bottom):'NA'}`,
    `owner:${window.NexusNovaTravelLayoutOwner||'NA'} physical:${window.NexusNovaTravelPhysicalLayoutOwner||'NA'} proof:${root.dataset.otaProof||'NA'}`,
    ''
  ];

  chain.forEach((entry,index)=>{
    if(!entry.el){
      lines.push(`${index+1}. ${entry.label}  NOT FOUND`,'');
      return;
    }
    const marker=index===firstBig?'  <<< FIRST BIG GAP':'';
    lines.push(
      `${index+1}. ${entry.label}${marker}`,
      ` t:${entry.top} b:${entry.bottom} h:${entry.height} gap:${entry.gap??'NA'} jump:${entry.jump??'NA'}`,
      ` pos:${entry.position} disp:${entry.display} ovY:${entry.overflowY}`,
      ` cssH:${entry.cssHeight} min:${entry.minHeight} max:${entry.maxHeight}`,
      ''
    );
  });

  if(firstBig>=0) lines.push(`CULPRIT CANDIDATE: ${chain[firstBig].label}`);
  else lines.push('No >=80px first-gap jump detected in measured chain.');

  const nextText=lines.join('\n');
  const panel=ensurePanel();
  if(nextText!==lastPanelText){
    panel.textContent=nextText;
    lastPanelText=nextText;
  }
  root.dataset.v40DiagCandidate=firstBig>=0?chain[firstBig].label:'none';
  root.dataset.v40DiagDockTop=String(dockTop??'');
}

function schedulePaint(){
  if(rafQueued) return;
  rafQueued=true;
  requestAnimationFrame(paint);
}

schedulePaint();
const timer=setInterval(schedulePaint,REFRESH_MS);
window.addEventListener('resize',schedulePaint);
window.addEventListener('orientationchange',schedulePaint);
window.visualViewport?.addEventListener('resize',schedulePaint);
window.visualViewport?.addEventListener('scroll',schedulePaint);
window.addEventListener('pagehide',()=>{
  clearInterval(timer);
  clearOutlines();
  clearPanel();
},{once:true});
