/* NexusNova ALL APPS Order + Back Control Guard v5.1 - loop safe + approved compact polish */
(() => {
  'use strict';
  const ORDER=['TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'];
  let repairing=false;
  let scheduled=false;

  function installAllAppsPolish(){
    if(document.getElementById('nxAllAppsPolishV1'))return;
    const style=document.createElement('style');
    style.id='nxAllAppsPolishV1';
    style.textContent=`
      /* Restored approved 2026-08-15 launcher polish: compact icons + smooth touch. */
      #moreMenu .more-inner{
        scroll-behavior:smooth!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior:contain;
      }
      #moreMenu .more-item{
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;
        transform:translateZ(0);
        backface-visibility:hidden;
        transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background-color .16s ease,box-shadow .16s ease,opacity .16s ease!important;
      }
      #moreMenu .more-item:active{transform:translateZ(0) scale(.965)}
      #moreMenu .more-item .mi-icon{
        width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;
        margin-left:auto!important;margin-right:auto!important;
        transform:translateZ(0);backface-visibility:hidden;
        transition:transform .18s cubic-bezier(.2,.8,.2,1),filter .18s ease,box-shadow .18s ease!important;
      }
      #moreMenu .more-item .mi-icon svg{max-width:72%!important;max-height:72%!important}
      #moreMenu .more-item:active .mi-icon{transform:translateZ(0) scale(.94)}
      @media(max-width:420px){
        #moreMenu .more-item .mi-icon{width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important}
      }
      @media(prefers-reduced-motion:reduce){#moreMenu .more-item,#moreMenu .more-item .mi-icon{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function labelOf(button){
    if(!button)return'';
    const spans=button.querySelectorAll(':scope > span');
    const value=spans.length?spans[spans.length-1].textContent:button.textContent;
    return String(value||'').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function targetOf(button){
    if(!button)return'';
    if(button.dataset?.nxmega)return button.dataset.nxmega;
    if(button.dataset?.finalBible)return'bible';
    const match=String(button.getAttribute('onclick')||'').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1]||'';
  }

  function enforceOrder(){
    const inner=document.querySelector('#moreMenu .more-inner');
    if(!inner)return;
    const buttons=Array.from(inner.children).filter(el=>el.classList?.contains('more-item'));
    const rank=new Map(ORDER.map((label,index)=>[label,index]));
    const desired=[...buttons].sort((a,b)=>{
      const ar=rank.has(labelOf(a))?rank.get(labelOf(a)):ORDER.length;
      const br=rank.has(labelOf(b))?rank.get(labelOf(b)):ORDER.length;
      return ar-br;
    });
    if(buttons.length===desired.length&&buttons.every((button,index)=>button===desired[index]))return;
    desired.forEach(button=>inner.appendChild(button));
  }

  function addBack(tab){
    /* Settings is a root destination in the approved Mine + Nova Hub layout.
       Do not inject reader/sub-app Back chrome into it. */
    if(!tab||tab.id==='tab-tools'||tab.id==='tab-about'||tab.querySelector(':scope > .nx-allapps-back'))return;
    const bar=document.createElement('div');
    bar.className='nx-allapps-back';
    bar.innerHTML='<button class="tool-btn" type="button" data-nx-back-allapps>← Back to ALL APPS</button>';
    bar.querySelector('button').addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      window.nexusBackToAllApps?.();
    });
    tab.insertBefore(bar,tab.firstChild);
  }

  function ensureBackControls(){
    const targets=new Set(Array.from(document.querySelectorAll('#moreMenu .more-item')).map(targetOf).filter(Boolean));
    targets.add('bible');
    targets.forEach(name=>addBack(document.getElementById('tab-'+name)));
  }

  function repair(){
    if(repairing)return;
    repairing=true;
    try{installAllAppsPolish();enforceOrder();ensureBackControls();}finally{repairing=false;}
  }

  function scheduleRepair(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;repair();});
  }

  function install(){
    installAllAppsPolish();
    repair();
    const menu=document.querySelector('#moreMenu .more-inner');
    if(menu)new MutationObserver(scheduleRepair).observe(menu,{childList:true});
    const main=document.querySelector('main.main')||document.querySelector('main');
    if(main)new MutationObserver(scheduleRepair).observe(main,{childList:true,subtree:true});
    [250,800,1800,4000,8000].forEach(ms=>setTimeout(repair,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();