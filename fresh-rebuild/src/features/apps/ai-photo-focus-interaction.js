export function installSliderOnlyFocus(root){
  if(!root||root.__nxSliderFocusInstalled)return()=>{};
  root.__nxSliderFocusInstalled=true;
  const active=new Set();
  const isEditableControl=el=>!!el?.closest?.('[data-photo-sheet-panel="edit"],[data-photo-sheet-panel="adjust"],[data-photo-sheet-panel="looks"]')&&!!el.closest('input[type="range"],.nx-photo-preset,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-curve');
  const activate=el=>{
    if(!isEditableControl(el))return;
    active.add(el);
    root.classList.add('nx-photo-focus-editing');
  };
  const release=el=>{
    if(!isEditableControl(el))return;
    setTimeout(()=>{
      active.delete(el);
      if(!active.size){
        root.classList.remove('nx-photo-focus-editing','nx-photo-control-live');
        root.querySelectorAll('.is-live-control').forEach(n=>n.classList.remove('is-live-control'));
      }
    },180);
  };
  const onPointerDown=e=>activate(e.target);
  const onPointerUp=e=>release(e.target);
  const onFocus=e=>activate(e.target);
  const onBlur=e=>release(e.target);
  root.addEventListener('pointerdown',onPointerDown,true);
  root.addEventListener('pointerup',onPointerUp,true);
  root.addEventListener('pointercancel',onPointerUp,true);
  root.addEventListener('focusin',onFocus,true);
  root.addEventListener('focusout',onBlur,true);
  const observer=new MutationObserver(()=>{
    if(root.classList.contains('nx-photo-focus-editing')&&!active.size){
      root.classList.remove('nx-photo-focus-editing');
    }
  });
  observer.observe(root,{attributes:true,attributeFilter:['class']});
  return()=>{
    observer.disconnect();
    root.removeEventListener('pointerdown',onPointerDown,true);
    root.removeEventListener('pointerup',onPointerUp,true);
    root.removeEventListener('pointercancel',onPointerUp,true);
    root.removeEventListener('focusin',onFocus,true);
    root.removeEventListener('focusout',onBlur,true);
    root.classList.remove('nx-photo-focus-editing','nx-photo-control-live');
    root.querySelectorAll('.is-live-control').forEach(n=>n.classList.remove('is-live-control'));
    delete root.__nxSliderFocusInstalled;
  };
}
