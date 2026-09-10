const PROMPT_PREFIXES={
  photo:'Professional editorial photography, realistic lighting, natural materials, precise detail, ',
  portrait:'Premium portrait photography, natural skin texture, flattering controlled light, identity-consistent face, ',
  product:'High-end commercial product photography, studio lighting, clean material detail, advertising quality, ',
  cinema:'Cinematic frame, motivated lighting, controlled color grade, realistic depth, production design, ',
  logo:'Original clean vector-like brand mark, strong silhouette, simple geometry, scalable identity, '
};

function ensureStyles(){
  if(document.getElementById('nx-generator-prompt-assist-v1'))return;
  const style=document.createElement('style');
  style.id='nx-generator-prompt-assist-v1';
  style.textContent=`
    .nxlock-prompt-box.has-nx-prompt-assist textarea{padding-bottom:55px!important}
    .nxfs-prompt-assist{display:flex;position:absolute;left:8px;right:58px;bottom:7px;z-index:3;gap:5px;overflow-x:auto;scrollbar-width:none;white-space:nowrap}
    .nxfs-prompt-assist::-webkit-scrollbar{display:none}
    .nxfs-prompt-assist button{flex:0 0 auto;min-height:25px!important;padding:0 8px!important;border:1px solid rgba(181,127,255,.34)!important;border-radius:999px!important;background:rgba(31,23,48,.92)!important;color:#f7f1ff!important;font-size:7.5px!important;font-weight:800!important;line-height:1!important;box-shadow:none!important}
    .nxfs-prompt-assist button:active{transform:scale(.97)}
    .nxputer-label>.nxfs-prompt-assist{position:static;margin-top:3px}
  `;
  document.head.appendChild(style);
}

function decorate(root){
  const prompt=[...root.querySelectorAll('[data-puter-prompt]')].find(node=>node.closest('.nxlock-generator'))||root.querySelector('[data-puter-prompt]');
  const wrap=prompt?.closest('.nxlock-generator')||prompt?.closest('.nxputer-wrap');
  if(!prompt||!wrap||wrap.dataset.nxPromptAssistV1)return false;
  const lockedBox=prompt.closest('.nxlock-prompt-box');
  const legacyLabel=prompt.closest('.nxputer-label');
  if(!lockedBox&&!legacyLabel)return false;
  wrap.dataset.nxPromptAssistV1='1';
  const row=document.createElement('div');
  row.className='nxfs-prompt-assist';
  row.setAttribute('aria-label','Professional prompt assists');
  row.innerHTML='<button type="button" data-nxfs-prompt="photo">Pro Photo</button><button type="button" data-nxfs-prompt="portrait">Portrait</button><button type="button" data-nxfs-prompt="product">Product</button><button type="button" data-nxfs-prompt="cinema">Cinema</button><button type="button" data-nxfs-prompt="logo">Logo</button>';
  row.querySelectorAll('[data-nxfs-prompt]').forEach(button=>button.addEventListener('click',()=>{
    const prefix=PROMPT_PREFIXES[button.dataset.nxfsPrompt];
    const current=prompt.value.trim();
    if(!current.startsWith(prefix))prompt.value=prefix+current;
    prompt.dispatchEvent(new Event('input',{bubbles:true}));
    prompt.focus();
  }));
  if(lockedBox){lockedBox.classList.add('has-nx-prompt-assist');lockedBox.appendChild(row)}
  else legacyLabel.appendChild(row);
  return true;
}

export function installAiPhotoGeneratorPromptAssistV1(root){
  if(!root||root.__nxGeneratorPromptAssistV1)return()=>{};
  root.__nxGeneratorPromptAssistV1=true;
  ensureStyles();
  let frame=0;
  const sync=()=>{frame=0;decorate(root)};
  const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(sync)});
  observer.observe(root,{childList:true,subtree:true});
  sync();
  return()=>{
    observer.disconnect();
    if(frame)cancelAnimationFrame(frame);
    root.querySelectorAll('.nxfs-prompt-assist').forEach(node=>node.remove());
    root.querySelectorAll('.has-nx-prompt-assist').forEach(node=>node.classList.remove('has-nx-prompt-assist'));
    delete root.__nxGeneratorPromptAssistV1;
  };
}
