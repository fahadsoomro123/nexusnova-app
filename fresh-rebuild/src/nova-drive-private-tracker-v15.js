import {
  createNovaVehiclePairing,
  loadNovaVehicleDashboard,
  revokeNovaVehicle
} from './core/nova-vehicle-premium-store.js';

const ROOT_ID='nxgold14';
let mounted=false,dashboard=null,busy=false,pairCode='';
const $=(s,r=document)=>r.querySelector(s);

function vehicle(){
  const list=Array.isArray(dashboard?.vehicles)?dashboard.vehicles:[];
  return list.find(v=>v?.trackerBound)||list[0]||null;
}
function ensureStyle(){
  if($('#nxpt15-style'))return;
  const s=document.createElement('style');s.id='nxpt15-style';s.textContent=`
  #${ROOT_ID} .nxpt15-lock{position:absolute;inset:0;z-index:40;display:grid;place-items:center;padding:24px;background:rgba(2,7,8,.94);backdrop-filter:blur(12px)}
  #${ROOT_ID} .nxpt15-lock[hidden]{display:none!important}
  #${ROOT_ID} .nxpt15-card{width:min(92%,420px);padding:22px;border-radius:22px;border:1px solid rgba(255,216,38,.24);background:linear-gradient(180deg,#111815,#080d0b);text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.42)}
  #${ROOT_ID} .nxpt15-card small{display:block;color:#59f4dd;font-size:9px;font-weight:900;letter-spacing:.12em}#${ROOT_ID} .nxpt15-card b{display:block;margin-top:8px;font-size:18px}#${ROOT_ID} .nxpt15-card p{margin:8px 0 0;color:#899590;font-size:11px;line-height:1.45}
  #${ROOT_ID} .nxpt15-actions{position:absolute;z-index:18;left:12px;right:12px;bottom:58px;display:flex;justify-content:center;gap:8px;pointer-events:none}
  #${ROOT_ID} .nxpt15-actions button{pointer-events:auto;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,216,38,.34);background:rgba(6,10,9,.92);color:#ffe45d;font-size:9px;font-weight:950;letter-spacing:.04em}
  #${ROOT_ID} .nxpt15-actions button.danger{border-color:rgba(255,106,106,.34);color:#ff9a9a}
  #${ROOT_ID} .nxpt15-modal{position:absolute;inset:0;z-index:80;display:none;place-items:center;padding:20px;background:rgba(2,6,5,.9);backdrop-filter:blur(12px)}#${ROOT_ID} .nxpt15-modal.on{display:grid}
  #${ROOT_ID} .nxpt15-sheet{width:min(92vw,420px);padding:20px;border-radius:22px;background:linear-gradient(180deg,#111815,#080d0b);border:1px solid rgba(255,255,255,.12)}#${ROOT_ID} .nxpt15-sheet h3{margin:0;font-size:17px}#${ROOT_ID} .nxpt15-sheet p{color:#899590;font-size:10px;line-height:1.45}#${ROOT_ID} .nxpt15-code{display:block;margin:14px 0;padding:14px;border-radius:15px;background:#050907;border:1px solid rgba(89,244,221,.24);color:#59f4dd;text-align:center;font-size:24px;letter-spacing:.16em}
  #${ROOT_ID} .nxpt15-sheet button{width:100%;height:42px;margin-top:7px;border-radius:999px;border:1px solid rgba(255,249,173,.55);background:linear-gradient(180deg,#fff4a0,#ffe027 28%,#d99d00);color:#171100;font-weight:950}#${ROOT_ID} .nxpt15-sheet button.ghost{border:0;background:none;color:#919b97}
  `;document.head.appendChild(s);
}
function trackerScreen(){return $(`#${ROOT_ID} [data-screen="tracking"]`)}
function ensureUi(){
  const screen=trackerScreen();if(!screen)return null;ensureStyle();
  let lock=$('.nxpt15-lock',screen);if(!lock){lock=document.createElement('div');lock.className='nxpt15-lock';lock.innerHTML='<div class="nxpt15-card"><small>PRIVATE TRACKER</small><b>Owner / Subscription Access Only</b><p>Vehicle Tracking is private. Access is granted only to entitled accounts.</p></div>';screen.appendChild(lock)}
  let actions=$('.nxpt15-actions',screen);if(!actions){actions=document.createElement('div');actions.className='nxpt15-actions';actions.innerHTML='<button type="button" data-nxpt-connect>CONNECT TRACKER</button><button type="button" class="danger" data-nxpt-disconnect hidden>DISCONNECT TRACKER</button>';screen.appendChild(actions)}
  let modal=$('.nxpt15-modal',screen);if(!modal){modal=document.createElement('div');modal.className='nxpt15-modal';modal.innerHTML='<div class="nxpt15-sheet"><h3 data-nxpt-title>Pair Tracker</h3><p data-nxpt-copy></p><strong class="nxpt15-code" data-nxpt-code hidden>—</strong><button type="button" data-nxpt-primary>CONTINUE</button><button type="button" class="ghost" data-nxpt-cancel>CANCEL</button></div>';screen.appendChild(modal)}
  return{screen,lock,actions,modal};
}
function setOwnerLabel(text){const el=$(`#${ROOT_ID} [data-owner]`);if(el)el.textContent=text}
function paint(){
  const ui=ensureUi();if(!ui)return;
  const entitled=dashboard?.entitled===true,v=vehicle(),paired=!!v?.trackerBound;
  ui.lock.hidden=entitled;
  ui.actions.hidden=!entitled;
  const c=$('[data-nxpt-connect]',ui.actions),d=$('[data-nxpt-disconnect]',ui.actions);
  if(c){c.hidden=paired;c.disabled=busy;c.textContent=paired?'TRACKER CONNECTED':'CONNECT TRACKER'}
  if(d){d.hidden=!paired;d.disabled=busy}
  if(!entitled)setOwnerLabel('LOCKED');else if(!paired)setOwnerLabel('UNPAIRED');else setOwnerLabel('OWNER');
}
function errorText(e){return String(e?.message||'Tracker request failed. Please try again.').slice(0,220)}
function showError(title,e){const ui=ensureUi();if(!ui)return;const m=ui.modal;$('[data-nxpt-title]',m).textContent=title;$('[data-nxpt-copy]',m).textContent=errorText(e);$('[data-nxpt-code]',m).hidden=true;$('[data-nxpt-primary]',m).textContent='OK';m.dataset.mode='error';m.classList.add('on')}
async function refresh(silent=false){
  try{dashboard=await loadNovaVehicleDashboard();paint()}
  catch(e){dashboard={entitled:false,vehicles:[]};paint();if(!silent)showError('Tracker unavailable',e)}
}
function closeModal(){const m=$(`#${ROOT_ID} .nxpt15-modal`);m?.classList.remove('on');pairCode=''}
function openPairResult(code){
  const m=$(`#${ROOT_ID} .nxpt15-modal`);if(!m)return;pairCode=String(code||'');$('[data-nxpt-title]',m).textContent='Pair NexusNova Tracker';$('[data-nxpt-copy]',m).textContent='Ye one-time code hidden tracker device me enter karo. Code expire hone se pehle pairing complete karo.';const ce=$('[data-nxpt-code]',m);ce.hidden=false;ce.textContent=pairCode;$('[data-nxpt-primary]',m).textContent='DONE';m.dataset.mode='pair-done';m.classList.add('on')
}
function openDisconnect(){
  const m=$(`#${ROOT_ID} .nxpt15-modal`);if(!m)return;$('[data-nxpt-title]',m).textContent='Disconnect Tracker?';$('[data-nxpt-copy]',m).textContent='Ye sirf aapki currently paired vehicle ko disconnect karega. Dobara use karne ke liye fresh pairing code chahiye hoga.';$('[data-nxpt-code]',m).hidden=true;$('[data-nxpt-primary]',m).textContent='CONFIRM DISCONNECT';m.dataset.mode='disconnect';m.classList.add('on')
}
function bind(){
  const ui=ensureUi();if(!ui||ui.screen.dataset.nxpt15Bound==='1')return;ui.screen.dataset.nxpt15Bound='1';
  $('[data-nxpt-connect]',ui.actions)?.addEventListener('click',async()=>{if(busy)return;busy=true;paint();try{const r=await createNovaVehiclePairing('NexusNova Vehicle');openPairResult(r.pairingCode);await refresh(true)}catch(e){showError('Could not connect tracker',e)}finally{busy=false;paint()}});
  $('[data-nxpt-disconnect]',ui.actions)?.addEventListener('click',openDisconnect);
  $('[data-nxpt-cancel]',ui.modal)?.addEventListener('click',closeModal);
  $('[data-nxpt-primary]',ui.modal)?.addEventListener('click',async()=>{const mode=ui.modal.dataset.mode;if(mode==='pair-done'||mode==='error'){closeModal();return}if(mode!=='disconnect'||busy)return;const v=vehicle();if(!v?.trackerBound||!v?.vehicleId){closeModal();return}busy=true;paint();try{await revokeNovaVehicle(v.vehicleId);closeModal();await refresh(true)}catch(e){showError('Could not disconnect tracker',e)}finally{busy=false;paint()}});
}
function mount(){if(mounted||!$(`#${ROOT_ID}`))return;mounted=true;bind();refresh(false)}
function unmount(){mounted=false;dashboard=null;busy=false;pairCode=''}

const gold=window.NexusNovaGoldV14;
if(gold){
  const baseMount=gold.mount.bind(gold),baseUnmount=gold.unmount.bind(gold);
  gold.mount=(opts={})=>{const r=baseMount(opts);queueMicrotask(mount);return r};
  gold.unmount=()=>{unmount();return baseUnmount()};
}
window.addEventListener('pageshow',()=>{if($(`#${ROOT_ID}`)){mounted=false;mount()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&mounted)refresh(true)});
mount();
