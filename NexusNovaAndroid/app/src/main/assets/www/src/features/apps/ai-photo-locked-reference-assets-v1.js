const STYLE_POS=['0%','14.2857%','28.5714%','42.8571%','57.1429%','71.4286%','85.7143%','100%'];
const FOUR_POS=['0%','33.3333%','66.6667%','100%'];

function ensureReferenceStyles(){
  if(document.getElementById('nx-ai-photo-locked-reference-assets-v1'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-locked-reference-assets-v1';
  style.textContent=`
    .nxps-locked-visual .nxlock-generator{position:relative!important}
    .nxps-locked-visual .nxlock-style-art{background-image:url('./assets/visuals/ai-photo-locked-styles.webp')!important;background-repeat:no-repeat!important;background-size:800% 100%!important;background-color:#111827!important;font-size:0!important;color:transparent!important}
    .nxps-locked-visual .nxlock-reference-feature{display:block;width:100%;height:100%;min-height:0;border:1px solid rgba(255,255,255,.14);border-radius:13px;background-image:url('./assets/visuals/ai-photo-locked-featured.webp');background-repeat:no-repeat;background-size:400% 100%;background-color:#101521}
    .nxps-locked-visual .nxlock-feature canvas{display:none!important}
    .nxps-locked-visual .nxlock-recent-thumb{background-image:url('./assets/visuals/ai-photo-locked-recent.webp')!important;background-repeat:no-repeat!important;background-size:400% 100%!important;background-color:#101521!important}
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
  });
}

function applyRecentSprites(root){
  root.querySelectorAll('.nxlock-recent-thumb').forEach((node,index)=>{
    if(index>=FOUR_POS.length)return;
    node.style.backgroundPosition=`${FOUR_POS[index]} 50%`;
    node.dataset.lockedReference='recent';
  });
}

export function installAiPhotoLockedReferenceAssetsV1(root){
  if(!root||root.__nxLockedReferenceAssetsV1)return()=>{};
  root.__nxLockedReferenceAssetsV1=true;
  ensureReferenceStyles();
  const apply=()=>{applyStyleSprites(root);applyFeaturedSprites(root);applyRecentSprites(root)};
  apply();
  const observer=new MutationObserver(apply);
  observer.observe(root,{childList:true,subtree:true});
  return()=>{observer.disconnect();root.querySelectorAll('[data-locked-reference]').forEach(node=>node.removeAttribute('data-locked-reference'));delete root.__nxLockedReferenceAssetsV1};
}

