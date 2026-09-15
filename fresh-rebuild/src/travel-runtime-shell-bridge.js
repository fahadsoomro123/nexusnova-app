/* Real app-shell bridge for Fare Lens.
 * app-screen.js owns the generic app header for most apps. Travel/Fare Lens is
 * a full-screen product surface, so the bridge neutralizes only that wrapper
 * after the actual router mounts the real renderer. The global dock is untouched.
 */
function repairTravelShell(){
  const travel=document.querySelector('#nx-stage .nxf-travel');
  if(!travel)return;
  const screen=travel.closest('#nx-stage > .nx-screen');
  if(!screen)return;
  screen.classList.add('nx-travel-runtime-screen');
  const header=screen.querySelector(':scope > .nx-app-head');
  if(header){header.hidden=true;header.setAttribute('aria-hidden','true');}
  screen.querySelectorAll('[data-smart-travel-context]').forEach(node=>node.remove());
}
const observer=new MutationObserver(()=>repairTravelShell());
observer.observe(document.getElementById('nx-stage')||document.body,{subtree:true,childList:true});
repairTravelShell();
export {repairTravelShell};
