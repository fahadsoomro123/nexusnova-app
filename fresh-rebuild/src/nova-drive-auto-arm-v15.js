let armed=false,active=false,timer=null,lastError='',lastAttemptAt=0;
const nativeReady=()=>typeof window.NexusAndroid?.postMessage==='function'&&typeof window.nexusPostNativeAction==='function';
const driveVisible=()=>!!document.querySelector('.nxdr3,#nxgold14');
function post(action){try{return nativeReady()&&window.nexusPostNativeAction(action)===true}catch{return false}}
function hideManualDriveControl(){
  let style=document.getElementById('nx-drive-auto-only-v15');
  if(!style){
    style=document.createElement('style');style.id='nx-drive-auto-only-v15';
    style.textContent='#nxgold14 [data-action="drive"],.nxdr3 [data-dr-toggle]{display:none!important;visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }
}
function schedule(delay=900){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    hideManualDriveControl();
    if(!driveVisible()||!nativeReady()||armed||active)return;
    const now=Date.now();
    if(now-lastAttemptAt<4500){schedule(4500-(now-lastAttemptAt));return}
    lastAttemptAt=now;
    post('nativeDriveStart');
    schedule(6000);
  },Math.max(250,delay));
}
function wake(){
  hideManualDriveControl();
  if(!driveVisible()||!nativeReady())return;
  post('nativeDriveStatus');
  if(!armed&&!active)schedule(500);
}
window.addEventListener('nexusnova:native-drive',event=>{
  const d=event?.detail||{};
  armed=d.armed===true;active=d.active===true;lastError=String(d.error||d.status||'');
  if(armed||active){clearTimeout(timer);return}
  if(!driveVisible())return;
  // Permission denial is not spammed; retry when the app/screen becomes active again.
  if(/permission.*(denied|required)|location permission/i.test(lastError)){clearTimeout(timer);return}
  schedule(3000);
});
window.addEventListener('pageshow',wake);
window.addEventListener('focus',wake);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake()});
window.addEventListener('nexusnova:drive-screen-enter',wake);
// Drive modules mount asynchronously after the app route changes. A light periodic
// check avoids a whole-document MutationObserver and also re-arms after WebView resume.
setInterval(()=>{if(driveVisible()&&!armed&&!active)wake()},8000);
hideManualDriveControl();
setTimeout(wake,350);
