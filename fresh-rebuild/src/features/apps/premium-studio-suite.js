// OTA release marker: NexusNova Premium Studio six-tool production publish.
import { renderAiPhotoStudio } from './ai-photo-studio-review.js';
import { renderPdfProStudio } from './pdf-pro-studio.js';
import { renderAiTranscribeStudio } from './ai-transcribe-studio.js';
import { renderAiWritingStudio } from './ai-writing-studio.js';
import { renderDigitalSignStudio } from './digital-sign-studio.js';
import { createNovaCutEngine } from './novacut-engine.js';
import { createNovaCutStudioInteractions } from './novacut-studio.js';

function renderNovaCut() {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-novacut-host';
  root.dataset.novacut = 'active';

  root.innerHTML = `
    <section class="nx-novacut" aria-label="NovaCut Video Studio">
      <style>
        .nx-novacut{height:100%;min-height:0;display:grid;grid-template-rows:58px minmax(0,1fr) 82px;background:#0c0c0e;color:#f5f5f7;border:1px solid #2c2c34;border-radius:22px;overflow:hidden;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .nx-novacut__header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:0 12px;background:#18181c;border-bottom:1px solid #2c2c34}
        .nx-novacut__title small{display:block;font-size:7px;font-weight:900;letter-spacing:.16em;color:#6e6e7a}.nx-novacut__title strong{display:block;margin-top:2px;font-size:14px;line-height:1.1}
        .nx-novacut__actions{display:flex;gap:5px}.nx-novacut button{min-width:42px;height:36px;border:1px solid #2c2c34;border-radius:9px;background:#121216;color:#e9e9ef;font:800 8px/1 system-ui;cursor:pointer}.nx-novacut button:hover{border-color:#45a8ff}.nx-novacut__export{min-width:66px!important;border-color:#45a8ff!important;background:#15283a!important}
        .nx-novacut__workspace{min-height:0;display:grid;grid-template-rows:minmax(220px,1fr) minmax(150px,38%);overflow:hidden}
        .nx-novacut__preview{min-height:0;padding:10px;display:grid;place-items:center;background:#0c0c0e}
        .nx-novacut__canvas-wrap{position:relative;width:min(100%,720px);height:100%;min-height:0;display:grid;place-items:center;background:#050507;border:1px solid #2c2c34;border-radius:16px;overflow:hidden}
        .nx-novacut__canvas{display:block;width:100%;height:100%;object-fit:contain;background:#050507}
        .nx-novacut__preview-badge{position:absolute;top:8px;right:8px;padding:5px 7px;border:1px solid #2c2c34;border-radius:7px;background:rgba(12,12,14,.82);font-size:7px;font-weight:900;letter-spacing:.12em;color:#39f59a}
        .nx-novacut__timeline{min-height:0;overflow:auto;scrollbar-width:none;border-top:1px solid #2c2c34;background:#111114;-webkit-overflow-scrolling:touch}.nx-novacut__timeline::-webkit-scrollbar{width:0;height:0}
        .nx-novacut__ruler,.nx-novacut__track{display:grid;grid-template-columns:58px minmax(560px,1fr);min-width:618px}.nx-novacut__ruler{height:25px;border-bottom:1px solid #24242b}.nx-novacut__ruler-label{border-right:1px solid #24242b}.nx-novacut__ticks{background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 36px);position:relative}.nx-novacut__tick{position:absolute;top:7px;left:calc(var(--i)*6.25%);font-size:6px;color:#6e6e7a}
        .nx-novacut__track{min-height:48px;border-bottom:1px solid #24242b}.nx-novacut__label{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 6px;border-right:1px solid #24242b;color:#6e6e7a}.nx-novacut__label b{font-size:6px}.nx-novacut__label span{font-size:7px;font-weight:900;letter-spacing:.08em}.nx-novacut__lane{position:relative;display:flex;align-items:center;gap:4px;padding:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.026) 0 1px,transparent 1px 36px)}
        .nx-novacut__clip{height:38px;min-width:130px;padding:0 8px;border:1px solid #2c2c34;border-radius:7px;background:#1b1b20;color:#dcdce2;display:flex;align-items:center;gap:7px}.nx-novacut__clip.active{border-color:#45a8ff}.nx-novacut__audio{border-color:rgba(57,245,154,.28);background:rgba(57,245,154,.07)}.nx-novacut__text{border-color:rgba(159,124,255,.28);background:rgba(159,124,255,.07)}
        .nx-novacut__wave{flex:1;height:20px;background:repeating-linear-gradient(90deg,#39f59a 0 2px,transparent 2px 6px);opacity:.65}.nx-novacut__clip span{font-size:7px;font-weight:800}.nx-novacut__dock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:7px;border-top:1px solid #2c2c34;background:#18181c}.nx-novacut__dock button{height:54px;background:#121216}.nx-novacut__dock b{display:block;font-size:8px}.nx-novacut__dock span{display:block;margin-top:3px;font-size:6px;color:#6e6e7a}
        .nx-novacut__status{position:absolute;left:12px;bottom:94px;padding:5px 7px;border:1px solid #2c2c34;border-radius:7px;background:rgba(12,12,14,.85);font-size:6px;color:#a7a7b3;pointer-events:none}.nx-novacut__status::before{content:"";display:inline-block;width:5px;height:5px;margin-right:5px;border-radius:50%;background:#39f59a}
        @media(max-width:520px){.nx-novacut{grid-template-rows:54px minmax(0,1fr) 78px;border-radius:18px}.nx-novacut__workspace{grid-template-rows:minmax(180px,48%) minmax(148px,52%)}.nx-novacut__preview{padding:7px}.nx-novacut__dock button{height:52px}.nx-novacut__status{bottom:88px}}
      </style>

      <header class="nx-novacut__header">
        <div class="nx-novacut__title">
          <small>NOVA HUB</small>
          <strong>NovaCut</strong>
        </div>
        <div class="nx-novacut__actions">
          <button type="button" data-action="undo" aria-label="Undo">↶</button>
          <button type="button" data-action="redo" aria-label="Redo">↷</button>
          <button type="button" class="nx-novacut__export" data-action="export" aria-label="Export">Export</button>
        </div>
      </header>

      <section class="nx-novacut__workspace">
        <section class="nx-novacut__preview">
          <div class="nx-novacut__canvas-wrap">
            <canvas class="nx-novacut__canvas" data-role="preview-canvas"></canvas>
            <span class="nx-novacut__preview-badge">READY</span>
          </div>
        </section>

        <section class="nx-novacut__timeline" aria-label="Multi-track timeline">
          <div class="nx-novacut__ruler">
            <div class="nx-novacut__ruler-label"></div>
            <div class="nx-novacut__ticks">
              <span class="nx-novacut__tick" style="--i:0">0s</span>
              <span class="nx-novacut__tick" style="--i:1">1s</span>
              <span class="nx-novacut__tick" style="--i:2">2s</span>
              <span class="nx-novacut__tick" style="--i:3">3s</span>
              <span class="nx-novacut__tick" style="--i:4">4s</span>
              <span class="nx-novacut__tick" style="--i:5">5s</span>
              <span class="nx-novacut__tick" style="--i:6">6s</span>
              <span class="nx-novacut__tick" style="--i:7">7s</span>
              <span class="nx-novacut__tick" style="--i:8">8s</span>
            </div>
          </div>

          <div class="nx-novacut__track">
            <div class="nx-novacut__label"><b>01</b><span>VIDEO</span></div>
            <div class="nx-novacut__lane" data-role="video-lane"></div>
          </div>

          <div class="nx-novacut__track">
            <div class="nx-novacut__label"><b>02</b><span>AUDIO</span></div>
            <div class="nx-novacut__lane" data-role="audio-lane"></div>
          </div>

          <div class="nx-novacut__track">
            <div class="nx-novacut__label"><b>03</b><span>TEXT</span></div>
            <div class="nx-novacut__lane" data-role="text-lane"></div>
          </div>
        </section>
      </section>

      <nav class="nx-novacut__dock" aria-label="NovaCut editing actions">
        <button type="button" data-action="split"><b>Split</b><span>Cut</span></button>
        <button type="button" data-action="audio"><b>Audio</b><span>Inject</span></button>
        <button type="button" data-action="text"><b>Text</b><span>Overlay</span></button>
        <button type="button" data-action="ratio"><b>Ratio</b><span>Preset</span></button>
      </nav>

      <div class="nx-novacut__status" data-role="status">Ready for editing</div>
    </section>`;

  const videoLane = root.querySelector("[data-role='video-lane']");
  const audioLane = root.querySelector("[data-role='audio-lane']");
  const textLane = root.querySelector("[data-role='text-lane']");

  const renderTimeline = (state) => {
    if (!videoLane || !audioLane || !textLane) return;

    videoLane.innerHTML = state.videoTracks.map((clip) =>
      `<button type="button" class="nx-novacut__clip" data-clip-id="${clip.id}" title="Select clip">${clip.id.slice(0,8)} · ${Math.round(clip.duration)}ms</button>`
    ).join("");

    audioLane.innerHTML = state.audioTracks.map((segment) =>
      `<div class="nx-novacut__clip nx-novacut__audio"><span class="nx-novacut__wave"></span><span>Audio</span></div>`
    ).join("");

    textLane.innerHTML = state.textTracks.map((cue) =>
      `<div class="nx-novacut__clip nx-novacut__text"><span>Text</span><span>${cue.text.slice(0,18)}</span></div>`
    ).join("");
  };

  const engine = createNovaCutEngine({ root });
  engine.on("statechange", renderTimeline);
  engine.on("audio", renderTimeline);
  engine.on("text", renderTimeline);
  engine.on("split", renderTimeline);
  engine.on("ratio", ({ ratio }) => {
    const badge = root.querySelector(".nx-novacut__preview-badge");
    if (badge) badge.textContent = ratio;
  });
  engine.on("export:progress", ({ progress }) => {
    const badge = root.querySelector(".nx-novacut__preview-badge");
    if (badge) badge.textContent = `EXPORT ${Math.round(progress * 100)}%`;
  });
  engine.on("export:complete", () => {
    const badge = root.querySelector(".nx-novacut__preview-badge");
    if (badge) badge.textContent = "EXPORTED";
  });
  renderTimeline(engine.getState ? engine.getState() : {
    videoTracks: [],
    audioTracks: [],
    textTracks: []
  });

  root.__novaCutEngine = engine;
  root.__novaCutInteractions = createNovaCutStudioInteractions(root, engine);
  return root;
}

export const premiumStudioRenderers = Object.freeze({
  'ai-photo-studio': renderAiPhotoStudio,
  'ai-video-studio': renderNovaCut,
  'pdf-pro': renderPdfProStudio,
  'ai-transcribe': renderAiTranscribeStudio,
  'ai-writing-pro': renderAiWritingStudio,
  'digital-sign': renderDigitalSignStudio
});
