/* NexusNova Smart Live v3.4
   Connects Smart Hub camera/daily brief to real AI flows and boots late live modules. */
(() => {
  'use strict';
  if (window.__nxSmartLiveV3) return;
  window.__nxSmartLiveV3 = true;
  window.__nxSmartLiveV2 = true;
  window.__nxSmartLiveV1 = true;

  const $ = id => document.getElementById(id);

  function findButton(label) {
    return Array.from(document.querySelectorAll('#tab-smart button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === label.toLowerCase()
    );
  }

  function claim(label,id,handler) {
    const button=findButton(label);
    if(!button || button.dataset.nxSmartReady==='1') return false;
    button.onclick=null;
    button.id=id;
    button.dataset.nxSmartReady='1';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return true;
  }

  function openAI() {
    if(typeof window.openMoreTab==='function') window.openMoreTab('ai');
    else window.switchTab?.('ai',null);
  }

  function openCamera() {
    openAI();
    const input=$('aiImageInput');
    if(!input) {
      alert('AI image input is not available on this build.');
      return;
    }
    input.click();
  }

  function accountKey(name) {
    const id=String(window.nexusAccountId||'').trim();
    return id ? `nxmega_${name}:${id}` : '';
  }

  function readList(name) {
    const key=accountKey(name);
    if(!key) return [];
    try {
      const value=JSON.parse(localStorage.getItem(key)||'[]');
      return Array.isArray(value)?value:[];
    } catch(_) { return []; }
  }

  function buildBriefPrompt() {
    const now=Date.now();
    const events=readList('events').filter(item=>Number(item?.when)>=now).sort((a,b)=>Number(a.when)-Number(b.when)).slice(0,5);
    const reminders=readList('reminders').filter(item=>!item?.fired && Number(item?.when)>=now).sort((a,b)=>Number(a.when)-Number(b.when)).slice(0,5);
    const expenses=readList('expenses');
    const expenseTotal=expenses.reduce((sum,item)=>sum+(Number(item?.amount)||0),0);
    const habits=readList('habits').slice(0,8);
    const balance=String($('balance')?.textContent||'unavailable').trim();
    const mining=String($('timer')?.textContent||'unavailable').trim();
    const eventText=events.length?events.map(x=>`${x.title} @ ${new Date(Number(x.when)).toLocaleString()}`).join('; '):'none';
    const reminderText=reminders.length?reminders.map(x=>`${x.text} @ ${new Date(Number(x.when)).toLocaleString()}`).join('; '):'none';
    const habitText=habits.length?habits.map(x=>`${x.name}: ${x.days||0} check-ins`).join('; '):'none';
    return `Build my concise NexusNova daily brief in Roman Urdu. Use only this real app data and do not invent missing information.\n`+
      `NVX visible balance: ${balance}\nMining timer/status: ${mining}\nUpcoming events: ${eventText}\n`+
      `Upcoming reminders: ${reminderText}\nLogged expense total: ${expenseTotal}\nHabits: ${habitText}\n`+
      `Give priorities for today and clearly say when weather/news data is not supplied rather than guessing.`;
  }

  function buildBrief() {
    openAI();
    const input=$('aiInput');
    if(!input || typeof window.sendAIMessage!=='function') {
      alert('NexusNova AI is not ready yet. Open AI and try again.');
      return;
    }
    input.value=buildBriefPrompt();
    window.sendAIMessage();
  }

  function loadModule({tab, flag, marker, src, error}) {
    if(tab && !document.getElementById(tab)) return;
    if((flag && window[flag]) || document.querySelector(`script[${marker}]`)) return;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.onerror=()=>console.warn(error);
    document.body.appendChild(script);
  }

  function install() {
    if($('tab-smart')) {
      claim('Open Camera','nxSmartCameraLive',openCamera);
      claim('Build Brief','nxSmartBriefLive',buildBrief);
    }
    loadModule({tab:'tab-mega-documents',marker:'data-nx-documents-live',src:'./js/nexusnova-documents-live-v1.js?v=1',error:'NexusNova Documents live module failed to load.'});
    loadModule({tab:'tab-mega-vault',flag:'__nxFileVaultV1',marker:'data-nx-file-vault',src:'./js/nexusnova-file-vault-v1.js?v=1',error:'NexusNova encrypted File Vault failed to load.'});
    loadModule({tab:'tab-mega-security',flag:'__nxSecurityLockV1',marker:'data-nx-security-lock',src:'./js/nexusnova-security-lock-v1.js?v=1',error:'NexusNova Security App Lock failed to load.'});
    loadModule({tab:'tab-mega-marketplace',flag:'__nxMarketplaceLiveV1',marker:'data-nx-marketplace-live',src:'./js/nexusnova-marketplace-live-v1.js?v=1',error:'NexusNova Marketplace live module failed to load.'});
    loadModule({tab:'tab-mega-orders',flag:'__nxOrdersLiveV1',marker:'data-nx-orders-live',src:'./js/nexusnova-orders-live-v1.js?v=1',error:'NexusNova Orders live module failed to load.'});
    loadModule({tab:'tab-mega-teacher',flag:'__nxTeacherLiveV2',marker:'data-nx-teacher-live',src:'./js/nexusnova-teacher-live-v2.js?v=2',error:'NexusNova Teacher Toolkit live module failed to load.'});
    loadModule({tab:null,flag:'__nxAllAppsSmartSearchV1',marker:'data-nx-allapps-smart-search',src:'./js/nexusnova-allapps-smart-search-v1.js?v=2',error:'NexusNova ALL APPS smart search failed to load.'});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1200),{once:true});
  else setTimeout(install,1200);
  [2200,4000,7000].forEach(ms=>setTimeout(install,ms));
})();