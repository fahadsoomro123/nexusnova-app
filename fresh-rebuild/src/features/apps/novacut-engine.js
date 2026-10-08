/* NexusNova NovaCut Media Pipeline Core | Absolute CDN assets pinned */
import { createNovaCutHistory } from "./novacut-history.js";
import { drawSticker, normalizeSticker } from "./novacut-visuals.js";
const RUNTIME = Object.freeze({
  FFMPEG_PACKAGE: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js",
  FFMPEG_WORKER: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js",
  CORE_MT_JS: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.js",
  CORE_MT_WASM: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.wasm",
  CORE_MT_WORKER: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.worker.js",
  CORE_ST_JS: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
  CORE_ST_WASM: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm"
});

const RATIO_PRESETS = Object.freeze({
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 1440, height: 1080 }
});

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const fileName = (value, fallback) => {
  const clean = String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, "_");
  return clean.slice(0, 120) || fallback;
};
const ext = (value, fallback = "bin") => String(value || "").match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || fallback;
const msToSec = (ms) => Math.max(0, Number(ms) || 0) / 1000;
const sourceKind = (file) => {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/")) return "image";
  const e = ext(file?.name || file, "");
  return ["png","jpg","jpeg","webp","gif","bmp"].includes(e) ? "image" : "video";
};

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

class NovaCutTrackRegistry {
  constructor() {
    this.videoTracks = [];
    this.audioTracks = [];
    this.textTracks = [];
    this.stickerTracks = [];
  }

