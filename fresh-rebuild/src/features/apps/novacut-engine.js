/* NexusNova NovaCut Engine | v2 playback, timeline, effects and overlays */
import { NovaCutHistory } from "./novacut-history.js";
import { NOVACUT_STICKERS, stickerAssetUrl, loadNovaCutImageAsset } from "./novacut-overlays.js";
import { drawNovaCutEffect, normalizeNovaCutEffect } from "./novacut-effects.js";

export const RUNTIME = Object.freeze({
  FFMPEG_PACKAGE: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js",
  FFMPEG_WORKER: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js",
  CORE_MT_JS: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.js",
  CORE_MT_WASM: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.wasm",
  CORE_MT_WORKER: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.worker.js",
  CORE_ST_JS: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
  CORE_ST_WASM: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm"
});

export const RATIO_PRESETS = Object.freeze({
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 1440, height: 1080 }
});

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
function closestRatioPreset(width, height) {
  const aspect = Number(width) / Number(height);
  if (!Number.isFinite(aspect) || aspect <= 0) return null;
  return Object.entries(RATIO_PRESETS).reduce((best, [name, size]) => {
    const error = Math.abs(Math.log(aspect / (size.width / size.height)));
    return !best || error < best.error ? { name, error } : best;
  }, null)?.name || null;
}
export const isAndroidWebViewUserAgent = (value) => {
  const userAgent = String(value || "");
  return /Android/i.test(userAgent) && /\bwv\b/i.test(userAgent);
};
const msToSec = (value) => Math.max(0, Number(value) || 0) / 1000;
const uid = (prefix) => prefix + "-" + (globalThis.crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(36).slice(2)));
const safeName = (value, fallback) => String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, "_").slice(0, 120) || fallback;
const ext = (value, fallback = "bin") => String(value || "").match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || fallback;

function sourceKind(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/")) return "image";
  return ["png","jpg","jpeg","webp","gif","bmp","avif"].includes(ext(file?.name || file, "")) ? "image" : "video";
}

function cloneObject(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(cloneObject);
  const result = {};
  Object.keys(value).forEach((key) => { result[key] = cloneObject(value[key]); });
  return result;
}

function rgba(hex, alpha) {
  const clean = String(hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return "rgba(" + r + "," + g + "," + b + "," + clamp(alpha == null ? 1 : alpha, 0, 1) + ")";
}

class NovaCutEventBus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, payload) {
    this.map.get(name)?.forEach((fn) => {
      try { fn(payload); } catch (_) {}
    });
  }
  clear() { this.map.clear(); }
}

export class NovaCutTrackRegistry {
  constructor() {
    this.videoTracks = [];
    this.audioTracks = [];
    this.textTracks = [];
    this.overlayTracks = [];
    this.effectTracks = [];
  }

