function firePointer(canvas,type,clientX,clientY,pointerId=991){
  const EventCtor=globalThis.PointerEvent||globalThis.MouseEvent;
  canvas.dispatchEvent(new EventCtor(type,{bubbles:true,cancelable:true,clientX,clientY,pointerId,button:0,buttons:type==='pointerup'?0:1,pointerType:'touch'}));
}

export function installAiPhotoDesignEditorControls(root){
  if(!root||root.__nxDesignEditorControlsInstalled)return()=>{};
  root.__nxDesignEditorControlsInstalled=true;
  const toolbar=root.querySelector('.nxv3-toolbar'),canvas=root.querySelector('[data-v3-canvas]');
  if(!toolbar||!canvas){delete root.__nxDesignEditorControlsInstalled;return()=>{}}

  const canvasButton=document.createElement('button');
  canvasButton.type='button';
  canvasButton.className='nxv3-btn';
  canvasButton.dataset.v3CanvasSelect='';
  canvasButton.textContent='Canvas';
  canvasButton.setAttribute('aria-label','Select canvas background');
  canvasButton.onclick=()=>{
    const rect=canvas.getBoundingClientRect();
    firePointer(canvas,'pointerdown',rect.left-2,rect.top-2);
    firePointer(canvas,'pointerup',rect.left-2,rect.top-2);
  };
  toolbar.prepend(canvasButton);

  return()=>{
    canvasButton.remove();
    delete root.__nxDesignEditorControlsInstalled;
  };
}
