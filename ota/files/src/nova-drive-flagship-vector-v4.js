// Nova Drive flagship vector presentation v4.
// No AI/raster hero artwork: Dashboard dial and Tracker radar are scalable DOM/SVG.
// Existing telemetry, history, tracker controls and backend wiring remain untouched.

const patched = new WeakSet();

function installStyle(){
  if(document.querySelector('[data-nxfs-vector-v4-style]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-nxfs-vector-v4-style>
    /* Raster-free flagship hero surfaces: eliminates baked text, phone bezels and
       double-painted telemetry at every device pixel density. */
    .nxfs-dashboard .nxfs-hero-art,
    .nxfs-tracking .nxfs-hero-art{display:none!important}

    .nxfs-dashboard .nxfs-hero{
      background:
        radial-gradient(circle at 50% 48%,rgba(6,77,116,.27),transparent 41%),
        linear-gradient(rgba(27,164,220,.045) 1px,transparent 1px),
        linear-gradient(90deg,rgba(27,164,220,.045) 1px,transparent 1px),
        linear-gradient(180deg,#03121e 0%,#01070c 100%)!important;
      background-size:auto,34px 34px,34px 34px,auto!important;
    }
    .nxfs-vector-gauge{position:absolute;z-index:1;left:50%;top:50%;width:min(53%,330px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;
      background:
        radial-gradient(circle,transparent 0 53%,rgba(13,37,58,.96) 54% 58%,transparent 59%),
        repeating-conic-gradient(from 220deg,rgba(82,226,255,.95) 0deg 1deg,transparent 1deg 8deg),
        conic-gradient(from 220deg,#22e8ff 0deg 118deg,#1678ff 118deg 205deg,#9d45ff 205deg 280deg,rgba(23,77,104,.22) 280deg 360deg);
      box-shadow:0 0 9px rgba(26,224,255,.75),0 0 34px rgba(0,136,255,.28),inset 0 0 28px rgba(29,210,255,.2)}
    .nxfs-vector-gauge:before{content:"";position:absolute;inset:6%;border-radius:50%;background:radial-gradient(circle,#03101a 0 58%,transparent 59%),repeating-conic-gradient(from 220deg,rgba(160,242,255,.42) 0deg .7deg,transparent .7deg 5deg);box-shadow:inset 0 0 22px rgba(0,207,255,.13)}
    .nxfs-vector-gauge:after{content:"";position:absolute;inset:15%;border:1px solid rgba(60,218,255,.25);border-radius:50%;box-shadow:0 0 18px rgba(0,194,255,.12),inset 0 0 25px rgba(40,142,255,.08)}
    .nxfs-gauge-label{position:absolute;z-index:2;color:#edfaff;font:900 clamp(10px,2.1vw,15px)/1 Inter,system-ui;text-shadow:0 0 8px rgba(65,219,255,.45)}
    .nxfs-gauge-label.g0{left:12%;bottom:20%}.nxfs-gauge-label.g40{left:7%;top:42%}.nxfs-gauge-label.g80{left:45%;top:9%}.nxfs-gauge-label.g120{right:5%;top:42%}.nxfs-gauge-label.g160{right:10%;bottom:20%}
    .nxfs-gauge-live{position:absolute;z-index:4;left:50%;bottom:11%;transform:translateX(-50%);padding:4px 10px;border:1px solid rgba(65,255,151,.32);border-radius:999px;background:rgba(1,27,23,.86);color:#49ff9b;font:900 clamp(7px,1.45vw,10px)/1 Inter,system-ui;box-shadow:0 0 12px rgba(50,255,151,.12)}
    .nxfs-dashboard .nxfs-speed-core{z-index:3;left:50%!important;top:50%!important;width:min(27%,168px)!important;height:auto!important;aspect-ratio:1!important;transform:translate(-50%,-50%)!important;background:radial-gradient(circle,#01070c 0 68%,rgba(3,16,27,.99) 69% 78%,transparent 79%)!important}
    .nxfs-dashboard .nxfs-side-col{z-index:5}

    .nxfs-tracking .nxfs-hero{
      background:
        radial-gradient(circle at 50% 49%,rgba(6,86,126,.25),transparent 45%),
        linear-gradient(rgba(26,155,209,.055) 1px,transparent 1px),
        linear-gradient(90deg,rgba(26,155,209,.055) 1px,transparent 1px),
        linear-gradient(180deg,#03131f 0%,#01070c 100%)!important;
      background-size:auto,31px 31px,31px 31px,auto!important;
    }
    .nxfs-vector-radar{position:absolute;z-index:1;left:50%;top:50%;width:min(53%,330px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;border:1px solid rgba(76,224,255,.72);background:radial-gradient(circle,#063054 0,#031727 56%,#010912 100%);box-shadow:0 0 9px rgba(27,220,255,.65),0 0 35px rgba(0,125,255,.25),inset 0 0 32px rgba(0,174,255,.15);pointer-events:none}
    .nxfs-vector-radar svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
    .nxfs-vector-radar .nxfs-radar-ring{fill:none;stroke:#25dfff;stroke-opacity:.31;stroke-width:1.2}
    .nxfs-vector-radar .nxfs-radar-road{fill:none;stroke:#0ba7d8;stroke-opacity:.24;stroke-width:8;stroke-linecap:round}
    .nxfs-vector-radar .nxfs-radar-road.thin{stroke-width:3;stroke-opacity:.20}
    .nxfs-vector-radar .nxfs-radar-cross{stroke:#34dfff;stroke-opacity:.22;stroke-width:1}
    .nxfs-radar-sweep{position:absolute;inset:7%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 300deg,rgba(20,235,255,.02) 316deg,rgba(20,235,255,.2) 350deg,transparent 360deg);animation:nxfsRadarSweep 6s linear infinite;transform-origin:center}
    .nxfs-radar-target{position:absolute;left:50%;top:50%;width:22%;aspect-ratio:1;transform:translate(-50%,-50%);border:1px solid rgba(62,255,148,.85);border-radius:50%;box-shadow:0 0 13px rgba(44,255,143,.55),inset 0 0 13px rgba(44,255,143,.18)}
    .nxfs-radar-target:before{content:"";position:absolute;inset:27%;border-radius:50%;background:#38ff92;box-shadow:0 0 13px #38ff92}
    .nxfs-radar-target:after{content:"LIVE POSITION";position:absolute;left:50%;top:112%;transform:translateX(-50%);white-space:nowrap;color:#62e8ff;font:900 clamp(6px,1.25vw,9px)/1 Inter,system-ui;letter-spacing:.08em}
    @keyframes nxfsRadarSweep{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.nxfs-radar-sweep{animation:none}}
    .nxfs-tracking .nxfs-track-status,.nxfs-tracking .nxfs-track-side{z-index:5}

    /* Opaque glass is the only live data layer; no hidden painted values can bleed. */
    .nxfs-glass,.nxfs-track-card{background:linear-gradient(180deg,#061b2b 0%,#020a12 100%)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  </style>`);
}

function dashboardVector(hero){
  if(hero.querySelector('[data-nxfs-vector-gauge]')) return;
  hero.insertAdjacentHTML('afterbegin', `<div class="nxfs-vector-gauge" data-nxfs-vector-gauge aria-hidden="true"><span class="nxfs-gauge-label g0">0</span><span class="nxfs-gauge-label g40">40</span><span class="nxfs-gauge-label g80">80</span><span class="nxfs-gauge-label g120">120</span><span class="nxfs-gauge-label g160">160</span><i class="nxfs-gauge-live">LIVE</i></div>`);
}

function trackerVector(hero){
  if(hero.querySelector('[data-nxfs-vector-radar]')) return;
  hero.insertAdjacentHTML('afterbegin', `<div class="nxfs-vector-radar" data-nxfs-vector-radar aria-hidden="true"><svg viewBox="0 0 320 320"><circle class="nxfs-radar-ring" cx="160" cy="160" r="135"/><circle class="nxfs-radar-ring" cx="160" cy="160" r="100"/><circle class="nxfs-radar-ring" cx="160" cy="160" r="64"/><path class="nxfs-radar-cross" d="M160 18V302M18 160H302"/><path class="nxfs-radar-road" d="M42 240 C86 211 95 169 137 162 S203 142 278 75"/><path class="nxfs-radar-road thin" d="M58 83 C111 108 121 131 148 163 S210 223 267 250"/><path class="nxfs-radar-road thin" d="M34 187 C87 185 102 196 142 190 S220 159 289 167"/></svg><div class="nxfs-radar-sweep"></div><div class="nxfs-radar-target"></div></div>`);
}

function patch(shell){
  if(!(shell instanceof HTMLElement)||patched.has(shell)) return;
  patched.add(shell);
  installStyle();
  const dashHero=shell.querySelector('.nxfs-dashboard .nxfs-hero');
  const trackHero=shell.querySelector('.nxfs-tracking .nxfs-hero');
  if(dashHero) dashboardVector(dashHero);
  if(trackHero) trackerVector(trackHero);
}

function scan(root=document){
  if(root instanceof HTMLElement){
    if(root.matches('[data-nxfs-shell]')) patch(root);
    root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch);
  }else root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch);
}

scan();
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)scan(node)}))).observe(document.documentElement,{childList:true,subtree:true});
