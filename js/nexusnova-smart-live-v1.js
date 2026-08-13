/* NexusNova Smart Live v1
   Connects Smart Hub camera and daily brief to real app/AI flows. */
(() => {
  'use strict';
  if (window.__nxSmartLiveV1) return;
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
    // This runs directly inside the user click handler so mobile browsers can
    // preserve the camera/file-picker user gesture.
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
    const events=readList('events')
      .filter(item=>Number(item?.when)>=now)
      .sort((a,b)=>Number(a.when)-Number(b.when))
      .slice(0,5);
    const reminders=readList('reminders')
      .filter(item=>!item?.fired && Number(item?.when)>=now)
      .sort((a,b)=>Number(a.when)-Number(b.when))
      .slice(0,5);
    const expenses=readList('expenses');
    const expenseTotal=expenses.reduce((sum,item)=>sum+(Number(item?.amount)||0),0);
    const habits=readList('habits').slice(0,8);
    const balance=String($('balance')?.textContent||'unavailable').trim();
    const mining=String($('timer')?.textContent||'unavailable').trim();

    const eventText=events.length?events.map(x=>`${x.title} @ ${new Date(Number(x.when)).toLocaleString()}`).join('; '):'none';
    const reminderText=reminders.length?reminders.map(x=>`${x.text} @ ${new Date(Number(x.when)).toLocaleString()}`).join('; '):'none';
    const habitText=habits.length?habits.map(x=>`${x.name}: ${x.days||0} check-ins`).join('; '):'none';

    return `Build my concise NexusNova daily brief in Roman Urdu. Use only this real app data and do not invent missing information.\n`+
      `NVX visible balance: ${balance}\n`+
      `Mining timer/status: ${mining}\n`+
      `Upcoming events: ${eventText}\n`+
      `Upcoming reminders: ${reminderText}\n`+
      `Logged expense total: ${expenseTotal}\n`+
      `Habits: ${habitText}\n`+
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

  function install() {
    if(!$('tab-smart')) return;
    claim('Open Camera','nxSmartCameraLive',openCamera);
    claim('Build Brief','nxSmartBriefLive',buildBrief);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1200),{once:true});
  else setTimeout(install,1200);
  [2200,4000,7000].forEach(ms=>setTimeout(install,ms));
})();