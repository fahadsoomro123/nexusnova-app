/*
 * NexusNova Secure Rewards Layer
 * All protected NVX mutations go through authenticated Firebase Functions.
 * User-facing status is rendered inside NexusNova instead of browser alert boxes.
 */
(() => {
  "use strict";

  let timerId = null;
  let startAt = 0;
  let uiPromise = null;
  const DAY = 86400000;

  function getUI(){
    if(window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if(uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-nx-premium-ui]');
      const done=()=>window.NexusNovaUI?resolve(window.NexusNovaUI):reject(new Error('Premium UI did not initialize.'));
      if(existing){
        window.addEventListener('nexusnova:premium-ui-ready',done,{once:true});
        setTimeout(done,1200);
        return;
      }
      const script=document.createElement('script');
      script.src='./js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi='1';
      script.onload=done;
      script.onerror=()=>reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(()=>{uiPromise=null;});
    return uiPromise;
  }

  async function showMessage({title,text,icon='spark',buttonText='OK',eyebrow='NEXUSNOVA'}){
    try{
      const ui=await getUI();
      await ui.alert({title,text,icon,buttonText,eyebrow});
    }catch(error){
      console.warn('Premium message unavailable:',error);
      // Keep the feature usable even if the optional presentation layer fails.
      window.alert(String(text||title||'NexusNova'));
    }
  }

  async function call(name, data = {}) {
    if(typeof window.nexusRequireAppCheck !== "function"){
      throw new Error("App Check is unavailable. Reload the app after it has been configured.");
    }
    await window.nexusRequireAppCheck();
    const [{getApps}, {getFunctions, httpsCallable}] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js")
    ]);
    const apps = getApps();
    if (!apps.length) throw new Error("Firebase app is not initialized.");
    return (await httpsCallable(getFunctions(apps[0]), name)(data)).data || {};
  }

  function renderMining(active, startedAt) {
    const btn=document.getElementById("mineBtn");
    const text=document.getElementById("btnText");
    const timer=document.getElementById("timer");
    if(!btn||!text||!timer) return;

    clearInterval(timerId);
    btn.classList.toggle("active",!!active);
    text.textContent=active ? "MINING ACTIVE" : "START MINING";

    if(!active){ timer.textContent="MINER OFFLINE"; return; }

    startAt=Number(startedAt)||Date.now();

    const tick=async()=>{
      const elapsed=Math.max(0,Date.now()-startAt);
      const left=Math.max(0,DAY-elapsed);
      timer.textContent=
        String(Math.floor(left/3600000)).padStart(2,"0")+":"+
        String(Math.floor((left%3600000)/60000)).padStart(2,"0")+":"+
        String(Math.floor((left%60000)/1000)).padStart(2,"0");

      if(elapsed<DAY) return;

      clearInterval(timerId);
      try{
        const r=await call("finishMiningSession");
        const b=Number(r.balance);
        if(Number.isFinite(b)){
          const el=document.getElementById("balance");
          const wb=document.getElementById("walletBalance");
          if(el) el.textContent=b.toFixed(4);
          if(wb) wb.textContent=b.toFixed(4)+" NVX";
        }
        renderMining(false,0);
      }catch(e){
        console.error("Secure mining finish:",e);
        timer.textContent="SYNC ERROR — TRY AGAIN";
      }
    };

    tick();
    timerId=setInterval(tick,1000);
  }

  async function finishMining(){
    try{
      const r=await call("finishMiningSession");
      const balance=Number(r.balance);
      if(Number.isFinite(balance)){
        const el=document.getElementById("balance");
        const wb=document.getElementById("walletBalance");
        if(el) el.textContent=balance.toFixed(4);
        if(wb) wb.textContent=balance.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState === "function"){
        window.nexusApplySecureAccountState(r);
      }
      if(r.finished){
        renderMining(false,0);
        await showMessage({
          eyebrow:'MINING SESSION COMPLETE',
          title:'NVX Mining Completed',
          text:'+'+Number(r.earned||0).toFixed(4)+' NVX was credited by the secure server.',
          icon:'spark',
          buttonText:'Done'
        });
      }
      return r;
    }catch(e){
      console.error("Secure mining finish:",e);
      const timer=document.getElementById("timer");
      if(timer) timer.textContent="SYNC ERROR — TRY AGAIN";
      throw e;
    }
  }

  async function startMining(){
    const b=document.getElementById("mineBtn");
    if(b) b.disabled=true;
    try{
      const r=await call("startMiningSession");
      renderMining(true,Number(r.startedAt)||Date.now());
      if(typeof window.nexusApplySecureAccountState === "function"){
        window.nexusApplySecureAccountState(r);
      }
    }catch(e){
      console.error("Secure mining start:",e);
      const raw=String(e?.message||"Mining could not be started.");
      const appCheck=/app check/i.test(raw);
      await showMessage({
        eyebrow:appCheck?'SECURE SETUP REQUIRED':'MINING STATUS',
        title:appCheck?'Firebase App Check Required':'Mining Could Not Start',
        text:raw,
        icon:'security',
        buttonText:'Got it'
      });
    }finally{
      if(b) b.disabled=false;
    }
  }

  async function claimDaily(){
    const b=document.getElementById("dailyBtn");
    if(b) b.disabled=true;
    try{
      const r=await call("claimDailyReward");
      const bal=Number(r.balance);
      if(Number.isFinite(bal)){
        const el=document.getElementById("balance");
        const wb=document.getElementById("walletBalance");
        if(el) el.textContent=bal.toFixed(4);
        if(wb) wb.textContent=bal.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState === "function"){
        window.nexusApplySecureAccountState(r);
      }
      await showMessage({
        eyebrow:'DAILY REWARD',
        title:'Reward Added',
        text:'+'+Number(r.reward||5).toFixed(2)+' NVX was added to your secure NexusNova balance.',
        icon:'spark',
        buttonText:'Great'
      });
      if(typeof window.updateDailyButton==="function") window.updateDailyButton();
    }catch(e){
      const raw=String(e?.message||"Daily reward could not be claimed.");
      const appCheck=/app check/i.test(raw);
      await showMessage({
        eyebrow:appCheck?'SECURE SETUP REQUIRED':'DAILY REWARD',
        title:appCheck?'Firebase App Check Required':'Reward Unavailable',
        text:raw,
        icon:'security',
        buttonText:'Got it'
      });
    }finally{
      if(b) b.disabled=false;
    }
  }

  async function task(taskId){
    const b=taskId==="task1"?document.getElementById("task1Btn"):null;
    if(b){b.disabled=true;b.textContent="VERIFYING...";}
    try{
      const r=await call("completeTaskReward",{taskId});
      const bal=Number(r.balance);
      if(Number.isFinite(bal)){
        const el=document.getElementById("balance");
        const wb=document.getElementById("walletBalance");
        if(el) el.textContent=bal.toFixed(4);
        if(wb) wb.textContent=bal.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState === "function"){
        window.nexusApplySecureAccountState(r);
      }
      await showMessage({
        eyebrow:'TASK VERIFIED',
        title:'Task Reward Added',
        text:'+'+Number(r.reward||0).toFixed(2)+' NVX was added to your secure balance.',
        icon:'spark',
        buttonText:'Done'
      });
      if(typeof window.updateTaskButtons==="function") window.updateTaskButtons();
    }catch(e){
      const raw=String(e?.message||"Task reward could not be claimed.");
      await showMessage({
        eyebrow:'TASK VERIFICATION',
        title:/app check/i.test(raw)?'Firebase App Check Required':'Task Could Not Be Verified',
        text:raw,
        icon:'security',
        buttonText:'Got it'
      });
      if(b){b.disabled=false;b.textContent="VERIFICATION REQUIRED";}
    }
  }

  function installSecureHandlers(){
    window.claimDailyReward=claimDaily;
    window.completeTask=task;
    const mine=document.getElementById("mineBtn");
    if(mine) mine.onclick=startMining;
  }

  window.nexusSecureStartMining=startMining;
  window.nexusSecureFinishMining=finishMining;
  window.nexusSecureClaimDaily=claimDaily;
  window.nexusSecureCompleteTask=task;
  window.nexusSecureRenderMining=renderMining;
  getUI().catch(()=>{});
  installSecureHandlers();
  window.addEventListener("load",installSecureHandlers,{once:true});

  window.addEventListener("load",()=>{
    setTimeout(async()=>{
      try{
        const [{getApps},{getAuth,onAuthStateChanged},{getFirestore,doc,getDoc}]
          =await Promise.all([
            import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
          ]);
        const apps=getApps();
        if(!apps.length) return;
        onAuthStateChanged(getAuth(apps[0]),async user=>{
          if(!user) return;
          const snap=await getDoc(doc(getFirestore(apps[0]),"users",user.uid));
          const d=snap.exists()?snap.data():{};
          if(d.miningActive && Number(d.miningStartedAt)>0){
            renderMining(true,Number(d.miningStartedAt));
          }
        });
      }catch(e){console.warn("Secure reward init:",e);}
    },1200);
  });

  console.log("NexusNova secure reward layer loaded.");
})();
