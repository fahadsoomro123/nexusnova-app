function isOpen(node){return Boolean(node&&!node.hidden&&node.classList.contains('is-open'))}

export function installAiPhotoNavigation(root){
  if(!root||root.__nxStudioNavigation)return()=>{};
  const workspace=root.querySelector('.nx-canva-v3'),lockedHome=root.querySelector('.nxlock-home');

  const dispatch=screen=>{root.dataset.aiPhotoScreen=screen;root.dispatchEvent(new CustomEvent('nx-ai-photo:navigate',{detail:{screen}}))};
  const hideHome=()=>{if(!lockedHome)return;lockedHome.hidden=true;lockedHome.setAttribute('aria-hidden','true')};
  const closeSheet=()=>{const sheet=root.querySelector('[data-photo-sheet]');if(sheet?.classList.contains('is-open'))root.querySelector('[data-photo-sheet-close]')?.click()};

  function showHome(){
    root.__nxQuickTools?.close?.({silent:true});
    root.__nxCanvaWorkspaceV3?.close?.();
    closeSheet();
    workspace?.classList.remove('nxlock-ai-mode');
    const homeButton=lockedHome?.querySelector('.nxlock-home-btn');
    if(homeButton)homeButton.click();
    else if(lockedHome){lockedHome.hidden=false;lockedHome.removeAttribute('aria-hidden')}
    dispatch('home');
    return true;
  }

  function openWorkspace(tab='templates'){
    root.__nxQuickTools?.close?.({silent:true});hideHome();closeSheet();
    const api=root.__nxCanvaWorkspaceV3;
    if(api){if(tab==='templates'&&api.openTemplates)api.openTemplates();else{api.open();api.setTab(tab)}}
    else{const design=[...root.querySelectorAll('.nx-photo-tool')].find(button=>button.querySelector('span')?.textContent?.trim()==='Design');design?.click();root.querySelector(`[data-v3-tab="${tab}"]`)?.click()}
    dispatch(tab==='ai-image'?'generator':tab);
    return true;
  }

  function openEditor({pick=true}={}){
    root.__nxQuickTools?.close?.({silent:true});hideHome();root.__nxCanvaWorkspaceV3?.close?.();closeSheet();workspace?.classList.remove('nxlock-ai-mode');dispatch('photo-editor');
    const canvas=root.querySelector('[data-photo-canvas]');if(pick&&(!canvas||canvas.hidden))requestAnimationFrame(()=>root.querySelector('[data-photo-file]')?.click());return true;
  }

  function handleWorkspaceBack(){
    if(!workspace?.classList.contains('is-open'))return false;
    const detail=workspace.querySelector('[data-v3-detail]');
    if(detail?.classList.contains('is-open')){workspace.querySelector('[data-v3-detail-close]')?.click();return true}
    const active=workspace.querySelector('[data-v3-tab].is-active')?.dataset.v3Tab;
    if(active==='ai-image'){
      const result=workspace.querySelector('[data-puter-result]');
      if(result?.classList.contains('is-on')){result.classList.remove('is-on');dispatch('generator');return true}
      return showHome();
    }
    if(active==='layers'){root.__nxCanvaWorkspaceV3?.setTab?.('design');dispatch('design');return true}
    if(active==='design'){root.__nxCanvaWorkspaceV3?.setTab?.('templates');dispatch('templates');return true}
    return showHome();
  }

  function handleBack(){
    if(root.__nxQuickTools?.handleBack?.())return true;
    const popover=root.querySelector('.nxfix-recent-popover');if(popover&&!popover.hidden){popover.hidden=true;return true}
    if(workspace?.classList.contains('is-open'))return handleWorkspaceBack();
    const crop=root.querySelector('.nx-photo-crop-actions');if(crop){crop.querySelector('[data-crop-cancel]')?.click();return true}
    const sheet=root.querySelector('[data-photo-sheet]');if(sheet?.classList.contains('is-open')){closeSheet();return true}
    if(lockedHome?.hidden)return showHome();
    return false;
  }

  const generatorHome=root.querySelector('.nxlock-gen-home'),generatorBack=root.querySelector('.nxlock-gen-back'),workspaceBack=workspace?.querySelector('[data-v3-close]');
  const captureHome=event=>{event.preventDefault();event.stopImmediatePropagation();showHome()};
  const captureBack=event=>{event.preventDefault();event.stopImmediatePropagation();handleWorkspaceBack()};
  generatorHome?.addEventListener('click',captureHome,true);generatorBack?.addEventListener('click',captureBack,true);
  if(workspaceBack){workspaceBack.textContent='Back';workspaceBack.setAttribute('aria-label','Back');workspaceBack.title='Back';workspaceBack.addEventListener('click',captureBack,true)}
  const workspaceHome=root.querySelector('.nxps-workspace-home');workspaceHome?.setAttribute('aria-label','Studio Home');
  const workspaceNavigate=event=>{const tab=event.detail?.tab;if(tab)dispatch(tab==='ai-image'?'generator':tab)};workspace?.addEventListener('nxv3:navigate',workspaceNavigate);

  const api={showHome,openWorkspace,openEditor,handleBack,handleWorkspaceBack,isAtHome:()=>Boolean(lockedHome&&!lockedHome.hidden),getState:()=>({screen:root.dataset.aiPhotoScreen||'home',home:Boolean(lockedHome&&!lockedHome.hidden),workspace:Boolean(workspace?.classList.contains('is-open')),quickTools:Boolean(root.__nxQuickTools?.getState?.().open)})};
  root.__nxStudioNavigation=api;globalThis.NexusNovaAiPhotoNavigation=api;dispatch('home');
  return()=>{generatorHome?.removeEventListener('click',captureHome,true);generatorBack?.removeEventListener('click',captureBack,true);workspaceBack?.removeEventListener('click',captureBack,true);workspace?.removeEventListener('nxv3:navigate',workspaceNavigate);if(globalThis.NexusNovaAiPhotoNavigation===api)delete globalThis.NexusNovaAiPhotoNavigation;delete root.__nxStudioNavigation;delete root.dataset.aiPhotoScreen};
}
