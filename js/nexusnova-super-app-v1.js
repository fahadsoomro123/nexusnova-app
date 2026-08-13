/* NexusNova Super-App Expansion V3 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const store = (k,v) => { try { localStorage.setItem("nexus_"+k, JSON.stringify(v)); } catch(_){} };
  const load = (k,d=[]) => { try { const v=JSON.parse(localStorage.getItem("nexus_"+k)); return v ?? d; } catch { return d; } };

  function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

  function loadLateScript(src, marker){
    if(document.querySelector(`script[${marker}]`)) return;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.onerror=()=>console.warn(`NexusNova late module failed: ${src}`);
    document.body.appendChild(script);
  }

  window.nxBuildDailyBrief = () => {
    const out=$("nxDailyBrief"); if(!out) return;
    const now=new Date();
    const events=load("events",[]).filter(e=>new Date(e.date)>=now).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,3);
    const notes=load("notes",[]);
    out.innerHTML = `<b>${now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</b><br>`+
      `Upcoming events: ${events.length} • Saved notes: ${notes.length} • NexusNova is ready for your day.`;
  };

  window.nxGenerateLesson=()=>{
    const topic=$("nxLessonTopic")?.value.trim()||"Lesson";
    const notes=$("nxLessonNotes")?.value.trim()||"";
    $("nxLessonOut").innerHTML=`<b>${esc(topic)}</b><br>1. Objective<br>2. Introduction<br>3. Explanation<br>4. Guided practice<br>5. Assessment<br>6. Homework<br><small>${esc(notes)}</small>`;
  };
  window.nxGenerateQuiz=()=>{
    const topic=$("nxQuizTopic")?.value.trim()||"General Knowledge";
    const n=Math.max(1,Math.min(30,Number($("nxQuizCount")?.value)||10));
    $("nxQuizOut").innerHTML=`<b>${esc(topic)} — ${n} questions</b><br>`+
      Array.from({length:n},(_,i)=>`${i+1}. Explain/answer a key concept from ${esc(topic)}.`).join("<br>");
  };
  window.nxGrade=()=>{
    const m=Number($("nxMarks")?.value), t=Number($("nxTotal")?.value);
    if(!Number.isFinite(m)||!Number.isFinite(t)||t<=0){$("nxGradeOut").textContent="Enter valid marks and total.";return;}
    const p=Math.max(0,Math.min(100,m/t*100));
    const g=p>=80?"A+":p>=70?"A":p>=60?"B":p>=50?"C":p>=40?"D":"F";
    $("nxGradeOut").textContent=`${p.toFixed(1)}% • Grade ${g}`;
  };
  window.nxSaveTimetable=()=>{
    const v=$("nxTimetable")?.value||""; store("timetable",v);
    $("nxTimetableOut").textContent="Timetable saved on this device.";
  };

  function renderEvents(){
    const list=$("nxEventsList"); if(!list)return;
    const arr=load("events",[]).sort((a,b)=>new Date(a.date)-new Date(b.date));
    list.innerHTML=arr.length?arr.map((e,i)=>`<div class="saved-row"><b>${esc(e.title)}</b><span>${new Date(e.date).toLocaleString()}</span><small>${esc(e.note||"")}</small><button onclick="nxDeleteEvent(${i})">Delete</button></div>`).join(""):"No events yet.";
  }
  window.nxAddEvent=()=>{
    const title=$("nxEventTitle")?.value.trim(), date=$("nxEventDate")?.value, note=$("nxEventNote")?.value.trim();
    if(!title||!date)return;
    const arr=load("events",[]);arr.push({title,date,note});store("events",arr);renderEvents();
  };
  window.nxDeleteEvent=i=>{const a=load("events",[]);a.splice(i,1);store("events",a);renderEvents();};

  function renderDocs(){
    const list=$("nxDocsList");if(!list)return;
    const arr=load("docs",[]);
    list.innerHTML=arr.length?arr.map((d,i)=>`<div class="saved-row"><b>${esc(d.name)}</b><span>Expiry: ${esc(d.expiry||"—")}</span><small>${esc(d.note||"")}</small><button onclick="nxDeleteDocument(${i})">Delete</button></div>`).join(""):"No document reminders.";
  }
  window.nxAddDocument=()=>{
    const name=$("nxDocName")?.value.trim();if(!name)return;
    const arr=load("docs",[]);arr.push({name,expiry:$("nxDocExpiry")?.value||"",note:$("nxDocNote")?.value.trim()||""});store("docs",arr);renderDocs();
  };
  window.nxDeleteDocument=i=>{const a=load("docs",[]);a.splice(i,1);store("docs",a);renderDocs();};

  window.nxShopSearch=()=>{
    const q=($("nxShopSearch")?.value||"").toLowerCase();
    document.querySelectorAll("#nxShopProducts .product-card").forEach(c=>c.style.display=(!q||c.textContent.toLowerCase().includes(q))?"":"none");
  };
  window.nxAddCart=name=>{
    const n=Number($("nxCartCount")?.textContent||0)+1;
    if($("nxCartCount"))$("nxCartCount").textContent=n;
    const cart=load("cart",[]);cart.push({name,at:Date.now()});store("cart",cart);
  };

  window.nxTrackOrder=()=>{
    const n=$("nxOrderTrack")?.value.trim();
    $("nxOrderResult").textContent=n?`Tracking number ${n} saved for lookup. Live courier status needs a configured courier API.`:"Enter a tracking number.";
  };

  window.nxOpenPrayer=()=>{
    const url="https://www.islamicfinder.org/prayer-widget/";
    if(typeof window.nxOpenExternal==='function') window.nxOpenExternal(url);
    else window.open(url,"_blank","noopener,noreferrer");
  };

  function renderTasbeeh(){
    const n=Number(localStorage.getItem("nexus_tasbeeh")||0);
    if($("nxTasbeehOut"))$("nxTasbeehOut").innerHTML=`Tasbeeh count: <b>${n}</b> <button type="button" onclick="nxResetTasbeeh()">Reset</button>`;
  }
  window.nxTasbeeh=()=>{
    let n=Number(localStorage.getItem("nexus_tasbeeh")||0);
    n++;
    localStorage.setItem("nexus_tasbeeh",String(n));
    renderTasbeeh();
  };
  window.nxResetTasbeeh=()=>{
    localStorage.setItem("nexus_tasbeeh","0");
    renderTasbeeh();
  };
  window.nxHijri=()=>{
    const d=new Date();
    if($("nxTasbeehOut"))$("nxTasbeehOut").textContent=`Today: ${d.toLocaleDateString("en-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"})}`;
  };

  window.nxSecurityCheck=()=>{
    const https=location.protocol==="https:"||location.hostname==="localhost";
    const secure=window.isSecureContext;
    const net=navigator.onLine;
    if($("nxSecurityDevice"))$("nxSecurityDevice").textContent=`${secure?"Secure context":"Review browser context"} • ${navigator.platform||"browser"}`;
    if($("nxSecurityNetwork"))$("nxSecurityNetwork").textContent=net?"Online":"Offline";
    if($("nxSecurityResult"))$("nxSecurityResult").innerHTML=`HTTPS/local: <b>${https?"OK":"Review"}</b> • Secure context: <b>${secure?"OK":"Review"}</b> • Network: <b>${net?"Online":"Offline"}</b>`;
  };

  window.addEventListener("load",()=>{
    renderEvents();renderDocs();nxBuildDailyBrief();nxSecurityCheck();renderTasbeeh();
    const tt=load("timetable","");
    if($("nxTimetable"))$("nxTimetable").value=tt;

    setTimeout(()=>{
      loadLateScript('./js/nexusnova-learning-engine-v1.js?v=3','data-nx-learning-engine');
      loadLateScript('./js/nexusnova-islamic-extras-v1.js?v=1','data-nx-islamic-extras');
      loadLateScript('./js/nexusnova-ai-authority-v2.js?v=2','data-nx-ai-authority-v2');
      loadLateScript('./js/nexusnova-travel-live-v1.js?v=1','data-nx-travel-live');
    },1800);
  });

  console.log("NexusNova Super-App expansion V3 loaded.");
})();