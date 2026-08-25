/* NexusNova NOVA AI Options v1
   Familiar lightweight chat controls: plus menu, file/photo attach, web/research,
   chat history, retry, and a hard guard for Website/Dev when local AI is not paired.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIOptionsV1) return;
  window.__nxNovaAIOptionsV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const THREAD_KEY='nexusnova_nova_ai_thread_v1';
  const CHATS_KEY='nexusnova_nova_ai_chats_v1';
  const $=id=>document.getElementById(id);

  const svg={
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M5 12h14"/></svg>',
    history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/></svg>',
    file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/></svg>',
    image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 4"/></svg>',
    globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    research:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M10 7v6M7 10h6"/></svg>',
    site:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>',
    retry:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5"/><path d="M18.2 16a7 7 0 1 1-.6-9.2L20 9"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function cfg(){
    try{return {mode:'chat',endpoint:'',token:'',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {mode:'chat',endpoint:'',token:''}}
  }
  function saveCfg(patch){
    const next={...cfg(),...patch};
    try{localStorage.setItem(CFG_KEY,JSON.stringify(next))}catch(_){}
    return next;
  }
  function thread(){
    try{const x=JSON.parse(localStorage.getItem(THREAD_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}
  }
  function chats(){
    try{const x=JSON.parse(localStorage.getItem(CHATS_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}
  }
  function archiveCurrent(){
    const rows=thread().filter(x=>x&&(x.role==='user'||x.role==='assistant')&&String(x.content||'').trim());
    if(!rows.some(x=>x.role==='user'))return;
    const title=String(rows.find(x=>x.role==='user')?.content||'Chat').replace(/\s+/g,' ').trim().slice(0,64)||'Chat';
    const signature=rows.map(x=>x.role+':'+x.content).join('|').slice(-5000);
    const list=chats();
    if(list[0]?.signature===signature)return;
    list.unshift({id:Date.now().toString(36),title,updatedAt:Date.now(),signature,rows:rows.slice(-20)});
    try{localStorage.setItem(CHATS_KEY,JSON.stringify(list.slice(0,12)))}catch(_){}
  }

  function installStyle(){
    if($('nxNovaAIOptionsStyle'))return;
    const s=document.createElement('style');s.id='nxNovaAIOptionsStyle';s.textContent=`
      #tab-ai .nx-nova-plus-menu{position:fixed;z-index:10055;left:10px;bottom:82px;width:min(290px,calc(100vw - 20px));padding:7px;border:1px solid #37393e;border-radius:16px;background:#1d1e21;box-shadow:0 14px 40px rgba(0,0,0,.42);font-family:system-ui}
      #tab-ai .nx-nova-plus-item{width:100%;min-height:43px;display:flex;align-items:center;gap:11px;padding:0 11px;border:0;border-radius:11px;background:transparent;color:#ededee;text-align:left;font:600 12px/1.2 system-ui}
      #tab-ai .nx-nova-plus-item:active{background:#2a2c30}.nx-nova-plus-item svg{width:18px;height:18px;color:#b9bbc0;flex:0 0 18px}.nx-nova-plus-item small{display:block;margin-top:2px;color:#81858c;font-size:9px;font-weight:500}
      #tab-ai .nx-nova-tools .nx-nova-retry{width:28px;height:26px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#8e9299;padding:0}.nx-nova-retry svg{width:14px;height:14px}.nx-nova-retry:active{background:#24262a}
      .nx-nova-history-back{position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;justify-content:center}
      .nx-nova-history-sheet{width:min(100%,560px);max-height:80dvh;overflow:auto;padding:14px 12px calc(18px + env(safe-area-inset-bottom));border:1px solid #393b40;border-bottom:0;border-radius:22px 22px 0 0;background:#1d1e21;color:#eee;font-family:system-ui}
      .nx-nova-history-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.nx-nova-history-head strong{flex:1;font-size:15px}.nx-nova-history-close{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#ddd}.nx-nova-history-close svg{width:18px;height:18px}
      .nx-nova-history-item{width:100%;display:block;margin:0 0 6px;padding:10px 11px;border:1px solid #34363a;border-radius:12px;background:#232428;color:#eee;text-align:left}.nx-nova-history-item strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-nova-history-item small{display:block;margin-top:3px;color:#858990;font-size:9px}
      .nx-nova-history-empty{padding:18px 8px;color:#8c9097;text-align:center;font-size:11px}.nx-nova-history-clear{width:100%;height:40px;margin-top:5px;border:1px solid #3a3c41;border-radius:11px;background:#292a2e;color:#ffb0ad;font:650 11px system-ui}
      #tab-ai .nx-nova-local-required{color:#f5c16f!important}
    `;document.head.appendChild(s);
  }

  function setInput(text,append=false){
    const input=$('aiInput');if(!input)return;
    input.value=append&&input.value?input.value+'\n\n'+text:text;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();input.setSelectionRange?.(input.value.length,input.value.length);
  }
  function setMode(mode){
    saveCfg({mode});
    document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    const st=$('nxNovaAIStatus');if(st)st.textContent=mode==='website'?'Website Mode • repo kaam local GPT-OSS se':mode==='web'?'Web Search • fresh public research':'Ready';
  }

  function closePlus(){document.querySelector('#tab-ai .nx-nova-plus-menu')?.remove()}
  function openPlus(){
    closePlus();
    const tab=$('tab-ai');if(!tab)return;
    const menu=document.createElement('div');menu.className='nx-nova-plus-menu';
    menu.innerHTML=`
      <button class="nx-nova-plus-item" data-a="photo">${svg.image}<span>Photo / Camera<small>Image ko existing vision flow me bhejo</small></span></button>
      <button class="nx-nova-plus-item" data-a="file">${svg.file}<span>Upload file<small>Text, code, JSON, CSV, HTML aur notes</small></span></button>
      <button class="nx-nova-plus-item" data-a="web">${svg.globe}<span>Search the web<small>Fresh public information dhoondo</small></span></button>
      <button class="nx-nova-plus-item" data-a="research">${svg.research}<span>Deep research<small>Multiple sources compare karke detailed answer</small></span></button>
      <button class="nx-nova-plus-item" data-a="website">${svg.site}<span>Website Mode<small>NexusNova website inspect, edit, test aur PR</small></span></button>`;
    tab.appendChild(menu);
    menu.addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');if(!b)return;
      const a=b.dataset.a;closePlus();
      if(a==='photo')return $('aiImageInput')?.click();
      if(a==='file')return $('nxNovaAIFileInput')?.click();
      if(a==='web'){setMode('web');setInput('Web par fresh information search karke meri help karo: ');return;}
      if(a==='research'){setMode('web');setInput('Deep research karo. Multiple reliable current sources compare karo, important disagreements/limitations batao aur concise conclusion do. Topic: ');return;}
      if(a==='website'){setMode('website');setInput('Meri NexusNova website ko inspect karke ye kaam khud complete karo: ');}
    });
    setTimeout(()=>document.addEventListener('click',outsidePlus,{capture:true,once:true}),0);
  }
  function outsidePlus(e){const m=document.querySelector('#tab-ai .nx-nova-plus-menu');if(m&&!m.contains(e.target)&&!e.target.closest('#nxNovaPlusButton'))closePlus()}

  function ensureFileInput(){
    if($('nxNovaAIFileInput'))return;
    const f=document.createElement('input');f.type='file';f.id='nxNovaAIFileInput';f.hidden=true;
    f.accept='.txt,.md,.json,.csv,.html,.htm,.css,.js,.mjs,.ts,.tsx,.jsx,.xml,.yml,.yaml,.py,.java,.kt,.kts,.c,.cpp,.h,.hpp,.sql,.log,text/*,application/json';
    f.addEventListener('change',async()=>{
      const file=f.files?.[0];if(!file)return;
      try{
        if(file.size>1_000_000)throw new Error('File 1 MB se bari hai. Filhal chhoti text/code file use karo.');
        const text=await file.text();
        setInput(`Attached file: ${file.name}\n\n--- FILE CONTENT ---\n${text.slice(0,60000)}\n--- END FILE ---\n\nIs file ke bare me mera instruction: `,true);
        const st=$('nxNovaAIStatus');if(st)st.textContent=`Attached • ${file.name}`;
      }catch(err){alert(err.message||String(err));}
      f.value='';
    });
    document.body.appendChild(f);
  }

  function addRetry(row){
    if(!row||row.classList.contains('user'))return;
    const tools=row.querySelector('.nx-nova-tools');if(!tools||tools.querySelector('.nx-nova-retry'))return;
    const b=document.createElement('button');b.type='button';b.className='nx-nova-retry';b.title='Retry';b.innerHTML=svg.retry;
    b.onclick=()=>{
      const rows=thread();const last=[...rows].reverse().find(x=>x.role==='user'&&String(x.content||'').trim());
      if(!last)return;
      setInput(last.content);window.sendAIMessage?.();
    };
    tools.appendChild(b);
  }
  function enhanceRows(){document.querySelectorAll('#aiBox .ai-message').forEach(addRetry)}

  function renderThread(rows){
    const box=$('aiBox');if(!box)return;
    box.innerHTML='';
    rows.forEach(x=>{
      const row=document.createElement('div');row.className='ai-message'+(x.role==='user'?' user':'');
      const label=document.createElement('div');label.className='ai-label';label.textContent=x.role==='user'?'You':'NOVA AI';
      const body=document.createElement('div');body.className='ai-bubble';body.textContent=String(x.content||'');
      row.append(label,body);box.appendChild(row);
    });
    box.scrollTop=box.scrollHeight;setTimeout(enhanceRows,80);
  }
  function restoreChat(chat){
    if(!chat?.rows)return;
    try{localStorage.setItem(THREAD_KEY,JSON.stringify(chat.rows.slice(-20)))}catch(_){}
    renderThread(chat.rows.slice(-20));
    document.querySelector('.nx-nova-history-back')?.remove();
    const st=$('nxNovaAIStatus');if(st)st.textContent='Previous chat restored';
  }
  function openHistory(){
    archiveCurrent();document.querySelector('.nx-nova-history-back')?.remove();
    const back=document.createElement('div');back.className='nx-nova-history-back';const list=chats();
    back.innerHTML=`<div class="nx-nova-history-sheet"><div class="nx-nova-history-head"><strong>Chat history</strong><button class="nx-nova-history-close">${svg.close}</button></div><div class="nx-nova-history-list"></div><button class="nx-nova-history-clear">Clear saved history</button></div>`;
    const holder=back.querySelector('.nx-nova-history-list');
    if(!list.length)holder.innerHTML='<div class="nx-nova-history-empty">Abhi koi saved chat nahi hai.</div>';
    list.forEach(c=>{
      const b=document.createElement('button');b.className='nx-nova-history-item';b.innerHTML=`<strong>${escapeHtml(c.title||'Chat')}</strong><small>${new Date(c.updatedAt||Date.now()).toLocaleString()}</small>`;b.onclick=()=>restoreChat(c);holder.appendChild(b);
    });
    back.querySelector('.nx-nova-history-close').onclick=()=>back.remove();back.addEventListener('click',e=>{if(e.target===back)back.remove()});
    back.querySelector('.nx-nova-history-clear').onclick=()=>{if(confirm('Saved NOVA AI chat history clear karni hai?')){try{localStorage.removeItem(CHATS_KEY)}catch(_){}back.remove();}};
    document.body.appendChild(back);
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function upgradeTop(){
    const top=$('nxNovaAITop');if(!top)return;
    if(!$('nxNovaHistory')){
      const b=document.createElement('button');b.id='nxNovaHistory';b.className='nx-nova-icon';b.title='Chat history';b.innerHTML=svg.history;b.onclick=openHistory;
      const settings=$('nxNovaSettings');top.insertBefore(b,settings||null);
    }
  }
  function upgradePlus(){
    const image=$('aiImageInput');if(!image)return;
    let label=image.closest('label');
    if(!label){label=document.querySelector('#tab-ai .ai-compose .ai-icon-btn');if(!label)return;}
    if(label.id==='nxNovaPlusButton')return;
    label.id='nxNovaPlusButton';label.title='Attach & tools';
    const target=label.querySelector('.mi-icon')||label;target.innerHTML=svg.plus;
    label.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPlus();});
  }

  function installWebsiteGuard(){
    const current=window.sendAIMessage;
    if(typeof current!=='function'||current.__nxNovaOptionsGuard||!current.__nxNovaMobileWrapper)return false;
    const guarded=async function(...args){
      const c=cfg();
      if((c.mode==='website'||c.mode==='dev')&&(!String(c.endpoint||'').trim()||!String(c.token||'').trim())){
        const st=$('nxNovaAIStatus');if(st){st.textContent='Local Dev AI pairing required • Settings kholo';st.classList.add('nx-nova-local-required')}
        $('nxNovaSettings')?.click();
        return;
      }
      return current.apply(this,args);
    };
    guarded.__nxNovaOptionsGuard=true;
    guarded.__nxNovaMobileWrapper=true; // keep the mobile shell from re-wrapping this guard later
    window.sendAIMessage=guarded;return true;
  }

  function hookNewChat(){
    const b=$('nxNovaNewChat');if(!b||b.dataset.nxArchiveHook==='1')return;
    b.dataset.nxArchiveHook='1';b.addEventListener('click',archiveCurrent,true);
  }
  function init(){
    installStyle();ensureFileInput();upgradeTop();upgradePlus();hookNewChat();enhanceRows();installWebsiteGuard();
    const box=$('aiBox');if(box&&!box.__nxOptionsObserver){const o=new MutationObserver(enhanceRows);o.observe(box,{childList:true,subtree:true});box.__nxOptionsObserver=o;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [600,1200,2200,4000,7000,10000].forEach(ms=>setTimeout(init,ms));
  window.addEventListener('beforeunload',archiveCurrent);
})();