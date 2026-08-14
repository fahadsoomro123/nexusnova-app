/* NexusNova ALL APPS Order + Back Control Guard v4 */
(() => {
  'use strict';
  const ORDER=['TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'];
  let busy=false;
  const labelOf=b=>String(b?.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
  function targetOf(b){if(!b)return'';if(b.dataset?.nxmega)return b.dataset.nxmega;if(b.dataset?.finalBible)return'bible';const m=String(b.getAttribute('onclick')||'').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);return m?.[1]||'';}
  function enforceOrder(){const inner=document.querySelector('#moreMenu .more-inner');if(!inner||busy)return;busy=true;try{const buttons=Array.from(inner.children).filter(e=>e.classList?.contains('more-item'));const map=new Map(buttons.map(b=>[labelOf(b),b]));ORDER.forEach(l=>{const b=map.get(l);if(b)inner.appendChild(b);});buttons.filter(b=>!ORDER.includes(labelOf(b))).forEach(b=>inner.appendChild(b));}finally{busy=false;}}
  function addBack(tab){if(!tab||tab.id==='tab-tools'||tab.querySelector(':scope > .nx-allapps-back'))return;const bar=document.createElement('div');bar.className='nx-allapps-back';bar.innerHTML='<button class="tool-btn" type="button" data-nx-back-allapps>← Back to ALL APPS</button>';bar.querySelector('button').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.nexusBackToAllApps?.();});tab.insertBefore(bar,tab.firstChild);}
  function ensureBackControls(){const buttons=Array.from(document.querySelectorAll('#moreMenu .more-item'));const targets=new Set(buttons.map(targetOf).filter(Boolean));targets.add('bible');targets.forEach(name=>addBack(document.getElementById('tab-'+name)));}
  function repair(){enforceOrder();ensureBackControls();}
  function install(){repair();const menu=document.querySelector('#moreMenu .more-inner');if(menu)new MutationObserver(repair).observe(menu,{childList:true});const main=document.querySelector('main.main')||document.querySelector('main');if(main)new MutationObserver(repair).observe(main,{childList:true,subtree:true});[250,800,1800,4000,8000].forEach(ms=>setTimeout(repair,ms));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();