  addVideoClip(input = {}) {
    const transform = input.transform || {};
    const clip = {
      id: String(input.id || uid("video")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(1, Number(input.duration) || 1),
      sourceStartTime: Math.max(0, Number(input.sourceStartTime) || 0),
      x_offset: Number(input.x_offset) || 0,
      scale: Math.max(0.05, Number(input.scale) || Number(transform.scale) || 1),
      transform: {
        scale: Math.max(0.05, Number(transform.scale ?? input.scale) || 1),
        rotation: Number(transform.rotation) || 0,
        flipX: Boolean(transform.flipX),
        flipY: Boolean(transform.flipY)
      },
      volume: clamp(input.volume ?? 1, 0, 4)
    };
    this.videoTracks.push(clip);
    return clip;
  }

  addAudioSegment(input = {}) {
    const segment = {
      id: String(input.id || uid("audio")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(250, Number(input.duration) || 250),
      volume: clamp(input.volume ?? 1, 0, 4)
    };
    this.audioTracks.push(segment);
    return segment;
  }

  addTextCue(input = {}) {
    const style = input.style || {};
    const cue = {
      id: String(input.id || uid("text")),
      text: String(input.text || ""),
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(250, Number(input.duration) || 250),
      style: {
        x: clamp(style.x ?? 0.5, 0, 1),
        y: clamp(style.y ?? 0.82, 0, 1),
        fontFamily: String(style.fontFamily || "system-ui"),
        fontSize: Math.max(8, Number(style.fontSize) || 48),
        color: String(style.color || "#ffffff"),
        background: style.background || null,
        backgroundAlpha: clamp(style.backgroundAlpha ?? 0.62, 0, 1),
        bold: Boolean(style.bold),
        italic: Boolean(style.italic),
        align: ["left","center","right"].includes(style.align) ? style.align : "center",
        rotation: Number(style.rotation) || 0
      }
    };
    this.textTracks.push(cue);
    return cue;
  }

  addOverlay(input = {}) {
    const overlay = {
      id: String(input.id || uid("sticker")),
      type: "sticker",
      asset: String(input.asset || ""),
      label: String(input.label || "Sticker"),
      glyph: String(input.glyph || "★"),
      x: clamp(input.x ?? 0.5, 0.02, 0.98),
      y: clamp(input.y ?? 0.5, 0.02, 0.98),
      width: clamp(input.width ?? 0.2, 0.03, 1),
      height: clamp(input.height ?? 0.2, 0.03, 1),
      scale: Math.max(0.1, Number(input.scale) || 1),
      rotation: Number(input.rotation) || 0,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(250, Number(input.duration) || 3000),
      zIndex: Number(input.zIndex) || 20
    };
    this.overlayTracks.push(overlay);
    return overlay;
  }

  addEffect(input = {}) {
    const effect = normalizeNovaCutEffect(input);
    this.effectTracks.push(effect);
    return effect;
  }

  getById(value) {
    const idValue = String(value || "");
    for (const [type, list] of [
      ["videoTracks", this.videoTracks],
      ["audioTracks", this.audioTracks],
      ["textTracks", this.textTracks],
      ["overlayTracks", this.overlayTracks],
      ["effectTracks", this.effectTracks]
    ]) {
      const item = list.find((entry) => entry.id === idValue);
      if (item) return { type, item };
    }
    return null;
  }

  removeById(value) {
    const record = this.getById(value);
    if (!record) return null;
    const index = this[record.type].findIndex((entry) => entry.id === String(value));
    return index >= 0 ? this[record.type].splice(index, 1)[0] : null;
  }

  durationMs() {
    const all = [
      ...this.videoTracks,
      ...this.audioTracks,
      ...this.textTracks,
      ...this.overlayTracks,
      ...this.effectTracks
    ];
    return Math.max(1, ...all.map((item) => Math.max(0, Number(item.startTime) || 0) + Math.max(0, Number(item.duration) || 0)));
  }
}

export class NovaCutCanvasPreview {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    // Avoid desynchronized video-to-canvas presentation on Android WebView.
    // It can report playback progress while the Canvas preview remains black.
    this.ctx = canvas?.getContext("2d", { alpha: true }) || null;
    this.sourceCanvas = document.createElement("canvas");
    this.sourceCtx = this.sourceCanvas.getContext("2d");
    this.media = new Map();
    this.pending = new Map();
    this.audioMedia = new Map();
    this.audioPending = new Map();
    this.urls = new Map();
    this.stickerMedia = new Map();
    this.stickerPending = new Map();
    this.frameProbe = new Map();
    const userAgent = String(globalThis.navigator?.userAgent || "");
    // Android System WebView may advance the HTMLVideoElement clock while
    // drawImage(video) yields black pixels. Use its native compositor directly
    // on Android WebView; keep Canvas video rendering for ordinary browsers.
    this.forceNativeVideoLayer = isAndroidWebViewUserAgent(userAgent);
    this.nativeFallbackActive = this.forceNativeVideoLayer;
    this.nativePreviewMedia = null;
    this.renderTick = 0;
    this.frameId = 0;
    this.running = false;
    this.resizeObserver = null;
    if (canvas && globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.sourceCanvas.width = width;
    this.sourceCanvas.height = height;
  }

  mountNativePreview(media, clip = null) {
    if (!(media instanceof HTMLVideoElement) || !this.canvas) return;
    const shell = this.canvas.parentElement;
    if (!shell) return;
    if (this.nativePreviewMedia && this.nativePreviewMedia !== media) {
      try {
        this.nativePreviewMedia.pause();
        this.nativePreviewMedia.remove();
      } catch (_) {}
    }
    this.nativePreviewMedia = media;
    media.classList.add("nx-novacut__native-preview-video");
    Object.assign(media.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      zIndex: "0",
      pointerEvents: "none",
      background: "#050507",
      display: "block",
      transformOrigin: "center center",
      transform: [
        "translateX(" + (Number(clip?.x_offset || 0) / Math.max(1, Number(globalThis.devicePixelRatio) || 1)) + "px)",
        "rotate(" + (Number(clip?.transform?.rotation || 0)) + "deg)",
        "scale(" + (Math.max(0.05, Number(clip?.transform?.scale ?? clip?.scale) || 1) * (clip?.transform?.flipX ? -1 : 1)) + "," +
          (Math.max(0.05, Number(clip?.transform?.scale ?? clip?.scale) || 1) * (clip?.transform?.flipY ? -1 : 1)) + ")"
      ].join(" ")
    });
    if (media.parentElement !== shell) shell.insertBefore(media, this.canvas);
    this.canvas.classList.add("nx-novacut__canvas--native-preview");
  }

  enableNativePreviewFallback(media, clip, reason) {
    if (this.nativeFallbackActive) return;
    this.nativeFallbackActive = true;
    this.mountNativePreview(media, clip);
    this.engine.setStatus("Preview adjusted");
    this.engine.events.emit("preview:fallback", {
      clip,
      reason: String(reason || "Canvas did not show video pixels.")
    });
  }

  probeVideoCanvasOutput(clip, media, x, y, width, height) {
    if (this.nativeFallbackActive || !this.ctx || media.readyState < 2) return;
    const key = clip.id;
    const state = this.frameProbe.get(key) || { ticks: 0, lowOutput: 0, done: false };
    if (state.done) return;
    state.ticks += 1;
    if (state.ticks % 8 !== 0) {
      this.frameProbe.set(key, state);
      return;
    }

    try {
      const points = [
        [0.18, 0.18], [0.5, 0.18], [0.82, 0.18],
        [0.18, 0.5], [0.5, 0.5], [0.82, 0.5],
        [0.18, 0.82], [0.5, 0.82], [0.82, 0.82]
      ];
      let visiblePixels = 0;
      for (const [px, py] of points) {
        const sx = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(x + width * px)));
        const sy = Math.max(0, Math.min(this.canvas.height - 1, Math.floor(y + height * py)));
        const data = this.ctx.getImageData(sx, sy, 1, 1).data;
        const luma = data[0] * 0.2126 + data[1] * 0.7152 + data[2] * 0.0722;
        if (luma > 24) visiblePixels += 1;
      }
      // If any sampled frame has actual picture output, do not probe this clip
      // again. If all remain black for several checks while video time advances,
      // bypass video-to-canvas and attach the same decoder as a native DOM video.
      if (visiblePixels >= 2) {
        state.done = true;
        this.frameProbe.set(key, state);
        return;
      }
      state.lowOutput += 1;
      this.frameProbe.set(key, state);
      if (state.lowOutput >= 3 && media.currentTime > 0.25) {
        this.enableNativePreviewFallback(media, clip, "Canvas video pixels stayed black while the media clock advanced.");
      }
    } catch (error) {
      state.lowOutput += 1;
      this.frameProbe.set(key, state);
      if (state.lowOutput >= 2) {
        this.enableNativePreviewFallback(media, clip, "Canvas frame pixels could not be sampled: " + (error?.message || error));
      }
    }
  }

  objectUrl(blob) {
    if (!this.urls.has(blob)) this.urls.set(blob, URL.createObjectURL(blob));
    return this.urls.get(blob);
  }

  async waitForVideoReady(video, timeoutMs) {
    const hasDrawableFrame = () =>
      video.readyState >= 2 &&
      Number(video.videoWidth) > 0 &&
      Number(video.videoHeight) > 0;

    const describeVideo = () => {
      const mediaError = video.error;
      const code = Number(mediaError?.code) || 0;
      return [
        "readyState=" + Number(video.readyState || 0),
        "size=" + Number(video.videoWidth || 0) + "x" + Number(video.videoHeight || 0),
        "networkState=" + Number(video.networkState || 0),
        "mediaError=" + code
      ].join(", ");
    };

    if (hasDrawableFrame()) return;
    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "resize", "playing"].forEach((name) =>
          video.removeEventListener(name, onReady)
        );
        video.removeEventListener("error", onError);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const timer = window.setTimeout(() => {
        finish(new Error("NovaCut received no drawable video frame before timeout (" + describeVideo() + ")."));
      }, timeoutMs);
      const onReady = () => {
        // HAVE_CURRENT_DATA alone is not sufficient: Android can advance the
        // playhead while exposing a zero-sized frame to CanvasRenderingContext2D.
        if (hasDrawableFrame()) finish();
      };
      const onError = () => {
        const mediaError = video.error;
        const code = Number(mediaError?.code) || 0;
        const detail = String(mediaError?.message || "");
        finish(new Error(
          "NovaCut video decoder rejected the media" +
          (code ? " (MediaError " + code + (detail ? ": " + detail : "") + ")" : "") +
          " (" + describeVideo() + ")."
        ));
      };
      ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "resize", "playing"].forEach((name) =>
        video.addEventListener(name, onReady)
      );
      video.addEventListener("error", onError, { once: true });
      onReady();
    });
  }

  async resolve(clip) {
    if (!clip?.file) return null;
    if (this.media.has(clip.id)) return this.media.get(clip.id);
    if (this.pending.has(clip.id)) return this.pending.get(clip.id);

    const task = (async () => {
      if (sourceKind(clip.file) === "image") {
        const image = new Image();
        image.decoding = "async";
        image.src = typeof clip.file === "string" ? clip.file : this.objectUrl(clip.file);
        await new Promise((resolve, reject) => {
          if (image.complete && (image.naturalWidth || image.width)) return resolve();
          const timer = window.setTimeout(() => { cleanup(); reject(new Error("NovaCut image decoder timed out.")); }, 12000);
          const cleanup = () => {
            clearTimeout(timer);
            image.removeEventListener("load", onLoad);
            image.removeEventListener("error", onError);
          };
          const onLoad = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error("NovaCut image decoder rejected the media.")); };
          image.addEventListener("load", onLoad, { once: true });
          image.addEventListener("error", onError, { once: true });
        });
        this.media.set(clip.id, image);
        return image;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.autoplay = false;
      video.setAttribute("playsinline", "");
      video.src = typeof clip.file === "string" ? clip.file : this.objectUrl(clip.file);
      try {
        video.load();
        await this.waitForVideoReady(video, 15000);
      } catch (error) {
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch (_) {}
        throw error;
      }
      this.media.set(clip.id, video);
      return video;
    })();

    this.pending.set(clip.id, task);
    try {
      return await task;
    } finally {
      this.pending.delete(clip.id);
    }
  }

  async resolveAudio(segment) {
    if (!segment?.file) return null;
    if (this.audioMedia.has(segment.id)) return this.audioMedia.get(segment.id);
    if (this.audioPending.has(segment.id)) return this.audioPending.get(segment.id);
    const task = (async () => {
      const audio = document.createElement("audio");
      audio.preload = "auto";
      audio.src = typeof segment.file === "string" ? segment.file : this.objectUrl(segment.file);
      await new Promise((resolve, reject) => {
        if (audio.readyState >= 2) return resolve();
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error("NovaCut audio decoder timed out."));
        }, 15000);
        const cleanup = () => {
          clearTimeout(timer);
          audio.removeEventListener("loadeddata", onReady);
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("error", onError);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("NovaCut audio decoder rejected the media.")); };
        audio.addEventListener("loadeddata", onReady, { once: true });
        audio.addEventListener("canplay", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });
        try { audio.load(); } catch (error) { cleanup(); reject(error); }
      });
      this.audioMedia.set(segment.id, audio);
      return audio;
    })();
    this.audioPending.set(segment.id, task);
    try {
      return await task;
    } finally {
      this.audioPending.delete(segment.id);
    }
  }

  async seek(timestamp) {
    const active = this.engine.getActiveVideoClips();
    await Promise.all(active.map(async (clip) => {
      const media = await this.resolve(clip).catch((error) => {
        this.engine.reportError("decode", error);
        return null;
      });
      if (!(media instanceof HTMLVideoElement)) return;
      const local = Math.max(0, timestamp - clip.startTime);
      const target = Math.max(0, msToSec(clip.sourceStartTime + local));
      try {
        if (Math.abs(media.currentTime - target) > 0.025) media.currentTime = target;
      } catch (_) {}
    }));

    const activeAudio = this.engine.registry.audioTracks.filter((segment) =>
      timestamp >= segment.startTime && timestamp < segment.startTime + segment.duration
    );
    await Promise.all(activeAudio.map(async (segment) => {
      const audio = await this.resolveAudio(segment).catch((error) => {
        this.engine.reportError("audio-decode", error);
        return null;
      });
      if (!audio) return;
      const local = Math.max(0, timestamp - segment.startTime);
      try { audio.currentTime = msToSec(local); } catch (_) {}
      audio.volume = clamp(segment.volume ?? 1, 0, 1);
    }));
  }

  enableVideoAudio(media, clip) {
    if (!(media instanceof HTMLVideoElement)) return;
    // Videos stay muted while preloading; restore source audio for user-requested playback.
    media.defaultMuted = false;
    media.muted = false;
    media.volume = clamp(clip?.volume ?? 1, 0, 1);
  }

  enableActiveVideoAudio() {
    for (const clip of this.engine.getActiveVideoClips()) {
      const media = this.media.get(clip.id);
      if (media instanceof HTMLVideoElement) this.enableVideoAudio(media, clip);
    }
  }

  async playActive() {
    const active = this.engine.getActiveVideoClips();
    if (!active.length) throw new Error("No video clip is active at the current playhead.");
    await Promise.all(active.map(async (clip) => {
      const media = await this.resolve(clip);
      if (!(media instanceof HTMLVideoElement)) return;
      this.enableVideoAudio(media, clip);
      const local = Math.max(0, this.engine.currentTimestamp - clip.startTime);
      const target = Math.max(0, msToSec(clip.sourceStartTime + local));
      try {
        if (Math.abs(media.currentTime - target) > 0.12) media.currentTime = target;
        await media.play();
      } catch (error) {
        throw new Error("NovaCut could not start Android/WebView video playback: " + (error?.message || error));
      }
    }));

    const activeAudio = this.engine.registry.audioTracks.filter((segment) =>
      this.engine.currentTimestamp >= segment.startTime &&
      this.engine.currentTimestamp < segment.startTime + segment.duration
    );
    await Promise.all(activeAudio.map(async (segment) => {
      const audio = await this.resolveAudio(segment);
      const local = Math.max(0, this.engine.currentTimestamp - segment.startTime);
      try {
        if (Math.abs(audio.currentTime - msToSec(local)) > 0.12) audio.currentTime = msToSec(local);
        audio.volume = clamp(segment.volume ?? 1, 0, 1);
        await audio.play();
      } catch (error) {
        throw new Error("NovaCut could not start audio playback: " + (error?.message || error));
      }
    }));
  }

  pauseAll() {
    this.media.forEach((media) => {
      if (media instanceof HTMLVideoElement) {
        try { media.pause(); } catch (_) {}
      }
    });
    this.audioMedia.forEach((audio) => {
      try { audio.pause(); } catch (_) {}
    });
  }

  syncRegistry() {
    const live = new Set(this.engine.registry.videoTracks.map((clip) => clip.id));
    for (const [id, media] of this.media.entries()) {
      if (live.has(id)) continue;
      try { media.pause?.(); media.removeAttribute?.("src"); media.load?.(); } catch (_) {}
      this.media.delete(id);
    }
    for (const id of Array.from(this.pending.keys())) {
      if (!live.has(id)) this.pending.delete(id);
    }
    const liveAudio = new Set(this.engine.registry.audioTracks.map((segment) => segment.id));
    for (const [id, audio] of this.audioMedia.entries()) {
      if (liveAudio.has(id)) continue;
      try { audio.pause?.(); audio.removeAttribute?.("src"); audio.load?.(); } catch (_) {}
      this.audioMedia.delete(id);
    }
    for (const id of Array.from(this.audioPending.keys())) {
      if (!liveAudio.has(id)) this.audioPending.delete(id);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      try { this.render(); } catch (error) { this.engine.reportError("preview", error); }
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    this.resize();
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    const now = this.engine.currentTimestamp;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.nativeFallbackActive) {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, width, height);
    }

    const active = this.engine.getActiveVideoClips().slice().sort((a, b) => a.startTime - b.startTime);
    const activeIds = new Set(active.map((clip) => clip.id));
    for (const [id, media] of this.media.entries()) {
      if (!activeIds.has(id) && media instanceof HTMLVideoElement) {
        try { media.pause(); } catch (_) {}
      }
    }
    for (const [id, audio] of this.audioMedia.entries()) {
      if (!this.engine.registry.audioTracks.some((segment) =>
        segment.id === id &&
        now >= segment.startTime &&
        now < segment.startTime + segment.duration
      )) {
        try { audio.pause(); } catch (_) {}
      }
    }
    for (const clip of active) {
      const media = this.media.get(clip.id);
      if (!media) {
        this.resolve(clip).catch((error) => this.engine.reportError("decode", error));
        continue;
      }
      if (media instanceof HTMLVideoElement) {
        const local = Math.max(0, now - clip.startTime);
        const target = msToSec(clip.sourceStartTime + local);
        // Seeking on every RAF while playing repeatedly flushes the decoder on
        // slower Android/WebView devices. Seek only while paused or when a new
        // clip becomes active and needs its initial timeline position.
        if (!this.engine.isPlaying && Math.abs(media.currentTime - target) > 0.03) {
          try { media.currentTime = target; } catch (_) {}
        }
        if (media.readyState < 2) continue;
        if (this.engine.isPlaying && media.paused) {
          if (Math.abs(media.currentTime - target) > 0.12) {
            try { media.currentTime = target; } catch (_) {}
          }
          this.enableVideoAudio(media, clip);
          media.play().catch((error) => this.engine.reportError("playback", error));
        }
      }

      const isVideoElement = media instanceof HTMLVideoElement;
      const sw = isVideoElement ? Number(media.videoWidth) : Number(media.naturalWidth);
      const sh = isVideoElement ? Number(media.videoHeight) : Number(media.naturalHeight);
      // Never pretend a not-yet-decoded video is a 1x1 image. That masked the
      // decoder failure and let the UI display PLAYING over a black preview.
      if (isVideoElement && (media.readyState < 2 || sw <= 0 || sh <= 0)) {
        continue;
      }
      if (!(sw > 0 && sh > 0)) continue;
      const clipScale = Math.max(0.05, Number(clip.transform?.scale ?? clip.scale) || 1);
      const scaledW = sw * clipScale;
      const scaledH = sh * clipScale;
      const fit = Math.min(width / scaledW, height / scaledH);
      const dw = scaledW * fit;
      const dh = scaledH * fit;
      const x = (width - dw) / 2 + (Number(clip.x_offset) || 0);
      const y = (height - dh) / 2;
      const rotation = (Number(clip.transform?.rotation) || 0) * Math.PI / 180;

      if (isVideoElement && this.nativeFallbackActive) {
        this.mountNativePreview(media, clip);
        continue;
      }

      ctx.save();
      ctx.translate(x + dw / 2, y + dh / 2);
      ctx.rotate(rotation);
      ctx.scale(clip.transform?.flipX ? -1 : 1, clip.transform?.flipY ? -1 : 1);
      try {
        ctx.drawImage(media, -dw / 2, -dh / 2, dw, dh);
      } catch (error) {
        ctx.restore();
        if (isVideoElement) {
          this.enableNativePreviewFallback(media, clip, "Canvas drawImage failed: " + (error?.message || error));
          continue;
        }
        throw error;
      }
      ctx.restore();
      if (isVideoElement) this.probeVideoCanvasOutput(clip, media, x, y, dw, dh);
    }

    this.sourceCtx?.setTransform(1, 0, 0, 1, 0, 0);
    this.sourceCtx?.clearRect(0, 0, width, height);
    this.sourceCtx?.drawImage(this.canvas, 0, 0, width, height);

    const effects = this.engine.registry.effectTracks
      .filter((effect) => now >= effect.startTime && now < effect.startTime + effect.duration)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    for (const effect of effects) drawNovaCutEffect(ctx, this.sourceCanvas, effect, width, height);

    const stickers = this.engine.registry.overlayTracks
      .filter((item) => now >= item.startTime && now < item.startTime + item.duration)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    const activeAudio = this.engine.registry.audioTracks.filter((segment) =>
      now >= segment.startTime && now < segment.startTime + segment.duration
    );
    if (this.engine.isPlaying) {
      activeAudio.forEach((segment) => {
        const audio = this.audioMedia.get(segment.id);
        if (audio) {
          audio.volume = clamp(segment.volume ?? 1, 0, 1);
          if (audio.paused) audio.play().catch(() => {});
        }
      });
    }

    for (const sticker of stickers) this.drawSticker(ctx, sticker, width, height);

    const texts = this.engine.registry.textTracks
      .filter((cue) => now >= cue.startTime && now < cue.startTime + cue.duration)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    for (const cue of texts) this.drawText(ctx, cue, width, height);
  }

  drawSticker(ctx, overlay, width, height) {
    let image = this.stickerMedia.get(overlay.id);
    if (!image) {
      if (!this.stickerPending.has(overlay.id)) {
        const task = loadNovaCutImageAsset(overlay.asset).then((value) => {
          this.stickerMedia.set(overlay.id, value);
          this.stickerPending.delete(overlay.id);
        }).catch((error) => {
          this.stickerPending.delete(overlay.id);
          this.engine.reportError("sticker", error);
        });
        this.stickerPending.set(overlay.id, task);
      }
      return;
    }
    const w = Math.max(10, width * Number(overlay.width || 0.2) * Number(overlay.scale || 1));
    const h = Math.max(10, height * Number(overlay.height || 0.2) * Number(overlay.scale || 1));
    const x = clamp(overlay.x, 0, 1) * width;
    const y = clamp(overlay.y, 0, 1) * height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Number(overlay.rotation) || 0) * Math.PI / 180);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  drawText(ctx, cue, width, height) {
    const style = cue.style || {};
    const x = clamp(style.x, 0, 1) * width;
    const y = clamp(style.y, 0, 1) * height;
    const size = Math.max(8, Number(style.fontSize) || 48);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Number(style.rotation) || 0) * Math.PI / 180);
    ctx.font = (style.italic ? "italic " : "") + (style.bold ? "800 " : "600 ") + size + "px " + (style.fontFamily || "system-ui");
    ctx.textAlign = style.align || "center";
    ctx.textBaseline = "middle";
    const lines = String(cue.text).split(/\r?\n/).slice(0, 8);
    const lh = size * 1.2;
    const widest = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    const total = lines.length * lh;
    if (style.background) {
      ctx.fillStyle = rgba(style.background, style.backgroundAlpha);
      ctx.fillRect(-widest / 2 - size * 0.35, -total / 2 - size * 0.2, widest + size * 0.7, total + size * 0.4);
    }
    ctx.fillStyle = style.color || "#ffffff";
    lines.forEach((line, index) => ctx.fillText(line, 0, -total / 2 + index * lh + lh / 2));
    ctx.restore();
  }

  dispose() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.media.forEach((media) => {
      try { media.pause?.(); media.removeAttribute?.("src"); media.load?.(); media.remove?.(); } catch (_) {}
    });
    this.nativePreviewMedia = null;
    this.canvas?.classList.remove("nx-novacut__canvas--native-preview");
    this.urls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    this.media.clear();
    this.pending.clear();
    this.audioMedia.forEach((audio) => {
      try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (_) {}
    });
    this.audioMedia.clear();
    this.audioPending.clear();
    this.stickerMedia.clear();
    this.stickerPending.clear();
    this.urls.clear();
  }
}