  addVideoClip(input = {}) {
    const clip = {
      id: String(input.id || id("video")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(1, Number(input.duration) || 1),
      x_offset: Number(input.x_offset) || 0,
      scale: Math.max(0.05, Number(input.scale) || 1),
      sourceStartTime: Math.max(0, Number(input.sourceStartTime) || 0)
    };
    this.videoTracks.push(clip);
    return clip;
  }

  addAudioSegment(input = {}) {
    const segment = {
      id: String(input.id || id("audio")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(1, Number(input.duration) || 1),
      volume: clamp(input.volume ?? 1, 0, 4)
    };
    this.audioTracks.push(segment);
    return segment;
  }

  addTextCue(input = {}) {
    const cue = {
      id: String(input.id || id("text")),
      text: String(input.text || ""),
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(1, Number(input.duration) || 1),
      style: {
        x: clamp(input.style?.x ?? 0.5, 0, 1),
        y: clamp(input.style?.y ?? 0.82, 0, 1),
        fontFamily: String(input.style?.fontFamily || "system-ui"),
        fontSize: Math.max(8, Number(input.style?.fontSize) || 48),
        color: String(input.style?.color || "#ffffff"),
        background: input.style?.background || null,
        backgroundAlpha: clamp(input.style?.backgroundAlpha ?? 0.62, 0, 1),
        bold: Boolean(input.style?.bold),
        italic: Boolean(input.style?.italic),
        rotation: Number.isFinite(Number(input.style?.rotation)) ? Number(input.style.rotation) : 0,
        align: input.style?.align === "left" || input.style?.align === "right" ? input.style.align : "center"
      }
    };
    this.textTracks.push(cue);
    return cue;
  }

  addSticker(input = {}) {
    const normalized = normalizeSticker({
      ...input,
      id: String(input.id || id("sticker"))
    });
    this.stickerTracks.push(normalized);
    return normalized;
  }

  removeById(trackId) {
    const idValue = String(trackId || "");
    for (const [type, list] of [["videoTracks", this.videoTracks], ["audioTracks", this.audioTracks], ["textTracks", this.textTracks], ["stickerTracks", this.stickerTracks]]) {
      const index = list.findIndex((entry) => entry.id === idValue);
      if (index >= 0) {
        const [removed] = list.splice(index, 1);
        return { type, item: removed };
      }
    }
    return null;
  }

  getById(trackId) {
    const idValue = String(trackId || "");
    for (const [type, list] of [["videoTracks", this.videoTracks], ["audioTracks", this.audioTracks], ["textTracks", this.textTracks], ["stickerTracks", this.stickerTracks]]) {
      const found = list.find((entry) => entry.id === idValue);
      if (found) return { type, item: found };
    }
    return null;
  }

  durationMs() {
    return Math.max(
      1,
      ...this.videoTracks.map((x) => x.startTime + x.duration),
      ...this.audioTracks.map((x) => x.startTime + x.duration),
      ...this.textTracks.map((x) => x.startTime + x.duration),
      ...this.stickerTracks.map((x) => x.startTime + x.duration)
    );
  }
}


class NovaCutCanvasPreview {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d", { alpha: false, desynchronized: true }) || null;
    this.media = new Map();
    this.pending = new Map();
    this.awaitingRender = new Set();
    this.urls = new Map();
    this.frameId = 0;
    this.running = false;
    this.resizeObserver = null;
    if (canvas && globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }

  isVideo(media) {
    return typeof HTMLVideoElement !== "undefined"
      ? media instanceof HTMLVideoElement
      : String(media?.tagName || "").toLowerCase() === "video";
  }

  emitMediaStatus(clip, status, error = null) {
    this.engine.events.emit("media:status", {
      clipId: clip?.id || null,
      status,
      error: error || null
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  async resolve(clip) {
    if (!clip?.file) return null;
    if (this.media.has(clip.id)) return this.media.get(clip.id);
    if (this.pending.has(clip.id)) return this.pending.get(clip.id);

    const promise = (async () => {
      this.emitMediaStatus(clip, "decoding");
      let media = null;

      try {
        if (sourceKind(clip.file) === "image") {
          media = new Image();
          media.decoding = "async";

          await new Promise((resolve, reject) => {
            const finish = () => {
              cleanup();
              resolve();
            };
            const fail = () => {
              cleanup();
              reject(new Error("NovaCut could not decode image \"" + String(clip.id) + "\"."));
            };
            const cleanup = () => {
              media.removeEventListener?.("load", finish);
              media.removeEventListener?.("error", fail);
            };

            media.addEventListener("load", finish, { once: true });
            media.addEventListener("error", fail, { once: true });
            media.src = typeof clip.file === "string" ? clip.file : this.objectUrl(clip.file);

            if (media.complete && media.naturalWidth > 0) {
              finish();
            }
          });
        } else {
          media = document.createElement("video");
          media.muted = true;
          media.defaultMuted = true;
          media.playsInline = true;
          media.preload = "auto";
          media.setAttribute?.("playsinline", "");
          media.setAttribute?.("muted", "");
          media.setAttribute?.("webkit-playsinline", "");

          await new Promise((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
              media.removeEventListener?.("loadeddata", finish);
              media.removeEventListener?.("canplay", finish);
              media.removeEventListener?.("error", fail);
              media.removeEventListener?.("abort", fail);
            };

            const finish = () => {
              if (settled) return;
              if (media.readyState < 2) return;
              settled = true;
              cleanup();
              resolve();
            };

            const fail = () => {
              if (settled) return;
              settled = true;
              cleanup();
              reject(new Error("NovaCut could not decode video \"" + String(clip.id) + "\"."));
            };

            media.addEventListener("loadeddata", finish);
            media.addEventListener("canplay", finish);
            media.addEventListener("error", fail, { once: true });
            media.addEventListener("abort", fail, { once: true });
            media.src = typeof clip.file === "string" ? clip.file : this.objectUrl(clip.file);
            media.load?.();

            if (media.readyState >= 2) {
              finish();
            }
          });
        }

        this.media.set(clip.id, media);
        this.emitMediaStatus(clip, "ready");
        return media;
      } catch (error) {
        this.emitMediaStatus(clip, "decode-error", error);
        throw error;
      } finally {
        this.pending.delete(clip.id);
      }
    })();

    this.pending.set(clip.id, promise);
    return promise;
  }

  objectUrl(blob) {
    if (this.urls.has(blob)) return this.urls.get(blob);
    const value = URL.createObjectURL(blob);
    this.urls.set(blob, value);
    return value;
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
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, width, height);

    const now = this.engine.currentTimestamp;
    const active = this.engine.registry.videoTracks
      .filter((clip) => now >= clip.startTime && now < clip.startTime + clip.duration)
      .sort((a, b) => a.startTime - b.startTime);

    for (const clip of active) {
      const media = this.media.get(clip.id);

      if (!media) {
        if (!this.awaitingRender.has(clip.id)) {
          this.awaitingRender.add(clip.id);
          this.resolve(clip)
            .then(() => {
              if (this.engine.isPlaying) {
                this.engine.syncMediaToPlayhead({ autoplay: true });
              }
            })
            .catch((error) => this.engine.reportError("decode", error))
            .finally(() => this.awaitingRender.delete(clip.id));
        }
        continue;
      }

      if (this.isVideo(media)) {
        const localMs = now - clip.startTime;
        const target = msToSec(clip.sourceStartTime + localMs);
        if (!this.engine.isPlaying || Math.abs(media.currentTime - target) > 0.20) {
          try { media.currentTime = target; } catch (_) {}
        }
        if (media.readyState < 2) continue;
      }

      const sw = media.videoWidth || media.naturalWidth || 1;
      const sh = media.videoHeight || media.naturalHeight || 1;
      const scaledW = sw * Math.max(0.05, Number(clip.scale) || 1);
      const scaledH = sh * Math.max(0.05, Number(clip.scale) || 1);
      const fit = Math.min(width / scaledW, height / scaledH);
      const dw = scaledW * fit;
      const dh = scaledH * fit;
      const dx = (width - dw) / 2 + (Number(clip.x_offset) || 0);
      const dy = (height - dh) / 2;
      try { ctx.drawImage(media, dx, dy, dw, dh); } catch (error) { this.engine.reportError("canvas", error); }
    }

    const stickers = (this.engine.registry.stickerTracks || [])
      .filter((sticker) => now >= sticker.startTime && now < sticker.startTime + sticker.duration);

    for (const sticker of stickers) {
      try {
        drawSticker(ctx, sticker, width, height, globalThis.devicePixelRatio || 1);
      } catch (error) {
        this.engine.reportError("sticker", error);
      }
    }

    const cues = this.engine.registry.textTracks
      .filter((cue) => now >= cue.startTime && now < cue.startTime + cue.duration);

    for (const cue of cues) this.drawText(ctx, cue, width, height);
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
      ctx.fillStyle = this.rgba(style.background, style.backgroundAlpha);
      ctx.fillRect(-widest / 2 - size * 0.35, -total / 2 - size * 0.2, widest + size * 0.7, total + size * 0.4);
    }
    ctx.fillStyle = style.color || "#ffffff";
    lines.forEach((line, i) => ctx.fillText(line, 0, -total / 2 + i * lh + lh / 2));
    ctx.restore();
  }

  rgba(hex, alpha) {
    const clean = String(hex || "#000000").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + clamp(alpha ?? 1, 0, 1) + ")";
  }

  removeClipMedia(clipId) {
    const media = this.media.get(clipId);
    if (!media) return;
    try { media.pause?.(); media.removeAttribute?.("src"); media.load?.(); } catch (_) {}
    this.media.delete(clipId);
  }

  reconcileMedia() {
    const ids = new Set(this.engine.registry.videoTracks.map((clip) => clip.id));
    for (const clipId of this.media.keys()) {
      if (!ids.has(clipId)) this.removeClipMedia(clipId);
    }
  }

  dispose() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.media.forEach((media) => { try { media.pause?.(); media.removeAttribute?.("src"); media.load?.(); } catch (_) {} });
    this.urls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    this.pending.clear();
    this.awaitingRender.clear();
    this.media.clear();
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
        if (typeof FFmpeg !== "function") throw new Error("NovaCut: official FFmpeg module did not expose FFmpeg.");

        const hardware = this.engine.hardware;
        const candidates = hardware.multithreadCapable
          ? [
              {
                mode: "mt",
                coreURL: RUNTIME.CORE_MT_JS,
                wasmURL: RUNTIME.CORE_MT_WASM,
                workerURL: RUNTIME.CORE_MT_WORKER
              },
              {
                mode: "st",
                coreURL: RUNTIME.CORE_ST_JS,
                wasmURL: RUNTIME.CORE_ST_WASM
              }
            ]
          : [
              {
                mode: "st",
                coreURL: RUNTIME.CORE_ST_JS,
                wasmURL: RUNTIME.CORE_ST_WASM
              }
            ];

        let lastError = null;

        for (const candidate of candidates) {
          const instance = new FFmpeg();

          try {
            instance.on("progress", (event) => {
              this.engine.events.emit("export:progress", {
                progress: clamp(event?.progress ?? 0, 0, 1),
                time: Number(event?.time) || 0
              });
            });

            instance.on("log", (event) => {
              this.engine.events.emit("log", event);
            });

            await instance.load({
              ...candidate,
              classWorkerURL: RUNTIME.FFMPEG_WORKER
            });

            this.instance = instance;
            this.mode = candidate.mode;
            this.engine.events.emit("runtime:ready", {
              mode: candidate.mode,
              hardware
            });
            return instance;
          } catch (error) {
            lastError = error;
            try { instance.terminate(); } catch (_) {}
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
    const duration = msToSec(durationMs);
    const inputs = [];
    const args = ["-hide_banner", "-nostdin", "-y"];

    const addInput = (file, kind, prefix) => {
      const index = inputs.length;
      const fallbackExt = kind === "audio" ? "mp3" : kind === "image" ? "png" : "mp4";
      const name = fileName(file?.name || file, `${prefix}-${index}.${fallbackExt}`);
      const path = `/novacut/${index}-${name}`;
      inputs.push({ file, path, index, kind });
      return inputs[inputs.length - 1];
    };

    const videos = this.engine.registry.videoTracks
      .filter((clip) => clip.file)
      .map((clip) => ({ clip, input: addInput(clip.file, sourceKind(clip.file), "video") }));

    const audios = this.engine.registry.audioTracks
      .filter((segment) => segment.file)
      .map((segment) => ({ segment, input: addInput(segment.file, "audio", "audio") }));

    for (const input of inputs) {
      if (input.kind === "image") args.push("-loop", "1");
      args.push("-i", input.path);
    }

    const filters = [];
    filters.push(`color=c=black:s=${width}x${height}:r=${fps}:d=${duration}[base]`);
    let currentVideo = "base";

    videos.forEach(({ clip, input }, index) => {
      const src = `vsrc${index}`;
      const out = `vout${index}`;
      const scale = Math.max(0.05, Number(clip.scale) || 1);
      const begin = msToSec(clip.sourceStartTime);
      const end = begin + msToSec(clip.duration);
      const startAt = msToSec(clip.startTime);
      filters.push(
        `[${input.index}:v:0]` +
        `trim=start=${begin.toFixed(3)}:end=${end.toFixed(3)},` +
        `setpts=PTS-STARTPTS+${startAt.toFixed(3)}/TB,` +
        `scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2:force_original_aspect_ratio=decrease,` +
        `format=yuv420p[${src}]`
      );
      filters.push(
        `[${currentVideo}][${src}]overlay=${Number(clip.x_offset) || 0}:y=(H-h)/2:eof_action=pass:shortest=0:repeatlast=0[${out}]`
      );
      currentVideo = out;
    });

    let currentAudio = null;
    if (audios.length) {
      const labels = [];
      audios.forEach(({ segment, input }, index) => {
        const label = `asrc${index}`;
        const delay = Math.max(0, Math.round(segment.startTime));
        filters.push(
          `[${input.index}:a:0]` +
          `atrim=duration=${msToSec(segment.duration).toFixed(3)},` +
          `asetpts=PTS-STARTPTS,` +
          `volume=${clamp(segment.volume ?? 1, 0, 4).toFixed(3)},` +
          `adelay=${delay}|${delay}[${label}]`
        );
        labels.push(`[${label}]`);
      });
      filters.push(
        `${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,aresample=async=1:first_pts=0[aout]`
      );
      currentAudio = "aout";
    }

    const overlayAssets = [];

    this.engine.registry.textTracks.forEach((cue, index) => {
      const source = addInput({ name: `text-${index}.png`, __textAsset: true }, "image", "text");
      source.path = `/novacut/text-${String(index).padStart(3, "0")}.png`;
      overlayAssets.push({ kind: "text", cue, input: source });
    });

    (this.engine.registry.stickerTracks || []).forEach((sticker, index) => {
      const source = addInput({ name: `sticker-${index}.png`, __stickerAsset: true }, "image", "sticker");
      source.path = `/novacut/sticker-${String(index).padStart(3, "0")}.png`;
      overlayAssets.push({ kind: "sticker", sticker, input: source });
    });

    for (const asset of overlayAssets) {
      const src = `osrc${asset.input.index}`;
      const out = `oout${asset.input.index}`;
      filters.push(`[${asset.input.index}:v:0]format=rgba[${src}]`);
      const start = asset.kind === "text" ? asset.cue.startTime : asset.sticker.startTime;
      const end = asset.kind === "text"
        ? asset.cue.startTime + asset.cue.duration
        : asset.sticker.startTime + asset.sticker.duration;
      filters.push(
        `[${currentVideo}][${src}]overlay=0:0:enable='between(t,${msToSec(start).toFixed(3)},${msToSec(end).toFixed(3)})':eof_action=pass:shortest=0[${out}]`
      );
      currentVideo = out;
    }

    const outputName = fileName(options.outputFileName || "novacut-export.mp4", "novacut-export.mp4");
    const outputPath = `/novacut/${outputName}`;

    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      `[${currentVideo}]`
    );

    if (currentAudio) args.push("-map", `[${currentAudio}]`);

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

    return { args, inputs, overlayAssets, outputPath, outputName, width, height, fps, durationMs };
  }
}

class NovaCutEngine {
  constructor(options = {}) {
    this.root = options.root || null;
    this.registry = new NovaCutTrackRegistry();
    this.events = new NovaCutEventBus();
    this.aspectRatio = RATIO_PRESETS[options.aspectRatio] ? options.aspectRatio : "16:9";
    this.currentTimestamp = 0;
    this.activeTrackId = null;
    this.isPlaying = false;
    this.playbackFrame = 0;
    this.hardware = {
      hardwareConcurrency: Math.max(1, Number(navigator.hardwareConcurrency) || 1),
      deviceMemory: Number(navigator.deviceMemory) || 0,
      crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
      sharedArrayBufferAvailable: typeof SharedArrayBuffer !== "undefined",
      multithreadCapable: Boolean(globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined")
    };
    this.runtime = new NovaCutFFmpegRuntime(this);
    this.compiler = new NovaCutCommandCompiler(this);
    this.history = createNovaCutHistory(this, { limit: 100 });
    this.preview = null;
    this.abort = null;
    if (this.root) this.mount(this.root);
  }

  on(event, callback) { return this.events.on(event, callback); }

  getState() {
    return {
      videoTracks: this.registry.videoTracks,
      audioTracks: this.registry.audioTracks,
      textTracks: this.registry.textTracks,
      stickerTracks: this.registry.stickerTracks,
      aspectRatio: this.aspectRatio,
      currentTimestamp: this.currentTimestamp,
      activeTrackId: this.activeTrackId,
      canUndo: this.history?.canUndo?.() || false,
      canRedo: this.history?.canRedo?.() || false
    };
  }

  selectClip(trackId) {
    const record = this.registry.getById(trackId);
    if (!record) return false;
    this.activeTrackId = record.item.id;
    this.events.emit("selectionchange", { id: this.activeTrackId, type: record.type });
    return true;
  }

  restoreState(state = {}, options = {}) {
    this.pause();
    this.aspectRatio = RATIO_PRESETS[state.aspectRatio] ? state.aspectRatio : "16:9";
    this.currentTimestamp = Math.max(0, Number(state.currentTimestamp) || 0);
    this.activeTrackId = state.activeTrackId ? String(state.activeTrackId) : null;
    this.registry.videoTracks = (state.videoTracks || []).map((track) => ({ ...track, file: track.file || null }));
    this.registry.audioTracks = (state.audioTracks || []).map((track) => ({ ...track, file: track.file || null }));
    this.registry.textTracks = (state.textTracks || []).map((track) => ({ ...track }));
    this.registry.stickerTracks = (state.stickerTracks || []).map((track) => ({ ...track }));
    this.preview?.reconcileMedia?.();
    this.refresh();
    this.events.emit("selectionchange", { id: this.activeTrackId, fromHistory: Boolean(options.fromHistory) });
  }

  withHistory(label, mutator) {
    if (!this.history) return mutator();
    return this.history.run(label, mutator);
  }

  recordExternalMutation(before, label) {
    if (!this.history || !before) return false;
    return this.history.commit(before, label);
  }

  undo() { return this.history?.undo?.() || false; }
  redo() { return this.history?.redo?.() || false; }

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
      root.querySelectorAll(`[data-action="${action}"]`).forEach((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          Promise.resolve().then(handler).catch((error) => this.reportError(`action:${action}`, error));
        }, { signal });
      });
    };

