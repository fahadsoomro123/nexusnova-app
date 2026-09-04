const STYLE_POS=['0%','14.2857%','28.5714%','42.8571%','57.1429%','71.4286%','85.7143%','100%'];
const FOUR_POS=['0%','33.3333%','66.6667%','100%'];

function ensureReferenceStyles(){
  if(document.getElementById('nx-ai-photo-locked-reference-assets-v1'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-locked-reference-assets-v1';
  style.textContent=`
    .nxps-locked-visual .nxlock-generator{position:relative!important}
    .nxps-locked-visual .nxlock-style-art{background-image:url('./assets/visuals/ai-photo-locked-styles.webp')!important;background-repeat:no-repeat!important;background-size:800% 100%!important;background-color:#111827!important;border-color:transparent!important;font-size:0!important;color:transparent!important}
    .nxps-locked-visual .nxlock-reference-feature{display:block;width:100%;height:auto;aspect-ratio:173/183;min-height:0;border:0;border-radius:13px;background-image:url('./assets/visuals/ai-photo-locked-featured.webp');background-repeat:no-repeat;background-size:400% 100%;background-color:#101521}
    .nxps-locked-visual .nxlock-feature.has-locked-reference>canvas{display:none!important}
    .nxps-locked-visual .nxlock-recent-thumb{height:auto!important;aspect-ratio:170/124;background-image:url('./assets/visuals/ai-photo-locked-recent.webp')!important;background-repeat:no-repeat!important;background-size:400% 100%!important;background-color:#101521!important}
    .nxps-locked-visual .nxlock-prompt textarea::placeholder{color:#aeb5c9!important;opacity:1!important}
    .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-gen-home,.nxps-locked-visual .nxlock-pro{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important}
    .nxps-locked-visual .nxlock-home-glyph{font-size:16px!important;line-height:1!important}
    .nxps-locked-visual .nxlock-pro-glyph{font-size:14px!important;line-height:1!important}

    @media (max-width:520px){
      .nxps-locked-visual .nxlock-top{grid-template-columns:70px minmax(0,1fr) 64px!important;gap:7px!important}
      .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{padding-left:6px!important;padding-right:6px!important}
      .nxps-locked-visual .nxlock-top-title strong{font-size:14px!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
      .nxps-locked-visual .nxlock-top-title span{font-size:9px!important}
    }

    @media (max-width:390px){
      .nxps-locked-visual .nxlock-top{grid-template-columns:66px minmax(0,1fr) 60px!important;gap:6px!important}
      .nxps-locked-visual .nxlock-top-title strong{font-size:13px!important}
      .nxps-locked-visual .nxlock-option select{padding-left:6px!important;padding-right:6px!important;font-size:9px!important}
    }

    @media (max-width:520px) and (min-height:761px){
      .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{height:42px!important}
      .nxps-locked-visual .nxlock-hero{position:relative!important;grid-template-columns:68px minmax(0,1fr)!important;min-height:138px!important;padding:12px 14px!important;gap:12px!important;overflow:hidden!important}
      .nxps-locked-visual .nxlock-hero-logo,.nxps-locked-visual .nxlock-hero-copy{position:relative!important;z-index:2!important}
      .nxps-locked-visual .nxlock-hero-logo{width:64px!important;height:64px!important}
      .nxps-locked-visual .nxlock-hero-logo img{width:56px!important;height:56px!important}
      .nxps-locked-visual .nxlock-hero-glow{position:absolute!important;z-index:1!important;right:-8px!important;top:0!important;bottom:0!important;width:47%!important;height:auto!important;pointer-events:none!important}
      .nxps-locked-visual .nxlock-kicker{font-size:8px!important}
      .nxps-locked-visual .nxlock-hero-copy h1{margin-top:4px!important;font-size:20px!important;line-height:1.02!important}
      .nxps-locked-visual .nxlock-hero-copy p{display:block!important;max-width:232px!important;margin-top:6px!important;font-size:9px!important;line-height:1.35!important}
      .nxps-locked-visual .nxlock-badges{flex-wrap:nowrap!important;gap:5px!important;margin-top:7px!important}
      .nxps-locked-visual .nxlock-badges span{padding:4px 6px!important;font-size:6.4px!important;white-space:nowrap!important}
    }
  `;
  document.head.appendChild(style);
}

function applyStyleSprites(root){
  root.querySelectorAll('.nxlock-style-art').forEach((node,index)=>{
    if(index>=STYLE_POS.length)return;
    node.style.backgroundPosition=`${STYLE_POS[index]} 50%`;
    node.dataset.lockedReference='style';
  });
}

function applyFeaturedSprites(root){
  root.querySelectorAll('.nxlock-feature').forEach((card,index)=>{
    if(index>=FOUR_POS.length)return;
    let thumb=card.querySelector('.nxlock-reference-feature');
    if(!thumb){
      thumb=document.createElement('div');
      thumb.className='nxlock-reference-feature';
      card.prepend(thumb);
    }
    thumb.style.backgroundPosition=`${FOUR_POS[index]} 50%`;
    thumb.dataset.lockedReference='featured';
    card.classList.add('has-locked-reference');
  });
}

function applyRecentSprites(root){
  root.querySelectorAll('.nxlock-recent-thumb').forEach((node,index)=>{
    if(index>=FOUR_POS.length)return;
    node.style.backgroundPosition=`${FOUR_POS[index]} 50%`;
    node.dataset.lockedReference='recent';
  });
}

function applyPromptContract(root){
  const prompt=root.querySelector('[data-puter-prompt]');
  if(!prompt)return;
  const placeholder='Example: A premium cinematic portrait in soft window light, realistic skin texture, clean background';
  if(prompt.getAttribute('placeholder')!==placeholder)prompt.setAttribute('placeholder',placeholder);
}

function applyHeaderContract(root){
  const home=root.querySelector('.nxlock-home-btn');
  if(home&&!home.querySelector('.nxlock-home-glyph'))home.innerHTML='<span class="nxlock-home-glyph">⌂</span><span>Home</span>';
  const genHome=root.querySelector('.nxlock-gen-home');
  if(genHome&&!genHome.querySelector('.nxlock-home-glyph'))genHome.innerHTML='<span class="nxlock-home-glyph">⌂</span><span>Home</span>';
  const pro=root.querySelector('.nxlock-pro');
  if(pro&&!pro.querySelector('.nxlock-pro-glyph'))pro.innerHTML='<span class="nxlock-pro-glyph">♛</span><span>PRO</span>';
}

function applyVisualCustomRatio(root){
  const ratioBox=root.querySelector('.nxlock-ratios');
  if(!ratioBox||ratioBox.querySelector('[data-r="custom"]'))return;
  const button=document.createElement('button');
  button.type='button';
  button.className='nxlock-ratio nxlock-reference-custom-ratio';
  button.dataset.r='custom';
  button.setAttribute('aria-label','Custom aspect ratio');
  button.title='Custom ratio is not supported by the current Puter provider.';
  button.innerHTML='<b>▱</b>0::9<small>Custom</small>';
  button.addEventListener('click',()=>{
    globalThis.alert?.('Custom ratio is not supported by the current Puter provider. Use Square, Portrait, Story or Landscape.');
  });
  ratioBox.appendChild(button);
  ratioBox.classList.add('has-custom');
}

export function installAiPhotoLockedReferenceAssetsV1(root){
  if(!root||root.__nxLockedReferenceAssetsV1)return()=>{};
  root.__nxLockedReferenceAssetsV1=true;
  ensureReferenceStyles();
  const apply=()=>{applyStyleSprites(root);applyFeaturedSprites(root);applyRecentSprites(root);applyPromptContract(root);applyHeaderContract(root);applyVisualCustomRatio(root)};
  apply();
  const observer=new MutationObserver(apply);
  observer.observe(root,{childList:true,subtree:true});
  return()=>{observer.disconnect();root.querySelectorAll('[data-locked-reference]').forEach(node=>node.removeAttribute('data-locked-reference'));root.querySelectorAll('.has-locked-reference').forEach(node=>node.classList.remove('has-locked-reference'));root.querySelectorAll('.nxlock-reference-custom-ratio').forEach(node=>node.remove());delete root.__nxLockedReferenceAssetsV1};
}
