/* NexusNova NOVA 5.7 Sol persistent recents/history v1.
 * Mirrors visible chat turns into bounded local history for Recents and Search.
 * No cloud sync is claimed here; this is device-local persistence.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57HistoryV1) return;
  window.__nxNovaSol57HistoryV1 = true;

  const THREAD='nexusnova_nova_ai_thread_v1';
  const CHATS='nexusnova_nova_ai_chats_v1';
  const CURRENT='nexusnova_sol57_current_chat_v1';
  const MAX_TURNS=40, MAX_CHATS=50, MAX_CHARS=7000;
  let timer=0, observer=null;

  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v??fallback}catch(_){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
  const uid=()=>`chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const norm=t=>String(t||'').replace(/\s+/g,' ').trim();

  function visibleRows(){
    const box=document.getElementById('aiBox'); if(!box)return [];
    const out=[];
    box.querySelectorAll('.ai-message').forEach(row=>{
      if(row.classList.contains('nx-nova-thinking-row'))return;
      const bubble=row.querySelector('.ai-bubble');
      const content=String(bubble?.textContent||'').trim();
      if(!content)return;
      out.push({role:row.classList.contains('user')?'user':'assistant',content:content.slice(0,MAX_CHARS),at:Date.now()});
    });
    return out.slice(-MAX_TURNS);
  }

  function signature(rows){return JSON.stringify((rows||[]).map(r=>[r.role,String(r.content||'')]).slice(-MAX_TURNS))}
  function chats(){const x=read(CHATS,[]);return Array.isArray(x)?x.filter(c=>c&&c.id&&Array.isArray(c.rows)).slice(0,MAX_CHATS):[]}
  function currentId(){try{return String(localStorage.getItem(CURRENT)||'').trim()}catch(_){return ''}}
  function setCurrent(id){try{id?localStorage.setItem(CURRENT,id):localStorage.removeItem(CURRENT)}catch(_){}}

  function titleFor(rows){
    const first=(rows||[]).find(r=>r.role==='user'&&norm(r.content));
    const text=norm(first?.content||'New chat');
    return text.length>64?`${text.slice(0,61)}…`:text;
  }

  function resolveId(rows,list){
    const existing=currentId();
    if(existing&&list.some(c=>c.id===existing))return existing;
    const sig=signature(rows);
    const match=list.find(c=>signature(c.rows)===sig);
    if(match){setCurrent(match.id);return match.id}
    const id=uid();setCurrent(id);return id;
  }

  function saveNow(){
    const rows=visibleRows();
    if(!rows.length){
      const thread=read(THREAD,[]);
      if(!Array.isArray(thread)||!thread.length)setCurrent('');
      return false;
    }
    write(THREAD,rows);
    const list=chats(), id=resolveId(rows,list), now=Date.now();
    const item={id,title:titleFor(rows),rows,updatedAt:now};
    const next=[item,...list.filter(c=>c.id!==id)].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,MAX_CHATS);
    write(CHATS,next);
    try{window.dispatchEvent(new CustomEvent('nexusnova:history-updated',{detail:{id,count:next.length}}))}catch(_){}
    return true;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(saveNow,450)}
  function bind(){
    const box=document.getElementById('aiBox'); if(!box)return false;
    if(observer)observer.disconnect();
    observer=new MutationObserver(schedule);
    observer.observe(box,{childList:true,subtree:true,characterData:true});
    schedule();
    return true;
  }

  function init(){
    if(bind())return;
    const root=document.getElementById('tab-ai')||document.body;
    const wait=new MutationObserver(()=>{if(bind())wait.disconnect()});
    wait.observe(root,{childList:true,subtree:true});
    [700,1600,3200,6500].forEach(ms=>setTimeout(()=>{if(!observer)bind()},ms));
  }

  window.NexusNovaSol57History=Object.freeze({version:'1.0.0',saveNow,chats,refresh:bind});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();