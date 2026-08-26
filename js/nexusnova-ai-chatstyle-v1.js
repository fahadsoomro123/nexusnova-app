/* NexusNova NOVA AI Chat/Work UI v1
   Minimal black mobile shell inspired by modern assistant apps.
   Keeps existing NOVA V6 / Work MAX logic and safety gates intact.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIChatStyleV1) return;
  window.__nxNovaAIChatStyleV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);
  const defaults={mode:'chat',uiSpeed:'fast',uiIntelligence:'max'};
  let lastSignature='';

  function read(){
    try{return {...defaults,...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {...defaults}}
  }
  function save(patch){
    const next={...read(),...patch};
    try{localStorage.setItem(CFG_KEY,JSON.stringify(next))}catch(_){}
    return next;
  }
  function modelKey(c=read()){
    return c.mode==='work'?'work-max':c.mode==='research'?'research':c.mode==='builder'?'builder':'nova-v6';
  }
  function modelName(key){return ({'nova-v6':'NOVA V6','work-max':'NOVA Work MAX','research':'NOVA Research','builder':'NOVA Builder'}[key]||'NOVA V6')}
  function speedName(v){return v==='standard'?'Standard':'Fast'}
  function intelligenceName(v){return ({'max':'Max','extra-high':'Extra High','high':'High','medium':'Medium','light':'Light'}[v]||'Max')}
  function reasoningFor(v){return ['max','extra-high','high'].includes(v)?'deep':'auto'}

  function installStyle(){
    if($('nxNovaChatStyleV1CSS'))return;
    const s=document.createElement('style');s.id='nxNovaChatStyleV1CSS';s.textContent=`
      #tab-ai.nx-chatstyle{background:#000!important;color:#f4f4f4!important}
      #tab-ai.nx-chatstyle .ai-main-card{background:#000!important;border:0!important;box-shadow:none!important}
      #tab-ai.nx-chatstyle #aiBox{background:#000!important;padding-top:18px!important}
      #tab-ai.nx-chatstyle .nx-nova-top{height:72px!important;min-height:72px!important;padding:0 16px!important;border:0!important;background:#000!important;justify-content:center!important}
      #tab-ai.nx-chatstyle .nx-nova-top>.nx-chatstyle-legacy{display:none!important}
      #tab-ai.nx-chatstyle .nx-nova-modes,#tab-ai.nx-chatstyle #nxNovaAIStatus{display:none!important}

      #tab-ai .nx-chatstyle-top{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) 48px;align-items:center;gap:8px}
      #tab-ai .nx-chatstyle-menu{width:44px;height:44px;display:grid;place-items:center;border:1px solid #3d3d3d;border-radius:50%;background:#202020;color:#f3f3f3;padding:0}
      #tab-ai .nx-chatstyle-menu-lines{width:19px;height:14px;display:flex;flex-direction:column;justify-content:space-between}
      #tab-ai .nx-chatstyle-menu-lines i{display:block;width:19px;height:1.6px;border-radius:2px;background:currentColor}
      #tab-ai .nx-chatstyle-tabs{justify-self:center;width:min(260px,calc(100vw - 150px));height:52px;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:5px;border-radius:28px;background:#242424}
      #tab-ai .nx-chatstyle-tab{height:42px;border:0;border-radius:23px;background:transparent;color:#d8d8d8;font:500 15px/1 system-ui}
      #tab-ai .nx-chatstyle-tab.active{background:#383838;color:#fff;font-weight:650}
      #tab-ai .nx-chatstyle-spacer{width:44px;height:44px}

      #tab-ai.nx-chatstyle .ai-compose{grid-template-columns:38px minmax(66px,1fr) auto 38px 40px!important;gap:4px!important;margin:0 16px 12px!important;padding:8px!important;border:1px solid #404040!important;border-radius:29px!important;background:#242424!important;box-shadow:0 8px 28px rgba(0,0,0,.34)!important}
      #tab-ai.nx-chatstyle #aiInput{min-height:40px!important;height:40px!important;padding:10px 4px!important;color:#f5f5f5!important;font-size:15px!important}
      #tab-ai.nx-chatstyle #aiInput::placeholder{color:#adadad!important}
      #tab-ai .nx-chatstyle-control{height:40px;min-width:74px;max-width:126px;display:flex;align-items:center;justify-content:center;padding:0 7px;border:0;border-radius:20px;background:transparent;color:#f2f2f2;font:650 11px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-ai .nx-chatstyle-control:active{background:#333}
      #tab-ai.nx-chatstyle #aiSendBtn{background:#3b3b3b!important;color:#bcbcbc!important}
      #tab-ai.nx-chatstyle #aiSendBtn:not(:disabled):active{background:#f1f1f1!important;color:#111!important}

      #tab-ai .nx-chatstyle-pop{position:fixed;z-index:10090;right:18px;bottom:92px;width:min(320px,calc(100vw - 36px));padding:14px 10px;border:1px solid #454545;border-radius:24px;background:#242424;color:#f4f4f4;box-shadow:0 18px 55px rgba(0,0,0,.55);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #tab-ai .nx-chatstyle-row,#tab-ai .nx-chatstyle-choice{width:100%;min-height:58px;display:flex;align-items:center;gap:10px;padding:8px 14px;border:0;border-radius:15px;background:transparent;color:#f4f4f4;text-align:left}
      #tab-ai .nx-chatstyle-row:active,#tab-ai .nx-chatstyle-choice:active{background:#303030}
      #tab-ai .nx-chatstyle-copy{min-width:0;flex:1}
      #tab-ai .nx-chatstyle-copy strong{display:block;color:#f8f8f8;font:700 16px/1.2 system-ui}
      #tab-ai .nx-chatstyle-copy small{display:block;margin-top:5px;color:#9d9d9d;font:500 14px/1.2 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-ai .nx-chatstyle-chevron{font:400 29px/1 system-ui;color:#f0f0f0}
      #tab-ai .nx-chatstyle-divider{height:1px;margin:7px 14px;background:#393939}
      #tab-ai .nx-chatstyle-section{padding:10px 14px 5px;color:#9e9e9e;font:500 15px/1 system-ui}
      #tab-ai .nx-chatstyle-choice{font:650 16px/1.2 system-ui}
      #tab-ai .nx-chatstyle-choice>span:first-child{min-width:0;flex:1}
      #tab-ai .nx-chatstyle-choice small{display:block;margin-top:5px;color:#9d9d9d;font:500 13px/1.2 system-ui}
      #tab-ai .nx-chatstyle-check{width:24px;text-align:center;color:#fff;font-size:22px}
      #tab-ai .nx-chatstyle-subhead{display:flex;align-items:center;gap:8px;padding:4px 8px 10px}
      #tab-ai .nx-chatstyle-back{width:38px;height:38px;display:grid;place-items:center;border:0;border-radius:12px;background:transparent;color:#eee;font-size:24px}
      #tab-ai .nx-chatstyle-subhead strong{font:700 17px/1 system-ui}

      @media(max-width:430px){
        #tab-ai.nx-chatstyle .nx-nova-top{padding:0 12px!important}
        #tab-ai .nx-chatstyle-tabs{width:min(235px,calc(100vw - 132px));height:50px}
        #tab-ai .nx-chatstyle-tab{font-size:14px}
        #tab-ai.nx-chatstyle .ai-compose{margin-left:10px!important;margin-right:10px!important;grid-template-columns:38px minmax(54px,1fr) auto 38px 40px!important}
        #tab-ai .nx-chatstyle-control{min-width:64px;max-width:94px;padding:0 4px;font-size:10px}
      }
    `;document.head.appendChild(s);
  }

  function closePop(){document.querySelector('#tab-ai .nx-chatstyle-pop')?.remove()}
  function setMode(mode){
    closePop();
    if(window.NexusNovaV6?.select)return window.NexusNovaV6.select(mode);
    save({mode});sync();return true;
  }
  function choice(label,value,current,type,desc=''){
    return `<button class="nx-chatstyle-choice" type="button" data-pref="${type}" data-value="${value}"><span>${label}${desc?`<small>${desc}</small>`:''}</span><span class="nx-chatstyle-check">${value===current?'✓':''}</span></button>`;
  }
  function openPop(view='main'){
    closePop();const tab=$('tab-ai');if(!tab)return;
    const c=read(),m=modelKey(c),p=document.createElement('div');p.className='nx-chatstyle-pop';
    if(view==='model'){
      p.innerHTML=`<div class="nx-chatstyle-subhead"><button class="nx-chatstyle-back" type="button" data-back>‹</button><strong>Model</strong></div>${choice('NOVA V6','nova-v6',m,'model')}${choice('NOVA Work MAX','work-max',m,'model')}${choice('NOVA Research','research',m,'model')}${choice('NOVA Builder','builder',m,'model')}`;
    }else if(view==='speed'){
      p.innerHTML=`<div class="nx-chatstyle-subhead"><button class="nx-chatstyle-back" type="button" data-back>‹</button><strong>Speed</strong></div>${choice('Standard','standard',c.uiSpeed,'speed','Balanced usage')}${choice('Fast','fast',c.uiSpeed,'speed','Quick response preset')}`;
    }else{
      p.innerHTML=`<button class="nx-chatstyle-row" type="button" data-open="model"><span class="nx-chatstyle-copy"><strong>Model</strong><small>${modelName(m)}</small></span><span class="nx-chatstyle-chevron">›</span></button><button class="nx-chatstyle-row" type="button" data-open="speed"><span class="nx-chatstyle-copy"><strong>Speed</strong><small>${speedName(c.uiSpeed)}</small></span><span class="nx-chatstyle-chevron">›</span></button><div class="nx-chatstyle-divider"></div><div class="nx-chatstyle-section">Intelligence</div>${choice('Max','max',c.uiIntelligence,'intelligence')}${choice('Extra High','extra-high',c.uiIntelligence,'intelligence')}${choice('High','high',c.uiIntelligence,'intelligence')}${choice('Medium','medium',c.uiIntelligence,'intelligence')}${choice('Light','light',c.uiIntelligence,'intelligence')}`;
    }
    tab.appendChild(p);
    p.addEventListener('click',e=>{
      if(e.target.closest('[data-back]'))return openPop('main');
      const open=e.target.closest('[data-open]');if(open)return openPop(open.dataset.open);
      const pref=e.target.closest('[data-pref]');if(!pref)return;
      const type=pref.dataset.pref,value=pref.dataset.value;
      if(type==='model'){
        const mode=value==='work-max'?'work':value==='research'?'research':value==='builder'?'builder':'chat';
        const ok=setMode(mode);if(ok===false)return;
      }else if(type==='speed')save({uiSpeed:value});
      else if(type==='intelligence')save({uiIntelligence:value,reasoning:reasoningFor(value)});
      closePop();lastSignature='';sync();
    });
    setTimeout(()=>document.addEventListener('pointerdown',outside,{capture:true,once:true}),0);
  }
  function outside(e){const p=document.querySelector('#tab-ai .nx-chatstyle-pop');if(p&&!p.contains(e.target)&&!e.target.closest('#nxNovaChatStyleControl'))closePop()}

  function build(){
    installStyle();
    const tab=$('tab-ai'),top=$('nxNovaAITop'),compose=tab?.querySelector('.ai-compose');if(!tab||!top||!compose)return false;
    tab.classList.add('nx-chatstyle');
    Array.from(top.children).forEach(el=>{if(!el.classList.contains('nx-chatstyle-top'))el.classList.add('nx-chatstyle-legacy')});
    if(!$('nxNovaChatStyleTop')){
      const bar=document.createElement('div');bar.id='nxNovaChatStyleTop';bar.className='nx-chatstyle-top';
      bar.innerHTML=`<button id="nxNovaChatStyleMenu" class="nx-chatstyle-menu" type="button" title="Menu"><span class="nx-chatstyle-menu-lines"><i></i><i></i><i></i></span></button><div class="nx-chatstyle-tabs"><button id="nxNovaChatStyleChat" class="nx-chatstyle-tab" type="button">Chat</button><button id="nxNovaChatStyleWork" class="nx-chatstyle-tab" type="button">Work</button></div><span class="nx-chatstyle-spacer" aria-hidden="true"></span>`;
      top.appendChild(bar);
      $('nxNovaChatStyleMenu').onclick=()=>{closePop();const more=$('moreBtn');if(more)more.click();else $('nxNovaSettings')?.click()};
      $('nxNovaChatStyleChat').onclick=()=>setMode('chat');
      $('nxNovaChatStyleWork').onclick=()=>setMode('work');
    }
    if(!$('nxNovaChatStyleControl')){
      const b=document.createElement('button');b.id='nxNovaChatStyleControl';b.type='button';b.className='nx-chatstyle-control';b.title='NOVA model, speed and intelligence';b.onclick=e=>{e.preventDefault();e.stopPropagation();document.querySelector('#tab-ai .nx-chatstyle-pop')?closePop():openPop('main')};
      $('aiVoiceBtn')?.insertAdjacentElement('beforebegin',b);
    }
    return true;
  }

  function text(el,value){if(el&&el.textContent!==value)el.textContent=value}
  function sync(){
    if(!build())return;
    const c=read(),m=modelKey(c),sig=[c.mode,c.uiSpeed,c.uiIntelligence,m].join('|');
    if(sig===lastSignature&&$('nxNovaChatStyleControl'))return;
    lastSignature=sig;
    $('nxNovaChatStyleChat')?.classList.toggle('active',c.mode!=='work');
    $('nxNovaChatStyleWork')?.classList.toggle('active',c.mode==='work');
    text($('nxNovaChatStyleControl'),`⚡ ${modelName(m)} ${intelligenceName(c.uiIntelligence)}`);
    const input=$('aiInput');if(input){const ph=c.mode==='work'?'Work with NOVA':'Message NOVA';if(input.placeholder!==ph)input.placeholder=ph}
  }

  function init(){
    sync();
    const tab=$('tab-ai');
    if(tab&&!tab.__nxChatStyleObserver){
      const o=new MutationObserver(()=>requestAnimationFrame(()=>{lastSignature='';sync()}));
      o.observe(tab,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});tab.__nxChatStyleObserver=o;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [500,1000,1800,3200,6000].forEach(ms=>setTimeout(()=>{lastSignature='';sync()},ms));
})();
