/* NexusNova Regional News + Qibla + Entertainment + Web Viewer + Caller ID V2 */
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

  // ---------------- Regional news ----------------
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

  // ---------------- Qibla ----------------
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

  // ---------------- Browser launcher ----------------
  // A normal web/PWA cannot act as a universal in-app browser because many
  // publishers deliberately reject iframe embedding via CSP/X-Frame-Options.
  // Therefore web mode opens the requested site as a real top-level page.
  // Native Android can later replace the openExternal bridge with an in-app WebView.
  function renderBrowserFallback(url, message){
    const frame=$("nxBrowserFrame"), status=$("nxBrowserStatus");
    if(frame) frame.src="about:blank";
    if(!status) return;
    status.innerHTML="";
    const text=document.createElement("span");
    text.textContent=message+" ";
    const link=document.createElement("a");
    link.href=url;
    link.target="_blank";
    link.rel="noopener noreferrer";
    link.textContent="Open website";
    link.style.color="var(--accent,#00f5d4)";
    status.append(text,link);
  }

  window.nxBrowse = () => {
    const input=$("nxBrowserUrl"), status=$("nxBrowserStatus");
    const url=validHttp(input?.value?.trim() || "");
    if(!url){
      if(status) status.textContent="Enter a valid http:// or https:// URL.";
      return;
    }
    if(input) input.value=url;

    const opened=openExternal(url);
    renderBrowserFallback(
      url,
      opened
        ? "Opened as a real web page. Universal iframe browsing is blocked by many sites."
        : "Your preview/browser blocked the new page."
    );
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

  // ---------------- Caller ID helper ----------------
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

  window.addEventListener("load", () => {
    setTimeout(() => {
      if($("regionalNewsList")) window.nxRegionalNews("breaking");
    }, 800);
  });

  console.log("NexusNova regional/Qibla/browser/caller module V2 loaded.");
})();
