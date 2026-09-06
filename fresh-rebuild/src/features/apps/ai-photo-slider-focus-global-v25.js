const STYLE_ID='nx-ai-photo-slider-focus-v25';
const SLIDER_SELECTOR='input[type="range"],[role="slider"]';
const ACTIVE_ATTR='data-nx-slider-focus-active';
const PREVIEW_ATTR='data-nx-slider-focus-preview';
const MUTED_ATTR='data-nx-slider-focus-muted';

function ensureSliderFocusStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .nx-photo-editor[data-nx-slider-focus="on"] [${MUTED_ATTR}="true"]{
      opacity:.14!important;
      filter:saturate(.42) brightness(.68)!important;
      transition:opacity .13s ease,filter .13s ease!important;
    }
    .nx-photo-editor[data-nx-slider-focus="on"] [${ACTIVE_ATTR}="true"],
    .nx-photo-editor[data-nx-slider-focus="on"] [${PREVIEW_ATTR}="true"]{
      opacity:1!important;
      filter:none!important;
    }
    .nx-photo-editor[data-nx-slider-focus="on"] [${ACTIVE_ATTR}="true"]{
      position:relative;
      z-index:20;
    }
    .nx-photo-editor[data-nx-slider-focus="on"].nx-photo-control-live .nx-photo-field[${ACTIVE_ATTR}="true"].is-live-control{
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      box-shadow:none!important;
      background:transparent!important;
      backdrop-filter:none!important;
    }
    @media(prefers-reduced-motion:reduce){
      .nx-photo-editor[data-nx-slider-focus="on"] [${MUTED_ATTR}="true"]{transition:none!important}
    }
  `;
  document.head.appendChild(style);
}

export function installSliderOnlyFocus(root){
  if(!root||root.__nxSliderFocusInstalled)return()=>{};
  root.__nxSliderFocusInstalled=true;
  ensureSliderFocusStyles();

  let activeSlider=null;
  let activeRow=null;
  let activePreview=null;
  let pointerActive=false;
  let releaseTimer=0;

  const asSlider=target=>target?.closest?.(SLIDER_SELECTOR)||null;
  const isUsableSlider=slider=>!!slider&&root.contains(slider)&&!slider.disabled&&slider.getAttribute('aria-disabled')!=='true';
  const rowFor=slider=>slider.closest(
    '[data-nx-slider-row],.nx-photo-field,.nxv3-field,.nxv3-control-row,.nxv3-setting,.nx-control-row,.nx-setting-row,.control-row,.setting-row,label'
  )||slider.parentElement||slider;
  const visible=el=>{
    if(!el||!root.contains(el))return false;
    const rect=el.getBoundingClientRect?.();
    if(!rect||rect.width<32||rect.height<32)return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0;
  };
  const previewFor=row=>{
    const media=[...root.querySelectorAll('[data-photo-canvas],[data-design-canvas],canvas,img,video')]
      .filter(el=>visible(el)&&!row.contains(el))
      .filter(el=>!el.closest('.nx-photo-panel,.nx-photo-sheet,.nx-photo-tabs,.nx-photo-pills'));
    if(!media.length)return null;
    return media.reduce((best,el)=>{
      const r=el.getBoundingClientRect();
      const area=r.width*r.height;
      if(!best)return {el,area};
      return area>best.area?{el,area}:best;
    },null)?.el||null;
  };
  const clearMarks=()=>{
    root.querySelectorAll(`[${ACTIVE_ATTR}],[${PREVIEW_ATTR}],[${MUTED_ATTR}]`).forEach(el=>{
      el.removeAttribute(ACTIVE_ATTR);
      el.removeAttribute(PREVIEW_ATTR);
      el.removeAttribute(MUTED_ATTR);
    });
  };
  const fadeOtherBranches=protectedRoots=>{
    const walk=parent=>{
      [...parent.children].forEach(child=>{
        if(protectedRoots.some(item=>item===child||item.contains(child)))return;
        if(protectedRoots.some(item=>child.contains(item))){
          walk(child);
          return;
        }
        child.setAttribute(MUTED_ATTR,'true');
      });
    };
    walk(root);
  };
  const paintFocus=()=>{
    clearMarks();
    if(!activeSlider||!activeRow||!root.contains(activeSlider))return;
    activeRow.setAttribute(ACTIVE_ATTR,'true');
    activePreview=previewFor(activeRow);
    if(activePreview)activePreview.setAttribute(PREVIEW_ATTR,'true');
    const protectedRoots=[activeRow];
    if(activePreview)protectedRoots.push(activePreview);
    fadeOtherBranches(protectedRoots);
    root.dataset.nxSliderFocus='on';
  };
  const activate=slider=>{
    if(!isUsableSlider(slider))return;
    if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=0;}
    activeSlider=slider;
    activeRow=rowFor(slider);
    paintFocus();
  };
  const clearFocus=()=>{
    if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=0;}
    activeSlider=null;
    activeRow=null;
    activePreview=null;
    pointerActive=false;
    clearMarks();
    delete root.dataset.nxSliderFocus;
  };
  const scheduleRelease=(delay=90)=>{
    if(releaseTimer)clearTimeout(releaseTimer);
    releaseTimer=setTimeout(clearFocus,delay);
  };

  const onPointerDown=event=>{
    const slider=asSlider(event.target);
    if(!isUsableSlider(slider))return;
    pointerActive=true;
    activate(slider);
  };
  const onPointerEnd=()=>{
    if(!pointerActive)return;
    pointerActive=false;
    scheduleRelease();
  };
  const onFocus=event=>{
    const slider=asSlider(event.target);
    if(isUsableSlider(slider))activate(slider);
  };
  const onBlur=event=>{
    if(pointerActive)return;
    const slider=asSlider(event.target);
    if(slider&&slider===activeSlider)scheduleRelease(0);
  };
  const onKeyDown=event=>{
    if(event.key==='Escape'&&activeSlider)clearFocus();
  };

  root.addEventListener('pointerdown',onPointerDown,true);
  root.addEventListener('focusin',onFocus,true);
  root.addEventListener('focusout',onBlur,true);
  root.addEventListener('keydown',onKeyDown,true);
  window.addEventListener('pointerup',onPointerEnd,true);
  window.addEventListener('pointercancel',onPointerEnd,true);

  const observer=new MutationObserver(()=>{
    if(activeSlider&&!root.contains(activeSlider))clearFocus();
  });
  observer.observe(root,{childList:true,subtree:true});

  return()=>{
    observer.disconnect();
    if(releaseTimer)clearTimeout(releaseTimer);
    root.removeEventListener('pointerdown',onPointerDown,true);
    root.removeEventListener('focusin',onFocus,true);
    root.removeEventListener('focusout',onBlur,true);
    root.removeEventListener('keydown',onKeyDown,true);
    window.removeEventListener('pointerup',onPointerEnd,true);
    window.removeEventListener('pointercancel',onPointerEnd,true);
    clearFocus();
    delete root.__nxSliderFocusInstalled;
  };
}
