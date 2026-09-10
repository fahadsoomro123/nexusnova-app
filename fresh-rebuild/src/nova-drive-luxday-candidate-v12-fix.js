(() => {
  'use strict';
  const id='nxd12-tracker-map-fix';
  if(document.getElementById(id)) return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    #nxd12 .tracker svg{position:absolute;inset:0;width:100%;height:100%;z-index:1}
    #nxd12 .tracker .water{fill:#cce8ef!important}
    #nxd12 .tracker .land{fill:#e9f0db!important}
    #nxd12 .tracker .roadbg{fill:none!important;stroke:#cad3ce!important;stroke-width:16!important;stroke-linecap:round!important}
    #nxd12 .tracker .road{fill:none!important;stroke:#fff!important;stroke-width:10!important;stroke-linecap:round!important}
    #nxd12 .tracker .minor{fill:none!important;stroke:#f7fbf8!important;stroke-width:5!important}
    #nxd12 .tracker .beam{z-index:3!important}
    #nxd12 .tracker .vehicle{z-index:8!important}
    #nxd12 .trackerStatus{z-index:9!important}
  `;
  document.head.appendChild(style);
})();