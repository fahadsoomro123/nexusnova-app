/* NexusNova NOVA 5.7 Sol responsive assistant interface v1.
 * Screenshot-guided mobile + desktop UX layer.
 * Own NexusNova branding; reuses existing chat/work/files/memory/research owners.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57InterfaceV1) return;
  window.__nxNovaSol57InterfaceV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);
  const PROFILES=Object.freeze({
    sol:{label:'NOVA 5.7 Sol',short:'5.7 Sol',desc:'Flagship • deepest general reasoning',instruction:'Use the NOVA 5.7 Sol flagship profile: careful general reasoning, strong synthesis, concise unless detail is useful.'},
    terra:{label:'NOVA 5.7 Terra',short:'5.7 Terra',desc:'Structured • work and analysis',instruction:'Use the NOVA 5.7 Terra profile: structured analysis, plans, implementation detail, verification and clear deliverables.'},
    luna:{label:'NOVA 5.7 Luna',short:'5.7 Luna',desc:'Fast • creative and conversational',instruction:'Use the NOVA 5.7 Luna profile: fast, natural, creative and conversational while remaining accurate.'},
    classic:{label:'NOVA 5.6',short:'5.6',desc:'Compatibility • balanced',instruction:'Use the NOVA 5.6 compatibility profile: balanced, stable and straightforward.'}
  });
  const INTELLIGENCE=Object.freeze({max:'Max','extra-high':'Extra High',high:'High',medium:'Medium',light:'Light'});
  let syncing=false;

  function read(){
    try{return {mode:'chat',uiModelProfile:'sol',uiSpeed:'fast',uiIntelligence:'max',reasoning:'deep',...JSON.parse(localStorage.getItem(CFG_KEY)||'')}}
    catch(_){return {mode:'chat',uiModelProfile:'sol',uiSpeed:'fast',uiIntelligence:'max',reasoning:'deep'}}
  }
  function save(patch){const next={...read(),...patch};try{localStorage.setItem(CFG_KEY,JSON.stringify(next))}catch(_){}return next}
  function profile(c=read()){return PROFILES[c.uiModelProfile]||PROFILES.sol}
  function intelligence(c=read()){return INTELLIGENCE[c.uiIntelligence]||'Max'}
  function speed(c=read()){return c.uiSpeed==='standard'?'Standard':'Fast'}
  function reasoningFor(v){return ['max','extra-high','high'].includes(v)?'deep':'auto'}

  function css(){
    if($('nxSol57InterfaceStyle'))return;
    const s=document.createElement('style');s.id='nxSol57InterfaceStyle';s.textContent=`
      #tab-ai.nx-sol57-premium{--nx-bg:#000;--nx-panel:#202020;--nx-panel2:#2b2b2b;--nx-border:#3b3b3b;--nx-text:#f4f4f4;--nx-muted:#9b9b9b;background:var(--nx-bg)!important;color:var(--nx-text)!important;position:relative!important;overflow:hidden!important}
      #tab-ai.nx-sol57-premium .ai-main-card{background:#000!important;border:0!important;box-shadow:none!important;min-height:100%!important}
      #tab-ai.nx-sol57-premium #aiBox{background:#000!important;scrollbar-width:thin}
      #tab-ai.nx-sol57-premium .nx-nova-top{background:#000!important;border:0!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-top{grid-template-columns:48px minmax(0,1fr) 48px!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-tabs{width:min(290px,calc(100vw - 142px))!important;height:58px!important;padding:5px!important;border-radius:31px!important;background:#242424!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-tab{height:48px!important;border-radius:25px!important;font-size:16px!important;font-weight:520!important;color:#e5e5e5!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-tab.active{background:#3a3a3a!important;color:#fff!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-menu{width:46px!important;height:46px!important;background:#202020!important;border-color:#424242!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-menu-lines{height:15px!important}

      #tab-ai.nx-sol57-premium .ai-compose{max-width:760px!important;grid-template-columns:42px minmax(80px,1fr) auto 42px 44px!important;gap:4px!important;margin:0 auto 12px!important;padding:8px 9px!important;border:1px solid #424242!important;border-radius:31px!important;background:#232323!important;box-shadow:0 10px 34px rgba(0,0,0,.34)!important}
      #tab-ai.nx-sol57-premium #aiInput{min-height:42px!important;height:42px!important;padding:10px 7px!important;font-size:16px!important;line-height:22px!important;color:#f3f3f3!important}
      #tab-ai.nx-sol57-premium #aiInput::placeholder{color:#aaa!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-control{height:42px!important;min-width:105px!important;max-width:170px!important;padding:0 9px!important;border-radius:22px!important;color:#f4f4f4!important;font-size:12px!important;font-weight:680!important;letter-spacing:-.1px!important}
      #tab-ai.nx-sol57-premium .nx-chatstyle-control:hover,#tab-ai.nx-sol57-premium .nx-chatstyle-control:active{background:#303030!important}
      #tab-ai.nx-sol57-premium #aiVoiceBtn,#tab-ai.nx-sol57-premium #aiSendBtn{width:42px!important;height:42px!important;border-radius:50%!important}

      #tab-ai .nx-sol57-picker{position:fixed;z-index:10140;width:min(338px,calc(100vw - 28px));max-height:min(70dvh,680px);overflow:auto;padding:13px 10px;border:1px solid #454545;border-radius:27px;background:#242424;color:#f6f6f6;box-shadow:0 18px 60px rgba(0,0,0,.58);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overscroll-behavior:contain}
      #tab-ai .nx-sol57-picker-row,#tab-ai .nx-sol57-picker-choice{width:100%;min-height:72px;display:flex;align-items:center;gap:10px;padding:9px 16px;border:0;border-radius:17px;background:transparent;color:#f4f4f4;text-align:left}
      #tab-ai .nx-sol57-picker-row:active,#tab-ai .nx-sol57-picker-choice:active{background:#303030}
      #tab-ai .nx-sol57-picker-copy{min-width:0;flex:1}
      #tab-ai .nx-sol57-picker-copy strong{display:block;font:700 18px/1.2 system-ui;color:#f7f7f7}
      #tab-ai .nx-sol57-picker-copy small{display:block;margin-top:6px;color:#9c9c9c;font:500 15px/1.2 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-ai .nx-sol57-picker-chevron{font:400 31px/1 system-ui;color:#efefef}
      #tab-ai .nx-sol57-picker-divider{height:1px;margin:7px 17px;background:#3a3a3a}
      #tab-ai .nx-sol57-picker-section{padding:18px 17px 6px;color:#9d9d9d;font:500 16px/1 system-ui}
      #tab-ai .nx-sol57-picker-choice{min-height:69px;font:650 18px/1.2 system-ui}
      #tab-ai .nx-sol57-picker-choice>span:first-child{min-width:0;flex:1}
      #tab-ai .nx-sol57-picker-choice small{display:block;margin-top:5px;color:#999;font:500 13px/1.3 system-ui}
      #tab-ai .nx-sol57-picker-check{width:28px;text-align:center;color:#fff;font-size:25px}
      #tab-ai .nx-sol57-picker-head{display:flex;align-items:center;gap:8px;padding:3px 8px 8px}
      #tab-ai .nx-sol57-picker-back{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:13px;background:transparent;color:#eee;font-size:26px}
      #tab-ai .nx-sol57-picker-head strong{font:700 19px/1 system-ui}

      .nx-sol57-drawer-back{position:fixed;inset:0;z-index:10160;background:rgba(0,0,0,.58);display:flex;align-items:stretch;justify-content:flex-start;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .nx-sol57-drawer{width:min(320px,86vw);height:100%;padding:16px 12px calc(18px + env(safe-area-inset-bottom));background:#171717;border-right:1px solid #303030;color:#f2f2f2;display:flex;flex-direction:column;box-shadow:18px 0 55px rgba(0,0,0,.45)}
      .nx-sol57-drawer-head{display:flex;align-items:center;gap:10px;padding:4px 5px 15px}.nx-sol57-drawer-head strong{flex:1;font-size:18px}.nx-sol57-drawer-close{width:40px;height:40px;border:0;border-radius:12px;background:#252525;color:#eee;font-size:22px}
      .nx-sol57-nav{display:grid;gap:5px}.nx-sol57-nav button{width:100%;min-height:48px;display:flex;align-items:center;gap:12px;padding:0 13px;border:0;border-radius:12px;background:transparent;color:#ededed;text-align:left;font:600 14px/1 system-ui}.nx-sol57-nav button:active,.nx-sol57-nav button:hover{background:#252525}.nx-sol57-nav .ico{width:22px;text-align:center;font-size:18px;color:#c8c8c8}.nx-sol57-nav small{margin-left:auto;color:#777;font-size:10px}
      .nx-sol57-drawer-foot{margin-top:auto;padding:13px;border-top:1px solid #2d2d2d;color:#8f8f8f;font-size:11px;line-height:1.45}

      #tab-ai .nx-sol57-desktop-sidebar{display:none}
      @media(max-width:560px){
        #tab-ai.nx-sol57-premium .nx-nova-top{height:78px!important;min-height:78px!important;padding:0 16px!important}
        #tab-ai.nx-sol57-premium .nx-chatstyle-tabs{width:min(286px,calc(100vw - 132px))!important;height:54px!important}
        #tab-ai.nx-sol57-premium .nx-chatstyle-tab{height:44px!important;font-size:15px!important}
        #tab-ai.nx-sol57-premium .ai-compose{max-width:none!important;margin-left:10px!important;margin-right:10px!important;grid-template-columns:40px minmax(48px,1fr) auto 40px 42px!important;border-radius:29px!important}
        #tab-ai.nx-sol57-premium .nx-chatstyle-control{min-width:86px!important;max-width:132px!important;padding:0 5px!important;font-size:11px!important}
        #tab-ai .nx-sol57-picker{right:14px!important;left:auto!important}
      }
      @media(min-width:900px){
        #tab-ai.nx-sol57-premium .nx-sol57-desktop-sidebar{display:flex;position:absolute;z-index:25;left:0;top:0;bottom:0;width:255px;padding:18px 12px;background:#171717;border-right:1px solid #2d2d2d;color:#eee;flex-direction:column;font-family:system-ui}
        #tab-ai.nx-sol57-premium .ai-main-card{margin-left:255px!important;width:calc(100% - 255px)!important}
        #tab-ai.nx-sol57-premium .nx-chatstyle-menu{visibility:hidden!important}
        #tab-ai.nx-sol57-premium .nx-chatstyle-tabs{width:270px!important}
        #tab-ai.nx-sol57-premium #aiBox .ai-message{max-width:760px;margin-left:auto!important;margin-right:auto!important;width:calc(100% - 48px)}
        #tab-ai.nx-sol57-premium .ai-compose{width:min(760px,calc(100% - 48px))!important;margin-left:auto!important;margin-right:auto!important}
        #tab-ai .nx-sol57-desktop-brand{padding:9px 10px 18px;font:750 18px/1 system-ui}.nx-sol57-desktop-brand small{display:block;margin-top:6px;color:#777;font:500 10px/1 system-ui}
        #tab-ai .nx-sol57-desktop-nav{display:grid;gap:4px}.nx-sol57-desktop-nav button{min-height:46px;display:flex;align-items:center;gap:11px;padding:0 11px;border:0;border-radius:11px;background:transparent;color:#eaeaea;text-align:left;font:600 13px/1 system-ui}.nx-sol57-desktop-nav button:hover{background:#242424}.nx-sol57-desktop-nav .ico{width:20px;text-align:center;font-size:16px}.nx-sol57-desktop-foot{margin-top:auto;padding:14px 10px;border-top:1px solid #2b2b2b;color:#858585;font-size:10px;line-height:1.45}
      }
    `;document.head.appendChild(s)
  }

  function invoke(action){
    if(action==='new')return $('nxNovaNewChat')?.click();
    if(action==='history')return $('nxNovaHistory')?.click();
    if(action==='files')return window.NexusNovaSol57Files?.open?.();
    if(action==='memory')return window.NexusNovaMemory?.open?.();
    if(action==='capabilities')return window.NexusNovaSol57?.showCapabilities?.();
    if(action==='settings')return $('nxNovaSettings')?.click();
    if(['chat','work','research','website','builder'].includes(action)){
      if(window.NexusNovaV6?.select)return window.NexusNovaV6.select(action);
      save({mode:action});sync();
    }
  }

  function navHtml(){return `
    <button data-solnav="new"><span class="ico">＋</span>New chat</button>
    <button data-solnav="history"><span class="ico">⌕</span>Chat history</button>
    <button data-solnav="files"><span class="ico">▤</span>Files</button>
    <button data-solnav="work"><span class="ico">◆</span>Work</button>
    <button data-solnav="research"><span class="ico">◎</span>Research</button>
    <button data-solnav="memory"><span class="ico">◉</span>Memory</button>
    <button data-solnav="capabilities"><span class="ico">✦</span>Capabilities</button>
    <button data-solnav="settings"><span class="ico">⚙</span>Settings</button>`}

  function openDrawer(){
    document.querySelector('.nx-sol57-drawer-back')?.remove();
    const back=document.createElement('div');back.className='nx-sol57-drawer-back';
    back.innerHTML=`<aside class="nx-sol57-drawer"><div class="nx-sol57-drawer-head"><strong>NOVA</strong><button class="nx-sol57-drawer-close" type="button">×</button></div><nav class="nx-sol57-nav">${navHtml()}</nav><div class="nx-sol57-drawer-foot">NOVA 5.7 Sol<br>NexusNova assistant • Chat + Work + tools</div></aside>`;
    document.body.appendChild(back);
    back.querySelector('.nx-sol57-drawer-close').onclick=()=>back.remove();back.addEventListener('click',e=>{if(e.target===back)back.remove()});
    back.querySelector('.nx-sol57-nav').onclick=e=>{const b=e.target.closest('[data-solnav]');if(!b)return;back.remove();invoke(b.dataset.solnav)}
  }

  function ensureDesktopSidebar(){
    const tab=$('tab-ai');if(!tab||tab.querySelector('.nx-sol57-desktop-sidebar'))return;
    const aside=document.createElement('aside');aside.className='nx-sol57-desktop-sidebar';
    aside.innerHTML=`<div class="nx-sol57-desktop-brand">NOVA<small>5.7 Sol • NexusNova</small></div><nav class="nx-sol57-desktop-nav">${navHtml()}</nav><div class="nx-sol57-desktop-foot">Your assistant workspace<br>Chat • Work • Files • Research</div>`;
    aside.querySelector('.nx-sol57-desktop-nav').onclick=e=>{const b=e.target.closest('[data-solnav]');if(b)invoke(b.dataset.solnav)};tab.prepend(aside)
  }

  function closePicker(){document.querySelector('#tab-ai .nx-sol57-picker')?.remove()}
  function choice(label,value,current,type,desc=''){return `<button class="nx-sol57-picker-choice" type="button" data-pref="${type}" data-value="${value}"><span>${label}${desc?`<small>${desc}</small>`:''}</span><span class="nx-sol57-picker-check">${value===current?'✓':''}</span></button>`}
  function placePicker(p){
    const control=$('nxNovaChatStyleControl');if(!p||!control)return;
    const r=control.getBoundingClientRect(),vw=window.visualViewport?.width||window.innerWidth,vh=window.visualViewport?.height||window.innerHeight;
    const w=Math.min(338,vw-28);let left=Math.min(vw-w-14,Math.max(14,r.right-w));
    let top=r.top-p.offsetHeight-12;if(top<78)top=Math.max(78,Math.min(r.bottom+10,vh-p.offsetHeight-12));
    p.style.left=`${left}px`;p.style.top=`${Math.max(10,top)}px`;
  }
  function openPicker(view='main'){
    closePicker();const tab=$('tab-ai');if(!tab)return;const c=read(),pr=profile(c),p=document.createElement('div');p.className='nx-sol57-picker';
    if(view==='model')p.innerHTML=`<div class="nx-sol57-picker-head"><button class="nx-sol57-picker-back" type="button" data-back>‹</button><strong>Model</strong></div>${choice('5.7 Sol','sol',c.uiModelProfile,'model',PROFILES.sol.desc)}${choice('5.7 Terra','terra',c.uiModelProfile,'model',PROFILES.terra.desc)}${choice('5.7 Luna','luna',c.uiModelProfile,'model',PROFILES.luna.desc)}${choice('5.6','classic',c.uiModelProfile,'model',PROFILES.classic.desc)}`;
    else if(view==='speed')p.innerHTML=`<div class="nx-sol57-picker-head"><button class="nx-sol57-picker-back" type="button" data-back>‹</button><strong>Speed</strong></div>${choice('Standard','standard',c.uiSpeed,'speed','Default usage')}${choice('Fast','fast',c.uiSpeed,'speed','Increased usage')}`;
    else p.innerHTML=`<button class="nx-sol57-picker-row" type="button" data-open="model"><span class="nx-sol57-picker-copy"><strong>Model</strong><small>${pr.label}</small></span><span class="nx-sol57-picker-chevron">›</span></button><button class="nx-sol57-picker-row" type="button" data-open="speed"><span class="nx-sol57-picker-copy"><strong>Speed</strong><small>${speed(c)}</small></span><span class="nx-sol57-picker-chevron">›</span></button><div class="nx-sol57-picker-divider"></div><div class="nx-sol57-picker-section">Intelligence</div>${choice('Max','max',c.uiIntelligence,'intelligence')}${choice('Extra High','extra-high',c.uiIntelligence,'intelligence')}${choice('High','high',c.uiIntelligence,'intelligence')}${choice('Medium','medium',c.uiIntelligence,'intelligence')}${choice('Light','light',c.uiIntelligence,'intelligence')}`;
    tab.appendChild(p);requestAnimationFrame(()=>placePicker(p));
    p.onclick=e=>{
      if(e.target.closest('[data-back]'))return openPicker('main');const o=e.target.closest('[data-open]');if(o)return openPicker(o.dataset.open);
      const b=e.target.closest('[data-pref]');if(!b)return;const type=b.dataset.pref,value=b.dataset.value;
      if(type==='model')save({uiModelProfile:value});else if(type==='speed')save({uiSpeed:value});else save({uiIntelligence:value,reasoning:reasoningFor(value)});
      closePicker();sync()
    };
    setTimeout(()=>document.addEventListener('pointerdown',e=>{const q=document.querySelector('#tab-ai .nx-sol57-picker');if(q&&!q.contains(e.target)&&!e.target.closest('#nxNovaChatStyleControl'))closePicker()},{capture:true,once:true}),0)
  }

  function ownButton(id,handler){
    const old=$(id);if(!old||old.dataset.sol57Owned==='1')return old;
    const b=old.cloneNode(true);b.dataset.sol57Owned='1';old.replaceWith(b);b.onclick=handler;return b
  }
  function ownControls(){
    ownButton('nxNovaChatStyleMenu',e=>{e.preventDefault();e.stopPropagation();closePicker();openDrawer()});
    ownButton('nxNovaChatStyleControl',e=>{e.preventDefault();e.stopPropagation();document.querySelector('#tab-ai .nx-sol57-picker')?closePicker():openPicker('main')});
    ownButton('nxNovaChatStyleChat',e=>{e.preventDefault();invoke('chat')});
    ownButton('nxNovaChatStyleWork',e=>{e.preventDefault();invoke('work')})
  }

  function installFetchBridge(){
    if(window.__nxNovaSol57InterfaceFetchBridge)return;window.__nxNovaSol57InterfaceFetchBridge=true;
    const previous=window.fetch.bind(window);
    window.fetch=async function(input,init){
      try{const url=String(input?.url||input||'');if(url.includes('/api/chat')&&init&&typeof init.body==='string'){
        const body=JSON.parse(init.body),c=read(),pr=profile(c);if(body&&typeof body==='object'){
          body.nova_ui={model_profile:c.uiModelProfile,model_label:pr.label,speed:c.uiSpeed,intelligence:c.uiIntelligence,interface:'sol57-responsive-v1'};
          const note=`NOVA UI profile: ${pr.label}. ${pr.instruction}`;const existing=String(body.app_context||'').trim();body.app_context=existing?`${existing}\n\n${note}`:note;init={...init,body:JSON.stringify(body)}
        }
      }}catch(_){}
      return previous(input,init)
    }
  }

  function sync(){
    if(syncing)return;syncing=true;requestAnimationFrame(()=>{try{
      css();const tab=$('tab-ai');if(!tab)return;tab.classList.add('nx-sol57-premium');ensureDesktopSidebar();ownControls();
      const c=read(),pr=profile(c);$('nxNovaChatStyleChat')?.classList.toggle('active',c.mode!=='work');$('nxNovaChatStyleWork')?.classList.toggle('active',c.mode==='work');
      const control=$('nxNovaChatStyleControl');if(control){const text=`⚡ ${pr.short} ${intelligence(c)}`;if(control.textContent!==text)control.textContent=text;control.title=`${pr.label} • ${speed(c)} • ${intelligence(c)}`}
      const input=$('aiInput');if(input){const ph=c.mode==='work'?'Work with NOVA':'Message NOVA';if(input.placeholder!==ph)input.placeholder=ph}
    }finally{syncing=false}},0)
  }

  function init(){css();installFetchBridge();sync();const tab=$('tab-ai');if(tab&&!tab.__nxSol57InterfaceObs){const o=new MutationObserver(sync);o.observe(tab,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});tab.__nxSol57InterfaceObs=o}window.visualViewport?.addEventListener('resize',()=>{const p=document.querySelector('#tab-ai .nx-sol57-picker');if(p)placePicker(p)})}

  window.NexusNovaSol57Interface=Object.freeze({version:'1.0.0',profiles:PROFILES,openPicker,openDrawer,refresh:sync});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [700,1400,2600,5000,9000].forEach(ms=>setTimeout(sync,ms));
})();
