/* NexusNova NOVA 5.7 Sol context/provenance layer v1.
 * Loaded after nexusnova-ai-sol57-v1.js.
 * Adds owner memory injection, backend provenance, context status and chat export.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57ContextV1) return;
  window.__nxNovaSol57ContextV1 = true;

  const THREAD_KEY='nexusnova_nova_ai_thread_v1';
  const RULES_KEY='nexusnova_nova_ai_owner_rules_v1';
  const MEMORY_KEY='nexusnova_nova_ai_memory_v1';
  const SENSITIVE=/(password|passcode|private\s*key|seed\s*phrase|secret|api\s*key|pairing\s*token|\botp\b|pin\s*code)/i;
  const $=id=>document.getElementById(id);
  let queued=false;

  function accountKey(){
    const direct=String(window.nexusAccountId||'').trim();
    if(direct)return direct.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,96);
    const uid=String($('profileUserId')?.textContent||'').trim();
    if(uid&&!/loading|unavailable|---/i.test(uid))return uid.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,96);
    return 'guest';
  }
  const runtimeKey=()=>`nexusnova_sol57_runtime_v1:${accountKey()}`;

  function readArray(key,limit=24){
    try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x.map(v=>String(v||'').trim()).filter(v=>v&&!SENSITIVE.test(v)).slice(-limit):[]}catch(_){return []}
  }
  function readThread(){
    try{const x=JSON.parse(localStorage.getItem(THREAD_KEY)||'[]');return Array.isArray(x)?x.filter(r=>r&&['user','assistant'].includes(r.role)&&typeof r.content==='string').slice(-40):[]}catch(_){return []}
  }
  function ownerContext(){return {rules:readArray(RULES_KEY),memory:readArray(MEMORY_KEY)}}
  function ownerText(){
    const c=ownerContext(),parts=[];
    if(c.rules.length)parts.push('Owner rules:\n'+c.rules.map((x,i)=>`${i+1}. ${x}`).join('\n'));
    if(c.memory.length)parts.push('Remembered owner context:\n'+c.memory.map((x,i)=>`${i+1}. ${x}`).join('\n'));
    return parts.join('\n\n');
  }
  function runtime(){try{const x=JSON.parse(localStorage.getItem(runtimeKey())||'{}');return x&&typeof x==='object'?x:{}}catch(_){return {}}}
  function saveRuntime(patch){const next={...runtime(),...patch,updatedAt:Date.now()};try{localStorage.setItem(runtimeKey(),JSON.stringify(next))}catch(_){}schedule();return next}

  function capture(data,startedAt){
    if(!data||typeof data!=='object')return;
    const patch={verifiedAt:Date.now()};
    if(data.model)patch.model=String(data.model).slice(0,160);
    if(data.provider)patch.provider=String(data.provider).slice(0,160);
    if(data.finish_reason||data.finishReason)patch.finishReason=String(data.finish_reason||data.finishReason).slice(0,80);
    if(data.capabilities&&typeof data.capabilities==='object')patch.backendCapabilities=data.capabilities;
    if(data.tools&&(Array.isArray(data.tools)||typeof data.tools==='object'))patch.backendTools=data.tools;
    if(startedAt)patch.latencyMs=Math.max(0,Date.now()-startedAt);
    saveRuntime(patch);
  }

  function installFetchBridge(){
    if(window.__nxNovaSol57ContextFetchBridge)return;window.__nxNovaSol57ContextFetchBridge=true;
    const previousFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const url=String(input?.url||input||''),isChat=url.includes('/api/chat'),startedAt=isChat?Date.now():0;
      try{
        if(isChat&&init&&typeof init.body==='string'){
          const body=JSON.parse(init.body),ctx=ownerContext(),text=ownerText();
          if(body&&typeof body==='object'){
            body.nova_context={owner_context:ctx,account_scope:accountKey(),source:'nova-5.7-sol-client'};
            if(text){const existing=String(body.app_context||'').trim();body.app_context=existing?`${existing}\n\n${text}`:text;}
            init={...init,body:JSON.stringify(body)};
          }
        }
      }catch(_){}
      const response=await previousFetch(input,init);
      if(isChat){try{response.clone().json().then(data=>capture(data,startedAt)).catch(()=>{})}catch(_){}}
      return response;
    };
  }

  function runtimeText(){
    const r=runtime(),rows=[];
    if(r.model)rows.push(`Last backend model: ${r.model}`);
    if(r.provider)rows.push(`Provider: ${r.provider}`);
    if(r.finishReason)rows.push(`Finish: ${r.finishReason}`);
    if(r.latencyMs)rows.push(`Last response: ${r.latencyMs} ms`);
    if(r.verifiedAt)rows.push(`Verified: ${new Date(r.verifiedAt).toLocaleString()}`);
    return rows.join('\n');
  }
  function showContext(){
    const c=ownerContext(),r=runtimeText();
    alert(`NOVA 5.7 Sol Context\n\nOwner rules: ${c.rules.length}\nRemembered items: ${c.memory.length}\nAccount scope: ${accountKey()}${r?`\n\n${r}`:''}\n\nOnly backend-returned provider/model fields are shown as verified runtime data.`);
  }

  function exportChat(){
    const rows=readThread();if(!rows.length){alert('Is chat me export karne ke liye abhi koi conversation nahi hai.');return;}
    const release=window.NexusNovaSol57?.name||'NOVA 5.7 Sol';
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const text=[`# ${release} Chat Export`,'',`Exported: ${new Date().toLocaleString()}`,'',...rows.flatMap(r=>[`## ${r.role==='user'?'You':release}`,'',String(r.content||''),''])].join('\n');
    try{
      const blob=new Blob([text],{type:'text/markdown;charset=utf-8'}),href=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=href;a.download=`nova-5-7-sol-chat-${stamp}.md`;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1200);
    }catch(_){navigator.clipboard?.writeText(text).then(()=>alert('Download unavailable tha, chat clipboard me copy kar di gayi.')).catch(()=>alert('Chat export unavailable.'))}
  }

  function addItem(menu,key,icon,title,desc,handler){
    if(!menu||menu.querySelector(`[data-sol57ctx="${key}"]`))return;
    const b=document.createElement('button');b.type='button';b.className='nx-nova-plus-item';b.dataset.sol57ctx=key;
    b.innerHTML=`<span style="width:18px;text-align:center">${icon}</span><span>${title}<small class="nx-v6-mini">${desc}</small></span>`;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();handler()};menu.appendChild(b);
  }
  function enhanceMenu(){const m=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!m)return;addItem(m,'context','◎','Context status','Memory scope • verified backend • latency',showContext);addItem(m,'export','⇩','Export chat','Save current conversation as Markdown',exportChat)}

  function sync(){
    enhanceMenu();
    const r=runtime(),cfg=(()=>{try{return JSON.parse(localStorage.getItem('nexusnova_nova_ai_mobile_v1')||'{}')}catch(_){return {}}})();
    const sub=$('nxNovaAISubtitle');
    if(sub&&r.model&&cfg.mode==='chat'&&cfg.endpoint&&cfg.token)sub.textContent=`NOVA 5.7 Sol • ${r.model} verified`;
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync()})}
  function init(){installFetchBridge();sync();const tab=$('tab-ai');if(tab&&!tab.__nxSol57ContextObs){const o=new MutationObserver(schedule);o.observe(tab,{childList:true,subtree:true});tab.__nxSol57ContextObs=o}}

  window.NexusNovaSol57Context=Object.freeze({version:'1.0.0',ownerContext,runtime,showContext,exportChat,refresh:sync});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [700,1600,3200,6500].forEach(ms=>setTimeout(schedule,ms));
})();
