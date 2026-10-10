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
const VIDEO_THUMBNAIL_CACHE = new WeakMap();

function getVideoThumbnail(file) {
  if (!file || typeof file !== 'object') return Promise.resolve(null);
  const cached = VIDEO_THUMBNAIL_CACHE.get(file);
  if (cached) return cached;

  const promise = new Promise((resolve) => {
    const video = document.createElement('video');
    let objectUrl = '';
    let timer = 0;
    let settled = false;
    const cleanup = (dataUrl) => {
      if (settled) return;
      settled = true;
      if (timer) globalThis.clearTimeout?.(timer);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('seeked', onReady);
      video.removeEventListener('error', onError);
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {}
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      }
      resolve(dataUrl || null);
    };
    const onReady = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 54;
        const ctx = canvas.getContext('2d');
        if (!ctx) return cleanup(null);
        ctx.fillStyle = '#111216';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        cleanup(canvas.toDataURL('image/webp', 0.72));
      } catch (_) {
        cleanup(null);
      }
    };
    const onMetadata = () => {
      const duration = Number(video.duration);
      const target = Number.isFinite(duration) && duration > 0 ? Math.min(0.75, duration * 0.1) : 0.05;
      try { video.currentTime = Math.max(0, target); } catch (_) {}
    };
    const onError = () => cleanup(null);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('seeked', onReady);
    video.addEventListener('error', onError);
    timer = globalThis.setTimeout?.(() => cleanup(null), 4000) || 0;
    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.load();
    } catch (_) {
      cleanup(null);
    }
  });
  VIDEO_THUMBNAIL_CACHE.set(file, promise);
  return promise;
}

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
      '<span class="nx-novacut__clip-thumb" data-video-thumb="' + id + '" aria-hidden="true"></span>' +
      '<span class="nx-novacut__clip-copy"><strong>' + escapeHtml(clip?.file?.name || 'Video') + '</strong><small>' + seconds + 's</small></span>' +
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
      '<div class="nx-novacut__timeline-head"><div><span class="nx-novacut__eyebrow">TIMELINE</span><strong>Project sequence</strong></div>' +
        '<div class="nx-novacut__timeline-head-actions">' +
          '<div class="nx-novacut__timeline-controls" role="group" aria-label="Timeline zoom">' +
            '<button type="button" data-timeline-action="zoom-out" aria-label="Zoom timeline out" title="Zoom out">−</button>' +
            '<span data-role="timeline-zoom-value" aria-live="polite">100%</span>' +
            '<button type="button" data-timeline-action="zoom-in" aria-label="Zoom timeline in" title="Zoom in">+</button>' +
            '<button type="button" data-timeline-action="zoom-fit" aria-label="Fit timeline to screen" title="Fit timeline">Fit</button>' +
            '<button type="button" data-timeline-action="snap" aria-pressed="true" title="Toggle clip snapping">Snap</button>' +
          '</div>' +
          '<button type="button" class="nx-novacut__add-button" data-action="media"><span>' + SVG.media + '</span>Add media</button>' +
        '</div></div>' +
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

  let timelinePixelsPerSecond = NOVACUT_PIXELS_PER_SECOND;
  let timelineSnapEnabled = true;

  const layoutTimelineClips = () => {
    const tracks = [
      [videoLane, engine.registry.videoTracks],
      [audioLane, engine.registry.audioTracks],
      [textLane, engine.registry.textTracks],
      [overlayLane, engine.registry.overlayTracks],
      [effectLane, engine.registry.effectTracks]
    ];
    for (const [lane, items] of tracks) {
      if (!lane) continue;
      const byId = new Map(items.map((item) => [String(item.id), item]));
      lane.querySelectorAll("[data-clip-id]").forEach((element) => {
        const item = byId.get(String(element.dataset.clipId || ""));
        if (!item) return;
        const left = Math.max(0, Number(item.startTime) || 0) * timelinePixelsPerSecond / 1000;
        const duration = Math.max(0, Number(item.duration) || 0);
        const width = Math.max(54, duration * timelinePixelsPerSecond / 1000);
        element.style.setProperty("position", "absolute", "important");
        element.style.setProperty("left", left + "px", "important");
        element.style.setProperty("top", "2px", "important");
        element.style.setProperty("width", width + "px", "important");
        element.style.setProperty("min-width", width + "px", "important");
        element.style.setProperty("max-width", width + "px", "important");
        element.style.setProperty("height", "46px", "important");
        element.style.setProperty("overflow", "hidden", "important");
      });
    }
  };

  const updateTimelineZoomLabel = () => {
    const label = root.querySelector("[data-role='timeline-zoom-value']");
    if (label) label.textContent = Math.round(timelinePixelsPerSecond / NOVACUT_PIXELS_PER_SECOND * 100) + "%";
    const snap = root.querySelector("[data-timeline-action='snap']");
    if (snap) {
      snap.setAttribute("aria-pressed", String(timelineSnapEnabled));
      snap.classList.toggle("is-active", timelineSnapEnabled);
    }
  };

  const renderTimelineRuler = () => {
    if (!timeline || !rulerTicks) return;
    const durationMs = Math.max(0, Number(engine.registry.durationMs()) || 0);
    const durationSeconds = Math.max(8, Math.ceil(durationMs / 1000));
    const minimumTick = 48 / timelinePixelsPerSecond;
    const tickSteps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const tickEvery = tickSteps.find((step) => step >= minimumTick) || 600;
    const lastTick = Math.ceil(durationSeconds / tickEvery) * tickEvery;
    const contentWidth = Math.max(640, lastTick * timelinePixelsPerSecond + 72);
    timeline.style.setProperty("--nc-content-width", contentWidth + "px");
    timeline.style.setProperty("--nc-ruler-px-per-second", timelinePixelsPerSecond + "px");

    const ticks = [];
    const tickCount = Math.ceil(lastTick / tickEvery);
    for (let index = 0; index <= tickCount; index += 1) {
      const seconds = Number((index * tickEvery).toFixed(3));
      const minutes = Math.floor(seconds / 60);
      const remainder = Math.floor(seconds % 60);
      const label = tickEvery < 1
        ? (seconds === 0 ? "0" : seconds.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "s")
        : minutes + ":" + String(remainder).padStart(2, "0");
      ticks.push(
        '<span data-time-seconds="' + seconds + '" style="--tick-x:' +
        (seconds * timelinePixelsPerSecond) + 'px">' + label + '</span>'
      );
    }
    rulerTicks.innerHTML = ticks.join("");
    rulerTicks.setAttribute("aria-label", "Timeline ruler, " + tickEvery + " second intervals");
    updateTimelineZoomLabel();
    layoutTimelineClips();
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
    videoLane.querySelectorAll('[data-video-thumb]').forEach((thumb) => {
      const clip = videos.find((item) => String(item.id) === thumb.dataset.videoThumb);
      if (!clip?.file) return;
      getVideoThumbnail(clip.file).then((dataUrl) => {
        if (!dataUrl || !thumb.isConnected) return;
        const image = document.createElement('img');
        image.alt = '';
        image.decoding = 'async';
        image.draggable = false;
        image.src = dataUrl;
        thumb.replaceChildren(image);
      }).catch(() => {});
    });
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

    layoutTimelineClips();
    if (canvasEmpty) canvasEmpty.hidden = videos.length > 0;
    const selected = engine.activeTrackId;
    root.querySelectorAll("[data-clip-id]").forEach((element) => {
      element.classList.toggle('is-selected', element.dataset.clipId === String(selected || ''));
    });
  };

  const updateTimelineSelection = ({ id } = {}) => {
    const selectedId = String(id ?? engine.activeTrackId ?? "");
    root.querySelectorAll("[data-clip-id]").forEach((element) => {
      const selected = element.dataset.clipId === selectedId;
      element.classList.toggle("is-selected", selected);
      element.classList.toggle("novacut-selected", selected);
    });
  };

  const applyTimelineZoom = (nextScale) => {
    timelinePixelsPerSecond = Math.max(12, Math.min(144, Number(nextScale) || NOVACUT_PIXELS_PER_SECOND));
    renderTimelineRuler();
    layoutTimelineClips();
    root.__novaCutInteractions?.scheduleSync?.();
  };

  root.addEventListener("click", (event) => {
    const control = event.target?.closest?.("[data-timeline-action]");
    if (!control) return;
    const action = control.dataset.timelineAction;
    if (action === "zoom-in") {
      applyTimelineZoom(timelinePixelsPerSecond * 1.25);
    } else if (action === "zoom-out") {
      applyTimelineZoom(timelinePixelsPerSecond / 1.25);
    } else if (action === "zoom-fit") {
      const availableWidth = Math.max(160, timeline.clientWidth - 120);
      const durationSeconds = Math.max(8, engine.registry.durationMs() / 1000);
      applyTimelineZoom(availableWidth / durationSeconds);
      timeline.scrollLeft = 0;
    } else if (action === "snap") {
      timelineSnapEnabled = !timelineSnapEnabled;
      updateTimelineZoomLabel();
    }
  });

  engine.on('statechange', renderTimeline);
  engine.on('split', renderTimeline);
  engine.on('audio', renderTimeline);
  engine.on('text', renderTimeline);
  engine.on('selectionchange', updateTimelineSelection);

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
  root.__novaCutInteractions = createNovaCutStudioInteractions(root, engine, {
    getPixelsPerSecond: () => timelinePixelsPerSecond,
    getSnapEnabled: () => timelineSnapEnabled
  });

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
