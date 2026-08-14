/* NexusNova Regional News + Qibla + Entertainment + Browser Bootstrap V4 */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const KABA = { lat: 21.422487, lon: 39.826206 };
  let qiblaBearing = null;
  let deviceHeading = 0;

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function validHttp(url){
    try{
      const u=new URL(url);
      return u.protocol==="https:" || u.protocol==="http:" ? u.href : "";
    }catch{return "";}
  }

  function openExternal(url){
    const safe=validHttp(url);
    if(!safe) return false;

    if(window.nexusPostNativeAction?.("openExternal", { url:safe })) return true;

    try{
      const a=document.createElement("a");
      a.href=safe;
      a.target="_blank";
      a.rel="noopener noreferrer";
      a.style.display="none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }catch(_){
      try{
        const opened=window.open(safe,"_blank","noopener,noreferrer");
        return Boolean(opened);
      }catch(__){
        return false;
      }
    }
  }

  window.nxOpenExternal = url => { openExternal(url); };

  /* ---------------------------------------------------------
     UI stability hotfix
     - ALL APPS becomes its own screen instead of overlaying Home/Mining.
     - Browser stays visually #2 without moving/rebuilding DOM nodes.
     - Splash exits quickly without waiting for slow window.load resources.
     This does not reorder DOM, replace app click handlers, or touch app modules.
  --------------------------------------------------------- */
  function installUiStability(){
    if(!document.getElementById('nxRegionalUiStabilityV4')){
      const style=document.createElement('style');
      style.id='nxRegionalUiStabilityV4';
      style.textContent=`
        body.nx-allapps-open main.main{display:none!important}
        body.nx-allapps-open #moreMenu.more-menu{
          position:relative!important;
          left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
          display:block!important;
          min-height:calc(100vh - 150px)!important;
          max-height:none!important;
          overflow:visible!important;
          margin:0!important;
          padding:16px 12px 96px!important;
        }
        body.nx-allapps-open #moreMenu .more-inner{max-width:900px!important;margin:0 auto!important}
        #moreMenu .more-item[onclick*="openMoreTab('tools')"]{order:-2}
        #moreMenu .more-item[onclick*="openMoreTab('browser')"]{order:-1}
        #moreMenu .more-item[onclick*="openMoreTab('browser')"] .mi-icon{
          position:relative!important;background:linear-gradient(145deg,#ff3455,#8b1630)!important;
          border-color:rgba(255,116,137,.78)!important;
          box-shadow:0 10px 28px rgba(255,45,76,.30),inset 0 1px 0 rgba(255,255,255,.30)!important;
          color:#fff!important
        }
        #moreMenu .more-item[onclick*="openMoreTab('browser')"] .mi-icon svg{display:none!important}
        #moreMenu .more-item[onclick*="openMoreTab('browser')"] .mi-icon:before{
          content:'N';display:grid;place-items:center;position:absolute;inset:0;color:#fff;
          font-size:28px;font-weight:1000;line-height:1;text-shadow:0 2px 10px rgba(0,0,0,.24)
        }
        #moreMenu .more-item[onclick*="openMoreTab('browser')"]>span:last-child{font-size:0!important}
        #moreMenu .more-item[onclick*="openMoreTab('browser')"]>span:last-child:after{
          content:'NexusNova Browser';display:block;font-size:9.5px;font-weight:900;line-height:1.08;
          letter-spacing:.01em;color:inherit;white-space:normal
        }
      `;
      document.head.appendChild(style);
    }

    const splash=$("nxSplash");
    if(splash && splash.dataset.nxFastExit!=="1"){
      splash.dataset.nxFastExit="1";
      setTimeout(()=>{
        if(!splash.isConnected) return;
        splash.classList.add('hide');
        splash.style.pointerEvents='none';
        setTimeout(()=>{ try{splash.remove();}catch(_){} },420);
      },450);
    }

    document.addEventListener('click', event=>{
      if(event.target.closest('#moreBtn')){
        setTimeout(()=>{
          const menu=$("moreMenu");
          const open=Boolean(menu?.classList.contains('show') && getComputedStyle(menu).display!=='none');
          document.body.classList.toggle('nx-allapps-open',open);
        },0);
      }else if(event.target.closest('#moreMenu .more-item')){
        setTimeout(()=>document.body.classList.remove('nx-allapps-open'),0);
      }
    },true);
  }

  installUiStability();

  const NEWS_QUERIES = {
    breaking: "Pakistan breaking latest news",
    urdu: "پاکستان اردو خبریں",
    sindhi: "سنڌ پاڪستان خبرون",
    pakistan: "Pakistan news politics economy",
    entertainment: "Pakistan entertainment film drama music"
  };

  async function gdelt(query){
    const url = "https://api.gdeltproject.org/api/v2/doc/doc"
      + "?query=" + encodeURIComponent(query)
      + "&mode=artlist&maxrecords=20&format=json&sort=datedesc";
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) throw new Error("News service unavailable");
    const data = await r.json();
    return Array.isArray(data.articles) ? data.articles : [];
  }

  function renderNews(items){
    const list = $("regionalNewsList");
    if(!list) return;
    list.innerHTML = "";
    if(!items.length){
      list.innerHTML = '<div class="status">No live articles returned right now. Try Refresh.</div>';
      return;
    }
    items.forEach(a => {
      const card = document.createElement("article");
      card.className = "regional-news-card";
      const title = document.createElement("div");
      title.className = "news-title";
      title.textContent = a.title || "News";
      const meta = document.createElement("div");
      meta.className = "news-meta";
      meta.textContent = [a.domain, a.seendate].filter(Boolean).join(" • ");
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.type = "button";
      btn.textContent = "Read";
      btn.addEventListener("click", () => openExternal(a.url));
      card.append(title, meta, btn);
      list.appendChild(card);
    });
  }

  window.nxRegionalNews = async category => {
    const status = $("regionalNewsStatus");
    if(status) status.textContent = "Loading live regional news…";
    document.querySelectorAll(".nexus-news-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.newsCat === category)
    );
    try{
      const items = await gdelt(NEWS_QUERIES[category] || NEWS_QUERIES.breaking);
      renderNews(items);
      if(status) status.textContent = `Live feed • ${items.length} articles`;
    }catch(e){
      console.warn("Regional news:", e);
      if(status) status.textContent = "Live feed temporarily unavailable. Existing World News remains available.";
      renderNews([]);
    }
  };

  function rad(x){ return x * Math.PI / 180; }
  function deg(x){ return x * 180 / Math.PI; }
  function bearing(lat, lon){
    const φ1=rad(lat), φ2=rad(KABA.lat), dl=rad(KABA.lon-lon);
    return (deg(Math.atan2(
      Math.sin(dl)*Math.cos(φ2),
      Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(dl)
    ))+360)%360;
  }

  function renderQibla(){
    if(qiblaBearing == null) return;
    const arrow = $("qiblaArrow");
    const degEl = $("qiblaDegree");
    const rel = ((qiblaBearing - deviceHeading) + 360) % 360;
    if(arrow) arrow.style.transform = `rotate(${rel}deg)`;
    if(degEl) degEl.textContent = `Qibla: ${qiblaBearing.toFixed(1)}° from true north • Turn until the arrow points forward.`;
  }

  function onOrientation(e){
    let heading = Number(e.webkitCompassHeading);
    if(!Number.isFinite(heading)) {
      const alpha = Number(e.alpha);
      if(Number.isFinite(alpha)) heading = (360 - alpha) % 360;
    }
    if(Number.isFinite(heading)) {
      deviceHeading = heading;
      renderQibla();
    }
  }

  window.nxStartQibla = async () => {
    const status=$("qiblaStatus");
    if(!navigator.geolocation){
      if(status) status.textContent="This browser does not support location.";
      return;
    }
    if(status) status.textContent="Requesting location…";
    navigator.geolocation.getCurrentPosition(async pos => {
      qiblaBearing = bearing(pos.coords.latitude, pos.coords.longitude);
      if(status) status.textContent=`Location found (accuracy ~${Math.round(pos.coords.accuracy)} m).`;
      renderQibla();

      try{
        if(typeof DeviceOrientationEvent !== "undefined" &&
           typeof DeviceOrientationEvent.requestPermission === "function"){
          const p = await DeviceOrientationEvent.requestPermission();
          if(p !== "granted") throw new Error("Motion permission denied");
        }
        window.addEventListener("deviceorientation", onOrientation, true);
        if(status) status.textContent += " Compass enabled.";
      }catch(e){
        if(status) status.textContent += " Live compass permission unavailable; showing bearing only.";
      }
    }, err => {
      if(status) status.textContent = `Location unavailable: ${err.message || "permission denied"}.`;
    }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
  };

  function renderBrowserFallback(url, message){
    const frame=$("nxBrowserFrame"), status=$("nxBrowserStatus");
    if(frame) frame.src="about:blank";
    if(!status) return;
    status.innerHTML="";
    const text=document.createElement("span");
    text.textContent=message;
    status.append(text);
  }

  function nativeBrowserOpen(url){
    if(typeof window.NexusBrowserAndroid?.postMessage !== 'function') return false;
    try{
      window.NexusBrowserAndroid.postMessage(JSON.stringify({action:'open',url}));
      return true;
    }catch(_){ return false; }
  }

  /* Legacy fallback is deliberately non-external. Browser V4 replaces these
     functions as soon as its script finishes loading. */
  window.nxBrowse = () => {
    const input=$("nxBrowserUrl"), status=$("nxBrowserStatus");
    const url=validHttp(input?.value?.trim() || "");
    if(!url){
      if(status) status.textContent="Enter a valid http:// or https:// URL.";
      return;
    }
    if(input) input.value=url;
    if(nativeBrowserOpen(url)){
      if(status) status.textContent='Opening inside NexusNova Browser…';
      return;
    }
    loadBrowserNow();
    renderBrowserFallback(url,"NexusNova Browser is loading. Automatic Chrome redirect is disabled.");
  };

  window.nxBrowsePreset = url => {
    if($("nxBrowserUrl")) $("nxBrowserUrl").value=url;
    window.nxBrowse();
  };

  window.nxOpenBrowserExternal = () => {
    const url=validHttp($("nxBrowserUrl")?.value?.trim() || "");
    if(!url) return;
    const opened=openExternal(url);
    if(!opened) renderBrowserFallback(url,"Your preview/browser blocked the new page.");
  };

  function normalizePhone(value){
    return String(value||"").replace(/[^\d+]/g,"").replace(/(?!^)\+/g,"");
  }
  window.nxCallerLookup = () => {
    const raw=$("nxCallerNumber")?.value || "";
    const n=normalizePhone(raw);
    const result=$("nxCallerResult");
    if(!/^\+\d{7,15}$/.test(n)){
      if(result) result.textContent="Use international format, for example +923001234567.";
      return;
    }
    if(result) result.innerHTML =
      `<strong>${esc(n)}</strong><br>`+
      `Number format looks valid. A verified name/location requires a legitimate caller-ID provider or native phone integration; NexusNova will not guess.`;
  };
  window.nxCallerWebSearch = () => {
    const n=normalizePhone($("nxCallerNumber")?.value || "");
    if(!/^\+\d{7,15}$/.test(n)) return window.nxCallerLookup();
    const q=encodeURIComponent(`"${n}" caller ID`);
    openExternal(`https://www.google.com/search?q=${q}`);
  };

  function loadLateScript(src, marker){
    const existing=document.querySelector(`script[${marker}]`);
    if(existing) return existing;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.onerror=()=>console.warn(`NexusNova late script failed: ${src}`);
    document.body.appendChild(script);
    return script;
  }

  function loadBrowserNow(){
    if(!document.getElementById('tab-browser')) return;
    const loadExtensions=()=>{
      loadLateScript('./js/nexusnova-browser-extensions-v1.js?v=2-ui-stable','data-nx-browser-extensions');
    };
    if(window.__nxNexusBrowserV4){
      loadExtensions();
      return;
    }
    const browserScript=loadLateScript('./js/nexusnova-browser-v1.js?v=4-ui-stable','data-nx-browser-shell');
    browserScript?.addEventListener('load',loadExtensions,{once:true});
    setTimeout(()=>{ if(window.__nxNexusBrowserV4) loadExtensions(); },900);
  }

  /* Browser must be ready before the user can interact with ALL APPS. */
  loadBrowserNow();

  window.addEventListener("load", () => {
    setTimeout(() => {
      if($("regionalNewsList")) window.nxRegionalNews("breaking");
    }, 800);

    setTimeout(() => {
      if(document.getElementById('tab-mega-learning')) {
        loadLateScript('./js/nexusnova-learning-engine-v1.js?v=1','data-nx-learning-engine');
      }
    }, 1800);
  });

  console.log("NexusNova regional/Qibla/browser bootstrap V4 loaded.");
})();