class NovaCutFFmpegRuntime {
  constructor(engine) {
    this.engine = engine;
    this.instance = null;
    this.mode = null;
    this.loading = null;
  }

  async ensureLoaded() {
    if (this.instance?.loaded) return this.instance;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const module = await import(RUNTIME.FFMPEG_PACKAGE);
        const FFmpeg = module.FFmpeg || module.default?.FFmpeg;
        if (typeof FFmpeg !== "function") throw new Error("NovaCut: FFmpeg runtime did not expose FFmpeg.");
        const candidates = this.engine.hardware.multithreadCapable
          ? [
              { mode: "mt", coreURL: RUNTIME.CORE_MT_JS, wasmURL: RUNTIME.CORE_MT_WASM, workerURL: RUNTIME.CORE_MT_WORKER },
              { mode: "st", coreURL: RUNTIME.CORE_ST_JS, wasmURL: RUNTIME.CORE_ST_WASM }
            ]
          : [
              { mode: "st", coreURL: RUNTIME.CORE_ST_JS, wasmURL: RUNTIME.CORE_ST_WASM }
            ];
        let lastError = null;
        for (const candidate of candidates) {
          const ffmpeg = new FFmpeg();
          try {
            ffmpeg.on("progress", (event) => this.engine.events.emit("export:progress", {
              progress: clamp(event?.progress ?? 0, 0, 1),
              time: Number(event?.time) || 0
            }));
            ffmpeg.on("log", (event) => this.engine.events.emit("log", event));
            await ffmpeg.load({ ...candidate, classWorkerURL: RUNTIME.FFMPEG_WORKER });
            this.instance = ffmpeg;
            this.mode = candidate.mode;
            this.engine.events.emit("runtime:ready", { mode: this.mode, hardware: this.engine.hardware });
            return ffmpeg;
          } catch (error) {
            lastError = error;
            try { ffmpeg.terminate(); } catch (_) {}
          }
        }
        throw lastError || new Error("NovaCut: FFmpeg runtime could not be initialized.");
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  async terminate() {
    try { this.instance?.terminate(); } catch (_) {}
    this.instance = null;
    this.mode = null;
  }
}

class NovaCutCommandCompiler {
  constructor(engine) { this.engine = engine; }

