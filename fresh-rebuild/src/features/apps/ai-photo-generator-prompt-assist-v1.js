const PROMPT_PREFIXES={
  photo:'Professional editorial photography, realistic lighting, natural materials, precise detail, ',
  portrait:'Premium portrait photography, natural skin texture, flattering controlled light, identity-consistent face, ',
  product:'High-end commercial product photography, studio lighting, clean material detail, advertising quality, ',
  cinema:'Cinematic frame, motivated lighting, controlled color grade, realistic depth, production design, ',
  logo:'Original clean vector-like brand mark, strong silhouette, simple geometry, scalable identity, '
};

function decorate(root){
  const prompt=root.querySelector('[data-puter-prompt]');
  const wrap=prompt?.closest('.nxputer-wrap');
  if(!prompt||!wrap||wrap.dataset.nxPromptAssistV1)return false;
  const label=prompt.closest('.nxputer-label');
  if(!label)return false;
  wrap.dataset.nxPromptAssistV1='1';
  const row=document.createElement('div');
  row.className='nxqt-chips nxfs-prompt-assist';
  row.innerHTML='<button class="nxqt-chip" data-nxfs-prompt="photo">Pro Photo</button><button class="nxqt-chip" data-nxfs-prompt="portrait">Portrait</button><button class="nxqt-chip" data-nxfs-prompt="product">Product</button><button class="nxqt-chip" data-nxfs-prompt="cinema">Cinema</button><button class="nxqt-chip" data-nxfs-prompt="logo">Logo</button>';
  row.querySelectorAll('[data-nxfs-prompt]').forEach(button=>button.addEventListener('click',()=>{
    const prefix=PROMPT_PREFIXES[button.dataset.nxfsPrompt];
    const current=prompt.value.trim();
    if(!current.startsWith(prefix))prompt.value=prefix+current;
    prompt.dispatchEvent(new Event('input',{bubbles:true}));
  }));
  label.appendChild(row);
  return true;
}

export function installAiPhotoGeneratorPromptAssistV1(root){
  if(!root||root.__nxGeneratorPromptAssistV1)return()=>{};
  root.__nxGeneratorPromptAssistV1=true;
  let frame=0;
  const sync=()=>{frame=0;decorate(root)};
  const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(sync)});
  observer.observe(root,{childList:true,subtree:true});
  sync();
  return()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame);root.querySelector('.nxfs-prompt-assist')?.remove();delete root.__nxGeneratorPromptAssistV1};
}
