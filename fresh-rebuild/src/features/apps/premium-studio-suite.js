// OTA release marker: NexusNova Premium Studio six-tool production publish.
import { renderAiPhotoStudio } from './ai-photo-studio-review.js';
import { renderPdfProStudio } from './pdf-pro-studio.js';
import { renderAiTranscribeStudio } from './ai-transcribe-studio.js';
import { renderAiWritingStudio } from './ai-writing-studio.js';
import { renderDigitalSignStudio } from './digital-sign-studio.js';
import { createNovaCutEngine } from './novacut-engine.js';
import { createNovaCutStudioInteractions, NOVACUT_PIXELS_PER_SECOND } from './novacut-studio.js';
import { createNovaCutMediaParser } from './novacut-media.js';

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
  effects: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8 12h8M12 8v8"></path></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
  export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10M8 10l4 4 4-4M5 18h14"></path></svg>'
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
    return '<button type="button" class="nx-novacut__clip nx-novacut__clip--video' + selected + '" data-clip-id="' + id + '">' +
      '<span class="nx-novacut__clip-thumb" aria-hidden="true"></span>' +
      '<span class="nx-novacut__clip-copy"><strong>Video</strong><small>' + seconds + 's</small></span>' +
      '<span class="nx-novacut__clip-wave" aria-hidden="true"></span></button>';
  }

  if (type === 'audio') {
    return '<button type="button" class="nx-novacut__clip nx-novacut__clip--audio' + selected + '" data-clip-id="' + id + '">' +
      '<span class="nx-novacut__track-icon">' + SVG.audio + '</span>' +
      '<span class="nx-novacut__clip-copy"><strong>Audio</strong><small>' + seconds + 's</small></span>' +
      '<span class="nx-novacut__audio-bars" aria-hidden="true"></span></button>';
  }

  if (type === 'sticker') {
    return '<button type="button" class="nx-novacut__clip nx-novacut__clip--sticker' + selected + '" data-clip-id="' + id + '">' +
      '<span class="nx-novacut__clip-glyph">' + escapeHtml(clip?.glyph || '★') + '</span>' +
      '<span class="nx-novacut__clip-copy"><strong>' + escapeHtml(clip?.label || 'Sticker') + '</strong><small>' + seconds + 's</small></span></button>';
  }

  if (type === 'effect') {
    return '<button type="button" class="nx-novacut__clip nx-novacut__clip--effect' + selected + '" data-clip-id="' + id + '">' +
      '<span class="nx-novacut__track-icon">' + SVG.effects + '</span>' +
      '<span class="nx-novacut__clip-copy"><strong>' + escapeHtml(String(clip?.type || 'Effect').toUpperCase()) + '</strong><small>' + seconds + 's</small></span></button>';
  }

  return '<button type="button" class="nx-novacut__clip nx-novacut__clip--text' + selected + '" data-clip-id="' + id + '">' +
    '<span class="nx-novacut__track-icon">' + SVG.text + '</span>' +
    '<span class="nx-novacut__clip-copy"><strong>' + escapeHtml(clip?.text || 'Text') + '</strong><small>' + seconds + 's</small></span></button>';
}

