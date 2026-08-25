/* NexusNova NOVA AI POWER V6 ULTIMATE mobile controls
   Lightweight UI layer over the existing NOVA AI shell.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIV6) return;
  window.__nxNovaAIV6 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);
  const read=()=>{try{return {mode:'chat',endpoint:'',token:'',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {mode:'chat',endpoint:'',token:''}}};
  const save=patch=>{const v={...read(),...patch};try{localStorage.setItem(CFG_KEY,JSON.stringify(v))}catch(_){}return v};
  const paired=()=>{const c=read();return !!(c.endpoint&&c.token)};

  function style(){
    if($('nxNovaV6Style'))return;
    const s=document.createElement('style');s.id='nxNovaV6Style';s.textContent=`
      #tab-ai .nx-v6-badge{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:3px 7px;border:1px solid #44474e;border-radius:999px;background:#25262a;color:#d8d9dd;font:750 9px/1 system-ui;vertical-align:middle}
      #tab-ai .nx-v6-badge b{font-size:9px}
      #tab-ai .nx-v6-mode::after{content:'✦';font-size:7px;margin-left:4px;opacity:.72}
      #tab-ai .nx-v6-builder.active{font-weight:800}
      #tab-ai .nx-v6-mini{display:block;color:#8b8f96;font:500 8px/1.25 system-ui;margin-top:2px}
    `;document.head.appendChild(s);
  }

  function status(text){const el=$('nxNovaAIStatus');if(el)el.textContent=text;}
  function openSettings(){$('nxNovaSettings')?.click();}
  function setInput(text){const i=$('aiInput');if(!i)return;i.value=text;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}
  function select(mode,preset=''){
    if(['website','dev','builder','power'].includes(mode)&&!paired()){
      status(`${mode==='builder'?'App Builder':mode==='power'?'Power V6 Ultimate':mode} ke liye Local AI pair karo`);openSettings();return false;
    }
    save({mode,reasoning:['research','power','builder'].includes(mode)?'deep':'auto',novaVersion:'6-ultimate'});sync();if(preset)setInput(preset);return true;
  }

  function ensureMode(modes,name,label,cls=''){
    if(!modes||modes.querySelector(`[data-mode="${name}"]`))return;
    const b=document.createElement('button');b.className=`nx-nova-mode ${cls}`.trim();b.dataset.mode=name;b.textContent=label;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();select(name);};modes.appendChild(b);
  }

  function ensureModes(){
    const modes=$('nxNovaAIModes');if(!modes)return;
    ensureMode(modes,'research','Research');
    ensureMode(modes,'website','Website');
    ensureMode(modes,'builder','App Builder','nx-v6-mode nx-v6-builder');
    ensureMode(modes,'power','Ultimate','nx-v6-mode');
  }

  function ensureBadge(){
    const title=document.querySelector('#tab-ai .nx-nova-title');if(!title)return;
    title.querySelectorAll('.nx-power-badge,.nx-v6-badge').forEach(x=>x.remove());
    const b=document.createElement('span');b.className='nx-v6-badge';b.innerHTML='<b>✦</b> V6 ULTIMATE';title.appendChild(b);
  }

  function enhancePlus(){
    const menu=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!menu)return;
    menu.querySelectorAll('[data-power-v2]').forEach(x=>x.remove());
    if(!menu.querySelector('[data-v6="builder"]')){
      const b=document.createElement('button');b.className='nx-nova-plus-item';b.dataset.v6='builder';b.innerHTML='<span style="width:18px;text-align:center">▣</span><span>Build a New App<small class="nx-v6-mini">Specialists → plan → create → build/test → review → export</small></span>';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();select('builder','APP BUILDER V6 ULTIMATE: Is app ko complete working project ki surat me banao. Specialist Council se architecture/UX/QA advice lo, requirements khud resolve karo sirf jab technically unavoidable ho warna sensible defaults use karo. Project inspect/scaffold karo, core features implement karo, build/check run karo, reviewer/critic issues fix karo aur downloadable project export ke liye ready karo. App idea: ');};menu.appendChild(b);
    }
    if(!menu.querySelector('[data-v6="power"]')){
      const b=document.createElement('button');b.className='nx-nova-plus-item nx-v6-mode';b.dataset.v6='power';b.innerHTML='<span style="width:18px;text-align:center">✦</span><span>Ultimate Power Task<small class="nx-v6-mini">Specialists → Planner → Worker → Reviewer → Red-Team Critic → recovery</small></span>';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();select('power','POWER V6 ULTIMATE: Is complex task ko end-to-end khud solve karo. Relevant specialist agents choose karo, project context aur zaroorat par fresh web research use karo; execute, build/test, diff/evidence verify karo; reviewer/red-team critic fail kare to correction passes chalao. Task: ');};menu.appendChild(b);
    }
  }

  function sync(){
    style();ensureModes();ensureBadge();enhancePlus();
    const c=read();document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===c.mode));
    const sub=$('nxNovaAISubtitle');
    if(sub){
      if(c.mode==='builder')sub.textContent=paired()?'App Builder V6 • specialists → build → verify':'App Builder V6 • local AI required';
      else if(c.mode==='power')sub.textContent=paired()?'V6 Ultimate • specialists → execute → red-team':'V6 Ultimate • local AI required';
      else if(c.mode==='research')sub.textContent='Research • multi-source deep reasoning';
      else if(c.mode==='website')sub.textContent='Website • autonomous repo workflow';
    }
    const st=$('nxNovaAIStatus');
    if(st&&!/working|thinking|local .*•/i.test(st.textContent||'')){
      if(c.mode==='builder')st.textContent=paired()?'App Builder V6 Ultimate ready':'Pair Local AI for App Builder';
      else if(c.mode==='power')st.textContent=paired()?'Power V6 Ultimate ready':'Pair Local AI for Ultimate';
    }
  }

  function init(){sync();const tab=$('tab-ai');if(tab&&!tab.__nxV6Observer){const o=new MutationObserver(()=>requestAnimationFrame(sync));o.observe(tab,{childList:true,subtree:true});tab.__nxV6Observer=o;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [700,1500,3000,6000].forEach(ms=>setTimeout(sync,ms));
  window.NexusNovaV6={select,sync,paired,version:'6.0.0-ultimate'};
})();
