/* NexusNova NOVA 5.7 Sol readiness + draft safety v1.
 * Honest local capability status, prompt draft recovery and desktop shortcuts.
 * No backend capability is claimed unless it is configured or observed at runtime.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57ReadinessV1) return;
  window.__nxNovaSol57ReadinessV1 = true;

  const CFG='nexusnova_nova_ai_mobile_v1';
  const DRAFT='nexusnova_sol57_prompt_draft_v1';
  const $=id=>document.getElementById(id);
  let observer=null, queued=false, draftBound=null;

  const readJson=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v??fallback}catch(_){return fallback}};
  const cfg=()=>{const v=readJson(CFG,{});return v&&typeof v==='object'?v:{}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function gateway(){
    const c=cfg(),endpoint=String(c.endpoint||'').trim(),token=String(c.token||'').trim();
    if(!endpoint||!token)return null;
    try{
      const u=new URL(endpoint),local=/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
      if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))return null;
      return {host:u.host,secure:u.protocol==='https:',local};
    }catch(_){return null}
  }

  function runtime(){try{return window.NexusNovaSol57Context?.runtime?.()||{}}catch(_){return {}}}
  function status(label,state,detail){return {label,state,detail:String(detail||'')}}

  function snapshot(){
    const c=cfg(),g=gateway(),r=runtime();
    const rows=[];
    rows.push(status('Internet',navigator.onLine?'ready':'offline',navigator.onLine?'Device reports online':'No network connection detected'));
    rows.push(status('Paired NOVA gateway',g?'ready':'setup',g?`${g.host}${g.local?' • local':''}${g.secure?' • HTTPS':''}`:'Pair endpoint + token in NOVA Settings'));
    rows.push(status('Chat runtime',r.model?'verified':(g?'unknown':'fallback'),r.model?`${r.model}${r.provider?` • ${r.provider}`:''}`:g?'No backend model has been observed yet':'Built-in/fallback path remains available'));
    rows.push(status('Work MAX',window.NexusNovaV6?.paired?.()?'ready':'setup',window.NexusNovaV6?.paired?.()?`Workspace: ${window.NexusNovaV6?.workspaceName?.()||'configured'}`:'Requires paired local NOVA gateway'));
    rows.push(status('Files',window.NexusNovaSol57Files?'ready':'unavailable',window.NexusNovaSol57Files?'Multi-file context module loaded':'Files module not loaded'));
    rows.push(status('Memory',window.NexusNovaMemory?'ready':'unavailable',window.NexusNovaMemory?'NOVA memory owner loaded':'Memory owner not detected'));
    const plugins=!!(window.NexusNovaBrowserExtensions||window.nxOpenBrowserExtensions);
    rows.push(status('Plugins',plugins?'ready':'on-demand',plugins?'Plugins hub loaded':'Loads on demand when opened'));
    const video=!!window.NexusNovaSol57Video,videoGateway=!!window.NexusNovaSol57Video?.backendConfigured?.();
    rows.push(status('Video Studio',video?(videoGateway?'configured':'setup'):'unavailable',video?(videoGateway?'Gateway configured; provider support is verified only by real generation':'Studio loaded; video-capable provider/gateway still required'):'Video module not loaded'));
    rows.push(status('Research',window.NexusNovaV6?'routed':'unavailable',window.NexusNovaV6?'Research mode routes to NOVA; fresh web research still requires a capable backend/browser tool':'Research route not detected'));
    rows.push(status('Native Android bridge',typeof window.NexusAndroid?.postMessage==='function'?'ready':'web',typeof window.NexusAndroid?.postMessage==='function'?'Android native bridge detected':'Web/PC mode — native Android bridge not expected'));
    rows.push(status('Profile','ready',`${c.uiModelProfile||'sol'} • ${c.uiSpeed||'fast'} • ${c.uiIntelligence||'max'}`));
    return rows;
  }

  function installStyle(){
    if($('nxSol57ReadinessStyle'))return;
    const s=document.createElement('style');s.id='nxSol57ReadinessStyle';s.textContent=`
      .nx-v57-ready-back{position:fixed;inset:0;z-index:2147483400;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui}.nx-v57-ready-sheet{width:min(760px,100%);max-height:90dvh;overflow:auto;border:1px solid #3b3b3b;border-bottom:0;border-radius:28px 28px 0 0;background:#171717;color:#f4f4f4}.nx-v57-ready-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:17px 18px;border-bottom:1px solid #303030;background:#171717}.nx-v57-ready-head div{flex:1}.nx-v57-ready-head strong{display:block;font-size:20px}.nx-v57-ready-head small{display:block;margin-top:4px;color:#8f8f8f}.nx-v57-ready-head button{width:40px;height:40px;border:0;border-radius:50%;background:#2b2b2b;color:#fff;font-size:22px}.nx-v57-ready-body{padding:15px 18px 28px}.nx-v57-ready-row{display:flex;align-items:center;gap:10px;padding:12px 13px;margin-bottom:8px;border:1px solid #343434;border-radius:15px;background:#202020}.nx-v57-ready-dot{width:10px;height:10px;flex:0 0 10px;border-radius:50%;background:#777}.nx-v57-ready-dot.ready,.nx-v57-ready-dot.verified,.nx-v57-ready-dot.routed{background:#9ad9a5}.nx-v57-ready-dot.setup,.nx-v57-ready-dot.unknown,.nx-v57-ready-dot.on-demand,.nx-v57-ready-dot.fallback{background:#e2ca83}.nx-v57-ready-dot.offline,.nx-v57-ready-dot.unavailable{background:#df8e8e}.nx-v57-ready-copy{min-width:0;flex:1}.nx-v57-ready-copy strong,.nx-v57-ready-copy small{display:block}.nx-v57-ready-copy small{margin-top:4px;color:#8d8d8d;line-height:1.4}.nx-v57-ready-state{font-size:10px;text-transform:uppercase;color:#a7a7a7}.nx-v57-ready-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.nx-v57-ready-actions button{min-height:40px;padding:0 12px;border:1px solid #444;border-radius:11px;background:#292929;color:#eee}.nx-v57-ready-note{margin:13px 0 0;color:#858585;font-size:11px;line-height:1.5}.nx-v57-system-nav{width:100%;min-height:58px;display:flex;align-items:center;gap:18px;border:0;border-radius:13px;background:transparent;color:#eee;text-align:left;font-size:18px;font-weight:650}.nx-v57-system-nav:active{background:#222}.nx-v57-system-nav .ico{width:34px;text-align:center;font-size:23px}
      @media(min-width:760px){.nx-v57-ready-back{align-items:center;padding:20px}.nx-v57-ready-sheet{border-bottom:1px solid #3b3b3b;border-radius:28px}}
    `;document.head.appendChild(s);
  }

  function openReadiness(){
    installStyle();document.querySelector('.nx-v57-ready-back')?.remove();
    const rows=snapshot(),back=document.createElement('div');back.className='nx-v57-ready-back';
    back.innerHTML=`<section class="nx-v57-ready-sheet"><header class="nx-v57-ready-head"><div><strong>NOVA System Check</strong><small>Real readiness • no fake capability claims</small></div><button type="button" data-close>×</button></header><div class="nx-v57-ready-body"><div data-rows></div><div class="nx-v57-ready-actions"><button data-refresh>Refresh</button><button data-gateway>Test gateway</button><button data-settings>Settings</button></div><p class="nx-v57-ready-note">Green means the client can directly verify or detect the capability. Yellow means setup/on-demand/unknown. Video and fresh web research still depend on the connected backend/provider; this screen does not pretend otherwise.</p></div></section>`;
    const host=back.querySelector('[data-rows]');
    rows.forEach(x=>{const el=document.createElement('div');el.className='nx-v57-ready-row';el.innerHTML=`<span class="nx-v57-ready-dot ${esc(x.state)}"></span><div class="nx-v57-ready-copy"><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></div><span class="nx-v57-ready-state">${esc(x.state)}</span>`;host.appendChild(el)});
    document.body.appendChild(back);
    const close=()=>back.remove();back.querySelector('[data-close]').onclick=close;back.onclick=e=>{if(e.target===back)close()};
    back.querySelector('[data-refresh]').onclick=()=>openReadiness();
    back.querySelector('[data-gateway]').onclick=()=>{close();if(window.NexusNovaV6ConnectionTest?.run)return window.NexusNovaV6ConnectionTest.run();const b=$('nxNovaSettings');if(b)b.click();else alert('NOVA secure connection test is unavailable in this build.')};
    back.querySelector('[data-settings]').onclick=()=>{close();$('nxNovaSettings')?.click()};
  }

  function bindDraft(){
    const input=$('aiInput');if(!input||input===draftBound)return;draftBound=input;
    let restored=false;
    try{const saved=localStorage.getItem(DRAFT)||'';if(!input.value&&saved){input.value=saved.slice(0,12000);input.dispatchEvent(new Event('input',{bubbles:true}));restored=true}}catch(_){}
    if(restored){const st=$('nxNovaAIStatus');if(st&&!/working|thinking/i.test(st.textContent||''))st.textContent='Draft restored';}
    input.addEventListener('input',()=>{try{const text=String(input.value||'');if(text.trim())localStorage.setItem(DRAFT,text.slice(0,12000));else localStorage.removeItem(DRAFT)}catch(_){}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){setTimeout(()=>{if(!String(input.value||'').trim())try{localStorage.removeItem(DRAFT)}catch(_){}},120)}});
    const send=$('aiSendBtn');if(send&&!send.dataset.sol57DraftBound){send.dataset.sol57DraftBound='1';send.addEventListener('click',()=>setTimeout(()=>{if(!String(input.value||'').trim())try{localStorage.removeItem(DRAFT)}catch(_){}},120),true)}
  }

  function addSystemNav(){
    document.querySelectorAll('.nx-sol57-ref-nav,.nx-sol57-desktop-nav').forEach(nav=>{
      if(nav.querySelector('[data-v57-system]'))return;
      const b=document.createElement('button');b.type='button';b.dataset.v57System='1';b.className='nx-v57-system-nav';b.innerHTML='<span class="ico">◈</span>System Check';b.onclick=e=>{e.preventDefault();e.stopPropagation();document.querySelector('.nx-sol57-drawer-back')?.remove();openReadiness()};nav.appendChild(b);
    });
  }

  function shortcuts(e){
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=String(e.key||'').toLowerCase();
    if(k==='k'){e.preventDefault();window.NexusNovaSol57Features?.openSearch?.();return}
    if(k===','&&!e.shiftKey){e.preventDefault();$('nxNovaSettings')?.click();return}
    if(k==='n'&&e.shiftKey){e.preventDefault();$('nxNovaNewChat')?.click();return}
    if(k==='s'&&e.shiftKey){e.preventDefault();openReadiness();}
  }

  function networkChanged(){
    if(!navigator.onLine){const st=$('nxNovaAIStatus');if(st)st.textContent='Offline • local cached UI remains available'}
  }

  function sync(){queued=false;bindDraft();addSystemNav();}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(sync)}
  function init(){
    installStyle();sync();document.addEventListener('keydown',shortcuts,true);window.addEventListener('online',networkChanged);window.addEventListener('offline',networkChanged);
    observer=new MutationObserver(queue);observer.observe(document.body,{childList:true,subtree:true});
  }

  window.NexusNovaSol57Readiness=Object.freeze({version:'1.0.0',open:openReadiness,snapshot,refresh:sync});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [600,1400,3000,6500].forEach(ms=>setTimeout(queue,ms));
})();