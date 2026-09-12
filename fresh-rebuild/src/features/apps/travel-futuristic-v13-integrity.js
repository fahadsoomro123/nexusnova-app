const ROOT_SELECTOR='.nn-travel-v19.nn-v13-futuristic';
const BRAND_URL='https://nexusnovatools.com/';

function safeHttps(raw){
  try{
    const url=new URL(String(raw||'').trim());
    return url.protocol==='https:'?url.href:'';
  }catch{return ''}
}

function openInNovaBrowser(raw){
  const url=safeHttps(raw);
  if(!url)return false;
  try{
    if(typeof window.NexusBrowserAndroid?.postMessage!=='function'){
      console.warn('[NexusNova Travel V13] Nova Browser bridge unavailable; external browser fallback blocked.');
      return false;
    }
    window.NexusBrowserAndroid.postMessage(JSON.stringify({action:'open',url}));
    return true;
  }catch(error){
    console.warn('[NexusNova Travel V13] Nova Browser handoff failed:',error);
    return false;
  }
}

function hotelDestination(offer){
  return [offer?.name,offer?.address,offer?.cityName||offer?.cityCode,offer?.countryName||offer?.countryCode]
    .filter(Boolean).join(', ');
}

function routeUrl(offer){
  const destination=hotelDestination(offer);
  return destination?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`:'';
}

function rootFor(node){
  return node instanceof Element?node.closest(ROOT_SELECTOR):null;
}

function syncRoot(root){
  if(!(root instanceof HTMLElement))return;
  const heading=root.querySelector('.nn-hero-copy h2');
  if(heading&&heading.dataset.v13IntegrityHeading!=='true'){
    heading.dataset.v13IntegrityHeading='true';
    heading.innerHTML='Travel,<br>beautifully routed.';
  }
  const site=root.querySelector('.nn-v13-site');
  if(site instanceof HTMLElement){
    site.setAttribute('aria-label','Open https://nexusnovatools.com in Nova Browser');
    site.title='https://nexusnovatools.com';
  }
}

function scan(){document.querySelectorAll(ROOT_SELECTOR).forEach(syncRoot)}

// Capture before V13's presentation handlers so approved in-app navigation can
// never fall through to Chrome/window.open when the native Nova Browser is absent.
document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;

  const site=target.closest('.nn-v13-site');
  if(site&&rootFor(site)){
    event.preventDefault();
    event.stopImmediatePropagation();
    openInNovaBrowser(BRAND_URL);
    return;
  }

  const routeButton=target.closest('[data-v13-route]');
  if(routeButton){
    const root=rootFor(routeButton);
    const index=Number(routeButton.getAttribute('data-v13-route'));
    const offer=root?.__v13HotelOffers?.[index];
    const url=routeUrl(offer);
    if(root&&url){
      event.preventDefault();
      event.stopImmediatePropagation();
      openInNovaBrowser(url);
    }
    return;
  }

  const compareRoute=target.closest('.nn-v13-compare-foot button');
  if(compareRoute){
    const root=rootFor(compareRoute);
    const selected=[...(root?.__v13Selected||[])];
    const offer=root?.__v13HotelOffers?.[selected[0]];
    const url=routeUrl(offer);
    if(root&&url){
      event.preventDefault();
      event.stopImmediatePropagation();
      openInNovaBrowser(url);
    }
  }
},true);

scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
