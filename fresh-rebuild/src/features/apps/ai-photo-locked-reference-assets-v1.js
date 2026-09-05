import { listDesignProjects,deleteDesignProject } from './ai-photo-project-store.js';

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

    /* Phone acceptance fix: never inherit dark/disabled text from the host editor. */
    .nxps-locked-visual .nxlock-home,.nxps-locked-visual .nxlock-generator{opacity:1!important;filter:none!important;color:#f8f5ff!important;-webkit-text-fill-color:initial!important}
    .nxps-locked-visual .nxlock-home button,.nxps-locked-visual .nxlock-generator button,.nxps-locked-visual .nxlock-home select,.nxps-locked-visual .nxlock-generator select{opacity:1!important;filter:none!important}
    .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-gen-home,.nxps-locked-visual .nxlock-gen-back{position:relative!important;z-index:5!important;border-color:#8e55ff!important;background:linear-gradient(145deg,#4b2675,#25183d)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;box-shadow:0 0 18px rgba(137,71,255,.2)!important}
    .nxps-locked-visual .nxlock-pro{position:relative!important;z-index:5!important;border-color:#8f49ff!important;background:linear-gradient(145deg,#24163c,#171324)!important;color:#ffd35f!important;-webkit-text-fill-color:#ffd35f!important;box-shadow:0 0 18px rgba(137,71,255,.18)!important}
    .nxps-locked-visual .nxlock-top-title strong,.nxps-locked-visual .nxlock-heading strong,.nxps-locked-visual .nxlock-section-head strong,.nxps-locked-visual .nxlock-card strong,.nxps-locked-visual .nxlock-mini,.nxps-locked-visual .nxlock-feature span,.nxps-locked-visual .nxlock-tool,.nxps-locked-visual .nxlock-recent-copy strong,.nxps-locked-visual .nxlock-recent-item strong,.nxps-locked-visual .nxlock-open-projects,.nxps-locked-visual .nxlock-gen-title strong,.nxps-locked-visual .nxlock-prompt>span,.nxps-locked-visual .nxlock-ratio,.nxps-locked-visual .nxlock-ratio b,.nxps-locked-visual .nxlock-style>span,.nxps-locked-visual .nxlock-styles-head strong,.nxps-locked-visual .nxlock-option{color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important}
    .nxps-locked-visual .nxlock-card p,.nxps-locked-visual .nxlock-heading span,.nxps-locked-visual .nxlock-top-title span,.nxps-locked-visual .nxlock-recent-copy span,.nxps-locked-visual .nxlock-recent-item span,.nxps-locked-visual .nxlock-gen-title span,.nxps-locked-visual .nxlock-ratio small{color:#c7c9d8!important;-webkit-text-fill-color:#c7c9d8!important;opacity:1!important}
    .nxps-locked-visual .nxlock-section-head button,.nxps-locked-visual .nxlock-styles-head span{color:#bd68ff!important;-webkit-text-fill-color:#bd68ff!important;opacity:1!important}
    .nxps-locked-visual .nxlock-icon,.nxps-locked-visual .nxlock-mini b,.nxps-locked-visual .nxlock-tool b{opacity:1!important;-webkit-text-fill-color:currentColor!important}
    .nxps-locked-visual .nxlock-open-projects{border-color:#8647e6!important;background:linear-gradient(145deg,#48246e,#2a1745)!important}

    /* Real, tappable Recent Creation cards and option controls. */
    .nxps-locked-visual .nxlock-recent-item{position:relative!important;cursor:pointer!important;outline:none!important;border-radius:11px!important}
    .nxps-locked-visual .nxlock-recent-item:focus-visible{box-shadow:0 0 0 2px #a259ff!important}
    .nxps-locked-visual .nxfix-recent-menu{position:absolute!important;z-index:6!important;right:5px!important;top:5px!important;width:27px!important;height:27px!important;min-width:27px!important;padding:0!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:50%!important;background:rgba(8,10,18,.78)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:18px!important;line-height:1!important}
    .nxps-locked-visual .nxfix-recent-popover{position:absolute;z-index:120;display:grid;gap:5px;width:122px;padding:7px;border:1px solid rgba(172,112,255,.4);border-radius:12px;background:#151321;box-shadow:0 14px 34px rgba(0,0,0,.55)}
    .nxps-locked-visual .nxfix-recent-popover[hidden]{display:none!important}
    .nxps-locked-visual .nxfix-recent-popover button{height:34px!important;border:0!important;border-radius:8px!important;background:#231a33!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:10px!important;font-weight:800!important}
    .nxps-locked-visual .nxfix-recent-popover button[data-delete]{color:#ff8d9a!important;-webkit-text-fill-color:#ff8d9a!important}

    /* Template library: keep editable canvas preview, add a real visual thumbnail + readable description. */
    .nxps-locked-visual .nxv3-grid{gap:9px!important}
    .nxps-locked-visual .nxv3-card{border-color:rgba(126,99,190,.34)!important;background:#141722!important;box-shadow:inset 0 1px rgba(255,255,255,.04)!important}
    .nxps-locked-visual .nxv3-card>canvas{height:118px!important;aspect-ratio:auto!important;object-fit:contain!important;background:#0b0f18!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy{display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;grid-template-rows:auto auto auto!important;column-gap:8px!important;align-items:start!important;padding:8px!important}
    .nxps-locked-visual .nxfix-template-mini{grid-row:1/4;width:54px;height:54px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background-repeat:no-repeat;background-size:400% 100%;background-color:#101521;box-shadow:0 5px 16px rgba(0,0,0,.28)}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy strong{grid-column:2;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:10px!important;line-height:1.2!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy p{grid-column:2;color:#b8bdcb!important;-webkit-text-fill-color:#b8bdcb!important;font-size:8px!important;line-height:1.35!important;-webkit-line-clamp:2!important}
    .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy small{grid-column:2;color:#c9aaff!important;-webkit-text-fill-color:#c9aaff!important;font-size:7.5px!important}
    .nxps-locked-visual .nxv3-detail-copy h3{color:#fff!important;-webkit-text-fill-color:#fff!important}.nxps-locked-visual .nxv3-detail-copy p{color:#c0c4d2!important;-webkit-text-fill-color:#c0c4d2!important}

    @media (max-width:520px){
      .nxps-locked-visual .nxlock-top{grid-template-columns:70px minmax(0,1fr) 64px!important;gap:7px!important}
      .nxps-locked-visual .nxlock-home-btn,.nxps-locked-visual .nxlock-pro{padding-left:6px!important;padding-right:6px!important}
      .nxps-locked-visual .nxlock-top-title strong{font-size:14px!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
      .nxps-locked-visual .nxlock-top-title span{font-size:9px!important}
      .nxps-locked-visual .nxv3-card>canvas{height:108px!important}
      .nxps-locked-visual .nxv3-card-copy.nxfix-template-copy{grid-template-columns:48px minmax(0,1fr)!important;column-gap:7px!important;padding:7px!important}
      .nxps-locked-visual .nxfix-template-mini{width:48px;height:48px}
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
    if(!thumb){thumb=document.createElement('div');thumb.className='nxlock-reference-feature';card.prepend(thumb)}
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
  button.type='button';button.className='nxlock-ratio nxlock-reference-custom-ratio';button.dataset.r='custom';button.setAttribute('aria-label','Custom aspect ratio');button.title='Custom ratio is not supported by the current Puter provider.';button.innerHTML='<b>▱</b>0::9<small>Custom</small>';
  button.addEventListener('click',()=>{globalThis.alert?.('Custom ratio is not supported by the current Puter provider. Use Square, Portrait, Story or Landscape.')});
  ratioBox.appendChild(button);ratioBox.classList.add('has-custom');
}

function projectSelector(id){
  const escaped=globalThis.CSS?.escape?globalThis.CSS.escape(String(id)):String(id).replace(/["\\]/g,'\\$&');
  return `[data-project="${escaped}"]`;
}

function openSavedProject(root,id){
  if(!id)return;
  root.querySelector('.nxlock-open-projects')?.click();
  let tries=0;
  const open=()=>{
    const row=root.querySelector(projectSelector(id));
    const button=row?.querySelector('button:not([data-del])');
    if(button){button.click();return}
    if(++tries<30)requestAnimationFrame(open);
  };
  requestAnimationFrame(open);
}

function ensureRecentPopover(root){
  const home=root.querySelector('.nxlock-home');
  if(!home)return null;
  let pop=home.querySelector('.nxfix-recent-popover');
  if(pop)return pop;
  pop=document.createElement('div');pop.className='nxfix-recent-popover';pop.hidden=true;pop.innerHTML='<button type="button" data-open>Open project</button><button type="button" data-delete>Delete</button>';home.appendChild(pop);
  pop.querySelector('[data-open]').addEventListener('click',()=>{const id=pop.dataset.projectId;pop.hidden=true;openSavedProject(root,id)});
  pop.querySelector('[data-delete]').addEventListener('click',()=>{const id=pop.dataset.projectId;if(!id)return;try{deleteDesignProject(id)}catch{}pop.hidden=true;root.querySelector('.nxlock-home-btn')?.click()});
  return pop;
}

function showRecentMenu(root,item,id){
  const home=root.querySelector('.nxlock-home'),pop=ensureRecentPopover(root);if(!home||!pop||!id)return;
  pop.dataset.projectId=id;pop.hidden=false;
  const hr=home.getBoundingClientRect(),ir=item.getBoundingClientRect(),w=122;
  pop.style.left=`${Math.max(8,Math.min(hr.width-w-8,ir.right-hr.left-w))}px`;
  pop.style.top=`${Math.max(8,Math.min(hr.height-82,ir.top-hr.top+28))}px`;
}

function applyRecentInteractions(root){
  const rows=(()=>{try{return listDesignProjects().slice(0,4)}catch{return[]}})();
  root.querySelectorAll('.nxlock-recent-item').forEach((item,index)=>{
    const row=rows[index];if(!row?.id)return;
    item.dataset.nxProjectId=row.id;item.tabIndex=0;item.setAttribute('role','button');
    if(item.dataset.nxRecentBound!=='1'){
      item.dataset.nxRecentBound='1';
      item.addEventListener('click',e=>{if(e.target.closest('.nxfix-recent-menu'))return;openSavedProject(root,item.dataset.nxProjectId)});
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSavedProject(root,item.dataset.nxProjectId)}});
    }
    let menu=item.querySelector('.nxfix-recent-menu');
    if(!menu){menu=document.createElement('button');menu.type='button';menu.className='nxfix-recent-menu';menu.setAttribute('aria-label',`Options for ${row.name||'saved project'}`);menu.textContent='⋮';menu.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showRecentMenu(root,item,item.dataset.nxProjectId)});item.appendChild(menu)}
  });
}

function templateThumbIndex(title){
  const t=String(title||'').toLowerCase();
  if(/coffee|cafe|restaurant|menu|food/.test(t))return 2;
  if(/travel|landscape|real estate|property|hotel/.test(t))return 3;
  if(/tech|gaming|product|car|youtube|startup/.test(t))return 1;
  if(/beauty|portrait|fashion|resume|wedding|invitation|photo/.test(t))return 0;
  let h=0;for(const ch of t)h=(h*31+ch.charCodeAt(0))>>>0;return h%4;
}

function applyTemplatePreviews(root){
  root.querySelectorAll('.nxv3-card').forEach((card,index)=>{
    const copy=card.querySelector('.nxv3-card-copy');if(!copy)return;
    copy.classList.add('nxfix-template-copy');
    if(copy.querySelector('.nxfix-template-mini'))return;
    const title=copy.querySelector('strong')?.textContent||'',pos=templateThumbIndex(title),mini=document.createElement('div');
    mini.className='nxfix-template-mini';mini.setAttribute('role','img');mini.setAttribute('aria-label',`${title||'Template'} visual preview`);
    const useRecent=(index+pos)%2===1;mini.style.backgroundImage=`url('./assets/visuals/${useRecent?'ai-photo-locked-recent.webp':'ai-photo-locked-featured.webp'}')`;mini.style.backgroundPosition=`${FOUR_POS[pos]} 50%`;
    copy.prepend(mini);
  });
}

export function installAiPhotoLockedReferenceAssetsV1(root){
  if(!root||root.__nxLockedReferenceAssetsV1)return()=>{};
  root.__nxLockedReferenceAssetsV1=true;ensureReferenceStyles();
  const apply=()=>{applyStyleSprites(root);applyFeaturedSprites(root);applyRecentSprites(root);applyPromptContract(root);applyHeaderContract(root);applyVisualCustomRatio(root);applyRecentInteractions(root);applyTemplatePreviews(root)};
  apply();
  const observer=new MutationObserver(apply);observer.observe(root,{childList:true,subtree:true});
  const dismiss=e=>{const pop=root.querySelector('.nxfix-recent-popover');if(pop&&!pop.hidden&&!e.target.closest('.nxfix-recent-popover')&&!e.target.closest('.nxfix-recent-menu'))pop.hidden=true};
  root.addEventListener('click',dismiss,true);
  return()=>{observer.disconnect();root.removeEventListener('click',dismiss,true);root.querySelectorAll('[data-locked-reference]').forEach(node=>node.removeAttribute('data-locked-reference'));root.querySelectorAll('.has-locked-reference').forEach(node=>node.classList.remove('has-locked-reference'));root.querySelectorAll('.nxlock-reference-custom-ratio,.nxfix-recent-menu,.nxfix-recent-popover,.nxfix-template-mini').forEach(node=>node.remove());root.querySelectorAll('.nxfix-template-copy').forEach(node=>node.classList.remove('nxfix-template-copy'));delete root.__nxLockedReferenceAssetsV1};
}
