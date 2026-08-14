/*
 * NexusNova Secure Rewards Layer
 * Mining uses authenticated Firestore transactions protected by server-side
 * Security Rules so the Spark-plan build does not depend on unavailable
 * production Cloud Functions. Other reward operations remain callable-backed.
 */
(() => {
  "use strict";

  let timerId = null;
  let startAt = 0;
  let uiPromise = null;
  const DAY = 86400000;
  const MINING_REWARD = 24;
  const MINING_STYLE_ID = "nx-future-mining-style";

  function installMiningVisuals(){
    if(!document.getElementById(MINING_STYLE_ID)){
      const style=document.createElement("style");
      style.id=MINING_STYLE_ID;
      style.textContent=`
        #mineBtn.nx-future-miner{position:relative!important;isolation:isolate;overflow:hidden;min-height:116px;padding:20px 28px 20px 132px!important;margin:18px 0 12px!important;border:1px solid rgba(67,171,255,.6)!important;border-radius:28px!important;background:linear-gradient(115deg,rgba(3,14,31,.98),rgba(5,35,72,.96) 54%,rgba(5,71,108,.94))!important;color:#eaf8ff!important;text-align:left;box-shadow:0 20px 46px rgba(0,66,150,.34),0 0 0 1px rgba(57,182,255,.12) inset,0 1px 0 rgba(255,255,255,.18) inset!important;transform:translateZ(0);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,filter .22s ease!important}
        #mineBtn.nx-future-miner:hover:not(:disabled){transform:translateY(-2px) scale(1.004);border-color:rgba(111,215,255,.92)!important;box-shadow:0 24px 56px rgba(0,102,210,.42),0 0 32px rgba(18,177,255,.18),0 0 0 1px rgba(90,204,255,.18) inset!important}
        #mineBtn.nx-future-miner:disabled{cursor:wait;opacity:.82}
        #mineBtn.nx-future-miner::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(100deg,transparent 0 28%,rgba(81,206,255,.10) 45%,transparent 63%),repeating-linear-gradient(90deg,transparent 0 38px,rgba(77,179,255,.035) 39px 40px);animation:nxMineScan 4.8s linear infinite}
        #mineBtn.nx-future-miner::after{content:"";position:absolute;width:180px;height:180px;right:-76px;top:-80px;border-radius:50%;background:radial-gradient(circle,rgba(84,221,255,.32),rgba(27,125,255,.09) 40%,transparent 70%);filter:blur(1px);z-index:-1;animation:nxMineAura 3.2s ease-in-out infinite}
        .nx-mining-reactor{position:absolute;left:25px;top:50%;width:82px;height:82px;transform:translateY(-50%);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 46%,#e9ffff 0 8%,#6fe7ff 9% 20%,#0a8cff 21% 39%,#031d4a 40% 62%,#020813 63%);box-shadow:0 0 0 1px rgba(135,231,255,.75),0 0 0 7px rgba(24,137,255,.11),0 0 31px rgba(34,184,255,.64),inset 0 0 22px rgba(255,255,255,.28)}
        .nx-mining-reactor::before,.nx-mining-reactor::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(116,221,255,.58);inset:-8px;border-left-color:transparent;border-bottom-color:transparent;animation:nxMineSpin 5s linear infinite}.nx-mining-reactor::after{inset:8px;border-color:rgba(255,255,255,.55);border-right-color:transparent;animation-duration:2.7s;animation-direction:reverse}
        .nx-mining-bolt{width:26px;height:40px;background:#efffff;clip-path:polygon(56% 0,18% 52%,45% 52%,34% 100%,82% 39%,54% 39%);filter:drop-shadow(0 0 7px #79eaff) drop-shadow(0 0 13px #139cff)}
        #mineBtn.nx-future-miner #btnText{position:relative;display:block;font-size:20px;line-height:1.05;font-weight:900;letter-spacing:.035em;text-shadow:0 0 18px rgba(99,210,255,.32)}
        #mineBtn.nx-future-miner .sub-text{display:block;margin-top:8px;font-size:10px;letter-spacing:.20em;font-weight:800;color:#8cc8ef;opacity:1}#mineBtn.nx-future-miner .nx-mining-note{display:block;margin-top:8px;color:#5689ad;font-size:9px;font-weight:800;letter-spacing:.13em}
        #mineBtn.nx-future-miner[data-state="active"]{border-color:rgba(79,255,201,.75)!important;background:linear-gradient(115deg,rgba(2,24,32,.98),rgba(3,64,72,.96) 54%,rgba(2,113,93,.94))!important;box-shadow:0 20px 48px rgba(0,187,141,.28),0 0 36px rgba(41,255,194,.14),0 0 0 1px rgba(82,255,205,.13) inset!important}
        #mineBtn.nx-future-miner[data-state="active"] .nx-mining-reactor{background:radial-gradient(circle at 50% 46%,#f3fff9 0 8%,#80ffd1 9% 20%,#00d99c 21% 39%,#053c35 40% 62%,#020d0b 63%);box-shadow:0 0 0 1px rgba(126,255,213,.8),0 0 0 7px rgba(0,215,153,.11),0 0 34px rgba(0,255,184,.68),inset 0 0 22px rgba(255,255,255,.25)}
        #mineBtn.nx-future-miner[data-state="active"] .nx-mining-reactor,#mineBtn.nx-future-miner[data-state="active"] .nx-mining-bolt{animation:nxMinePulse 1.45s ease-in-out infinite}
        #mineBtn.nx-future-miner[data-state="locked"]{border-color:rgba(255,176,76,.65)!important;background:linear-gradient(115deg,rgba(31,19,5,.98),rgba(72,43,7,.95),rgba(91,58,13,.94))!important;box-shadow:0 18px 42px rgba(190,101,0,.22),0 0 0 1px rgba(255,188,79,.12) inset!important}#mineBtn.nx-future-miner[data-state="locked"] .nx-mining-reactor{background:radial-gradient(circle,#fff7df 0 9%,#ffc65f 10% 23%,#e48611 24% 40%,#4c2705 41% 63%,#100902 64%);box-shadow:0 0 0 1px rgba(255,208,126,.8),0 0 0 7px rgba(255,163,25,.09),0 0 28px rgba(255,157,25,.42)}
        #mineBtn.nx-future-miner[data-state="error"]{border-color:rgba(255,95,126,.68)!important;background:linear-gradient(115deg,rgba(32,8,18,.98),rgba(76,12,31,.95),rgba(91,21,39,.94))!important}
        #timer.nx-mining-timer{position:relative;width:max-content;max-width:100%;margin:12px auto 18px;padding:10px 18px;border-radius:999px;border:1px solid rgba(74,169,255,.24);background:rgba(8,25,48,.58);color:#59b5ff;box-shadow:inset 0 0 18px rgba(22,107,255,.06);letter-spacing:.06em;font-size:17px}#timer.nx-mining-timer.nx-locked{color:#ffc96a;border-color:rgba(255,189,72,.26);background:rgba(58,35,6,.5)}#timer.nx-mining-timer.nx-error{color:#ff849a;border-color:rgba(255,91,122,.28);background:rgba(58,7,20,.48)}
        @keyframes nxMineSpin{to{transform:rotate(360deg)}}@keyframes nxMinePulse{50%{filter:brightness(1.25);transform:scale(1.055)}}@keyframes nxMineAura{50%{transform:scale(1.16);opacity:.72}}@keyframes nxMineScan{to{background-position:520px 0,0 0}}
        @media(max-width:520px){#mineBtn.nx-future-miner{min-height:108px;padding:18px 18px 18px 112px!important;border-radius:24px!important}.nx-mining-reactor{left:20px;width:70px;height:70px}#mineBtn.nx-future-miner #btnText{font-size:18px}#mineBtn.nx-future-miner .sub-text{font-size:9px}}
        @media(prefers-reduced-motion:reduce){#mineBtn.nx-future-miner::before,#mineBtn.nx-future-miner::after,.nx-mining-reactor::before,.nx-mining-reactor::after,#mineBtn.nx-future-miner[data-state="active"] .nx-mining-reactor,#mineBtn.nx-future-miner[data-state="active"] .nx-mining-bolt{animation:none!important}}
      `;
      document.head.appendChild(style);
    }

    const btn=document.getElementById("mineBtn");
    const timer=document.getElementById("timer");
    if(btn){
      btn.classList.add("nx-future-miner");
      if(!btn.querySelector(".nx-mining-reactor")){
        const reactor=document.createElement("span");
        reactor.className="nx-mining-reactor";
        reactor.setAttribute("aria-hidden","true");
        reactor.innerHTML='<i class="nx-mining-bolt"></i>';
        btn.prepend(reactor);
      }
      if(!btn.querySelector(".nx-mining-note")){
        const note=document.createElement("span");
        note.className="nx-mining-note";
        note.textContent="SECURE NVX REACTOR • RULES VERIFIED";
        btn.appendChild(note);
      }
      if(!btn.dataset.state) btn.dataset.state="ready";
    }
    if(timer) timer.classList.add("nx-mining-timer");
  }

  function setMiningState(state,timerText){
    installMiningVisuals();
    const btn=document.getElementById("mineBtn");
    const text=document.getElementById("btnText");
    const timer=document.getElementById("timer");
    if(btn) btn.dataset.state=state;
    if(timer){
      timer.classList.toggle("nx-locked",state==="locked");
      timer.classList.toggle("nx-error",state==="error");
      if(timerText) timer.textContent=timerText;
    }
    if(text&&state==="locked") text.textContent="SECURE SETUP REQUIRED";
    if(text&&state==="error") text.textContent="SYNC REQUIRED";
  }

  async function appCheckStatus(){
    try{
      if(!window.nexusAppCheckReady) return {ready:false,message:"App Check is still loading."};
      const status=await window.nexusAppCheckReady;
      return status&&typeof status==="object"?status:{ready:false,message:"App Check is unavailable."};
    }catch(error){
      return {ready:false,message:error?.message||"App Check is unavailable."};
    }
  }

  function getUI(){
    if(window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if(uiPromise) return uiPromise;
    uiPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-nx-premium-ui]');
      const done=()=>window.NexusNovaUI?resolve(window.NexusNovaUI):reject(new Error('Premium UI did not initialize.'));
      if(existing){window.addEventListener('nexusnova:premium-ui-ready',done,{once:true});setTimeout(done,1200);return;}
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
      console.warn('Premium message unavailable:',error,String(text||title||'NexusNova'));
    }
  }

  async function getFirebaseContext(){
    const [appMod,authMod,fsMod]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
    ]);
    const apps=appMod.getApps();
    if(!apps.length) throw new Error("Firebase app is not initialized.");
    const app=apps[0];
    const auth=authMod.getAuth(app);
    const user=auth.currentUser;
    if(!user) throw new Error("Please sign in first.");
    if(!user.emailVerified) throw new Error("Verify your email before using NVX mining.");
    return {app,user,db:fsMod.getFirestore(app),fsMod};
  }

  async function requireAppCheck(){
    if(typeof window.nexusRequireAppCheck!=="function"){
      throw new Error("App Check is unavailable. Reload the app after it has been configured.");
    }
    await window.nexusRequireAppCheck();
  }

  async function miningCall(name){
    await requireAppCheck();
    const {user,db,fsMod}=await getFirebaseContext();
    const ref=fsMod.doc(db,"users",user.uid);

    if(name==="startMiningSession"){
      const now=Date.now();
      return fsMod.runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists()) throw new Error("User profile not found.");
        const d=snap.data()||{};
        const balance=Number(d.balance);
        const active=d.miningActive===true;
        const started=Number(d.miningStartedAt)||0;
        if(!Number.isFinite(balance)||balance<0) throw new Error("Account balance needs repair.");
        if(active){
          if(started<=0) throw new Error("Mining session needs repair.");
          return {started:false,alreadyActive:true,startedAt:started,balance,miningActive:true};
        }
        if(started!==0) throw new Error("Mining session needs repair.");
        tx.update(ref,{miningActive:true,miningStartedAt:now,miningLastUpdate:now});
        return {started:true,startedAt:now,balance,miningActive:true};
      });
    }

    if(name==="finishMiningSession"){
      const now=Date.now();
      return fsMod.runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists()) throw new Error("User profile not found.");
        const d=snap.data()||{};
        const active=d.miningActive===true;
        const started=Number(d.miningStartedAt)||0;
        const balance0=Number(d.balance);
        const total0=Number(d.totalMined);
        if(!Number.isFinite(balance0)||balance0<0||!Number.isFinite(total0)||total0<0){
          throw new Error("Account mining data needs repair.");
        }
        if(!active){
          if(started!==0) throw new Error("Mining session needs repair.");
          return {finished:false,balance:balance0,earned:0,totalMined:total0,miningActive:false};
        }
        if(started<=0) throw new Error("Mining session needs repair.");
        if(now-started<DAY) throw new Error("Your 24-hour mining session is still active.");
        const balance=balance0+MINING_REWARD;
        const totalMined=total0+MINING_REWARD;
        tx.update(ref,{balance,totalMined,miningActive:false,miningStartedAt:0,miningLastUpdate:now});
        return {finished:true,balance,earned:MINING_REWARD,totalMined,miningActive:false};
      });
    }

    throw new Error("Unknown mining operation.");
  }

  async function functionCall(name,data={}){
    await requireAppCheck();
    const [appMod,fnMod]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js")
    ]);
    const apps=appMod.getApps();
    if(!apps.length) throw new Error("Firebase app is not initialized.");
    return (await fnMod.httpsCallable(fnMod.getFunctions(apps[0]),name)(data)).data||{};
  }

  async function call(name,data={}){
    if(name==="startMiningSession"||name==="finishMiningSession") return miningCall(name);
    return functionCall(name,data);
  }

  function renderMining(active,startedAt){
    installMiningVisuals();
    const btn=document.getElementById("mineBtn"),text=document.getElementById("btnText"),timer=document.getElementById("timer");
    if(!btn||!text||!timer) return;
    clearInterval(timerId);
    btn.classList.toggle("active",!!active);
    btn.dataset.state=active?"active":"ready";
    timer.classList.remove("nx-locked","nx-error");
    text.textContent=active?"MINING ACTIVE":"START MINING";
    if(!active){timer.textContent="MINER OFFLINE";return;}

    startAt=Number(startedAt)||Date.now();
    const tick=async()=>{
      const elapsed=Math.max(0,Date.now()-startAt),left=Math.max(0,DAY-elapsed);
      timer.textContent=String(Math.floor(left/3600000)).padStart(2,"0")+":"+String(Math.floor((left%3600000)/60000)).padStart(2,"0")+":"+String(Math.floor((left%60000)/1000)).padStart(2,"0");
      if(elapsed<DAY) return;
      clearInterval(timerId);
      try{
        const r=await miningCall("finishMiningSession"),b=Number(r.balance);
        if(Number.isFinite(b)){
          const el=document.getElementById("balance"),wb=document.getElementById("walletBalance");
          if(el) el.textContent=b.toFixed(4);
          if(wb) wb.textContent=b.toFixed(4)+" NVX";
        }
        if(typeof window.nexusApplySecureAccountState==="function") window.nexusApplySecureAccountState(r);
        renderMining(false,0);
      }catch(e){
        console.error("Secure mining finish:",e);
        setMiningState("error","SECURE SYNC REQUIRED");
      }
    };
    tick();
    timerId=setInterval(tick,1000);
  }

  async function finishMining(){
    try{
      const r=await miningCall("finishMiningSession"),balance=Number(r.balance);
      if(Number.isFinite(balance)){
        const el=document.getElementById("balance"),wb=document.getElementById("walletBalance");
        if(el) el.textContent=balance.toFixed(4);
        if(wb) wb.textContent=balance.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState==="function") window.nexusApplySecureAccountState(r);
      if(r.finished){
        renderMining(false,0);
        await showMessage({eyebrow:'MINING SESSION COMPLETE',title:'NVX Mining Completed',text:'+'+Number(r.earned||0).toFixed(4)+' NVX was credited after the secure 24-hour rule check.',icon:'spark',buttonText:'Done'});
      }
      return r;
    }catch(e){
      console.error("Secure mining finish:",e);
      setMiningState("error","SECURE SYNC REQUIRED");
      throw e;
    }
  }

  async function startMining(){
    installMiningVisuals();
    const b=document.getElementById("mineBtn");
    if(b) b.disabled=true;
    try{
      const status=await appCheckStatus();
      if(!status.ready){
        setMiningState("locked","APP CHECK REQUIRED");
        throw new Error(status.message||"App Check is not configured.");
      }
      const r=await miningCall("startMiningSession");
      renderMining(true,Number(r.startedAt)||Date.now());
      if(typeof window.nexusApplySecureAccountState==="function") window.nexusApplySecureAccountState(r);
    }catch(e){
      console.error("Secure mining start:",e);
      const raw=String(e?.message||"Mining could not be started."),appCheck=/app check/i.test(raw);
      if(appCheck) setMiningState("locked","APP CHECK REQUIRED"); else setMiningState("error","SECURE MINING UNAVAILABLE");
      await showMessage({eyebrow:appCheck?'SECURE SETUP REQUIRED':'MINING STATUS',title:appCheck?'Firebase App Check Required':'Mining Could Not Start',text:raw,icon:'security',buttonText:'Got it'});
    }finally{
      if(b) b.disabled=false;
    }
  }

  async function claimDaily(){
    const b=document.getElementById("dailyBtn");
    if(b) b.disabled=true;
    try{
      const r=await functionCall("claimDailyReward"),bal=Number(r.balance);
      if(Number.isFinite(bal)){
        const el=document.getElementById("balance"),wb=document.getElementById("walletBalance");
        if(el) el.textContent=bal.toFixed(4);
        if(wb) wb.textContent=bal.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState==="function") window.nexusApplySecureAccountState(r);
      await showMessage({eyebrow:'DAILY REWARD',title:'Reward Added',text:'+'+Number(r.reward||5).toFixed(2)+' NVX was added to your secure NexusNova balance.',icon:'spark',buttonText:'Great'});
      if(typeof window.updateDailyButton==="function") window.updateDailyButton();
    }catch(e){
      const raw=String(e?.message||"Daily reward could not be claimed.");
      await showMessage({eyebrow:'DAILY REWARD',title:'Reward Unavailable',text:raw,icon:'security',buttonText:'Got it'});
    }finally{
      if(b) b.disabled=false;
    }
  }

  async function task(taskId){
    const b=taskId==="task1"?document.getElementById("task1Btn"):null;
    if(b){b.disabled=true;b.textContent="VERIFYING...";}
    try{
      const r=await functionCall("completeTaskReward",{taskId}),bal=Number(r.balance);
      if(Number.isFinite(bal)){
        const el=document.getElementById("balance"),wb=document.getElementById("walletBalance");
        if(el) el.textContent=bal.toFixed(4);
        if(wb) wb.textContent=bal.toFixed(4)+" NVX";
      }
      if(typeof window.nexusApplySecureAccountState==="function") window.nexusApplySecureAccountState(r);
      await showMessage({eyebrow:'TASK VERIFIED',title:'Task Reward Added',text:'+'+Number(r.reward||0).toFixed(2)+' NVX was added to your secure balance.',icon:'spark',buttonText:'Done'});
      if(typeof window.updateTaskButtons==="function") window.updateTaskButtons();
    }catch(e){
      const raw=String(e?.message||"Task reward could not be claimed.");
      await showMessage({eyebrow:'TASK VERIFICATION',title:'Task Could Not Be Verified',text:raw,icon:'security',buttonText:'Got it'});
      if(b){b.disabled=false;b.textContent="VERIFICATION REQUIRED";}
    }
  }

  function installSecureHandlers(){
    installMiningVisuals();
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
        const [appMod,authMod,fsMod]=await Promise.all([
          import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
        ]);
        const apps=appMod.getApps();
        if(!apps.length) return;
        authMod.onAuthStateChanged(authMod.getAuth(apps[0]),async user=>{
          if(!user) return;
          const snap=await fsMod.getDoc(fsMod.doc(fsMod.getFirestore(apps[0]),"users",user.uid));
          const d=snap.exists()?snap.data():{};
          if(d.miningActive&&Number(d.miningStartedAt)>0) renderMining(true,Number(d.miningStartedAt));
          else renderMining(false,0);
        });
      }catch(e){
        console.warn("Secure reward init:",e);
      }
    },1200);
  });

  console.log("NexusNova secure reward layer loaded — Spark mining uses Firestore rules.");
})();