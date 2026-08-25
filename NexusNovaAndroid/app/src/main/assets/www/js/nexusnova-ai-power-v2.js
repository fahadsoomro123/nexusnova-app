/* NexusNova NOVA AI Power v2
   Lightweight Power/Research controls for the existing NOVA AI mobile shell.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIPowerV2) return;
  window.__nxNovaAIPowerV2 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);
  const read=()=>{try{return {mode:'chat',endpoint:'',token:'',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {mode:'chat',endpoint:'',token:''}}};
  const save=patch=>{const v={...read(),...patch};try{localStorage.setItem(CFG_KEY,JSON.stringify(v))}catch(_){}return v};
  const paired=()=>{const c=read();return !!(c.endpoint&&c.token)};

  function style(){
    if($('nxNovaPowerV2Style'))return;
    const s=document.createElement('style');s.id='nxNovaPowerV2Style';s.textContent=`
      #tab-ai .nx-power-chip{position:relative}
      #tab-ai .nx-power-chip::after{content:'✦';font-size:8px;margin-left:4px;opacity:.78}
      #tab-ai .nx-power-chip.active{font-weight:750}
      #tab-ai .nx-power-badge{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:3px 7px;border:1px solid #3b3d42;border-radius:999px;background:#242529;color:#bfc2c8;font:650 9px/1 system-ui;white-space:nowrap}
      #tab-ai .nx-power-badge b{font-size:8px;font-weight:800}
    `;document.head.appendChild(s);
  }

  function setInput(text){const i=$('aiInput');if(!i)return;i.value=text;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}
  function status(text){const s=$('nxNovaAIStatus');if(s)s.textContent=text;}
  function select(mode,preset=''){
    if(mode==='power'&&!paired()){
      status('Power Mode ke liye Local GPT-OSS pair karo');
      $('nxNovaSettings')?.click();
      return false;
    }
    save({mode,reasoning:mode==='power'||mode==='research'?'deep':'auto'});sync();if(preset)setInput(preset);return true;
  }
  function ensureModes(){
    const modes=$('nxNovaAIModes');if(!modes)return;
    if(!modes.querySelector('[data-mode="research"]')){const b=document.createElement('button');b.className='nx-nova-mode';b.dataset.mode='research';b.textContent='Research';b.onclick=e=>{e.preventDefault();e.stopPropagation();select('research');};modes.appendChild(b);}
    if(!modes.querySelector('[data-mode="power"]')){const b=document.createElement('button');b.className='nx-nova-mode nx-power-chip';b.dataset.mode='power';b.textContent='Power';b.onclick=e=>{e.preventDefault();e.stopPropagation();select('power');};modes.appendChild(b);}
  }
  function ensureBadge(){const title=document.querySelector('#tab-ai .nx-nova-title');if(!title||title.querySelector('.nx-power-badge'))return;const b=document.createElement('span');b.className='nx-power-badge';b.innerHTML='<b>✦</b> POWER v2';title.appendChild(b);}
  function enhancePlus(){
    const menu=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!menu)return;
    if(!menu.querySelector('[data-power-v2="research"]')){const b=document.createElement('button');b.className='nx-nova-plus-item';b.dataset.powerV2='research';b.innerHTML='<span style="width:18px;text-align:center">⌕</span><span>Deep Research<small>Plan → multi-source research → review</small></span>';b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();select('research','Deep research karo. Sawal ko sub-questions me todo, multiple current reliable sources compare karo, dates/conflicts verify karo aur final concise conclusion do. Topic: ');};menu.appendChild(b);}
    if(!menu.querySelector('[data-power-v2="power"]')){const b=document.createElement('button');b.className='nx-nova-plus-item nx-power-chip';b.dataset.powerV2='power';b.innerHTML='<span style="width:18px;text-align:center">✦</span><span>Power Task<small>Planner → Worker → Reviewer → correction</small></span>';b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();select('power','POWER MODE: Is complex task ko khud plan karo, zaroori repo/web research karo, available tools se execute karo, checks/diff verify karo aur reviewer fail kare to correct karke final result do. Task: ');};menu.appendChild(b);}
  }
  function sync(){ensureModes();ensureBadge();enhancePlus();const c=read();document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===c.mode));const sub=$('nxNovaAISubtitle');if(sub&&c.mode==='power')sub.textContent=paired()?'Power • plan → execute → review':'Power • local AI pairing required';else if(sub&&c.mode==='research')sub.textContent='Research • deep multi-source reasoning';const st=$('nxNovaAIStatus');if(st&&c.mode==='power'&&!/working|thinking/i.test(st.textContent||''))st.textContent=paired()?'Power Mode • Deep reasoning ready':'Power Mode • pair Local GPT-OSS';}
  function init(){style();sync();const tab=$('tab-ai');if(tab&&!tab.__nxPowerV2Obs){const o=new MutationObserver(sync);o.observe(tab,{childList:true,subtree:true});tab.__nxPowerV2Obs=o;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();[700,1500,3000,6000].forEach(ms=>setTimeout(sync,ms));window.NexusNovaPowerV2={mode:select,sync,paired};
})();
