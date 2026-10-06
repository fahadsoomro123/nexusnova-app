function safeToolName(value){return String(value||'creation').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'creation'}

export function installAiPhotoDownloadSmoothV1(root){
  if(!root||root.__nxAiPhotoDownloadSmoothV1)return()=>{};
  root.__nxAiPhotoDownloadSmoothV1=true;
  const onClick=event=>{
    const button=event.target?.closest?.('[data-nxqt-download]');
    if(!button||!root.contains(button)||button.disabled)return;
    const state=root.__nxQuickTools?.getState?.();
    if(!state?.open||state.screen!=='result')return;
    const canvas=root.querySelector('.nxqt-result .nxqt-canvas-wrap canvas:not([hidden])');
    if(!canvas||canvas.width*canvas.height>1_000_000)return;
    try{
      const anchor=document.createElement('a');
      anchor.href=canvas.toDataURL('image/png');
      anchor.download=`nexusnova-${safeToolName(state.tool)}.png`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      event.preventDefault();event.stopImmediatePropagation();
    }catch{
      /* Large/unsupported canvases fall through to the existing memory-safe Blob exporter. */
    }
  };
  root.addEventListener('click',onClick,true);
  return()=>{root.removeEventListener('click',onClick,true);delete root.__nxAiPhotoDownloadSmoothV1};
}
