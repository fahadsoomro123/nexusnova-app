import { listDesignProjects } from './ai-photo-project-store.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function ensureStyles(){
  if(document.getElementById('nx-ai-photo-premium-home-v1'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-premium-home-v1';
  style.textContent=`
  .nx-photo-editor.nxps-premium-studio{isolation:isolate}
  .nxps-home{position:absolute;inset:0;z-index:24;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;min-height:0;padding:max(10px,env(safe-area-inset-top,0px)) max(58px,calc(env(safe-area-inset-right,0px) + 54px)) max(10px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));overflow:hidden;background:radial-gradient(circle at 18% 10%,rgba(125,42,232,.30),transparent 30%),radial-gradient(circle at 88% 24%,rgba(54,127,255,.19),transparent 30%),linear-gradient(155deg,#080910 0%,#0d1019 48%,#080a10 100%);color:#f7f8ff}
  .nxps-home[hidden]{display:none!important}.nxps-home *{box-sizing:border-box}.nxps-home button{font:inherit}
  .nxps-kicker{display:flex;align-items:center;gap:7px;color:#c9b7ff;font-size:9px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}.nxps-kicker i{width:7px;height:7px;border-radius:999px;background:#a879ff;box-shadow:0 0 18px rgba(168,121,255,.9)}
  .nxps-hero{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:10px;min-width:0;padding:10px 11px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:linear-gradient(135deg,rgba(31,28,49,.86),rgba(17,20,31,.74));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 18px 45px rgba(0,0,0,.25);backdrop-filter:blur(18px)}
  .nxps-logo{display:grid;width:52px;height:52px;place-items:center;overflow:hidden;border:1px solid rgba(190,163,255,.26);border-radius:16px;background:radial-gradient(circle at 30% 20%,rgba(183,145,255,.32),transparent 44%),#111521;box-shadow:0 10px 28px rgba(90,43,190,.24),inset 0 1px rgba(255,255,255,.08)}.nxps-logo img{display:block;width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(0,0,0,.34)) saturate(1.08)}
  .nxps-hero-copy{min-width:0}.nxps-hero-copy h1{margin:4px 0 0;overflow:hidden;color:#fff;font-size:clamp(18px,5vw,26px);line-height:1.02;letter-spacing:-.035em;text-overflow:ellipsis;white-space:nowrap}.nxps-hero-copy p{margin:5px 0 0;color:#aeb4c8;font-size:9.5px;line-height:1.42}.nxps-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.nxps-badge{padding:4px 6px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.045);color:#cbd0de;font-size:7.5px;font-weight:750}
  .nxps-heading{display:flex;align-items:end;justify-content:space-between;gap:10px}.nxps-heading strong{font-size:12px;letter-spacing:-.01em}.nxps-heading span{color:#8f96ab;font-size:8px}
  .nxps-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;min-height:0}.nxps-action{position:relative;min-width:0;min-height:0;overflow:hidden;padding:11px!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:17px!important;background:linear-gradient(145deg,rgba(27,30,43,.96),rgba(17,19,29,.96))!important;color:#f7f8ff!important;text-align:left!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.20)!important}.nxps-action::after{content:'';position:absolute;width:86px;height:86px;right:-30px;bottom:-42px;border-radius:50%;background:radial-gradient(circle,rgba(138,75,255,.24),transparent 68%);pointer-events:none}.nxps-action:active{transform:scale(.985)!important}.nxps-action.is-ai{border-color:rgba(167,121,255,.28)!important;background:linear-gradient(145deg,rgba(58,37,91,.96),rgba(22,22,37,.98))!important}.nxps-action.is-template::after{background:radial-gradient(circle,rgba(57,135,255,.22),transparent 68%)}.nxps-action.is-edit::after{background:radial-gradient(circle,rgba(69,201,181,.18),transparent 68%)}
  .nxps-action-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.nxps-action-icon{display:grid;width:34px;height:34px;place-items:center;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.055);color:#d8c7ff;font-size:17px;line-height:1}.nxps-action-tag{color:#9fa6bb;font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.nxps-action strong{display:block;margin-top:9px;font-size:12px;line-height:1.1}.nxps-action p{display:-webkit-box;overflow:hidden;margin:4px 0 0;color:#9da4b8;font-size:8px;line-height:1.35;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .nxps-recent{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;min-height:50px;padding:8px 9px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(19,22,32,.82)}.nxps-recent-copy{min-width:0}.nxps-recent-copy strong{display:block;overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.nxps-recent-copy span{display:block;margin-top:3px;color:#8f96a9;font-size:8px}.nxps-recent button{min-height:32px!important;padding:0 10px!important;border:1px solid rgba(177,145,255,.20)!important;border-radius:9px!important;background:rgba(125,42,232,.14)!important;color:#decfff!important;font-size:9px!important;font-weight:800!important}.nxps-recent-projects{display:flex;gap:5px;margin-top:5px;overflow:hidden}.nxps-project-chip{max-width:145px;padding:4px 6px;border-radius:7px;background:rgba(255,255,255,.045);color:#bac0d0;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nxps-home-return{color:#7d2ae8!important}.nxps-workspace-nav{display:flex;align-items:center;gap:4px}.nxps-workspace-home{min-width:38px!important;padding:0 7px!important;color:#dac8ff!important}
  .nx-photo-editor.nxps-premium-studio .nxputer-wrap{max-width:780px;gap:11px;padding:4px}.nx-photo-editor.nxps-premium-studio .nxputer-hero{padding:14px;border-color:rgba(164,118,255,.28);border-radius:16px;background:radial-gradient(circle at 90% 0,rgba(139,61,255,.23),transparent 38%),linear-gradient(145deg,#1c1b2b,#131722);box-shadow:inset 0 1px rgba(255,255,255,.05),0 14px 34px rgba(0,0,0,.22)}.nx-photo-editor.nxps-premium-studio .nxputer-hero strong{font-size:16px;letter-spacing:-.02em}.nx-photo-editor.nxps-premium-studio .nxputer-hero p{font-size:9px;color:#aeb4c7}.nx-photo-editor.nxps-premium-studio .nxputer-status{border-radius:13px;background:linear-gradient(135deg,#151924,#11131b)}.nx-photo-editor.nxps-premium-studio .nxputer-label textarea{min-height:104px!important;border-color:rgba(175,144,255,.20)!important;border-radius:14px!important;background:linear-gradient(145deg,#202331,#171a24)!important;font-size:13px!important;line-height:1.45}.nx-photo-editor.nxps-premium-studio .nxputer-generate{height:48px!important;border-radius:13px!important;background:linear-gradient(135deg,#9a54ff,#6f2cdd)!important;box-shadow:0 11px 28px rgba(116,46,221,.28)!important;font-size:13px!important;font-weight:850!important}.nx-photo-editor.nxps-premium-studio .nxputer-result{border-color:rgba(175,144,255,.20);border-radius:17px;background:#10131b;box-shadow:0 18px 45px rgba(0,0,0,.28)}.nx-photo-editor.nxps-premium-studio .nxputer-result img{max-height:46vh;background:radial-gradient(circle,#1c2130,#0c0e13)}
  .nxps-ai-choice-wrap{display:grid;gap:6px}.nxps-ai-choice-title{color:#aeb4c5;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.nxps-ai-choices{display:flex;gap:5px;overflow:hidden}.nxps-ai-choice{flex:1 1 0;min-width:0;min-height:34px!important;padding:0 5px!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:9px!important;background:#1a1d27!important;color:#b9bfd0!important;font-size:8px!important;font-weight:800!important}.nxps-ai-choice.is-active{border-color:rgba(164,118,255,.52)!important;background:#2a2140!important;color:#e0d2ff!important}.nxps-ai-prompts{display:flex;gap:5px;overflow:hidden}.nxps-ai-prompt{flex:1;min-width:0;height:28px!important;padding:0 5px!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:8px!important;background:rgba(255,255,255,.035)!important;color:#aeb4c5!important;font-size:7.5px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxps-native-choice{display:none!important}
  @media(max-width:390px){.nxps-home{gap:8px;padding-left:8px}.nxps-hero{grid-template-columns:46px minmax(0,1fr);padding:8px 9px}.nxps-logo{width:46px;height:46px;border-radius:14px}.nxps-logo img{width:41px;height:41px}.nxps-action{padding:9px!important;border-radius:15px!important}.nxps-action strong{margin-top:7px;font-size:11px}.nxps-ai-choice{font-size:7.2px!important}}
  @media(max-height:650px){.nxps-home{gap:7px}.nxps-hero-copy p,.nxps-badges,.nxps-action p{display:none}.nxps-hero{padding-block:7px}.nxps-actions{gap:6px}.nxps-action{padding:8px!important}.nxps-action-icon{width:30px;height:30px;font-size:15px}.nxps-action strong{margin-top:6px}.nxps-recent{min-height:43px;padding-block:6px}.nxps-recent-projects{display:none}}
  `;
  document.head.appendChild(style);
}

function findDesignButton(root){
  return [...root.querySelectorAll('.nx-photo-tool')].find(button=>button.querySelector('span')?.textContent?.trim()==='Design')||null;
}

function addChoiceButtons(root,select,labels){
  if(!select||select.dataset.nxpsEnhanced)return;
  select.dataset.nxpsEnhanced='1';
  select.classList.add('nxps-native-choice');
  const wrap=document.createElement('div');wrap.className='nxps-ai-choice-wrap';
  const title=document.createElement('div');title.className='nxps-ai-choice-title';title.textContent=labels.title;
  const row=document.createElement('div');row.className='nxps-ai-choices';
  [...select.options].forEach(option=>{
    if(labels.allowed&& !labels.allowed.includes(option.value))return;
    const button=document.createElement('button');button.type='button';button.className='nxps-ai-choice';button.dataset.value=option.value;button.textContent=labels.names?.[option.value]||option.textContent;
    button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));row.querySelectorAll('.nxps-ai-choice').forEach(item=>item.classList.toggle('is-active',item===button))};
    if(option.value===select.value)button.classList.add('is-active');row.appendChild(button);
  });
  wrap.append(title,row);select.closest('.nxputer-label')?.after(wrap);
}