    bind("split", () => this.executeSplitAction(this.activeTrackId, this.currentTimestamp));
    bind("audio", () => this.importAudio());
    bind("text", () => this.addTextOverlay());
    bind("ratio", () => this.cycleRatio());
    bind("export", () => this.compileAndExportVideo());
    bind("play", () => this.togglePlayback());
    bind("undo", () => this.undo());
    bind("redo", () => this.redo());
    bind("duplicate", () => this.duplicateClip());
    bind("delete", () => this.deleteClip());

    root.querySelectorAll("[data-clip-id]").forEach((element) => {
      element.addEventListener("click", () => {
        this.activeTrackId = element.dataset.clipId || null;
        this.events.emit("selectionchange", { id: this.activeTrackId });
      }, { signal });
    });

    return this;
  }

  addVideoClip(clip) {
    return this.withHistory("Add video", () => {
      const result = this.registry.addVideoClip(clip);
      this.activeTrackId = result.id;
      this.refresh();
      return result;
    });
  }

  addAudioSegment(segment) {
    return this.withHistory("Add audio", () => {
      const result = this.registry.addAudioSegment(segment);
      this.activeTrackId = result.id;
      this.refresh();
      return result;
    });
  }

  addTextCue(cue) {
    return this.withHistory("Add text", () => {
      const result = this.registry.addTextCue(cue);
      this.activeTrackId = result.id;
      this.refresh();
      return result;
    });
  }

  addSticker(sticker) {
    return this.withHistory("Add sticker", () => {
      const result = this.registry.addSticker(sticker);
      this.activeTrackId = result.id;
      this.refresh();
      this.events.emit("visualchange", { id: result.id, kind: "sticker", action: "add" });
      return result;
    });
  }

  updateTextCue(trackId, patch = {}, options = {}) {
    const record = this.registry.getById(trackId);
    if (!record || record.type !== "textTracks") return { success: false, reason: "text-not-found" };

    const apply = () => {
      const cue = record.item;
      if (patch.text !== undefined) cue.text = String(patch.text);
      if (patch.startTime !== undefined) cue.startTime = Math.max(0, Number(patch.startTime) || 0);
      if (patch.duration !== undefined) cue.duration = Math.max(33.34, Number(patch.duration) || 33.34);
      if (patch.style) {
        cue.style = {
          ...cue.style,
          ...patch.style,
          x: clamp(patch.style.x ?? cue.style.x, 0, 1),
          y: clamp(patch.style.y ?? cue.style.y, 0, 1),
          fontSize: Math.max(8, Number(patch.style.fontSize) || cue.style.fontSize),
          backgroundAlpha: clamp(patch.style.backgroundAlpha ?? cue.style.backgroundAlpha, 0, 1),
          rotation: Number.isFinite(Number(patch.style.rotation)) ? Number(patch.style.rotation) : (Number(cue.style.rotation) || 0)
        };
      }
      this.activeTrackId = cue.id;
      this.refresh();
      this.events.emit("visualchange", { id: cue.id, kind: "text", action: "update" });
      return { success: true, cue };
    };

    if (options.live) return apply();
    return this.withHistory("Edit text", apply);
  }

  updateVisualTransform(trackId, patch = {}, options = {}) {
    const record = this.registry.getById(trackId);
    if (!record || !["textTracks", "stickerTracks"].includes(record.type)) {
      return { success: false, reason: "visual-not-found" };
    }

    const apply = () => {
      const item = record.item;
      if (record.type === "stickerTracks") {
        item.x = clamp(patch.x ?? item.x, 0, 1);
        item.y = clamp(patch.y ?? item.y, 0, 1);
        item.scale = clamp(patch.scale ?? item.scale, 0.2, 4);
        item.rotation = Number.isFinite(Number(patch.rotation)) ? Number(patch.rotation) : item.rotation;
        item.opacity = clamp(patch.opacity ?? item.opacity, 0, 1);
      } else {
        const style = item.style || {};
        item.style = {
          ...style,
          x: clamp(patch.x ?? style.x, 0, 1),
          y: clamp(patch.y ?? style.y, 0, 1),
          rotation: Number.isFinite(Number(patch.rotation)) ? Number(patch.rotation) : (Number(style.rotation) || 0),
          fontSize: Math.max(8, Number(patch.fontSize) || style.fontSize || 48)
        };
      }
      this.activeTrackId = item.id;
      this.refresh();
      this.events.emit("visualchange", { id: item.id, kind: record.type === "stickerTracks" ? "sticker" : "text", action: "transform" });
      return { success: true, item };
    };

    if (options.live) return apply();
    return this.withHistory("Transform visual", apply);
  }

  restoreVisualTransform(trackId, snapshot = {}) {
    const record = this.registry.getById(trackId);
    if (!record) return false;
    const item = record.item;
    if (record.type === "stickerTracks") {
      item.x = clamp(snapshot.x ?? item.x, 0, 1);
      item.y = clamp(snapshot.y ?? item.y, 0, 1);
      item.scale = clamp(snapshot.scale ?? item.scale, 0.2, 4);
      item.rotation = finite(snapshot.rotation, item.rotation);
    } else if (record.type === "textTracks") {
      item.style = {
        ...item.style,
        x: clamp(snapshot.x ?? item.style.x, 0, 1),
        y: clamp(snapshot.y ?? item.style.y, 0, 1),
        fontSize: Math.max(8, Number(snapshot.fontSize) || item.style.fontSize || 48),
        rotation: finite(snapshot.rotation, item.style.rotation || 0)
      };
    } else {
      return false;
    }
    this.activeTrackId = item.id;
    this.refresh();
    return true;
  }

  moveClip(trackId, startTime) {
    const record = this.registry.getById(trackId || this.activeTrackId);
    if (!record) return { success: false, reason: "clip-not-found" };
    const nextStart = Math.max(0, Number(startTime) || 0);
    return this.withHistory("Move clip", () => {
      record.item.startTime = nextStart;
      this.activeTrackId = record.item.id;
      this.refresh();
      return { success: true, clip: record.item };
    });
  }

  trimClip(trackId, edge, timestamp) {
    const record = this.registry.getById(trackId || this.activeTrackId);
    if (!record || !["videoTracks", "textTracks", "stickerTracks"].includes(record.type)) return { success: false, reason: "clip-not-found" };
    const clip = record.item;
    const minFrame = 1000 / 30;
    return this.withHistory("Trim " + (edge === "start" ? "start" : "end"), () => {
      const originalEnd = clip.startTime + clip.duration;
      if (edge === "start") {
        const nextStart = clamp(timestamp, 0, originalEnd - minFrame);
        const delta = nextStart - clip.startTime;
        clip.startTime = nextStart;
        clip.duration = Math.max(minFrame, originalEnd - nextStart);
        if (record.type === "videoTracks") {
          clip.sourceStartTime = Math.max(0, clip.sourceStartTime + delta);
        }
      } else {
        const nextEnd = Math.max(clip.startTime + minFrame, Number(timestamp) || clip.startTime + minFrame);
        clip.duration = Math.max(minFrame, nextEnd - clip.startTime);
      }
      this.activeTrackId = clip.id;
      this.refresh();
      return { success: true, clip };
    });
  }

  deleteClip(trackId = this.activeTrackId) {
    const record = this.registry.getById(trackId);
    if (!record) return { success: false, reason: "clip-not-found" };
    return this.withHistory("Delete clip", () => {
      const listBefore = this.registry[record.type] || [];
      const removedIndex = listBefore.findIndex((item) => item.id === record.item.id);
      const removed = this.registry.removeById(record.item.id);
      this.preview?.removeClipMedia?.(record.item.id);
      const list = this.registry[record.type] || [];
      const replacementIndex = Math.min(Math.max(0, removedIndex), Math.max(0, list.length - 1));
      this.activeTrackId = list.length ? list[replacementIndex]?.id || null : null;
      this.refresh();
      this.events.emit("delete", { removed: removed?.item || null, type: removed?.type || null });
      return { success: Boolean(removed), removed };
    });
  }

  duplicateClip(trackId = this.activeTrackId) {
    const record = this.registry.getById(trackId);
    if (!record) return { success: false, reason: "clip-not-found" };
    return this.withHistory("Duplicate clip", () => {
      if (record.type !== "videoTracks") {
        const prefix = record.type === "audioTracks" ? "audio" : record.type === "stickerTracks" ? "sticker" : "text";
        const copy = { ...record.item, id: id(prefix), startTime: record.item.startTime + record.item.duration };
        const list = this.registry[record.type];
        const index = list.findIndex((item) => item.id === record.item.id);
        list.splice(index + 1, 0, copy);
        this.activeTrackId = copy.id;
        this.refresh();
        this.events.emit("duplicate", { original: record.item, duplicate: copy });
        return { success: true, duplicate: copy };
      }
      const clip = record.item;
      const insertAt = clip.startTime + clip.duration;
      const copy = { ...clip, id: id("video"), startTime: insertAt };
      this.registry.videoTracks
        .filter((item) => item.id !== clip.id && item.startTime >= insertAt)
        .forEach((item) => { item.startTime += clip.duration; });
      const index = this.registry.videoTracks.findIndex((item) => item.id === clip.id);
      this.registry.videoTracks.splice(index + 1, 0, copy);
      this.activeTrackId = copy.id;
      this.refresh();
      this.events.emit("duplicate", { original: clip, duplicate: copy });
      return { success: true, duplicate: copy };
    });
  }


  setPlayhead(timestamp, options = {}) {
    this.currentTimestamp = clamp(timestamp, 0, this.registry.durationMs());
    const current = this.root?.querySelector("[data-role='current-time']");
    const duration = this.root?.querySelector("[data-role='duration']");
    if (current) current.textContent = this.format(this.currentTimestamp);
    if (duration) duration.textContent = this.format(this.registry.durationMs());
    this.events.emit("playheadchange", { timestamp: this.currentTimestamp });

    if (options.syncMedia !== false) {
      this.syncMediaToPlayhead({ autoplay: this.isPlaying });
    }
  }

  format(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((n) => String(n).padStart(2, "0")).join(":");
  }

  togglePlayback() { return this.isPlaying ? this.pause() : this.play(); }

  async play() {
    if (this.isPlaying) return true;

    const duration = this.registry.durationMs();
    if (this.currentTimestamp >= duration) {
      this.setPlayhead(0, { syncMedia: false });
    }

    const active = this.getActiveVideoClips();
    try {
      if (this.preview && active.length) {
        await Promise.all(active.map((clip) => this.preview.resolve(clip)));
      }
    } catch (error) {
      this.reportError("playback", error);
      return false;
    }

    this.isPlaying = true;
    this.syncMediaToPlayhead({ autoplay: true });
    this.events.emit("playbackchange", { isPlaying: true });

    let last = performance.now();
    const tick = (now) => {
      if (!this.isPlaying) return;

      const delta = Math.max(0, now - last);
      last = now;
      const next = this.currentTimestamp + delta;

      if (next >= this.registry.durationMs()) {
        this.setPlayhead(0, { syncMedia: false });
        this.pause();
        return;
      }

      this.setPlayhead(next, { syncMedia: false });
      this.syncMediaToPlayhead({ autoplay: true });
      this.playbackFrame = requestAnimationFrame(tick);
    };

    this.playbackFrame = requestAnimationFrame(tick);
    return true;
  }

  pause() {
    const changed = this.isPlaying;
    this.isPlaying = false;
    cancelAnimationFrame(this.playbackFrame);
    this.playbackFrame = 0;

    this.preview?.media?.forEach((media) => {
      if (this.preview?.isVideo?.(media)) {
        try { media.pause?.(); } catch (_) {}
      }
    });

    if (changed) {
      this.events.emit("playbackchange", { isPlaying: false });
    }
  }

  syncMediaToPlayhead({ autoplay = false } = {}) {
    const active = this.getActiveVideoClips();
    const activeIds = new Set(active.map((clip) => clip.id));

    this.preview?.media?.forEach((media, clipId) => {
      if (!activeIds.has(clipId) && this.preview?.isVideo?.(media)) {
        try { media.pause?.(); } catch (_) {}
      }
    });

    for (const clip of active) {
      const media = this.preview?.media?.get(clip.id);
      if (!media || !this.preview?.isVideo?.(media)) continue;
      if (media.readyState < 1) continue;

      const localMs = this.currentTimestamp - clip.startTime;
      const target = Math.max(
        msToSec(clip.sourceStartTime),
        msToSec(clip.sourceStartTime + localMs)
      );

      if (!this.isPlaying || Math.abs(media.currentTime - target) > 0.20) {
        try { media.currentTime = target; } catch (_) {}
      }

      if (autoplay && media.readyState >= 2) {
        try {
          const playPromise = media.play?.();
          if (playPromise?.catch) {
            playPromise.catch((error) => this.reportError("playback", error));
          }
        } catch (error) {
          this.reportError("playback", error);
        }
      }
    }
  }


  getActiveVideoClips() {
    const t = this.currentTimestamp;
    return this.registry.videoTracks.filter((clip) => t >= clip.startTime && t < clip.startTime + clip.duration);
  }

  executeSplitAction(activeTrackId, currentTimestamp) {
    const before = this.history?.snapshot?.();
    try {
      const targetId = activeTrackId || this.activeTrackId;
      const record = this.registry.getById(targetId);
      if (!record || record.type !== "videoTracks") {
        throw new Error("Select a video clip before using Split.");
      }

      const clip = record.item;
      const timestamp = clamp(currentTimestamp, clip.startTime, clip.startTime + clip.duration);
      const left = timestamp - clip.startTime;
      const right = clip.duration - left;
      const frame = 1000 / 30;

      if (left <= frame || right <= frame) {
        return { success: false, reason: "split-point-too-close-to-boundary" };
      }

      const index = this.registry.videoTracks.findIndex((x) => x.id === clip.id);
      const first = {
        ...clip,
        id: id("video"),
        duration: left
      };
      const second = {
        ...clip,
        id: id("video"),
        startTime: timestamp,
        duration: right,
        sourceStartTime: clip.sourceStartTime + left
      };

      this.registry.videoTracks.splice(index, 1, first, second);
      this.activeTrackId = second.id;
      this.preview?.removeClipMedia?.(clip.id);
      this.refresh();
      this.history?.commit(before, "Split clip");
      this.events.emit("split", { originalClipId: clip.id, firstClip: first, secondClip: second, splitTimestamp: timestamp });
      return { success: true, firstClip: first, secondClip: second };
    } catch (error) {
      this.reportError("split", error);
      return { success: false, error };
    }
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
      if (file) {
        const segment = this.addAudioSegment({
          file,
          startTime: this.currentTimestamp,
          duration: 5000,
          volume: 1
        });
        this.events.emit("audio", { segment });
      }
      input.remove();
    }, { once: true });
    input.click();
  }

  addTextOverlay() {
    const selected = this.activeTrackId ? this.registry.getById(this.activeTrackId) : null;
    const cue = selected?.type === "textTracks" ? selected.item : null;
    this.events.emit("text:edit-request", {
      cue,
      startTime: cue?.startTime ?? this.currentTimestamp
    });
  }

  cycleRatio() {
    const before = this.history?.snapshot?.();
    const keys = Object.keys(RATIO_PRESETS);
    const next = keys[(keys.indexOf(this.aspectRatio) + 1) % keys.length];
    this.aspectRatio = next;
    this.events.emit("ratio", { ratio: next, preset: RATIO_PRESETS[next] });
    this.refresh();
    this.history?.commit(before, "Canvas ratio");
  }

  async writeFile(ffmpeg, path, file) {
    let data;
    if (file instanceof Uint8Array) data = file;
    else if (file instanceof ArrayBuffer) data = new Uint8Array(file);
    else if (file instanceof Blob) data = new Uint8Array(await file.arrayBuffer());
    else throw new Error("NovaCut only accepts browser File/Blob/ArrayBuffer media inputs.");
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

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Number(style.rotation) || 0) * Math.PI / 180);
    ctx.font = `${style.italic ? "italic " : ""}${style.bold ? "800 " : "600 "}${size}px ${style.fontFamily || "system-ui"}`;
    ctx.textAlign = style.align || "center";
    ctx.textBaseline = "middle";

    const lines = String(cue.text).split(/\r?\n/).slice(0, 8);
    const lh = size * 1.2;
    const widest = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    const total = lines.length * lh;

    if (style.background) {
      const clean = String(style.background).replace("#", "");
      const full = clean.length === 3 ? clean.split("").map((item) => item + item).join("") : clean;
      const r = parseInt(full.slice(0, 2), 16) || 0;
      const g = parseInt(full.slice(2, 4), 16) || 0;
      const b = parseInt(full.slice(4, 6), 16) || 0;
      ctx.fillStyle = `rgba(${r},${g},${b},${clamp(style.backgroundAlpha ?? 0.62, 0, 1)})`;
      ctx.fillRect(-widest / 2 - size * 0.35, -total / 2 - size * 0.2, widest + size * 0.7, total + size * 0.4);
    }

    ctx.fillStyle = style.color || "#ffffff";
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, 0, -total / 2 + lineIndex * lh + lh / 2);
    });
    ctx.restore();

    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (value) => value
        ? resolve(value)
        : reject(new Error(`NovaCut failed to encode text layer ${index}.`)),
      "image/png"
    ));
    await this.writeFile(ffmpeg, path, blob);
  }

  async createStickerPng(ffmpeg, sticker, width, height, index, path) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("NovaCut could not create sticker export canvas.");
    ctx.clearRect(0, 0, width, height);
    drawSticker(ctx, sticker, width, height, 1);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (value) => value
        ? resolve(value)
        : reject(new Error(`NovaCut failed to encode sticker layer ${index}.`)),
      "image/png"
    ));
    await this.writeFile(ffmpeg, path, blob);
  }

  async compileAndExportVideo(options = {}) {
    try {
      if (!this.registry.videoTracks.some((clip) => clip.file)) {
        throw new Error("Add at least one video clip before exporting.");
      }

      this.pause();
      this.events.emit("export:start", { hardware: this.hardware });

      const ffmpeg = await this.runtime.ensureLoaded();
      const compiled = this.compiler.compile(options);

      for (const input of compiled.inputs) {
        if (input.file?.__textAsset || input.file?.__stickerAsset) continue;
        await this.writeFile(ffmpeg, input.path, input.file);
      }

      for (const [index, asset] of compiled.overlayAssets.entries()) {
        if (asset.kind === "text") {
          await this.createTextPng(
            ffmpeg,
            asset.cue,
            compiled.width,
            compiled.height,
            index,
            asset.input.path
          );
        } else {
          await this.createStickerPng(
            ffmpeg,
            asset.sticker,
            compiled.width,
            compiled.height,
            index,
            asset.input.path
          );
        }
      }

      const exitCode = await ffmpeg.exec(compiled.args);
      if (Number(exitCode) !== 0) throw new Error(`FFmpeg export failed with exit code ${exitCode}.`);

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
      this.setStatus("Export failed");
      this.reportError("export", error);
      throw error;
    }
  }

  setStatus(message) {
    const element = this.root?.querySelector("[data-role='status']");
    if (element) element.textContent = String(message);
  }

  refresh() {
    this.currentTimestamp = clamp(this.currentTimestamp, 0, this.registry.durationMs());
    this.setPlayhead(this.currentTimestamp);
    this.events.emit("statechange", this.getState());
  }

  reportError(scope, error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.events.emit("error", { scope, error: normalized });
    this.setStatus(normalized.message);
  }

  async dispose() {
    this.pause();
    this.abort?.abort();
    this.preview?.dispose();
    await this.runtime.terminate();
    this.events.clear();
  }
}

export { RUNTIME, RATIO_PRESETS, NovaCutEngine };
export const createNovaCutEngine = (options = {}) => new NovaCutEngine(options);
