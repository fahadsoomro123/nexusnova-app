/* NexusNova Bug Report Center v1
   User-submitted reports with opt-in sanitized diagnostics.
   No email, wallet address, search terms, messages, contacts or exact location
   are collected by this module. Reports are write-only from the app. */
(() => {
  'use strict';
  if (window.__nxBugReportV1) return;
  window.__nxBugReportV1 = true;
  window.nexusBugReportVersion = 'bug-report-v1';

  const FIREBASE_VERSION='12.1.0';
  const APP_URL=`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
  const AUTH_URL=`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
  const FS_URL=`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
  const CATEGORIES=['ui','login','mining','wallet','tasks','market','search','profile','growth','other'];
  const SEVERITIES=['low','medium','high','critical'];
  const recentErrors=[];
  let modal=null;
  let submitting=false;

  const clip=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
  function sanitizeError(value){
    let text=clip(value,500);
    text=text
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
      .replace(/0x[a-fA-F0-9]{40}/g,'[wallet]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g,'[number]')
      .replace(/https?:\/\/[^\s)]+/gi,'[url]');
    return clip(text,240);
  }
  function rememberError(value){
    const clean=sanitizeError(value);
    if(!clean)return;
    recentErrors.push(clean);
    while(recentErrors.length>5)recentErrors.shift();
  }
  window.addEventListener('error',event=>rememberError(event?.message||event?.error?.message||'Runtime error'));
  window.addEventListener('unhandledrejection',event=>rememberError(event?.reason?.message||event?.reason||'Unhandled promise rejection'));

  function browserFamily(){
    const ua=navigator.userAgent||'';
    if(/Edg\//i.test(ua))return'Edge';
    if(/Firefox\//i.test(ua))return'Firefox';
    if(/Chrome\//i.test(ua))return'Chrome';
    if(/Safari\//i.test(ua))return'Safari';
    return'Other';
  }
  function deviceClass(){
    if(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||''))return'mobile';
    return'desktop';
  }
  function viewportClass(){
    const w=window.innerWidth||0;
    if(w<600)return'small';
    if(w<1024)return'medium';
    return'large';
  }
  function currentFeature(){
    const active=document.querySelector('.tab.active[id^="tab-"]');
    return clip((active?.id||'tab-unknown').replace(/^tab-/,''),50).toLowerCase();
  }
  function diagnosticSummary(){
    const parts=[
      `feature=${currentFeature()}`,
      `browser=${browserFamily()}`,
      `device=${deviceClass()}`,
      `viewport=${viewportClass()}`,
      `online=${navigator.onLine?'yes':'no'}`
    ];
    recentErrors.slice(-5).forEach((err,i)=>parts.push(`error${i+1}=${err}`));
    return clip(parts.join(' | '),1200);
  }

  function ensureStyle(){
    if(document.getElementById('nxBugReportStyle'))return;
    const style=document.createElement('style');
    style.id='nxBugReportStyle';
    style.textContent=`
      #nxBugReportModal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(2,6,23,.84);backdrop-filter:blur(12px)}#nxBugReportModal[hidden]{display:none!important}
      .nx-bug-box{width:min(560px,100%);max-height:min(760px,92vh);overflow:auto;border-radius:22px;padding:20px;background:linear-gradient(160deg,#071522,#0b1220);border:1px solid rgba(248,113,113,.22);box-shadow:0 28px 90px rgba(0,0,0,.48);color:#eaf7ff}
      .nx-bug-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.nx-bug-kicker{font-size:9px;letter-spacing:.14em;font-weight:950;color:#fb7185}.nx-bug-title{font-size:22px;font-weight:950;margin-top:4px}.nx-bug-close{border:0;background:rgba(148,163,184,.12);color:#cbd5e1;width:34px;height:34px;border-radius:11px;cursor:pointer;font-size:18px}.nx-bug-sub{font-size:10px;line-height:1.55;color:#8297aa;margin-top:7px}
      .nx-bug-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.nx-bug-label{display:block;font-size:9px;color:#8ea2b4;font-weight:850;margin-bottom:5px}.nx-bug-input,.nx-bug-select,.nx-bug-text{width:100%;border-radius:12px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.78);color:#eef7ff;padding:11px 12px;outline:none}.nx-bug-text{min-height:145px;resize:vertical;line-height:1.5}.nx-bug-input:focus,.nx-bug-select:focus,.nx-bug-text:focus{border-color:rgba(34,211,238,.5)}
      .nx-bug-check{display:flex;gap:9px;align-items:flex-start;margin-top:11px;padding:10px;border-radius:12px;background:rgba(15,23,42,.52);border:1px solid rgba(148,163,184,.1);font-size:9px;color:#8499ad;line-height:1.45}.nx-bug-check input{margin-top:2px}.nx-bug-status{font-size:10px;color:#8297aa;min-height:18px;margin-top:10px}.nx-bug-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .nx-bug-launch{margin-top:12px}.nx-bug-note{font-size:9px;color:#758a9c;line-height:1.45;margin-top:7px}
      @media(max-width:520px){.nx-bug-grid,.nx-bug-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    ensureStyle();
    if(modal&&document.body.contains(modal))return modal;
    modal=document.createElement('div');
    modal.id='nxBugReportModal';
    modal.hidden=true;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="nx-bug-box">
      <div class="nx-bug-head"><div><div class="nx-bug-kicker">NEXUSNOVA QUALITY</div><div class="nx-bug-title">🐞 Report a Bug</div></div><button class="nx-bug-close" id="nxBugClose" type="button">×</button></div>
      <div class="nx-bug-sub">Tell us what went wrong. NexusNova can attach safe technical details automatically so the problem is easier to reproduce.</div>
      <div class="nx-bug-grid">
        <label><span class="nx-bug-label">CATEGORY</span><select id="nxBugCategory" class="nx-bug-select">${CATEGORIES.map(v=>`<option value="${v}">${v.toUpperCase()}</option>`).join('')}</select></label>
        <label><span class="nx-bug-label">SEVERITY</span><select id="nxBugSeverity" class="nx-bug-select"><option value="low">LOW</option><option value="medium" selected>MEDIUM</option><option value="high">HIGH</option><option value="critical">CRITICAL / APP BLOCKED</option></select></label>
      </div>
      <label style="display:block;margin-top:10px"><span class="nx-bug-label">WHAT HAPPENED?</span><textarea id="nxBugDescription" class="nx-bug-text" maxlength="2000" placeholder="Example: I opened Wallet, tapped Refresh and the loading state never finished. Tell us what you expected and what happened instead."></textarea></label>
      <label class="nx-bug-check"><input id="nxBugDiagnostics" type="checkbox" checked><span><strong style="color:#d8e7f2">Include safe diagnostics</strong><br>Current app section, coarse browser/device class, online status and up to 5 recent sanitized runtime errors. No email, wallet address, search text, messages, contacts or exact location.</span></label>
      <div id="nxBugStatus" class="nx-bug-status"></div>
      <div class="nx-bug-actions"><button class="action-btn" id="nxBugCancel" type="button">CANCEL</button><button class="action-btn primary" id="nxBugSubmit" type="button">SEND BUG REPORT</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close=()=>{modal.hidden=true;document.documentElement.style.overflow='';};
    modal.querySelector('#nxBugClose')?.addEventListener('click',close);
    modal.querySelector('#nxBugCancel')?.addEventListener('click',close);
    modal.querySelector('#nxBugSubmit')?.addEventListener('click',submitReport);
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    return modal;
  }

  function openReport(){
    const root=ensureModal();
    root.hidden=false;
    document.documentElement.style.overflow='hidden';
    const box=root.querySelector('#nxBugDescription');
    if(box&&!box.value)box.focus();
    const status=root.querySelector('#nxBugStatus');
    if(status)status.textContent=`Current section: ${currentFeature().toUpperCase()}`;
  }

  async function firebase(){
    const [appMod,authMod,fsMod]=await Promise.all([import(APP_URL),import(AUTH_URL),import(FS_URL)]);
    for(let i=0;i<40;i++){
      const app=appMod.getApps()[0];
      if(app)return{app,authMod,fsMod};
      await new Promise(r=>setTimeout(r,250));
    }
    throw new Error('Firebase is not ready yet.');
  }

  async function submitReport(){
    if(submitting)return;
    const root=ensureModal();
    const status=root.querySelector('#nxBugStatus');
    const button=root.querySelector('#nxBugSubmit');
    const category=String(root.querySelector('#nxBugCategory')?.value||'other');
    const severity=String(root.querySelector('#nxBugSeverity')?.value||'medium');
    const description=clip(root.querySelector('#nxBugDescription')?.value,2000);
    const includeDiagnostics=!!root.querySelector('#nxBugDiagnostics')?.checked;
    if(!CATEGORIES.includes(category)||!SEVERITIES.includes(severity))return;
    if(description.length<15){status.textContent='Please describe the bug in at least 15 characters.';status.style.color='#fbbf24';return;}
    submitting=true;button.disabled=true;status.textContent='Preparing secure report…';status.style.color='#8da2b6';
    try{
      if(typeof window.nexusRequireAppCheck==='function')await window.nexusRequireAppCheck();
      const {app,authMod,fsMod}=await firebase();
      const auth=authMod.getAuth(app);
      const user=auth.currentUser;
      if(!user)throw new Error('Please sign in before sending a bug report.');
      await user.getIdToken(true);
      const db=fsMod.getFirestore(app);
      const payload={
        category,severity,description,
        feature:currentFeature(),
        diagnosticsIncluded:includeDiagnostics,
        diagnostics:includeDiagnostics?diagnosticSummary():'',
        moduleVersion:'bug-report-v1',
        status:'new',
        createdAt:fsMod.serverTimestamp()
      };
      const ref=await fsMod.addDoc(fsMod.collection(db,'bugReports',user.uid,'items'),payload);
      status.textContent=`Report sent successfully. Report ID: ${ref.id}`;status.style.color='#4ade80';
      root.querySelector('#nxBugDescription').value='';
      setTimeout(()=>{if(modal&&!modal.hidden){modal.hidden=true;document.documentElement.style.overflow='';}},2200);
    }catch(error){
      const code=String(error?.code||'');
      if(code.includes('permission-denied')) status.textContent='Bug Report security rules are not published yet. App owner needs the one-time Firebase Rules update.';
      else status.textContent=clip(error?.message||'Bug report could not be sent. Please try again.',220);
      status.style.color='#f87171';
    }finally{submitting=false;button.disabled=false;}
  }

  function addLaunchCards(){
    for(const id of ['tab-about','tab-profile']){
      const host=document.getElementById(id);
      if(!host||host.querySelector('.nx-bug-launch'))continue;
      const card=document.createElement('div');
      card.className='card nx-bug-launch';
      card.innerHTML=`<div class="market-header"><div><h3>🐞 Bug Report</h3><div class="market-count">Help improve NexusNova</div></div><span style="font-size:9px;color:#fb7185;font-weight:900">QUALITY</span></div><div class="nx-bug-note">Found something broken? Send a report with optional safe diagnostics so the issue is easier to reproduce.</div><button class="action-btn" type="button" style="width:100%;margin-top:9px">REPORT A PROBLEM</button>`;
      card.querySelector('button')?.addEventListener('click',openReport);
      host.appendChild(card);
    }
  }

  function boot(){
    if(!document.body)return;
    ensureStyle();ensureModal();addLaunchCards();
    [500,1500,3000,6000].forEach(ms=>setTimeout(addLaunchCards,ms));
  }

  window.nexusOpenBugReport=openReport;
  window.nexusBugDiagnostics=Object.freeze({version:'safe-v1',recent:()=>[...recentErrors],summary:diagnosticSummary});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();