const STYLE_ID='nn-travel-hyper3d-polish-v22';

const CSS=`
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-routes{position:relative!important}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-routes>.nn-swap{
  position:absolute!important;
  z-index:30!important;
  left:50%!important;
  top:50%!important;
  width:36px!important;
  height:36px!important;
  margin:0!important;
  transform:translate(-50%,-50%) translateZ(0)!important;
  transform-origin:center!important;
}
html.nn-travel-v8-active body #nx-app .nn-travel-v19 .nn-routes>.nn-swap:active{
  transform:translate(-50%,calc(-50% + 4px)) scale(.993)!important;
}
`;

function install(){
  let style=document.getElementById(STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=CSS;
    document.head.appendChild(style);
  }
  const root=document.querySelector('.nn-travel-v19');
  if(root) root.dataset.hyper3dPolishV22='true';
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