  compile(options = {}) {
    const ratio = RATIO_PRESETS[options.ratio || this.engine.aspectRatio] || RATIO_PRESETS["16:9"];
    const width = Math.max(2, Math.floor(Number(options.width) || ratio.width) & ~1);
    const height = Math.max(2, Math.floor(Number(options.height) || ratio.height) & ~1);
    const fps = clamp(options.fps || 30, 1, 60);
    const durationMs = this.engine.registry.durationMs();
    const duration = Math.max(0.001, msToSec(durationMs));
    const args = ["-hide_banner", "-nostdin", "-y"];
    const inputs = [];

    const addInput = (file, kind, prefix, extra = {}) => {
      const index = inputs.length;
      const fallbackExt = kind === "audio" ? "mp3" : kind === "image" ? "png" : "mp4";
      const name = safeName(file?.name || file, prefix + "-" + index + "." + fallbackExt);
      const path = "/novacut/" + index + "-" + name;
      const item = { file, path, index, kind, ...extra };
      inputs.push(item);
      return item;
    };

    const videos = this.engine.registry.videoTracks.filter((clip) => clip.file)
      .map((clip) => ({ clip, input: addInput(clip.file, sourceKind(clip.file), "video") }));
    const audios = this.engine.registry.audioTracks.filter((segment) => segment.file)
      .map((segment) => ({ segment, input: addInput(segment.file, "audio", "audio") }));
    const textAssets = this.engine.registry.textTracks.map((cue, index) => ({
      cue,
      input: addInput({ name: "text-" + index + ".png", __textAsset: true }, "image", "text", {
        textAsset: true,
        path: "/novacut/text-" + String(index).padStart(3, "0") + ".png"
      })
    }));
    const stickerAssets = this.engine.registry.overlayTracks.map((overlay, index) => ({
      overlay,
      input: addInput({ name: "sticker-" + index + ".png", __stickerAsset: true }, "image", "sticker", {
        stickerAsset: true,
        path: "/novacut/sticker-" + String(index).padStart(3, "0") + ".png"
      })
    }));

    for (const input of inputs) {
      if (input.kind === "image") args.push("-loop", "1");
      args.push("-i", input.path);
    }

    const filters = ["color=c=black:s=" + width + "x" + height + ":r=" + fps + ":d=" + duration.toFixed(3) + "[base]"];
    let currentVideo = "base";

    videos.forEach(({ clip, input }, index) => {
      const src = "vsrc" + index;
      const out = "vout" + index;
      const transform = clip.transform || {};
      const scale = Math.max(0.05, Number(transform.scale ?? clip.scale) || 1);
      const begin = msToSec(clip.sourceStartTime);
      const end = begin + msToSec(clip.duration);
      const startAt = msToSec(clip.startTime);
      const vf = [
        // First fit to the selected output canvas, then apply the editor zoom.
        // The previous code scaled by clip.zoom relative to source dimensions,
        // which made previews and exported framing disagree.
        "scale=" + width + ":" + height + ":force_original_aspect_ratio=decrease",
        "scale=trunc(iw*" + scale + "/2)*2:trunc(ih*" + scale + "/2)*2"
      ];
      if (transform.flipX) vf.push("hflip");
      if (transform.flipY) vf.push("vflip");
      const rotation = ((Number(transform.rotation) || 0) % 360 + 360) % 360;
      if (rotation === 90) vf.push("transpose=1");
      else if (rotation === 180) vf.push("hflip,vflip");
      else if (rotation === 270) vf.push("transpose=2");
      else if (rotation !== 0) vf.push("rotate=" + (rotation * Math.PI / 180).toFixed(6) + ":c=black@0:ow=rotw(iw):oh=roth(ih)");
      filters.push(
        "[" + input.index + ":v:0]trim=start=" + begin.toFixed(3) + ":end=" + end.toFixed(3) +
        ",setpts=PTS-STARTPTS+" + startAt.toFixed(3) + "/TB," + vf.join(",") + ",format=rgba[" + src + "]"
      );
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=x=(W-w)/2+" + (Number(clip.x_offset) || 0) +
        ":y=(H-h)/2:eof_action=pass:shortest=0:repeatlast=0[" + out + "]"
      );
      currentVideo = out;
    });

    let currentAudio = null;
    const audioLabels = [];

    // Include source audio only when the parser positively identified an
    // audio stream, avoiding references to a missing [input:a:0] stream.
    videos.forEach(({ clip, input }, index) => {
      if (clip.metadata?.hasAudio !== true) return;
      const label = "vsrcaudio" + index;
      const sourceStart = msToSec(clip.sourceStartTime);
      const clipDuration = msToSec(clip.duration);
      const delay = Math.max(0, Math.round(Number(clip.startTime) || 0));
      filters.push(
        "[" + input.index + ":a:0]atrim=start=" + sourceStart.toFixed(3) +
        ":duration=" + clipDuration.toFixed(3) +
        ",asetpts=PTS-STARTPTS,volume=" + clamp(clip.volume ?? 1, 0, 4).toFixed(3) +
        ",adelay=" + delay + "|" + delay + "[" + label + "]"
      );
      audioLabels.push(label);
    });

    audios.forEach(({ segment, input }, index) => {
      const label = "asrc" + index;
      const delay = Math.max(0, Math.round(Number(segment.startTime) || 0));
      filters.push(
        "[" + input.index + ":a:0]atrim=duration=" + msToSec(segment.duration).toFixed(3) +
        ",asetpts=PTS-STARTPTS,volume=" + clamp(segment.volume ?? 1, 0, 4).toFixed(3) +
        ",adelay=" + delay + "|" + delay + "[" + label + "]"
      );
      audioLabels.push(label);
    });

    if (audioLabels.length === 1) {
      currentAudio = audioLabels[0];
    } else if (audioLabels.length > 1) {
      filters.push(
        audioLabels.map((label) => "[" + label + "]").join("") +
        "amix=inputs=" + audioLabels.length +
        ":duration=longest:dropout_transition=0:normalize=0,aresample=async=1:first_pts=0[aout]"
      );
      currentAudio = "aout";
    }