function renderNovaCut() {
  ensureNovaCutStyles();

  const root = document.createElement('div');
  root.className = 'nx-app-body nx-novacut-host';
  root.dataset.novacut = 'active';

  root.innerHTML = '<section class="nx-novacut nx-novacut--elite" aria-label="NovaCut editor">' +
    '<header class="nx-novacut__header">' +
      '<div class="nx-novacut__project"><span class="nx-novacut__brand-mark">N</span><div><span class="nx-novacut__eyebrow">NOVA EDITOR</span><strong>NovaCut</strong></div></div>' +
      '<div class="nx-novacut__top-actions">' +
        '<button type="button" class="nx-novacut__icon-button" data-action="undo" aria-label="Undo">' + SVG.undo + '</button>' +
        '<button type="button" class="nx-novacut__icon-button" data-action="redo" aria-label="Redo">' + SVG.redo + '</button>' +
        '<button type="button" class="nx-novacut__icon-button" data-action="more" aria-label="More options">' + SVG.more + '</button>' +
        '<button type="button" class="nx-novacut__export-button" data-action="export">' + SVG.export + '<span>Export</span></button>' +
      '</div>' +
    '</header>' +
    '<section class="nx-novacut__canvas-area">' +
      '<div class="nx-novacut__canvas-shell"><canvas class="nx-novacut__canvas" data-role="preview-canvas"></canvas>' +
        '<div class="nx-novacut__canvas-empty" data-role="canvas-empty">' +
          '<button type="button" class="nx-novacut__media-drop" data-action="media" aria-label="Add media"><span>' + SVG.media + '</span><strong>Add media</strong><small>Photo, video or audio</small></button>' +
        '</div>' +
        '<div class="nx-novacut__canvas-overlay"><span class="nx-novacut__live-dot"></span><span data-role="status">Ready</span></div>' +
      '</div>' +
      '<div class="nx-novacut__transport"><span data-role="current-time">00:00:00</span><button type="button" class="nx-novacut__play" data-action="play" aria-label="Play"><span data-role="play-icon">' + SVG.play + '</span></button><span data-role="duration">00:00:00</span></div>' +
    '</section>' +
    '<section class="nx-novacut__timeline-shell">' +
      '<div class="nx-novacut__timeline-head"><div><span class="nx-novacut__eyebrow">TIMELINE</span><strong>Project sequence</strong></div><button type="button" class="nx-novacut__add-button" data-action="media"><span>' + SVG.media + '</span>Add media</button></div>' +
      '<div class="nx-novacut__timeline" aria-label="Multi-track timeline">' +
        '<div class="nx-novacut__ruler"><div class="nx-novacut__ruler-pad"></div><div class="nx-novacut__ticks" data-role="timeline-ticks" aria-hidden="true"></div></div>' +
        '<div class="nx-novacut__track nx-novacut__track--video"><div class="nx-novacut__track-label"><span class="nx-novacut__track-index">01</span><span class="nx-novacut__track-name">Video</span></div><div class="nx-novacut__lane" data-role="video-lane"><button type="button" class="nx-novacut__lane-add" data-action="media">' + SVG.media + '<span>Add media</span></button></div></div>' +
        '<div class="nx-novacut__track nx-novacut__track--audio"><div class="nx-novacut__track-label"><span class="nx-novacut__track-index">02</span><span class="nx-novacut__track-name">Audio</span></div><div class="nx-novacut__lane" data-role="audio-lane"><span class="nx-novacut__lane-hint">Music and voice</span></div></div>' +
        '<div class="nx-novacut__track nx-novacut__track--text"><div class="nx-novacut__track-label"><span class="nx-novacut__track-index">03</span><span class="nx-novacut__track-name">Text</span></div><div class="nx-novacut__lane" data-role="text-lane"><button type="button" class="nx-novacut__lane-tool" data-action="text">' + SVG.text + '<span>Add text</span></button></div></div>' +
        '<div class="nx-novacut__track nx-novacut__track--overlay"><div class="nx-novacut__track-label"><span class="nx-novacut__track-index">04</span><span class="nx-novacut__track-name">Overlay</span></div><div class="nx-novacut__lane" data-role="overlay-lane"><button type="button" class="nx-novacut__lane-tool" data-action="sticker"><span class="nx-novacut__lane-tool-glyph">★</span><span>Add sticker</span></button></div></div>' +
        '<div class="nx-novacut__track nx-novacut__track--effect"><div class="nx-novacut__track-label"><span class="nx-novacut__track-index">05</span><span class="nx-novacut__track-name">Effects</span></div><div class="nx-novacut__lane" data-role="effect-lane"><button type="button" class="nx-novacut__lane-tool" data-action="effects">' + SVG.effects + '<span>Add effect</span></button></div></div>' +
        '<span class="nx-novacut__interaction-surface" aria-hidden="true"></span>' +
      '</div>' +
    '</section>' +
    '<nav class="nx-novacut__dock" aria-label="NovaCut tools">' +
      '<button type="button" class="nx-novacut__dock-item nx-novacut__dock-item--active" data-action="media"><span>' + SVG.media + '</span><strong>Media</strong></button>' +
      '<button type="button" class="nx-novacut__dock-item" data-action="split"><span>' + SVG.split + '</span><strong>Split</strong></button>' +
      '<button type="button" class="nx-novacut__dock-item" data-action="audio"><span>' + SVG.audio + '</span><strong>Audio</strong></button>' +
      '<button type="button" class="nx-novacut__dock-item" data-action="text"><span>' + SVG.text + '</span><strong>Text</strong></button>' +
      '<button type="button" class="nx-novacut__dock-item" data-action="effects"><span>' + SVG.effects + '</span><strong>Effects</strong></button>' +
      '<button type="button" class="nx-novacut__dock-item" data-action="ratio"><span>' + SVG.ratio + '</span><strong>Canvas</strong></button>' +
    '</nav>' +
  '</section>';

  const videoLane = root.querySelector("[data-role='video-lane']");
  const audioLane = root.querySelector("[data-role='audio-lane']");
  const textLane = root.querySelector("[data-role='text-lane']");
  const overlayLane = root.querySelector("[data-role='overlay-lane']");
  const effectLane = root.querySelector("[data-role='effect-lane']");
  const timeline = root.querySelector(".nx-novacut__timeline");
  const rulerTicks = root.querySelector("[data-role='timeline-ticks']");
  const canvasArea = root.querySelector(".nx-novacut__canvas-area");
  const canvasShell = root.querySelector(".nx-novacut__canvas-shell");
  const transport = root.querySelector(".nx-novacut__transport");
  const canvasEmpty = root.querySelector("[data-role='canvas-empty']");
  const status = root.querySelector("[data-role='status']");
  const playButton = root.querySelector("[data-action='play']");
  const playIcon = root.querySelector("[data-role='play-icon']");
  const PREVIEW_ASPECTS = Object.freeze({
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "1:1": 1,
    "4:5": 4 / 5,
    "4:3": 4 / 3
  });
  let previewRatio = "16:9";
  const syncPreviewFrame = () => {
    if (!canvasArea || !canvasShell) return;
    const bounds = canvasArea.getBoundingClientRect();
    const style = globalThis.getComputedStyle?.(canvasArea);
    const rowGap = Math.max(0, Number.parseFloat(style?.rowGap || "0") || 0);
    const transportHeight = transport?.getBoundingClientRect().height || 46;
    const maxWidth = Math.max(0, bounds.width - 24);
    const maxHeight = Math.max(0, bounds.height - transportHeight - rowGap - 12);
    if (maxWidth < 2 || maxHeight < 2) return;
    const aspect = PREVIEW_ASPECTS[previewRatio] || PREVIEW_ASPECTS["16:9"];
    const width = Math.floor(Math.min(maxWidth, maxHeight * aspect));
    const height = Math.floor(width / aspect);
    canvasShell.dataset.ratio = previewRatio;
    canvasShell.style.setProperty("width", width + "px", "important");
    canvasShell.style.setProperty("height", height + "px", "important");
  };

  const engine = createNovaCutEngine({ root });
  previewRatio = engine.aspectRatio;
  if (canvasShell) canvasShell.dataset.ratio = previewRatio;
  let previewFrameObserver = null;
  if (canvasArea && typeof ResizeObserver !== "undefined") {
    previewFrameObserver = new ResizeObserver(syncPreviewFrame);
    previewFrameObserver.observe(canvasArea);
    root.__novaCutPreviewFrameObserver = previewFrameObserver;
  }
  syncPreviewFrame();

  const RULER_PX_PER_SECOND = NOVACUT_PIXELS_PER_SECOND;
  const renderTimelineRuler = () => {
    if (!timeline || !rulerTicks) return;
    const durationMs = Math.max(0, Number(engine.registry.durationMs()) || 0);
    const durationSeconds = Math.max(8, Math.ceil(durationMs / 1000));
    const tickEvery = durationSeconds <= 120 ? 1 : durationSeconds <= 600 ? 5 : 10;
    const lastTick = Math.ceil(durationSeconds / tickEvery) * tickEvery;
    const contentWidth = Math.max(640, lastTick * RULER_PX_PER_SECOND + 72);
    timeline.style.setProperty("--nc-content-width", contentWidth + "px");
    timeline.style.setProperty("--nc-ruler-px-per-second", RULER_PX_PER_SECOND + "px");

    const ticks = [];
    for (let seconds = 0; seconds <= lastTick; seconds += tickEvery) {
      const minutes = Math.floor(seconds / 60);
      const remainder = String(seconds % 60).padStart(2, "0");
      const label = minutes + ":" + remainder;
      ticks.push(
        '<span data-time-seconds="' + seconds + '" style="--tick-x:' +
        (seconds * RULER_PX_PER_SECOND) + 'px">' + label + '</span>'
      );
    }
    rulerTicks.innerHTML = ticks.join("");
    rulerTicks.setAttribute("aria-label", "Timeline ruler, " + tickEvery + " second intervals");
  };

  const renderTimeline = (state = {}) => {
    if (!videoLane || !audioLane || !textLane || !overlayLane || !effectLane) return;
    renderTimelineRuler();
    const byStartTime = (a, b) => (Number(a.startTime) || 0) - (Number(b.startTime) || 0);
    const videos = [...(state.videoTracks || [])].sort(byStartTime);
    const audios = [...(state.audioTracks || [])].sort(byStartTime);
    const texts = [...(state.textTracks || [])].sort(byStartTime);
    const overlays = [...(state.overlayTracks || [])].sort(byStartTime);
    const effects = [...(state.effectTracks || [])].sort(byStartTime);

    videoLane.innerHTML = videos.length
      ? videos.map((clip) => renderTrackClip(clip, 'video')).join('')
      : '<button type="button" class="nx-novacut__lane-add" data-action="media">' + SVG.media + '<span>Add media</span></button>';
    audioLane.innerHTML = audios.length
      ? audios.map((segment) => renderTrackClip(segment, 'audio')).join('')
      : '<span class="nx-novacut__lane-hint">Music and voice</span>';
    textLane.innerHTML = texts.length
      ? texts.map((cue) => renderTrackClip(cue, 'text')).join('')
      : '<button type="button" class="nx-novacut__lane-tool" data-action="text">' + SVG.text + '<span>Add text</span></button>';
    overlayLane.innerHTML = overlays.length
      ? overlays.map((item) => renderTrackClip(item, 'sticker')).join('')
      : '<button type="button" class="nx-novacut__lane-tool" data-action="sticker"><span class="nx-novacut__lane-tool-glyph">★</span><span>Add sticker</span></button>';
    effectLane.innerHTML = effects.length
      ? effects.map((item) => renderTrackClip(item, 'effect')).join('')
      : '<button type="button" class="nx-novacut__lane-tool" data-action="effects">' + SVG.effects + '<span>Add effect</span></button>';

    if (canvasEmpty) canvasEmpty.hidden = videos.length > 0;
    const selected = engine.activeTrackId;
    root.querySelectorAll("[data-clip-id]").forEach((element) => {
      element.classList.toggle('is-selected', element.dataset.clipId === String(selected || ''));
    });
  };

  engine.on('statechange', renderTimeline);
  engine.on('split', renderTimeline);
  engine.on('audio', renderTimeline);
  engine.on('text', renderTimeline);
  engine.on('selectionchange', renderTimeline);

  engine.on('historystatechange', ({ canUndo, canRedo }) => {
    root.querySelectorAll("[data-action='undo']").forEach((node) => {
      node.disabled = !canUndo;
      node.setAttribute('aria-disabled', String(!canUndo));
    });
    root.querySelectorAll("[data-action='redo']").forEach((node) => {
      node.disabled = !canRedo;
      node.setAttribute('aria-disabled', String(!canRedo));
    });
  });

  engine.on('playheadchange', ({ timestamp }) => {
    const duration = engine.registry.durationMs();
    const currentNode = root.querySelector("[data-role='current-time']");
    const durationNode = root.querySelector("[data-role='duration']");
    if (currentNode) currentNode.textContent = engine.format(timestamp);
    if (durationNode) durationNode.textContent = engine.format(duration);
  });

  engine.on('statechange', (state) => {
    if (canvasEmpty) canvasEmpty.hidden = Boolean(state.videoTracks?.length);
  });

  engine.on('ratio', ({ ratio, automatic }) => {
    previewRatio = ratio;
    syncPreviewFrame();
    if (status) status.textContent = automatic ? 'Preview fitted' : ratio;
  });

  engine.on('export:progress', ({ progress }) => {
    if (status) status.textContent = 'Export ' + Math.round(progress * 100) + '%';
  });

  engine.on('export:complete', () => {
    if (status) status.textContent = 'Export complete';
  });

  engine.on('export:error', () => {
    if (status) status.textContent = 'Export error';
  });

  engine.on('error', ({ error }) => {
    if (!status || !error?.message) return;
    const message = String(error.message);
    status.textContent = 'Error: ' + message.slice(0, 72);
    status.title = message;
    status.setAttribute('aria-label', message);
    console.error('[NovaCut engine]', error);
  });

  const setPlayVisual = () => {
    if (!playIcon || !playButton) return;
    playIcon.innerHTML = engine.isPlaying ? SVG.pause : SVG.play;
    playButton.setAttribute('aria-label', engine.isPlaying ? 'Pause' : 'Play');
    playButton.classList.toggle('is-playing', engine.isPlaying);
  };

  engine.on('playheadchange', setPlayVisual);

  const mediaParser = createNovaCutMediaParser(root, engine, { maxFilesPerBatch: 8 });

  root.addEventListener('novacut-media:batch:start', (event) => {
    const total = Number(event.detail?.total) || 0;
    if (status && total > 0) status.textContent = 'Reading ' + total + ' media file(s)…';
  });

  root.addEventListener('novacut-media:file:parse-start', (event) => {
    const fileName = String(event.detail?.file?.name || 'media');
    if (status) status.textContent = 'Reading ' + fileName.slice(0, 44);
  });

  root.addEventListener('novacut-media:file:injected', async (event) => {
    const clip = event.detail?.record?.track || null;
    if (!clip) return;
    if (status) status.textContent = 'Checking video decoder…';
    try {
      await engine.prepareClip(clip);
      if (status) {
        status.textContent = 'Media ready';
        status.title = String(clip.file?.name || 'Media ready');
      }
    } catch (error) {
      const message = String(error?.message || 'Video decoder rejected the selected file.');
      if (status) {
        status.textContent = 'Decode failed: ' + message.slice(0, 60);
        status.title = message;
        status.setAttribute('aria-label', message);
      }
      console.error('[NovaCut decode]', error);
    }
  });

  root.addEventListener('novacut-media:file:error', (event) => {
    const record = event.detail?.record || null;
    const fileName = String(record?.file?.name || record?.metadata?.name || 'selected media');
    const reason = String(record?.error?.message || 'The selected media could not be imported.');
    if (status) {
      status.textContent = 'Import failed: ' + reason.slice(0, 54);
      status.title = fileName + ': ' + reason;
      status.setAttribute('aria-label', fileName + ': ' + reason);
    }
    console.error('[NovaCut import]', fileName, reason, record?.error || event.detail);
  });

  root.__novaCutEngine = engine;
  root.__novaCutMediaParser = mediaParser;
  root.__novaCutInteractions = createNovaCutStudioInteractions(root, engine);

  renderTimeline(engine.getState());

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
