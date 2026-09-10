const STYLE_ID='nn-travel-passenger-popover-v26';
const CSS=`
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-passenger-pair{
  position:relative!important;
  z-index:720!important;
  overflow:visible!important;
  isolation:isolate!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-passenger-pair .nn-travelers-control{
  z-index:740!important;
  overflow:visible!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-passenger-pair .nn-passenger-popover{
  z-index:1000!important;
  left:0!important;
  right:auto!important;
  width:min(278px,calc(100vw - 44px))!important;
  max-width:calc(100vw - 44px)!important;
}
`;
function install(){
  if(!document.getElementById(STYLE_ID)){const s=document.createElement('style');s.id=STYLE_ID;s.textContent=CSS;document.head.appendChild(s)}
  document.querySelectorAll('.nn-travel-v19 .nn-travelers-control').forEach(control=>{
    const pair=control.closest('.nn-pair');
    if(pair&&!pair.classList.contains('nn-passenger-pair'))pair.classList.add('nn-passenger-pair');
    const root=control.closest('.nn-travel-v19');
    if(root)root.dataset.passengerPopoverV26='true';
  });
}
install();
new MutationObserver(()=>queueMicrotask(install)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(install,250);
