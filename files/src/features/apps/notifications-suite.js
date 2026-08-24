import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';

const TOKEN_KEY='nexusnova_fcm_token_v1';
let working=false;
let silentRefreshInstalled=false;

function node(html){const root=document.createElement('div');root.className='nx-app-body';root.innerHTML=html;return root;}
function vapidKey(){return String(window.NEXUSNOVA_FCM_VAPID_KEY||window.NEXUSNOVA_PUBLIC_CONFIG?.fcmVapidKey||'').trim();}
function notificationSupported(){return typeof globalThis.Notification==='function';}

async function parts(){
  const [functionsMod,messagingMod]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js'),
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js')
  ]);
  return {functionsMod,messagingMod};
}

async function context(){
  if(!notificationSupported()||!('serviceWorker'in navigator))throw new Error('Push notifications are not supported on this device/browser.');
  const modules=await parts();
  if(!(await modules.messagingMod.isSupported()))throw new Error('Firebase web push is not supported on this device/browser.');
  await requireFirebaseUser({write:true});
  return modules;
}

async function registration(){
  const reg=await navigator.serviceWorker.register('./sw.js');
  if(reg.active)return reg;
  return navigator.serviceWorker.ready;
}

async function tokenFor(ctx,requestPermission){
  let permission=Notification.permission;
  if(permission==='default'&&requestPermission)permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notification permission was not granted.');
  const serviceWorkerRegistration=await registration();
  const messaging=ctx.messagingMod.getMessaging(firebaseApp);
  const options={serviceWorkerRegistration};
  const key=vapidKey();if(key)options.vapidKey=key;
  const token=await ctx.messagingMod.getToken(messaging,options);
  if(!token)throw new Error(key?'Firebase did not return a push token. Check FCM web credentials and allowed origin.':'Firebase did not return a push token. Configure a Web Push VAPID key if the default key is unavailable.');
  return {token,messaging};
}

async function callable(ctx,name,data){
  const fn=ctx.functionsMod.httpsCallable(ctx.functionsMod.getFunctions(firebaseApp,'us-central1'),name);
  return (await fn(data)).data||{};
}

async function registerDevice(requestPermission=true){
  if(working)return null;working=true;
  try{
    const ctx=await context();
    const {token}=await tokenFor(ctx,requestPermission);
    await callable(ctx,'registerPushToken',{token,userAgent:navigator.userAgent||''});
    localStorage.setItem(TOKEN_KEY,token);
    return token;
  }finally{working=false;}
}

async function sendTestPush(){
  if(working)return null;working=true;
  try{
    const ctx=await context();
    const {token}=await tokenFor(ctx,false);
    await callable(ctx,'registerPushToken',{token,userAgent:navigator.userAgent||''});
    localStorage.setItem(TOKEN_KEY,token);
    return callable(ctx,'sendPushTest',{});
  }finally{working=false;}
}

async function disableDevice(){
  if(working)return null;working=true;
  try{
    const ctx=await context();
    const stored=String(localStorage.getItem(TOKEN_KEY)||'').trim();
    const obtained=stored?null:await tokenFor(ctx,false);
    const token=stored||obtained?.token;
    if(token)await callable(ctx,'removePushToken',{token});
    try{await ctx.messagingMod.deleteToken(ctx.messagingMod.getMessaging(firebaseApp));}catch(error){console.warn('[NexusNova Fresh] FCM local token delete:',error);}
    localStorage.removeItem(TOKEN_KEY);
    return true;
  }finally{working=false;}
}

function installSilentRefresh(){
  if(silentRefreshInstalled)return;silentRefreshInstalled=true;
  const refresh=()=>setTimeout(()=>{
    if(notificationSupported()&&Notification.permission==='granted')registerDevice(false).catch(error=>console.warn('[NexusNova Fresh] FCM silent refresh:',error));
  },3500);
  if(document.readyState==='complete')refresh();
  else window.addEventListener('load',refresh,{once:true});
}
installSilentRefresh();

export function renderNotificationsSuite(){
  const root=node(`
    <section class="nx-tool-card">
      <div class="nx-setting-row"><div><strong>Firebase Cloud Messaging</strong><span data-push-permission>${notificationSupported()?Notification.permission:'unsupported'}</span></div><span class="nx-badge" data-push-badge>CHECK</span></div>
      <div class="nx-action-row"><button class="nx-primary" type="button" data-push-enable>ENABLE PUSH</button><button type="button" data-push-test>SEND REAL TEST</button><button type="button" data-push-disable>DISABLE DEVICE</button></div>
      <p class="nx-tool-meta" data-push-status>Closed-app web push uses the existing Firebase backend. Permission is requested only after you press Enable.</p>
    </section>
    <section class="nx-tool-card">
      <strong>Local Notification Check</strong>
      <button type="button" data-local-test>TEST LOCAL NOTIFICATION</button>
      <p class="nx-tool-meta">A local test only checks this browser permission. “Send Real Test” calls the App Check protected FCM backend and is rate-limited server-side.</p>
    </section>`);
  const permission=root.querySelector('[data-push-permission]'),badge=root.querySelector('[data-push-badge]'),status=root.querySelector('[data-push-status]');
  const paint=()=>{const value=notificationSupported()?Notification.permission:'unsupported';permission.textContent=value;const registered=Boolean(localStorage.getItem(TOKEN_KEY));badge.textContent=value==='granted'&&registered?'FCM ON':value.toUpperCase();badge.classList.toggle('good',value==='granted'&&registered);};
  paint();
  root.querySelector('[data-push-enable]').addEventListener('click',async()=>{
    status.textContent='Connecting secure Firebase push…';
    try{await registerDevice(true);status.textContent='Push notifications enabled for this device.';}catch(error){status.textContent=String(error?.message||error).slice(0,280);}finally{paint();}
  });
  root.querySelector('[data-push-test]').addEventListener('click',async()=>{
    status.textContent='Sending a real FCM test through the secure backend…';
    try{const result=await sendTestPush();const sent=Number(result?.sent||0),failed=Number(result?.failed||0),pruned=Number(result?.pruned||0);status.textContent=`FCM test result: sent ${sent}, failed ${failed}, pruned ${pruned}.`;}catch(error){status.textContent=String(error?.message||error).slice(0,280);}finally{paint();}
  });
  root.querySelector('[data-push-disable]').addEventListener('click',async()=>{
    status.textContent='Removing this device push token…';
    try{await disableDevice();status.textContent='Push notifications disabled for this device.';}catch(error){status.textContent=String(error?.message||error).slice(0,280);}finally{paint();}
  });
  root.querySelector('[data-local-test]').addEventListener('click',()=>{
    if(!notificationSupported()){status.textContent='Notifications are unsupported here.';return;}
    if(Notification.permission!=='granted'){status.textContent='Enable notification permission first.';return;}
    try{new Notification('NexusNova',{body:'Local notification test successful.'});status.textContent='Local notification displayed.';}catch(error){status.textContent='Local notification could not be displayed.';}
  });
  return root;
}

export const notificationsSuiteRenderers=Object.freeze({notifications:renderNotificationsSuite});