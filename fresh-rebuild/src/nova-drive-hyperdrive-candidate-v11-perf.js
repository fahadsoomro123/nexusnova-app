(() => {
  const id='nxhd11-perf';
  if(document.getElementById(id)) return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=`
    #nxhd11 .glass{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    #nxhd11 .hero::after{filter:none!important;opacity:.72}
    #nxhd11 .gauge .ticks,#nxhd11 .gauge .arc,#nxhd11 .route{filter:none!important}
    #nxhd11 svg.route{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:4!important}
    #nxhd11 svg.route path{fill:none!important}
    #nxhd11 .vehicle{z-index:6;box-shadow:0 0 0 18px #3ce2dd18,0 0 24px #19d7d5!important}
    #nxhd11 .pin{z-index:7;box-shadow:0 0 14px #1fdaf0!important}
    #nxhd11 .pin.end{box-shadow:0 0 14px #25d9a1!important}
    #nxhd11 .map::before,#nxhd11 .tracker::before{opacity:.36!important}
    #nxhd11 .blocks,#nxhd11 .tracker .city{opacity:0!important}
    #nxhd11 .nx11-roads{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:2!important;opacity:.78}
    #nxhd11 .nx11-road-major{fill:none;stroke:#e9f7fb;stroke-opacity:.74;stroke-width:11;stroke-linecap:round;stroke-linejoin:round}
    #nxhd11 .nx11-road-edge{fill:none;stroke:#406b84;stroke-opacity:.55;stroke-width:15;stroke-linecap:round;stroke-linejoin:round}
    #nxhd11 .nx11-road-minor{fill:none;stroke:#d6edf4;stroke-opacity:.54;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
    #nxhd11 .nx11-road-faint{fill:none;stroke:#8fb8c9;stroke-opacity:.42;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
    #nxhd11 .loc small{display:block!important;margin-bottom:5px!important;line-height:1!important}
    #nxhd11 .loc b{display:block!important;line-height:1.15!important}
    #nxhd11 .loc .end small,#nxhd11 .loc .end b{text-align:right!important}
  `;
  document.head.appendChild(s);
  const roads=`<svg class="nx11-roads" viewBox="0 0 600 470" preserveAspectRatio="none">
    <path class="nx11-road-edge" d="M-20 402 C86 330 108 244 212 248 S338 283 378 198 S492 84 630 96"/>
    <path class="nx11-road-major" d="M-20 402 C86 330 108 244 212 248 S338 283 378 198 S492 84 630 96"/>
    <path class="nx11-road-edge" d="M26 58 C124 124 182 122 256 168 S392 244 584 226"/>
    <path class="nx11-road-major" d="M26 58 C124 124 182 122 256 168 S392 244 584 226"/>
    <path class="nx11-road-minor" d="M52 438 C116 372 154 330 188 268 M196 470 C214 390 242 300 288 230 M344 470 C324 390 324 318 350 244 M480 470 C438 374 418 314 402 242"/>
    <path class="nx11-road-minor" d="M0 314 C114 310 176 288 252 294 S418 338 600 320 M0 184 C106 196 184 186 264 202 S442 248 600 260"/>
    <path class="nx11-road-faint" d="M78 0 C116 88 136 162 148 250 M186 0 C220 90 236 154 238 226 M300 0 C318 86 326 140 326 198 M422 0 C422 84 414 132 396 182 M532 0 C500 82 474 128 448 168"/>
    <path class="nx11-road-faint" d="M0 112 C94 124 166 114 224 128 S368 178 600 168 M0 366 C116 360 190 350 272 358 S442 408 600 390"/>
  </svg>`;
  const install=()=>document.querySelectorAll('#nxhd11 .map,#nxhd11 .tracker').forEach(el=>{if(!el.querySelector('.nx11-roads'))el.insertAdjacentHTML('afterbegin',roads)});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();