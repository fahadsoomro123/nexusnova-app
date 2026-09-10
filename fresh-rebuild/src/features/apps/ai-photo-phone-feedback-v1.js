import { NEXUSNOVA_TEMPLATES } from './data/ai-photo-templates.js';
import { createDesignFromTemplate,renderDesignToCanvas } from './ai-photo-design-canvas.js';
import { downloadBlob } from './premium-studio-core.js';

const FEATURED_CATEGORIES=['logos','instagram-posts','youtube-thumbnails','flyers','business-cards','posters','product-promos','resumes'];
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const slug=v=>(String(v||'nexusnova-ai-image').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'nexusnova-ai-image').slice(0,60);

function ensureStyles(){
  if(document.getElementById('nx-ai-photo-phone-feedback-v1'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-phone-feedback-v1';
  style.textContent=`
  /* Phone-feedback correction only. Keep the locked fullscreen route semantics. */
  body.nx-ai-photo-route-active .nx-stage>.nx-screen.nx-ai-photo-route-screen>[data-app-mount]{position:absolute!important;inset:0!important;width:100%!important;height:auto!important;max-height:none!important;padding:0!important;margin:0!important;overflow:hidden!important}
  body.nx-ai-photo-route-active .nx-stage>.nx-screen.nx-ai-photo-route-screen>[data-app-mount]>.nx-photo-editor{position:absolute!important;inset:0!important;width:100%!important;height:auto!important;max-height:none!important;margin:0!important}
  body.nx-ai-photo-route-active .nx-stage>.nx-screen.nx-ai-photo-route-screen:has(.nx-studio){padding-bottom:0!important}

  .nxps-home.nxps-phone-feedback{grid-template-rows:auto auto auto minmax(0,1fr) auto!important;gap:8px!important;padding-bottom:0!important}
  .nxps-phone-feedback .nxps-heading{margin-top:0}
  .nxps-phone-feedback .nxps-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:94px 78px!important;gap:7px!important;min-height:0!important}
  .nxps-phone-feedback .nxps-action{padding:9px!important;border-radius:15px!important;min-height:0!important}
  .nxps-phone-feedback .nxps-action.is-ai{grid-column:1/-1!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;align-items:center!important;gap:4px 10px!important;border-color:rgba(180,135,255,.58)!important;background:radial-gradient(circle at 88% 18%,rgba(111,67,255,.34),transparent 28%),linear-gradient(135deg,#382257,#241935 52%,#151826)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 26px rgba(126,70,235,.18)!important}
  .nxps-phone-feedback .nxps-action.is-ai .nxps-action-top{grid-row:1/3;display:grid!important;align-content:center!important;justify-items:center!important;gap:5px!important}
  .nxps-phone-feedback .nxps-action.is-ai .nxps-action-icon{width:42px!important;height:42px!important;border-color:rgba(210,184,255,.30)!important;background:linear-gradient(145deg,rgba(171,114,255,.30),rgba(92,42,176,.24))!important;color:#fff!important;font-size:21px!important;box-shadow:0 0 22px rgba(161,99,255,.24)!important}
  .nxps-phone-feedback .nxps-action.is-ai .nxps-action-tag{max-width:86px;color:#e6d6ff!important;font-size:6.5px!important;text-align:center!important;line-height:1.15!important;white-space:normal!important}
  .nxps-phone-feedback .nxps-action.is-ai strong{grid-column:2/4!important;align-self:end!important;margin:0!important;color:#fff!important;font-size:15px!important;line-height:1.05!important}
  .nxps-phone-feedback .nxps-action.is-ai p{grid-column:2/4!important;align-self:start!important;margin:0!important;color:#c8bdd9!important;font-size:8.7px!important;line-height:1.35!important;-webkit-line-clamp:2!important}
  .nxps-phone-feedback .nxps-action:not(.is-ai) strong{margin-top:6px!important;color:#fff!important;font-size:10.5px!important}
  .nxps-phone-feedback .nxps-action:not(.is-ai) p{margin-top:3px!important;color:#aeb5c7!important;font-size:7.4px!important;line-height:1.28!important;-webkit-line-clamp:2!important}
  .nxps-phone-feedback .nxps-action-tag{color:#b8bed0!important}

  .nxps-featured{display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;min-height:0;padding:8px 0 0;border-top:1px solid rgba(255,255,255,.07)}
  .nxps-featured-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.nxps-featured-head strong{color:#fff;font-size:11px}.nxps-featured-head span{color:#8f96aa;font-size:7.5px}
  .nxps-featured-strip{display:grid;grid-auto-flow:column;grid-auto-columns:98px;gap:7px;min-height:0;overflow-x:auto;overflow-y:hidden;padding:0 1px 4px;scrollbar-width:none;overscroll-behavior-inline:contain}.nxps-featured-strip::-webkit-scrollbar{display:none}
  .nxps-featured-card{display:grid!important;grid-template-rows:minmax(0,1fr) auto!important;overflow:hidden!important;min-width:0!important;padding:0!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important;background:#151822!important;text-align:left!important;color:#fff!important}
  .nxps-featured-card canvas{display:block;width:100%;height:100%;min-height:0;object-fit:cover;background:#0d1017}.nxps-featured-card span{display:block;overflow:hidden;padding:5px 6px;color:#dfe3ed;font-size:7px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
  .nxps-phone-feedback .nxps-recent{min-height:46px!important;padding:7px 8px!important}

  .nx-photo-panel[data-photo-sheet-panel="ai"].nxps-ai-quick-only{padding-top:10px!important}
  .nx-photo-panel[data-photo-sheet-panel="ai"].nxps-ai-quick-only .nx-photo-ai-actions{margin-bottom:7px}

  /* AI generator: clean, full-height creative workspace with no large account card. */
  .nx-canva-v3 .nxv3-pane[data-v3-pane="ai-image"].is-active{display:block!important;height:100%!important;min-height:0!important;overflow:hidden!important;padding:8px!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap{display:grid!important;height:100%!important;min-height:0!important;max-width:780px!important;margin:0 auto!important;grid-template-rows:auto minmax(148px,1fr) auto auto auto!important;gap:8px!important;align-content:stretch!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-hero{padding:10px 12px!important}.nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-hero p{display:none!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-label:has([data-puter-prompt]){display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;min-height:0!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] [data-puter-prompt]{height:100%!important;min-height:148px!important;max-height:none!important;resize:none!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-note{display:none!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-error{margin:0!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-result{min-height:0!important;overflow:auto!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap.nxps-has-result{grid-template-rows:auto minmax(94px,22vh) auto auto minmax(0,1fr)!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap.nxps-has-result [data-puter-prompt]{min-height:88px!important}
  .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap.nxps-has-result .nxputer-result{display:block!important;height:100%!important}.nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap.nxps-has-result .nxputer-result img{max-height:100%!important}
  .nx-photo-editor.nxps-premium-studio .nxputer-actions.nxps-has-download{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  .nx-photo-editor.nxps-premium-studio [data-puter-download]{font-weight:800!important;color:#f0e8ff!important;border-color:rgba(173,137,255,.34)!important;background:rgba(125,42,232,.16)!important}

  /* Puter account is available from a compact header chip, not the generator body. */
  .nxps-account-chip{min-height:34px!important;padding:0 8px!important;margin-right:5px!important;border:1px solid rgba(171,132,255,.25)!important;border-radius:9px!important;background:#211a30!important;color:#e6d9ff!important;font-size:8px!important;font-weight:850!important;white-space:nowrap!important}
  .nxps-account-chip.is-connected{border-color:rgba(95,211,155,.28)!important;background:#16271f!important;color:#c9f6df!important}
  .nxps-account-popover{position:absolute;z-index:90;top:46px;right:7px;width:min(330px,calc(100% - 14px));padding:7px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:#12151d;box-shadow:0 18px 50px rgba(0,0,0,.48)}.nxps-account-popover[hidden]{display:none!important}
  .nxps-account-popover .nxputer-status{display:grid!important;margin:0!important;border:0!important;background:transparent!important;padding:6px!important}.nxps-account-popover .nxputer-status b{font-size:10px!important}.nxps-account-popover .nxputer-status span{font-size:8px!important}.nxps-account-popover .nxputer-status .nxv3-btn{min-height:32px!important}

  /* Make the already-wired return route obvious on every Photo Studio subview. */
  .nx-photo-editor.nxps-premium-studio .nxps-home-return{width:52px!important;min-width:52px!important;padding:0 5px!important;border:1px solid rgba(125,42,232,.24)!important;border-radius:9px!important;background:rgba(125,42,232,.08)!important;color:#6f2cdd!important;font-size:8px!important;font-weight:850!important;white-space:nowrap!important}
  .nx-photo-editor.nxps-premium-studio .nxps-workspace-home{min-width:62px!important;padding:0 8px!important;color:#e2d5ff!important;border-color:rgba(174,137,255,.28)!important;background:#2a2140!important;font-size:8px!important;font-weight:850!important}

  @media(max-width:390px){
    .nxps-home.nxps-phone-feedback{gap:7px!important}
    .nxps-phone-feedback .nxps-actions{grid-template-rows:90px 75px!important;gap:6px!important}
    .nxps-featured-strip{grid-auto-columns:91px;gap:6px}
    .nx-photo-editor.nxps-premium-studio .nxputer-actions.nxps-has-download{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .nx-photo-editor.nxps-premium-studio .nxputer-actions.nxps-has-download .nxv3-btn{width:auto!important;min-width:0!important;padding:0 5px!important;font-size:8px!important}
    .nx-photo-editor.nxps-premium-studio .nxps-home-return{width:48px!important;min-width:48px!important;font-size:7.3px!important}
    .nx-photo-editor.nxps-premium-studio .nxps-workspace-home{min-width:56px!important;padding-inline:6px!important;font-size:7.3px!important}
    .nxps-account-chip{padding-inline:6px!important;font-size:7px!important}
    .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap{gap:6px!important;grid-template-rows:auto minmax(132px,1fr) auto auto auto!important}
  }
  @media(max-height:700px){
    .nxps-phone-feedback .nxps-hero-copy p,.nxps-phone-feedback .nxps-badges{display:none!important}
    .nxps-phone-feedback .nxps-actions{grid-template-rows:82px 69px!important}
    .nxps-featured{padding-top:5px}.nxps-featured-strip{grid-auto-columns:84px}.nxps-phone-feedback .nxps-recent{min-height:40px!important}
    .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] .nxputer-wrap{grid-template-rows:auto minmax(108px,1fr) auto auto auto!important}
    .nx-photo-editor.nxps-premium-studio .nxv3-pane[data-v3-pane="ai-image"] [data-puter-prompt]{min-height:108px!important}
  }
  `;
  document.head.appendChild(style);
}

function featuredTemplates(){
  const picked=[];
  for(const category of FEATURED_CATEGORIES){
    const found=NEXUSNOVA_TEMPLATES.find(template=>template.category===category);
    if(found)picked.push(found);
  }
  return picked.slice(0,8);
}

function renderFeaturedCard(template,button){
  const canvas=button.querySelector('canvas');
  try{renderDesignToCanvas(createDesignFromTemplate(template),canvas,{pixelRatio:.12})}catch{}
}

function focusTemplate(root,template){
  const open=root.querySelector('.nxps-home [data-nxps-action="templates"]');
  open?.click();
  let tries=0;
  const apply=()=>{
    const search=root.querySelector('[data-v3-search]'),category=root.querySelector('[data-v3-category]');
    if(search&&category){
      category.value=template.category;
      category.dispatchEvent(new Event('change',{bubbles:true}));
      search.value=template.useCase||template.name;
      search.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    if(++tries<12)requestAnimationFrame(apply);
  };
  requestAnimationFrame(apply);
}

function polishHome(root){
  const home=root.querySelector('.nxps-home');
  if(!home||home.dataset.phoneFeedbackV1)return null;
  home.dataset.phoneFeedbackV1='1';home.classList.add('nxps-phone-feedback');
  const ai=home.querySelector('[data-nxps-action="ai-image"]');
  if(ai){
    const tag=ai.querySelector('.nxps-action-tag'),title=ai.querySelector('strong'),copy=ai.querySelector('p');
    if(tag)tag.textContent='AI IMAGE GENERATOR';
    if(title)title.textContent='Create an image with AI';
    if(copy)copy.textContent='Type a prompt and generate a brand-new image with Puter AI.';
  }
  const recent=home.querySelector('.nxps-recent');
  const featured=document.createElement('section');featured.className='nxps-featured';featured.setAttribute('aria-label','Featured templates');
  featured.innerHTML='<div class="nxps-featured-head"><strong>Featured templates</strong><span>Ready to customize</span></div><div class="nxps-featured-strip"></div>';
  const strip=featured.querySelector('.nxps-featured-strip');
  for(const template of featuredTemplates()){
    const button=document.createElement('button');button.type='button';button.className='nxps-featured-card';button.title=template.name;button.innerHTML=`<canvas aria-hidden="true"></canvas><span>${esc(template.name)}</span>`;button.addEventListener('click',()=>focusTemplate(root,template));strip.appendChild(button);requestAnimationFrame(()=>renderFeaturedCard(template,button));
  }
  recent?.parentNode?.insertBefore(featured,recent);
  return featured;
}

function removeConfusingAiPrompt(root){
  const panel=root.querySelector('[data-photo-sheet-panel="ai"]');
  if(!panel||panel.dataset.quickOnly)return;
  panel.dataset.quickOnly='1';panel.classList.add('nxps-ai-quick-only');
  const prompt=panel.querySelector('[data-photo-prompt]');
  const analyze=panel.querySelector('[data-photo-analyze]');
  const copy=panel.querySelector('[data-photo-copy]');
  const actionRow=analyze?.closest('.nx-photo-row')||copy?.closest('.nx-photo-row');
  const note=prompt?.previousElementSibling;
  if(note?.classList.contains('nx-photo-status'))note.remove();
  prompt?.remove();
  actionRow?.remove();
}

async function saveGeneratedImage(root,button){
  const image=root.querySelector('[data-puter-image]');
  const title=root.querySelector('[data-puter-result-title]')?.textContent||'nexusnova-ai-image';
  const src=String(image?.src||'');
  if(!/^data:image\//i.test(src)){button.textContent='Generate first';setTimeout(()=>button.textContent='Download',1200);return}
  const original=button.textContent;button.disabled=true;button.textContent='Saving…';
  try{
    const response=await fetch(src),blob=await response.blob();
    const ext=blob.type.includes('jpeg')?'jpg':blob.type.includes('webp')?'webp':'png';
    downloadBlob(blob,`${slug(title)}.${ext}`);
    button.textContent='Saved';
  }catch{button.textContent='Save failed'}
  setTimeout(()=>{button.disabled=false;button.textContent=original},1300);
}

function addGeneratorDownload(root){
  const actions=root.querySelector('.nxputer-actions');
  if(!actions||actions.querySelector('[data-puter-download]'))return null;
  actions.classList.add('nxps-has-download');
  const button=document.createElement('button');button.type='button';button.className='nxv3-btn';button.dataset.puterDownload='1';button.textContent='Download';
  button.addEventListener('click',()=>saveGeneratedImage(root,button));
  actions.appendChild(button);return button;
}

function compactPuterAccount(root){
  const workspace=root.querySelector('.nx-canva-v3'),status=root.querySelector('.nxputer-status'),headRight=workspace?.querySelector('.nxv3-head>div:last-child');
  if(!workspace||!status||!headRight)return()=>{};
  const originalParent=status.parentNode,originalNext=status.nextSibling;
  const chip=document.createElement('button');chip.type='button';chip.className='nxv3-btn nxps-account-chip';chip.textContent='AI Account';chip.setAttribute('aria-label','Puter AI account');
  const popover=document.createElement('div');popover.className='nxps-account-popover';popover.hidden=true;popover.setAttribute('aria-label','Puter account status');
  popover.appendChild(status);headRight.insertBefore(chip,headRight.firstChild);workspace.appendChild(popover);
  const statusTitle=status.querySelector('[data-puter-status-title]');
  const sync=()=>{const connected=/^Connected/i.test(String(statusTitle?.textContent||''));chip.classList.toggle('is-connected',connected);chip.textContent=connected?'AI ✓':'AI Account'};
  const observer=new MutationObserver(sync);if(statusTitle)observer.observe(statusTitle,{childList:true,subtree:true,characterData:true});sync();
  const toggle=e=>{e.stopPropagation();popover.hidden=!popover.hidden};chip.addEventListener('click',toggle);
  const outside=e=>{if(popover.hidden)return;if(popover.contains(e.target)||chip.contains(e.target))return;popover.hidden=true};workspace.addEventListener('pointerdown',outside);
  return()=>{observer.disconnect();chip.removeEventListener('click',toggle);workspace.removeEventListener('pointerdown',outside);chip.remove();popover.remove();if(originalParent){if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(status,originalNext);else originalParent.appendChild(status)}};
}

function fitGeneratorResult(root){
  const wrap=root.querySelector('.nxputer-wrap'),result=root.querySelector('[data-puter-result]');
  if(!wrap||!result)return()=>{};
  const sync=()=>wrap.classList.toggle('nxps-has-result',result.classList.contains('is-on'));
  const observer=new MutationObserver(sync);observer.observe(result,{attributes:true,attributeFilter:['class']});sync();
  return()=>{observer.disconnect();wrap.classList.remove('nxps-has-result')};
}

function makeStudioHomeExplicit(root){
  const editorHome=root.querySelector('.nxps-home-return');
  if(editorHome){editorHome.textContent='⌂ Home';editorHome.setAttribute('aria-label','Studio Home');editorHome.title='Studio Home'}
  const workspaceHome=root.querySelector('.nxps-workspace-home');
  if(workspaceHome){workspaceHome.textContent='⌂ Studio';workspaceHome.setAttribute('aria-label','Studio Home');workspaceHome.title='Studio Home'}
}

export function installAiPhotoPhoneFeedbackV1(root){
  if(!root||root.__nxAiPhotoPhoneFeedbackV1)return()=>{};
  root.__nxAiPhotoPhoneFeedbackV1=true;ensureStyles();
  const featured=polishHome(root);removeConfusingAiPrompt(root);const download=addGeneratorDownload(root);const accountCleanup=compactPuterAccount(root),fitCleanup=fitGeneratorResult(root);makeStudioHomeExplicit(root);
  return()=>{fitCleanup?.();accountCleanup?.();featured?.remove();download?.remove();root.querySelector('.nxps-home')?.classList.remove('nxps-phone-feedback');delete root.__nxAiPhotoPhoneFeedbackV1};
}
