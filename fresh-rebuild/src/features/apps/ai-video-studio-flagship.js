import { aiModel, downloadBlob, fileToInline, openSecure, safeName } from './premium-studio-core.js';

const STYLE_ID = 'nx-video-flagship-v1';
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
    .nx-video-toolbar{min-height:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(46px,1fr);gap:6px;overflow:hidden}
    .nx-video-tool{min-width:0;display:grid;place-items:center;gap:2px;padding:4px;border:1px solid #e8e1f0;border-radius:12px;background:#fff;color:#403949;box-shadow:0 4px 13px rgba(72,48,109,.05);font-size:10px;font-weight:800}
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
    .nx-video-bottom{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center}.nx-video-export{height:46px}.nx-video-add{height:46px;padding:0 14px;border-radius:13px}
    .nx-video-hidden{display:none!important}
    @media(max-width:390px){.nx-video-flagship{grid-template-rows:minmax(205px,37%) minmax(120px,23%) minmax(0,1fr) auto;gap:6px;padding:6px}.nx-video-tool{font-size:9px}.nx-video-tool b{font-size:15px}.nx-video-clip{height:61px}.nx-video-cliprow{grid-auto-columns:minmax(100px,1fr)}.nx-video-inspector{padding:6px}}
    @media(max-height:720px){.nx-video-flagship{grid-template-rows:minmax(170px,36%) minmax(108px,23%) minmax(0,1fr) auto}.nx-screen:has(.nx-video-flagship) .nx-app-head{height:58px!important;min-height:58px!important}.nx-screen:has(.nx-video-flagship)>[data-app-mount]{height:calc(100% - 62px)!important}.nx-video-clip{height:56px}.nx-video-tool{font-size:8px}.nx-video-tool b{font-size:14px}}
    @media(prefers-reduced-motion:reduce){.nx-video-play{transition:none}}
  `;
  document.head.appendChild(style);
}

function uid(prefix='v'){ return prefix + Math.random().toString(36).slice(2,9); }
function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function clamp(n,a,b){ return Math.min(b,Math.max(a,n)); }

export function renderAiVideoStudio(){
  ensureVideoFlagshipStyles();

  const root=document.createElement('div');
  root.className='nx-app-body nx-video-flagship';
  root.innerHTML=`
    <section class="nx-video-preview" data-preview>
      <div class="nx-video-empty" data-empty><b>CREATE YOUR VIDEO</b><span>Add videos or photos. Everything here is designed for fast, touch-first editing.</span></div>
      <video playsinline preload="metadata" class="nx-video-hidden" data-main-video></video>
      <img class="nx-video-hidden" data-main-image alt="">
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
      <button type="button" class="nx-video-tool" data-tool="canvas"><b>▣</b><span>Canvas</span></button>
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
    text:root.querySelector('[data-text]'),
    aiOut:root.querySelector('[data-ai-output]'),
    ratio:root.querySelector('[data-ratio]'),
    bg:root.querySelector('[data-bg]'),
    fps:root.querySelector('[data-fps]'),
    quality:root.querySelector('[data-quality]'),
    exportNote:root.querySelector('[data-export-note]'),
    file:root.querySelector('[data-file]')
  };

  const state={
    clips:[],
    selectedId:null,
    urls:new Map(),
    undo:[],
    redo:[],
    panel:'edit',
    playhead:0,
    projectName:'Untitled project',
    exportBusy:false,
    stopExport:null
  };

  function snapshot(){
    return JSON.parse(JSON.stringify(state.clips.map(c=>({
      ...c, file:null, sourceUrl:null
    }))));
  }
  function pushUndo(){
    state.undo.push(snapshot());
    if(state.undo.length>50)state.undo.shift();
    state.redo.length=0;
  }
  function restoreSnap(snap){
    if(!Array.isArray(snap))return;
    state.clips=snap.map(c=>({...c}));
    state.selectedId=state.clips[0]?.id||null;
    render();
    selectClip(state.selectedId);
  }
  function fmt(sec){
    sec=Math.max(0,Number(sec)||0);
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return m+':'+String(s).padStart(2,'0');
  }
  function clipDuration(c){ return Math.max(.05,(Number(c.out)-Number(c.in))/Math.max(.05,Number(c.speed)||1)); }
  function totalDuration(){ return state.clips.reduce((sum,c)=>sum+clipDuration(c),0); }
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
    if(!c){ els.video.classList.add('nx-video-hidden'); els.image.classList.add('nx-video-hidden'); els.empty.classList.remove('nx-video-hidden'); els.play.classList.add('nx-video-hidden'); return; }
    els.empty.classList.add('nx-video-hidden');
    els.play.classList.remove('nx-video-hidden');
    const url=state.urls.get(c.id);
    if(c.kind==='image'){
      els.video.classList.add('nx-video-hidden');
      els.image.classList.remove('nx-video-hidden');
      els.image.src=url||'';
      els.image.style.filter=cssFilter(c);
      els.image.style.background=els.bg.value;
      return;
    }
    els.image.classList.add('nx-video-hidden');
    els.video.classList.remove('nx-video-hidden');
    if(url && els.video.src!==url)els.video.src=url;
    els.video.currentTime=clamp(Number(c.in)||0,0,Math.max(0,(Number(c.out)||DEFAULT_DUR)-.001));
    els.video.playbackRate=Number(c.speed)||1;
    els.video.volume=clamp(Number(c.volume)||0,0,1);
    els.video.muted=c.muted===true;
    els.video.style.filter=cssFilter(c);
    els.video.style.background=els.bg.value;
  }
  function render(){
    els.clipRow.innerHTML=state.clips.length?state.clips.map((c,i)=>`
      <article class="nx-video-clip${c.id===state.selectedId?' is-active':''}" data-id="${c.id}">
        <button type="button" class="nx-video-thumb" data-select="${c.id}">
          ${c.kind==='image'?'<span>PHOTO</span>':'<span>VIDEO</span>'}
        </button>
        <div class="nx-video-clip-meta"><b>${escapeHtml(c.name)}</b><span>${fmt(clipDuration(c))} • ${c.speed.toFixed(2)}×</span></div>
        <div class="nx-video-reorder"><button type="button" data-up="${c.id}" aria-label="Move clip left">‹</button><button type="button" data-down="${c.id}" aria-label="Move clip right">›</button></div>
      </article>`).join(''):'<div class="nx-video-note">Add your first video or photo to start editing.</div>';
    els.project.textContent=state.projectName;
    els.total.textContent=fmt(totalDuration());
    els.meta.textContent=`${state.clips.length} clip${state.clips.length===1?'':'s'} • ${fmt(totalDuration())}`;
    const c=selected();
    els.selection.textContent=c?c.name:'Nothing selected';
    els.scrub.max=String(totalDuration());
    els.scrub.value=String(clamp(state.playhead,0,totalDuration()));
    if(c){
      els.in.value=Number(c.in).toFixed(1);
      els.out.value=Number(c.out).toFixed(1);
      els.volume.value=String(Number(c.volume)||1);
      els.volumeOut.textContent=Math.round((Number(c.volume)||1)*100)+'%';
      els.speed.value=String(Number(c.speed)||1);
      els.speedOut.textContent=(Number(c.speed)||1).toFixed(2)+'×';
      els.bright.value=String(Number(c.brightness)||1);
      els.brightOut.textContent=Math.round((Number(c.brightness)||1)*100)+'%';
      els.contrast.value=String(Number(c.contrast)||1);
      els.contrastOut.textContent=Math.round((Number(c.contrast)||1)*100)+'%';
      els.saturate.value=String(Number(c.saturate)||1);
      els.saturateOut.textContent=Math.round((Number(c.saturate)||1)*100)+'%';
      els.audioMode.value=c.muted?'mute':'on';
      els.text.value=c.textOverlay||'';
    }
    applyPreview();
  }

  function selectClip(id){
    if(!id)return;
    state.selectedId=id;
    state.playhead=0;
    const c=selected();
    if(c) state.playhead=0;
    render();
  }

  async function addFiles(fileList){
    const files=[...fileList||[]];
    if(!files.length)return;
    pushUndo();
    for(const file of files){
      const isImage=/^image\//i.test(file.type);
      const id=uid('clip');
      const clip={
        id,name:file.name.replace(/\.[^.]+$/,'').slice(0,40)||'Media',
        kind:isImage?'image':'video',file:null,sourceUrl:null,
        in:0,out:isImage?DEFAULT_DUR:0,speed:1,volume:1,muted:false,
        brightness:1,contrast:1,saturate:1,effect:'none',textOverlay:''
      };
      state.clips.push(clip);
      const url=URL.createObjectURL(file);
      state.urls.set(id,url);
      if(!isImage){
        await new Promise(resolve=>{
          const probe=document.createElement('video');
          probe.preload='metadata';probe.src=url;
          probe.onloadedmetadata=()=>{clip.out=Math.max(.1,Number(probe.duration)||DEFAULT_DUR);resolve();};
          probe.onerror=()=>{clip.out=DEFAULT_DUR;resolve();};
        });
      }
    }
    state.selectedId=state.clips[state.clips.length-1]?.id||state.selectedId;
    render();
  }

  function splitSelected(){
    const c=selected(); if(!c)return;
    const d=Math.max(.05,Number(c.out)-Number(c.in));
    const play=Math.max(.05,Math.min(d-.05,state.playhead||d/2));
    if(d<.11)return;
    pushUndo();
    const cut=Number(c.in)+play*(Number(c.speed)||1);
    const a={...c,id:uid('clip'),name:c.name+' A',out:cut};
    const b={...c,id:uid('clip'),name:c.name+' B',in:cut};
    state.urls.set(a.id,state.urls.get(c.id));
    state.urls.set(b.id,state.urls.get(c.id));
    const idx=state.clips.findIndex(x=>x.id===c.id);
    state.clips.splice(idx,1,a,b);
    state.urls.delete(c.id);
    state.selectedId=b.id;
    state.playhead=0;
    render();
  }

  function deleteSelected(){
    const c=selected(); if(!c)return;
    pushUndo();
    state.clips=state.clips.filter(x=>x.id!==c.id);
    const u=state.urls.get(c.id); if(u)URL.revokeObjectURL(u); state.urls.delete(c.id);
    state.selectedId=state.clips[Math.max(0,state.clips.length-1)]?.id||null;
    state.playhead=0;render();
  }

  function duplicateSelected(){
    const c=selected(); if(!c)return;
    pushUndo();
    const copy={...c,id:uid('clip'),name:c.name+' copy'};
    state.urls.set(copy.id,state.urls.get(c.id));
    const idx=state.clips.findIndex(x=>x.id===c.id);
    state.clips.splice(idx+1,0,copy);
    state.selectedId=copy.id;render();
  }

  function moveSelected(delta){
    const idx=state.clips.findIndex(x=>x.id===state.selectedId);
    const next=idx+delta;if(idx<0||next<0||next>=state.clips.length)return;
    pushUndo();[state.clips[idx],state.clips[next]]=[state.clips[next],state.clips[idx]];render();
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
    if(state.exportBusy||!state.clips.length)return;
    state.exportBusy=true;
    setPanel('export');
    els.exportNote.textContent='Rendering locally… keep this screen open until export finishes.';
    const canvas=makeCanvas(),ctx=canvas.getContext('2d');
    const fps=Number(els.fps.value)||30;
    const stream=canvas.captureStream(fps);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'video/webm';
    const recorder=new MediaRecorder(stream,{mimeType:mime});
    const chunks=[];
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    const mediaVideo=document.createElement('video');
    mediaVideo.playsInline=true;mediaVideo.preload='auto';
    let aborted=false;
    state.stopExport=()=>{aborted=true;try{mediaVideo.pause();}catch{}try{recorder.state!=='inactive'&&recorder.stop();}catch{}};
    const drawBackground=()=>{ctx.fillStyle=els.bg.value;ctx.fillRect(0,0,canvas.width,canvas.height);};
    const drawClipText=(text)=>{if(!text)return;ctx.save();ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(18,canvas.height-78,canvas.width-36,52);ctx.fillStyle='#fff';ctx.font=`700 ${Math.max(18,Math.round(canvas.width/28))}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(text).slice(0,120),canvas.width/2,canvas.height-52,canvas.width-54);ctx.restore();};
    const playChunk=async(c)=>{
      const url=state.urls.get(c.id);
      if(!url)return;
      drawBackground();
      if(c.kind==='image'){
        const img=new Image();
        img.src=url;
        await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
        const dur=clipDuration(c),start=performance.now();
        while(performance.now()-start<dur*1000 && !aborted){
          ctx.save();ctx.filter=cssFilter(c);fitDraw(ctx,img,canvas.width,canvas.height);ctx.restore();drawClipText(c.textOverlay);
          await new Promise(requestAnimationFrame);
        }
        return;
      }
      mediaVideo.src=url;
      mediaVideo.playbackRate=Number(c.speed)||1;
      mediaVideo.volume=clamp(Number(c.volume)||1,0,1);mediaVideo.muted=c.muted===true;
      await new Promise((resolve,reject)=>{mediaVideo.onloadedmetadata=()=>resolve();mediaVideo.onerror=()=>reject(new Error('Media could not be loaded.'));});
      await loadSeek(mediaVideo,Math.max(0,Number(c.in)||0));
      const end=Math.min(Number(c.out)||mediaVideo.duration,mediaVideo.duration);
      await mediaVideo.play().catch(()=>{});
      while(mediaVideo.currentTime<end && !mediaVideo.ended && !aborted){
        drawBackground();
        ctx.save();ctx.filter=cssFilter(c);fitDraw(ctx,mediaVideo,canvas.width,canvas.height);ctx.restore();drawClipText(c.textOverlay);
        await new Promise(requestAnimationFrame);
      }
      mediaVideo.pause();
    };
    recorder.onstop=()=>{
      state.exportBusy=false;state.stopExport=null;stream.getTracks().forEach(t=>t.stop());
      if(!aborted&&chunks.length){
        const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
        downloadBlob(blob,`${safeName(state.projectName,'nexusnova-video')}.webm`);
        els.exportNote.textContent='Export complete. Your WebM video was saved locally.';
      }else if(aborted){
        els.exportNote.textContent='Export cancelled.';
      }else{
        els.exportNote.textContent='No output was produced by this browser.';
      }
    };
    try{
      recorder.start(200);
      for(const c of state.clips){if(aborted)break;await playChunk(c);}
      if(!aborted){await new Promise(r=>setTimeout(r,120));recorder.stop();}else{try{recorder.stop();}catch{}}
    }catch(e){
      els.exportNote.textContent='Export stopped: '+String(e?.message||e).slice(0,150);
      state.exportBusy=false;state.stopExport=null;try{recorder.state!=='inactive'&&recorder.stop();}catch{}
    }
  }

  function fitDraw(ctx,source,w,h){
    const sw=source.videoWidth||source.naturalWidth||w, sh=source.videoHeight||source.naturalHeight||h;
    const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale,x=(w-dw)/2,y=(h-dh)/2;
    ctx.drawImage(source,x,y,dw,dh);
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

  els.file.addEventListener('change',()=>{void addFiles(els.file.files);els.file.value='';});
  root.querySelector('[data-add]').addEventListener('click',()=>els.file.click());
  root.querySelector('[data-split]').addEventListener('click',splitSelected);
  root.querySelector('[data-delete]').addEventListener('click',deleteSelected);
  root.querySelector('[data-duplicate]').addEventListener('click',duplicateSelected);
  root.querySelector('[data-reset]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();Object.assign(c,{in:0,out:c.kind==='image'?DEFAULT_DUR:c.sourceDuration||c.out,speed:1,volume:1,muted:false,brightness:1,contrast:1,saturate:1,effect:'none',textOverlay:''});render();});
  root.querySelector('[data-up]').addEventListener?.('click',()=>moveSelected(-1));
  root.querySelector('[data-down]').addEventListener?.('click',()=>moveSelected(1));
  root.querySelector('[data-undo]').addEventListener('click',undo);
  root.querySelector('[data-redo]').addEventListener('click',redo);
  els.play.addEventListener('click',()=>{if(els.video.classList.contains('nx-video-hidden'))return;if(els.video.paused)els.video.play();else els.video.pause();});
  els.video.addEventListener('timeupdate',()=>{const c=selected();if(!c)return;const local=Math.max(0,els.video.currentTime-(Number(c.in)||0))/(Number(c.speed)||1);state.playhead=local;els.current.textContent=fmt(local);els.scrub.value=String(local);if(els.video.currentTime>=(Number(c.out)||0)){els.video.pause();}});
  els.video.addEventListener('play',()=>els.play.textContent='Ⅱ');
  els.video.addEventListener('pause',()=>els.play.textContent='▶');
  els.scrub.addEventListener('input',()=>{const c=selected();if(!c)return;const local=Number(els.scrub.value)||0;state.playhead=local;els.current.textContent=fmt(local);if(c.kind==='video')els.video.currentTime=clamp((Number(c.in)||0)+local*(Number(c.speed)||1),0,Number(c.out)||DEFAULT_DUR);});
  root.querySelector('[data-in]').addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.in=clamp(Number(els.in.value)||0,0,Math.max(0,Number(c.out)-.05));state.playhead=0;render();});
  root.querySelector('[data-out]').addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.out=Math.max(Number(c.in)+.05,Number(els.out.value)||Number(c.out));state.playhead=0;render();});
  els.volume.addEventListener('input',()=>{const c=selected();if(!c)return;c.volume=Number(els.volume.value);els.volumeOut.textContent=Math.round(c.volume*100)+'%';applyPreview();});
  els.audioMode.addEventListener('change',()=>{const c=selected();if(!c)return;pushUndo();c.muted=els.audioMode.value==='mute';applyPreview();});
  els.speed.addEventListener('input',()=>{const c=selected();if(!c)return;c.speed=Number(els.speed.value);els.speedOut.textContent=c.speed.toFixed(2)+'×';if(c.kind==='video')els.video.playbackRate=c.speed;render();});
  root.querySelectorAll('[data-speed-preset]').forEach(b=>b.addEventListener('click',()=>{els.speed.value=b.dataset.speedPreset;els.speed.dispatchEvent(new Event('input'));}));
  els.bright.addEventListener('input',()=>{const c=selected();if(!c)return;c.brightness=Number(els.bright.value);els.brightOut.textContent=Math.round(c.brightness*100)+'%';applyPreview();});
  els.contrast.addEventListener('input',()=>{const c=selected();if(!c)return;c.contrast=Number(els.contrast.value);els.contrastOut.textContent=Math.round(c.contrast*100)+'%';applyPreview();});
  els.saturate.addEventListener('input',()=>{const c=selected();if(!c)return;c.saturate=Number(els.saturate.value);els.saturateOut.textContent=Math.round(c.saturate*100)+'%';applyPreview();});
  root.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>applyLook(b.dataset.look)));
  root.querySelectorAll('[data-effect]').forEach(b=>b.addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.effect=b.dataset.effect;render();}));
  root.querySelector('[data-apply-text]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.textOverlay=els.text.value.trim();render();});
  root.querySelector('[data-clear-text]').addEventListener('click',()=>{const c=selected();if(!c)return;pushUndo();c.textOverlay='';els.text.value='';render();});
  root.querySelector('[data-ratio]').addEventListener('change',()=>{});
  root.querySelector('[data-bg]').addEventListener('change',()=>{applyPreview();});
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
      const blob=await fetch(state.urls.get(c.id)).then(r=>r.blob());
      const data=await fileToInline(blob,8);
      const model=await aiModel('Transcribe only what is spoken in the supplied media. Return concise caption lines with approximate timestamps in SRT format. If speech is unclear, mark [inaudible] rather than inventing words.');
      const res=await model.generateContent([{inlineData:data},{text:'Generate an SRT caption draft for this clip.'}]);
      els.aiOut.value=String(res?.response?.text?.()||'').trim().slice(0,5000);
    }catch(e){els.aiOut.value='Auto captions unavailable: '+String(e?.message||e).slice(0,220);}
  });

  els.clipRow.addEventListener('click',event=>{
    const s=event.target.closest('[data-select]'); if(s){selectClip(s.dataset.select);return;}
    const up=event.target.closest('[data-up]');if(up){state.selectedId=up.dataset.up;moveSelected(-1);return;}
    const down=event.target.closest('[data-down]');if(down){state.selectedId=down.dataset.down;moveSelected(1);return;}
    const card=event.target.closest('[data-id]');if(card)selectClip(card.dataset.id);
  });

  const keydown=event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
    if(event.key==='Delete')deleteSelected();
  };
  window.addEventListener('keydown',keydown);

  render();
  root.__cleanup=()=>{
    state.stopExport?.();
    state.urls.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});
    window.removeEventListener('keydown',keydown);
  };
  return root;
}
