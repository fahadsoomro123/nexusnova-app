/* NexusNova ALL APPS Order + Back Control Guard v6 - legacy compatibility */
(() => {
  'use strict';
  const ORDER=['TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'];
  let repairing=false;
  let scheduled=false;

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
    const alreadyCorrect=buttons.length===desired.length&&buttons.every((button,index)=>button===desired[index]);
    if(alreadyCorrect)return;
    desired.forEach(button=>inner.appendChild(button));
  }

  function addBack(tab){
    // Settings is a root destination in the approved Mine + Nova Hub layout.
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
    try{enforceOrder();ensureBackControls();}finally{repairing=false;}
  }

  function scheduleRepair(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;repair();});
  }

  function install(){
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