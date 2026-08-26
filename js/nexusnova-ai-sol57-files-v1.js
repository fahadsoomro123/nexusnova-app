/* NexusNova NOVA 5.7 Sol multi-file context v1.
 * Text/code files only. Keeps existing single-file and image owners untouched.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57FilesV1) return;
  window.__nxNovaSol57FilesV1 = true;

  const $=id=>document.getElementById(id);
  const INPUT_ID='nxNovaSol57FilesInput';
  const MAX_FILES=6,MAX_FILE_BYTES=1_000_000,MAX_TOTAL_BYTES=2_000_000,MAX_FILE_CHARS=28_000,MAX_TOTAL_CHARS=90_000;
  const ALLOWED=/\.(txt|md|json|csv|tsv|html?|css|js|mjs|cjs|ts|tsx|jsx|xml|ya?ml|py|java|kt|kts|c|cc|cpp|h|hpp|sql|log|ini|toml|properties|gradle|sh|bat|ps1)$/i;
  let manifest=[];

  function status(text){const el=$('nxNovaAIStatus');if(el)el.textContent=text}
  function safeName(name){return String(name||'file').replace(/[\r\n\t]/g,' ').slice(0,160)}
  function supported(file){return Boolean(file&&((file.type||'').startsWith('text/')||/json|xml|javascript/.test(file.type||'')||ALLOWED.test(file.name||'')))}
  function formatBytes(n){if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(2)} MB`}

  function ensureInput(){
    if($(INPUT_ID))return $(INPUT_ID);
    const input=document.createElement('input');input.id=INPUT_ID;input.type='file';input.hidden=true;input.multiple=true;
    input.accept='.txt,.md,.json,.csv,.tsv,.html,.htm,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.xml,.yml,.yaml,.py,.java,.kt,.kts,.c,.cc,.cpp,.h,.hpp,.sql,.log,.ini,.toml,.properties,.gradle,.sh,.bat,.ps1,text/*,application/json,application/xml';
    input.addEventListener('change',()=>attachFiles(input.files));document.body.appendChild(input);return input;
  }

  async function attachFiles(fileList){
    const files=Array.from(fileList||[]).slice(0,MAX_FILES);if(!files.length)return;
    const accepted=[];let totalBytes=0,totalChars=0;
    for(const file of files){
      if(!supported(file)){status(`Skipped unsupported file • ${safeName(file.name)}`);continue}
      if(file.size>MAX_FILE_BYTES){status(`Skipped >1 MB file • ${safeName(file.name)}`);continue}
      if(totalBytes+file.size>MAX_TOTAL_BYTES)break;
      const raw=await file.text();const remaining=Math.max(0,MAX_TOTAL_CHARS-totalChars);if(!remaining)break;
      const content=raw.slice(0,Math.min(MAX_FILE_CHARS,remaining));
      accepted.push({name:safeName(file.name),size:file.size,type:String(file.type||'text/plain').slice(0,100),content,truncated:content.length<raw.length});
      totalBytes+=file.size;totalChars+=content.length;
    }
    const input=$('aiInput');if(!input||!accepted.length){ensureInput().value='';return}
    manifest=accepted.map(({name,size,type,truncated})=>({name,size,type,truncated}));
    const block=['NOVA 5.7 Sol attached files:',...accepted.flatMap((f,i)=>[
      `\n--- FILE ${i+1}: ${f.name} (${formatBytes(f.size)})${f.truncated?' [TRUNCATED]':''} ---`,f.content,`--- END FILE ${i+1} ---`
    ]),'\nInstruction for these files: '].join('\n');
    input.value=(input.value?input.value+'\n\n':'')+block;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange?.(input.value.length,input.value.length);
    status(`Attached ${accepted.length} files • ${formatBytes(totalBytes)} • text/code context ready`);ensureInput().value='';
  }

  function installFetchBridge(){
    if(window.__nxNovaSol57FilesFetchBridge)return;window.__nxNovaSol57FilesFetchBridge=true;
    const previousFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      try{const url=String(input?.url||input||'');if(manifest.length&&url.includes('/api/chat')&&init&&typeof init.body==='string'){
        const body=JSON.parse(init.body);if(body&&typeof body==='object'){body.nova_files={count:manifest.length,files:manifest,content_embedded_in_message:true};init={...init,body:JSON.stringify(body)}}
      }}catch(_){}
      const response=await previousFetch(input,init);if(String(input?.url||input||'').includes('/api/chat'))manifest=[];return response;
    };
  }

  function addMenu(){
    const menu=document.querySelector('#tab-ai .nx-nova-plus-menu');if(!menu||menu.querySelector('[data-sol57files="multi"]'))return;
    const b=document.createElement('button');b.type='button';b.className='nx-nova-plus-item';b.dataset.sol57files='multi';
    b.innerHTML='<span style="width:18px;text-align:center">▤</span><span>Attach multiple files<small class="nx-v6-mini">Up to 6 text/code files • safe size limits</small></span>';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();ensureInput().click()};menu.appendChild(b);
  }
  function init(){ensureInput();installFetchBridge();addMenu();const tab=$('tab-ai');if(tab&&!tab.__nxSol57FilesObs){const o=new MutationObserver(addMenu);o.observe(tab,{childList:true,subtree:true});tab.__nxSol57FilesObs=o}}

  window.NexusNovaSol57Files=Object.freeze({version:'1.0.0',open:()=>ensureInput().click(),attach:attachFiles,manifest:()=>manifest.map(x=>({...x}))});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [800,1800,3600,7000].forEach(ms=>setTimeout(addMenu,ms));
})();