
/*
 NexusNova Super-App Mega Merge
 Additive layer for the existing Grok-modernized NexusNova project.
 Existing Mining/Wallet/AI/Chat/Location/Emergency/Market modules remain untouched.
*/
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
  const read = (k,d=[]) => { try { return JSON.parse(localStorage.getItem("nxmega_"+k)) ?? d; } catch { return d; } };
  const write = (k,v) => localStorage.setItem("nxmega_"+k, JSON.stringify(v));
  const go = name => window.openMoreTab ? window.openMoreTab(name) : window.switchTab?.(name);
  const toast = msg => {
    let e = $("nxMegaToast");
    if (!e) {
      e = document.createElement("div");
      e.id = "nxMegaToast";
      e.className = "nxmega-toast";
      document.body.appendChild(e);
    }
    e.textContent = msg; e.classList.add("show");
    clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("show"), 2200);
  };
  const addMenu = (name, icon, label) => {
    const box = document.querySelector("#moreMenu .more-inner");
    if (!box || box.querySelector(`[data-nxmega="${name}"]`)) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "more-item"; b.dataset.nxmega = name;
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.onclick = () => go(name);
    box.appendChild(b);
  };
  const addTab = (name, html) => {
    if ($("tab-"+name)) return;
    const main = document.querySelector("main.main") || document.querySelector("main");
    if (!main) return;
    const s = document.createElement("section");
    s.id = "tab-"+name; s.className = "tab nxmega-tab"; s.innerHTML = html;
    main.appendChild(s);
  };
  const btn = (id, fn) => $(id)?.addEventListener("click", fn);

  /* ---------- Universal Search ---------- */
  const featureIndex = [
    ["AI Assistant","ai",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="10" rx="2"/><path d="M12 4v4M9 18v2M15 18v2M7 12H4M20 12h-3"/></svg></span>'],["Chat","chat",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v10H8l-3 3V5z"/></svg></span>'],["Location","location",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>'],
    ["Emergency","emergency",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg></span>'],["Family Hub","family",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M14 14c2.5 0 4.5 1.5 5 4"/></svg></span>'],
    ["Wallet","wallet",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 10h18M16 14h2"/></svg></span>'],["Mining","home",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.8z"/></svg></span>'],["Market","market",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V8l4 4 4-6 4 5 4-3v10z"/></svg></span>'],
    ["Tasks","tasks",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7h11M9 12h11M9 17h11"/><path d="M5 7h.01M5 12h.01M5 17h.01"/></svg></span>'],["Daily Tools","mega-tools",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2 2.1-2-2 2.1-2.1z"/></svg></span>'],["Finance","mega-finance",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M12 11v5"/></svg></span>'],
    ["Calendar","mega-calendar",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg></span>'],["Reminders","mega-reminders",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg></span>'],
    ["Weather","mega-weather",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16a4 4 0 1 1 1-7.8A5 5 0 0 1 20 11a3 3 0 0 1 0 5H7z"/><path d="M12 4v2"/></svg></span>'],["Browser","browser",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></span>'],["Learning","mega-learning",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l8-3 8 3v10l-8 3-8-3V6z"/><path d="M12 3v16"/></svg></span>'],
    ["Travel","travel",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14l-5 5M14 14l5 5M3 11l9-7 9 7"/><path d="M5 11h14v3H5z"/></svg></span>'],["Entertainment","entertainment",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 10l5 2-5 2v-4z"/></svg></span>'],["Pakistan News","mega-pakistan",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v14H5z"/><path d="M9 12h6M12 9v6"/></svg></span>'],
    ["Islamic Hub","mega-islamic",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20V12l6-5 6 5v8"/><path d="M12 7V4"/></svg></span>'],["Qibla","qibla",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-5M12 3v3M12 18v3"/></svg></span>'],["Contacts","mega-contacts",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h8l2 2v14H7V4z"/><path d="M10 10h4M10 14h4"/></svg></span>'],
    ["Shopping","mega-shopping",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h15l-1.5 9H8L6 7z"/><path d="M6 7 5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg></span>'],["Documents","mega-documents",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span>'],["File Vault","mega-vault",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4V7z"/><path d="M9 7V5h6v2"/></svg></span>'],
    ["QR Tools","mega-qr",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg></span>'],["Security","mega-security",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/></svg></span>'],["Marketplace","mega-marketplace",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16v9H4v-9z"/><path d="M4 10l2-5h12l2 5M9 14h6"/></svg></span>'],
    ["Orders & Delivery","mega-orders",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10l2 4v8H5v-8l2-4z"/><path d="M9 15h6"/></svg></span>'],["Caller ID","caller-id",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h3l1 4-2 1a12 12 0 0 0 5 5l1-2 4 1v3a2 2 0 0 1-2 2A14 14 0 0 1 6 5a2 2 0 0 1 2-2z"/></svg></span>'],
    ["Notifications","mega-notifications",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg></span>'],["Teacher Toolkit","mega-teacher",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/><path d="M16 6l3-1v4"/></svg></span>'],
    ["Habits","mega-habits",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10z"/></svg></span>'],["Savings Goals","mega-savings",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2"/></svg></span>']
  ];
  function searchFeatures() {
    const q = ($("nxMegaSearch")?.value || "").trim().toLowerCase();
    const box = $("nxMegaSearchResults"); if (!box) return;
    const rows = featureIndex.filter(x => !q || x[0].toLowerCase().includes(q));
    box.innerHTML = rows.map(x =>
      `<button class="nxmega-search-row" type="button" data-target="${x[1]}"><span>${x[2]}</span><b>${esc(x[0])}</b></button>`
    ).join("") || `<div class="nxmega-muted">No feature found.</div>`;
    box.querySelectorAll("[data-target]").forEach(b => b.onclick = () => go(b.dataset.target));
  }

  /* ---------- Notes / Todo / Calendar / Reminders ---------- */
  function renderList(key, id, template, empty="Nothing yet.") {
    const a = read(key); const box = $(id); if (!box) return;
    box.innerHTML = a.length ? a.map((x,i)=>template(x,i)).join("") : `<div class="nxmega-muted">${empty}</div>`;
  }
  function addNote() {
    const title = $("nxMegaNoteTitle")?.value.trim(), text = $("nxMegaNoteText")?.value.trim();
    if (!title && !text) return;
    const a = read("notes"); a.unshift({title:title||"Note", text, at:Date.now()}); write("notes",a);
    $("nxMegaNoteTitle").value=""; $("nxMegaNoteText").value=""; renderNotes(); toast("Note saved");
  }
  function renderNotes() {
    renderList("notes","nxMegaNotes",(x,i)=>`<div class="nxmega-item"><div><b>${esc(x.title)}</b><small>${esc(x.text)}</small></div><button class="action-btn danger" data-del-note="${i}">×</button></div>`);
    $("nxMegaNotes")?.querySelectorAll("[data-del-note]").forEach(b=>b.onclick=()=>{const a=read("notes");a.splice(+b.dataset.delNote,1);write("notes",a);renderNotes()});
  }
  function addTodo() {
    const x=$("nxMegaTodo")?.value.trim(); if(!x)return;
    const a=read("todos"); a.push({text:x,done:false,at:Date.now()}); write("todos",a);
    $("nxMegaTodo").value=""; renderTodos();
  }
  function renderTodos() {
    renderList("todos","nxMegaTodos",(x,i)=>`<div class="nxmega-item"><label><input type="checkbox" data-todo="${i}" ${x.done?"checked":""}> ${esc(x.text)}</label><button class="action-btn danger" data-del-todo="${i}">×</button></div>`);
    $("nxMegaTodos")?.querySelectorAll("[data-todo]").forEach(b=>b.onchange=()=>{const a=read("todos");a[+b.dataset.todo].done=b.checked;write("todos",a);renderTodos()});
    $("nxMegaTodos")?.querySelectorAll("[data-del-todo]").forEach(b=>b.onclick=()=>{const a=read("todos");a.splice(+b.dataset.delTodo,1);write("todos",a);renderTodos()});
  }
  function addEvent() {
    const title=$("nxMegaEvent")?.value.trim(), when=$("nxMegaEventDate")?.value; if(!title||!when)return;
    const a=read("events");a.push({title,when:new Date(when).getTime()});a.sort((x,y)=>x.when-y.when);write("events",a);
    $("nxMegaEvent").value="";$("nxMegaEventDate").value="";renderEvents();toast("Event saved");
  }
  function renderEvents(){renderList("events","nxMegaEvents",(x,i)=>`<div class="nxmega-item"><div><b>${esc(x.title)}</b><small>${new Date(x.when).toLocaleString()}</small></div><button class="action-btn danger" data-del-event="${i}">×</button></div>`);$("nxMegaEvents")?.querySelectorAll("[data-del-event]").forEach(b=>b.onclick=()=>{const a=read("events");a.splice(+b.dataset.delEvent,1);write("events",a);renderEvents()})}
  function addReminder() {
    const text=$("nxMegaReminder")?.value.trim(), when=$("nxMegaReminderDate")?.value;if(!text||!when)return;
    const a=read("reminders");a.push({text,when:new Date(when).getTime(),fired:false});write("reminders",a);
    $("nxMegaReminder").value="";$("nxMegaReminderDate").value="";renderReminders();toast("Reminder saved");
  }
  function renderReminders(){renderList("reminders","nxMegaReminders",(x,i)=>`<div class="nxmega-item"><div><b>${esc(x.text)}</b><small>${new Date(x.when).toLocaleString()}</small></div><button class="action-btn danger" data-del-rem="${i}">×</button></div>`);$("nxMegaReminders")?.querySelectorAll("[data-del-rem]").forEach(b=>b.onclick=()=>{const a=read("reminders");a.splice(+b.dataset.delRem,1);write("reminders",a);renderReminders()})}
  setInterval(()=>{
    const a=read("reminders"), now=Date.now(); let changed=false;
    a.forEach(x=>{if(!x.fired&&x.when<=now){x.fired=true;changed=true;toast("Reminder: "+x.text);if("Notification"in window&&Notification.permission==="granted")new Notification("NexusNova Reminder",{body:x.text})}});
    if(changed)write("reminders",a);
  },15000);

  /* ---------- Finance / Savings ---------- */
  function addExpense(){
    const n=$("nxMegaExpense")?.value.trim(), v=+$("nxMegaExpenseAmt")?.value;if(!n||!(v>0))return;
    const a=read("expenses");a.unshift({name:n,amount:v,at:Date.now()});write("expenses",a);
    $("nxMegaExpense").value="";$("nxMegaExpenseAmt").value="";renderExpenses();
  }
  function renderExpenses(){
    const a=read("expenses"),total=a.reduce((s,x)=>s+x.amount,0);
    $("nxMegaExpenseTotal").textContent=`Total logged: ${total.toFixed(2)}`;
    renderList("expenses","nxMegaExpenses",(x,i)=>`<div class="nxmega-row"><span>${esc(x.name)}</span><b>${x.amount.toFixed(2)}</b></div>`);
  }
  function calcEMI(){
    const p=+$("nxMegaLoanP").value,r=+$("nxMegaLoanR").value/1200,n=+$("nxMegaLoanN").value;
    if(!(p>0&&n>0))return $("nxMegaLoanOut").textContent="Enter loan amount and months.";
    const m=r?p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):p/n;
    $("nxMegaLoanOut").textContent=`Monthly: ${m.toFixed(2)} · Total: ${(m*n).toFixed(2)}`;
  }
  function calcTip(){
    const b=+$("nxMegaTipB").value,t=+$("nxMegaTipT").value,p=Math.max(1,+$("nxMegaTipP").value||1);
    $("nxMegaTipOut").textContent=`Each: ${(b*(1+t/100)/p).toFixed(2)}`;
  }
  function calcSplit(){
    const b=+$("nxMegaSplitB").value,p=Math.max(1,+$("nxMegaSplitP").value||1);
    $("nxMegaSplitOut").textContent=`Each: ${(b/p).toFixed(2)}`;
  }
  function addSaving(){
    const name=$("nxMegaSaveName")?.value.trim(), target=+$("nxMegaSaveTarget").value, current=+$("nxMegaSaveCurrent").value||0;
    if(!name||!(target>0))return; const a=read("savings");a.push({name,target,current});write("savings",a);
    $("nxMegaSaveName").value="";$("nxMegaSaveTarget").value="";$("nxMegaSaveCurrent").value="";renderSavings();
  }
  function renderSavings(){renderList("savings","nxMegaSavings",(x,i)=>{const p=Math.min(100,x.current/x.target*100);return `<div class="nxmega-goal"><b>${esc(x.name)}</b><span>${x.current.toFixed(2)} / ${x.target.toFixed(2)}</span><div class="nxmega-progress"><i style="width:${p}%"></i></div><small>${p.toFixed(0)}% complete</small></div>`})}

  /* ---------- Habits ---------- */
  function addHabit(){const x=$("nxMegaHabit")?.value.trim();if(!x)return;const a=read("habits");a.push({name:x,days:0,last:""});write("habits",a);$("nxMegaHabit").value="";renderHabits()}
  function renderHabits(){renderList("habits","nxMegaHabits",(x,i)=>`<div class="nxmega-item"><div><b>${esc(x.name)}</b><small>${x.days} check-in(s)</small></div><button class="action-btn" data-habit="${i}">✓ Today</button></div>`);$("nxMegaHabits")?.querySelectorAll("[data-habit]").forEach(b=>b.onclick=()=>{const a=read("habits"),h=a[+b.dataset.habit],today=new Date().toISOString().slice(0,10);if(h.last!==today){h.days++;h.last=today;write("habits",a);renderHabits();toast("Habit checked")}})}

  /* ---------- Weather ---------- */
  async function weather(){
    const o=$("nxMegaWeatherOut");o.textContent="Requesting location…";
    if(!navigator.geolocation)return o.textContent="Location is not available.";
    navigator.geolocation.getCurrentPosition(async p=>{
      try{
        const u=`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto`;
        const d=await fetch(u).then(r=>r.json()),c=d.current,day=d.daily;
        o.innerHTML=`<strong>${c.temperature_2m}°C</strong><span>Feels ${c.apparent_temperature}°C · Humidity ${c.relative_humidity_2m}% · Wind ${c.wind_speed_10m} km/h</span><small>Today ${day.temperature_2m_min[0]}°–${day.temperature_2m_max[0]}°C · Rain ${day.precipitation_probability_max[0]}%</small>`;
      }catch{o.textContent="Weather service unavailable."}
    },()=>o.textContent="Location permission denied.");
  }

  /* ---------- Browser enhancement ---------- */
  function safeWebUrl(value){try{const u=new URL(String(value||""));return (u.protocol==="https:"||u.protocol==="http:")?u.href:""}catch{return ""}}
  function openMegaUrl(u){
    const safe=safeWebUrl(u);if(!safe)return;
    if(window.NexusAndroid && typeof window.NexusAndroid.openExternal === "function"){try{window.NexusAndroid.openExternal(safe)}catch(_){};return}
    const frame=$("nxMegaFrame");if(frame)frame.src=safe;
  }
  function browserGo(){
    let q=$("nxMegaBrowserUrl")?.value.trim();if(!q)return;
    const u=/^https?:\/\//i.test(q)?safeWebUrl(q):"https://www.google.com/search?q="+encodeURIComponent(q);
    if(!u)return;
    openMegaUrl(u); const h=read("browserHistory");h.unshift({u,at:Date.now()});write("browserHistory",h.slice(0,50));
  }
  function bookmark(){const u=$("nxMegaFrame")?.src;if(!u||u==="about:blank")return;const a=read("bookmarks");if(!a.includes(u)){a.unshift(u);write("bookmarks",a);renderBookmarks();toast("Bookmark saved")}}
  function renderBookmarks(){renderList("bookmarks","nxMegaBookmarks",(u,i)=>{const safe=safeWebUrl(u);return `<div class="nxmega-row"><a href="${esc(safe||"#")}" target="_blank" rel="noopener noreferrer">${esc(u)}</a><button class="action-btn" data-open-book="${i}">Open</button></div>`});$("nxMegaBookmarks")?.querySelectorAll("[data-open-book]").forEach(b=>b.onclick=()=>openMegaUrl(read("bookmarks")[+b.dataset.openBook]))}

  /* ---------- QR / Contacts / Shopping ---------- */
  function qr(){const x=$("nxMegaQRText")?.value.trim();if(!x)return;$("nxMegaQROut").innerHTML=`<img alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(x)}">`}
  function addContact(){const n=$("nxMegaContactName")?.value.trim(),p=$("nxMegaContactPhone")?.value.trim();if(!n||!p)return;const a=read("contacts");a.push({n,p});write("contacts",a);$("nxMegaContactName").value="";$("nxMegaContactPhone").value="";renderContacts()}
  function renderContacts(){renderList("contacts","nxMegaContacts",(x)=>`<div class="nxmega-row"><span>${esc(x.n)}<small>${esc(x.p)}</small></span><a class="action-btn" href="tel:${esc(x.p)}">Call</a></div>`)}
  function addShopping(){const x=$("nxMegaShopping")?.value.trim();if(!x)return;const a=read("shopping");a.push({x,done:false});write("shopping",a);$("nxMegaShopping").value="";renderShopping()}
  function renderShopping(){renderList("shopping","nxMegaShoppingList",(x,i)=>`<div class="nxmega-item"><label><input type="checkbox" data-shop="${i}" ${x.done?"checked":""}> ${esc(x.x)}</label></div>`);$("nxMegaShoppingList")?.querySelectorAll("[data-shop]").forEach(b=>b.onchange=()=>{const a=read("shopping");a[+b.dataset.shop].done=b.checked;write("shopping",a)})}

  /* ---------- Documents / File Vault ---------- */
  function inspectFiles(){
    const files=$("nxMegaFiles")?.files,box=$("nxMegaFileList");if(!files||!box)return;
    box.innerHTML=Array.from(files).map(f=>`<div class="nxmega-row"><span>${esc(f.name)}</span><small>${Math.round(f.size/1024)} KB · ${esc(f.type||"file")}</small></div>`).join("")||"Choose files.";
  }
  function analyzeDocument(){
    const f=$("nxMegaDoc")?.files[0];if(!f)return;
    $("nxMegaDocOut").textContent=`Loaded ${f.name}.`;
    if(window.handleAIImage&&f.type.startsWith("image/")){try{window.handleAIImage($("nxMegaDoc"))}catch{}}
  }

  /* ---------- Islamic / Qibla ---------- */
  async function prayer(){
    const o=$("nxMegaPrayerOut");o.textContent="Requesting location…";
    navigator.geolocation?.getCurrentPosition(async p=>{
      try{
        const u=`https://api.aladhan.com/v1/timings?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&method=2`;
        const d=await fetch(u).then(r=>r.json()),t=d.data.timings;
        o.innerHTML=`Fajr ${t.Fajr} · Dhuhr ${t.Dhuhr} · Asr ${t.Asr}<br>Maghrib ${t.Maghrib} · Isha ${t.Isha}`;
      }catch{o.textContent="Prayer service unavailable."}
    },()=>o.textContent="Location permission required.");
  }
  function qibla(){
    navigator.geolocation?.getCurrentPosition(p=>{
      const lat=p.coords.latitude*Math.PI/180,lon=p.coords.longitude*Math.PI/180,ka=21.422487*Math.PI/180,ko=39.826206*Math.PI/180;
      const y=Math.sin(ko-lon),x=Math.cos(lat)*Math.tan(ka)-Math.sin(lat)*Math.cos(ko-lon);
      const deg=(Math.atan2(y,x)*180/Math.PI+360)%360;
      $("nxMegaQiblaOut").innerHTML=`<strong>${deg.toFixed(1)}°</strong> from North`;
    },()=>$("nxMegaQiblaOut").textContent="Location permission required.");
  }

  /* ---------- News ---------- */
  async function news(feed,label){
    const o=$("nxMegaNewsOut");o.textContent="Loading…";
    try{
      const d=await fetch("https://api.rss2json.com/v1/api.json?rss_url="+encodeURIComponent(feed)).then(r=>r.json());
      o.innerHTML=(d.items||[]).slice(0,12).map(x=>{const link=safeWebUrl(x.link);return `<div class="nxmega-news"><a href="${esc(link||"#")}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><small>${esc(label)}</small></div>`}).join("")||"No headlines.";
    }catch{o.textContent="Feed unavailable."}
  }

  /* ---------- Teacher ---------- */
  function grades(){
    const a=($("nxMegaGrades")?.value||"").split(",").map(Number).filter(Number.isFinite);if(!a.length)return;
    $("nxMegaGradeOut").textContent=`Average ${(a.reduce((s,x)=>s+x,0)/a.length).toFixed(2)} · Highest ${Math.max(...a)} · Lowest ${Math.min(...a)}`;
  }

  /* ---------- Build ---------- */
  function build(){
    [
      ["mega-hub",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.8z"/></svg></span>',"Super App"],["mega-tools",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2 2.1-2-2 2.1-2.1z"/></svg></span>',"Daily Tools"],["mega-calendar",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg></span>',"Calendar"],
      ["mega-reminders",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg></span>',"Reminders"],["mega-finance",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M12 11v5"/></svg></span>',"Finance"],["mega-weather",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16a4 4 0 1 1 1-7.8A5 5 0 0 1 20 11a3 3 0 0 1 0 5H7z"/><path d="M12 4v2"/></svg></span>',"Weather"],
      ["mega-learning",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l8-3 8 3v10l-8 3-8-3V6z"/><path d="M12 3v16"/></svg></span>',"Learning"],["mega-pakistan",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v14H5z"/><path d="M9 12h6M12 9v6"/></svg></span>',"Pakistan Hub"],["mega-islamic",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20V12l6-5 6 5v8"/><path d="M12 7V4"/></svg></span>',"Islamic Hub"],
      ["mega-habits",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10z"/></svg></span>',"Habits"],["mega-savings",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2"/></svg></span>',"Savings"],["mega-contacts",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h8l2 2v14H7V4z"/><path d="M10 10h4M10 14h4"/></svg></span>',"Contacts"],
      ["mega-shopping",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h15l-1.5 9H8L6 7z"/><path d="M6 7 5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg></span>',"Shopping"],["mega-documents",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span>',"Documents"],["mega-vault",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4V7z"/><path d="M9 7V5h6v2"/></svg></span>',"File Vault"],
      ["mega-qr",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg></span>',"QR Tools"],["mega-security",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/></svg></span>',"Security"],["mega-marketplace",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16v9H4v-9z"/><path d="M4 10l2-5h12l2 5M9 14h6"/></svg></span>',"Marketplace"],
      ["mega-orders",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10l2 4v8H5v-8l2-4z"/><path d="M9 15h6"/></svg></span>',"Orders"],["mega-notifications",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg></span>',"Notifications"],["mega-teacher",'<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/><path d="M16 6l3-1v4"/></svg></span>',"Teacher Toolkit"]
    ].forEach(x=>addMenu(...x));
    // Settings entry in more menu
    addMenu("about", '<span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span>', "Settings");

    addTab("mega-hub",`
      <div class="card nxmega-hero"><div class="hub-kicker">NEXUSNOVA SUPER-APP</div><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.8z"/></svg></span> Everything in One Place</h2>
      <p>Universal search and command center for the features we planned.</p>
      <div class="nxmega-search"><input id="nxMegaSearch" class="tool-input" placeholder="Search any NexusNova feature..."><button id="nxMegaSearchBtn" class="tool-btn primary">Search</button></div>
      <div id="nxMegaSearchResults" class="nxmega-search-results"></div></div>
      <div class="card"><div class="nxmega-grid three">
      <button class="action-btn" onclick="openMoreTab('ai')"><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="10" rx="2"/><path d="M12 4v4M9 18v2M15 18v2M7 12H4M20 12h-3"/></svg></span> AI Assistant</button><button class="action-btn" onclick="openMoreTab('wallet')"><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 10h18M16 14h2"/></svg></span> Wallet</button>
      <button class="action-btn" onclick="openMoreTab('market')"><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V8l4 4 4-6 4 5 4-3v10z"/></svg></span> Market</button><button class="action-btn" onclick="openMoreTab('family')"><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M14 14c2.5 0 4.5 1.5 5 4"/></svg></span> Family</button>
      <button class="action-btn" onclick="openMoreTab('emergency')">🚨 Emergency</button><button class="action-btn" onclick="openMoreTab('location')"><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span> Location</button>
      </div></div>`);

    addTab("mega-tools",`
      <div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2 2.1-2-2 2.1-2.1z"/></svg></span> Daily Tools</h2><p>Calculator, notes, tasks and focus tools.</p></div>
      <div class="card"><h3>Calculator</h3><div class="nxmega-inline"><input id="nxMegaCalc" class="tool-input" placeholder="125*4+20"><button id="nxMegaCalcBtn" class="tool-btn primary">Calculate</button></div><div id="nxMegaCalcOut" class="tool-result">—</div></div>
      <div class="card"><h3>Notes</h3><input id="nxMegaNoteTitle" class="tool-input" placeholder="Title"><textarea id="nxMegaNoteText" class="tool-input nxmega-area" placeholder="Write a note..."></textarea><button id="nxMegaNoteBtn" class="tool-btn primary">Save Note</button><div id="nxMegaNotes"></div></div>
      <div class="card"><h3>To-Do</h3><div class="nxmega-inline"><input id="nxMegaTodo" class="tool-input" placeholder="New task"><button id="nxMegaTodoBtn" class="tool-btn primary">Add</button></div><div id="nxMegaTodos"></div></div>`);

    addTab("mega-calendar",`<div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg></span> Calendar</h2><input id="nxMegaEvent" class="tool-input" placeholder="Event title"><input id="nxMegaEventDate" type="datetime-local" class="tool-input"><button id="nxMegaEventBtn" class="tool-btn primary">Add Event</button><div id="nxMegaEvents"></div></div>`);
    addTab("mega-reminders",`<div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg></span> Reminders</h2><button id="nxMegaNotifyBtn" class="tool-btn">Enable Notifications</button><div class="nxmega-inline"><input id="nxMegaReminder" class="tool-input" placeholder="Reminder"><input id="nxMegaReminderDate" type="datetime-local" class="tool-input"><button id="nxMegaReminderBtn" class="tool-btn primary">Add</button></div><div id="nxMegaReminders"></div></div>`);

    addTab("mega-finance",`
      <div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M12 11v5"/></svg></span> Finance Center</h2><p>Expenses, savings goals and calculators.</p></div>
      <div class="card"><h3>Expenses</h3><div class="nxmega-inline"><input id="nxMegaExpense" class="tool-input" placeholder="Expense"><input id="nxMegaExpenseAmt" type="number" class="tool-input" placeholder="Amount"><button id="nxMegaExpenseBtn" class="tool-btn primary">Add</button></div><div id="nxMegaExpenseTotal" class="tool-result">Total logged: 0</div><div id="nxMegaExpenses"></div></div>
      <div class="card"><h3>Loan / EMI</h3><div class="nxmega-grid three"><input id="nxMegaLoanP" type="number" class="tool-input" placeholder="Amount"><input id="nxMegaLoanR" type="number" class="tool-input" placeholder="Annual %"><input id="nxMegaLoanN" type="number" class="tool-input" placeholder="Months"></div><button id="nxMegaLoanBtn" class="tool-btn primary">Calculate</button><div id="nxMegaLoanOut" class="tool-result">—</div></div>
      <div class="card"><h3>Tip & Bill Split</h3><div class="nxmega-grid three"><input id="nxMegaTipB" type="number" class="tool-input" placeholder="Bill"><input id="nxMegaTipT" type="number" class="tool-input" placeholder="Tip %"><input id="nxMegaTipP" type="number" class="tool-input" placeholder="People"></div><button id="nxMegaTipBtn" class="tool-btn">Tip</button><div id="nxMegaTipOut" class="tool-result">—</div><div class="nxmega-grid"><input id="nxMegaSplitB" type="number" class="tool-input" placeholder="Bill"><input id="nxMegaSplitP" type="number" class="tool-input" placeholder="People"></div><button id="nxMegaSplitBtn" class="tool-btn">Split</button><div id="nxMegaSplitOut" class="tool-result">—</div></div>
      <div class="card"><h3><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2"/></svg></span> Savings Goal</h3><div class="nxmega-grid three"><input id="nxMegaSaveName" class="tool-input" placeholder="Goal"><input id="nxMegaSaveTarget" type="number" class="tool-input" placeholder="Target"><input id="nxMegaSaveCurrent" type="number" class="tool-input" placeholder="Current"></div><button id="nxMegaSaveBtn" class="tool-btn primary">Add Goal</button><div id="nxMegaSavings"></div></div>`);

    addTab("mega-weather",`<div class="card nxmega-hero"><h2>🌦️ Weather</h2><button id="nxMegaWeatherBtn" class="tool-btn primary">Get Live Weather</button><div id="nxMegaWeatherOut" class="tool-result">—</div></div>`);

    addTab("mega-learning",`<div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l8-3 8 3v10l-8 3-8-3V6z"/><path d="M12 3v16"/></svg></span> Learning Hub</h2><input id="nxMegaStudy" class="tool-input" placeholder="Topic / question / solved paper"><button id="nxMegaStudyBtn" class="tool-btn primary">Search Web</button><button class="tool-btn" onclick="openMoreTab('ai')">Ask NexusNova AI</button><div class="nxmega-grid"><button class="tool-btn">📖 Solved Papers</button><button class="tool-btn">📝 Quiz</button><button class="tool-btn">📅 Study Planner</button><button class="tool-btn" onclick="openMoreTab('mega-teacher')">👨‍🏫 Teacher Toolkit</button></div></div>`);

    addTab("mega-pakistan",`<div class="card nxmega-hero"><h2>🇵🇰 Pakistan Hub</h2><div class="nxmega-grid four"><button class="tool-btn primary" id="nxMegaPak">Pakistan</button><button class="tool-btn" id="nxMegaUrdu">اردو</button><button class="tool-btn" id="nxMegaSindhi">سنڌي</button><button class="tool-btn" id="nxMegaWorld">World</button></div><div id="nxMegaNewsOut" class="tool-result">Choose a feed.</div><div class="nxmega-grid"><button class="tool-btn">🏛️ Government Services</button><button class="tool-btn">💡 Utilities</button><button class="tool-btn">💰 PKR / Gold</button></div></div>`);

    addTab("mega-islamic",`<div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20V12l6-5 6 5v8"/><path d="M12 7V4"/></svg></span> Islamic Hub</h2><div class="nxmega-grid"><button id="nxMegaPrayerBtn" class="tool-btn primary">Prayer Times</button><button class="tool-btn" onclick="openMoreTab('qibla')">Qibla</button><button class="tool-btn">Hijri Calendar</button><button class="tool-btn">Ramadan</button><button class="tool-btn">Sehri / Iftar</button><button class="tool-btn">99 Names & Duas</button></div><div id="nxMegaPrayerOut" class="tool-result">—</div></div>`);

    addTab("mega-habits",`<div class="card nxmega-hero"><h2>🔥 Habit Tracker</h2><div class="nxmega-inline"><input id="nxMegaHabit" class="tool-input" placeholder="New habit"><button id="nxMegaHabitBtn" class="tool-btn primary">Add</button></div><div id="nxMegaHabits"></div></div>`);
    addTab("mega-savings",`<div class="card nxmega-hero"><h2><span class="mi-icon nx3d-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2"/></svg></span> Savings Goals</h2><p>Track goals and progress.</p><div id="nxMegaSavings2"></div><button class="tool-btn" onclick="openMoreTab('mega-finance')">Manage Goals</button></div>`);

    addTab("mega-contacts",`<div class="card nxmega-hero"><h2>📇 Contacts</h2><div class="nxmega-inline"><input id="nxMegaContactName" class="tool-input" placeholder="Name"><input id="nxMegaContactPhone" class="tool-input" placeholder="Phone"><button id="nxMegaContactBtn" class="tool-btn primary">Add</button></div><div id="nxMegaContacts"></div></div>`);
    addTab("mega-shopping",`<div class="card nxmega-hero"><h2>🛒 Shopping Assistant</h2><div class="nxmega-inline"><input id="nxMegaShopping" class="tool-input" placeholder="Shopping item"><button id="nxMegaShoppingBtn" class="tool-btn primary">Add</button></div><div id="nxMegaShoppingList"></div><button id="nxMegaPriceBtn" class="tool-btn">Search Current Prices</button></div>`);

    addTab("mega-documents",`<div class="card nxmega-hero"><h2>📄 Document Scanner / OCR</h2><input id="nxMegaDoc" type="file" accept="image/*,.pdf" class="tool-input"><button id="nxMegaDocBtn" class="tool-btn primary">Analyze Document</button><div id="nxMegaDocOut" class="tool-result">—</div><div class="nxmega-grid"><button class="tool-btn">🧾 Receipt Scanner</button><button class="tool-btn">📑 PDF Maker</button></div></div>`);
    addTab("mega-vault",`<div class="card nxmega-hero"><h2>📂 Personal File Vault</h2><input id="nxMegaFiles" type="file" multiple class="tool-input"><div id="nxMegaFileList" class="tool-result">Choose files to inspect locally.</div><p class="nxmega-muted">Cloud-secure storage connects through the existing Firebase project; this screen never exposes server secrets.</p></div>`);
    addTab("mega-qr",`<div class="card nxmega-hero"><h2>▣ QR Tools</h2><input id="nxMegaQRText" class="tool-input" placeholder="URL / text"><button id="nxMegaQRBtn" class="tool-btn primary">Generate QR</button><div id="nxMegaQROut" class="nxmega-qr"></div><div class="nxmega-grid"><button class="tool-btn">📷 QR Scanner</button><button class="tool-btn">📶 Wi-Fi QR</button><button class="tool-btn">👤 Contact QR</button><button class="tool-btn">💳 Payment QR</button></div></div>`);

    addTab("mega-security",`<div class="card nxmega-hero"><h2>🔐 Security Center</h2><div class="nxmega-grid"><button class="tool-btn" onclick="openMoreTab('profile')">Account</button><button class="tool-btn" onclick="openMoreTab('about')">Privacy / Settings</button><button class="tool-btn">Permission Manager</button><button class="tool-btn">Wallet Security</button><button class="tool-btn">App Lock</button><button class="tool-btn">Data Backup</button></div><div class="integration-note">Privileged security controls are kept behind Firebase Auth and Android permissions rather than simulated in the browser.</div></div>`);

    addTab("mega-marketplace",`<div class="card nxmega-hero"><h2>🏪 Nexus Marketplace</h2><div class="nxmega-grid"><button class="tool-btn">Browse Categories</button><button class="tool-btn">My Listings</button><button class="tool-btn">Favorites</button><button class="tool-btn">Seller Dashboard</button><button class="tool-btn">Post New Item</button><button class="tool-btn">Buy / Sell</button></div><div class="integration-note">Marketplace data/payment endpoints are ready for Firebase Functions/provider integration; no fake transactions are created.</div></div>`);
    addTab("mega-orders",`<div class="card nxmega-hero"><h2>📦 Orders & Delivery</h2><div class="nxmega-grid"><button class="tool-btn">All Orders</button><button class="tool-btn">Processing</button><button class="tool-btn">Shipped</button><button class="tool-btn">Out for Delivery</button><button class="tool-btn">Delivered</button><button class="tool-btn">Return / Refund</button></div><div class="integration-note">Live courier tracking is connected through provider APIs in the backend phase.</div></div>`);

    addTab("mega-notifications",`<div class="card nxmega-hero"><h2>🔔 Notifications Center</h2><button id="nxMegaNotify" class="tool-btn primary">Enable Browser Notifications</button><div class="nxmega-grid"><button class="tool-btn">Mining Alerts</button><button class="tool-btn">Wallet Alerts</button><button class="tool-btn">Price Alerts</button><button class="tool-btn">News Alerts</button><button class="tool-btn">Reminder Alerts</button><button class="tool-btn">Task Rewards</button></div><div class="integration-note">Firebase Cloud Messaging is the production path for notifications while the app is closed; this browser layer handles permission and in-app reminders.</div></div>`);

    addTab("mega-teacher",`<div class="card nxmega-hero"><h2>👨‍🏫 Teacher Toolkit</h2><div class="nxmega-grid"><button class="tool-btn">Lesson Planner</button><button class="tool-btn">Quiz Maker</button><button class="tool-btn">Worksheet Maker</button><button class="tool-btn">Attendance</button></div><input id="nxMegaGrades" class="tool-input" placeholder="Grades: 80,72,91,65"><button id="nxMegaGradeBtn" class="tool-btn primary">Calculate Average</button><div id="nxMegaGradeOut" class="tool-result">—</div></div>`);

    /* Event wiring */
    btn("nxMegaSearchBtn", searchFeatures); $("nxMegaSearch")?.addEventListener("input",searchFeatures);
    btn("nxMegaCalcBtn",()=>{const v=$("nxMegaCalc").value.trim();if(!/^[0-9+\-*/%().\s]+$/.test(v))return $("nxMegaCalcOut").textContent="Invalid expression.";try{$("nxMegaCalcOut").textContent=String(Function('"use strict";return('+v+')')())}catch{$("nxMegaCalcOut").textContent="Invalid expression."}});
    btn("nxMegaNoteBtn",addNote);btn("nxMegaTodoBtn",addTodo);btn("nxMegaEventBtn",addEvent);btn("nxMegaReminderBtn",addReminder);
    btn("nxMegaNotifyBtn",async()=>{"Notification"in window?toast((await Notification.requestPermission())==="granted"?"Notifications enabled":"Notifications not enabled"):toast("Notifications not supported")});
    btn("nxMegaExpenseBtn",addExpense);btn("nxMegaLoanBtn",calcEMI);btn("nxMegaTipBtn",calcTip);btn("nxMegaSplitBtn",calcSplit);btn("nxMegaSaveBtn",addSaving);
    btn("nxMegaWeatherBtn",weather);btn("nxMegaStudyBtn",()=>{const q=$("nxMegaStudy").value.trim();if(q)window.open("https://www.google.com/search?q="+encodeURIComponent(q+" solved paper explanation"),"_blank","noopener")});
    btn("nxMegaPrayerBtn",prayer);btn("nxMegaHabitBtn",addHabit);btn("nxMegaContactBtn",addContact);btn("nxMegaShoppingBtn",addShopping);btn("nxMegaDocBtn",analyzeDocument);$("nxMegaFiles")?.addEventListener("change",inspectFiles);
    btn("nxMegaQRBtn",qr);btn("nxMegaGradeBtn",grades);
    btn("nxMegaPriceBtn",()=>{const q=$("nxMegaShopping").value.trim()||"product";window.open("https://www.google.com/search?q="+encodeURIComponent("best price "+q),"_blank","noopener")});
    btn("nxMegaPak",()=>news("https://www.dawn.com/feeds/home","Pakistan"));btn("nxMegaUrdu",()=>news("https://www.bbc.com/urdu/index.xml","Urdu"));btn("nxMegaSindhi",()=>news("https://www.bbc.com/sindhi/index.xml","Sindhi"));btn("nxMegaWorld",()=>news("https://feeds.bbci.co.uk/news/world/rss.xml","World"));
    btn("nxMegaNotify",async()=>{"Notification"in window?toast((await Notification.requestPermission())==="granted"?"Notifications enabled":"Notifications not enabled"):toast("Notifications not supported")});

    /* Second savings view mirrors finance data */
    const syncSavings=()=>{const b=$("nxMegaSavings2");if(b)b.innerHTML=read("savings").map(x=>`<div class="nxmega-goal"><b>${esc(x.name)}</b><span>${x.current}/${x.target}</span></div>`).join("")||"<div class='nxmega-muted'>No savings goals yet.</div>"};
    const oldRender=window.nxMegaSyncSavings; window.nxMegaSyncSavings=syncSavings;

    renderNotes();renderTodos();renderEvents();renderReminders();renderExpenses();renderSavings();renderHabits();renderContacts();renderShopping();renderBookmarks();syncSavings();searchFeatures();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(build,700),{once:true});
  else setTimeout(build,700);
})();