    this.engine.registry.effectTracks.forEach((effect, index) => {
      const out = "eout" + index;
      const start = msToSec(effect.startTime);
      const end = msToSec(effect.startTime + effect.duration);
      const x = clamp(effect.x, 0, 0.94);
      const y = clamp(effect.y, 0, 0.94);
      const w = clamp(effect.width, 0.06, 1 - x);
      const h = clamp(effect.height, 0.06, 1 - y);
      if (effect.type === "censor") {
        filters.push(
          "[" + currentVideo + "]drawbox=x=main_w*" + x.toFixed(5) +
          ":y=main_h*" + y.toFixed(5) +
          ":w=main_w*" + w.toFixed(5) +
          ":h=main_h*" + h.toFixed(5) +
          ":color=" + String(effect.color || "black") + "@" + clamp(effect.opacity ?? 0.96, 0, 1).toFixed(3) +
          ":t=fill:enable='between(t," + start.toFixed(3) + "," + end.toFixed(3) + ")'[" + out + "]"
        );
      } else {
        const base = "efxbase" + index;
        const region = "efxregion" + index;
        const processed = "efxprocessed" + index;
        filters.push("[" + currentVideo + "]split[" + base + "][" + region + "]");
        let regionFilter =
          "crop=w=trunc(iw*" + w.toFixed(5) + "/2)*2:h=trunc(ih*" + h.toFixed(5) + "/2)*2:x=iw*" +
          x.toFixed(5) + ":y=ih*" + y.toFixed(5);
        if (effect.type === "blur") {
          regionFilter += ",boxblur=luma_radius=" + clamp(effect.intensity ?? 14, 1, 48).toFixed(1) + ":luma_power=1";
        } else if (effect.type === "mosaic") {
          const block = Math.max(2, Math.floor(clamp(effect.intensity ?? 12, 2, 64)));
          regionFilter += ",scale=trunc(iw/" + block + "):trunc(ih/" + block + "):flags=area,scale=iw*" + block + ":ih*" + block + ":flags=neighbor";
        } else {
          const block = Math.max(2, Math.floor(clamp(effect.intensity ?? 10, 2, 64)));
          const seed = Math.max(1, Math.floor(Number(effect.seed) || 1));
          regionFilter += ",shufflepixels=mode=block:width=" + block + ":height=" + block + ":seed=" + seed;
        }
        filters.push("[" + region + "]" + regionFilter + "[" + processed + "]");
        filters.push(
          "[" + base + "][" + processed + "]overlay=x=main_w*" + x.toFixed(5) +
          ":y=main_h*" + y.toFixed(5) +
          ":enable='between(t," + start.toFixed(3) + "," + end.toFixed(3) + ")':eof_action=pass[" + out + "]"
        );
      }
      currentVideo = out;
    });

    textAssets.forEach(({ cue, input }, index) => {
      const src = "tsrc" + index;
      const out = "tout" + index;
      const start = msToSec(cue.startTime);
      const end = msToSec(cue.startTime + cue.duration);
      filters.push("[" + input.index + ":v:0]format=rgba[" + src + "]");
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=0:0:enable='between(t," + start.toFixed(3) + "," + end.toFixed(3) +
        ")':eof_action=pass:shortest=0:repeatlast=0[" + out + "]"
      );
      currentVideo = out;
    });

    stickerAssets.forEach(({ overlay, input }, index) => {
      const src = "ssrc" + index;
      const out = "sout" + index;
      const start = msToSec(overlay.startTime);
      const end = msToSec(overlay.startTime + overlay.duration);
      const w = clamp(Number(overlay.width || 0.2) * Number(overlay.scale || 1), 0.02, 1);
      const h = clamp(Number(overlay.height || 0.2) * Number(overlay.scale || 1), 0.02, 1);
      const x = clamp(Number(overlay.x || 0.5) - w / 2, 0, Math.max(0, 1 - w));
      const y = clamp(Number(overlay.y || 0.5) - h / 2, 0, Math.max(0, 1 - h));
      const targetWidth = Math.max(2, Math.floor(width * w) & ~1);
      const targetHeight = Math.max(2, Math.floor(height * h) & ~1);
      filters.push(
        "[" + input.index + ":v:0]format=rgba,scale=" + targetWidth + ":" + targetHeight +
        ":force_original_aspect_ratio=decrease,pad=" + targetWidth + ":" + targetHeight +
        ":(ow-iw)/2:(oh-ih)/2:color=black@0[" + src + "]"
      );
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=x=main_w*" + x.toFixed(5) +
        ":y=main_h*" + y.toFixed(5) +
        ":enable='between(t," + start.toFixed(3) + "," + end.toFixed(3) + ")':eof_action=pass:shortest=0:repeatlast=0[" + out + "]"
      );
      currentVideo = out;
    });

    const outputName = safeName(options.outputFileName || "novacut-export.mp4", "novacut-export.mp4");
    const outputPath = "/novacut/" + outputName;
    args.push("-filter_complex", filters.join(";"), "-map", "[" + currentVideo + "]");
    if (currentAudio) args.push("-map", "[" + currentAudio + "]");
    args.push(
      "-t", duration.toFixed(3),
      "-r", String(fps),
      "-c:v", "libx264",
      "-preset", String(options.preset || "ultrafast"),
      "-crf", String(clamp(options.crf ?? 20, 0, 51)),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart"
    );
    if (currentAudio) args.push("-c:a", "aac", "-b:a", String(options.audioBitrate || "192k"));
    args.push(outputPath);

    return { args, inputs, textAssets, stickerAssets, outputPath, outputName, width, height, fps, durationMs };
  }
}

export class NovaCutEngine {
  constructor(options = {}) {
    this.root = options.root || null;
    this.registry = new NovaCutTrackRegistry();
    this.events = new NovaCutEventBus();
    this.history = new NovaCutHistory(this, { limit: 100 });
    this.aspectRatio = RATIO_PRESETS[options.aspectRatio] ? options.aspectRatio : "16:9";
    this.aspectRatioExplicit = Boolean(RATIO_PRESETS[options.aspectRatio]);
    this.currentTimestamp = 0;
    this.activeTrackId = null;
    this.isPlaying = false;
    this.playbackFrame = 0;
    this.canvasPointerState = null;
    this.hardware = {
      hardwareConcurrency: Math.max(1, Number(globalThis.navigator?.hardwareConcurrency) || 1),
      deviceMemory: Number(globalThis.navigator?.deviceMemory) || 0,
      crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
      sharedArrayBufferAvailable: typeof SharedArrayBuffer !== "undefined",
      multithreadCapable: Boolean(globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined")
    };
    this.runtime = new NovaCutFFmpegRuntime(this);
    this.compiler = new NovaCutCommandCompiler(this);
    this.preview = null;
    this.abort = null;
    if (this.root) this.mount(this.root);
  }

  on(event, callback) { return this.events.on(event, callback); }
  emitHistoryState() { this.events.emit("historystatechange", { canUndo: this.history.canUndo(), canRedo: this.history.canRedo() }); }

  mount(root) {
    this.root = root;
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const canvas = root.querySelector("[data-role='preview-canvas']");
    this.preview?.dispose();
    this.preview = new NovaCutCanvasPreview(this, canvas);
    this.preview.start();

    const bind = (action, handler) => {
      root.querySelectorAll("[data-action=\"" + action + "\"]").forEach((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          if (action === "play" && !this.isPlaying) {
            // Unmute synchronously inside the tap so Android WebView retains user activation.
            this.preview?.enableActiveVideoAudio();
          }
          Promise.resolve().then(handler).catch((error) => this.reportError("action:" + action, error));
        }, { signal });
      });
    };

    bind("undo", () => this.undo());
    bind("redo", () => this.redo());
    bind("split", () => this.executeSplitAction(this.activeTrackId, this.currentTimestamp));
    bind("audio", () => this.importAudio());
    bind("text", () => this.addTextOverlay());
    bind("ratio", () => this.cycleRatio());
    bind("export", () => this.compileAndExportVideo());
    bind("play", () => this.togglePlayback());

    root.addEventListener("click", (event) => {
      const target = event.target?.closest?.("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (action === "sticker") this.openStickerPicker();
      else if (action === "effects") this.openEffectsEditor();
      else if (action === "more") this.openToolMenu();
    }, { signal });

    this.installCanvasInteractions(canvas);
    this.events.emit("selectionchange", { id: this.activeTrackId });
    this.emitHistoryState();
    return this;
  }

  getState() {
    return {
      videoTracks: this.registry.videoTracks,
      audioTracks: this.registry.audioTracks,
      textTracks: this.registry.textTracks,
      overlayTracks: this.registry.overlayTracks,
      effectTracks: this.registry.effectTracks
    };
  }

  findFirstExistingId(preferred) {
    if (preferred && this.registry.getById(preferred)) return preferred;
    return this.registry.videoTracks[0]?.id ||
      this.registry.textTracks[0]?.id ||
      this.registry.overlayTracks[0]?.id ||
      this.registry.effectTracks[0]?.id ||
      this.registry.audioTracks[0]?.id ||
      null;
  }

  selectClip(id) {
    this.activeTrackId = this.registry.getById(id)?.item?.id || null;
    this.events.emit("selectionchange", { id: this.activeTrackId });
    this.refresh();
    return this.activeTrackId;
  }

  addVideoClip(input) {
    const before = this.history.capture();
    const clip = this.registry.addVideoClip(input);
    this.activeTrackId = clip.id;
    this.history.record(before, "Add video");
    this.refresh();
    void this.prepareClip(clip).catch(() => {});
    return clip;
  }

