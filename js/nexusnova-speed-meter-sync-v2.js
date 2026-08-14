/* NexusNova Speed Meter Sync v2 */
(() => {
  'use strict';
  if (window.__nxSpeedMeterSyncV2) return;
  window.__nxSpeedMeterSyncV2 = true;
  const SCALE=[0,1,5,10,25,50,100,250,500];
  const min=-135,max=135,cap=500;
  const angleFor=value=>{
    const speed=Math.max(0,Math.min(cap,Number(value)||0));
    const ratio=Math.log10(1+speed)/Math.log10(1+cap);
    return min+(max-min)*ratio;
  };
  function ensureCss(){
    if(document.querySelector('link[data-nx-speed-meter-v2]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./css/nexusnova-speed-meter-v2.css?v=2';
    link.dataset.nxSpeedMeterV2='1';
    document.head.appendChild(link);
  }
  function buildScale(dial){
    if(dial.querySelector('.nx-speed-scale-v2')) return;
    const scale=document.createElement('div');
    scale.className='nx-speed-scale-v2';
    SCALE.forEach(value=>{
      const a=angleFor(value),r=(a-90)*Math.PI/180;
      const mark=document.createElement('span');
      mark.textContent=value===500?'500+':String(value);
      mark.style.left=`${50+41*Math.cos(r)}%`;
      mark.style.top=`${50+41*Math.sin(r)}%`;
      scale.appendChild(mark);
    });
    dial.appendChild(scale);
  }
  function readSpeed(){
    const raw=String(document.getElementById('nxSpeedMain')?.textContent||'');
    const match=raw.match(/([0-9]+(?:\.[0-9]+)?)/);
    return match?Number(match[1]):0;
  }
  function sync(){
    const panel=document.getElementById('tool-speed');
    const gauge=panel?.querySelector('.nx-speed-gauge');
    if(!panel||!gauge) return;
    panel.classList.add('nx-speed-v2');
    let dial=gauge.querySelector('.nx-speed-dial-v2');
    if(!dial){
      dial=document.createElement('div');
      dial.className='nx-speed-dial-v2';
      dial.innerHTML='<div class="nx-speed-glass-v2"></div><div class="nx-speed-needle-v2"><i></i></div><div class="nx-speed-hub-v2"></div>';
      gauge.prepend(dial);
      buildScale(dial);
    }
    const speed=readSpeed();
    dial.style.setProperty('--nx-speed-angle',`${angleFor(speed).toFixed(2)}deg`);
    dial.dataset.speed=String(speed);
  }
  function install(){
    ensureCss();
    const main=document.getElementById('nxSpeedMain');
    if(!main) return;
    if(main.dataset.nxMeterObserved!=='1'){
      main.dataset.nxMeterObserved='1';
      new MutationObserver(sync).observe(main,{childList:true,characterData:true,subtree:true});
    }
    sync();
  }
  install();
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  [500,1200,2500,5000].forEach(ms=>setTimeout(install,ms));
})();
