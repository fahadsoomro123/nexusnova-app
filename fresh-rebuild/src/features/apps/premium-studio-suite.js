// OTA release marker: NexusNova Premium Studio six-tool production publish.
import { renderAiPhotoStudio } from './ai-photo-studio-review.js';
import { renderPdfProStudio } from './pdf-pro-studio.js';
import { renderAiTranscribeStudio } from './ai-transcribe-studio.js';
import { renderAiWritingStudio } from './ai-writing-studio.js';
import { renderDigitalSignStudio } from './digital-sign-studio.js';
import { createNovaCutEngine } from './novacut-engine.js';
import { createNovaCutStudioInteractions } from './novacut-studio.js';
import { createNovaCutMediaParser } from './novacut-media.js';
import { STICKER_LIBRARY } from './novacut-visuals.js';
import { createNovaCutVisualEditor } from './novacut-visual-editor.js';

const NOVACUT_CSS = new URL('./novacut-studio.css', import.meta.url).href;

function ensureNovaCutStyles() {
  if (document.querySelector('link[data-novacut-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = NOVACUT_CSS;
  link.dataset.novacutStyles = 'true';
  document.head.appendChild(link);
}

const SVG = Object.freeze({
  media: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="m3 16 5-5 4 4 3-3 6 6"></path><circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none"></circle></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor" stroke="none"></path></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"></path></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H5v4"></path><path d="M5 11c1.9-3.6 6.3-5.2 10.1-3.4 2 .9 3.4 2.8 3.4 5.1 0 3.1-2.5 5.6-5.6 5.6H9"></path></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7h4v4"></path><path d="M19 11c-1.9-3.6-6.3-5.2-10.1-3.4C6.9 8.5 5.5 10.4 5.5 12.7c0 3.1 2.5 5.6 5.6 5.6H15"></path></svg>',
  split: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v5M16 14v5M8 10l8 4M16 14l-5-4"></path><circle cx="8" cy="4" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="16" cy="20" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4M8 8v8M11 5v14M15 8v8M18 10v4"></path></svg>',
  text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v13M9 19h6"></path></svg>',
  ratio: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="M8 15h3M13 9h3"></path></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
  export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10M8 10l4 4 4-4M5 18h14"></path></svg>',
  duplicate: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect><path d="M9 6V4h9a2 2 0 0 1 2 2v9h-2"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 20h10"></path></svg>',
  sticker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 2.5 2H16a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 3-4Z"></path><path d="m8 16 2.5-3 2 2 2.5-3 3 4"></path><circle cx="9" cy="10" r="1"></circle></svg>'
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTrackClip(clip, type) {
  const duration = Math.max(1, Number(clip?.duration) || 1);
  const seconds = duration >= 1000 ? (duration / 1000).toFixed(1) : '0.0';
  const id = escapeHtml(clip?.id || type);
  const selected = clip?.id === clip?.engineActiveId ? ' is-selected' : '';

  if (type === 'video') {
    return `<button type="button" class="nx-novacut__clip nx-novacut__clip--video${selected}" data-clip-id="${id}">
      <span class="nx-novacut__clip-thumb" aria-hidden="true"></span>
      <span class="nx-novacut__clip-copy">
        <strong>Video</strong>
        <small>${seconds}s</small>
      </span>
      <span class="nx-novacut__clip-wave" aria-hidden="true"></span>
    </button>`;
  }

  if (type === 'sticker') {
    const sticker = STICKER_LIBRARY.find((entry) => entry.id === clip?.stickerId) || STICKER_LIBRARY[0];
    return `<button type="button" class="nx-novacut__clip nx-novacut__clip--sticker${selected}" data-clip-id="${id}">
      <span class="nx-novacut__sticker-chip" aria-hidden="true">${escapeHtml(sticker.glyph)}</span>
      <span class="nx-novacut__clip-copy"><strong>${escapeHtml(sticker.name)}</strong><small>${seconds}s</small></span>
    </button>`;
  }

  if (type === 'audio') {
    return `<button type="button" class="nx-novacut__clip nx-novacut__clip--audio" data-clip-id="${id}">
      <span class="nx-novacut__track-icon">${SVG.audio}</span>
      <span class="nx-novacut__clip-copy"><strong>Audio</strong><small>${seconds}s</small></span>
      <span class="nx-novacut__audio-bars" aria-hidden="true"></span>
    </button>`;
  }

  return `<button type="button" class="nx-novacut__clip nx-novacut__clip--text" data-clip-id="${id}">
    <span class="nx-novacut__track-icon">${SVG.text}</span>
    <span class="nx-novacut__clip-copy"><strong>${escapeHtml(clip?.text || 'Text')}</strong><small>${seconds}s</small></span>
  </button>`;
}

function renderNovaCut() {
  ensureNovaCutStyles();

  const root = document.createElement('div');
  root.className = 'nx-app-body nx-novacut-host';
  root.dataset.novacut = 'active';

  root.innerHTML = `
    <section class="nx-novacut nx-novacut--elite" aria-label="NovaCut editor">

      <header class="nx-novacut__header">
        <div class="nx-novacut__project">
          <span class="nx-novacut__brand-mark">N</span>
          <div>
            <span class="nx-novacut__eyebrow">NOVA EDITOR</span>
            <strong>NovaCut</strong>
          </div>
        </div>

        <div class="nx-novacut__top-actions">
          <button type="button" class="nx-novacut__icon-button" data-action="undo" aria-label="Undo">${SVG.undo}</button>
          <button type="button" class="nx-novacut__icon-button" data-action="redo" aria-label="Redo">${SVG.redo}</button>
          <button type="button" class="nx-novacut__icon-button" data-novacut-more aria-label="More options">${SVG.more}</button>
          <button type="button" class="nx-novacut__export-button" data-action="export">
            ${SVG.export}
            <span>Export</span>
          </button>
        </div>
      </header>

      <section class="nx-novacut__canvas-area">
        <div class="nx-novacut__canvas-shell">
          <canvas class="nx-novacut__canvas" data-role="preview-canvas"></canvas>

          <div class="nx-novacut__canvas-empty" data-role="canvas-empty">
            <button type="button" class="nx-novacut__media-drop" data-action="media" aria-label="Add media">
              <span>${SVG.media}</span>
              <strong>Add media</strong>
              <small>Photo, video or audio</small>
            </button>
          </div>

          <div class="nx-novacut__canvas-overlay">
            <span class="nx-novacut__live-dot"></span>
            <span data-role="status">Ready</span>
          </div>
        </div>

        <div class="nx-novacut__transport">
          <span data-role="current-time">00:00:00</span>

          <button type="button" class="nx-novacut__play" data-action="play" aria-label="Play">
            <span data-role="play-icon">${SVG.play}</span>
          </button>

          <span data-role="duration">00:00:00</span>
        </div>
      </section>

      <section class="nx-novacut__timeline-shell">
        <div class="nx-novacut__timeline-head">
          <div>
            <span class="nx-novacut__eyebrow">TIMELINE</span>
            <strong>Project sequence</strong>
          </div>
          <div class="nx-novacut__timeline-head-actions">
            <button type="button" class="nx-novacut__icon-button nx-novacut__timeline-action" data-action="duplicate" aria-label="Duplicate selected clip" title="Duplicate selected clip">
              ${SVG.duplicate}
            </button>
            <button type="button" class="nx-novacut__icon-button nx-novacut__timeline-action" data-action="delete" aria-label="Delete selected clip" title="Delete selected clip">
              ${SVG.trash}
            </button>
            <button type="button" class="nx-novacut__add-button" data-action="media">
              <span>${SVG.media}</span>
              Add media
            </button>
          </div>
        </div>

        <div class="nx-novacut__timeline" aria-label="Multi-track timeline">
          <div class="nx-novacut__ruler">
            <div class="nx-novacut__ruler-pad"></div>
            <div class="nx-novacut__ticks">
              <span style="--i:0">0:00</span>
              <span style="--i:1">0:01</span>
              <span style="--i:2">0:02</span>
              <span style="--i:3">0:03</span>
              <span style="--i:4">0:04</span>
              <span style="--i:5">0:05</span>
              <span style="--i:6">0:06</span>
              <span style="--i:7">0:07</span>
              <span style="--i:8">0:08</span>
            </div>
          </div>

          <div class="nx-novacut__track nx-novacut__track--video">
            <div class="nx-novacut__track-label">
              <span class="nx-novacut__track-index">01</span>
              <span class="nx-novacut__track-name">Video</span>
            </div>
            <div class="nx-novacut__lane" data-role="video-lane">
              <button type="button" class="nx-novacut__lane-add" data-action="media">${SVG.media}<span>Add media</span></button>
            </div>
          </div>

          <div class="nx-novacut__track nx-novacut__track--audio">
            <div class="nx-novacut__track-label">
              <span class="nx-novacut__track-index">02</span>
              <span class="nx-novacut__track-name">Audio</span>
            </div>
            <div class="nx-novacut__lane" data-role="audio-lane">
              <span class="nx-novacut__lane-hint">Music and voice</span>
            </div>
          </div>

          <div class="nx-novacut__track nx-novacut__track--text">
            <div class="nx-novacut__track-label">
              <span class="nx-novacut__track-index">03</span>
              <span class="nx-novacut__track-name">Text</span>
            </div>
            <div class="nx-novacut__lane" data-role="text-lane">
              <button type="button" class="nx-novacut__lane-tool" data-action="text">${SVG.text}<span>Add text</span></button>
            </div>
          </div>

          <div class="nx-novacut__track nx-novacut__track--sticker">
            <div class="nx-novacut__track-label">
              <span class="nx-novacut__track-index">04</span>
              <span class="nx-novacut__track-name">Stickers</span>
            </div>
            <div class="nx-novacut__lane" data-role="sticker-lane">
              <button type="button" class="nx-novacut__lane-tool" data-action="sticker">${SVG.sticker}<span>Add sticker</span></button>
            </div>
          </div>

          <span class="nx-novacut__interaction-surface" aria-hidden="true"></span>
        </div>
      </section>

      <div class="nx-novacut__sticker-panel" data-role="sticker-panel" hidden aria-label="Sticker library">
        <div class="nx-novacut__panel-head"><strong>Sticker library</strong><button type="button" class="nx-novacut__panel-close" data-action="sticker-close" aria-label="Close sticker library">×</button></div>
        <div class="nx-novacut__sticker-grid" data-role="sticker-grid"></div>
      </div>

      <div class="nx-novacut__text-modal" data-role="text-modal" hidden>
        <form class="nx-novacut__text-dialog" data-role="text-form">
          <div class="nx-novacut__panel-head"><strong data-role="text-modal-title">Add text</strong><button type="button" class="nx-novacut__panel-close" data-action="text-close" aria-label="Close text editor">×</button></div>
          <label>Text<textarea data-role="text-input" rows="3" maxlength="500" placeholder="Type your text"></textarea></label>
          <div class="nx-novacut__form-grid">
            <label>Color<input type="color" data-role="text-color" value="#ffffff"></label>
            <label>Size<input type="number" data-role="text-size" min="8" max="180" step="1" value="48"></label>
            <label>Duration (s)<input type="number" data-role="text-duration" min="0.1" max="300" step="0.1" value="3"></label>
          </div>
          <div class="nx-novacut__form-checks">
            <label><input type="checkbox" data-role="text-bold" checked> Bold</label>
            <label><input type="checkbox" data-role="text-italic"> Italic</label>
          </div>
          <div class="nx-novacut__text-dialog-actions">
            <button type="button" class="nx-novacut__secondary-button" data-action="text-close">Cancel</button>
            <button type="submit" class="nx-novacut__primary-button">Apply</button>
          </div>
        </form>
      </div>

      <nav class="nx-novacut__dock" aria-label="NovaCut tools">
        <button type="button" class="nx-novacut__dock-item nx-novacut__dock-item--active" data-action="media">
          <span>${SVG.media}</span>
          <strong>Media</strong>
        </button>
        <button type="button" class="nx-novacut__dock-item" data-action="split">
          <span>${SVG.split}</span>
          <strong>Split</strong>
        </button>
        <button type="button" class="nx-novacut__dock-item" data-action="audio">
          <span>${SVG.audio}</span>
          <strong>Audio</strong>
        </button>
        <button type="button" class="nx-novacut__dock-item" data-action="text">
          <span>${SVG.text}</span>
          <strong>Text</strong>
        </button>
        <button type="button" class="nx-novacut__dock-item" data-action="sticker">
          <span>${SVG.sticker}</span>
          <strong>Stickers</strong>
        </button>
        <button type="button" class="nx-novacut__dock-item" data-action="ratio">
          <span>${SVG.ratio}</span>
          <strong>Canvas</strong>
        </button>
      </nav>
    </section>`;

  const videoLane = root.querySelector("[data-role='video-lane']");
  const audioLane = root.querySelector("[data-role='audio-lane']");
  const textLane = root.querySelector("[data-role='text-lane']");
  const stickerLane = root.querySelector("[data-role='sticker-lane']");
  const canvasEmpty = root.querySelector("[data-role='canvas-empty']");
  const status = root.querySelector("[data-role='status']");
  const playButton = root.querySelector("[data-action='play']");
  const playIcon = root.querySelector("[data-role='play-icon']");
  const undoButton = root.querySelector("[data-action='undo']");
  const redoButton = root.querySelector("[data-action='redo']");
  const duplicateButton = root.querySelector("[data-action='duplicate']");
  const deleteButton = root.querySelector("[data-action='delete']");

  const engine = createNovaCutEngine({ root });

  const renderTimeline = (state = {}) => {
    if (!videoLane || !audioLane || !textLane) return;

    const videos = state.videoTracks || [];
    const audios = state.audioTracks || [];
    const texts = state.textTracks || [];
    const stickers = state.stickerTracks || [];

    videoLane.innerHTML = videos.length
      ? videos.map((clip) => renderTrackClip(clip, "video")).join("")
      : '<button type="button" class="nx-novacut__lane-add" data-action="media">' + SVG.media + '<span>Add media</span></button>';

    audioLane.innerHTML = audios.length
      ? audios.map((segment) => renderTrackClip(segment, "audio")).join("")
      : '<span class="nx-novacut__lane-hint">Music and voice</span>';

    textLane.innerHTML = texts.length
      ? texts.map((cue) => renderTrackClip(cue, "text")).join("")
      : '<button type="button" class="nx-novacut__lane-tool" data-action="text">' + SVG.text + '<span>Add text</span></button>';

    if (stickerLane) {
      stickerLane.innerHTML = stickers.length
        ? stickers.map((sticker) => renderTrackClip(sticker, "sticker")).join("")
        : '<button type="button" class="nx-novacut__lane-tool" data-action="sticker">' + SVG.sticker + '<span>Add sticker</span></button>';
    }

    if (canvasEmpty) canvasEmpty.hidden = videos.length > 0;

    const selected = engine.activeTrackId;
    root.querySelectorAll("[data-clip-id]").forEach((element) => {
      element.classList.toggle("is-selected", element.dataset.clipId === String(selected || ""));
    });
  };

  engine.on("statechange", renderTimeline);
  engine.on("audio", renderTimeline);
  engine.on("text", renderTimeline);
  engine.on("split", renderTimeline);
  engine.on("selectionchange", renderTimeline);
  engine.on("delete", renderTimeline);
  engine.on("duplicate", renderTimeline);

  engine.on("playheadchange", ({ timestamp }) => {
    const duration = engine.registry.durationMs();
    const currentNode = root.querySelector("[data-role='current-time']");
    const durationNode = root.querySelector("[data-role='duration']");
    if (currentNode) currentNode.textContent = engine.format(timestamp);
    if (durationNode) durationNode.textContent = engine.format(duration);
  });

  engine.on("statechange", (state) => {
    if (canvasEmpty) canvasEmpty.hidden = Boolean(state.videoTracks?.length);
    if (status) status.textContent = state.videoTracks?.length ? "Editing" : "Ready";
    if (undoButton) undoButton.disabled = !state.canUndo;
    if (redoButton) redoButton.disabled = !state.canRedo;
    const hasSelection = Boolean(state.activeTrackId);
    if (duplicateButton) duplicateButton.disabled = !hasSelection;
    if (deleteButton) deleteButton.disabled = !hasSelection;
  });

  engine.on("historychange", (history) => {
    if (undoButton) undoButton.disabled = !history.canUndo;
    if (redoButton) redoButton.disabled = !history.canRedo;
    const hasSelection = Boolean(engine.activeTrackId);
    if (duplicateButton) duplicateButton.disabled = !hasSelection;
    if (deleteButton) deleteButton.disabled = !hasSelection;
  });

  engine.on("ratio", ({ ratio }) => {
    const statusNode = root.querySelector("[data-role='status']");
    if (statusNode) statusNode.textContent = ratio;
  });

  engine.on("export:progress", ({ progress }) => {
    if (status) status.textContent = `Export ${Math.round(progress * 100)}%`;
  });

  engine.on("export:complete", () => {
    if (status) status.textContent = "Exported";
  });

  engine.on("export:error", () => {
    if (status) status.textContent = "Export error";
  });

  engine.on("error", ({ error }) => {
    if (status && error?.message) status.textContent = "Error";
  });

  engine.on("runtime:ready", () => {
    if (status) status.textContent = "Engine ready";
  });

  const setPlayVisual = () => {
    if (!playIcon || !playButton) return;
    playIcon.innerHTML = engine.isPlaying ? SVG.pause : SVG.play;
    playButton.setAttribute("aria-label", engine.isPlaying ? "Pause" : "Play");
    playButton.classList.toggle("is-playing", engine.isPlaying);
  };


  engine.on("media:status", ({ status }) => {
    if (!status) return;
    const labels = {
      decoding: "Decoding…",
      ready: "Ready",
      "decode-error": "Decode error"
    };
    if (status) status.textContent = labels[status] || String(status);
  });

  engine.on("playbackchange", ({ isPlaying }) => {
    if (status && isPlaying) status.textContent = "Playing";
  });

  engine.on("playheadchange", setPlayVisual);
  root.addEventListener("click", (event) => {
    const action = event.target?.closest?.("[data-action]");
    if (!action) return;
    if (action.dataset.action === "play") queueMicrotask(setPlayVisual);
  });

  const mediaParser = createNovaCutMediaParser(root, engine, {
    maxFilesPerBatch: 8
  });

  root.addEventListener("novacut-media:file:injected", () => {
    if (status) status.textContent = "Preparing media…";
  });

  root.addEventListener("novacut-media:file:error", () => {
    if (status) status.textContent = "Media error";
  });

  root.__novaCutEngine = engine;
  root.__novaCutMediaParser = mediaParser;
  root.__novaCutInteractions = createNovaCutStudioInteractions(root, engine);
  root.__novaCutVisualEditor = createNovaCutVisualEditor(root, engine);

  const stickerPanel = root.querySelector("[data-role='sticker-panel']");
  const stickerGrid = root.querySelector("[data-role='sticker-grid']");
  const textModal = root.querySelector("[data-role='text-modal']");
  const textForm = root.querySelector("[data-role='text-form']");
  const textInput = root.querySelector("[data-role='text-input']");
  const textColor = root.querySelector("[data-role='text-color']");
  const textSize = root.querySelector("[data-role='text-size']");
  const textDuration = root.querySelector("[data-role='text-duration']");
  const textBold = root.querySelector("[data-role='text-bold']");
  const textItalic = root.querySelector("[data-role='text-italic']");
  const textModalTitle = root.querySelector("[data-role='text-modal-title']");
  let editingTextId = null;
  let pendingTextStart = engine.currentTimestamp;

  if (stickerGrid) {
    stickerGrid.innerHTML = STICKER_LIBRARY.map((sticker) => (
      '<button type="button" class="nx-novacut__sticker-option" data-sticker-id="' +
      escapeHtml(sticker.id) +
      '" title="' + escapeHtml(sticker.name) + '">' +
      '<span aria-hidden="true">' + escapeHtml(sticker.glyph) + '</span>' +
      '<small>' + escapeHtml(sticker.name) + '</small>' +
      '</button>'
    )).join("");
  }

  const openStickerPanel = () => {
    if (stickerPanel) stickerPanel.hidden = false;
  };
  const closeStickerPanel = () => {
    if (stickerPanel) stickerPanel.hidden = true;
  };

  root.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-action='sticker'], [data-action='sticker-close']");
    if (!target) return;
    event.preventDefault();
    if (target.dataset.action === "sticker") openStickerPanel();
    else closeStickerPanel();
  });

  root.addEventListener("click", (event) => {
    const option = event.target?.closest?.("[data-sticker-id]");
    if (!option) return;
    const sticker = STICKER_LIBRARY.find((entry) => entry.id === option.dataset.stickerId);
    if (!sticker) return;
    engine.addSticker({
      stickerId: sticker.id,
      startTime: engine.currentTimestamp,
      duration: 3000,
      x: 0.5,
      y: 0.5,
      scale: 1
    });
    closeStickerPanel();
  });

  const openTextEditor = (cue = null, startTime = engine.currentTimestamp) => {
    editingTextId = cue?.id || null;
    pendingTextStart = Number.isFinite(Number(startTime)) ? Number(startTime) : engine.currentTimestamp;
    if (textModal) textModal.hidden = false;
    if (textModalTitle) textModalTitle.textContent = cue ? "Edit text" : "Add text";
    if (textInput) textInput.value = cue?.text || "";
    if (textColor) textColor.value = cue?.style?.color || "#ffffff";
    if (textSize) textSize.value = String(cue?.style?.fontSize || 48);
    if (textDuration) textDuration.value = String(((cue?.duration || 3000) / 1000).toFixed(1));
    if (textBold) textBold.checked = cue ? Boolean(cue.style?.bold) : true;
    if (textItalic) textItalic.checked = cue ? Boolean(cue.style?.italic) : false;
    textInput?.focus?.();
  };

  const closeTextEditor = () => {
    if (textModal) textModal.hidden = true;
    editingTextId = null;
  };

  engine.on("text:edit-request", ({ cue, startTime }) => openTextEditor(cue, startTime));

  root.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-action='text-close']");
    if (target) {
      event.preventDefault();
      closeTextEditor();
    }
  });

  textForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = textInput?.value?.trim() || "";
    if (!value) return;
    const payload = {
      text: value,
      duration: Math.max(100, Number(textDuration?.value) * 1000 || 3000),
      style: {
        color: textColor?.value || "#ffffff",
        fontSize: Math.max(8, Math.min(180, Number(textSize?.value) || 48)),
        bold: Boolean(textBold?.checked),
        italic: Boolean(textItalic?.checked)
      }
    };
    if (editingTextId) {
      engine.updateTextCue(editingTextId, payload);
    } else {
      engine.addTextCue({
        ...payload,
        startTime: pendingTextStart,
        style: { x: 0.5, y: 0.82, ...payload.style }
      });
    }
    closeTextEditor();
  });

  const initialState = engine.getState ? engine.getState() : { videoTracks: [], audioTracks: [], textTracks: [], stickerTracks: [], canUndo: false, canRedo: false, activeTrackId: null };
  renderTimeline(initialState);
  if (undoButton) undoButton.disabled = !initialState.canUndo;
  if (redoButton) redoButton.disabled = !initialState.canRedo;
  if (duplicateButton) duplicateButton.disabled = !initialState.activeTrackId;
  if (deleteButton) deleteButton.disabled = !initialState.activeTrackId;

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
