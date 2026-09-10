const STYLE_ID='nx-ai-photo-mobile-workspace-clean-v1';
const MOBILE_CLASS='nxps-mobile-workspace-clean';
const NARROW_CLASS='nxps-mobile-workspace-narrow';

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS}{grid-template-rows:40px 38px minmax(0,1fr)!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-head{min-height:40px!important;padding:4px 5px!important;gap:4px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-head .nxv3-title{min-width:0!important;gap:2px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-head .nxv3-title strong{font-size:10px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-head .nxv3-title span{display:none!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-head .nxv3-btn{min-height:30px!important;height:30px!important;padding:0 7px!important;font-size:7.5px!important;border-radius:8px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-tabs{display:flex!important;grid-template-columns:none!important;align-items:center!important;gap:4px!important;min-width:0!important;padding:3px 4px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;overscroll-behavior-x:contain!important;-webkit-overflow-scrolling:touch!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-tabs::-webkit-scrollbar{display:none!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-tab{flex:0 0 auto!important;width:auto!important;min-width:64px!important;height:31px!important;min-height:31px!important;padding:0 8px!important;border-radius:8px!important;font-size:8.5px!important;white-space:nowrap!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-body{min-height:0!important;overflow:hidden!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-pane{min-height:0!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-pane[data-v3-pane="templates"]{padding:7px!important;overflow:auto!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-pane[data-v3-pane="templates"] .nxv3-guide{display:none!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-filter{gap:5px!important;margin-bottom:7px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-filter input,.nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-filter select{min-height:34px!important;height:34px!important;font-size:8.5px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-grid{gap:7px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxv3-card{border-radius:10px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxps-account-chip{min-width:34px!important;max-width:52px!important;height:30px!important;min-height:30px!important;padding:0 5px!important;margin-right:2px!important;font-size:7px!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} .nxps-workspace-home{min-width:48px!important;width:48px!important;padding:0 4px!important;font-size:7px!important}
  .nx-photo-editor .nx-canva-v3.${MOBILE_CLASS} [data-v3-export]{min-width:44px!important;padding-inline:5px!important}
  .nx-photo-editor .nx-canva-v3.${NARROW_CLASS} .nxv3-tab{min-width:58px!important;padding-inline:6px!important;font-size:8px!important}
  .nx-photo-editor .nx-canva-v3.${NARROW_CLASS} .nxps-account-chip{max-width:38px!important}
  `;
  document.head.appendChild(style);
}

export function installAiPhotoMobileWorkspaceCleanV1(root){
  if(!root||root.__nxAiPhotoMobileWorkspaceCleanV1)return()=>{};
  root.__nxAiPhotoMobileWorkspaceCleanV1=true;
  ensureStyle();
  const workspace=root.querySelector('.nx-canva-v3');
  const tabs=workspace?.querySelector('.nxv3-tabs');
  if(tabs)tabs.setAttribute('aria-label','Design workspace tabs');
  if(!workspace)return()=>{delete root.__nxAiPhotoMobileWorkspaceCleanV1};

  const sync=()=>{
    const workspaceWidth=workspace.getBoundingClientRect().width;
    const rootWidth=root.getBoundingClientRect().width;
    const width=workspaceWidth||rootWidth||window.innerWidth||0;
    workspace.classList.toggle(MOBILE_CLASS,width>0&&width<=430);
    workspace.classList.toggle(NARROW_CLASS,width>0&&width<=370);
  };
  sync();
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(sync):null;
  observer?.observe(workspace);
  if(root!==workspace)observer?.observe(root);
  window.addEventListener('resize',sync,{passive:true});
  requestAnimationFrame(sync);

  return()=>{
    observer?.disconnect();
    window.removeEventListener('resize',sync);
    workspace.classList.remove(MOBILE_CLASS,NARROW_CLASS);
    delete root.__nxAiPhotoMobileWorkspaceCleanV1;
  };
}