  addAudioSegment(input) {
    const before = this.history.capture();
    const segment = this.registry.addAudioSegment(input);
    this.activeTrackId = segment.id;
    this.history.record(before, "Add audio");
    this.refresh();
    return segment;
  }

  addTextCue(input) {
    const before = this.history.capture();
    const cue = this.registry.addTextCue(input);
    this.activeTrackId = cue.id;
    this.history.record(before, "Add text");
    this.refresh();
    return cue;
  }

  addSticker(sticker, options = {}) {
    const before = this.history.capture();
    const item = this.registry.addOverlay({
      id: options.id || uid("sticker"),
      asset: options.asset || stickerAssetUrl(sticker),
      label: options.label || sticker?.label || "Sticker",
      glyph: sticker?.glyph || "★",
      x: options.x ?? 0.5,
      y: options.y ?? 0.5,
      width: options.width ?? 0.2,
      height: options.height ?? 0.2,
      scale: options.scale ?? 1,
      rotation: options.rotation ?? 0,
      startTime: options.startTime ?? this.currentTimestamp,
      duration: options.duration ?? 3000,
      zIndex: options.zIndex ?? 20
    });
    this.activeTrackId = item.id;
    this.history.record(before, "Add sticker");
    this.refresh();
    return item;
  }

  addEffect(input = {}) {
    const before = this.history.capture();
    const effect = this.registry.addEffect({ ...input, startTime: input.startTime ?? this.currentTimestamp });
    this.activeTrackId = effect.id;
    this.history.record(before, String(effect.type || "Effect") + " effect");
    this.refresh();
    return effect;
  }

  removeSelected() {
    if (!this.registry.getById(this.activeTrackId)) {
      this.setStatus("Select an item first.");
      return false;
    }
    const before = this.history.capture();
    this.registry.removeById(this.activeTrackId);
    this.activeTrackId = this.findFirstExistingId(null);
    this.history.record(before, "Delete");
    this.refresh();
    return true;
  }