function enhanceGenerator(root){
  const pane=root.querySelector('[data-v3-pane="ai-image"]');
  if(!pane||pane.dataset.nxpsEnhanced)return;
  pane.dataset.nxpsEnhanced='1';
  const aspect=pane.querySelector('[data-puter-aspect]'),style=pane.querySelector('[data-puter-style]'),prompt=pane.querySelector('[data-puter-prompt]'),generate=pane.querySelector('[data-puter-generate]');
  addChoiceButtons(root,aspect,{title:'Canvas ratio',allowed:['square','portrait','story','wide'],names:{square:'1:1',portrait:'4:5',story:'9:16',wide:'16:9'}});
  addChoiceButtons(root,style,{title:'Creative style',allowed:['auto','photo','cinematic','illustration','threeD','logo'],names:{auto:'Auto',photo:'Photo',cinematic:'Cinema',illustration:'Illustration',threeD:'3D',logo:'Logo'}});
  if(prompt){
    const suggestions=document.createElement('div');suggestions.className='nxps-ai-prompts';
    [['Portrait','Premium cinematic portrait, natural skin texture, soft studio light'],['Product','Luxury product photo, premium studio lighting, clean commercial background'],['Poster','Bold premium event poster concept, cinematic composition, dramatic light'],['Logo','Minimal original logo concept, clean geometry, premium brand identity']].forEach(([label,text])=>{const button=document.createElement('button');button.type='button';button.className='nxps-ai-prompt';button.textContent=label;button.onclick=()=>{prompt.value=text;prompt.focus()};suggestions.appendChild(button)});
    prompt.closest('.nxputer-label')?.after(suggestions);
  }
  if(generate)generate.textContent='✦ Generate with AI';
}

