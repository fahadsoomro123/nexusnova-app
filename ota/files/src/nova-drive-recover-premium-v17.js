import { recoverLegacyDriveTrackState } from './core/drive-track-persistence.js';

let inFlight=false,resetTimer=0;
const $=(s,r=document)=>r.querySelector(s);

function ensureStyle(){
  if($('#nxrec17-style'))return;
  const s=document.createElement('style');
  s.id='nxrec17-style';
  s.textContent=`
  #nxgold14 .nxg-actions{grid-template-columns:1fr 1fr!important;gap:12px!important;padding:7px 7px 9px!important;align-items:center!important}
  #nxgold14 .nxg-actions>[data-action="drive"]{display:none!important}
  #nxgold14 .nxg-actions .nxg-ghost{position:relative;height:48px!important;border-radius:16px!important;border:1px solid rgba(255,225,88,.34)!important;background:linear-gradient(180deg,rgba(31,37,31,.96),rgba(8,13,11,.98))!important;color:#fff2a4!important;font-size:10px!important;font-weight:950!important;letter-spacing:.055em!important;text-transform:uppercase!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -8px 16px rgba(0,0,0,.28),0 9px 20px rgba(0,0,0,.24),0 0 0 1px rgba(255,215,38,.04)!important;overflow:hidden!important}
  #nxgold14 .nxg-actions .nxg-ghost:before{display:inline-grid;place-items:center;width:22px;height:22px;margin-right:7px;border-radius:8px;border:1px solid rgba(255,225,88,.28);background:linear-gradient(145deg,rgba(255,239,140,.14),rgba(255,196,0,.035));color:#ffe45c;font-size:13px;vertical-align:middle;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  #nxgold14 [data-action="history"]:before{content:"⌁"}
  #nxgold14 [data-action="recover"]:before{content:"↻"}
  #nxgold14 .nxg-actions .nxg-ghost:active{transform:translateY(1px);filter:brightness(1.08)}
  #nxgold14 [data-action="recover"][aria-busy="true"]{color:#59f4dd!important;border-color:rgba(89,244,221,.36)!important}
  #nxgold14 [data-action="recover"][data-result="ok"]{color:#dfffcf!important;border-color:rgba(144,255,97,.38)!important}
  #nxgold14 [data-action="recover"][data-result="empty"]{color:#ffd98b!important}
  #nxgold14 [data-action="recover"][data-result="error"]{color:#ff9d9d!important;border-color:rgba(255,109,109,.35)!important}
  #nxgold14 .nxrec17-toast{position:absolute;z-index:120;left:50%;bottom:88px;transform:translateX(-50%);width:min(88%,420px);padding:11px 14px;border-radius:16px;border:1px solid rgba(255,225,88,.25);background:linear-gradient(180deg,rgba(20,27,23,.97),rgba(6,10,9,.98));box-shadow:0 16px 34px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08);text-align:center;color:#f6f3dc;font-size:10px;font-weight:850;letter-spacing:.02em;pointer-events:none}
  #nxgold14 .nxrec17-toast.ok{border-color:rgba(89,244,221,.3);color:#bffcf2}
  #nxgold14 .nxrec17-toast.error{border-color:rgba(255,109,109,.35);color:#ffb1b1}
  `;
  document.head.appendChild(s);
}

function toast(message,type=''){
  const root=$('#nxgold14');if(!root)return;
  let t=$('.nxrec17-toast',root);
  if(!t){t=document.createElement('div');t.className='nxrec17-toast';root.appendChild(t)}
  t.className=`nxrec17-toast${type?` ${type}`:''}`;
  t.textContent=message;
  clearTimeout(Number(t.dataset.timer)||0);
  const timer=setTimeout(()=>t?.remove(),4800);
  t.dataset.timer=String(timer);
}

function setButton(button,label,state=''){
  clearTimeout(resetTimer);
  button.textContent=label;
  button.dataset.result=state;
  button.setAttribute('aria-busy',inFlight?'true':'false');
  button.disabled=inFlight;
}

function totalData(store){
  const trips=Array.isArray(store?.trips)?store.trips.length:0;
  const days=store?.days&&typeof store.days==='object'?Object.keys(store.days).length:0;
  return {trips,days,has:trips>0||days>0};
}

function showRecoveredHistory(){
  window.NexusNovaGold14Filter='All';
  const root=$('#nxgold14');
  root?.querySelectorAll('.nxg-filter').forEach(b=>b.classList.toggle('on',b.dataset.filter==='All'));
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
  setTimeout(()=>window.NexusNovaGoldV14?.show?.('history'),80);
}

async function recover(button){
  if(inFlight)return;
  inFlight=true;
  setButton(button,'RECOVERING…');
  toast('Checking account cloud + phone backup + old Drive profile…');
  try{
    const result=await recoverLegacyDriveTrackState();
    const info=totalData(result?.store);
    if(info.has){
      showRecoveredHistory();
      const source=result?.legacyUidRecovered===true
        ? (result?.cloud===true?'OLD PHONE PROFILE + CLOUD':'OLD PHONE PROFILE')
        : (result?.cloud===true?'ACCOUNT BACKUP + PHONE':'PHONE BACKUP');
      setButton(button,`RESTORED ${info.trips} TRIP${info.trips===1?'':'S'}`,'ok');
      toast(`${source}: ${info.trips} trip record${info.trips===1?'':'s'} restored. History view opened.`,'ok');
    }else if(result?.legacyUidAmbiguous===true){
      setButton(button,'MULTIPLE BACKUPS','empty');
      toast(`Phone me ${result.legacyUidCandidates} old Drive profiles mile. Safety ke liye unka data auto-merge nahi kiya.`);
    }else if(result?.cloud===true){
      setButton(button,'NO SAVED TRIPS','empty');
      toast('Cloud connected. Current account, phone backup aur old Drive profile scan me saved trips nahi mili.');
    }else{
      setButton(button,'NO BACKUP FOUND','empty');
      toast('Is phone, old Drive profile ya account backup me recoverable history nahi mili.');
    }
  }catch(error){
    console.warn('[NexusNova Drive Recover V17]',error);
    setButton(button,'RECOVERY FAILED','error');
    toast(String(error?.message||'Recovery request failed.').slice(0,170),'error');
  }finally{
    inFlight=false;
    button.disabled=false;
    button.setAttribute('aria-busy','false');
    resetTimer=setTimeout(()=>{if(button?.isConnected){button.textContent='Recover';button.dataset.result=''}},5600);
  }
}

ensureStyle();
document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#nxgold14 [data-action="recover"]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  recover(button);
},true);
