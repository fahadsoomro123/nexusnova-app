const CORE_MODULE = './premium-studio-core.js';

async function getCore(){
  try { return await import(CORE_MODULE); }
  catch (error) { console.warn('[NexusNova Video] optional studio core unavailable:', error); return null; }
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=String(name||'nexusnova-export').replace(/[^a-z0-9._-]+/gi,'-');
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>{try{URL.revokeObjectURL(url)}catch{}},1800);
}
function safeName(value,fallback='nexusnova'){
  return (String(value||fallback).replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||fallback).slice(0,80);
}
function fileToInline(file,maxMb=15){
  if(!file) return Promise.reject(new Error('Choose a file first.'));
  if(file.size>maxMb*1024*1024) return Promise.reject(new Error(`File must be ${maxMb} MB or smaller.`));
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error||new Error('File read failed.'));
    reader.onload=()=>{
      const value=String(reader.result||''),comma=value.indexOf(',');
      if(comma<0)return reject(new Error('Invalid file data.'));
      resolve({mimeType:file.type||'application/octet-stream',data:value.slice(comma+1)});
    };
    reader.readAsDataURL(file);
  });
}
async function aiModel(systemInstruction){
  const core=await getCore();
  if(!core?.aiModel) throw new Error('AI provider is unavailable.');
  return core.aiModel(systemInstruction);
}

const STYLE_ID = 'nx-video-flagship-v3';
const DEFAULT_DUR = 3;

function ensureVideoFlagshipStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html:has(.nx-video-flagship),body:has(.nx-video-flagship){overflow:hidden!important;overscroll-behavior:none!important}
    .nx-screen:has(.nx-video-flagship){height:calc(100dvh - 82px)!important;max-height:calc(100dvh - 82px)!important;min-height:0!important;overflow:hidden!important;background:#fff!important}
    .nx-screen:has(.nx-video-flagship)>[data-app-mount]{height:calc(100% - 74px)!important;min-height:0!important;overflow:hidden!important;padding-bottom:0!important}
    .nx-screen:has(.nx-video-flagship) .nx-app-head{height:66px!important;min-height:66px!important;margin-bottom:4px!important;box-sizing:border-box!important;overflow:hidden!important;background:#fff!important}
    .nx-screen:has(.nx-video-flagship) .nx-app-head>div>p:last-child{display:none!important}
    .nx-video-flagship{--violet:#6c4cff;--pink:#ef4fb4;--ink:#17141f;--muted:#7d7888;position:relative;display:grid;grid-template-rows:minmax(220px,39%) minmax(128px,23%) minmax(0,1fr) auto;gap:8px;width:100%;height:100%;min-height:0;box-sizing:border-box;padding:7px;border-radius:20px;background:linear-gradient(180deg,#fff,#faf8ff);overflow:hidden;border:1px solid #ebe7f4;box-shadow:0 12px 30px rgba(68,41,120,.08)}
    .nx-video-preview{position:relative;min-height:0;display:grid;place-items:center;overflow:hidden;border-radius:16px;background:#16131c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
    .nx-video-preview video,.nx-video-preview img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#16131c}
    .nx-video-empty{display:grid;place-items:center;gap:7px;color:#fff;text-align:center;padding:20px}.nx-video-empty b{font-size:18px}.nx-video-empty span{font-size:12px;opacity:.78}
    .nx-video-status{position:absolute;left:8px;right:8px;bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:11px;background:rgba(18,14,28,.78);backdrop-filter:blur(8px);color:#fff;font-size:11px}
    .nx-video-overlay-text,.nx-video-overlay-caption{position:absolute;left:12px;right:12px;z-index:3;text-align:center;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.65);pointer-events:none;overflow:hidden;text-overflow:ellipsis;display:none}
    .nx-video-overlay-text.is-visible,.nx-video-overlay-caption.is-visible{display:block}
    .nx-video-overlay-text{top:18px;font-size:clamp(16px,4vw,24px);font-weight:900;letter-spacing:-.02em}
    .nx-video-overlay-caption{bottom:48px;padding:7px 10px;border-radius:10px;background:rgba(12,9,20,.72);font-size:clamp(14px,3.6vw,18px);font-weight:800}
    .nx-video-status strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-video-status span{opacity:.74;white-space:nowrap}
    .nx-video-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56px;height:56px;border:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#fff,#eae4ff);color:#4f39b8;box-shadow:0 12px 32px rgba(0,0,0,.28);font-size:21px;font-weight:900}
    .nx-video-timeline{min-height:0;padding:8px;border:1px solid #e9e3f2;border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(84,55,124,.06)}
    .nx-video-timebar{display:flex;align-items:center;gap:8px;margin-bottom:8px}.nx-video-timebar button{width:42px;height:42px}.nx-video-timebar strong{font-size:12px;color:#282331;min-width:88px;text-align:center}.nx-video-timebar input{flex:1;accent-color:var(--violet)}
    .nx-video-cliprow{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(116px,1fr);gap:6px;overflow:hidden}
    .nx-video-clip{position:relative;min-width:0;height:66px;border:1px solid #e7e0f1;border-radius:11px;background:linear-gradient(180deg,#faf8ff,#f1edf9);display:grid;grid-template-columns:1fr auto;gap:4px;padding:6px;color:#302b3b;text-align:left}
    .nx-video-clip.is-active{border-color:#7d61ff;box-shadow:0 0 0 2px rgba(108,76,255,.14),0 8px 18px rgba(108,76,255,.1)}
    .nx-video-thumb{display:grid;place-items:center;overflow:hidden;border-radius:7px;background:linear-gradient(145deg,#2a2340,#5f48ad);color:#fff;font-weight:900;font-size:12px}
    .nx-video-thumb img,.nx-video-thumb video{width:100%;height:100%;object-fit:cover}
    .nx-video-clip-meta{min-width:0;display:grid;align-content:center;gap:2px}.nx-video-clip-meta b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-video-clip-meta span{font-size:8px;color:#847d91}
    .nx-video-reorder{display:grid;gap:3px}.nx-video-reorder button{width:25px;height:25px;font-size:11px}
    .nx-video-toolbar{min-height:0;display:flex;align-items:stretch;gap:7px;overflow-x:auto;overflow-y:hidden;padding:1px 1px 3px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
    .nx-video-tool{flex:0 0 74px;min-width:74px;height:58px;display:grid;place-items:center;gap:2px;padding:4px;border:1px solid #e8e1f0;border-radius:13px;background:#fff;color:#403949;box-shadow:0 4px 13px rgba(72,48,109,.05);font-size:10px;font-weight:800;scroll-snap-align:start}
    .nx-video-tool b{font-size:17px;line-height:1}.nx-video-tool.is-active{border-color:#a28cff;background:linear-gradient(145deg,#f7f3ff,#efe9ff);color:#5b42c7}
    .nx-video-inspector{min-height:0;overflow:hidden;padding:8px;border:1px solid #e7e0f0;border-radius:15px;background:#fff}
    .nx-video-inspector-head{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:7px}.nx-video-inspector-head strong{font-size:12px;color:#292431}.nx-video-inspector-head span{font-size:9px;color:#7f778d}
    .nx-video-panel{display:none;height:calc(100% - 27px);min-height:0;overflow:hidden}.nx-video-panel.is-active{display:grid}
    .nx-video-grid2{display:grid;grid-template-columns:1fr 1fr;gap:7px;min-height:0}.nx-video-field{display:grid;gap:4px}.nx-video-field span{font-size:9px;font-weight:800;color:#756d82}.nx-video-field input,.nx-video-field select,.nx-video-field textarea{width:100%;box-sizing:border-box;border:1px solid #e2dbea;border-radius:10px;background:#fbfaff;color:#2c2635;padding:8px 9px;font:inherit;font-size:11px}.nx-video-field input,.nx-video-field select{height:38px}.nx-video-field textarea{height:58px;resize:none}
    .nx-video-actions{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.nx-video-actions button{min-width:0;height:42px;border-radius:11px}
    .nx-video-button{border:1px solid #dfd6ec;background:#fff;color:#3a3343;font-weight:850}.nx-video-primary{border-color:transparent;background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;font-weight:900;box-shadow:0 8px 18px rgba(108,76,255,.2)}
    .nx-video-range{display:grid;grid-template-columns:76px 1fr 45px;align-items:center;gap:7px}.nx-video-range span{font-size:10px;font-weight:800;color:#756d82}.nx-video-range output{text-align:right;font-size:10px;color:#5b5365}
    .nx-video-preset-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.nx-video-preset-row button{height:38px;font-size:10px}
    .nx-video-note{padding:7px 8px;border-radius:10px;background:#f7f4fb;color:#6f667b;font-size:9px;line-height:1.35}
    .nx-video-transform-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.nx-video-transform-row button{height:38px}.nx-video-chipset{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .nx-video-bottom{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center}.nx-video-export{height:46px}.nx-video-add{height:46px;padding:0 14px;border-radius:13px}
    .nx-video-hidden{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;border:0!important;padding:0!important}
    .nx-video-caption-list{display:grid;gap:3px;max-height:48px;overflow:hidden;margin-top:5px}.nx-video-caption-row{display:grid;grid-template-columns:36px 36px minmax(0,1fr);gap:4px;font-size:7px;color:#766d80}.nx-video-caption-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    @media(max-width:390px){.nx-video-flagship{grid-template-rows:minmax(205px,37%) minmax(120px,23%) minmax(0,1fr) auto;gap:6px;padding:6px}.nx-video-tool{font-size:9px;flex-basis:68px;min-width:68px}.nx-video-tool b{font-size:15px}.nx-video-clip{height:61px}.nx-video-cliprow{grid-auto-columns:minmax(100px,1fr)}.nx-video-inspector{padding:6px}}
    @media(max-height:720px){.nx-video-flagship{grid-template-rows:minmax(170px,36%) minmax(108px,23%) minmax(0,1fr) auto}.nx-screen:has(.nx-video-flagship) .nx-app-head{height:58px!important;min-height:58px!important}.nx-screen:has(.nx-video-flagship)>[data-app-mount]{height:calc(100% - 62px)!important}.nx-video-clip{height:56px}.nx-video-tool{font-size:8px}.nx-video-tool b{font-size:14px}}
    @media(prefers-reduced-motion:reduce){.nx-video-play{transition:none}}
    /* V2 flagship layout: fit the complete editor in a normal Android viewport. */
    .nx-screen:has(.nx-video-flagship){height:calc(100dvh - 82px)!important;max-height:calc(100dvh - 82px)!important;overflow:hidden!important;background:#fff!important;padding:0!important}
    .nx-screen:has(.nx-video-flagship)>.nx-app-head{height:62px!important;min-height:62px!important;margin:0 0 4px!important;padding:4px 12px 4px 10px!important;border-bottom:1px solid #eee9f5!important}
    .nx-screen:has(.nx-video-flagship)>[data-app-mount]{height:calc(100% - 66px)!important;overflow:hidden!important;padding:0!important}
    .nx-video-flagship{grid-template-rows:minmax(0,1.28fr) minmax(0,.56fr) minmax(0,1fr) minmax(0,.56fr) minmax(0,.56fr)!important;gap:6px!important;padding:6px!important;border:0!important;border-radius:18px!important;box-shadow:none!important;background:#fff!important}
    .nx-video-preview{border-radius:18px!important;background:radial-gradient(circle at 50% 30%,#3e2c64 0,#191520 34%,#0e0b12 100%)!important}
    .nx-video-empty{max-width:88%!important;padding:12px!important;gap:5px!important}
    .nx-video-empty b{font-size:20px!important;letter-spacing:-.02em!important}
    .nx-video-empty span{max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;line-height:1.35!important;font-size:11px!important}
    .nx-video-play{width:58px!important;height:58px!important;background:#fff!important;box-shadow:0 15px 35px rgba(0,0,0,.3)!important}
    .nx-video-status{left:10px!important;right:10px!important;bottom:9px!important;border-radius:12px!important;padding:7px 10px!important}
    .nx-video-timeline{padding:7px!important;border-radius:14px!important;box-shadow:none!important;display:grid!important;grid-template-rows:42px minmax(0,1fr)!important;overflow:hidden!important}
    .nx-video-timebar{gap:6px!important;margin:0!important}
    .nx-video-timebar button{width:38px!important;height:38px!important;border-radius:10px!important}
    .nx-video-timebar strong{min-width:38px!important;font-size:10px!important}
    .nx-video-cliprow{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-flow:unset!important;grid-auto-columns:unset!important;gap:5px!important;overflow:hidden!important}
    .nx-video-clip{height:58px!important;border-radius:10px!important;padding:4px!important;grid-template-columns:minmax(0,1fr) auto!important}
    .nx-video-clip:nth-child(n+5){display:none!important}
    .nx-video-clip-meta b{font-size:9px!important}.nx-video-clip-meta span{font-size:7px!important}
    .nx-video-reorder button{width:21px!important;height:21px!important;font-size:10px!important}
    .nx-video-inspector{padding:7px!important;border-radius:14px!important;box-shadow:none!important;overflow:hidden!important}
    .nx-video-inspector-head{margin-bottom:5px!important}.nx-video-inspector-head strong{font-size:11px!important}.nx-video-inspector-head span{font-size:8px!important}
    .nx-video-panel{height:calc(100% - 23px)!important;overflow:hidden!important}
    .nx-video-grid2{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}
    .nx-video-actions{gap:5px!important}
    .nx-video-actions button{height:34px!important;border-radius:9px!important;font-size:9px!important;padding:0 6px!important}
    .nx-video-field{gap:2px!important}.nx-video-field span{font-size:8px!important}.nx-video-field input,.nx-video-field select,.nx-video-field textarea{padding:5px 7px!important;font-size:9px!important;border-radius:8px!important}
    .nx-video-field input,.nx-video-field select{height:31px!important}.nx-video-field textarea{height:44px!important}
    .nx-video-note{padding:5px 7px!important;font-size:8px!important;line-height:1.25!important;border-radius:8px!important}
    .nx-video-range{grid-template-columns:64px 1fr 38px!important;gap:5px!important}.nx-video-range span{font-size:8px!important}.nx-video-range output{font-size:8px!important}
    .nx-video-preset-row{gap:4px!important}.nx-video-preset-row button{height:31px!important;font-size:8px!important}
    .nx-video-transform-row{gap:5px!important}.nx-video-transform-row button{height:31px!important;font-size:8px!important}
    .nx-video-toolbar{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:5px!important;overflow:hidden!important;padding:0!important}
    .nx-video-tool{min-width:0!important;width:auto!important;height:100%!important;flex:none!important;border-radius:10px!important;font-size:8px!important;box-shadow:0 3px 10px rgba(72,48,109,.05)!important}
    .nx-video-tool b{font-size:14px!important}
    .nx-video-bottom{grid-template-columns:1fr 1fr!important;gap:6px!important}
    .nx-video-add,.nx-video-export{height:100%!important;min-height:0!important;border-radius:12px!important}
    .nx-screen:has(.nx-video-flagship) .nx-app-head h1{font-size:19px!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .nx-screen:has(.nx-video-flagship) .nx-app-head>div{min-width:0!important}
    @media(max-width:390px){
      .nx-video-flagship{grid-template-rows:minmax(0,1.15fr) minmax(0,.52fr) minmax(0,1fr) minmax(0,.58fr) minmax(0,.58fr)!important}
      .nx-video-tool{font-size:7.5px!important}
      .nx-video-tool b{font-size:13px!important}
      .nx-video-clip{height:54px!important}
      .nx-video-inspector{padding:6px!important}
    }
  `;
  document.head.appendChild(style);
}

function uid(prefix='v'){ return prefix + Math.random().toString(36).slice(2,9); }
function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function clamp(n,a,b){ return Math.min(b,Math.max(a,n)); }

function clipDuration(c){ return Math.max(.05,(Number(c.out)-Number(c.in))/Math.max(.05,Number(c.speed)||1)); }
function normalizeImportKind(file){
  const type=String(file?.type||'').toLowerCase();
  if(type.startsWith('image/')) return 'image';
  if(type.startsWith('video/')) return 'video';
  return null;
}
function probeMedia(url,kind,timeout=8000){
  if(kind==='image'){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      const timer=setTimeout(()=>{img.src='';reject(new Error('Image load timed out.'));},timeout);
      img.onload=()=>{clearTimeout(timer);resolve({duration:DEFAULT_DUR,width:img.naturalWidth,height:img.naturalHeight});};
      img.onerror=()=>{clearTimeout(timer);reject(new Error('Image could not be loaded.'));};
      img.src=url;
    });
  }
  return new Promise((resolve,reject)=>{
    const probe=document.createElement('video');
    let settled=false;
    const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);probe.removeAttribute('src');probe.load();error?reject(error):resolve(data);};
    const timer=setTimeout(()=>finish(new Error('Video metadata timed out.')),timeout);
    probe.preload='metadata';
    probe.onloadedmetadata=()=>finish(null,{duration:Math.max(.1,Number(probe.duration)||DEFAULT_DUR),width:probe.videoWidth||0,height:probe.videoHeight||0});
    probe.onerror=()=>finish(new Error('Video could not be loaded.'));
    probe.src=url;
  });
}
function mapTimeline(clips,time){
  let remaining=Math.max(0,Number(time)||0);
  for(let i=0;i<clips.length;i++){
    const c=clips[i],d=clipDuration(c);
    if(remaining<=d || i===clips.length-1) return {clipId:c.id,local:clamp(remaining,0,d),index:i};
    remaining-=d;
  }
  return {clipId:null,local:0,index:-1};
}
function interpolateMotion(c,local){
  const d=Math.max(.05,clipDuration(c)),p=clamp((Number(local)||0)/d,0,1);
  return {
    scale:(Number(c.motionStartScale)||1)+((Number(c.motionEndScale)||1)-(Number(c.motionStartScale)||1))*p,
    rotation:(Number(c.motionStartRotation)||0)+((Number(c.motionEndRotation)||0)-(Number(c.motionStartRotation)||0))*p
  };
}
function currentCaption(c,local){
  return (Array.isArray(c?.captions)?c.captions:[]).find(x=>local>=Number(x.start||0)&&local<=Number(x.end||0))?.text||'';
}
function parseSrt(text){
  return String(text||'').replace(/\r/g,'').split(/\n\s*\n/).map(block=>{
    const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
    const idx=lines.findIndex(x=>x.includes('-->')); if(idx<0)return null;
    const [a,b]=lines[idx].split('-->').map(x=>x.trim());
    const parse=t=>{const m=String(t).match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4].padEnd(3,'0'))/1000:null;};
    const start=parse(a),end=parse(b); if(start==null||end==null)return null;
    const caption=lines.slice(idx+1).join(' ').slice(0,180); return caption?{start,end,text:caption}:null;
  }).filter(Boolean).slice(0,120);
}
const __videoFlagshipTestUtils={clipDuration,mapTimeline,interpolateMotion,parseSrt,normalizeImportKind};


export function renderAiVideoStudio(){
  ensureVideoFlagshipStyles();

  const root=document.createElement('div');
  root.className='nx-app-body nx-video-flagship';
  root.innerHTML=`
    <section class="nx-video-preview" data-preview>
      <div class="nx-video-empty" data-empty><b>CREATE YOUR VIDEO</b><span>Add videos or photos. Everything here is designed for fast, touch-first editing.</span></div>
      <video playsinline preload="metadata" class="nx-video-hidden" data-main-video></video>
      <img class="nx-video-hidden" data-main-image alt="">
      <div class="nx-video-overlay-text" data-preview-text></div>
      <div class="nx-video-overlay-caption" data-preview-caption></div>
      <button type="button" class="nx-video-play nx-video-hidden" data-play aria-label="Play or pause">▶</button>
      <div class="nx-video-status"><strong data-project>Untitled project</strong><span data-meta>0 clips • 00:00</span></div>
    </section>

    <section class="nx-video-timeline">
      <div class="nx-video-timebar">
        <button type="button" class="nx-video-button" data-undo title="Undo">↶</button>
        <button type="button" class="nx-video-button" data-redo title="Redo">↷</button>
        <strong data-current-time>00:00</strong>
        <input type="range" min="0" max="0" value="0" step="0.01" data-scrub aria-label="Timeline position">
        <strong data-total-time>00:00</strong>
      </div>
      <div class="nx-video-cliprow" data-clip-row></div>
    </section>

    <section class="nx-video-inspector">
      <div class="nx-video-inspector-head"><strong data-inspector-title>EDIT</strong><span data-selection>Nothing selected</span></div>

      <div class="nx-video-panel is-active" data-panel="edit">
        <div class="nx-video-grid2">
          <div class="nx-video-actions">
            <button type="button" class="nx-video-button" data-split>✂ SPLIT</button>
            <button type="button" class="nx-video-button" data-duplicate>＋ DUPLICATE</button>
          </div>
          <div class="nx-video-actions">
            <button type="button" class="nx-video-button" data-delete>DELETE</button>
            <button type="button" class="nx-video-button" data-reset>RESET CLIP</button>
          </div>
          <label class="nx-video-field"><span>IN POINT</span><input type="number" min="0" step=".1" data-in></label>
          <label class="nx-video-field"><span>OUT POINT</span><input type="number" min="0" step=".1" data-out></label>
        </div>
        <div class="nx-video-note">Drag the timeline playhead, then split. Move clips with the arrows on each timeline item. All edits stay local until you export.</div>
      </div>

      <div class="nx-video-panel" data-panel="audio">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>VOLUME</span><input type="range" min="0" max="2" step=".01" value="1" data-volume><output data-volume-out>100%</output></label>
          <label class="nx-video-field"><span>AUDIO</span><select data-audio-mode><option value="on">ORIGINAL AUDIO</option><option value="mute">MUTE THIS CLIP</option></select></label>
        </div>
        <div class="nx-video-note">Original audio is preserved where the browser exposes the source media stream. Mute is applied directly to the selected clip.</div>
      </div>

      <div class="nx-video-panel" data-panel="speed">
        <div class="nx-video-range"><span>SPEED</span><input type="range" min=".25" max="3" step=".05" value="1" data-speed><output data-speed-out>1.00×</output></div>
        <div class="nx-video-preset-row" style="margin-top:7px"><button class="nx-video-button" data-speed-preset=".5">0.5×</button><button class="nx-video-button" data-speed-preset="1">1×</button><button class="nx-video-button" data-speed-preset="1.5">1.5×</button><button class="nx-video-button" data-speed-preset="2">2×</button></div>
      </div>

      <div class="nx-video-panel" data-panel="adjust">
        <div class="nx-video-range"><span>BRIGHTNESS</span><input type="range" min=".5" max="1.6" step=".01" value="1" data-bright><output data-bright-out>100%</output></div>
        <div class="nx-video-range"><span>CONTRAST</span><input type="range" min=".5" max="1.8" step=".01" value="1" data-contrast><output data-contrast-out>100%</output></div>
        <div class="nx-video-range"><span>SATURATION</span><input type="range" min="0" max="2.2" step=".01" value="1" data-saturate><output data-saturate-out>100%</output></div>
        <div class="nx-video-preset-row" style="margin-top:7px"><button class="nx-video-button" data-look="clean">CLEAN</button><button class="nx-video-button" data-look="cinema">CINEMA</button><button class="nx-video-button" data-look="vivid">VIVID</button><button class="nx-video-button" data-look="mono">MONO</button></div>
      </div>

      <div class="nx-video-panel" data-panel="text">
        <label class="nx-video-field"><span>TEXT OVERLAY</span><textarea maxlength="180" data-text placeholder="Type a title, hook, caption or callout…"></textarea></label>
        <div class="nx-video-actions" style="margin-top:7px"><button class="nx-video-primary" data-apply-text>ADD TO CURRENT CLIP</button><button class="nx-video-button" data-clear-text>CLEAR</button></div>
      </div>

      <div class="nx-video-panel" data-panel="effects">
        <div class="nx-video-preset-row"><button class="nx-video-button" data-effect="none">NONE</button><button class="nx-video-button" data-effect="soft">SOFT</button><button class="nx-video-button" data-effect="mono">B&W</button><button class="nx-video-button" data-effect="sepia">SEPIA</button></div>
        <div class="nx-video-note" style="margin-top:7px">Effects are preview-safe CSS filters. They are also applied during local canvas export.</div>
      </div>

      <div class="nx-video-panel" data-panel="transform">
        <div class="nx-video-range"><span>SCALE</span><input type="range" min=".5" max="2" step=".01" value="1" data-scale><output data-scale-out>100%</output></div>
        <div class="nx-video-range"><span>ROTATE</span><input type="range" min="-180" max="180" step="1" value="0" data-rotation><output data-rotation-out>0°</output></div>
        <div class="nx-video-transform-row" style="margin-top:7px"><button class="nx-video-button" data-flip="x">FLIP H</button><button class="nx-video-button" data-flip="y">FLIP V</button></div>
        <div class="nx-video-note" style="margin-top:7px">Transform and crop-style framing are previewed locally and included in local export.</div>
      </div>

      <div class="nx-video-panel" data-panel="motion">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>START ZOOM</span><input type="range" min=".5" max="2" step=".01" value="1" data-motion-start-scale></label>
          <label class="nx-video-field"><span>END ZOOM</span><input type="range" min=".5" max="2" step=".01" value="1.08" data-motion-end-scale></label>
          <label class="nx-video-field"><span>START ROTATION</span><input type="number" min="-180" max="180" step="1" value="0" data-motion-start-rotation></label>
          <label class="nx-video-field"><span>END ROTATION</span><input type="number" min="-180" max="180" step="1" value="0" data-motion-end-rotation></label>
        </div><div class="nx-video-note">Local keyframe motion interpolates zoom and rotation and is included in export.</div>
      </div>
      <div class="nx-video-panel" data-panel="transitions">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>TRANSITION</span><select data-transition><option value="cut">CUT</option><option value="fade">FADE</option><option value="flash">FLASH</option></select></label>
          <label class="nx-video-field"><span>DURATION</span><input type="range" min=".1" max=".8" step=".05" value=".25" data-transition-duration><output data-transition-duration-out>0.25s</output></label>
        </div><div class="nx-video-note">Transition choice is stored with the clip and is ready for local composition.</div>
      </div>
      <div class="nx-video-panel" data-panel="captions">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>START</span><input type="number" min="0" step=".1" value="0" data-caption-start></label>
          <label class="nx-video-field"><span>END</span><input type="number" min=".1" step=".1" value="1.5" data-caption-end></label>
        </div>
        <label class="nx-video-field" style="margin-top:5px"><span>CAPTION TEXT</span><textarea maxlength="180" data-caption-text placeholder="Timed caption…"></textarea></label>
        <div class="nx-video-actions" style="margin-top:5px"><button class="nx-video-primary" data-add-caption>ADD CAPTION</button><button class="nx-video-button" data-clear-captions>CLEAR ALL</button></div>
        <div class="nx-video-caption-list" data-caption-list></div>
      </div>
      <div class="nx-video-panel" data-panel="canvas">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>FORMAT</span><select data-ratio><option value="16:9">16:9 LANDSCAPE</option><option value="9:16">9:16 SHORTS</option><option value="1:1">1:1 SQUARE</option><option value="4:5">4:5 SOCIAL</option></select></label>
          <label class="nx-video-field"><span>BACKGROUND</span><select data-bg><option value="#16131c">DARK</option><option value="#ffffff">WHITE</option><option value="#efe9ff">LAVENDER</option></select></label>
        </div>
        <div class="nx-video-note">Designed for Shorts, Reels, TikTok-style vertical video, square posts and landscape exports.</div>
      </div>

      <div class="nx-video-panel" data-panel="ai">
        <div class="nx-video-actions"><button class="nx-video-primary" data-ai-director>AI DIRECTOR</button><button class="nx-video-button" data-ai-captions>AUTO CAPTIONS</button></div>
        <label class="nx-video-field" style="margin-top:7px"><span>AI NOTES / CAPTIONS</span><textarea data-ai-output placeholder="AI output appears here…" maxlength="5000"></textarea></label>
        <div class="nx-video-note">AI uses the selected local media only when you request it. Media sent for AI must fit the provider/browser limits; no fake processing is shown.</div>
      </div>

      <div class="nx-video-panel" data-panel="export">
        <div class="nx-video-grid2">
          <label class="nx-video-field"><span>FPS</span><select data-fps><option>24</option><option selected>30</option><option>60</option></select></label>
          <label class="nx-video-field"><span>QUALITY</span><select data-quality><option value="540">540p FAST</option><option value="720" selected>720p</option><option value="1080">1080p</option></select></label>
        </div>
        <div class="nx-video-note" data-export-note>Browser-native export is WebM. Resolution is capped by the source/device to keep mobile editing responsive.</div>
      </div>
    </section>

    <div class="nx-video-toolbar" aria-label="Video editor tools">
      <button type="button" class="nx-video-tool is-active" data-tool="edit"><b>✂</b><span>Edit</span></button>
      <button type="button" class="nx-video-tool" data-tool="audio"><b>♫</b><span>Audio</span></button>
      <button type="button" class="nx-video-tool" data-tool="speed"><b>↯</b><span>Speed</span></button>
      <button type="button" class="nx-video-tool" data-tool="adjust"><b>◒</b><span>Adjust</span></button>
      <button type="button" class="nx-video-tool" data-tool="text"><b>T</b><span>Text</span></button>
      <button type="button" class="nx-video-tool" data-tool="effects"><b>✦</b><span>Effects</span></button>
      <button type="button" class="nx-video-tool" data-tool="transform"><b>↗</b><span>Transform</span></button>
      <button type="button" class="nx-video-tool" data-tool="canvas"><b>▣</b><span>Canvas</span></button>
      <button type="button" class="nx-video-tool" data-tool="motion"><b>◇</b><span>Motion</span></button>
      <button type="button" class="nx-video-tool" data-tool="transitions"><b>⇄</b><span>Trans</span></button>
      <button type="button" class="nx-video-tool" data-tool="captions"><b>CC</b><span>Captions</span></button>
      <button type="button" class="nx-video-tool" data-tool="ai"><b>AI</b><span>AI Lab</span></button>
    </div>

    <div class="nx-video-bottom">
      <button type="button" class="nx-video-primary nx-video-add" data-add>＋ ADD MEDIA</button>
      <button type="button" class="nx-video-primary nx-video-export" data-open-export>EXPORT VIDEO</button>
      <input class="nx-video-hidden" type="file" accept="video/*,image/*" multiple data-file>
    </div>
  `;

  const els = {
    preview:root.querySelector('[data-preview]'),
    empty:root.querySelector('[data-empty]'),
    video:root.querySelector('[data-main-video]'),
    image:root.querySelector('[data-main-image]'),
    play:root.querySelector('[data-play]'),
    project:root.querySelector('[data-project]'),
    meta:root.querySelector('[data-meta]'),
    previewText:root.querySelector('[data-preview-text]'),
    previewCaption:root.querySelector('[data-preview-caption]'),
    current:root.querySelector('[data-current-time]'),
    total:root.querySelector('[data-total-time]'),
    scrub:root.querySelector('[data-scrub]'),
    clipRow:root.querySelector('[data-clip-row]'),
    selection:root.querySelector('[data-selection]'),
    inspectorTitle:root.querySelector('[data-inspector-title]'),
    in:root.querySelector('[data-in]'),
    out:root.querySelector('[data-out]'),
    volume:root.querySelector('[data-volume]'),
    volumeOut:root.querySelector('[data-volume-out]'),
    audioMode:root.querySelector('[data-audio-mode]'),
    speed:root.querySelector('[data-speed]'),
    speedOut:root.querySelector('[data-speed-out]'),
    bright:root.querySelector('[data-bright]'),
    brightOut:root.querySelector('[data-bright-out]'),
    contrast:root.querySelector('[data-contrast]'),
    contrastOut:root.querySelector('[data-contrast-out]'),
    saturate:root.querySelector('[data-saturate]'),
    saturateOut:root.querySelector('[data-saturate-out]'),
    scale:root.querySelector('[data-scale]'),
    scaleOut:root.querySelector('[data-scale-out]'),
    rotation:root.querySelector('[data-rotation]'),
    rotationOut:root.querySelector('[data-rotation-out]'),
    text:root.querySelector('[data-text]'),
    aiOut:root.querySelector('[data-ai-output]'),
    ratio:root.querySelector('[data-ratio]'),
    bg:root.querySelector('[data-bg]'),
    fps:root.querySelector('[data-fps]'),
    quality:root.querySelector('[data-quality]'),
    exportNote:root.querySelector('[data-export-note]'),
    motionStartScale:root.querySelector('[data-motion-start-scale]'),
    motionEndScale:root.querySelector('[data-motion-end-scale]'),
    motionStartRotation:root.querySelector('[data-motion-start-rotation]'),
    motionEndRotation:root.querySelector('[data-motion-end-rotation]'),
    transition:root.querySelector('[data-transition]'),
    transitionDuration:root.querySelector('[data-transition-duration]'),
    transitionDurationOut:root.querySelector('[data-transition-duration-out]'),
    captionStart:root.querySelector('[data-caption-start]'),
    captionEnd:root.querySelector('[data-caption-end]'),
    captionText:root.querySelector('[data-caption-text]'),
    captionList:root.querySelector('[data-caption-list]'),
    file:root.querySelector('[data-file]')
  };

  const state={
    clips:[],
    selectedId:null,
    urls:new Map(),
    sources:new Map(),
    undo:[],
    redo:[],
    panel:'edit',
    playhead:0,
    timelinePosition:0,
    projectName:'Untitled project',
    exportBusy:false,
    stopExport:null,
    playing:false,
    imageTimer:null
  };

  function snapshot(){
    return {
      clips:JSON.parse(JSON.stringify(state.clips.map(c=>({
        ...c, file:null, sourceUrl:null
      })))),
      selectedId:state.selectedId,
      playhead:state.playhead,
      timelinePosition:state.timelinePosition
    };
  }
  function pushUndo(){
    state.undo.push(snapshot());
    if(state.undo.length>50)state.undo.shift();
    state.redo.length=0;
  }
  function restoreSnap(snap){
    if(!snap || !Array.isArray(snap.clips))return;
    const keep=new Set(snap.clips.map(c=>c.id));
    for(const [id,url] of state.urls){
      if(!keep.has(id)){try{URL.revokeObjectURL(url)}catch{};state.urls.delete(id);}
    }
    state.clips=snap.clips.map(c=>({...c}));
    for(const c of state.clips){
      const source=state.sources.get(c.sourceKey||c.id);
      if(source && !state.urls.has(c.id)){
        state.urls.set(c.id,URL.createObjectURL(source));
      }
    }
    state.selectedId=keep.has(snap.selectedId)?snap.selectedId:(state.clips[0]?.id||null);
    state.playhead=clamp(snap.playhead||0,0,clipDuration(selected()||{in:0,out:0,speed:1}));
    state.timelinePosition=clamp(Number(snap.timelinePosition)||0,0,totalDuration());
    render();
  }
  function fmt(sec){
    sec=Math.max(0,Number(sec)||0);
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return m+':'+String(s).padStart(2,'0');
  }
  function clipDuration(c){ return Math.max(.05,(Number(c.out)-Number(c.in))/Math.max(.05,Number(c.speed)||1)); }
  function totalDuration(){ return state.clips.reduce((sum,c)=>sum+clipDuration(c),0); }
  function clipStartTime(id){
    let sum=0;
    for(const c of state.clips){ if(c.id===id) return sum; sum+=clipDuration(c); }
    return 0;
  }
  function setSelectedLocalTime(local){
    const c=selected();
    state.playhead=clamp(Number(local)||0,c?0:0,c?clipDuration(c):0);
    state.timelinePosition=clamp(clipStartTime(c?.id)+state.playhead,0,totalDuration());
  }
  function selected(){ return state.clips.find(c=>c.id===state.selectedId)||null; }
  function cssFilter(c){
    return [
      `brightness(${Number(c.brightness)||1})`,
      `contrast(${Number(c.contrast)||1})`,
      `saturate(${Number(c.saturate)||1})`,
      c.effect==='mono'?'grayscale(1)':'',
      c.effect==='sepia'?'sepia(1)':'',
      c.effect==='soft'?'blur(.35px)':''
    ].join(' ');
  }
  function applyPreview(){
    const c=selected();
    if(!c){els.video.classList.add('nx-video-hidden');els.image.classList.add('nx-video-hidden');els.empty.classList.remove('nx-video-hidden');els.play.classList.add('nx-video-hidden');els.previewText.classList.remove('is-visible');els.previewCaption.classList.remove('is-visible');return;}
    els.empty.classList.add('nx-video-hidden');
    els.play.classList.remove('nx-video-hidden');
    const url=state.urls.get(c.id);
    const motion=interpolateMotion(c,state.playhead);
    els.previewText.textContent=c.textOverlay||'';
    els.previewText.classList.toggle('is-visible',Boolean(c.textOverlay));
    const liveCaption=currentCaption(c,state.playhead);
    els.previewCaption.textContent=liveCaption;
    els.previewCaption.classList.toggle('is-visible',Boolean(liveCaption));
    if(c.kind==='image'){
      els.video.classList.add('nx-video-hidden');els.image.classList.remove('nx-video-hidden');
      if(els.image.src!==url)els.image.src=url||'';
      els.image.style.filter=cssFilter(c);
      els.image.style.transform=`scale(${motion.scale*(c.flipX?-1:1)},${motion.scale*(c.flipY?-1:1)}) rotate(${motion.rotation}deg)`;
      els.image.style.background=els.bg.value;
      els.play.textContent='▶';
      return;
    }
    els.image.classList.add('nx-video-hidden');els.video.classList.remove('nx-video-hidden');
    if(url&&els.video.src!==url){els.video.src=url;els.video.load();}
    if(Number.isFinite(els.video.duration)){
      const srcTime=clamp((Number(c.in)||0)+state.playhead*(Number(c.speed)||1),Number(c.in)||0,Math.max(Number(c.in)||0,(Number(c.out)||DEFAULT_DUR)-.001));
      if(Math.abs((els.video.currentTime||0)-srcTime)>.05){try{els.video.currentTime=srcTime}catch{}}
    }
    els.video.playbackRate=Number(c.speed)||1;
    els.video.volume=clamp(Number(c.volume)||0,0,1);els.video.muted=c.muted===true;
    els.video.style.filter=cssFilter(c);
    els.video.style.transform=`scale(${motion.scale*(c.flipX?-1:1)},${motion.scale*(c.flipY?-1:1)}) rotate(${motion.rotation}deg)`;
    els.video.style.background=els.bg.value;
  }
  function renderCaptionList(c){
    els.captionList.innerHTML=(c?.captions||[]).slice(-4).map(x=>`<div class="nx-video-caption-row"><b>${fmt(x.start)}</b><b>${fmt(x.end)}</b><span>${escapeHtml(x.text)}</span></div>`).join('');
  }
  function render(){
    els.clipRow.innerHTML=state.clips.length?state.clips.map(c=>`
      <article class="nx-video-clip${c.id===state.selectedId?' is-active':''}" data-id="${c.id}">
        <div class="nx-video-thumb" data-select="${c.id}" role="button" tabindex="0" aria-label="Select ${escapeHtml(c.name)}">
          ${state.urls.get(c.id)?(c.kind==='image'?`<img src="${escapeHtml(state.urls.get(c.id))}" alt="">`:`<video src="${escapeHtml(state.urls.get(c.id))}" muted playsinline preload="metadata"></video>`):(c.kind==='image'?'<span>PHOTO</span>':'<span>VIDEO</span>')}
        </div>
        <div class="nx-video-clip-meta"><b>${escapeHtml(c.name)}</b><span>${fmt(clipDuration(c))} • ${Number(c.speed||1).toFixed(2)}×</span></div>
        <div class="nx-video-reorder"><button type="button" data-up="${c.id}" aria-label="Move clip left">‹</button><button type="button" data-down="${c.id}" aria-label="Move clip right">›</button></div>
      </article>`).join(''):'<div class="nx-video-note">Add your first video or photo to start editing.</div>';
    els.project.textContent=state.projectName;
    els.total.textContent=fmt(totalDuration());
    els.meta.textContent=`${state.clips.length} clip${state.clips.length===1?'':'s'} • ${fmt(totalDuration())}`;
    els.selection.textContent=selected()?.name||'Nothing selected';
    els.current.textContent=fmt(state.timelinePosition);
    els.scrub.max=String(totalDuration());els.scrub.value=String(clamp(state.timelinePosition,0,totalDuration()));
    const c=selected();
    if(c){
      els.in.value=Number(c.in||0).toFixed(1);els.out.value=Number(c.out||DEFAULT_DUR).toFixed(1);
      els.volume.value=String(Number(c.volume)||1);els.volumeOut.textContent=Math.round((Number(c.volume)||1)*100)+'%';
      els.speed.value=String(Number(c.speed)||1);els.speedOut.textContent=(Number(c.speed)||1).toFixed(2)+'×';
      els.bright.value=String(Number(c.brightness)||1);els.brightOut.textContent=Math.round((Number(c.brightness)||1)*100)+'%';
      els.contrast.value=String(Number(c.contrast)||1);els.contrastOut.textContent=Math.round((Number(c.contrast)||1)*100)+'%';
      els.saturate.value=String(Number(c.saturate)||1);els.saturateOut.textContent=Math.round((Number(c.saturate)||1)*100)+'%';
      els.scale.value=String(Number(c.scale)||1);els.scaleOut.textContent=Math.round((Number(c.scale)||1)*100)+'%';
      els.rotation.value=String(Number(c.rotation)||0);els.rotationOut.textContent=(Number(c.rotation)||0)+'°';
      els.audioMode.value=c.muted?'mute':'on';els.text.value=c.textOverlay||'';
      els.motionStartScale.value=String(Number(c.motionStartScale)||1);els.motionEndScale.value=String(Number(c.motionEndScale)||1.08);
      els.motionStartRotation.value=String(Number(c.motionStartRotation)||0);els.motionEndRotation.value=String(Number(c.motionEndRotation)||0);
      els.transition.value=c.transition||'cut';els.transitionDuration.value=String(Number(c.transitionDuration)||.25);els.transitionDurationOut.textContent=(Number(c.transitionDuration)||.25).toFixed(2)+'s';
      els.captionStart.value=String(Number(c.captionDraftStart)||0);els.captionEnd.value=String(Number(c.captionDraftEnd)||Math.min(1.5,clipDuration(c)));renderCaptionList(c);
    }else renderCaptionList(null);
    applyPreview();
  }
  function stopPlayback(){
    state.playing=false;
    if(state.imageTimer){clearInterval(state.imageTimer);state.imageTimer=null;}
    try{els.video.pause()}catch{}
    els.play.textContent='▶';
  }
  function advancePlayback(){
    const idx=state.clips.findIndex(x=>x.id===state.selectedId);
    const next=state.clips[idx+1];
    if(!next){stopPlayback();setSelectedLocalTime(clipDuration(selected())||0);render();return false;}
    state.selectedId=next.id;state.playhead=0;state.timelinePosition=clipStartTime(next.id);render();
    if(next.kind==='image'){
      if(state.imageTimer)clearInterval(state.imageTimer);
      state.imageTimer=setInterval(()=>{
        if(!state.playing)return;
        const c=selected();if(!c){stopPlayback();return;}
        state.playhead=Math.min(clipDuration(c),state.playhead+.05);
        state.timelinePosition=clipStartTime(c.id)+state.playhead;
        els.current.textContent=fmt(state.timelinePosition);els.scrub.value=String(state.timelinePosition);applyPreview();
        if(state.playhead>=clipDuration(c)-.001)advancePlayback();
      },50);
    }else{
      state.playing=true;applyPreview();els.video.play().catch(()=>stopPlayback());
    }
    return true;
  }
  function startPlayback(){
    const c=selected();if(!c)return;
    state.playing=true;
    if(c.kind==='image'){
      if(state.imageTimer)clearInterval(state.imageTimer);
      state.imageTimer=setInterval(()=>{
        if(!state.playing)return;
        const current=selected();if(!current){stopPlayback();return;}
        state.playhead=Math.min(clipDuration(current),state.playhead+.05);
        state.timelinePosition=clipStartTime(current.id)+state.playhead;
        els.current.textContent=fmt(state.timelinePosition);els.scrub.value=String(state.timelinePosition);applyPreview();
        if(state.playhead>=clipDuration(current)-.001)advancePlayback();
      },50);
    }else{
      applyPreview();
      els.video.play().catch(()=>stopPlayback());
    }
  }

  function selectClip(id,local=0){
    if(!id)return;
    if(state.playing)stopPlayback();
    state.selectedId=id;setSelectedLocalTime(local);render();
  }

  async function addFiles(fileList){
    const files=[...fileList||[]],accepted=files.filter(f=>normalizeImportKind(f));
    if(!accepted.length){els.meta.textContent='Choose a supported photo or video file.';return;}
    const imported=[];
    els.meta.textContent='Importing media…';
    for(const file of accepted){
      const kind=normalizeImportKind(file),id=uid('clip'),url=URL.createObjectURL(file);
      try{
        const meta=await probeMedia(url,kind,8000);
        const clip={id,name:String(file.name||'Media').replace(/\.[^.]+$/,'').slice(0,40)||'Media',kind,file:null,sourceUrl:url,sourceKey:id,
          in:0,out:kind==='image'?DEFAULT_DUR:meta.duration,speed:1,volume:1,muted:false,brightness:1,contrast:1,saturate:1,effect:'none',textOverlay:'',scale:1,rotation:0,flipX:false,flipY:false,motionStartScale:1,motionEndScale:1.08,motionStartRotation:0,motionEndRotation:0,transition:'cut',transitionDuration:.25,captions:[]};
        state.sources.set(id,file);state.urls.set(id,url);imported.push(clip);
      }catch(e){try{URL.revokeObjectURL(url)}catch{};els.meta.textContent='Import failed: '+String(e?.message||e).slice(0,100);}
    }
    if(imported.length){pushUndo();state.clips.push(...imported);state.selectedId=imported[imported.length-1].id;state.playhead=0;state.timelinePosition=clipStartTime(state.selectedId);render();}
    else{els.meta.textContent='No media was imported.';}
  }

  function splitSelected(){
    const c=selected(); if(!c)return;
    const d=Math.max(.05,Number(c.out)-Number(c.in));
    const play=Math.max(.05,Math.min(d-.05,Number(state.playhead)||d/2));
    if(d<.11)return;
    pushUndo();
    const cut=Number(c.in)+play*(Number(c.speed)||1);
    const a={...c,id:uid('clip'),name:c.name+' A',out:cut};
    const b={...c,id:uid('clip'),name:c.name+' B',in:cut};
    const source=state.sources.get(c.sourceKey||c.id);
    if(source){
      state.sources.set(a.id,source);state.sources.set(b.id,source);
      state.urls.set(a.id,URL.createObjectURL(source));state.urls.set(b.id,URL.createObjectURL(source));
    }else{
      const sourceUrl=state.urls.get(c.id);state.urls.set(a.id,sourceUrl);state.urls.set(b.id,sourceUrl);
    }
    a.sourceKey=c.sourceKey||c.id;
    b.sourceKey=c.sourceKey||c.id;
    const idx=state.clips.findIndex(x=>x.id===c.id);
    state.clips.splice(idx,1,a,b);
    state.urls.delete(c.id);
    state.selectedId=b.id;
    state.playhead=0;
    state.timelinePosition=clipStartTime(b.id);
    render();
  }

  function deleteSelected(){
    const c=selected(); if(!c)return;
    pushUndo();
    state.clips=state.clips.filter(x=>x.id!==c.id);
    const u=state.urls.get(c.id);
    const shared=state.clips.some(x=>x.id!==c.id&&state.urls.get(x.id)===u);
    if(u&&!shared)try{URL.revokeObjectURL(u)}catch{}
    state.urls.delete(c.id);
    // Keep the source reference alive for Undo/Redo restoration.
    state.selectedId=state.clips[Math.max(0,state.clips.length-1)]?.id||null;
    state.playhead=0;state.timelinePosition=state.selectedId?clipStartTime(state.selectedId):0;render();
  }

  function duplicateSelected(){
    const c=selected(); if(!c)return;
    pushUndo();
    const copy={...c,id:uid('clip'),name:c.name+' copy',captions:Array.isArray(c.captions)?c.captions.map(x=>({...x})):[]};
    copy.sourceKey=c.sourceKey||c.id;
    const source=state.sources.get(copy.sourceKey);
    if(source){
      state.sources.set(copy.id,source);
      state.urls.set(copy.id,URL.createObjectURL(source));
    }else{
      state.urls.set(copy.id,state.urls.get(c.id));
    }
    const idx=state.clips.findIndex(x=>x.id===c.id);
    state.clips.splice(idx+1,0,copy);
    state.selectedId=copy.id;state.playhead=0;state.timelinePosition=clipStartTime(copy.id);render();
  }

  function moveSelected(delta){
    const idx=state.clips.findIndex(x=>x.id===state.selectedId);
    const next=idx+delta;if(idx<0||next<0||next>=state.clips.length)return;
    pushUndo();[state.clips[idx],state.clips[next]]=[state.clips[next],state.clips[idx]];state.timelinePosition=clipStartTime(state.selectedId)+state.playhead;render();
  }

  function applyLook(name){
    const c=selected();if(!c)return;
    pushUndo();
    const p={
      clean:{brightness:1.04,contrast:1.08,saturate:1.04,effect:'none'},
      cinema:{brightness:.92,contrast:1.32,saturate:.86,effect:'none'},
      vivid:{brightness:1.08,contrast:1.18,saturate:1.45,effect:'none'},
      mono:{brightness:1,contrast:1.05,saturate:0,effect:'mono'}
    }[name];
    Object.assign(c,p);render();
  }

  function setPanel(name){
    state.panel=name;
    root.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('is-active',b.dataset.tool===name));
    root.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.panel===name));
    els.inspectorTitle.textContent=name==='ai'?'AI LAB':name.toUpperCase();
  }

  async function loadSeek(video,time){
    return new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(new Error('Seek timed out.')),4000);
      const done=()=>{clearTimeout(t);resolve();};
      video.addEventListener('seeked',done,{once:true});
      try{video.currentTime=time;}catch(e){clearTimeout(t);reject(e);}
    });
  }

  function makeCanvas(){
    const [rw,rh]=String(els.ratio.value).split(':').map(Number);
    const maxW=Number(els.quality.value)||720;
    const width=rw>=rh?maxW:Math.round(maxW*rw/rh);
    const height=Math.round(width*rh/rw);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(240,width);canvas.height=Math.max(240,height);
    return canvas;
  }

  async function exportVideo(){
    if(state.exportBusy){els.exportNote.textContent='Export is already running.';return;}
    if(!state.clips.length){els.exportNote.textContent='Add media before exporting.';return;}
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){els.exportNote.textContent='This Android WebView cannot export video locally.';return;}
    state.exportBusy=true;setPanel('export');els.exportNote.textContent='Rendering locally…';
    const canvas=makeCanvas(),ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx){state.exportBusy=false;els.exportNote.textContent='Canvas export is unavailable.';return;}
    const fps=Number(els.fps.value)||30,stream=canvas.captureStream(fps);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||'video/webm';
    const recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];let aborted=false,audioCtx=null,audioDest=null,audioSource=null,previousFrame=null;
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    const mediaVideo=document.createElement('video');mediaVideo.playsInline=true;mediaVideo.preload='auto';
    stopPlayback();
    state.stopExport=()=>{aborted=true;try{mediaVideo.pause()}catch{}try{recorder.state!=='inactive'&&recorder.stop()}catch{}};
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(AC){audioCtx=new AC();audioDest=audioCtx.createMediaStreamDestination();audioSource=audioCtx.createMediaElementSource(mediaVideo);audioSource.connect(audioDest);audioDest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));await audioCtx.resume?.();}
    }catch{audioCtx=null;audioDest=null;audioSource=null;}
    const drawBackground=()=>{ctx.fillStyle=els.bg.value;ctx.fillRect(0,0,canvas.width,canvas.height);};
    const drawText=(text,y=canvas.height-52,size=Math.max(18,Math.round(canvas.width/28)))=>{
      if(!text)return;ctx.save();ctx.fillStyle='rgba(12,9,20,.72)';ctx.fillRect(18,y-27,canvas.width-36,54);ctx.fillStyle='#fff';ctx.font=`700 ${size}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(text).slice(0,180),canvas.width/2,y,canvas.width-52);ctx.restore();
    };
    const waitMeta=()=>new Promise((resolve,reject)=>{let done=false;const finish=e=>{if(done)return;done=true;clearTimeout(timer);mediaVideo.onloadedmetadata=null;mediaVideo.onerror=null;e?reject(e):resolve();};const timer=setTimeout(()=>finish(new Error('Video metadata timed out.')),8000);mediaVideo.onloadedmetadata=()=>finish();mediaVideo.onerror=()=>finish(new Error('Video could not be decoded.'));});
    const waitSeek=t=>new Promise((resolve,reject)=>{if(Math.abs((mediaVideo.currentTime||0)-t)<.05)return resolve();let done=false;const finish=e=>{if(done)return;done=true;clearTimeout(timer);mediaVideo.removeEventListener('seeked',onSeek);e?reject(e):resolve();};const onSeek=()=>finish();const timer=setTimeout(()=>finish(new Error('Seek timed out.')),5000);mediaVideo.addEventListener('seeked',onSeek,{once:true});try{mediaVideo.currentTime=t}catch(e){finish(e);}});
    const capturePreviousFrame=()=>{
      previousFrame=document.createElement('canvas');previousFrame.width=canvas.width;previousFrame.height=canvas.height;
      previousFrame.getContext('2d').drawImage(canvas,0,0);
    };
    const drawCurrentWithTransition=(clip,local,paint)=>{
      const duration=clipDuration(clip),td=clamp(Number(clip.transitionDuration)||.25,.05,Math.min(.9,duration));
      const hasTransition=previousFrame&&clip.transition&&clip.transition!=='cut'&&local<td;
      if(!hasTransition){paint();return;}
      const progress=clamp(local/td,0,1);
      ctx.save();
      if(clip.transition==='fade'){
        ctx.globalAlpha=1-progress;ctx.drawImage(previousFrame,0,0,canvas.width,canvas.height);
        ctx.globalAlpha=progress;paint();
      }else if(clip.transition==='flash'){
        paint();ctx.fillStyle='rgba(255,255,255,'+String((1-progress)*.72)+')';ctx.fillRect(0,0,canvas.width,canvas.height);
      }else{
        paint();
      }
      ctx.restore();
    };
    const renderClip=async(clip,index)=>{
      const url=state.urls.get(clip.id);if(!url)return;
      const duration=clipDuration(clip);
      if(clip.kind==='image'){
        const img=new Image();img.src=url;await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('Image export load failed.'));});
        const start=performance.now();
        while(!aborted&&performance.now()-start<duration*1000){
          const local=(performance.now()-start)/1000;
          drawBackground();
          drawCurrentWithTransition(clip,local,()=>{ctx.save();ctx.filter=cssFilter(clip);fitDraw(ctx,img,canvas.width,canvas.height,clip,local);ctx.restore();});
          drawText(clip.textOverlay);
          drawText(currentCaption(clip,local),canvas.height-112,Math.max(16,Math.round(canvas.width/34)));
          await new Promise(requestAnimationFrame);
        }
        capturePreviousFrame();
        return;
      }
      mediaVideo.src=url;mediaVideo.load();mediaVideo.playbackRate=Number(clip.speed)||1;mediaVideo.volume=clamp(Number(clip.volume)||1,0,1);mediaVideo.muted=clip.muted===true;
      await waitMeta();
      const startTime=clamp(Number(clip.in)||0,0,Math.max(0,(Number(clip.out)||mediaVideo.duration)-.001));
      await waitSeek(startTime);
      await mediaVideo.play();
      const end=Math.min(Number(clip.out)||mediaVideo.duration,mediaVideo.duration),guardStart=performance.now();
      while(!aborted&&mediaVideo.currentTime<end&&!mediaVideo.ended){
        const local=Math.max(0,(mediaVideo.currentTime-(Number(clip.in)||0))/(Number(clip.speed)||1));
        drawBackground();
        drawCurrentWithTransition(clip,local,()=>{ctx.save();ctx.filter=cssFilter(clip);fitDraw(ctx,mediaVideo,canvas.width,canvas.height,clip,local);ctx.restore();});
        drawText(clip.textOverlay);
        drawText(currentCaption(clip,local),canvas.height-112,Math.max(16,Math.round(canvas.width/34)));
        await new Promise(requestAnimationFrame);
        if(performance.now()-guardStart>(duration+4)*1000)throw new Error('Playback stalled during export.');
      }
      mediaVideo.pause();capturePreviousFrame();
    };
    recorder.onstop=()=>{
      state.exportBusy=false;state.stopExport=null;stream.getTracks().forEach(t=>t.stop());audioCtx?.close?.();
      if(aborted){els.exportNote.textContent='Export cancelled.';return;}
      if(!chunks.length){els.exportNote.textContent='No output was produced.';return;}
      const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});downloadBlob(blob,`${safeName(state.projectName,'nexusnova-video')}.webm`);els.exportNote.textContent='Export complete. WebM saved locally.';
    };
    try{
      recorder.start(200);
      for(let i=0;i<state.clips.length;i++){if(aborted)break;await renderClip(state.clips[i],i);}
      if(recorder.state!=='inactive')recorder.stop();
    }catch(error){
      aborted=true;els.exportNote.textContent='Export failed: '+String(error?.message||error).slice(0,180);
      try{recorder.state!=='inactive'&&recorder.stop()}catch{}
      state.exportBusy=false;state.stopExport=null;audioCtx?.close?.();
    }
  }
  function fitDraw(ctx,source,w,h,c={},local=0){
    const sw=source.videoWidth||source.naturalWidth||w,sh=source.videoHeight||source.naturalHeight||h,motion=interpolateMotion(c,local);
    const fitScale=Math.min(w/sw,h/sh)*(Number(c.scale)||1)*motion.scale,dw=sw*fitScale,dh=sh*fitScale,sx=c.flipX?-1:1,sy=c.flipY?-1:1;
    ctx.save();ctx.translate(w/2,h/2);ctx.rotate((Number(c.rotation||0)+motion.rotation)*Math.PI/180);ctx.scale(sx,sy);ctx.drawImage(source,-dw/2,-dh/2,dw,dh);ctx.restore();
  }

  function undo(){
    if(!state.undo.length)return;
    state.redo.push(snapshot());
    const snap=state.undo.pop();restoreSnap(snap);
  }
  function redo(){
    if(!state.redo.length)return;
    state.undo.push(snapshot());
    const snap=state.redo.pop();restoreSnap(snap);
  }

  const openPicker=()=>{
    try{if(typeof els.file.showPicker==='function'){els.file.showPicker();return;}}catch{}
    try{els.file.click()}catch{els.meta.textContent='Media picker could not be opened.';}
  };
  els.file.addEventListener('change',async()=>{await addFiles(els.file.files);els.file.value='';});
  root.querySelector('[data-add]').addEventListener('click',openPicker);
  root.querySelector('[data-split]').addEventListener('click',splitSelected);
  root.querySelector('[data-delete]').addEventListener('click',deleteSelected);
  root.querySelector('[data-duplicate]').addEventListener('click',duplicateSelected);
  root.querySelector('[data-reset]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();Object.assign(c,{in:0,out:c.kind==='image'?DEFAULT_DUR:c.sourceDuration||c.out,speed:1,volume:1,muted:false,brightness:1,contrast:1,saturate:1,effect:'none',textOverlay:'',scale:1,rotation:0,flipX:false,flipY:false,motionStartScale:1,motionEndScale:1.08,motionStartRotation:0,motionEndRotation:0,transition:'cut',transitionDuration:.25,captions:[]});state.playhead=0;state.timelinePosition=clipStartTime(c.id);render();});
  root.querySelector('[data-undo]').addEventListener('click',undo);
  root.querySelector('[data-redo]').addEventListener('click',redo);
  els.play.addEventListener('click',()=>{if(state.playing)stopPlayback();else startPlayback();});
  els.video.addEventListener('loadedmetadata',()=>{if(selected())applyPreview()});
  els.video.addEventListener('timeupdate',()=>{const c=selected();if(!c||c.kind!=='video')return;state.playhead=clamp((els.video.currentTime-(Number(c.in)||0))/(Number(c.speed)||1),0,clipDuration(c));state.timelinePosition=clipStartTime(c.id)+state.playhead;els.current.textContent=fmt(state.timelinePosition);els.scrub.value=String(state.timelinePosition);applyPreview();if(state.playing&&els.video.currentTime>=(Number(c.out)||0)-.01){els.video.pause();advancePlayback();}});
  els.video.addEventListener('ended',()=>{if(state.playing&&selected()?.kind==='video')advancePlayback();});
  els.video.addEventListener('error',()=>{els.exportNote.textContent='Preview could not decode this video in the current Android WebView.';});
  els.video.addEventListener('play',()=>els.play.textContent='Ⅱ');els.video.addEventListener('pause',()=>els.play.textContent='▶');
  els.scrub.addEventListener('input',()=>{const pos=clamp(Number(els.scrub.value)||0,0,totalDuration());const target=mapTimeline(state.clips,pos);if(target.clipId)selectClip(target.clipId,target.local);});
  root.querySelector('[data-in]').addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.in=clamp(Number(els.in.value)||0,0,Math.max(0,(Number(c.out)||DEFAULT_DUR)-.05));setSelectedLocalTime(0);render();});
  root.querySelector('[data-out]').addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.out=Math.max(Number(c.in)+.05,Number(els.out.value)||Number(c.out));setSelectedLocalTime(clamp(state.playhead,0,clipDuration(c)));render();});
  els.volume.addEventListener('input',()=>{const c=selected();if(!c)return;c.volume=Number(els.volume.value);els.volumeOut.textContent=Math.round(c.volume*100)+'%';applyPreview();});
  els.audioMode.addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.muted=els.audioMode.value==='mute';applyPreview();});
  els.speed.addEventListener('input',()=>{const c=selected();if(!c)return;pushUndo();const local=state.playhead;c.speed=Number(els.speed.value)||1;state.playhead=clamp(local,0,clipDuration(c));state.timelinePosition=clipStartTime(c.id)+state.playhead;els.speedOut.textContent=c.speed.toFixed(2)+'×';applyPreview();});
  root.querySelectorAll('[data-speed-preset]').forEach(b=>b.addEventListener('click',()=>{els.speed.value=b.dataset.speedPreset;els.speed.dispatchEvent(new Event('input'));}));
  const bindRange=(input,output,field,format)=>input.addEventListener('input',()=>{const c=selected();if(!c)return;c[field]=Number(input.value);output.textContent=format(c[field]);applyPreview();});
  bindRange(els.bright,els.brightOut,'brightness',v=>Math.round(v*100)+'%');bindRange(els.contrast,els.contrastOut,'contrast',v=>Math.round(v*100)+'%');bindRange(els.saturate,els.saturateOut,'saturate',v=>Math.round(v*100)+'%');bindRange(els.scale,els.scaleOut,'scale',v=>Math.round(v*100)+'%');bindRange(els.rotation,els.rotationOut,'rotation',v=>v+'°');
  root.querySelectorAll('[data-flip]').forEach(b=>b.addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();if(b.dataset.flip==='x')c.flipX=!c.flipX;else c.flipY=!c.flipY;render();}));
  root.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>applyLook(b.dataset.look)));
  root.querySelectorAll('[data-effect]').forEach(b=>b.addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.effect=b.dataset.effect;render();}));
  root.querySelector('[data-apply-text]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.textOverlay=els.text.value.trim();render();});
  root.querySelector('[data-clear-text]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.textOverlay='';els.text.value='';render();});
  els.ratio.addEventListener('change',()=>render());els.bg.addEventListener('change',()=>applyPreview());
  els.motionStartScale.addEventListener('input',()=>{const c=selected();if(!c)return;c.motionStartScale=Number(els.motionStartScale.value)||1;applyPreview();});
  els.motionEndScale.addEventListener('input',()=>{const c=selected();if(!c)return;c.motionEndScale=Number(els.motionEndScale.value)||1;applyPreview();});
  els.motionStartRotation.addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.motionStartRotation=clamp(Number(els.motionStartRotation.value)||0,-180,180);render();});
  els.motionEndRotation.addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.motionEndRotation=clamp(Number(els.motionEndRotation.value)||0,-180,180);render();});
  els.transition.addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.transition=els.transition.value;render();});
  els.transitionDuration.addEventListener('input',()=>{const c=selected();if(!c)return;c.transitionDuration=Number(els.transitionDuration.value)||.25;els.transitionDurationOut.textContent=c.transitionDuration.toFixed(2)+'s';});
  root.querySelector('[data-add-caption]').addEventListener('click',()=>{const c=selected();if(!c)return;const text=els.captionText.value.trim();if(!text)return;const start=Math.max(0,Number(els.captionStart.value)||0),end=Math.max(start+.1,Number(els.captionEnd.value)||start+.1);pushUndo();c.captions=Array.isArray(c.captions)?c.captions:[];c.captions.push({start,end,text:text.slice(0,180)});c.captions.sort((a,b)=>a.start-b.start);render();});
  root.querySelector('[data-clear-captions]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.captions=[];render();});
  root.querySelector('[data-open-export]').addEventListener('click',()=>exportVideo());
  root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.tool)));

  root.querySelector('[data-ai-director]').addEventListener('click',async()=>{
    const c=selected(); if(!c)return;
    try{
      if(c.kind==='image'){
        const data=await fileToInline(await fetch(state.urls.get(c.id)).then(r=>r.blob()),8);
        const model=await aiModel('You are a concise cinematic video director. Analyze only the provided frame and return practical shot direction: camera motion, subject motion, lighting, lens feel, pacing and realistic production notes. Do not invent objects that are not visible.');
        const res=await model.generateContent([{inlineData:data},{text:`Create a premium video direction for this clip. Existing user text: ${c.textOverlay||'none'}`}]);
        els.aiOut.value=String(res?.response?.text?.()||'').trim().slice(0,5000);
      }else{
        const blob=await fetch(state.urls.get(c.id)).then(r=>r.blob());
        const data=await fileToInline(blob,8);
        const model=await aiModel('You are a concise cinematic video director. Analyze the supplied media conservatively. Return practical edit/generation direction and do not claim to have seen frames you cannot inspect.');
        const res=await model.generateContent([{inlineData:data},{text:'Create a premium video direction for this clip.'}]);
        els.aiOut.value=String(res?.response?.text?.()||'').trim().slice(0,5000);
      }
    }catch(e){els.aiOut.value='AI Director unavailable: '+String(e?.message||e).slice(0,220);}
  });

  root.querySelector('[data-ai-captions]').addEventListener('click',async()=>{
    const c=selected();if(!c||c.kind==='image')return;
    try{
      const blob=await fetch(state.urls.get(c.id)).then(r=>r.blob()),data=await fileToInline(blob,8);
      const model=await aiModel('Transcribe only what is spoken in the supplied media. Return concise caption lines with approximate timestamps in SRT format. If speech is unclear, mark [inaudible] rather than inventing words.');
      const res=await model.generateContent([{inlineData:data},{text:'Generate an SRT caption draft for this clip.'}]);
      const draft=String(res?.response?.text?.()||'').trim().slice(0,5000);els.aiOut.value=draft;
      const parsed=parseSrt(draft);if(parsed.length){pushUndo();c.captions=parsed;render();}
    }catch(e){els.aiOut.value='Auto captions unavailable: '+String(e?.message||e).slice(0,220);}
  });

  els.clipRow.addEventListener('click',event=>{
    const s=event.target.closest('[data-select]'); if(s){selectClip(s.dataset.select);return;}
    const up=event.target.closest('[data-up]');if(up){state.selectedId=up.dataset.up;moveSelected(-1);return;}
    const down=event.target.closest('[data-down]');if(down){state.selectedId=down.dataset.down;moveSelected(1);return;}
    const card=event.target.closest('[data-id]');if(card)selectClip(card.dataset.id);
  });
  els.clipRow.addEventListener('keydown',event=>{
    const s=event.target.closest('[data-select]');
    if(s&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectClip(s.dataset.select);}
  });

  const keydown=event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
    if(event.key==='Delete')deleteSelected();
  };
  window.addEventListener('keydown',keydown);

  render();
  root.__cleanup=()=>{
    stopPlayback();
    state.stopExport?.();
    state.urls.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});
    state.urls.clear();
    state.sources.clear();
    window.removeEventListener('keydown',keydown);
  };
  root.__videoTestUtils=__videoFlagshipTestUtils;
  return root;
}
export { __videoFlagshipTestUtils };
