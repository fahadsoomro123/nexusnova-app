import {subscribe,getState,executeCommand,advance} from './state.js';
const $=s=>document.querySelector(s);
const stateLabel={IDLE:'READY',PLANNING:'PLANNING',IMPLEMENTING:'IMPLEMENTING',BUILDING:'BUILDING',TESTING:'TESTING',FAILED:'FAILED',REPAIRING:'REPAIRING',RETESTING:'RETESTING',VERIFYING:'VERIFYING',VERIFIED:'VERIFIED',DELIVERED:'DELIVERED'};
const logs=[['22:14:03','PLAN','Mission accepted; execution policy resolved.'],['22:14:08','BUILD','Target queued. Waiting for build evidence.'],['22:14:19','TEST','Failure states are explicit; recovery is not inferred.']];
function paint(s){
  $('#state').textContent=stateLabel[s.state]||s.state;
  $('#elapsed').textContent=`${String(Math.floor(s.elapsed/60)).padStart(2,'0')}:${String(s.elapsed%60).padStart(2,'0')}`;
  document.querySelectorAll('.node').forEach((n,i)=>{n.classList.toggle('current',i===Math.min(Math.max(['PLANNING','IMPLEMENTING','BUILDING','TESTING','FAILED','REPAIRING','RETESTING','VERIFYING','VERIFIED','DELIVERED'].indexOf(s.state),0),6));});
  const feed=$('#feed');const source=s.logs.length?s.logs.slice(0,8):logs;feed.innerHTML=source.map(x=>`<p><time>${x[0]}</time><em>${x[1]}</em><span>${x[2]}</span></p>`).join('');
}
$('#run').addEventListener('click',()=>executeCommand($('#cmd').value||'Build APK, test, repair failures, verify artifact'));
$('#cmd').addEventListener('keydown',e=>{if(e.key==='Enter')executeCommand($('#cmd').value)});
document.querySelectorAll('.command-hints button').forEach(b=>b.addEventListener('click',()=>{$('#cmd').value=b.textContent;executeCommand(b.textContent)}));
$('#advance').addEventListener('click',advance);
subscribe(paint);paint(getState());
