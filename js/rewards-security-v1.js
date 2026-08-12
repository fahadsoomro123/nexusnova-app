/*
 * NexusNova Secure Rewards Layer
 * All protected NVX mutations go through authenticated Firebase Functions.
 */
(() => {
  "use strict";

  let timerId = null;
  let startAt = 0;
  const DAY = 86400000;

  async function call(name, data = {}) {
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

  async function startMining(){
    try{
      const r=await call("startMiningSession");
      renderMining(true,Number(r.startedAt)||Date.now());
    }catch(e){
      console.error("Secure mining start:",e);
      alert(e?.message||"Mining could not be started.");
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
      alert("+"+Number(r.reward||5).toFixed(2)+" NVX added! 🎁");
      if(typeof window.updateDailyButton==="function") window.updateDailyButton();
    }catch(e){
      alert(e?.message||"Daily reward could not be claimed.");
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
      alert("+"+Number(r.reward||0).toFixed(2)+" NVX added! 🎁");
      if(typeof window.updateTaskButtons==="function") window.updateTaskButtons();
    }catch(e){
      alert(e?.message||"Task reward could not be claimed.");
      if(b){b.disabled=false;b.textContent="🎯 CLAIM +10 NVX";}
    }
  }

  window.claimDailyReward=claimDaily;
  window.completeTask=task;

  const mine=document.getElementById("mineBtn");
  if(mine) mine.onclick=startMining;

  // If a previously active session is loaded, use the server timestamp as
  // the client display source; no client reward is ever written.
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
