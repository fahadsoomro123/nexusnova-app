(() => {
  'use strict';
  const ROOT_ID = 'nxd12';
  const STYLE_ID = 'nxd12-style';
  if (window.NexusNovaLuxDayCandidateV12) return;

  const state = { screen: 'dashboard', historyFilter: 'Today', tracking: true };
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];

  const icon = (name) => ({
    car:'🚘', pin:'⌖', route:'↝', clock:'◷', cloud:'☁', shield:'◇', home:'⌂', history:'◴', track:'◎', leaf:'♧', road:'〽'
  }[name] || '•');

  function css(){
    if (document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style'); s.id=STYLE_ID; s.textContent=`
      #${ROOT_ID},#${ROOT_ID} *{box-sizing:border-box}
      #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;overflow:hidden;color:#203346;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:
        radial-gradient(circle at 12% 2%,#ffffff 0 13%,transparent 34%),
        linear-gradient(160deg,#f8f4ec 0%,#eef7fb 46%,#f5f0e7 100%)}
      #${ROOT_ID} .shell{height:100%;display:flex;flex-direction:column;padding:18px 18px 12px;gap:12px}
      #${ROOT_ID} .top{height:74px;flex:0 0 74px;border:1px solid #fff;border-radius:26px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(145deg,#ffffffeb,#f1ede5e8);box-shadow:0 18px 42px #7b899221,0 2px 0 #fff inset}
      #${ROOT_ID} .brand{display:flex;gap:12px;align-items:center}
      #${ROOT_ID} .crest{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:950;font-size:22px;color:#24455e;background:radial-gradient(circle at 35% 28%,#fff,#dbeef5 42%,#c6a86e 100%);border:1px solid #c6a86e88;box-shadow:0 7px 16px #8e75552b}
      #${ROOT_ID} .eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#8e7555;font-weight:900}
      #${ROOT_ID} .title{font-size:23px;line-height:1;font-weight:930;letter-spacing:-.045em;color:#1c3346;margin-top:4px}
      #${ROOT_ID} .topright{text-align:right}.topright strong{font-size:11px;letter-spacing:.12em;color:#3e748c}.topright span{display:block;margin-top:5px;font-size:11px;color:#718594}
      #${ROOT_ID} .content{min-height:0;flex:1;position:relative}
      #${ROOT_ID} .screen{position:absolute;inset:0;overflow:hidden;display:none}
      #${ROOT_ID} .screen.active{display:block}
      #${ROOT_ID} .card{border:1px solid #ffffffd6;background:linear-gradient(150deg,#fffffff2,#f5f1e9e9);box-shadow:0 14px 36px #71859520,0 1px 0 #fff inset;border-radius:28px}
      #${ROOT_ID} .dashboard{height:100%;display:grid;grid-template-rows:1.58fr .56fr .58fr;gap:12px}
      #${ROOT_ID} .cluster{position:relative;overflow:hidden;padding:18px;background:
        linear-gradient(165deg,#fffdf8 0%,#eef8fb 52%,#f0e6d7 100%);border:1px solid #fff;box-shadow:0 18px 42px #6f819427;border-radius:34px}
      #${ROOT_ID} .cluster:before{content:'';position:absolute;left:8%;right:8%;bottom:-14%;height:44%;border-radius:50% 50% 0 0;background:linear-gradient(180deg,#d3e7ef 0%,#b7d1d8 44%,#d9c39f 45%,#eadfca 100%);opacity:.85;transform:perspective(400px) rotateX(55deg);box-shadow:0 -18px 40px #fff9}
      #${ROOT_ID} .clusterbar{position:relative;z-index:4;display:flex;justify-content:space-between;align-items:start}
      #${ROOT_ID} .mode b{display:block;font-size:12px;color:#476477;letter-spacing:.15em}.mode small{display:block;margin-top:5px;color:#889aa7;font-weight:700}
      #${ROOT_ID} .livepill{padding:9px 12px;border-radius:999px;background:#e4f4ed;color:#2d765c;border:1px solid #a9d7c3;font-size:10px;font-weight:950;letter-spacing:.12em}
      #${ROOT_ID} .roadview{position:absolute;left:50%;top:52%;width:72%;height:45%;transform:translate(-50%,-50%);z-index:2}
      #${ROOT_ID} .lane{position:absolute;left:50%;bottom:-6%;width:120px;height:220px;transform:translateX(-50%) perspective(220px) rotateX(56deg);border-left:4px solid #ffffff;border-right:4px solid #ffffff;background:linear-gradient(90deg,#7d929d 0 48%,#fff 48% 52%,#7d929d 52% 100%);box-shadow:0 12px 30px #526b7750;opacity:.8}
      #${ROOT_ID} .speed{position:absolute;z-index:5;left:50%;top:45%;transform:translate(-50%,-50%);text-align:center}
      #${ROOT_ID} .speed .num{font-size:104px;line-height:.82;font-weight:900;letter-spacing:-.08em;color:#16384f;text-shadow:0 2px 0 #fff}
      #${ROOT_ID} .speed .unit{margin-top:13px;font-size:12px;letter-spacing:.28em;font-weight:900;color:#9b7c4f}
      #${ROOT_ID} .arc{position:absolute;z-index:3;left:50%;top:49%;width:340px;height:170px;transform:translate(-50%,-50%);border-radius:180px 180px 0 0;border:14px solid transparent;border-top-color:#4f91aa;border-left-color:#4f91aa;filter:drop-shadow(0 8px 15px #5f91a62f)}
      #${ROOT_ID} .arc:after{content:'';position:absolute;right:-14px;top:-14px;width:72px;height:14px;border-radius:10px;background:#d5a24e;box-shadow:0 4px 12px #d5a24e66}
      #${ROOT_ID} .sideMetric{position:absolute;z-index:6;bottom:20px;min-width:116px;padding:12px 14px;border-radius:19px;background:#fffdf7d9;border:1px solid #fff;box-shadow:0 10px 25px #6f82921f}
      #${ROOT_ID} .sideMetric.left{left:18px}.sideMetric.right{right:18px;text-align:right}.sideMetric small{font-size:9px;letter-spacing:.14em;color:#8e7555;font-weight:900}.sideMetric b{display:block;margin-top:4px;font-size:20px;color:#254c63}.sideMetric span{font-size:10px;color:#77909d}
      #${ROOT_ID} .tripgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      #${ROOT_ID} .trip{padding:16px 14px;display:flex;flex-direction:column;justify-content:space-between}.trip .k{font-size:9px;letter-spacing:.13em;color:#9a805b;font-weight:900}.trip b{font-size:26px;color:#23485d}.trip small{font-size:10px;color:#7d919e}
      #${ROOT_ID} .summary{display:grid;grid-template-columns:1.45fr 1fr;gap:12px}
      #${ROOT_ID} .journey{padding:17px 18px;display:flex;justify-content:space-between;align-items:center}.journey .copy b{font-size:16px}.journey .copy small{display:block;margin-top:5px;color:#7a8d99;font-size:11px}.journey .chev{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#dbeef5;color:#376f88;font-size:20px;border:1px solid #bfdbe5}
      #${ROOT_ID} .eco{padding:16px;text-align:center;background:linear-gradient(145deg,#f6fbf4,#e9f4ea)}.eco b{font-size:26px;color:#4e7a58}.eco small{display:block;color:#729179;margin-top:4px}
      #${ROOT_ID} .history{height:100%;display:grid;grid-template-rows:auto 1.42fr .58fr .7fr;gap:12px}
      #${ROOT_ID} .filters{display:flex;gap:7px;padding:7px;border-radius:999px;background:#ebe7de;border:1px solid #fff}.filters button{flex:1;border:0;border-radius:999px;padding:10px 4px;background:transparent;color:#718492;font-weight:850;font-size:10px}.filters button.on{background:#fff;color:#27536b;box-shadow:0 5px 14px #6d7f8d1f}
      #${ROOT_ID} .map{position:relative;overflow:hidden;background:#e7f2ee;border-color:#fff}
      #${ROOT_ID} .map svg{position:absolute;inset:0;width:100%;height:100%}.map .water{fill:#cce8ef}.map .land{fill:#e9f0db}.map .roadbg{fill:none;stroke:#cad3ce;stroke-width:16;stroke-linecap:round}.map .road{fill:none;stroke:#fff;stroke-width:10;stroke-linecap:round}.map .minor{fill:none;stroke:#f7fbf8;stroke-width:5}.map .routeLine{fill:none;stroke:#3e86a2;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.map .routeGlow{fill:none;stroke:#fff;stroke-width:14;stroke-opacity:.85;stroke-linecap:round}
      #${ROOT_ID} .maplabel{position:absolute;z-index:5;padding:8px 10px;border-radius:14px;background:#fffef8e8;border:1px solid #fff;box-shadow:0 5px 18px #66798528;font-size:10px;font-weight:850}.maplabel.start{left:9%;top:16%}.maplabel.end{right:8%;bottom:17%}.maplabel em{font-style:normal;color:#a27941;margin-right:6px;font-size:9px}
      #${ROOT_ID} .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.stat{padding:13px 8px;text-align:center}.stat b{display:block;font-size:20px;color:#21495f}.stat small{font-size:9px;color:#7f929e;letter-spacing:.05em}
      #${ROOT_ID} .locations{padding:15px 17px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.loc small{font-size:9px;color:#a07f4c;font-weight:900;letter-spacing:.14em}.loc b{display:block;margin-top:5px;font-size:13px;color:#294c61}.loc span{display:block;margin-top:3px;color:#81929d;font-size:10px}
      #${ROOT_ID} .tracking{height:100%;display:grid;grid-template-rows:1.65fr .55fr .55fr;gap:12px}
      #${ROOT_ID} .tracker{position:relative;overflow:hidden;background:#e4f0ea}.tracker .vehicle{position:absolute;z-index:8;left:51%;top:49%;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#fff;border:8px solid #d9a857;box-shadow:0 0 0 15px #d9a85722,0 12px 28px #435f6a32;font-size:24px}.tracker .beam{position:absolute;z-index:3;width:300px;height:300px;left:51%;top:49%;transform:translate(-50%,-50%);border-radius:50%;border:1px dashed #5d9aae66;background:radial-gradient(circle,#ffffff00 0 42%,#7cb1bf10 43% 100%)}
      #${ROOT_ID} .trackerStatus{position:absolute;z-index:9;top:18px;left:18px;right:18px;display:flex;justify-content:space-between}.trackerStatus .chip{padding:9px 12px;border-radius:999px;background:#fffef5e8;border:1px solid #fff;font-size:10px;font-weight:900;color:#426577}.trackerStatus .chip.live{color:#3d775e;background:#effaf2}
      #${ROOT_ID} .vehicleInfo{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}.vehicleCard{padding:16px 18px}.vehicleCard small{font-size:9px;color:#a27e47;letter-spacing:.14em;font-weight:900}.vehicleCard b{display:block;margin-top:6px;font-size:17px;color:#25495d}.vehicleCard span{display:block;margin-top:4px;font-size:10px;color:#7b8e99}
      #${ROOT_ID} .security{padding:14px 17px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(145deg,#fbf7ee,#f2eadb)}.security .shield{width:46px;height:46px;border-radius:18px;display:grid;place-items:center;background:#dfeef1;color:#4d8192;font-size:23px}.security b{font-size:14px}.security small{display:block;color:#86949c;margin-top:4px;font-size:10px}.security button{border:0;border-radius:999px;padding:10px 14px;background:#2e6179;color:white;font-size:10px;font-weight:900}
      #${ROOT_ID} .bottom{height:76px;flex:0 0 76px;border-radius:27px;border:1px solid #fff;background:linear-gradient(145deg,#fffdf8ef,#edf5f6ef);box-shadow:0 -4px 20px #6f82921a,0 12px 34px #66798820;display:grid;grid-template-columns:1fr 1fr 1fr;padding:8px;gap:6px}
      #${ROOT_ID} .nav{border:0;background:transparent;border-radius:21px;color:#7c8e98;font-weight:900;font-size:9px;letter-spacing:.04em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.nav i{font-style:normal;font-size:21px}.nav.on{background:#fff;color:#2f6077;box-shadow:0 7px 18px #72849120}.nav.on i{color:#b68b49}
      @media(max-height:760px){#${ROOT_ID} .shell{padding:10px;gap:8px}#${ROOT_ID} .top{height:60px;flex-basis:60px;border-radius:20px}#${ROOT_ID} .bottom{height:64px;flex-basis:64px}.speed .num{font-size:76px!important}}
    `; document.head.appendChild(s);
  }

  function mapSvg(route=true){ return `<svg viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true">
    <path class="land" d="M0 0h600v500H0z"/><path class="water" d="M-30 420 C100 355 190 390 290 330 S470 240 630 270 L630 520H-30z"/>
    <path class="roadbg" d="M-40 370 C90 330 105 230 210 238 S328 320 390 210 S500 90 640 120"/><path class="road" d="M-40 370 C90 330 105 230 210 238 S328 320 390 210 S500 90 640 120"/>
    <path class="roadbg" d="M0 120 C130 170 180 130 280 190 S450 310 620 285"/><path class="road" d="M0 120 C130 170 180 130 280 190 S450 310 620 285"/>
    <path class="minor" d="M60 0C100 120 135 210 160 330M180 0C200 110 230 180 245 260M320 0C328 90 340 160 345 235M480 0C455 90 430 150 400 210M0 250C120 250 190 270 260 290S430 345 600 340"/>
    ${route?'<path class="routeGlow" d="M92 112 C142 158 195 148 232 202 S312 296 360 250 S428 164 515 132"/><path class="routeLine" d="M92 112 C142 158 195 148 232 202 S312 296 360 250 S428 164 515 132"/>':''}
  </svg>` }

  function html(){
    return `<div class="shell">
      <header class="top"><div class="brand"><div class="crest">N</div><div><div class="eyebrow">NexusNova Mobility</div><div class="title">Nova Drive</div></div></div><div class="topright"><strong>DAYLIGHT TOURING</strong><span>GPS • secure • synced</span></div></header>
      <main class="content">
        <section class="screen active" data-screen="dashboard"><div class="dashboard">
          <div class="cluster"><div class="clusterbar"><div class="mode"><b>TOURING MODE</b><small>Calm • precise • connected</small></div><div class="livepill">● TRACKING ON</div></div><div class="roadview"><div class="lane"></div></div><div class="arc"></div><div class="speed"><div class="num">72</div><div class="unit">KM/H</div></div><div class="sideMetric left"><small>DISTANCE</small><b>18.6</b><span>km today</span></div><div class="sideMetric right"><small>DRIVE TIME</small><b>34</b><span>minutes</span></div></div>
          <div class="tripgrid"><div class="card trip"><div class="k">AVG SPEED</div><b>48</b><small>km/h</small></div><div class="card trip"><div class="k">TOP SPEED</div><b>86</b><small>km/h</small></div><div class="card trip"><div class="k">TRIPS</div><b>3</b><small>completed</small></div></div>
          <div class="summary"><button class="card journey" data-go="history"><div class="copy"><b>Drive History</b><small>Routes, distance & trip details</small></div><div class="chev">›</div></button><div class="card eco"><b>92</b><small>Eco score</small></div></div>
        </div></section>
        <section class="screen" data-screen="history"><div class="history">
          <div class="filters">${['Today','Week','Month','All'].map((x,i)=>`<button class="${i===0?'on':''}" data-filter="${x}">${x}</button>`).join('')}</div>
          <div class="card map">${mapSvg(true)}<div class="maplabel start"><em>START</em>Riverside Park</div><div class="maplabel end"><em>END</em>Nova District</div></div>
          <div class="stats"><div class="card stat"><b data-stat="dist">18.6</b><small>KM</small></div><div class="card stat"><b data-stat="time">34m</b><small>DRIVE</small></div><div class="card stat"><b data-stat="avg">48</b><small>AVG</small></div><div class="card stat"><b data-stat="top">86</b><small>TOP</small></div></div>
          <div class="card locations"><div class="loc"><small>FROM</small><b>Riverside Park</b><span>09:18 • GPS locked</span></div><div class="loc"><small>TO</small><b>Nova District</b><span>09:52 • 18.6 km</span></div></div>
        </div></section>
        <section class="screen" data-screen="tracking"><div class="tracking">
          <div class="card tracker">${mapSvg(false)}<div class="beam"></div><div class="vehicle">🚘</div><div class="trackerStatus"><div class="chip">OWNER VEHICLE</div><div class="chip live" data-track-status>● LIVE</div></div></div>
          <div class="vehicleInfo"><div class="card vehicleCard"><small>VEHICLE</small><b>NexusNova Touring</b><span>Last update: just now</span></div><div class="card vehicleCard"><small>LOCATION</small><b>Nova District</b><span>Accuracy ± 6 m</span></div></div>
          <div class="card security"><div class="shield">◇</div><div><b>Private owner tracking</b><small>Encrypted location access</small></div><button data-toggle-track>PAUSE</button></div>
        </div></section>
      </main>
      <nav class="bottom"><button class="nav on" data-nav="dashboard"><i>${icon('home')}</i>COCKPIT</button><button class="nav" data-nav="history"><i>${icon('history')}</i>HISTORY</button><button class="nav" data-nav="tracking"><i>${icon('track')}</i>TRACKER</button></nav>
    </div>`;
  }

  const metricByFilter={Today:['18.6','34m','48','86'],Week:['126','3h 42','44','93'],Month:['514','14h','46','101'],All:['2.8k','79h','45','108']};
  function setScreen(name){
    state.screen=name;
    qsa(`#${ROOT_ID} [data-screen]`).forEach(x=>x.classList.toggle('active',x.dataset.screen===name));
    qsa(`#${ROOT_ID} [data-nav]`).forEach(x=>x.classList.toggle('on',x.dataset.nav===name));
  }
  function bind(root){
    root.addEventListener('click',e=>{
      const nav=e.target.closest('[data-nav]'); if(nav){setScreen(nav.dataset.nav);return;}
      const go=e.target.closest('[data-go]'); if(go){setScreen(go.dataset.go);return;}
      const f=e.target.closest('[data-filter]'); if(f){state.historyFilter=f.dataset.filter;qsa('[data-filter]',root).forEach(b=>b.classList.toggle('on',b===f));const vals=metricByFilter[state.historyFilter];['dist','time','avg','top'].forEach((k,i)=>{const el=qs(`[data-stat="${k}"]`,root);if(el)el.textContent=vals[i]});return;}
      const t=e.target.closest('[data-toggle-track]'); if(t){state.tracking=!state.tracking;t.textContent=state.tracking?'PAUSE':'RESUME';const st=qs('[data-track-status]',root);st.textContent=state.tracking?'● LIVE':'Ⅱ PAUSED';st.classList.toggle('live',state.tracking);}
    });
  }
  function mount(){css();let root=document.getElementById(ROOT_ID);if(!root){root=document.createElement('div');root.id=ROOT_ID;root.innerHTML=html();document.body.appendChild(root);bind(root);}return root;}
  function show(screen='dashboard'){mount();setScreen(['dashboard','history','tracking'].includes(screen)?screen:'dashboard');}
  function hide(){document.getElementById(ROOT_ID)?.remove();}
  window.NexusNovaLuxDayCandidateV12={show,hide,mount,version:'12-daylight-luxury'};
  if(document.documentElement.dataset.nxLuxdayPreview==='1') setTimeout(()=>show(new URLSearchParams(location.search).get('screen')||'dashboard'),30);
})();