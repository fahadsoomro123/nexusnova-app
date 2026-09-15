/* Real app-shell bridge for Fare Lens. The generic app header is owned by
   app-screen.js for normal apps; Travel/Fare Lens is a full-screen product.
   Preserve its back action, remove only the obsolete Travel wrapper, and leave
   the global MINE/NOVA HUB dock untouched. */
function repairTravelShell(){
  const travel=document.querySelector('#nx-stage .nxf-travel');
  if(!travel)return;
  const screen=travel.closest('#nx-stage > .nx-screen');
  if(!screen)return;
  screen.classList.add('nx-travel-runtime-screen');
  const header=screen.querySelector(':scope > .nx-app-head');
  if(header){
    const back=header.querySelector('[data-app-back]');
    if(back){back.hidden=true;back.setAttribute('aria-hidden','true');screen.insertBefore(back,screen.firstChild);}
    header.remove();
  }
  screen.querySelectorAll('[data-smart-travel-context]').forEach(node=>node.remove());
}
const observer=new MutationObserver(()=>repairTravelShell());
observer.observe(document.getElementById('nx-stage')||document.body,{subtree:true,childList:true});
repairTravelShell();
export {repairTravelShell};
