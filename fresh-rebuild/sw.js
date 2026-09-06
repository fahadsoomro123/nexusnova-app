/* NexusNova Fresh Service Worker — fresh shell + FCM web push */
const CACHE_PREFIX='nexusnova-fresh-shell-';
const CACHE=`${CACHE_PREFIX}v3-ai-photo-20260906`;
const ASSETS=[
  './','./index.html',
  './assets/styles/tokens.css','./assets/styles/app.css','./assets/styles/features.css','./assets/styles/core-apps.css','./assets/styles/discover-apps.css',
  './src/main.js'
];

function safeNotificationUrl(raw){
  try{
    const scopeUrl=new URL(String(self.registration?.scope||new URL('./',self.location.href).href));
    const fallback=new URL('./index.html',scopeUrl);
    const target=new URL(String(raw||'./index.html'),scopeUrl);
    if(target.origin!==scopeUrl.origin)return fallback.href;
    if(!target.pathname.startsWith(scopeUrl.pathname))return fallback.href;
    if(/\/page2\.html$/i.test(target.pathname))return fallback.href;
    return target.href;
  }catch{
    try{return new URL('./index.html',self.registration?.scope||self.location.href).href;}
    catch{return './index.html';}
  }
}

try{
  importScripts(
    'https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js'
  );
  firebase.initializeApp({
    apiKey:'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
    authDomain:'nexusnova-6ade2.firebaseapp.com',
    projectId:'nexusnova-6ade2',
    storageBucket:'nexusnova-6ade2.firebasestorage.app',
    messagingSenderId:'49791194817',
    appId:'1:49791194817:web:07f28326e0f15979536640'
  });
  const messaging=firebase.messaging();
  messaging.onBackgroundMessage(payload=>{
    const data=payload?.data||{};
    if(data.nexusnova!=='1')return;
    return self.registration.showNotification(data.title||'NexusNova',{
      body:data.body||'You have a new NexusNova update.',
      data:{url:safeNotificationUrl(data.url)}
    });
  });
}catch(error){console.warn('NexusNova Fresh FCM service worker unavailable:',error);}

self.addEventListener('notificationclick',event=>{
  event.notification?.close();
  const target=safeNotificationUrl(event.notification?.data?.url);
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const scope=String(self.registration.scope||'');
    for(const client of windows){
      try{
        if(scope&&!String(client.url||'').startsWith(scope))continue;
        if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target);return;}
      }catch{}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.allSettled(ASSETS.map(async asset=>{
      const response=await fetch(asset,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${asset}`);
      await cache.put(asset,response);
    }));
  }).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key!==CACHE&&key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});

async function networkFirst(request){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),request.mode==='navigate'?7000:4500);
  try{
    const response=await fetch(request,{cache:'no-store',signal:controller.signal});
    if(response?.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate'){const shell=await caches.match('./index.html');if(shell)return shell;}
    throw error;
  }finally{clearTimeout(timeout);}
}

async function cacheFirst(request){
  const cached=await caches.match(request);if(cached)return cached;
  const response=await fetch(request);
  if(response?.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  const fresh=request.mode==='navigate'||['document','script','style'].includes(request.destination)||/\.(?:html?|js|css)(?:\?|$)/i.test(url.pathname+url.search);
  event.respondWith(fresh?networkFirst(request):cacheFirst(request));
});
