/* NexusNova NOVA AI V6 ULTIMATE + WORK MAX mobile controls */
(() => {
  'use strict';
  if (window.__nxNovaAIV6) return;
  window.__nxNovaAIV6 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);
  const defaults={mode:'chat',endpoint:'',token:'',workWorkspace:'NexusNova Work',workBackgroundOnce:false,lastWorkJob:''};
  const read=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {...defaults}}};
  const save=patch=>{const v={...read(),...patch};try{localStorage.setItem(CFG_KEY,JSON.stringify(v))}catch(_){}return v};
  const paired=()=>{const c=read();return !!(c.endpoint&&c.token)};

  function style(){
    if($('nxNovaV6Style'))return;
    const s=document.createElement('style');s.id='nxNovaV6Style';s.textContent=`
      #tab-ai .nx-v6-badge{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:3px 7px;border:1px solid #44474e;border-radius:999px;background:#25262a;color:#d8d9dd;font:750 9px/1 system-ui;vertical-align:middle}
      #tab-ai .nx-v6-badge b{font-size:9px}
      #tab-ai .nx-v6-mode::after{content:'✦';font-size:7px;margin-left:4px;opacity:.72}
      #tab-ai .nx-v6-work::after{content:'◆';font-size:7px;margin-left:4px;opacity:.72}
      #tab-ai .nx-v6-builder.active,#tab-ai .nx-v6-work.active{font-weight:800}
      #tab-ai .nx-v6-mini{display:block;color:#8b8f96;font:500 8px/1.25 system-ui;margin-top:2px}
    `;document.head.appendChild(s);
  }

  function status(text){const el=$('nxNovaAIStatus');if(el)el.textContent=text;}
  function openSettings(){$('nxNovaSettings')?.click();}
  function setInput(text){const i=$('aiInput');if(!i)return;i.value=text;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}
  function workspaceName(){return read().workWorkspace||'NexusNova Work';}
  function chooseWorkspace(){
    const current=workspaceName();const name=prompt('NOVA Work workspace name:',current);
    if(name===null)return false;const clean=String(name).trim().slice(0,140);if(!clean)return false;
    save({workWorkspace:clean});return true;
  }
  function baseUrl(){return String(read().endpoint||'').replace(/\/+$/,'');}
  function authHeaders(extra={}){return {'Content-Type':'application/json','X-NexusNova-Token':read().token,...extra};}
  async function workApi(path,options={}){
    if(!paired())throw new Error('Local AI not paired');
    const r=await window.fetch(baseUrl()+path,{...options,headers:authHeaders(options.headers||{})});
    const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;
  }
  function select(mode,preset=''){
    if(['work','website','dev','builder','power'].includes(mode)&&!paired()){
      status(`${mode==='work'?'NOVA Work MAX':mode==='builder'?'App Builder':mode==='power'?'Power V6 Ultimate':mode} ke liye Local AI pair karo`);openSettings();return false;
    }
    save({mode,reasoning:['work','research','power','builder'].includes(mode)?'deep':'auto',novaVersion:'6.2-work-max'});sync();if(preset)setInput(preset);return true;
  }

  async function pollJob(id,announce=false){
    if(!id||!paired())return;
    save({lastWorkJob:id});
    let tries=0;
    while(tries++<900){
      try{
        const j=await workApi(`/api/work/job?id=${encodeURIComponent(id)}`);const job=j.job||{};
        const p=(job.progress||[]).slice(-1)[0];status(`Work MAX • ${job.status||'working'}${p?.message?' • '+p.message:''}`);
        if(['completed','failed','cancelled','interrupted'].includes(job.status)){
          if(job.status==='completed'){status('Work MAX completed • result saved');if(announce)alert((job.result?.reply||'Work MAX completed.').slice(0,7000));}
          else{status(`Work MAX ${job.status} • ${job.error||'check jobs'}`);if(announce)alert(`Work MAX ${job.status}: ${job.error||''}`.slice(0,5000));}
          return job;
        }
      }catch(e){status('Work MAX status unavailable • '+e.message);return;}
      await new Promise(r=>setTimeout(r,4000));
    }
  }

  async function showJobs(){
    try{
      const j=await workApi(`/api/work/jobs?workspace=${encodeURIComponent(workspaceName())}`);const jobs=j.jobs||[];
      if(!jobs.length){alert('Is workspace me abhi koi background Work job nahi hai.');return;}
      const latest=jobs[0];let text=`Latest Work MAX job\n\n${latest.status}: ${latest.request}\nJob: ${latest.id}`;
      const p=(latest.progress||[]).slice(-1)[0];if(p?.message)text+=`\nProgress: ${p.message}`;
      if(latest.result?.reply)text+=`\n\nRESULT:\n${latest.result.reply}`;
      if(latest.error)text+=`\n\nERROR:\n${latest.error}`;
      alert(text.slice(0,8000));
      if(!['completed','failed','cancelled','interrupted'].includes(latest.status))pollJob(latest.id,false);
    }catch(e){alert('Work Jobs error: '+e.message);}
  }

  async function setWorkspaceInstructions(){
    if(!paired()){openSettings();return;}
    const text=prompt(`Instructions for “${workspaceName()}”:`,'');if(text===null||!String(text).trim())return;
    try{await workApi('/api/work/instructions',{method:'POST',body:JSON.stringify({workspace:workspaceName(),text:String(text).trim()})});status('Workspace instructions saved');}
    catch(e){alert('Instructions save error: '+e.message);}
  }

  function installWorkFetchBridge(){
    if(window.__nxNovaWorkFetchBridge)return;window.__nxNovaWorkFetchBridge=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      let isWorkChat=false;
      try{
        const url=String(input?.url||input||'');
        if(url.includes('/api/chat')&&init&&typeof init.body==='string'){
          const body=JSON.parse(init.body);
          if(body&&body.mode==='work'){
            isWorkChat=true;const c=read();body.work_workspace=workspaceName();body.work_background=!!c.workBackgroundOnce;
            if(c.workBackgroundOnce)save({workBackgroundOnce:false});
            init={...init,body:JSON.stringify(body)};
          }
        }
      }catch(_){}
      const resp=await nativeFetch(input,init);
      if(isWorkChat){
        try{
          resp.clone().json().then(j=>{if(j?.queued&&j?.job?.id){save({lastWorkJob:j.job.id});status('Work MAX queued • '+j.job.id);pollJob(j.job.id,false);}}).catch(()=>{});
        }catch(_){}
      }
      return resp;
    };
  }

  function ensureMode(modes,name,label,cls=''){
    if(!modes||modes.querySelector(`[data-mode="${name}"]`))return;
    const b=document.createElement('button');b.className=`nx-nova-mode ${cls}`.trim();b.dataset.mode=name;b.textContent=label;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();select(name);};modes.appendChild(b);
  }

  function ensureModes(){
    const modes=$('nxNovaAIModes');if(!modes)return;
    ensureMode(modes,'work','Work MAX','nx-v6-work');
    ensureMode(modes,'research','Research');
    ensureMode(modes,'website','Website');
    ensureMode(modes,'builder','App Builder','nx-v6-mode nx-v6-builder');
    ensureMode(modes,'power','Ultimate','nx-v6-mode');
  }

  function ensureBadge(){
    const title=document.querySelector('#tab-ai .nx-nova-title');if(!title)return;
    title.querySelectorAll('.nx-power-badge,.nx-v6-badge').forEach(x=>x.remove());
    const b=document.createElement('span');b.className='nx-v6-badge';b.innerHTML='<b>✦</b> WORK MAX';title.appendChild(b);
  }

  function plusItem(menu,key,icon,title,desc,handler,cls=''){
    if(menu.querySelector(`[data-v6="${key}"]`))return;
    const b=document.createElement('button');b.className=`nx-nova-plus-item ${cls}`.trim();b.dataset.v6=key;b.innerHTML=`<span style="width:18px;text-align:center">${icon}</span><span>${title}<small class="nx-v6-mini">${desc}</small></span>`;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();handler();};menu.appendChild(b);
  }

  function enhancePlus(){
    const menu=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!menu)return;
    menu.querySelectorAll('[data-power-v2]').forEach(x=>x.remove());
    plusItem(menu,'work','◆','NOVA Work MAX','Persistent projects • files • tasks • deliverables • resume',()=>{if(!paired()){select('work');return;}if(!chooseWorkspace())return;select('work',`NOVA WORK MAX: Continue workspace "${workspaceName()}". Pehle objective, workspace instructions, source files, pending tasks, notes aur artifacts inspect karo. Phir is outcome par end-to-end kaam karo: `);},'nx-v6-work');
    plusItem(menu,'work-background','↻','Delegate in Background','PC on ho to app band karke bhi local task continue',()=>{if(!paired()){select('work');return;}if(!chooseWorkspace())return;save({workBackgroundOnce:true});select('work',`NOVA WORK MAX BACKGROUND: Workspace "${workspaceName()}" me is task ko end-to-end complete karo. Files/context inspect karo, specialists/planner use karo, execute + verify + final deliverable save karo. Task: `);},'nx-v6-work');
    plusItem(menu,'work-jobs','☷','Work Jobs / Result','Latest background progress, status aur verified result',()=>showJobs(),'nx-v6-work');
    plusItem(menu,'work-instructions','⚙','Workspace Instructions','Is project ke durable rules/constraints save karo',()=>setWorkspaceInstructions(),'nx-v6-work');
    plusItem(menu,'builder','▣','Build a New App','Specialists → plan → create → build/test → review → export',()=>select('builder','APP BUILDER V6 ULTIMATE: Is app ko complete working project ki surat me banao. Specialist Council se architecture/UX/QA advice lo, sensible defaults use karo, project inspect/scaffold karo, core features implement karo, build/check run karo, reviewer/critic issues fix karo aur downloadable project export ke liye ready karo. App idea: '));
    plusItem(menu,'power','✦','Ultimate Power Task','Specialists → Planner → Worker → Reviewer → Red-Team Critic',()=>select('power','POWER V6 ULTIMATE: Is complex task ko end-to-end khud solve karo. Relevant specialist agents choose karo, project context aur zaroorat par fresh web research use karo; execute, build/test, diff/evidence verify karo; reviewer/red-team critic fail kare to correction passes chalao. Task: '),'nx-v6-mode');
  }

  function sync(){
    style();ensureModes();ensureBadge();enhancePlus();
    const c=read();document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===c.mode));
    const sub=$('nxNovaAISubtitle');
    if(sub){
      if(c.mode==='work')sub.textContent=paired()?`Work MAX • ${workspaceName()} • persistent`:'NOVA Work MAX • local AI required';
      else if(c.mode==='builder')sub.textContent=paired()?'App Builder V6 • specialists → build → verify':'App Builder V6 • local AI required';
      else if(c.mode==='power')sub.textContent=paired()?'V6 Ultimate • specialists → execute → red-team':'V6 Ultimate • local AI required';
      else if(c.mode==='research')sub.textContent='Research • multi-source deep reasoning';
      else if(c.mode==='website')sub.textContent='Website • autonomous repo workflow';
    }
    const st=$('nxNovaAIStatus');
    if(st&&!/working|thinking|local .*•/i.test(st.textContent||'')){
      if(c.mode==='work')st.textContent=paired()?`NOVA Work MAX ready • ${workspaceName()}`:'Pair Local AI for NOVA Work MAX';
      else if(c.mode==='builder')st.textContent=paired()?'App Builder V6 Ultimate ready':'Pair Local AI for App Builder';
      else if(c.mode==='power')st.textContent=paired()?'Power V6 Ultimate ready':'Pair Local AI for Ultimate';
    }
  }

  function init(){installWorkFetchBridge();sync();const tab=$('tab-ai');if(tab&&!tab.__nxV6Observer){const o=new MutationObserver(()=>requestAnimationFrame(sync));o.observe(tab,{childList:true,subtree:true});tab.__nxV6Observer=o;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [700,1500,3000,6000].forEach(ms=>setTimeout(sync,ms));
  const last=read().lastWorkJob;if(last&&paired())setTimeout(()=>pollJob(last,false),2200);
  window.NexusNovaV6={select,sync,paired,chooseWorkspace,workspaceName,showJobs,pollJob,setWorkspaceInstructions,version:'6.2.0-work-max'};
})();
