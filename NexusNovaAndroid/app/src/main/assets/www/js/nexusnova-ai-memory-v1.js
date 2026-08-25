/* NexusNova NOVA AI Memory v1
   Persistent owner rules + memory, with local mirror and paired-gateway sync.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIMemoryV1) return;
  window.__nxNovaAIMemoryV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const RULES_KEY='nexusnova_nova_ai_owner_rules_v1';
  const MEMORY_KEY='nexusnova_nova_ai_memory_v1';
  const MAX=100;
  const $=id=>document.getElementById(id);
  const sensitive=['password','passcode','private key','seed phrase','secret','api key','token','otp','pin code'];

  function load(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x.filter(v=>typeof v==='string'&&v.trim()).slice(-MAX):[]}catch(_){return []}}
  function save(key,rows){const clean=[];for(const row of rows){const t=String(row||'').trim().replace(/\s+/g,' ').slice(0,1200);if(t&&!clean.includes(t))clean.push(t)}try{localStorage.setItem(key,JSON.stringify(clean.slice(-MAX)))}catch(_){}return clean.slice(-MAX)}
  function cfg(){try{return {endpoint:'',token:'',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {endpoint:'',token:''}}}
  function kindOf(text){const low=String(text||'').toLowerCase();if(['rule:','rule ','hamesha ','always ','har baar ','must ','zaroor ','ye rule'].some(x=>low.includes(x)))return'rule';if(['yaad rakh','yaad rakho','remember ','kal bhi yaad','future me yaad'].some(x=>low.includes(x)))return'memory';return''}
  function safe(text){const low=String(text||'').toLowerCase();return String(text||'').trim()&&!sensitive.some(x=>low.includes(x))}
  function status(text){const el=$('nxNovaAIStatus');if(el)el.textContent=text}
  async function gateway(path,body){const c=cfg();if(!c.endpoint||!c.token)throw new Error('Local AI not paired');const endpoint=String(c.endpoint).replace(/\/+$/,'');const r=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json','X-NexusNova-Token':c.token},body:JSON.stringify(body||{}),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d}
  async function syncOne(kind,text){try{await gateway('/api/memory/add',{kind,text})}catch(_){} }
  async function syncAll(){const c=cfg();if(!c.endpoint||!c.token)return;for(const t of load(RULES_KEY))await syncOne('rule',t);for(const t of load(MEMORY_KEY))await syncOne('memory',t)}
  function remember(text,kind){if(!safe(text)){status('Sensitive info memory me save nahi ki gayi');return false}const key=kind==='rule'?RULES_KEY:MEMORY_KEY;const rows=save(key,[...load(key),text]);syncOne(kind,text);status(`${kind==='rule'?'Rule':'Memory'} saved • ${rows.length}`);return true}

  function wrapSend(){const current=window.sendAIMessage;if(typeof current!=='function'||current.__nxMemoryWrapped)return false;const wrapped=function(...args){const text=String($('aiInput')?.value||'').trim();const kind=kindOf(text);if(kind)remember(text,kind);return current.apply(this,args)};wrapped.__nxMemoryWrapped=true;wrapped.__nxNovaMobileWrapper=current.__nxNovaMobileWrapper;wrapped.__nxNovaOptionsGuard=current.__nxNovaOptionsGuard;window.sendAIMessage=wrapped;return true}

  function escape(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function openManager(){
    document.querySelector('.nx-memory-back')?.remove();
    const rules=load(RULES_KEY),mem=load(MEMORY_KEY);const back=document.createElement('div');back.className='nx-memory-back';
    back.innerHTML=`<div class="nx-memory-sheet"><div class="nx-memory-head"><strong>Owner Memory</strong><button data-close>×</button></div><div class="nx-memory-note">“rule: …” ya “yaad rakh …” likhne par NOVA AI save karegi. Rules future chats me bhi follow honge.</div><h4>Rules (${rules.length})</h4><div class="nx-memory-list">${rules.map(x=>`<div>${escape(x)}</div>`).join('')||'<small>No saved rules</small>'}</div><h4>Memory (${mem.length})</h4><div class="nx-memory-list">${mem.map(x=>`<div>${escape(x)}</div>`).join('')||'<small>No saved memory</small>'}</div><div class="nx-memory-row"><button data-sync>Sync to Local AI</button><button data-clear>Clear all</button></div></div>`;
    document.body.appendChild(back);back.querySelector('[data-close]').onclick=()=>back.remove();back.addEventListener('click',e=>{if(e.target===back)back.remove()});back.querySelector('[data-sync]').onclick=async()=>{status('Memory syncing…');await syncAll();status('Memory sync complete')};back.querySelector('[data-clear]').onclick=async()=>{if(!confirm('Rules aur memory dono clear karni hain?'))return;save(RULES_KEY,[]);save(MEMORY_KEY,[]);try{await gateway('/api/memory/clear',{kind:'all'})}catch(_){}back.remove();status('Owner memory cleared')};
  }
  function css(){if($('nxMemoryStyle'))return;const s=document.createElement('style');s.id='nxMemoryStyle';s.textContent=`.nx-memory-back{position:fixed;inset:0;z-index:10080;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center}.nx-memory-sheet{width:min(100%,560px);max-height:82dvh;overflow:auto;background:#1d1e21;border:1px solid #3a3c41;border-bottom:0;border-radius:22px 22px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom));color:#eee;font-family:system-ui}.nx-memory-head{display:flex;align-items:center;gap:10px}.nx-memory-head strong{flex:1;font-size:15px}.nx-memory-head button{width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:#ddd;font-size:24px}.nx-memory-note{margin:8px 0 14px;color:#979aa1;font-size:10px;line-height:1.45}.nx-memory-sheet h4{margin:12px 0 6px;font-size:11px}.nx-memory-list{display:grid;gap:5px}.nx-memory-list div{padding:9px 10px;border:1px solid #34363b;border-radius:10px;background:#242529;color:#ddd;font-size:10px;line-height:1.4}.nx-memory-list small{color:#81858c}.nx-memory-row{display:flex;gap:7px;margin-top:14px}.nx-memory-row button{flex:1;min-height:40px;border:1px solid #3a3c41;border-radius:11px;background:#292a2e;color:#eee;font:650 11px system-ui}.nx-memory-row button:last-child{color:#ffaaa8}`;document.head.appendChild(s)}
  function addMenu(){const m=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!m||m.querySelector('[data-a="memory"]'))return;const b=document.createElement('button');b.className='nx-nova-plus-item';b.dataset.a='memory';b.innerHTML='<span style="width:18px;text-align:center">◉</span><span>Memory & Rules<small>Jo kaha hai kal bhi yaad rakho</small></span>';b.onclick=e=>{e.preventDefault();e.stopPropagation();m.remove();openManager()};m.appendChild(b)}
  function init(){css();wrapSend();addMenu();syncAll();const tab=$('tab-ai');if(tab&&!tab.__nxMemObs){const o=new MutationObserver(()=>{wrapSend();addMenu()});o.observe(tab,{childList:true,subtree:true});tab.__nxMemObs=o}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();[800,1800,3500,6000].forEach(ms=>setTimeout(init,ms));
  window.NexusNovaMemory={remember,open:openManager,sync:syncAll,rules:()=>load(RULES_KEY),memory:()=>load(MEMORY_KEY)};
})();