export function installSliderOnlyFocus(root){
  if(!root||root.__nxSliderFocusInstalled)return()=>{};
  root.__nxSliderFocusInstalled=true;
  const active=new Map();
  const selector='input[type="range"],.nx-photo-preset,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-curve';
  const panelSelector='[data-photo-sheet-panel="edit"],[data-photo-sheet-panel="adjust"],[data-photo-sheet-panel="looks"]';
  const isEditableControl=el=>!!el?.closest?.(panelSelector)&&!!el.closest(selector);
  const rowFor=el=>el.closest('.nx-photo-field,.nx-photo-preset,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-curve')||el;
  const activate=el=>{
    if(!isEditableControl(el))return;
    const row=rowFor(el);
    active.set(el,row);
    root.querySelectorAll('.is-live-control').forEach(n=>n.classList.remove('is-live-control'));
    row.classList.add('is-live-control');
    root.classList.add('nx-photo-focus-editing','nx-photo-control-live');
  };
  const release=el=>{
    if(!isEditableControl(el))return;
    setTimeout(()=>{
      const row=active.get(el);
      active.delete(el);
      row?.classList.remove('is-live-control');
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
      root.classList.remove('nx-photo-focus-editing','nx-photo-control-live');
      root.querySelectorAll('.is-live-control').forEach(n=>n.classList.remove('is-live-control'));
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