function formatTime(ts){
  const diff=Math.max(0,Date.now()-Number(ts||0));
  const min=Math.floor(diff/60000);if(min<1)return'just now';if(min<60)return`${min}m ago`;const hr=Math.floor(min/60);if(hr<24)return`${hr}h ago`;const day=Math.floor(hr/24);return`${day}d ago`;
}

export function installAiPhotoStudioHome(root){
  if(!root||root.__nxPremiumPhotoHomeInstalled)return()=>{};
  root.__nxPremiumPhotoHomeInstalled=true;ensureStyles();root.classList.add('nxps-premium-studio');

  const home=document.createElement('section');home.className='nxps-home';home.setAttribute('aria-label','AI Photo Studio home');
  home.innerHTML=`
    <div class="nxps-hero"><div class="nxps-logo"><img src="./assets/icons/nova-hub/ai-photo-studio.webp" alt=""></div><div class="nxps-hero-copy"><div class="nxps-kicker"><i></i>NexusNova Creative AI</div><h1>AI Photo Studio</h1><p>Create with AI, edit photos, customize original templates and continue saved designs in one focused studio.</p><div class="nxps-badges"><span class="nxps-badge">AI GENERATION</span><span class="nxps-badge">1000+ TEMPLATES</span><span class="nxps-badge">PRO EDITOR</span></div></div></div>
    <div class="nxps-heading"><strong>What do you want to create?</strong><span>Choose a workflow</span></div>
    <div class="nxps-actions">
      <button class="nxps-action is-ai" type="button" data-nxps-action="ai-image"><div class="nxps-action-top"><span class="nxps-action-icon">✦</span><span class="nxps-action-tag">AI</span></div><strong>Generate with AI</strong><p>Describe an original image and generate it with your connected Puter allowance.</p></button>
      <button class="nxps-action is-edit" type="button" data-nxps-action="edit"><div class="nxps-action-top"><span class="nxps-action-icon">＋</span><span class="nxps-action-tag">Photo</span></div><strong>Edit a Photo</strong><p>Open the existing enhanced editor with live preview, masks, retouch, filters and export.</p></button>
      <button class="nxps-action is-template" type="button" data-nxps-action="templates"><div class="nxps-action-top"><span class="nxps-action-icon">▦</span><span class="nxps-action-tag">1000+</span></div><strong>Templates</strong><p>Search original logos, posts, flyers, posters, cards, resumes, ads and more.</p></button>
      <button class="nxps-action" type="button" data-nxps-action="projects"><div class="nxps-action-top"><span class="nxps-action-icon">◇</span><span class="nxps-action-tag">Saved</span></div><strong>My Creations</strong><p>Continue locally saved design projects without leaving NexusNova.</p></button>
    </div>
    <div class="nxps-recent"><div class="nxps-recent-copy"><strong data-nxps-recent-title>Recent creations</strong><span data-nxps-recent-copy>No saved design yet. Start with AI or a template.</span><div class="nxps-recent-projects" data-nxps-recent-projects></div></div><button type="button" data-nxps-action="projects">Open projects</button></div>`;
  root.appendChild(home);

  const topActions=root.querySelector('.nx-photo-top-actions');
  const returnButton=document.createElement('button');returnButton.type='button';returnButton.className='nx-photo-mini nxps-home-return';returnButton.setAttribute('aria-label','AI Photo Studio home');returnButton.textContent='⌂';topActions?.prepend(returnButton);

  const workspace=root.querySelector('.nx-canva-v3'),photoBack=workspace?.querySelector('[data-v3-close]');
  let navGroup=null,workspaceHome=null;
  if(workspace&&photoBack){
    navGroup=document.createElement('div');navGroup.className='nxps-workspace-nav';photoBack.parentNode.insertBefore(navGroup,photoBack);navGroup.appendChild(photoBack);workspaceHome=document.createElement('button');workspaceHome.type='button';workspaceHome.className='nxv3-btn nxps-workspace-home';workspaceHome.textContent='Studio';navGroup.appendChild(workspaceHome);
  }

  const recentTitle=home.querySelector('[data-nxps-recent-title]'),recentCopy=home.querySelector('[data-nxps-recent-copy]'),recentProjects=home.querySelector('[data-nxps-recent-projects]');
  const refreshRecent=()=>{
    let projects=[];try{projects=listDesignProjects().slice(0,2)}catch{}
    recentProjects.innerHTML='';
    if(!projects.length){recentTitle.textContent='Recent creations';recentCopy.textContent='No saved design yet. Start with AI or a template.';return}
    recentTitle.textContent=`${projects.length===1?'Latest creation':'Recent creations'}`;recentCopy.textContent=`${projects.length} saved project${projects.length===1?'':'s'} · latest ${formatTime(projects[0].updatedAt)}`;
    projects.forEach(project=>{const chip=document.createElement('span');chip.className='nxps-project-chip';chip.textContent=project.name;chip.title=project.name;recentProjects.appendChild(chip)});
  };

  const closeEditorSheet=()=>{const sheet=root.querySelector('[data-photo-sheet]');if(sheet?.classList.contains('is-open'))root.querySelector('[data-photo-sheet-close]')?.click()};
  const hideHome=()=>{home.hidden=true;home.setAttribute('aria-hidden','true')};
  const showHome=()=>{closeEditorSheet();if(workspace?.classList.contains('is-open'))photoBack?.click();refreshRecent();home.hidden=false;home.removeAttribute('aria-hidden')};
  const openWorkspace=tab=>{
    const designButton=findDesignButton(root);if(!designButton)return;
    hideHome();closeEditorSheet();designButton.click();
    let tries=0;const focusTab=()=>{const target=root.querySelector(`[data-v3-tab="${tab}"]`);if(target){target.click();if(tab==='ai-image')enhanceGenerator(root);return}if(++tries<10)requestAnimationFrame(focusTab)};requestAnimationFrame(focusTab);
  };
  const openEditor=()=>{hideHome();if(workspace?.classList.contains('is-open'))photoBack?.click();closeEditorSheet();const canvas=root.querySelector('[data-photo-canvas]');if(!canvas||canvas.hidden)requestAnimationFrame(()=>root.querySelector('[data-photo-file]')?.click())};

  const actionHandler=event=>{const action=event.currentTarget.dataset.nxpsAction;if(action==='edit')openEditor();else if(action==='templates')openWorkspace('templates');else if(action==='projects')openWorkspace('projects');else if(action==='ai-image')openWorkspace('ai-image')};
  home.querySelectorAll('[data-nxps-action]').forEach(button=>button.addEventListener('click',actionHandler));
  returnButton.addEventListener('click',showHome);workspaceHome?.addEventListener('click',showHome);
  enhanceGenerator(root);refreshRecent();

  return()=>{
    home.querySelectorAll('[data-nxps-action]').forEach(button=>button.removeEventListener('click',actionHandler));
    returnButton.removeEventListener('click',showHome);workspaceHome?.removeEventListener('click',showHome);returnButton.remove();if(navGroup&&photoBack){navGroup.parentNode?.insertBefore(photoBack,navGroup);navGroup.remove()}home.remove();root.classList.remove('nxps-premium-studio');delete root.__nxPremiumPhotoHomeInstalled;
  };
}
