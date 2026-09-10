const STYLE_ID='nn-travel-clean-ui-v27';
const ROOT_SELECTOR='.nn-travel-v19';

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`${ROOT_SELECTOR} .nn-ota-badge{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}`;
  document.head.appendChild(style);
}

function clean(root){
  if(!(root instanceof HTMLElement))return;
  root.dataset.cleanUiV27='true';
  root.querySelectorAll('.nn-ota-badge').forEach(node=>node.remove());
}

function scan(node=document){
  if(node instanceof HTMLElement&&node.matches(ROOT_SELECTOR))clean(node);
  node.querySelectorAll?.(ROOT_SELECTOR).forEach(clean);
}

ensureStyle();
scan();
new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node instanceof HTMLElement)scan(node);
    }
  }
}).observe(document.documentElement,{childList:true,subtree:true});
