const STYLE_ID = 'nn-travel-elegant-layout-v20';

const CSS = `
.nn-travel-v19 .nn-search-card{
  justify-content:flex-start!important;
  gap:12px!important;
  padding:14px!important;
}
.nn-travel-v19 .nn-trip-row{flex:0 0 auto!important;min-height:46px!important}
.nn-travel-v19 .nn-route-row{flex:0 0 auto!important;min-height:132px!important}
.nn-travel-v19 .nn-route-card{min-height:132px!important}
.nn-travel-v19 .nn-date-row,
.nn-travel-v19 .nn-meta-row{flex:0 0 auto!important;min-height:88px!important}
.nn-travel-v19 .nn-date-card,
.nn-travel-v19 .nn-meta-card{min-height:88px!important;padding-top:10px!important;padding-bottom:10px!important}
.nn-travel-v19 .nn-filter-row{flex:0 0 auto!important;min-height:64px!important}
.nn-travel-v19 .nn-filter-btn{min-height:64px!important}
.nn-travel-v19 [data-flight-search]{
  flex:0 0 64px!important;
  min-height:64px!important;
  max-height:64px!important;
  margin-top:2px!important;
  border-radius:15px!important;
}
.nn-travel-v19 .nn-search-status{flex:0 0 auto!important;min-height:14px!important;margin-top:-7px!important}
.nn-travel-v19 .nn-trust{
  flex:0 0 auto!important;
  min-height:62px!important;
  margin-top:auto!important;
  padding-top:10px!important;
  padding-bottom:6px!important;
}
@media(max-width:390px){
  .nn-travel-v19 .nn-search-card{gap:9px!important;padding:12px!important}
  .nn-travel-v19 .nn-route-row,.nn-travel-v19 .nn-route-card{min-height:118px!important}
  .nn-travel-v19 .nn-date-row,.nn-travel-v19 .nn-meta-row,
  .nn-travel-v19 .nn-date-card,.nn-travel-v19 .nn-meta-card{min-height:76px!important}
  .nn-travel-v19 .nn-filter-row,.nn-travel-v19 .nn-filter-btn{min-height:58px!important}
  .nn-travel-v19 [data-flight-search]{flex-basis:58px!important;min-height:58px!important;max-height:58px!important}
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
  if(root) root.dataset.elegantLayoutV20='true';
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