  duplicateSelected() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected) {
      this.setStatus("Select an item before duplicating.");
      return false;
    }
    const before = this.history.capture();
    const item = cloneObject(selected.item);
    let copy = null;
    if (selected.type === "videoTracks") copy = this.registry.addVideoClip({ ...item, id: uid("video"), startTime: item.startTime + item.duration });
    else if (selected.type === "audioTracks") copy = this.registry.addAudioSegment({ ...item, id: uid("audio"), startTime: item.startTime + item.duration });
    else if (selected.type === "textTracks") copy = this.registry.addTextCue({ ...item, id: uid("text"), startTime: item.startTime + item.duration });
    else if (selected.type === "overlayTracks") copy = this.registry.addOverlay({ ...item, id: uid("sticker"), startTime: item.startTime + item.duration });
    else if (selected.type === "effectTracks") copy = this.registry.addEffect({ ...item, id: uid("effect"), startTime: item.startTime + item.duration });
    if (!copy) return false;
    this.activeTrackId = copy.id;
    this.history.record(before, "Duplicate");
    this.refresh();
    return true;
  }

  rotateSelected() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected) return false;
    const before = this.history.capture();
    if (selected.type === "videoTracks") selected.item.transform.rotation = (Number(selected.item.transform.rotation || 0) + 90) % 360;
    else if (selected.type === "overlayTracks") selected.item.rotation = (Number(selected.item.rotation || 0) + 15) % 360;
    else if (selected.type === "textTracks") selected.item.style.rotation = (Number(selected.item.style.rotation || 0) + 15) % 360;
    this.history.record(before, "Rotate");
    this.refresh();
    return true;
  }

  flipSelected(axis = "x") {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") return false;
    const before = this.history.capture();
    const key = axis === "y" ? "flipY" : "flipX";
    selected.item.transform[key] = !selected.item.transform[key];
    this.history.record(before, "Flip");
    this.refresh();
    return true;
  }

  beginHistoryTransaction(label) { return this.history.begin(label); }
  commitHistoryTransaction() { return this.history.commit(); }
  cancelHistoryTransaction() { return this.history.cancel(); }

  undo() {
    const result = this.history.undo();
    if (result) this.setStatus("Undo");
    return result;
  }

  redo() {
    const result = this.history.redo();
    if (result) this.setStatus("Redo");
    return result;
  }

  applyInitialAspectRatio(clip, metadata = clip?.metadata) {
    if (this.aspectRatioExplicit || this.registry.videoTracks.length !== 1) return null;
    const inferredRatio = closestRatioPreset(metadata?.width, metadata?.height);
    if (!inferredRatio || inferredRatio === this.aspectRatio) return inferredRatio;
    this.aspectRatio = inferredRatio;
    this.events.emit("ratio", {
      ratio: inferredRatio,
      size: RATIO_PRESETS[inferredRatio],
      automatic: true,
      clipId: clip?.id || null
    });
    this.refresh();
    return inferredRatio;
  }

  cycleRatio() {
    const ratios = Object.keys(RATIO_PRESETS);
    const currentIndex = Math.max(0, ratios.indexOf(this.aspectRatio));
    const nextRatio = ratios[(currentIndex + 1) % ratios.length];
    this.aspectRatio = nextRatio;
    this.aspectRatioExplicit = true;
    this.events.emit("ratio", {
      ratio: nextRatio,
      size: RATIO_PRESETS[nextRatio]
    });
    this.setStatus(nextRatio);
    this.refresh();
    return nextRatio;
  }

  setPlayhead(timestamp) {
    this.currentTimestamp = clamp(timestamp, 0, this.registry.durationMs());
    const current = this.root?.querySelector("[data-role='current-time']");
    const duration = this.root?.querySelector("[data-role='duration']");
    if (current) current.textContent = this.format(this.currentTimestamp);
    if (duration) duration.textContent = this.format(this.registry.durationMs());
    if (!this.isPlaying) void this.preview?.seek(this.currentTimestamp);
    this.events.emit("playheadchange", { timestamp: this.currentTimestamp });
  }

  format(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((n) => String(n).padStart(2, "0")).join(":");
  }

  togglePlayback() { return this.isPlaying ? this.pause() : this.play(); }

  async play() {
    if (this.isPlaying) return;
    if (!this.registry.videoTracks.length) {
      this.setStatus("Add video media first.");
      return;
    }
    try {
      await this.preview?.playActive();
    } catch (error) {
      this.reportError("playback", error);
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;
    this.setStatus("Playing");
    let last = performance.now();
    const tick = (now) => {
      if (!this.isPlaying) return;
      const delta = Math.max(0, now - last);
      last = now;
      const duration = this.registry.durationMs();
      const active = this.getActiveVideoClips()
        .slice()
        .sort((a, b) => b.startTime - a.startTime);
      const clockClip = active.find((clip) => {
        const media = this.preview?.media.get(clip.id);
        return media instanceof HTMLVideoElement &&
          media.readyState >= 2 &&
          Number.isFinite(media.currentTime);
      });
      if (clockClip) {
        const media = this.preview.media.get(clockClip.id);
        const mediaTimelineTime = clockClip.startTime +
          media.currentTime * 1000 -
          Math.max(0, Number(clockClip.sourceStartTime) || 0);
        // Use the actual decoder clock, not RAF wall time. The previous
        // implementation advanced playhead and aggressively re-seeked when a
        // MediaTek/WebView decoder lagged, which could keep the preview black.
        this.currentTimestamp = clamp(
          Math.max(this.currentTimestamp, mediaTimelineTime),
          0,
          duration
        );
      } else {
        // Preserve navigation over timeline gaps until the next clip is active.
        this.currentTimestamp = Math.min(duration, this.currentTimestamp + delta);
      }
      this.setPlayhead(this.currentTimestamp);
      if (this.currentTimestamp >= duration) {
        this.pause();
        this.setPlayhead(0);
        return;
      }
      this.playbackFrame = requestAnimationFrame(tick);
    };
    this.playbackFrame = requestAnimationFrame(tick);
  }

  pause() {
    this.isPlaying = false;
    cancelAnimationFrame(this.playbackFrame);
    this.playbackFrame = 0;
    this.preview?.pauseAll();
    this.setStatus("Paused");
  }

  getActiveVideoClips() {
    const t = this.currentTimestamp;
    return this.registry.videoTracks.filter((clip) => t >= clip.startTime && t < clip.startTime + clip.duration);
  }

  async prepareClip(clip) {
    if (!clip?.file || !this.preview) return null;
    this.events.emit("media:decoding", { clip });
    try {
      const media = await this.preview.resolve(clip);
      if (media instanceof HTMLVideoElement) {
        try { media.currentTime = msToSec(clip.sourceStartTime); } catch (_) {}
      }
      this.events.emit("media:ready", { clip, media });
      return media;
    } catch (error) {
      this.events.emit("media:decode-error", { clip, error });
      this.reportError("decode", error);
      throw error;
    }
  }

  executeSplitAction(activeTrackId, currentTimestamp) {
    const targetId = activeTrackId || this.activeTrackId;
    const record = this.registry.getById(targetId);
    if (!record || record.type !== "videoTracks") {
      this.setStatus("Select a video clip before using Split.");
      return { success: false };
    }
    const before = this.history.capture();
    const clip = record.item;
    const timestamp = clamp(currentTimestamp, clip.startTime, clip.startTime + clip.duration);
    const left = timestamp - clip.startTime;
    const right = clip.duration - left;
    const frame = 1000 / 30;
    if (left <= frame || right <= frame) {
      this.setStatus("Move the playhead away from the clip edge.");
      return { success: false, reason: "split-point-too-close-to-boundary" };
    }
    const index = this.registry.videoTracks.findIndex((item) => item.id === clip.id);
    const first = { ...cloneObject(clip), id: uid("video"), duration: left };
    const second = { ...cloneObject(clip), id: uid("video"), startTime: timestamp, duration: right, sourceStartTime: clip.sourceStartTime + left };
    this.registry.videoTracks.splice(index, 1, first, second);
    this.activeTrackId = second.id;
    this.history.record(before, "Split");
    this.refresh();
    this.events.emit("split", { originalClipId: clip.id, firstClip: first, secondClip: second, splitTimestamp: timestamp });
    return { success: true, firstClip: first, secondClip: second };
  }

  importAudio() {
    if (!this.root) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.hidden = true;
    this.root.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        input.remove();
        return;
      }

      const probe = document.createElement("audio");
      const url = URL.createObjectURL(file);
      let timer = 0;
      let settled = false;
      const cleanup = () => {
        if (timer) window.clearTimeout(timer);
        probe.removeEventListener("loadedmetadata", onMetadata);
        probe.removeEventListener("error", onError);
        try { probe.pause(); probe.removeAttribute("src"); probe.load(); } catch (_) {}
        try { URL.revokeObjectURL(url); } catch (_) {}
        input.remove();
      };
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        const durationSeconds = Number(probe.duration);
        cleanup();
        if (error || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          this.reportError("audio-import", error || new Error("NovaCut could not read the selected audio duration."));
          return;
        }
        const segment = this.addAudioSegment({
          file,
          startTime: this.currentTimestamp,
          duration: Math.round(durationSeconds * 1000),
          volume: 1
        });
        this.events.emit("audio", { segment });
      };
      const onMetadata = () => finish();
      const onError = () => finish(new Error("NovaCut could not decode the selected audio file."));
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", onMetadata, { once: true });
      probe.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error("NovaCut audio duration probe timed out.")), 15000);
      probe.src = url;
      try { probe.load(); } catch (error) { finish(error); }
    }, { once: true });
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.click();
  }

  addTextOverlay() { this.openTextEditor(); }

  openTextEditor() {
    const sheet = this.openSheet("Add text");
    sheet.body.innerHTML =
      '<div class="nx-novacut__form-grid">' +
      '<label>Text<input data-field="text" type="text" maxlength="240" placeholder="Write your caption"></label>' +
      '<label>Font size<input data-field="size" type="number" min="12" max="180" value="48"></label>' +
      '<label>Text color<input data-field="color" type="color" value="#ffffff"></label>' +
      '<label>Background<input data-field="background" type="color" value="#000000"></label></div>' +
      '<label class="nx-novacut__check-row"><input data-field="bold" type="checkbox" checked> Bold</label>' +
      '<div class="nx-novacut__sheet-actions"><button type="button" class="nx-novacut__secondary" data-sheet-close>Cancel</button><button type="button" class="nx-novacut__primary" data-save-text>Add text</button></div>';
    sheet.body.querySelector("[data-save-text]")?.addEventListener("click", () => {
      const text = String(sheet.body.querySelector("[data-field='text']")?.value || "").trim();
      if (!text) return;
      this.addTextCue({
        text,
        startTime: this.currentTimestamp,
        duration: 3000,
        style: {
          x: 0.5,
          y: 0.82,
          fontSize: clamp(sheet.body.querySelector("[data-field='size']")?.value, 12, 180),
          color: sheet.body.querySelector("[data-field='color']")?.value || "#ffffff",
          background: sheet.body.querySelector("[data-field='background']")?.value || "#000000",
          backgroundAlpha: 0.62,
          bold: Boolean(sheet.body.querySelector("[data-field='bold']")?.checked)
        }
      });
      this.closeSheet(sheet.root);
    });
  }

  openStickerPicker() {
    const sheet = this.openSheet("Stickers");
    sheet.body.innerHTML =
      '<p class="nx-novacut__sheet-copy">Local sticker assets are embedded in NovaCut. No remote sticker CDN is required.</p>' +
      '<div class="nx-novacut__sticker-grid">' +
      NOVACUT_STICKERS.map((sticker) =>
        '<button type="button" class="nx-novacut__sticker-choice" data-sticker-id="' + sticker.id + '">' +
        '<span>' + sticker.glyph + '</span><small>' + sticker.label + '</small></button>'
      ).join("") +
      '</div><div class="nx-novacut__sheet-actions"><button type="button" class="nx-novacut__secondary" data-sheet-close>Close</button></div>';
    sheet.body.querySelectorAll("[data-sticker-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const sticker = NOVACUT_STICKERS.find((item) => item.id === button.dataset.stickerId);
        if (sticker) this.addSticker(sticker);
        this.closeSheet(sheet.root);
      });
    });
  }

  openEffectsEditor() {
    const sheet = this.openSheet("Region effects");
    sheet.body.innerHTML =
      '<div class="nx-novacut__effect-pills">' +
      ["blur","mosaic","scramble","censor"].map((type) =>
        '<button type="button" class="nx-novacut__effect-pill" data-effect-type="' + type + '">' + type.toUpperCase() + '</button>'
      ).join("") +
      '</div>' +
      '<div class="nx-novacut__form-grid">' +
      '<label>X %<input data-effect="x" type="number" min="0" max="94" value="25"></label>' +
      '<label>Y %<input data-effect="y" type="number" min="0" max="94" value="25"></label>' +
      '<label>Width %<input data-effect="width" type="number" min="6" max="100" value="50"></label>' +
      '<label>Height %<input data-effect="height" type="number" min="6" max="100" value="50"></label>' +
      '<label>Duration ms<input data-effect="duration" type="number" min="250" max="60000" value="3000"></label>' +
      '<label>Intensity<input data-effect="intensity" type="number" min="1" max="64" value="12"></label></div>' +
      '<p class="nx-novacut__sheet-copy">The selected region is time-bound and shared by preview and export.</p>' +
      '<div class="nx-novacut__sheet-actions"><button type="button" class="nx-novacut__secondary" data-sheet-close>Cancel</button><button type="button" class="nx-novacut__primary" data-save-effect>Apply effect</button></div>';
    let type = "blur";
    sheet.body.querySelector("[data-effect-type]")?.classList.add("is-selected");
    sheet.body.querySelectorAll("[data-effect-type]").forEach((button) => {
      button.addEventListener("click", () => {
        type = button.dataset.effectType || "blur";
        sheet.body.querySelectorAll("[data-effect-type]").forEach((item) => item.classList.toggle("is-selected", item === button));
      });
    });
    sheet.body.querySelector("[data-save-effect]")?.addEventListener("click", () => {
      const value = (name, fallback) => Number(sheet.body.querySelector("[data-effect='" + name + "']")?.value) || fallback;
      this.addEffect({
        type,
        x: clamp(value("x", 25) / 100, 0, 0.94),
        y: clamp(value("y", 25) / 100, 0, 0.94),
        width: clamp(value("width", 50) / 100, 0.06, 1),
        height: clamp(value("height", 50) / 100, 0.06, 1),
        duration: clamp(value("duration", 3000), 250, 60000),
        intensity: clamp(value("intensity", 12), 1, 64),
        seed: Math.floor(Math.random() * 0x7fffffff)
      });
      this.closeSheet(sheet.root);
    });
  }

  openToolMenu() {
    const sheet = this.openSheet("NovaCut tools");
    sheet.body.innerHTML =
      '<div class="nx-novacut__tool-grid">' +
      '<button type="button" data-tool-action="sticker">Sticker</button>' +
      '<button type="button" data-tool-action="text">Text</button>' +
      '<button type="button" data-tool-action="effects">Effects</button>' +
      '<button type="button" data-tool-action="duplicate">Duplicate</button>' +
      '<button type="button" data-tool-action="delete">Delete</button>' +
      '<button type="button" data-tool-action="rotate">Rotate</button>' +
      '<button type="button" data-tool-action="flip-x">Flip X</button>' +
      '<button type="button" data-tool-action="flip-y">Flip Y</button>' +
      '</div>';
    sheet.body.querySelectorAll("[data-tool-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.toolAction;
        this.closeSheet(sheet.root);
        if (action === "sticker") this.openStickerPicker();
        else if (action === "text") this.openTextEditor();
        else if (action === "effects") this.openEffectsEditor();
        else if (action === "duplicate") this.duplicateSelected();
        else if (action === "delete") this.removeSelected();
        else if (action === "rotate") this.rotateSelected();
        else if (action === "flip-x") this.flipSelected("x");
        else if (action === "flip-y") this.flipSelected("y");
      });
    });
  }

  openSheet(title) {
    this.closeAllSheets();
    const doc = this.root?.ownerDocument || document;
    const holder = doc.createElement("div");
    holder.className = "nx-novacut__sheet-root";
    const safeTitle = String(title || "NovaCut");
    holder.innerHTML =
      '<div class="nx-novacut__sheet-backdrop" data-sheet-close></div>' +
      '<section class="nx-novacut__sheet" role="dialog" aria-modal="true" aria-label="' + safeTitle.replace(/"/g, "&quot;") + '">' +
      '<header><strong>' + safeTitle + '</strong><button type="button" class="nx-novacut__sheet-x" data-sheet-close aria-label="Close">×</button></header>' +
      '<div class="nx-novacut__sheet-body"></div></section>';
    (this.root || doc.body).appendChild(holder);
    holder.querySelectorAll("[data-sheet-close]").forEach((button) => button.addEventListener("click", () => this.closeSheet(holder)));
    return { root: holder, body: holder.querySelector(".nx-novacut__sheet-body") };
  }

  closeSheet(root) { root?.remove(); }
  closeAllSheets() { this.root?.querySelectorAll(".nx-novacut__sheet-root").forEach((node) => node.remove()); }

  installCanvasInteractions(canvas) {
    if (!canvas) return;
    const findTarget = (point) => {
      const width = canvas.clientWidth || canvas.width || 1;
      const height = canvas.clientHeight || canvas.height || 1;
      const x = clamp(point.x / width, 0, 1);
      const y = clamp(point.y / height, 0, 1);
      const active = (list) => list
        .filter((item) => this.currentTimestamp >= item.startTime && this.currentTimestamp < item.startTime + item.duration)
        .sort((a, b) => Number(b.zIndex || 0) - Number(a.zIndex || 0));
      for (const item of active(this.registry.overlayTracks)) {
        const w = Number(item.width || 0.2) * Number(item.scale || 1);
        const h = Number(item.height || 0.2) * Number(item.scale || 1);
        if (Math.abs(x - item.x) <= w / 2 && Math.abs(y - item.y) <= h / 2) return { type: "overlayTracks", item };
      }
      for (const item of active(this.registry.effectTracks)) {
        if (x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height) return { type: "effectTracks", item };
      }
      for (const item of active(this.registry.textTracks)) {
        if (Math.abs(x - Number(item.style?.x || 0.5)) <= 0.25 && Math.abs(y - Number(item.style?.y || 0.82)) <= 0.18) return { type: "textTracks", item };
      }
      return null;
    };
    const localPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener("pointerdown", (event) => {
      const target = findTarget(localPoint(event));
      if (!target) return;
      this.activeTrackId = target.item.id;
      this.events.emit("selectionchange", { id: this.activeTrackId });
      const point = localPoint(event);
      this.canvasPointerState = {
        pointerId: event.pointerId,
        type: target.type,
        itemId: target.item.id,
        startX: point.x,
        startY: point.y,
        original: cloneObject(target.item)
      };
      this.history.begin("Canvas edit");
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }, { signal: this.abort.signal });

    canvas.addEventListener("pointermove", (event) => {
      const state = this.canvasPointerState;
      if (!state || state.pointerId !== event.pointerId) return;
      const point = localPoint(event);
      const width = canvas.clientWidth || canvas.width || 1;
      const height = canvas.clientHeight || canvas.height || 1;
      const dx = (point.x - state.startX) / width;
      const dy = (point.y - state.startY) / height;
      const record = this.registry.getById(state.itemId);
      if (!record) return;

      if (record.type === "overlayTracks") {
        record.item.x = clamp((state.original.x || 0.5) + dx, 0.02, 0.98);
        record.item.y = clamp((state.original.y || 0.5) + dy, 0.02, 0.98);
      } else if (record.type === "textTracks") {
        record.item.style.x = clamp((state.original.style?.x || 0.5) + dx, 0.02, 0.98);
        record.item.style.y = clamp((state.original.style?.y || 0.82) + dy, 0.02, 0.98);
      } else if (record.type === "effectTracks") {
        record.item.x = clamp((state.original.x || 0.25) + dx, 0, Math.max(0, 1 - record.item.width));
        record.item.y = clamp((state.original.y || 0.25) + dy, 0, Math.max(0, 1 - record.item.height));
      }
      this.refresh();
      event.preventDefault();
    }, { signal: this.abort.signal });

    const end = (event) => {
      const state = this.canvasPointerState;
      if (!state || state.pointerId !== event.pointerId) return;
      this.canvasPointerState = null;
      this.history.commit();
      canvas.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    canvas.addEventListener("pointerup", end, { signal: this.abort.signal });
    canvas.addEventListener("pointercancel", (event) => {
      if (!this.canvasPointerState) return;
      this.canvasPointerState = null;
      this.history.cancel();
      event.preventDefault();
    }, { signal: this.abort.signal });
  }

  async writeFile(ffmpeg, path, file) {
    let data;
    if (file instanceof Uint8Array) data = file;
    else if (file instanceof ArrayBuffer) data = new Uint8Array(file);
    else if (file instanceof Blob) data = new Uint8Array(await file.arrayBuffer());
    else throw new Error("NovaCut only accepts browser media File/Blob/ArrayBuffer media inputs.");
    await ffmpeg.writeFile(path, data);
  }

  async createTextPng(ffmpeg, cue, width, height, index, path) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("NovaCut could not create text export canvas.");
    const style = cue.style || {};
    const x = clamp(style.x, 0, 1) * width;
    const y = clamp(style.y, 0, 1) * height;
    const size = Math.max(8, Number(style.fontSize) || 48);
    ctx.font = (style.italic ? "italic " : "") + (style.bold ? "800 " : "600 ") + size + "px " + (style.fontFamily || "system-ui");
    ctx.textAlign = style.align || "center";
    ctx.textBaseline = "middle";
    const lines = String(cue.text).split(/\r?\n/).slice(0, 8);
    const lh = size * 1.2;
    const widest = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    const total = lines.length * lh;
    if (style.background) {
      ctx.fillStyle = rgba(style.background, style.backgroundAlpha);
      ctx.fillRect(x - widest / 2 - size * 0.35, y - total / 2 - size * 0.2, widest + size * 0.7, total + size * 0.4);
    }
    ctx.fillStyle = style.color || "#ffffff";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Number(style.rotation) || 0) * Math.PI / 180);
    lines.forEach((line, lineIndex) => ctx.fillText(line, 0, -total / 2 + lineIndex * lh + lh / 2));
    ctx.restore();
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("NovaCut failed to encode text layer " + index + ".")), "image/png"));
    await this.writeFile(ffmpeg, path, blob);
  }

  async createStickerPng(ffmpeg, overlay, index, path) {
    const image = await loadNovaCutImageAsset(overlay.asset);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("NovaCut could not create sticker export canvas.");
    ctx.translate(256, 256);
    ctx.rotate((Number(overlay.rotation) || 0) * Math.PI / 180);
    ctx.drawImage(image, -240, -240, 480, 480);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("NovaCut failed to encode sticker layer " + index + ".")), "image/png"));
    await this.writeFile(ffmpeg, path, blob);
  }

  async compileAndExportVideo(options = {}) {
    try {
      if (!this.registry.videoTracks.some((clip) => clip.file)) throw new Error("Add at least one video clip before exporting.");
      this.pause();
      this.events.emit("export:start", { hardware: this.hardware });
      const ffmpeg = await this.runtime.ensureLoaded();
      const compiled = this.compiler.compile(options);

      for (const input of compiled.inputs) {
        if (input.textAsset || input.stickerAsset) continue;
        await this.writeFile(ffmpeg, input.path, input.file);
      }
      for (const [index, asset] of compiled.textAssets.entries()) {
        await this.createTextPng(ffmpeg, asset.cue, compiled.width, compiled.height, index, asset.input.path);
      }
      for (const [index, asset] of compiled.stickerAssets.entries()) {
        await this.createStickerPng(ffmpeg, asset.overlay, index, asset.input.path);
      }

      const exitCode = await ffmpeg.exec(compiled.args);
      if (Number(exitCode) !== 0) throw new Error("FFmpeg export failed with exit code " + exitCode + ".");
      const result = await ffmpeg.readFile(compiled.outputPath);
      const bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
      const blob = new Blob([bytes], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = compiled.outputName;
      anchor.hidden = true;
      (this.root || document.body).appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      this.events.emit("export:complete", {
        blob,
        url,
        fileName: compiled.outputName,
        ffmpegMode: this.runtime.mode,
        width: compiled.width,
        height: compiled.height,
        fps: compiled.fps
      });
      this.setStatus("Export complete");
      return { success: true, blob, url, fileName: compiled.outputName };
    } catch (error) {
      this.events.emit("export:error", { error });
      this.reportError("export", error);
      throw error;
    }
  }

  refresh() {
    this.preview?.syncRegistry();
    this.setPlayhead(this.currentTimestamp);
    this.events.emit("statechange", this.getState());
    this.emitHistoryState();
  }

  setStatus(message) {
    const element = this.root?.querySelector("[data-role='status']");
    if (element) element.textContent = String(message);
  }

  reportError(scope, error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.events.emit("error", { scope, error: normalized });
    this.setStatus(normalized.message);
  }

  async dispose() {
    this.pause();
    this.abort?.abort();
    this.closeAllSheets();
    this.preview?.dispose();
    await this.runtime.terminate();
    this.events.clear();
  }
}

export { NovaCutCommandCompiler, NovaCutFFmpegRuntime };
export const createNovaCutEngine = (options = {}) => new NovaCutEngine(options);
