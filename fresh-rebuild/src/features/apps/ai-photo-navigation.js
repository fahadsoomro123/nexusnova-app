const WORKSPACE_SCREENS=new Set(['templates','design','layers','projects','generator']);
const normalizeTab=tab=>tab==='ai-image'?'generator':WORKSPACE_SCREENS.has(tab)?tab:'templates';

export function installAiPhotoNavigation(root){
  if(!root||root.__nxStudioNavigation)return()=>{};
  const workspace=root.querySelector('.nx-canva-v3'),lockedHome=root.querySelector('.nxlock-home');
  const trace=[];
  let current='home';

  const record=(screen,reason='navigate')=>{
    const next=screen||'home',previous=current;
    current=next;
    root.dataset.aiPhotoScreen=next;
    trace.push({screen:next,previous,reason,at:Date.now()});
    if(trace.length>32)trace.splice(0,trace.length-32);
    root.dispatchEvent(new CustomEvent('nx-ai-photo:navigate',{detail:{screen:next,previous,reason}}));
    return next;
  };
  const hideHome=()=>{if(!lockedHome)return;lockedHome.hidden=true;lockedHome.setAttribute('aria-hidden','true')};
  const closeSheet=()=>{const sheet=root.querySelector('[data-photo-sheet]');if(sheet?.classList.contains('is-open'))root.querySelector('[data-photo-sheet-close]')?.click()};
  const isHomeVisible=()=>Boolean(lockedHome&&!lockedHome.hidden);
  const activeWorkspaceScreen=()=>normalizeTab(workspace?.querySelector('[data-v3-tab].is-active')?.dataset.v3Tab);
  const inferredScreen=()=>{
    if(root.__nxQuickTools?.getState?.().open)return'quick-tools';
    if(workspace?.classList.contains('is-open'))return activeWorkspaceScreen();
    if(isHomeVisible())return'home';
    return'photo-editor';
  };
  const syncFromDom=(reason='dom-sync')=>{
    const next=inferredScreen();
    if(next!==current)record(next,reason);
    return next;
  };

  function showHome({reason='home'}={}){
    root.__nxQuickTools?.close?.({silent:true});
    root.__nxCanvaWorkspaceV3?.close?.();
    closeSheet();
    workspace?.classList.remove('nxlock-ai-mode');
    const homeButton=lockedHome?.querySelector('.nxlock-home-btn');
    if(homeButton)homeButton.click();
    else if(lockedHome){lockedHome.hidden=false;lockedHome.removeAttribute('aria-hidden')}
    record('home',reason);
    return true;
  }

  function openWorkspace(tab='templates',{reason='workspace'}={}){
    root.__nxQuickTools?.close?.({silent:true});hideHome();closeSheet();
    const api=root.__nxCanvaWorkspaceV3;
    if(api){
      if(tab==='templates'&&api.openTemplates)api.openTemplates();
      else{api.open();api.setTab(tab)}
    }else{
      const design=[...root.querySelectorAll('.nx-photo-tool')].find(button=>button.querySelector('span')?.textContent?.trim()==='Design');
      design?.click();root.querySelector(`[data-v3-tab="${tab}"]`)?.click();
    }
    record(normalizeTab(tab),reason);
    return true;
  }

  function openEditor({pick=true,reason='photo-editor'}={}){
    root.__nxQuickTools?.close?.({silent:true});hideHome();root.__nxCanvaWorkspaceV3?.close?.();closeSheet();workspace?.classList.remove('nxlock-ai-mode');
    record('photo-editor',reason);
    const canvas=root.querySelector('[data-photo-canvas]');
    if(pick&&(!canvas||canvas.hidden))requestAnimationFrame(()=>root.querySelector('[data-photo-file]')?.click());
    return true;
  }

  function handleWorkspaceBack({reason='workspace-back'}={}){
    if(!workspace?.classList.contains('is-open'))return false;
    const detail=workspace.querySelector('[data-v3-detail]');
    if(detail?.classList.contains('is-open')){
      workspace.querySelector('[data-v3-detail-close]')?.click();
      record(activeWorkspaceScreen(),`${reason}:detail`);
      return true;
    }
    const active=workspace.querySelector('[data-v3-tab].is-active')?.dataset.v3Tab;
    if(active==='ai-image'){
      const result=workspace.querySelector('[data-puter-result]');
      if(result?.classList.contains('is-on')){
        result.classList.remove('is-on');
        record('generator',`${reason}:result`);
        return true;
      }
      return showHome({reason});
    }
    if(active==='layers'){
      root.__nxCanvaWorkspaceV3?.setTab?.('design');
      record('design',reason);
      return true;
    }
    if(active==='design'){
      root.__nxCanvaWorkspaceV3?.setTab?.('templates');
      record('templates',reason);
      return true;
    }
    return showHome({reason});
  }

  function canHandleBack(){
    if(root.__nxQuickTools?.getState?.().open)return true;
    const popover=root.querySelector('.nxfix-recent-popover');
    if(popover&&!popover.hidden)return true;
    if(workspace?.classList.contains('is-open'))return true;
    if(root.querySelector('.nx-photo-crop-actions'))return true;
    if(root.querySelector('[data-photo-sheet]')?.classList.contains('is-open'))return true;
    return !isHomeVisible()||current!=='home';
  }

  function handleBack({reason='back'}={}){
    if(root.__nxQuickTools?.handleBack?.()){
      queueMicrotask(()=>syncFromDom(`${reason}:quick-tools`));
      return true;
    }
    const popover=root.querySelector('.nxfix-recent-popover');
    if(popover&&!popover.hidden){popover.hidden=true;record(current,`${reason}:recent`);return true}
    if(workspace?.classList.contains('is-open'))return handleWorkspaceBack({reason});
    const crop=root.querySelector('.nx-photo-crop-actions');
    if(crop){crop.querySelector('[data-crop-cancel]')?.click();record('photo-editor',`${reason}:crop`);return true}
    const sheet=root.querySelector('[data-photo-sheet]');
    if(sheet?.classList.contains('is-open')){closeSheet();record('photo-editor',`${reason}:sheet`);return true}
    if(!isHomeVisible()||current!=='home')return showHome({reason});
    return false;
  }

  const generatorHome=root.querySelector('.nxlock-gen-home'),generatorBack=root.querySelector('.nxlock-gen-back'),workspaceBack=workspace?.querySelector('[data-v3-close]');
  const captureHome=event=>{event.preventDefault();event.stopImmediatePropagation();showHome({reason:'generator-home'})};
  const captureBack=event=>{event.preventDefault();event.stopImmediatePropagation();handleWorkspaceBack({reason:'workspace-button'})};
  generatorHome?.addEventListener('click',captureHome,true);generatorBack?.addEventListener('click',captureBack,true);
  if(workspaceBack){workspaceBack.textContent='Back';workspaceBack.setAttribute('aria-label','Back');workspaceBack.title='Back';workspaceBack.addEventListener('click',captureBack,true)}
  const workspaceHome=root.querySelector('.nxps-workspace-home');workspaceHome?.setAttribute('aria-label','Studio Home');
  const workspaceNavigate=event=>{const tab=event.detail?.tab;if(tab)record(normalizeTab(tab),'workspace-tab')};
  workspace?.addEventListener('nxv3:navigate',workspaceNavigate);

  const rootClickSync=event=>{
    const target=event.target instanceof Element?event.target.closest('button,[role="button"]'):null;
    if(!target||!root.contains(target))return;
    queueMicrotask(()=>syncFromDom('ui-click'));
  };
  root.addEventListener('click',rootClickSync);

  const routeBackCapture=event=>{
    const target=event.target instanceof Element?event.target.closest('[data-app-back]'):null;
    const route=target?.closest('.nx-ai-photo-route-screen');
    if(!target||!route||!route.contains(root)||!canHandleBack())return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleBack({reason:'route-back'});
  };
  document.addEventListener('click',routeBackCapture,true);

  const api={
    showHome,openWorkspace,openEditor,handleBack,handleWorkspaceBack,canHandleBack,syncFromDom,
    isAtHome:isHomeVisible,
    getState:()=>({
      screen:current,
      home:isHomeVisible(),
      workspace:Boolean(workspace?.classList.contains('is-open')),
      quickTools:Boolean(root.__nxQuickTools?.getState?.().open),
      canHandleBack:canHandleBack(),
      trace:[...trace]
    })
  };
  root.__nxStudioNavigation=api;
  globalThis.NexusNovaAiPhotoNavigation=api;
  root.dataset.aiPhotoArchitecture='v17-core-router';
  record(inferredScreen(),'install');

  return()=>{
    generatorHome?.removeEventListener('click',captureHome,true);
    generatorBack?.removeEventListener('click',captureBack,true);
    workspaceBack?.removeEventListener('click',captureBack,true);
    workspace?.removeEventListener('nxv3:navigate',workspaceNavigate);
    root.removeEventListener('click',rootClickSync);
    document.removeEventListener('click',routeBackCapture,true);
    if(globalThis.NexusNovaAiPhotoNavigation===api)delete globalThis.NexusNovaAiPhotoNavigation;
    delete root.__nxStudioNavigation;
    delete root.dataset.aiPhotoScreen;
    delete root.dataset.aiPhotoArchitecture;
  };
}
