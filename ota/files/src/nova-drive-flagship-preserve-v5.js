// Nova Drive flagship preserved-art presentation v5.
// Restores the approved Dashboard / Drive History / Vehicle Tracking artwork
// inside the already-approved common viewport shell. No AI-generated visuals.

const DRIVE_ASSET = new URL('../assets/visuals/nova-drive-approved-v7.png', import.meta.url).href;
const TRACKER_ASSET = new URL('../assets/visuals/nova-vehicle-tracking-approved-v2.png', import.meta.url).href;
const HISTORY_PARTS = ['04','05','06','07','08'].map(id => new URL(`../assets/visuals/drive-history-b64/history-s${id}.b64`, import.meta.url).href);
const patched = new WeakSet();

async function b64Image(url){
  try{
    const r = await fetch(url,{cache:'no-store'});
    if(!r.ok) return '';
    const raw = (await r.text()).replace(/\s+/g,'');
    return raw ? `data:image/webp;base64,${raw}` : '';
  }catch{return ''}
}

function installStyle(){
  if(document.querySelector('[data-nxfs-preserve-v5-style]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-nxfs-preserve-v5-style>
    .nxfs-vector-gauge,.nxfs-vector-radar{display:none!important}
    .nxfs-screen.is-active{display:block!important}
    .nxfs-dashboard,.nxfs-history,.nxfs-tracking{position:absolute!important;inset:0!important;overflow:hidden!important;background:#01070d!important}
    .nxfs-preserve-stack{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .nxfs-preserve-section{position:absolute;left:0;right:0;overflow:hidden;background:#020b13}
    .nxfs-preserve-section img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;transform:scale(1.075);filter:saturate(1.08) contrast(1.055) brightness(1.015)}

    .nxfs-dashboard .nxfs-p-main{top:0;height:41%}.nxfs-dashboard .nxfs-p-main img{object-position:center 33%}
    .nxfs-dashboard .nxfs-p-metrics{top:45.333%;height:15%}.nxfs-dashboard .nxfs-p-metrics img{object-position:center 54%}
    .nxfs-dashboard .nxfs-p-analytics{top:64.667%;height:18%}.nxfs-dashboard .nxfs-p-analytics img{object-position:center 68%}
    .nxfs-dashboard .nxfs-p-actions{top:87%;height:13%}.nxfs-dashboard .nxfs-p-actions img{object-position:center 79.5%}
    .nxfs-dashboard>.nxfs-hero{position:absolute!important;z-index:3!important;left:0!important;right:0!important;top:0!important;height:41%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:hidden!important}
    .nxfs-dashboard>.nxfs-hero>.nxfs-hero-art{display:none!important}
    .nxfs-dashboard .nxfs-side-col{top:17%!important;bottom:11%!important;width:22%!important}
    .nxfs-dashboard .nxfs-side-col.left{left:1.8%!important}.nxfs-dashboard .nxfs-side-col.right{right:1.8%!important}
    .nxfs-dashboard .nxfs-glass{background:transparent!important;border:0!important;box-shadow:none!important;padding:4px!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    .nxfs-dashboard .nxfs-glass small{display:none!important}
    .nxfs-dashboard .nxfs-glass b,.nxfs-dashboard .nxfs-glass span{background:rgba(4,17,28,.94)!important;box-shadow:0 0 6px rgba(4,17,28,.92)!important;border-radius:5px!important;padding:2px 4px!important}
    .nxfs-dashboard .nxfs-dot{margin-bottom:2px!important}
    .nxfs-dashboard .nxfs-speed-core{left:35.6%!important;top:24%!important;width:28.8%!important;height:43%!important;transform:none!important;background:radial-gradient(circle,#020b14 0 68%,rgba(2,11,20,.98) 69% 77%,transparent 78%)!important;z-index:5!important}
    .nxfs-dashboard>.nxfs-grid4{position:absolute!important;left:0!important;right:0!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:1.2%!important;padding:0 3.3%!important;z-index:5!important}
    .nxfs-dashboard>.nxfs-grid4:nth-of-type(2){top:45.333%!important;height:15%!important}
    .nxfs-dashboard>.nxfs-grid4:nth-of-type(3){top:64.667%!important;height:18%!important}
    .nxfs-dashboard .nxfs-metric-card,.nxfs-dashboard .nxfs-analytic-card{height:100%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;color:#eefaff!important;position:relative!important}
    .nxfs-dashboard .nxfs-metric-card small,.nxfs-dashboard .nxfs-metric-card em,.nxfs-dashboard .nxfs-analytic-card small{display:none!important}
    .nxfs-dashboard .nxfs-metric-card b,.nxfs-dashboard .nxfs-analytic-card b,.nxfs-dashboard .nxfs-analytic-card em{position:absolute!important;left:50%!important;transform:translateX(-50%)!important;background:#06131f!important;box-shadow:0 0 7px 5px #06131f!important;border-radius:5px!important;white-space:nowrap!important;z-index:6!important}
    .nxfs-dashboard .nxfs-metric-card b{top:39%!important;margin:0!important;font-size:clamp(18px,4.8vw,30px)!important}
    .nxfs-dashboard .nxfs-analytic-card b{top:39%!important;margin:0!important;font-size:clamp(13px,3.2vw,21px)!important}
    .nxfs-dashboard .nxfs-analytic-card em{display:block!important;top:63%!important;margin:0!important;color:#8fb8d3!important;font-size:clamp(7px,1.6vw,10px)!important}
    .nxfs-dashboard .nxfs-analytic-card:after{display:none!important}
    .nxfs-dashboard>.nxfs-actions{position:absolute!important;z-index:6!important;left:0!important;right:0!important;top:87%!important;height:13%!important;display:grid!important;grid-template-columns:1.55fr .95fr!important;gap:2.1%!important;padding:0 2.8%!important}
    .nxfs-dashboard .nxfs-action{height:100%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:transparent!important;text-shadow:none!important}
    .nxfs-dashboard .nxfs-action svg,.nxfs-dashboard .nxfs-action span{opacity:0!important}

    .nxfs-history .nxfs-p-filters{top:0;height:7%}.nxfs-history .nxfs-p-map{top:10.5%;height:29%}.nxfs-history .nxfs-p-metrics{top:43%;height:14%}.nxfs-history .nxfs-p-locations{top:60.5%;height:11%}.nxfs-history .nxfs-p-recent{top:75%;height:25%}
    .nxfs-history .nxfs-preserve-section img{transform:scale(1.035);filter:saturate(1.08) contrast(1.05) brightness(1.015)}
    .nxfs-history>.nxfs-filters{position:absolute!important;left:0!important;right:0!important;top:0!important;height:7%!important;z-index:6!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:1.1%!important;padding:0 1.1%!important}
    .nxfs-history .nxfs-filter{height:100%!important;border-radius:14px!important;border:1px solid rgba(71,184,240,.34)!important;background:linear-gradient(180deg,rgba(5,23,38,.96),rgba(2,12,21,.98))!important;color:#c8e5f6!important;font-weight:900!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important}
    .nxfs-history .nxfs-filter.is-active{color:#fff!important;border-color:#27dcff!important;background:linear-gradient(180deg,#0c75d2,#074887 55%,#052b4c)!important;box-shadow:inset 0 0 16px rgba(80,223,255,.22),0 0 11px rgba(0,174,255,.22)!important}
    .nxfs-history>.nxfs-map{position:absolute!important;z-index:5!important;left:0!important;right:0!important;top:10.5%!important;height:29%!important;min-height:0!important;border:0!important;border-radius:16px!important;overflow:hidden!important;background:rgba(1,12,20,.76)!important;box-shadow:inset 0 0 24px rgba(0,0,0,.58)!important}
    .nxfs-history>.nxfs-map:before{content:"";position:absolute;inset:0;background:rgba(0,8,15,.62);pointer-events:none;z-index:0}
    .nxfs-history>.nxfs-map>*{position:relative;z-index:1}
    .nxfs-history>.nxfs-history-metrics{position:absolute!important;z-index:6!important;left:0!important;right:0!important;top:43%!important;height:14%!important;padding:0 2.8%!important;gap:1.4%!important}
    .nxfs-history .nxfs-history-metric{height:100%!important;background:transparent!important;border:0!important;box-shadow:none!important;display:grid!important;place-content:center!important;padding:0!important}
    .nxfs-history .nxfs-history-metric small{display:none!important}.nxfs-history .nxfs-history-metric b,.nxfs-history .nxfs-history-metric em{background:#06131f!important;box-shadow:0 0 7px 5px #06131f!important;border-radius:5px!important;padding:2px 4px!important}
    .nxfs-history>.nxfs-locations{position:absolute!important;z-index:6!important;left:0!important;right:0!important;top:60.5%!important;height:11%!important;padding:0 2.8%!important;gap:2%!important}
    .nxfs-history .nxfs-location{height:100%!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:6% 8% 2% 18%!important}
    .nxfs-history .nxfs-location small{display:none!important}.nxfs-history .nxfs-location b,.nxfs-history .nxfs-location span{background:#06131f!important;box-shadow:0 0 7px 5px #06131f!important;border-radius:5px!important;padding:2px 4px!important;width:max-content!important;max-width:100%!important}
    .nxfs-history>.nxfs-recent{position:absolute!important;z-index:6!important;left:0!important;right:0!important;top:75%!important;height:25%!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:hidden!important}
    .nxfs-history .nxfs-recent-head{height:24%!important;background:rgba(3,17,28,.92)!important;border:0!important;padding:0 3.5%!important}
    .nxfs-history [data-nxfs-trips]{height:76%!important}.nxfs-history .nxfs-trip{height:33.333%!important;background:rgba(3,17,28,.93)!important;border-top:1px solid rgba(65,160,208,.14)!important;padding:0 3.5%!important;font-size:clamp(8px,1.85vw,12px)!important}

    .nxfs-tracking .nxfs-p-main{top:0;height:61%}.nxfs-tracking .nxfs-p-main img{object-position:center 37%}
    .nxfs-tracking .nxfs-p-cards{top:63%;height:16%}.nxfs-tracking .nxfs-p-cards img{object-position:center 62%}
    .nxfs-tracking .nxfs-p-actions{top:81%;height:19%}.nxfs-tracking .nxfs-p-actions img{object-position:center 73.5%}
    .nxfs-tracking>.nxfs-hero{position:absolute!important;z-index:3!important;left:0!important;right:0!important;top:0!important;height:61%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:hidden!important}
    .nxfs-tracking>.nxfs-hero>.nxfs-hero-art{display:none!important}
    .nxfs-tracking .nxfs-track-side{top:9%!important;bottom:7%!important;width:20.7%!important;z-index:5!important}.nxfs-tracking .nxfs-track-side.left{left:1.1%!important}.nxfs-tracking .nxfs-track-side.right{right:1.1%!important}
    .nxfs-tracking .nxfs-track-card{background:transparent!important;border:0!important;box-shadow:none!important;padding:3px!important}.nxfs-tracking .nxfs-track-card small,.nxfs-tracking .nxfs-track-card span{display:none!important}.nxfs-tracking .nxfs-track-card b{background:#06131f!important;box-shadow:0 0 7px 5px #06131f!important;border-radius:5px!important;padding:2px 4px!important}
    .nxfs-tracking .nxfs-track-status{top:3.6%!important;left:65%!important;right:4.5%!important;height:7.2%!important;background:rgba(3,22,29,.94)!important;z-index:6!important}
    .nxfs-tracking>.nxfs-track-cards{position:absolute!important;z-index:6!important;left:0!important;right:0!important;top:63%!important;height:16%!important;padding:0 2.8%!important;gap:2%!important}
    .nxfs-tracking .nxfs-track-wide{height:100%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0 8%!important}.nxfs-tracking .nxfs-track-wide small,.nxfs-tracking .nxfs-track-wide>span{display:none!important}.nxfs-tracking .nxfs-track-wide b{background:#06131f!important;box-shadow:0 0 7px 5px #06131f!important;border-radius:5px!important;padding:2px 4px!important}
    .nxfs-tracking>.nxfs-health{display:none!important}
    .nxfs-tracking>.nxfs-track-actions{position:absolute!important;z-index:7!important;left:0!important;right:0!important;top:81%!important;height:19%!important;padding:0 2.5%!important;gap:1.8%!important}
    .nxfs-tracking .nxfs-track-action{height:100%!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:transparent!important;text-shadow:none!important}.nxfs-tracking .nxfs-track-action svg,.nxfs-tracking .nxfs-track-action span{opacity:0!important}

    .nxfs-brand{background:linear-gradient(180deg,#0b2b3f,#051622)!important;border:1.5px solid #1ccaf0!important}
  </style>`);
}

function addImgSection(parent, cls, src){
  const d=document.createElement('div');d.className=`nxfs-preserve-section ${cls}`;
  const img=document.createElement('img');img.alt='';img.decoding='async';img.src=src;d.appendChild(img);parent.appendChild(d);return d;
}

async function patch(shell){
  if(!(shell instanceof HTMLElement)||patched.has(shell)) return;
  patched.add(shell);installStyle();
  const dash=shell.querySelector('[data-nxfs-screen="dashboard"]');
  const hist=shell.querySelector('[data-nxfs-screen="history"]');
  const track=shell.querySelector('[data-nxfs-screen="tracking"]');
  if(!dash||!hist||!track) return;

  const dStack=document.createElement('div');dStack.className='nxfs-preserve-stack';
  addImgSection(dStack,'nxfs-p-main',DRIVE_ASSET);addImgSection(dStack,'nxfs-p-metrics',DRIVE_ASSET);addImgSection(dStack,'nxfs-p-analytics',DRIVE_ASSET);addImgSection(dStack,'nxfs-p-actions',DRIVE_ASSET);dash.prepend(dStack);

  const tStack=document.createElement('div');tStack.className='nxfs-preserve-stack';
  addImgSection(tStack,'nxfs-p-main',TRACKER_ASSET);addImgSection(tStack,'nxfs-p-cards',TRACKER_ASSET);addImgSection(tStack,'nxfs-p-actions',TRACKER_ASSET);track.prepend(tStack);

  const hStack=document.createElement('div');hStack.className='nxfs-preserve-stack';hist.prepend(hStack);
  const urls=await Promise.all(HISTORY_PARTS.map(b64Image));
  ['nxfs-p-filters','nxfs-p-map','nxfs-p-metrics','nxfs-p-locations','nxfs-p-recent'].forEach((cls,i)=>{if(urls[i])addImgSection(hStack,cls,urls[i]);});

  shell.addEventListener('click',e=>{
    const el=e.target instanceof Element?e.target.closest('[data-nxfs-screen-btn],[data-nxfs-nav]'):null;
    if(!el) return;
    queueMicrotask(()=>{
      const current=shell.querySelector('[data-nxfs-screen].is-active')?.dataset?.nxfsScreen;
      if(current==='history') window.NexusNovaDriveHistory?.open?.('today');
      else window.NexusNovaDriveHistory?.close?.();
    });
  },true);
}

function scan(root=document){
  if(root instanceof HTMLElement){if(root.matches('[data-nxfs-shell]'))patch(root);root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch)}
  else root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch);
}
scan();
new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof HTMLElement)scan(n)}))).observe(document.documentElement,{childList:true,subtree:true});
