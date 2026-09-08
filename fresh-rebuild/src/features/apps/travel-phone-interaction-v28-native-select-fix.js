const STYLE_ID='nn-travel-v28-native-select-fix';
if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-control.nn-class-control-v28 select[data-flight-cabin]{display:none!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;max-width:0!important;max-height:0!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}`;
  document.head.appendChild(style);
}

function positionMenu(root,trigger,menu){
  const rr=root.getBoundingClientRect();
  const control=trigger.closest('.nn-control');
  if(!(control instanceof HTMLElement)) return;
  const cr=control.getBoundingClientRect();
  const width=Math.min(282,Math.max(230,rr.width-28));
  menu.style.width=`${width}px`;
  let left=cr.right-rr.left-width;
  left=Math.max(12,Math.min(left,rr.width-width-12));
  let top=cr.bottom-rr.top+8;
  const menuH=Math.max(190,menu.getBoundingClientRect().height||0);
  const maxTop=Math.max(12,rr.height-menuH-12);
  if(top>maxTop) top=Math.max(12,cr.top-rr.top-menuH-8);
  menu.style.left=`${Math.round(left)}px`;
  menu.style.top=`${Math.round(top)}px`;
}

function bind(root){
  root.dataset.nativeClassSelectFixV28='true';
  const trigger=root.querySelector('.nn-class-trigger-v28');
  const menu=root.querySelector('.nn-class-menu-v28');
  if(!(trigger instanceof HTMLButtonElement)||!(menu instanceof HTMLElement)||trigger.dataset.v28Isolated==='true') return;
  trigger.dataset.v28Isolated='true';
  trigger.addEventListener('pointerdown',event=>{
    event.preventDefault();
    event.stopPropagation();
  },true);
  trigger.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    menu.dataset.open='true';
    trigger.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>positionMenu(root,trigger,menu));
  },true);
}

function scan(){document.querySelectorAll('.nn-travel-v19').forEach(bind)}
scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
