/* NexusNova NOVA AI Mobile v1
   Lightweight ChatGPT-style interaction shell for the existing NexusNova AI.
   - preserves existing Gemini/voice/image owners as fallback
   - optional paired HTTPS gateway to local gpt-oss Dev AI
   - Chat / Web / Dev modes
   - no external fonts, icon packs or image assets
*/
(() => {
  'use strict';
  if (window.__nxNovaAIMobileV1) return;
  window.__nxNovaAIMobileV1 = true;

  const $ = id => document.getElementById(id);
  const CFG_KEY = 'nexusnova_nova_ai_mobile_v1';
  const THREAD_KEY = 'nexusnova_nova_ai_thread_v1';
  const MAX_HISTORY = 20;
  let nativeSend = null;
  let busy = false;

  const icons = {
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 4"/></svg>',
    copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="10" height="10" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function readCfg(){
    try { return {mode:'chat',endpoint:'',token:'',useGateway:true,...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}; }
    catch (_) { return {mode:'chat',endpoint:'',token:'',useGateway:true}; }
  }
  function saveCfg(patch){
    const next={...readCfg(),...patch};
    try { localStorage.setItem(CFG_KEY,JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function history(){
    try {
      const rows=JSON.parse(localStorage.getItem(THREAD_KEY)||'[]');
      return Array.isArray(rows)?rows.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-MAX_HISTORY):[];
    } catch (_) { return []; }
  }
  function saveTurn(role,content){
    const text=String(content||'').trim(); if(!text)return;
    const rows=history(); rows.push({role,content:text.slice(0,7000),at:Date.now()});
    try { localStorage.setItem(THREAD_KEY,JSON.stringify(rows.slice(-MAX_HISTORY))); } catch (_) {}
  }
  function clearThread(){ try{localStorage.removeItem(THREAD_KEY);}catch(_){} }

  function installStyle(){
    if ($('nxNovaAIMobileV1Style')) return;
    const s=document.createElement('style'); s.id='nxNovaAIMobileV1Style';
    s.textContent=`
      #tab-ai.nx-nova-ai-mobile{padding-top:0!important}
      #tab-ai.nx-nova-ai-mobile .ai-main-card{padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:#111214!important;box-shadow:none!important;overflow:hidden!important;min-height:calc(100dvh - 142px)!important;display:flex!important;flex-direction:column!important}
      #tab-ai.nx-nova-ai-mobile .ai-main-card:before,#tab-ai.nx-nova-ai-mobile .ai-main-card:after{display:none!important}
      #tab-ai .nx-nova-top{height:54px;min-height:54px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(17,18,20,.97);position:sticky;top:0;z-index:5}
      #tab-ai .nx-nova-mark{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:#fff;color:#111;font:800 14px/1 system-ui}
      #tab-ai .nx-nova-title{min-width:0;flex:1}.nx-nova-title strong{display:block;color:#f5f5f5;font:700 14px/1.1 system-ui}.nx-nova-title small{display:block;margin-top:3px;color:#92969d;font:500 9px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-ai .nx-nova-icon{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#d8d9dc;padding:0}.nx-nova-icon:active{background:#292b2f}.nx-nova-icon svg{width:18px;height:18px}
      #tab-ai .nx-nova-modes{display:flex;gap:6px;padding:8px 12px 6px;background:#111214;overflow-x:auto;scrollbar-width:none}.nx-nova-modes::-webkit-scrollbar{display:none}
      #tab-ai .nx-nova-mode{height:30px;padding:0 11px;border:1px solid #34363b;border-radius:999px;background:#1b1c1f;color:#b9bbc0;font:600 10px/1 system-ui;white-space:nowrap}.nx-nova-mode.active{background:#f2f2f2;color:#111;border-color:#f2f2f2}
      #tab-ai .nx-nova-mode[data-mode="dev"].active{background:#d8f7e8;border-color:#d8f7e8}
      #tab-ai.nx-nova-ai-mobile .ai-quick-actions{display:none!important}
      #tab-ai.nx-nova-ai-mobile #aiBox{flex:1!important;height:auto!important;min-height:320px!important;max-height:none!important;margin:0!important;padding:14px 12px 112px!important;border:0!important;border-radius:0!important;background:#111214!important;overflow-y:auto!important;overscroll-behavior:contain}
      #tab-ai.nx-nova-ai-mobile .ai-message{max-width:100%!important;margin:0 0 18px!important;display:block!important}
      #tab-ai.nx-nova-ai-mobile .ai-label{display:none!important}
      #tab-ai.nx-nova-ai-mobile .ai-bubble{max-width:100%!important;width:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#ececef!important;font:400 14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;white-space:pre-wrap;word-break:break-word}
      #tab-ai.nx-nova-ai-mobile .ai-message.user{display:flex!important;justify-content:flex-end!important}
      #tab-ai.nx-nova-ai-mobile .ai-message.user .ai-bubble{max-width:86%!important;padding:9px 12px!important;border-radius:18px!important;background:#2a2b2f!important;color:#fff!important}
      #tab-ai .nx-nova-tools{display:flex;gap:4px;margin-top:5px}.nx-nova-copy{width:28px;height:26px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#8e9299}.nx-nova-copy svg{width:14px;height:14px}.nx-nova-copy:active{background:#24262a}
      #tab-ai .nx-nova-thinking{display:flex;align-items:center;gap:7px;color:#a5a8ae;font:500 12px/1.4 system-ui}.nx-nova-dots{display:flex;gap:3px}.nx-nova-dots i{width:4px;height:4px;border-radius:50%;background:#bfc1c5;animation:nxNovaDot 1.1s infinite ease-in-out}.nx-nova-dots i:nth-child(2){animation-delay:.15s}.nx-nova-dots i:nth-child(3){animation-delay:.3s}@keyframes nxNovaDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
      #tab-ai.nx-nova-ai-mobile .ai-compose{position:sticky!important;bottom:0!important;z-index:6!important;display:grid!important;grid-template-columns:38px minmax(0,1fr) 38px 40px!important;gap:4px!important;align-items:end!important;margin:0 8px 8px!important;padding:7px!important;border:1px solid #34363b!important;border-radius:24px!important;background:#222327!important;box-shadow:0 8px 24px rgba(0,0,0,.28)!important}
      #tab-ai.nx-nova-ai-mobile #aiInput{width:100%!important;min-height:38px!important;max-height:120px!important;height:38px!important;padding:9px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#f4f4f5!important;font:400 14px/1.35 system-ui!important;resize:none!important;outline:none!important;box-shadow:none!important;overflow-y:auto}
      #tab-ai.nx-nova-ai-mobile #aiInput::placeholder{color:#85888f!important}
      #tab-ai.nx-nova-ai-mobile .ai-icon-btn,#tab-ai.nx-nova-ai-mobile #aiSendBtn{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;display:grid!important;place-items:center!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:#d4d5d8!important;box-shadow:none!important;font-size:0!important}
      #tab-ai.nx-nova-ai-mobile #aiSendBtn{width:40px!important;min-width:40px!important;background:#f2f2f2!important;color:#111!important}.nx-nova-ai-mobile #aiSendBtn:before{display:none!important}.nx-nova-ai-mobile #aiSendBtn svg,.nx-nova-ai-mobile .ai-icon-btn svg{width:18px!important;height:18px!important}
      #tab-ai.nx-nova-ai-mobile #aiVoiceBtn:after{display:none!important}
      #tab-ai.nx-nova-ai-mobile .ai-image-preview{margin:0 12px 7px!important;border-radius:14px!important;background:#222327!important;border:1px solid #34363b!important}
      #tab-ai .nx-nova-status{min-height:22px;padding:0 14px 7px;color:#777b82;font:500 9px/1.3 system-ui;text-align:center;background:#111214}
      #tab-ai.nx-nova-ai-mobile .nx-ai-status-grid,#tab-ai.nx-nova-ai-mobile #aiVoiceStatus,#tab-ai.nx-nova-ai-mobile #nexusVoiceCommandStatus,#tab-ai.nx-nova-ai-mobile #aiConnectionText,#tab-ai.nx-nova-ai-mobile .ai-context-badge{display:none!important}
      .nx-nova-sheet-backdrop{position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;justify-content:center;padding:0}
      .nx-nova-sheet{width:min(100%,560px);max-height:82dvh;overflow:auto;background:#1d1e21;border:1px solid #37393e;border-bottom:0;border-radius:22px 22px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom));color:#f1f1f2;font-family:system-ui}
      .nx-nova-sheet-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.nx-nova-sheet-head strong{flex:1;font-size:15px}.nx-nova-sheet h4{margin:15px 0 7px;font-size:11px;color:#b6b8bd}.nx-nova-field{width:100%;height:42px;margin:0 0 8px;padding:0 11px;border:1px solid #3b3d42;border-radius:11px;background:#111214;color:#f3f3f4;font:12px system-ui;outline:none}.nx-nova-field:focus{border-color:#777b82}
      .nx-nova-sheet-row{display:flex;gap:7px}.nx-nova-sheet-btn{min-height:40px;flex:1;padding:0 10px;border:1px solid #3b3d42;border-radius:11px;background:#292a2e;color:#eee;font:650 11px system-ui}.nx-nova-sheet-btn.primary{background:#f1f1f1;color:#111;border-color:#f1f1f1}.nx-nova-sheet-note{margin:7px 0;color:#8f9298;font:10px/1.45 system-ui}.nx-nova-danger{color:#ffaaa8!important}
      @media(max-width:520px){#tab-ai.nx-nova-ai-mobile .ai-main-card{min-height:calc(100dvh - 128px)!important}#tab-ai.nx-nova-ai-mobile #aiBox{min-height:360px!important}}
      @media(prefers-reduced-motion:reduce){.nx-nova-dots i{animation:none!important}}
    `;
    document.head.appendChild(s);
  }

  function bubble(text,type='ai'){
    const box=$('aiBox'); if(!box)return null;
    const row=document.createElement('div'); row.className='ai-message'+(type==='user'?' user':'');
    const label=document.createElement('div'); label.className='ai-label'; label.textContent=type==='user'?'You':'NOVA AI';
    const body=document.createElement('div'); body.className='ai-bubble'; body.textContent=String(text||'');
    row.append(label,body);
    if(type!=='user') addTools(row,body);
    box.appendChild(row); box.scrollTop=box.scrollHeight;
    return row;
  }
  function addTools(row,body){
    if(row.querySelector('.nx-nova-tools'))return;
    const tools=document.createElement('div'); tools.className='nx-nova-tools';
    const copy=document.createElement('button'); copy.type='button'; copy.className='nx-nova-copy'; copy.title='Copy'; copy.innerHTML=icons.copy;
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(body.textContent||''); copy.style.color='#fff'; setTimeout(()=>copy.style.color='',700);}catch(_){}};
    tools.append(copy); row.append(tools);
  }
  function thinking(){
    const box=$('aiBox'); if(!box)return null;
    const row=document.createElement('div'); row.className='ai-message nx-nova-thinking-row';
    row.innerHTML='<div class="nx-nova-thinking"><span class="nx-nova-dots"><i></i><i></i><i></i></span><span>NOVA AI is working</span></div>';
    box.appendChild(row); box.scrollTop=box.scrollHeight; return row;
  }
  function markExisting(){
    $('aiBox')?.querySelectorAll('.ai-message').forEach(row=>{
      if(row.classList.contains('user'))return;
      const body=row.querySelector('.ai-bubble'); if(body)addTools(row,body);
    });
  }

  function appContext(){
    const text=id=>String($(id)?.textContent||'').trim();
    return [
      `NVX balance: ${text('balance')||'unavailable'}`,
      `Mining: ${text('btnText')||'unavailable'} / ${text('timer')||'unavailable'}`,
      `Profile: ${text('profileName')||text('settingsName')||'unavailable'}`,
      `Email: ${text('profileEmailDisplay')||text('settingsEmail')||'unavailable'}`,
      `Portfolio: ${text('walletTotalUsd')||'unavailable'}`,
      `Network: ${text('connectedWalletNetwork')||'unavailable'}`,
      `Active section: ${document.querySelector('.tab.active')?.id||'unknown'}`
    ].join('\n');
  }

  function normalizeEndpoint(value){
    const raw=String(value||'').trim().replace(/\/+$/,''); if(!raw)return '';
    try{
      const u=new URL(raw);
      const local=['localhost','127.0.0.1'].includes(u.hostname);
      if(u.protocol!=='https:' && !(local&&u.protocol==='http:')) throw new Error('Use HTTPS for phone connection.');
      return u.origin+u.pathname.replace(/\/$/,'');
    }catch(e){throw new Error(e.message||'Invalid endpoint.');}
  }
  async function remote(path,body,timeout=180000){
    const cfg=readCfg(); const endpoint=normalizeEndpoint(cfg.endpoint);
    if(!endpoint||!cfg.token)throw new Error('Local AI is not paired yet.');
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const r=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json','X-NexusNova-Token':cfg.token},body:JSON.stringify(body||{}),cache:'no-store',signal:ctrl.signal});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||data.ok===false)throw new Error(data.error||`HTTP ${r.status}`);
      return data;
    }finally{clearTimeout(timer);}
  }
  async function health(){
    const cfg=readCfg(); const endpoint=normalizeEndpoint(cfg.endpoint); if(!endpoint)throw new Error('Endpoint missing.');
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),10000);
    try{
      const r=await fetch(endpoint+'/health',{cache:'no-store',signal:ctrl.signal}); const d=await r.json(); if(!r.ok)throw new Error(`HTTP ${r.status}`); return d;
    }finally{clearTimeout(timer);}
  }

  function status(text){ const el=$('nxNovaAIStatus'); if(el)el.textContent=text; }
  function modeLabel(mode){return mode==='dev'?'Dev • repo tools':mode==='web'?'Web • fresh research':'Chat • assistant';}
  function updateHeaderStatus(extra=''){
    const cfg=readCfg(); const sub=$('nxNovaAISubtitle'); if(sub)sub.textContent=extra||`${modeLabel(cfg.mode)}${cfg.endpoint&&cfg.token?' • Local GPT-OSS ready to pair':' • Built-in AI'}`;
    document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===cfg.mode));
  }

  async function sendRemote(){
    const input=$('aiInput'); if(!input||busy)return;
    const text=String(input.value||'').trim(); const image=$('aiImageInput')?.files?.[0]||null;
    const cfg=readCfg();
    if(!cfg.useGateway||!cfg.endpoint||!cfg.token||image){ return nativeSend?.(); }
    if(!text)return;
    busy=true; const send=$('aiSendBtn'); if(send)send.disabled=true;
    input.value=''; autoGrow(input);
    const userRow=bubble(text,'user'); saveTurn('user',text); const wait=thinking(); status('Working with local GPT-OSS…');
    try{
      const d=await remote('/api/chat',{message:text,mode:cfg.mode,history:history().slice(0,-1),app_context:appContext()});
      wait?.remove(); const reply=String(d.reply||'').trim()||'No response.'; bubble(reply,'ai'); saveTurn('assistant',reply);
      window.nexusAISpeakV2?.(reply); status(`${d.model||'Local AI'} • ${modeLabel(cfg.mode)}${d.github_writes?' • GitHub writes ON':''}`); updateHeaderStatus(`Local ${d.model||'AI'} • ${modeLabel(cfg.mode)}`);
    }catch(err){
      wait?.remove(); userRow?.remove();
      const rows=history(); if(rows.length&&rows[rows.length-1]?.role==='user')rows.pop(); try{localStorage.setItem(THREAD_KEY,JSON.stringify(rows));}catch(_){}
      status('Local AI unavailable • using built-in AI fallback'); input.value=text; autoGrow(input);
      if(nativeSend) return await nativeSend();
      bubble(`Local AI unavailable: ${err.message||err}`,'ai');
    }finally{busy=false;if(send)send.disabled=false;}
  }

  function wrapSend(){
    const current=window.sendAIMessage;
    if(typeof current==='function' && !current.__nxNovaMobileWrapper){ nativeSend=current; }
    if(window.sendAIMessage?.__nxNovaMobileWrapper)return;
    const wrapped=function(){ return sendRemote(); }; wrapped.__nxNovaMobileWrapper=true; window.sendAIMessage=wrapped;
  }

  function autoGrow(input){
    if(!input)return; input.style.height='38px'; input.style.height=Math.min(120,Math.max(38,input.scrollHeight))+'px';
  }
  function upgradeInput(){
    const old=$('aiInput'); if(!old)return;
    if(old.tagName!=='TEXTAREA'){
      const t=document.createElement('textarea');
      for(const a of Array.from(old.attributes)) if(!['type','onkeydown'].includes(a.name))t.setAttribute(a.name,a.value);
      t.value=old.value||''; old.replaceWith(t);
    }
    const input=$('aiInput'); if(!input||input.dataset.nxNovaInput==='1')return;
    input.dataset.nxNovaInput='1'; input.rows=1;
    input.addEventListener('input',()=>autoGrow(input));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.sendAIMessage?.();}});
  }

  function newChat(){
    clearThread();
    const box=$('aiBox'); if(box){box.innerHTML='';bubble('How can I help you today?','ai');}
    const input=$('aiInput'); if(input){input.value='';autoGrow(input);input.focus();}
    status('New chat • ready');
  }

  function setMode(mode){ saveCfg({mode}); updateHeaderStatus(); status(`${modeLabel(mode)} ready`); }

  function openSettings(){
    document.querySelector('.nx-nova-sheet-backdrop')?.remove();
    const cfg=readCfg(); const back=document.createElement('div'); back.className='nx-nova-sheet-backdrop';
    back.innerHTML=`<div class="nx-nova-sheet" role="dialog" aria-modal="true">
      <div class="nx-nova-sheet-head"><strong>NOVA AI connection</strong><button class="nx-nova-icon" data-close>${icons.close}</button></div>
      <div class="nx-nova-sheet-note">Built-in AI remains available. To use your free local GPT-OSS brain, enter the HTTPS gateway address and pairing token shown by START_MOBILE_GATEWAY.bat.</div>
      <h4>HTTPS gateway</h4><input id="nxNovaEndpoint" class="nx-nova-field" inputmode="url" placeholder="https://your-secure-tunnel.example" value="${escapeAttr(cfg.endpoint)}">
      <h4>Pairing token</h4><input id="nxNovaToken" class="nx-nova-field" type="password" placeholder="Pairing token" value="${escapeAttr(cfg.token)}">
      <div class="nx-nova-sheet-row"><button class="nx-nova-sheet-btn" data-test>Test connection</button><button class="nx-nova-sheet-btn primary" data-save>Save & use local AI</button></div>
      <div id="nxNovaSheetStatus" class="nx-nova-sheet-note">GitHub credentials stay on your PC. This token only pairs this app with your gateway.</div>
      <h4>GitHub safety</h4><div class="nx-nova-sheet-row"><button class="nx-nova-sheet-btn nx-nova-danger" data-arm>Arm GitHub writes</button><button class="nx-nova-sheet-btn" data-disarm>Turn writes OFF</button></div>
      <div class="nx-nova-sheet-note">Dev mode can inspect/edit/commit locally. Push/PR stays OFF until you explicitly arm it.</div>
    </div>`;
    document.body.appendChild(back);
    const sheetStatus=()=>back.querySelector('#nxNovaSheetStatus');
    const vals=()=>({endpoint:back.querySelector('#nxNovaEndpoint')?.value||'',token:back.querySelector('#nxNovaToken')?.value||''});
    back.querySelector('[data-close]').onclick=()=>back.remove(); back.addEventListener('click',e=>{if(e.target===back)back.remove();});
    back.querySelector('[data-save]').onclick=async()=>{try{const v=vals();v.endpoint=normalizeEndpoint(v.endpoint);saveCfg({...v,useGateway:true});sheetStatus().textContent='Saved. NOVA AI will use the local gateway when available.';updateHeaderStatus();}catch(e){sheetStatus().textContent=e.message;}};
    back.querySelector('[data-test]').onclick=async()=>{try{const v=vals();v.endpoint=normalizeEndpoint(v.endpoint);saveCfg({...v,useGateway:true});sheetStatus().textContent='Testing…';const d=await health();sheetStatus().textContent=`Connected • ${d.model||'AI'} • GitHub writes ${d.github_writes?'ON':'OFF'}`;updateHeaderStatus(`Local ${d.model||'AI'} connected`);}catch(e){sheetStatus().textContent=`Connection failed: ${e.message||e}`;}};
    back.querySelector('[data-arm]').onclick=async()=>{const phrase=prompt('Type exactly: ENABLE GITHUB WRITES');if(phrase!=='ENABLE GITHUB WRITES')return;try{sheetStatus().textContent='Arming…';const d=await remote('/api/github-writes',{enabled:true,confirmation:phrase},15000);sheetStatus().textContent=`GitHub writes ${d.github_writes?'ON':'OFF'} for this gateway session.`;}catch(e){sheetStatus().textContent=e.message||String(e);}};
    back.querySelector('[data-disarm]').onclick=async()=>{try{const d=await remote('/api/github-writes',{enabled:false},15000);sheetStatus().textContent=`GitHub writes ${d.github_writes?'ON':'OFF'}.`;}catch(e){sheetStatus().textContent=e.message||String(e);}};
  }
  function escapeAttr(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function buildShell(){
    const tab=$('tab-ai'); const card=tab?.querySelector('.ai-main-card'); if(!tab||!card)return;
    tab.classList.add('nx-nova-ai-mobile');
    const oldHead=card.querySelector('.market-header,.nx-ai-head');
    if(!$('nxNovaAITop')){
      const top=document.createElement('div'); top.id='nxNovaAITop'; top.className='nx-nova-top';
      top.innerHTML=`<div class="nx-nova-mark">N</div><div class="nx-nova-title"><strong>NOVA AI</strong><small id="nxNovaAISubtitle">Smart assistant</small></div><button class="nx-nova-icon" id="nxNovaNewChat" title="New chat">${icons.plus}</button><button class="nx-nova-icon" id="nxNovaSettings" title="AI settings">${icons.settings}</button>`;
      if(oldHead)oldHead.replaceWith(top); else card.prepend(top);
    }
    if(!$('nxNovaAIModes')){
      const modes=document.createElement('div'); modes.id='nxNovaAIModes'; modes.className='nx-nova-modes';
      modes.innerHTML='<button class="nx-nova-mode" data-mode="chat">Chat</button><button class="nx-nova-mode" data-mode="web">Web</button><button class="nx-nova-mode" data-mode="dev">Dev</button>';
      $('nxNovaAITop')?.insertAdjacentElement('afterend',modes);
      modes.addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);});
    }
    if(!$('nxNovaAIStatus')){
      const st=document.createElement('div'); st.id='nxNovaAIStatus'; st.className='nx-nova-status'; st.textContent='Ready';
      card.appendChild(st);
    }
    $('nxNovaNewChat')?.addEventListener('click',newChat,{once:true}); $('nxNovaSettings')?.addEventListener('click',openSettings,{once:true});
    const voice=$('aiVoiceBtn'); if(voice){voice.innerHTML=icons.mic;voice.title='Voice';}
    const attach=$('aiImageInput')?.closest('label'); if(attach){const span=attach.querySelector('.mi-icon')||attach;span.innerHTML=icons.image;attach.title='Attach image';}
    const send=$('aiSendBtn'); if(send){send.innerHTML=icons.send;send.title='Send';}
    upgradeInput(); markExisting(); updateHeaderStatus(); wrapSend();
    const box=$('aiBox'); if(box&&!box.__nxNovaObserver){const obs=new MutationObserver(markExisting);obs.observe(box,{childList:true});box.__nxNovaObserver=obs;}
  }

  function init(){installStyle();buildShell();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  [600,1600,3000,5200,8500].forEach(ms=>setTimeout(()=>{buildShell();wrapSend();},ms));
})();
