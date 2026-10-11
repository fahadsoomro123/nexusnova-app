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

const NOVACUT_SPEED_CURVE_PRESETS = Object.freeze({
  montage: [
    { position: 0, speed: 1 }, { position: 0.22, speed: 2.4 },
    { position: 0.5, speed: 0.5 }, { position: 0.78, speed: 2.4 }, { position: 1, speed: 1 }
  ],
  hero: [
    { position: 0, speed: 1 }, { position: 0.25, speed: 1.4 },
    { position: 0.5, speed: 0.35 }, { position: 0.78, speed: 0.35 }, { position: 1, speed: 1 }
  ],
  bullet: [
    { position: 0, speed: 0.8 }, { position: 0.28, speed: 3 },
    { position: 0.5, speed: 0.35 }, { position: 0.75, speed: 0.35 }, { position: 1, speed: 1.2 }
  ],
  "flash-in": [
    { position: 0, speed: 0.4 }, { position: 0.28, speed: 0.4 },
    { position: 0.65, speed: 1.8 }, { position: 1, speed: 1.2 }
  ],
  "flash-out": [
    { position: 0, speed: 1.2 }, { position: 0.38, speed: 1.8 },
    { position: 0.72, speed: 0.4 }, { position: 1, speed: 0.4 }
  ]
});

function speedCurveAtLocalTime(points, localTimeMs) {
  if (!Array.isArray(points) || points.length < 2) return 1;
  const t = Math.max(0, Number(localTimeMs) || 0);
  if (t <= Number(points[0].timeMs)) return clamp(points[0].speed, 0.25, 4);
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (t > Number(right.timeMs)) continue;
    const span = Math.max(1, Number(right.timeMs) - Number(left.timeMs));
    const amount = clamp((t - Number(left.timeMs)) / span, 0, 1);
    return clamp(Number(left.speed) + (Number(right.speed) - Number(left.speed)) * amount, 0.25, 4);
  }
  return clamp(points[points.length - 1].speed, 0.25, 4);
}

export function normalizeNovaCutSpeedCurve(curve, durationMs, sourceDurationMs) {
  const duration = Math.max(1, Number(durationMs) || 1);
  if (!Array.isArray(curve) || !curve.length) return [];
  const byTime = new Map();
  curve.forEach((point) => {
    if (!point || !Number.isFinite(Number(point.timeMs))) return;
    const timeMs = clamp(point.timeMs, 0, duration);
    byTime.set(timeMs, { timeMs, speed: clamp(point.speed ?? 1, 0.25, 4) });
  });
  let points = [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
  if (!points.length) return [];
  if (points.length === 1) {
    points = [
      { timeMs: 0, speed: points[0].speed },
      { timeMs: duration, speed: points[0].speed }
    ];
  } else {
    if (points[0].timeMs > 0) points.unshift({ timeMs: 0, speed: points[0].speed });
    if (points[points.length - 1].timeMs < duration) {
      points.push({ timeMs: duration, speed: points[points.length - 1].speed });
    }
  }
  const targetAverage = clamp((Number(sourceDurationMs) || duration) / duration, 0.25, 4);
  const averageAt = (factor) => {
    let area = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const span = points[i + 1].timeMs - points[i].timeMs;
      const left = clamp(points[i].speed * factor, 0.25, 4);
      const right = clamp(points[i + 1].speed * factor, 0.25, 4);
      area += span * (left + right) / 2;
    }
    return area / duration;
  };
  let low = 0;
  let high = 64;
  for (let i = 0; i < 48; i += 1) {
    const middle = (low + high) / 2;
    if (averageAt(middle) < targetAverage) low = middle;
    else high = middle;
  }
  const factor = (low + high) / 2;
  return points.map((point) => ({ timeMs: point.timeMs, speed: clamp(point.speed * factor, 0.25, 4) }));
}

export function createNovaCutSpeedCurvePreset(preset, durationMs, sourceDurationMs) {
  const duration = Math.max(1, Number(durationMs) || 1);
  const shape = NOVACUT_SPEED_CURVE_PRESETS[preset];
  if (!shape) return [];
  return normalizeNovaCutSpeedCurve(shape.map((point) => ({
    timeMs: Math.round(duration * point.position),
    speed: point.speed
  })), duration, sourceDurationMs);
}

export function createNovaCutCustomSpeedCurve(points, durationMs, sourceDurationMs) {
  const duration = Math.max(1, Number(durationMs) || 1);
  if (!Array.isArray(points) || points.length < 2) return [];
  const candidates = points
    .filter((point) => point && Number.isFinite(Number(point.position)) && Number.isFinite(Number(point.speed)))
    .map((point) => ({ position: clamp(point.position, 0, 100), speed: clamp(point.speed, 0.25, 4) }))
    .sort((a, b) => a.position - b.position);
  if (candidates.length < 2) return [];
  const unique = [];
  for (const point of candidates) {
    const previous = unique[unique.length - 1];
    if (previous && Math.abs(previous.position - point.position) < 0.001) previous.speed = point.speed;
    else unique.push({ ...point });
  }
  if (unique.length < 2) return [];
  if (unique[0].position > 0.001) unique.unshift({ position: 0, speed: unique[0].speed });
  else unique[0].position = 0;
  if (unique[unique.length - 1].position < 99.999) unique.push({ position: 100, speed: unique[unique.length - 1].speed });
  else unique[unique.length - 1].position = 100;
  const byTime = new Map();
  unique.forEach((point) => {
    const timeMs = Math.round(duration * point.position / 100);
    byTime.set(timeMs, { timeMs, speed: point.speed });
  });
  byTime.set(0, { timeMs: 0, speed: unique[0].speed });
  byTime.set(duration, { timeMs: duration, speed: unique[unique.length - 1].speed });
  return normalizeNovaCutSpeedCurve([...byTime.values()].sort((a, b) => a.timeMs - b.timeMs), duration, sourceDurationMs);
}

export function sampleNovaCutSpeed(clip, timestamp) {
  const local = clamp((Number(timestamp) || 0) - (Number(clip?.startTime) || 0), 0, Math.max(1, Number(clip?.duration) || 1));
  return Array.isArray(clip?.speedCurve) && clip.speedCurve.length > 1
    ? speedCurveAtLocalTime(clip.speedCurve, local)
    : clamp(clip?.speed ?? 1, 0.25, 4);
}

export function novaCutSourceOffsetForTimeline(clip, localTimeMs) {
  const local = Math.max(0, Number(localTimeMs) || 0);
  const points = clip?.speedCurve;
  if (!Array.isArray(points) || points.length < 2) return local * clamp(clip?.speed ?? 1, 0.25, 4);
  let sourceOffset = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    const start = Number(left.timeMs) || 0;
    const span = Math.max(1, Number(right.timeMs) - start);
    if (local <= start) return sourceOffset;
    const elapsed = Math.min(span, local - start);
    const endRate = Number(left.speed) + (Number(right.speed) - Number(left.speed)) * (elapsed / span);
    sourceOffset += elapsed * (Number(left.speed) + endRate) / 2;
    if (local <= start + span) return sourceOffset;
  }
  const last = points[points.length - 1];
  return sourceOffset + Math.max(0, local - Number(last.timeMs)) * clamp(last.speed, 0.25, 4);
}

export function novaCutTimelineOffsetForSource(clip, sourceOffsetMs) {
  const points = clip?.speedCurve;
  if (!Array.isArray(points) || points.length < 2) {
    return Math.max(0, Number(sourceOffsetMs) || 0) / clamp(clip?.speed ?? 1, 0.25, 4);
  }
  const target = Math.max(0, Number(sourceOffsetMs) || 0);
  const duration = Math.max(1, Number(clip?.duration) || Number(points[points.length - 1].timeMs) || 1);
  const sourceDuration = Number(clip?.sourceDuration);
  if (Number.isFinite(sourceDuration) && target >= sourceDuration) return duration;
  let consumed = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    const t0 = Number(left.timeMs) || 0;
    const span = Math.max(1, Number(right.timeMs) - t0);
    const v0 = clamp(left.speed, 0.25, 4);
    const v1 = clamp(right.speed, 0.25, 4);
    const sourceSpan = span * (v0 + v1) / 2;
    if (target <= consumed + sourceSpan) {
      const remaining = Math.max(0, target - consumed);
      const slope = (v1 - v0) / span;
      let elapsed;
      if (Math.abs(slope) < 0.0000001) elapsed = remaining / v0;
      else {
        const discriminant = Math.max(0, v0 * v0 + 2 * slope * remaining);
        const denominator = v0 + Math.sqrt(discriminant);
        elapsed = denominator > 0.000001 ? (2 * remaining) / denominator : span;
      }
      return clamp(t0 + elapsed, 0, duration);
    }
    consumed += sourceSpan;
  }
  const last = points[points.length - 1];
  return clamp(Number(last.timeMs) + (target - consumed) / clamp(last.speed, 0.25, 4), 0, duration);
}

export function sliceNovaCutSpeedCurve(clip, startLocalMs, endLocalMs, sourceDurationMs) {
  if (!Array.isArray(clip?.speedCurve) || clip.speedCurve.length < 2) return [];
  const start = Math.max(0, Number(startLocalMs) || 0);
  const end = Math.max(start + 1, Number(endLocalMs) || 0);
  const duration = end - start;
  const original = normalizeNovaCutSpeedCurve(clip.speedCurve, clip.duration, clip.sourceDuration);
  const points = [{ timeMs: 0, speed: speedCurveAtLocalTime(original, start) }];
  original.forEach((point) => {
    if (point.timeMs > start && point.timeMs < end) points.push({ timeMs: point.timeMs - start, speed: point.speed });
  });
  points.push({ timeMs: duration, speed: speedCurveAtLocalTime(original, end) });
  return normalizeNovaCutSpeedCurve(points, duration, sourceDurationMs);
}

function ffmpegAtempoChain(value) {
  let speed = clamp(value, 0.25, 4);
  const filters = [];
  while (speed < 0.5) { filters.push("atempo=0.5"); speed /= 0.5; }
  while (speed > 2) { filters.push("atempo=2"); speed /= 2; }
  filters.push("atempo=" + speed.toFixed(3));
  return filters.join(",");
}
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

function clipCssFilter(clip) {
  const brightness = clamp(Number(clip?.brightness ?? 100) / 100, 0, 2);
  const contrast = clamp(Number(clip?.contrast ?? 100) / 100, 0, 2);
  const saturation = clamp(Number(clip?.saturation ?? 100) / 100, 0, 3);
  if (brightness === 1 && contrast === 1 && saturation === 1) return "none";
  return "brightness(" + brightness.toFixed(3) + ") contrast(" + contrast.toFixed(3) + ") saturate(" + saturation.toFixed(3) + ")";
}

export function clipOpacityAt(clip, timestamp) {
  const duration = Math.max(1, Number(clip?.duration) || 1);
  const local = clamp(Number(timestamp) - (Number(clip?.startTime) || 0), 0, duration);
  const fadeIn = clamp(Number(clip?.fadeInMs) || 0, 0, duration);
  const fadeOut = clamp(Number(clip?.fadeOutMs) || 0, 0, duration);
  let fadeOpacity = 1;
  if (fadeIn > 0) fadeOpacity = Math.min(fadeOpacity, local / fadeIn);
  if (fadeOut > 0 && duration - local < fadeOut) {
    fadeOpacity = Math.min(fadeOpacity, (duration - local) / fadeOut);
  }
  const hasOpacityKeyframes = Array.isArray(clip?.keyframes) &&
    clip.keyframes.some((frame) => frame?.opacity != null && Number.isFinite(Number(frame.opacity)));
  const animatedOpacity = hasOpacityKeyframes
    ? sampleNovaCutVideoKeyframes(clip, timestamp).opacity
    : clamp(clip?.opacity ?? 1, 0, 1);
  return clamp(fadeOpacity * animatedOpacity, 0, 1);
}

export function sampleNovaCutAudioGain(segment, timestamp) {
  const duration = Math.max(1, Number(segment?.duration) || 1);
  const start = Math.max(0, Number(segment?.startTime) || 0);
  const local = clamp(Number(timestamp) - start, 0, duration);
  const fadeIn = clamp(Number(segment?.fadeInMs) || 0, 0, duration);
  const fadeOut = clamp(Number(segment?.fadeOutMs) || 0, 0, duration);
  let gain = 1;
  if (fadeIn > 0) gain = Math.min(gain, local / fadeIn);
  if (fadeOut > 0 && duration - local < fadeOut) {
    gain = Math.min(gain, (duration - local) / fadeOut);
  }
  return clamp(gain, 0, 1);
}

function keyframeEasingAmount(easing, amount) {
  const t = clamp(amount, 0, 1);
  if (easing === "ease-in") return t * t;
  if (easing === "ease-out") return 1 - (1 - t) * (1 - t);
  if (easing === "ease-in-out") return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t;
}

function ffmpegKeyframeEasingExpression(easing, amount) {
  if (easing === "ease-in") return "pow(" + amount + ",2)";
  if (easing === "ease-out") return "1-pow(1-(" + amount + "),2)";
  if (easing === "ease-in-out") return "if(lt(" + amount + ",0.5),2*pow(" + amount + ",2),1-pow(-2*(" + amount + ")+2,2)/2)";
  return amount;
}

function normalizeVideoKeyframes(frames, durationMs, clip = {}) {
  const duration = Math.max(1, Number(durationMs) || Number(clip.duration) || 1);
  const baseScale = Math.max(0.05, Number(clip.transform?.scale ?? clip.scale) || 1);
  const baseRotation = Number(clip.transform?.rotation) || 0;
  const baseX = Number(clip.x_offset) || 0;
  const baseY = Number(clip.y_offset) || 0;
  const byTime = new Map();
  (Array.isArray(frames) ? frames : []).forEach((frame) => {
    if (!frame || !Number.isFinite(Number(frame.timeMs))) return;
    const timeMs = clamp(frame.timeMs, 0, duration);
    const normalizedFrame = {
      timeMs,
      scale: clamp(frame.scale ?? baseScale, 0.05, 4),
      rotation: clamp(frame.rotation ?? baseRotation, -360, 360),
      x_offset: clamp(frame.x_offset ?? baseX, -2000, 2000),
      y_offset: clamp(frame.y_offset ?? baseY, -2000, 2000),
      easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(frame.easing) ? frame.easing : "linear"
    };
    // Legacy transform-only frames inherit base clip opacity until opacity is keyed.
    if (frame.opacity != null && Number.isFinite(Number(frame.opacity))) {
      normalizedFrame.opacity = clamp(frame.opacity, 0, 1);
    }
    byTime.set(timeMs, normalizedFrame);
  });
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

export function sampleNovaCutVideoKeyframes(clip, timestamp) {
  const duration = Math.max(1, Number(clip?.duration) || 1);
  const startTime = Math.max(0, Number(clip?.startTime) || 0);
  const localTimeMs = clamp(Number(timestamp) - startTime, 0, duration);
  const base = {
    scale: Math.max(0.05, Number(clip?.transform?.scale ?? clip?.scale) || 1),
    rotation: Number(clip?.transform?.rotation) || 0,
    x_offset: Number(clip?.x_offset) || 0,
    y_offset: Number(clip?.y_offset) || 0,
    opacity: clamp(clip?.opacity ?? 1, 0, 1)
  };
  const frames = normalizeVideoKeyframes(clip?.keyframes, duration, clip || {});
  if (!frames.length) return base;
  const values = (frame) => ({
    scale: frame.scale,
    rotation: frame.rotation,
    x_offset: frame.x_offset,
    y_offset: frame.y_offset,
    opacity: frame.opacity != null ? clamp(frame.opacity, 0, 1) : base.opacity,
    easing: frame.easing || "linear"
  });
  if (localTimeMs <= frames[0].timeMs) return values(frames[0]);
  if (localTimeMs >= frames[frames.length - 1].timeMs) return values(frames[frames.length - 1]);
  let rightIndex = frames.findIndex((frame) => frame.timeMs >= localTimeMs);
  if (rightIndex <= 0) return values(frames[0]);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const span = Math.max(1, right.timeMs - left.timeMs);
  const amount = keyframeEasingAmount(left.easing, clamp((localTimeMs - left.timeMs) / span, 0, 1));
  const leftOpacity = left.opacity != null ? clamp(left.opacity, 0, 1) : base.opacity;
  const rightOpacity = right.opacity != null ? clamp(right.opacity, 0, 1) : base.opacity;
  return {
    scale: left.scale + (right.scale - left.scale) * amount,
    rotation: left.rotation + (right.rotation - left.rotation) * amount,
    x_offset: left.x_offset + (right.x_offset - left.x_offset) * amount,
    y_offset: left.y_offset + (right.y_offset - left.y_offset) * amount,
    opacity: leftOpacity + (rightOpacity - leftOpacity) * amount,
    easing: left.easing || "linear"
  };
}

function novaCutLayerBaseValues(item, type = "overlayTracks") {
  if (type === "textTracks") {
    return {
      x: clamp(item?.style?.x ?? 0.5, 0, 1),
      y: clamp(item?.style?.y ?? 0.82, 0, 1),
      scale: 1,
      rotation: Number(item?.style?.rotation) || 0,
      opacity: clamp(item?.opacity ?? 1, 0, 1)
    };
  }
  return {
    x: clamp(item?.x ?? 0.5, 0, 1),
    y: clamp(item?.y ?? 0.5, 0, 1),
    scale: clamp(item?.scale ?? 1, 0.1, 4),
    rotation: clamp(item?.rotation ?? 0, -360, 360),
    opacity: clamp(item?.opacity ?? 1, 0, 1)
  };
}

function normalizeNovaCutLayerKeyframes(item, type = "overlayTracks") {
  const duration = Math.max(1, Number(item?.duration) || 1);
  const base = novaCutLayerBaseValues(item, type);
  const byTime = new Map();
  (Array.isArray(item?.keyframes) ? item.keyframes : []).forEach((frame) => {
    if (!frame || !Number.isFinite(Number(frame.timeMs))) return;
    const timeMs = clamp(frame.timeMs, 0, duration);
    byTime.set(timeMs, {
      timeMs,
      x: clamp(frame.x ?? base.x, 0, 1),
      y: clamp(frame.y ?? base.y, 0, 1),
      scale: clamp(frame.scale ?? base.scale, 0.1, 4),
      rotation: clamp(frame.rotation ?? base.rotation, -360, 360),
      opacity: clamp(frame.opacity ?? base.opacity, 0, 1),
      easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(frame.easing) ? frame.easing : "linear"
    });
  });
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

export function sampleNovaCutLayerKeyframes(item, timestamp, type = "overlayTracks") {
  const duration = Math.max(1, Number(item?.duration) || 1);
  const startTime = Math.max(0, Number(item?.startTime) || 0);
  const localTimeMs = clamp(Number(timestamp) - startTime, 0, duration);
  const base = novaCutLayerBaseValues(item, type);
  const frames = normalizeNovaCutLayerKeyframes(item, type);
  if (!frames.length) return base;
  const values = (frame) => ({
    x: frame.x,
    y: frame.y,
    scale: frame.scale,
    rotation: frame.rotation,
    opacity: frame.opacity,
    easing: frame.easing || "linear"
  });
  if (localTimeMs <= frames[0].timeMs) return values(frames[0]);
  if (localTimeMs >= frames[frames.length - 1].timeMs) return values(frames[frames.length - 1]);
  const rightIndex = frames.findIndex((frame) => frame.timeMs >= localTimeMs);
  if (rightIndex <= 0) return values(frames[0]);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const amount = keyframeEasingAmount(left.easing, clamp(
    (localTimeMs - left.timeMs) / Math.max(1, right.timeMs - left.timeMs), 0, 1
  ));
  return {
    x: left.x + (right.x - left.x) * amount,
    y: left.y + (right.y - left.y) * amount,
    scale: left.scale + (right.scale - left.scale) * amount,
    rotation: left.rotation + (right.rotation - left.rotation) * amount,
    opacity: left.opacity + (right.opacity - left.opacity) * amount,
    easing: left.easing || "linear"
  };
}

function ffmpegNovaCutLayerKeyframeExpression(item, type, property, fallback, clipStartSeconds, timeVariable = "t") {
  const base = novaCutLayerBaseValues(item, type);
  const mappedClip = {
    duration: item.duration,
    scale: base.scale,
    transform: { scale: base.scale, rotation: base.rotation },
    x_offset: base.x,
    y_offset: base.y,
    keyframes: normalizeNovaCutLayerKeyframes(item, type).map((frame) => ({
      timeMs: frame.timeMs,
      scale: frame.scale,
      rotation: frame.rotation,
      x_offset: frame.x,
      y_offset: frame.y,
      opacity: frame.opacity,
      easing: frame.easing
    }))
  };
  const mappedProperty = property === "x" ? "x_offset" : property === "y" ? "y_offset" : property;
  return ffmpegVideoKeyframeExpression(mappedClip, mappedProperty, fallback,
    msToSec(Number(item.startTime) || 0) + (Number(clipStartSeconds) || 0), timeVariable);
}

function ffmpegVideoKeyframeExpression(clip, property, fallback, clipStartSeconds, timeVariable = "t") {
  const frames = normalizeVideoKeyframes(clip?.keyframes, clip?.duration, clip || {});
  const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
  if (!frames.length) return fallbackValue.toFixed(4);
  const points = frames.map((frame) => ({
    time: (Number(clipStartSeconds) || 0) + frame.timeMs / 1000,
    value: frame[property] != null && Number.isFinite(Number(frame[property])) ? Number(frame[property]) : fallbackValue,
    easing: frame.easing || "linear"
  }));
  if (points.length === 1) return points[0].value.toFixed(4);
  let expression = points[points.length - 1].value.toFixed(4);
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const left = points[index];
    const right = points[index + 1];
    const leftTime = left.time.toFixed(4);
    const rightTime = right.time.toFixed(4);
    const denominator = Math.max(0.001, right.time - left.time).toFixed(4);
    const leftValue = left.value.toFixed(4);
    const rightValue = right.value.toFixed(4);
    const amount = "clip((" + timeVariable + "-" + leftTime + ")/" + denominator + ",0,1)";
    const easedAmount = ffmpegKeyframeEasingExpression(left.easing, amount);
    const segment = leftValue + "+(" + rightValue + "-" + leftValue + ")*(" + easedAmount + ")";
    expression = "if(lt(" + timeVariable + "," + rightTime + "),if(lt(" + timeVariable + "," + leftTime + ")," + leftValue + "," + segment + ")," + expression + ")";
  }
  return expression;
}

function videoClipAtTimestamp(clip, timestamp) {
  if (!Array.isArray(clip?.keyframes) || !clip.keyframes.length) return clip;
  const values = sampleNovaCutVideoKeyframes(clip, timestamp);
  return {
    ...clip,
    scale: values.scale,
    x_offset: values.x_offset,
    y_offset: values.y_offset,
    transform: { ...(clip.transform || {}), scale: values.scale, rotation: values.rotation }
  };
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


function ffmpegNovaCutSpeedCurveExpression(clip) {
  const points = clip?.speedCurve;
  if (!Array.isArray(points) || points.length < 2) return "((PTS-STARTPTS)*TB)/" + clamp(clip?.speed ?? 1, 0.25, 4).toFixed(6);
  const sourceVariable = "((PTS-STARTPTS)*TB)";
  const segments = [];
  let sourceOffset = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    const t0 = msToSec(left.timeMs);
    const span = Math.max(0.001, msToSec(Number(right.timeMs) - Number(left.timeMs)));
    const v0 = clamp(left.speed, 0.25, 4);
    const v1 = clamp(right.speed, 0.25, 4);
    const slope = (v1 - v0) / span;
    const localSource = "(" + sourceVariable + "-" + sourceOffset.toFixed(6) + ")";
    const expression = "(" + t0.toFixed(6) + "+(2*" + localSource + ")/(" +
      v0.toFixed(6) + "+sqrt(max(0," + (v0 * v0).toFixed(6) + "+2*" +
      slope.toFixed(6) + "*" + localSource + "))))";
    sourceOffset += span * (v0 + v1) / 2;
    segments.push({ endSource: sourceOffset, expression });
  }
  const last = points[points.length - 1];
  let expression = "(" + msToSec(last.timeMs).toFixed(6) + "+(" + sourceVariable + "-" +
    sourceOffset.toFixed(6) + ")/" + clamp(last.speed, 0.25, 4).toFixed(6) + ")";
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    expression = "if(lt(" + sourceVariable + "," + segments[i].endSource.toFixed(6) + ")," +
      segments[i].expression + "," + expression + ")";
  }
  return expression;
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
    const duration = Math.max(1, Number(input.duration) || 1);
    const speed = clamp(input.speed ?? 1, 0.25, 4);
    const sourceDuration = Math.max(1, Number(input.sourceDuration) || duration * speed);
    const hasIncomingCurve = Array.isArray(input.speedCurve) && input.speedCurve.length > 1;
    const speedCurvePreset = ["none", "montage", "hero", "bullet", "flash-in", "flash-out", "custom"].includes(input.speedCurvePreset)
      ? input.speedCurvePreset
      : hasIncomingCurve ? "custom" : "none";
    const speedCurve = hasIncomingCurve
      ? normalizeNovaCutSpeedCurve(input.speedCurve, duration, sourceDuration)
      : createNovaCutSpeedCurvePreset(speedCurvePreset, duration, sourceDuration);
    const clip = {
      id: String(input.id || uid("video")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration,
      speed,
      sourceDuration,
      speedCurve,
      speedCurvePreset: speedCurve.length ? speedCurvePreset : "none",
      sourceStartTime: Math.max(0, Number(input.sourceStartTime) || 0),
      x_offset: Number(input.x_offset) || 0,
      y_offset: Number(input.y_offset) || 0,
      fitMode: input.fitMode === "fill" ? "fill" : "fit",
      scale: Math.max(0.05, Number(input.scale) || Number(transform.scale) || 1),
      transform: {
        scale: Math.max(0.05, Number(transform.scale ?? input.scale) || 1),
        rotation: Number(transform.rotation) || 0,
        flipX: Boolean(transform.flipX),
        flipY: Boolean(transform.flipY)
      },
      brightness: clamp(input.brightness ?? 100, 0, 200),
      contrast: clamp(input.contrast ?? 100, 0, 200),
      saturation: clamp(input.saturation ?? 100, 0, 300),
      opacity: clamp(input.opacity ?? 1, 0, 1),
      fadeInMs: clamp(input.fadeInMs ?? 0, 0, duration),
      fadeOutMs: clamp(input.fadeOutMs ?? 0, 0, duration),
      keyframes: [],
      volume: clamp(input.volume ?? 1, 0, 4)
    };
    clip.keyframes = normalizeVideoKeyframes(input.keyframes, duration, clip);
    this.videoTracks.push(clip);
    return clip;
  }

  addAudioSegment(input = {}) {
    const segment = {
      id: String(input.id || uid("audio")),
      file: input.file || null,
      startTime: Math.max(0, Number(input.startTime) || 0),
      sourceStartTime: Math.max(0, Number(input.sourceStartTime) || 0),
      duration: Math.max(250, Number(input.duration) || 250),
      volume: clamp(input.volume ?? 1, 0, 4),
      fadeInMs: clamp(input.fadeInMs ?? 0, 0, Math.max(250, Number(input.duration) || 250)),
      fadeOutMs: clamp(input.fadeOutMs ?? 0, 0, Math.max(250, Number(input.duration) || 250))
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
      opacity: clamp(input.opacity ?? 1, 0, 1),
      fadeInMs: clamp(input.fadeInMs ?? 0, 0, Math.max(250, Number(input.duration) || 250)),
      fadeOutMs: clamp(input.fadeOutMs ?? 0, 0, Math.max(250, Number(input.duration) || 250)),
      keyframes: Array.isArray(input.keyframes) ? input.keyframes.map((frame) => ({ ...frame })) : [],
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
        rotation: Number(style.rotation) || 0,
        flipX: Boolean(style.flipX),
        flipY: Boolean(style.flipY)
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
      flipX: Boolean(input.flipX),
      flipY: Boolean(input.flipY),
      startTime: Math.max(0, Number(input.startTime) || 0),
      duration: Math.max(250, Number(input.duration) || 3000),
      opacity: clamp(input.opacity ?? 1, 0, 1),
      fadeInMs: clamp(input.fadeInMs ?? 0, 0, Math.max(250, Number(input.duration) || 3000)),
      fadeOutMs: clamp(input.fadeOutMs ?? 0, 0, Math.max(250, Number(input.duration) || 3000)),
      keyframes: Array.isArray(input.keyframes) ? input.keyframes.map((frame) => ({ ...frame })) : [],
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
    // A paused clip can be observed over several preview frames while its
    // play() promise is still settling. Keep one outstanding request per media
    // element so a slow decoder does not receive duplicate play commands.
    this.videoPlayPending = new WeakSet();
    this.audioPlayPending = new WeakSet();
    this.urls = new Map();
    this.stickerMedia = new Map();
    this.stickerPending = new Map();
    this.nativeEffectElements = new Map();
    this.frameProbe = new Map();
    const userAgent = String(globalThis.navigator?.userAgent || "");
    // Android System WebView may advance the HTMLVideoElement clock while
    // drawImage(video) yields black pixels. Use its native compositor directly
    // on Android WebView; keep Canvas video rendering for ordinary browsers.
    this.forceNativeVideoLayer = isAndroidWebViewUserAgent(userAgent);
    this.nativeFallbackActive = this.forceNativeVideoLayer;
    this.nativePreviewMedia = null;
    this.nativePreviewLayers = new Map();
    this.nativeLayerOrderSignature = "";
    this.renderTick = 0;
    this.frameId = 0;
    this.videoFrameId = 0;
    this.videoFrameElement = null;
    this.videoFramePending = false;
    this.schedulerLoop = null;
    this.lastRenderAt = 0;
    this.running = false;
    this.needsRender = true;
    this.previewQuality = this.forceNativeVideoLayer ? "balanced" : "sharp";
    this.renderUnsubscribers = [];
    if (typeof this.engine.on === "function") {
      ["statechange", "playheadchange", "ratio", "selectionchange", "preview:fallback"].forEach((name) => {
        const unsubscribe = this.engine.on(name, () => this.markDirty());
        if (typeof unsubscribe === "function") this.renderUnsubscribers.push(unsubscribe);
      });
    }
    this.resizeObserver = null;
    this.canvasLayout = { width: 1, height: 1 };
    if (canvas && globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
        this.markDirty();
      });
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const qualityScale = { draft: 0.7, balanced: 0.9, sharp: 1.25 }[this.previewQuality] || 1;
    const dpr = clamp((globalThis.devicePixelRatio || 1) * qualityScale, 0.7, 2);
    this.canvasLayout = {
      width: Math.max(1, Number(rect.width) || 1),
      height: Math.max(1, Number(rect.height) || 1)
    };
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.sourceCanvas.width !== width) this.sourceCanvas.width = width;
    if (this.sourceCanvas.height !== height) this.sourceCanvas.height = height;
  }

  mountNativePreview(media, clip = null) {
    if (!(media instanceof HTMLVideoElement) || !this.canvas) return;
    if (!(this.nativePreviewLayers instanceof Map)) this.nativePreviewLayers = new Map();
    if (typeof this.nativeLayerOrderSignature !== "string") this.nativeLayerOrderSignature = "";
    const shell = this.canvas.parentElement;
    if (!shell) return;
    this.nativePreviewMedia = media;
    const layerId = String(clip?.id || [...this.media.entries()].find(([, candidate]) => candidate === media)?.[0] || "");
    if (layerId) this.nativePreviewLayers.set(layerId, media);
    media.classList.add("nx-novacut__native-preview-video");

    const canvasWidth = Math.max(1, Number(this.canvas.width) || 1);
    const canvasHeight = Math.max(1, Number(this.canvas.height) || 1);
    // Reuse ResizeObserver measurements instead of forcing WebView layout reads
    // during native video frame presentation.
    const clientWidth = Math.max(1, Number(this.canvasLayout?.width) || 1);
    const clientHeight = Math.max(1, Number(this.canvasLayout?.height) || 1);
    const transformScale = Math.max(0.05, Number(clip?.transform?.scale ?? clip?.scale) || 1);
    const fitMode = clip?.fitMode === "fill" ? "cover" : "contain";
    const transform = [
      "translateX(" + (Number(clip?.x_offset || 0) / Math.max(0.1, canvasWidth / clientWidth)) + "px)",
      "translateY(" + (Number(clip?.y_offset || 0) / Math.max(0.1, canvasHeight / clientHeight)) + "px)",
      "rotate(" + (Number(clip?.transform?.rotation || 0)) + "deg)",
      "scale(" + (transformScale * (clip?.transform?.flipX ? -1 : 1)) + "," +
        (transformScale * (clip?.transform?.flipY ? -1 : 1)) + ")"
    ].join(" ");
    const filter = clipCssFilter(clip);
    const opacity = clipOpacityAt(clip, Number(this.engine?.currentTimestamp) || 0);
    if (!media.dataset) {
      try { media.dataset = {}; } catch (_) {}
    }
    const readSignature = (key) => media.dataset?.[key] ?? media["__" + key];
    const writeSignature = (key, value) => {
      if (media.dataset) media.dataset[key] = value;
      else media["__" + key] = value;
    };
    const layoutSignature = [
      clip?.id || "",
      fitMode,
      canvasWidth,
      canvasHeight,
      clientWidth,
      clientHeight
    ].join("|");

    // Split layout state from animated properties. Keyframes may change the
    // transform on each decoded frame; those changes must not rewrite width,
    // height, position, or object-fit and trigger a synchronous WebView layout.
    if (readSignature("novacutPreviewLayoutSignature") !== layoutSignature) {
      Object.assign(media.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: fitMode,
        zIndex: "0",
        pointerEvents: "none",
        background: "#050507",
        display: "block",
        transformOrigin: "center center"
      });
      writeSignature("novacutPreviewLayoutSignature", layoutSignature);
    }

    const animatedStyles = [
      ["transform", "novacutPreviewTransformSignature", transform],
      ["filter", "novacutPreviewFilterSignature", filter],
      ["opacity", "novacutPreviewOpacitySignature", String(opacity)]
    ];
    for (const [property, signatureKey, value] of animatedStyles) {
      if (readSignature(signatureKey) === value) continue;
      media.style[property] = value;
      writeSignature(signatureKey, value);
    }
    if (media.parentElement !== shell) shell.insertBefore(media, this.canvas);
    this.canvas.classList.add("nx-novacut__canvas--native-preview");
  }

  enableNativePreviewFallback(media, clip, reason) {
    if (this.nativeFallbackActive) return;
    this.nativeFallbackActive = true;
    if (this.previewQuality === "sharp") this.setPreviewQuality("balanced");
    this.markDirty();
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
      media.playbackRate = sampleNovaCutSpeed(clip, timestamp);
      const target = Math.max(0, msToSec(clip.sourceStartTime + novaCutSourceOffsetForTimeline(clip, local)));
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
      try { audio.currentTime = msToSec((Number(segment.sourceStartTime) || 0) + local); } catch (_) {}
      audio.volume = clamp(segment.volume ?? 1, 0, 1) * sampleNovaCutAudioGain(segment, timestamp);
    }));
  }

  startMediaPlaybackOnce(media, pendingSet, errorCode = null) {
    if (!media || !pendingSet || pendingSet.has(media)) return false;
    pendingSet.add(media);
    let result;
    try {
      result = media.play();
    } catch (error) {
      pendingSet.delete(media);
      if (errorCode) this.engine.reportError(errorCode, error);
      return false;
    }
    Promise.resolve(result)
      .catch((error) => {
        if (errorCode) this.engine.reportError(errorCode, error);
      })
      .finally(() => {
        pendingSet.delete(media);
        // A play request can settle after the user has already pressed Pause.
        // Do not allow that late promise to restart a stopped preview.
        if (!this.engine.isPlaying) {
          try { media.pause(); } catch (_) {}
        }
      });
    return true;
  }

  enableVideoAudio(media, clip) {
    if (!(media instanceof HTMLVideoElement)) return;
    const rate = sampleNovaCutSpeed(clip, this.engine.currentTimestamp);
    if (Math.abs((Number(media.playbackRate) || 1) - rate) > 0.005) media.playbackRate = rate;
    // Videos stay muted while preloading; restore source audio for user-requested playback.
    media.defaultMuted = false;
    media.muted = false;
    media.volume = clamp(clip?.volume ?? 1, 0, 1) * sampleNovaCutAudioGain(clip, this.engine.currentTimestamp);
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
      media.playbackRate = sampleNovaCutSpeed(clip, this.engine.currentTimestamp);
      const target = Math.max(0, msToSec(clip.sourceStartTime + novaCutSourceOffsetForTimeline(clip, local)));
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
      const audioTarget = msToSec((Number(segment.sourceStartTime) || 0) + local);
      try {
        if (Math.abs(audio.currentTime - audioTarget) > 0.12) audio.currentTime = audioTarget;
        audio.volume = clamp(segment.volume ?? 1, 0, 1) * sampleNovaCutAudioGain(segment, this.engine.currentTimestamp);
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

  getNativeFrameMedia() {
    if (!(this.forceNativeVideoLayer || this.nativeFallbackActive) || !this.engine.isPlaying) return null;
    const active = this.engine.getActiveVideoClips().slice().sort((a, b) => b.startTime - a.startTime);
    for (const clip of active) {
      const media = this.media.get(clip.id);
      if (
        media instanceof HTMLVideoElement &&
        media.readyState >= 2 &&
        !media.paused &&
        typeof media.requestVideoFrameCallback === "function"
      ) return media;
    }
    return null;
  }

  cancelVideoFramePaint() {
    const media = this.videoFrameElement;
    if (this.videoFramePending && media && typeof media.cancelVideoFrameCallback === "function") {
      try { media.cancelVideoFrameCallback(this.videoFrameId); } catch (_) {}
    }
    this.videoFrameId = 0;
    this.videoFramePending = false;
    this.videoFrameElement = null;
  }

  requestVideoFramePaint(media) {
    if (!this.running || !media || typeof media.requestVideoFrameCallback !== "function") return;
    if (this.videoFrameElement !== media) this.cancelVideoFramePaint();
    if (this.videoFramePending) return;
    this.videoFrameElement = media;
    this.videoFramePending = true;
    try {
      this.videoFrameId = media.requestVideoFrameCallback((now) => {
        this.videoFrameId = 0;
        this.videoFramePending = false;
        if (!this.running) {
          this.videoFrameElement = null;
          return;
        }
        if (this.getNativeFrameMedia() !== media) {
          this.videoFrameElement = null;
          if (!this.frameId && this.schedulerLoop) this.frameId = requestAnimationFrame(this.schedulerLoop);
          return;
        }
        if (this.needsRender || this.engine.isPlaying) {
          this.needsRender = false;
          this.lastRenderAt = now;
          try {
            this.render();
          } catch (error) {
            this.needsRender = true;
            this.engine.reportError("preview", error);
          }
        }
        this.requestVideoFramePaint(media);
      });
    } catch (_) {
      this.videoFramePending = false;
      this.videoFrameElement = null;
      if (!this.frameId && this.schedulerLoop) this.frameId = requestAnimationFrame(this.schedulerLoop);
    }
  }

  markDirty() {
    this.needsRender = true;
    if (!this.running) return;
    const nativeMedia = this.getNativeFrameMedia();
    if (nativeMedia) {
      if (this.videoFrameElement === nativeMedia && this.videoFramePending) return;
      this.cancelVideoFramePaint();
      this.requestVideoFramePaint(nativeMedia);
      return;
    }
    this.cancelVideoFramePaint();
    if (!this.frameId && this.schedulerLoop) this.frameId = requestAnimationFrame(this.schedulerLoop);
  }

  setPreviewQuality(mode) {
    const next = ["draft", "balanced", "sharp"].includes(mode) ? mode : "balanced";
    if (next === this.previewQuality) {
      this.markDirty();
      return next;
    }
    this.previewQuality = next;
    this.resize();
    this.markDirty();
    return next;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now = 0) => {
      this.frameId = 0;
      if (!this.running) return;

      const nativeMedia = this.getNativeFrameMedia();
      if (nativeMedia) {
        // Paint overlays only when the hardware-decoded video sends a frame to
        // the compositor, rather than doing a second 30/60 Hz busy render loop.
        this.requestVideoFramePaint(nativeMedia);
        return;
      }

      this.cancelVideoFramePaint();
      const nativePlayback = (this.forceNativeVideoLayer || this.nativeFallbackActive) && this.engine.isPlaying;
      const frameInterval = nativePlayback ? 1000 / 30 : 0;
      const intervalElapsed = !nativePlayback || now - this.lastRenderAt >= frameInterval;
      if (intervalElapsed && (this.needsRender || this.engine.isPlaying)) {
        this.needsRender = false;
        this.lastRenderAt = now;
        try {
          this.render();
        } catch (error) {
          this.needsRender = true;
          this.engine.reportError("preview", error);
        }
      }

      // While paused, one dirty render is enough. markDirty() schedules the
      // next RAF when a setting, clip, resize, or playhead actually changes.
      if (this.engine.isPlaying || this.needsRender) this.frameId = requestAnimationFrame(loop);
    };
    this.schedulerLoop = loop;
    this.frameId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.cancelVideoFramePaint();
    this.schedulerLoop = null;
  }

  render() {
    if (!this.ctx || !this.canvas) return;
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
    if (this.nativeFallbackActive) {
      for (const [id, media] of this.nativePreviewLayers.entries()) {
        if (activeIds.has(id)) continue;
        try { media.pause(); media.remove(); } catch (_) {}
        this.nativePreviewLayers.delete(id);
      }
      const shell = this.canvas?.parentElement;
      const orderSignature = active.map((clip) => clip.id).join("|");
      const layersReady = active.every((clip) => this.nativePreviewLayers.has(clip.id));
      if (shell && layersReady && orderSignature !== this.nativeLayerOrderSignature) {
        for (const clip of active) {
          const media = this.nativePreviewLayers.get(clip.id);
          if (media?.parentElement === shell) shell.insertBefore(media, this.canvas);
        }
        this.nativeLayerOrderSignature = orderSignature;
      }
      this.nativePreviewMedia = Array.from(this.nativePreviewLayers.values()).pop() || null;
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
        const targetRate = sampleNovaCutSpeed(clip, now);
        if (Math.abs((Number(media.playbackRate) || 1) - targetRate) > 0.005) media.playbackRate = targetRate;
        const target = msToSec(clip.sourceStartTime + novaCutSourceOffsetForTimeline(clip, local));
        // Seeking on every RAF while playing repeatedly flushes the decoder on
        // slower Android/WebView devices. Seek only while paused or when a new
        // clip becomes active and needs its initial timeline position.
        if (!this.engine.isPlaying && Math.abs(media.currentTime - target) > 0.03) {
          try { media.currentTime = target; } catch (_) {}
        }
        if (media.readyState < 2) continue;
        if (this.engine.isPlaying && media.paused && !this.videoPlayPending.has(media)) {
          if (Math.abs(media.currentTime - target) > 0.12) {
            try { media.currentTime = target; } catch (_) {}
          }
          this.enableVideoAudio(media, clip);
          this.startMediaPlaybackOnce(media, this.videoPlayPending, "playback");
        }
      }

      const renderClip = videoClipAtTimestamp(clip, now);
      const isVideoElement = media instanceof HTMLVideoElement;
      if (isVideoElement && this.engine.isPlaying) {
        media.volume = clamp(clip.volume ?? 1, 0, 1) * sampleNovaCutAudioGain(clip, now);
      }
      const sw = isVideoElement ? Number(media.videoWidth) : Number(media.naturalWidth);
      const sh = isVideoElement ? Number(media.videoHeight) : Number(media.naturalHeight);
      // Never pretend a not-yet-decoded video is a 1x1 image. That masked the
      // decoder failure and let the UI display PLAYING over a black preview.
      if (isVideoElement && (media.readyState < 2 || sw <= 0 || sh <= 0)) {
        continue;
      }
      if (!(sw > 0 && sh > 0)) continue;
      const clipScale = Math.max(0.05, Number(renderClip.transform?.scale ?? renderClip.scale) || 1);
      const scaledW = sw * clipScale;
      const scaledH = sh * clipScale;
      const fit = renderClip.fitMode === "fill"
        ? Math.max(width / scaledW, height / scaledH)
        : Math.min(width / scaledW, height / scaledH);
      const dw = scaledW * fit;
      const dh = scaledH * fit;
      const x = (width - dw) / 2 + (Number(renderClip.x_offset) || 0);
      const y = (height - dh) / 2 + (Number(renderClip.y_offset) || 0);
      const rotation = (Number(renderClip.transform?.rotation) || 0) * Math.PI / 180;

      if (isVideoElement && this.nativeFallbackActive) {
        this.mountNativePreview(media, renderClip);
        continue;
      }

      ctx.save();
      ctx.filter = clipCssFilter(renderClip);
      ctx.globalAlpha = clipOpacityAt(renderClip, now);
      ctx.translate(x + dw / 2, y + dh / 2);
      ctx.rotate(rotation);
      ctx.scale(renderClip.transform?.flipX ? -1 : 1, renderClip.transform?.flipY ? -1 : 1);
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

    if (!this.nativeFallbackActive) {
      this.sourceCtx?.setTransform(1, 0, 0, 1, 0, 0);
      this.sourceCtx?.clearRect(0, 0, width, height);
      this.sourceCtx?.drawImage(this.canvas, 0, 0, width, height);
    }

    const effects = this.engine.registry.effectTracks
      .filter((effect) => now >= effect.startTime && now < effect.startTime + effect.duration)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    if (this.nativeFallbackActive) {
      this.syncNativeEffectOverlays(effects);
    } else {
      this.clearNativeEffectOverlays();
      for (const effect of effects) drawNovaCutEffect(ctx, this.sourceCanvas, effect, width, height);
    }

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
          audio.volume = clamp(segment.volume ?? 1, 0, 1) * sampleNovaCutAudioGain(segment, now);
          if (audio.paused) this.startMediaPlaybackOnce(audio, this.audioPlayPending);
        }
      });
    }

    for (const sticker of stickers) this.drawSticker(ctx, sticker, width, height);

    const texts = this.engine.registry.textTracks
      .filter((cue) => now >= cue.startTime && now < cue.startTime + cue.duration)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    for (const cue of texts) this.drawText(ctx, cue, width, height);
  }

  syncNativeEffectOverlays(effects = []) {
    const parent = this.canvas?.parentElement;
    if (!parent || !this.nativeFallbackActive) {
      this.clearNativeEffectOverlays();
      return;
    }
    const activeIds = new Set(effects.map((effect) => String(effect.id)));
    for (const [id, element] of this.nativeEffectElements) {
      if (!activeIds.has(id)) {
        element.remove();
        this.nativeEffectElements.delete(id);
      }
    }
    for (const effect of effects) {
      const id = String(effect.id);
      let element = this.nativeEffectElements.get(id);
      if (!element) {
        element = document.createElement("div");
        element.className = "nx-novacut__native-effect-region";
        element.setAttribute("aria-hidden", "true");
        Object.assign(element.style, {
          position: "absolute",
          zIndex: "1",
          pointerEvents: "none",
          boxSizing: "border-box",
          overflow: "hidden",
          borderRadius: "2px"
        });
        // Insert immediately before the transparent canvas: the effect is above
        // the native video layer but the canvas can still draw text/stickers over it.
        parent.insertBefore(element, this.canvas);
        this.nativeEffectElements.set(id, element);
      }
      const x = clamp(effect.x, 0, 0.94);
      const y = clamp(effect.y, 0, 0.94);
      const w = clamp(effect.width, 0.06, 1);
      const h = clamp(effect.height, 0.06, 1);
      const intensity = clamp(effect.intensity, 1, 64);
      const signature = [
        effect.type, x, y, w, h, intensity, effect.color || "#000000",
        clamp(effect.opacity ?? 0.96, 0, 1)
      ].join("|");
      if (element.dataset.novacutEffectSignature === signature) continue;

      element.style.left = (x * 100) + "%";
      element.style.top = (y * 100) + "%";
      element.style.width = (w * 100) + "%";
      element.style.height = (h * 100) + "%";
      element.style.backgroundImage = "none";
      element.style.backgroundColor = "transparent";
      element.style.backdropFilter = "none";
      element.style.webkitBackdropFilter = "none";
      if (effect.type === "blur") {
        const blur = Math.max(1, Math.min(28, intensity * 0.5));
        element.style.backdropFilter = "blur(" + blur + "px)";
        element.style.webkitBackdropFilter = "blur(" + blur + "px)";
        element.style.backgroundColor = "rgba(255,255,255,0.025)";
      } else if (effect.type === "mosaic") {
        const cell = Math.max(4, Math.min(18, Math.round(intensity / 2)));
        element.style.backdropFilter = "blur(1px) saturate(0.65)";
        element.style.webkitBackdropFilter = "blur(1px) saturate(0.65)";
        element.style.backgroundColor = "rgba(90,90,90,0.06)";
        element.style.backgroundImage =
          "repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 1px,transparent 1px " + cell + "px)," +
          "repeating-linear-gradient(90deg,rgba(0,0,0,.15) 0 1px,transparent 1px " + cell + "px)";
      } else if (effect.type === "scramble") {
        const stripe = Math.max(3, Math.min(16, Math.round(intensity / 2)));
        element.style.backdropFilter = "blur(1px) contrast(1.35) saturate(.55)";
        element.style.webkitBackdropFilter = "blur(1px) contrast(1.35) saturate(.55)";
        element.style.backgroundColor = "rgba(30,30,30,0.08)";
        element.style.backgroundImage =
          "repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,transparent 2px " + stripe + "px)," +
          "repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 2px,transparent 2px " + (stripe * 2) + "px)";
      } else if (effect.type === "censor") {
        element.style.backgroundColor = rgba(effect.color || "#000000", clamp(effect.opacity ?? 0.96, 0, 1));
      } else if (effect.type === "vignette") {
        const strength = clamp(intensity, 1, 64) / 64;
        const alpha = clamp(effect.opacity ?? 0.96, 0, 1) * (0.14 + strength * 0.82);
        element.style.backgroundImage =
          "radial-gradient(ellipse at center,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 42%,rgba(0,0,0," +
          (alpha * 0.48).toFixed(3) + ") 72%,rgba(0,0,0," + alpha.toFixed(3) + ") 100%)";
      }
      element.dataset.novacutEffectSignature = signature;
    }
  }

  clearNativeEffectOverlays() {
    for (const element of this.nativeEffectElements.values()) element.remove();
    this.nativeEffectElements.clear();
  }

  drawSticker(ctx, overlay, width, height) {
    let image = this.stickerMedia.get(overlay.id);
    if (!image) {
      if (!this.stickerPending.has(overlay.id)) {
        const task = loadNovaCutImageAsset(overlay.asset).then((value) => {
          this.stickerMedia.set(overlay.id, value);
          this.stickerPending.delete(overlay.id);
          this.markDirty();
        }).catch((error) => {
          this.stickerPending.delete(overlay.id);
          this.engine.reportError("sticker", error);
        });
        this.stickerPending.set(overlay.id, task);
      }
      return;
    }
    const animated = sampleNovaCutLayerKeyframes(overlay, this.engine.currentTimestamp, "overlayTracks");
    const w = Math.max(10, width * Number(overlay.width || 0.2) * animated.scale);
    const h = Math.max(10, height * Number(overlay.height || 0.2) * animated.scale);
    const x = animated.x * width;
    const y = animated.y * height;
    ctx.save();
    ctx.globalAlpha = clipOpacityAt(overlay, this.engine.currentTimestamp);
    ctx.translate(x, y);
    ctx.rotate(animated.rotation * Math.PI / 180);
    ctx.scale(overlay.flipX ? -1 : 1, overlay.flipY ? -1 : 1);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  drawText(ctx, cue, width, height) {
    const style = cue.style || {};
    const animated = sampleNovaCutLayerKeyframes(cue, this.engine.currentTimestamp, "textTracks");
    const x = clamp(animated.x, 0, 1) * width;
    const y = clamp(animated.y, 0, 1) * height;
    const size = Math.max(8, Number(style.fontSize) || 48) * clamp(animated.scale, 0.1, 4);
    ctx.save();
    ctx.globalAlpha = clipOpacityAt(cue, this.engine.currentTimestamp);
    ctx.translate(x, y);
    ctx.rotate((Number(animated.rotation) || 0) * Math.PI / 180);
    ctx.scale(style.flipX ? -1 : 1, style.flipY ? -1 : 1);
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
    this.clearNativeEffectOverlays();
    this.renderUnsubscribers.splice(0).forEach((unsubscribe) => {
      try { unsubscribe(); } catch (_) {}
    });
    this.media.forEach((media) => {
      try { media.pause?.(); media.removeAttribute?.("src"); media.load?.(); media.remove?.(); } catch (_) {}
    });
    this.nativePreviewMedia = null;
    this.nativePreviewLayers.clear();
    this.nativeLayerOrderSignature = "";
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
      .map((clip) => ({ clip, input: addInput(clip.file, sourceKind(clip.file), "video") }))
      .sort((a, b) => Number(a.clip.startTime) - Number(b.clip.startTime));
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
      const hasKeyframes = Array.isArray(clip.keyframes) && clip.keyframes.length > 0;
      const scaleExpression = ffmpegVideoKeyframeExpression(clip, "scale", scale, msToSec(clip.startTime));
      const rotationExpression = ffmpegVideoKeyframeExpression(clip, "rotation", Number(transform.rotation) || 0, msToSec(clip.startTime));
      const begin = msToSec(clip.sourceStartTime);
      const speed = clamp(clip.speed ?? 1, 0.25, 4);
      const hasSpeedCurve = Array.isArray(clip.speedCurve) && clip.speedCurve.length > 1;
      const sourceDuration = Math.max(1, Number(clip.sourceDuration) || Number(clip.duration) * speed);
      const end = begin + msToSec(sourceDuration);
      const startAt = msToSec(clip.startTime);
      const previewWidth = Math.max(1, Number(this.engine.preview?.canvas?.width) || width);
      const previewHeight = Math.max(1, Number(this.engine.preview?.canvas?.height) || height);
      const xOffset = (Number(clip.x_offset) || 0) * width / previewWidth;
      const yOffset = (Number(clip.y_offset) || 0) * height / previewHeight;
      const xOffsetArg = Math.abs(xOffset) < 0.001 ? "0" : xOffset.toFixed(2);
      const yOffsetArg = Math.abs(yOffset) < 0.001 ? "0" : yOffset.toFixed(2);
      const aspectRatioMode = clip.fitMode === "fill" ? "increase" : "decrease";
      const vf = [
        // Match the editor's Fit/Fill framing before applying clip zoom.
        "scale=" + width + ":" + height + ":force_original_aspect_ratio=" + aspectRatioMode,
        hasKeyframes
          ? "scale=w='trunc(iw*(" + scaleExpression + ")/2)*2':h='trunc(ih*(" + scaleExpression + ")/2)*2':eval=frame"
          : "scale=trunc(iw*" + scale + "/2)*2:trunc(ih*" + scale + "/2)*2"
      ];
      const brightness = clamp(Number(clip.brightness ?? 100) / 100, 0, 2);
      const contrast = clamp(Number(clip.contrast ?? 100) / 100, 0, 2);
      const saturation = clamp(Number(clip.saturation ?? 100) / 100, 0, 3);
      if (brightness !== 1) {
        const factor = brightness.toFixed(3);
        vf.push("lutrgb=r='min(255,val*" + factor + ")':g='min(255,val*" + factor + ")':b='min(255,val*" + factor + ")'");
      }
      if (contrast !== 1 || saturation !== 1) {
        vf.push("eq=contrast=" + contrast.toFixed(3) + ":saturation=" + saturation.toFixed(3));
      }
      // Keep the alpha channel through the compositor so the preview and export
      // use the same timed fade envelopes for each clip.
      vf.push("format=rgba");
      const clipDurationSeconds = msToSec(clip.duration);
      const fadeInSeconds = Math.min(clipDurationSeconds, msToSec(clip.fadeInMs || 0));
      const fadeOutSeconds = Math.min(clipDurationSeconds, msToSec(clip.fadeOutMs || 0));
      if (fadeInSeconds > 0) {
        vf.push("fade=t=in:st=" + startAt.toFixed(3) + ":d=" + fadeInSeconds.toFixed(3) + ":alpha=1");
      }
      if (fadeOutSeconds > 0) {
        vf.push("fade=t=out:st=" + Math.max(startAt, startAt + clipDurationSeconds - fadeOutSeconds).toFixed(3) +
          ":d=" + fadeOutSeconds.toFixed(3) + ":alpha=1");
      }
      const hasOpacityKeyframes = Array.isArray(clip.keyframes) &&
        clip.keyframes.some((frame) => frame?.opacity != null && Number.isFinite(Number(frame.opacity)));
      const baseOpacity = clamp(clip.opacity ?? 1, 0, 1);
      if (hasOpacityKeyframes || Math.abs(baseOpacity - 1) > 0.0001) {
        const opacityExpression = hasOpacityKeyframes
          ? ffmpegVideoKeyframeExpression(clip, "opacity", baseOpacity, startAt, "T")
          : baseOpacity.toFixed(4);
        vf.push("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(" + opacityExpression + ")'");
      }
      if (transform.flipX) vf.push("hflip");
      if (transform.flipY) vf.push("vflip");
      const rotation = ((Number(transform.rotation) || 0) % 360 + 360) % 360;
      if (hasKeyframes) {
        vf.push("rotate=angle='(" + rotationExpression + ")*PI/180':c=black@0:ow=iw:oh=ih");
      } else if (rotation === 90) vf.push("transpose=1");
      else if (rotation === 180) vf.push("hflip,vflip");
      else if (rotation === 270) vf.push("transpose=2");
      else if (rotation !== 0) vf.push("rotate=" + (rotation * Math.PI / 180).toFixed(6) + ":c=black@0:ow=rotw(iw):oh=roth(ih)");
      const setptsFilter = hasSpeedCurve
        ? "setpts='(" + ffmpegNovaCutSpeedCurveExpression(clip) + "+" + startAt.toFixed(6) + ")/TB'"
        : "setpts=(PTS-STARTPTS)/" + speed.toFixed(3) + "+" + startAt.toFixed(3) + "/TB";
      filters.push(
        "[" + input.index + ":v:0]trim=start=" + begin.toFixed(3) + ":end=" + end.toFixed(3) +
        "," + setptsFilter + "," + vf.join(",") + "[" + src + "]"
      );
      const xPosition = hasKeyframes
        ? "'(W-w)/2+(" + ffmpegVideoKeyframeExpression(clip, "x_offset", Number(clip.x_offset) || 0, startAt) + ")*" + (width / previewWidth).toFixed(6) + "'"
        : "(W-w)/2+" + xOffsetArg;
      const yPosition = hasKeyframes
        ? "'(H-h)/2+(" + ffmpegVideoKeyframeExpression(clip, "y_offset", Number(clip.y_offset) || 0, startAt) + ")*" + (height / previewHeight).toFixed(6) + "'"
        : "(H-h)/2+" + yOffsetArg;
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=x=" + xPosition +
        ":y=" + yPosition + ":eof_action=pass:shortest=0:repeatlast=0[" + out + "]"
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
      const sourceStartMs = Math.max(0, Number(clip.sourceStartTime) || 0);
      const sourceStart = msToSec(sourceStartMs);
      const speed = clamp(clip.speed ?? 1, 0.25, 4);
      const sourceDuration = Math.max(1, Number(clip.sourceDuration) || Number(clip.duration) * speed);
      const hasSpeedCurve = Array.isArray(clip.speedCurve) && clip.speedCurve.length > 1;
      const delay = Math.max(0, Math.round(Number(clip.startTime) || 0));
      const fadeInSeconds = Math.min(msToSec(clip.fadeInMs || 0), msToSec(clip.duration));
      const fadeOutSeconds = Math.min(msToSec(clip.fadeOutMs || 0), msToSec(clip.duration));
      const audioFades = [];
      if (fadeInSeconds > 0) audioFades.push("afade=t=in:st=0:d=" + fadeInSeconds.toFixed(3));
      if (fadeOutSeconds > 0) audioFades.push("afade=t=out:st=" + Math.max(0, msToSec(clip.duration) - fadeOutSeconds).toFixed(3) + ":d=" + fadeOutSeconds.toFixed(3));
      let processedAudio = label + "raw";
      if (hasSpeedCurve) {
        const points = clip.speedCurve;
        const splitLabels = points.slice(1).map((_, segment) => "vca" + index + "s" + segment);
        filters.push("[" + input.index + ":a:0]asplit=" + splitLabels.length +
          splitLabels.map((name) => "[" + name + "]").join(""));
        const chunks = [];
        let sourceOffsetMs = 0;
        for (let segment = 0; segment < points.length - 1; segment += 1) {
          const left = points[segment];
          const right = points[segment + 1];
          const timelineSpanMs = Math.max(1, Number(right.timeMs) - Number(left.timeMs));
          const segmentSpeed = clamp((Number(left.speed) + Number(right.speed)) / 2, 0.25, 4);
          const sourceSpanMs = timelineSpanMs * segmentSpeed;
          const chunk = "vcachunk" + index + "s" + segment;
          filters.push("[" + splitLabels[segment] + "]atrim=start=" + msToSec(sourceStartMs + sourceOffsetMs).toFixed(6) +
            ":duration=" + msToSec(sourceSpanMs).toFixed(6) + ",asetpts=PTS-STARTPTS," +
            ffmpegAtempoChain(segmentSpeed) + "[" + chunk + "]");
          chunks.push(chunk);
          sourceOffsetMs += sourceSpanMs;
        }
        filters.push(chunks.map((name) => "[" + name + "]").join("") +
          "concat=n=" + chunks.length + ":v=0:a=1[" + processedAudio + "]");
      } else {
        filters.push(
          "[" + input.index + ":a:0]atrim=start=" + sourceStart.toFixed(3) +
          ":duration=" + msToSec(sourceDuration).toFixed(3) +
          ",asetpts=PTS-STARTPTS," + ffmpegAtempoChain(speed) + "[" + processedAudio + "]"
        );
      }
      filters.push(
        "[" + processedAudio + "]" +
        (audioFades.length ? audioFades.join(",") + "," : "") +
        "volume=" + clamp(clip.volume ?? 1, 0, 4).toFixed(3) +
        ",adelay=" + delay + "|" + delay + "[" + label + "]"
      );
      audioLabels.push(label);
    });

    audios.forEach(({ segment, input }, index) => {
      const label = "asrc" + index;
      const delay = Math.max(0, Math.round(Number(segment.startTime) || 0));
      const clipDurationSeconds = msToSec(segment.duration);
      const fadeInSeconds = Math.min(msToSec(segment.fadeInMs || 0), clipDurationSeconds);
      const fadeOutSeconds = Math.min(msToSec(segment.fadeOutMs || 0), clipDurationSeconds);
      const audioFades = [];
      if (fadeInSeconds > 0) audioFades.push("afade=t=in:st=0:d=" + fadeInSeconds.toFixed(3));
      if (fadeOutSeconds > 0) audioFades.push("afade=t=out:st=" + Math.max(0, clipDurationSeconds - fadeOutSeconds).toFixed(3) + ":d=" + fadeOutSeconds.toFixed(3));
      filters.push(
        "[" + input.index + ":a:0]atrim=start=" + msToSec(segment.sourceStartTime || 0).toFixed(3) +
        ":duration=" + clipDurationSeconds.toFixed(3) +
        ",asetpts=PTS-STARTPTS" + (audioFades.length ? "," + audioFades.join(",") : "") +
        ",volume=" + clamp(segment.volume ?? 1, 0, 4).toFixed(3) +
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
        } else if (effect.type === "vignette") {
          const angle = (0.05 + clamp(effect.intensity ?? 32, 1, 64) / 64 * 1.45).toFixed(3);
          regionFilter += ",vignette=angle=" + angle + ":eval=frame";
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

    const layerAlphaFilters = (item) => {
      const durationMs = Math.max(1, Number(item.duration) || 1);
      const startAt = msToSec(item.startTime);
      const fadeInMs = clamp(item.fadeInMs ?? 0, 0, durationMs);
      const fadeOutMs = clamp(item.fadeOutMs ?? 0, 0, durationMs);
      const opacityFilters = [];
      if (fadeInMs > 0) {
        opacityFilters.push("fade=t=in:st=" + startAt.toFixed(3) + ":d=" + msToSec(fadeInMs).toFixed(3) + ":alpha=1");
      }
      if (fadeOutMs > 0) {
        opacityFilters.push("fade=t=out:st=" + (startAt + msToSec(Math.max(0, durationMs - fadeOutMs))).toFixed(3) +
          ":d=" + msToSec(fadeOutMs).toFixed(3) + ":alpha=1");
      }
      const opacity = clamp(item.opacity ?? 1, 0, 1);
      const hasOpacityKeyframes = Array.isArray(item.keyframes) &&
        item.keyframes.some((frame) => frame?.opacity != null && Number.isFinite(Number(frame.opacity)));
      if (hasOpacityKeyframes) {
        const opacityExpression = ffmpegVideoKeyframeExpression({
          duration: durationMs,
          scale: 1,
          transform: { scale: 1, rotation: 0 },
          x_offset: 0,
          y_offset: 0,
          keyframes: item.keyframes
        }, "opacity", opacity, startAt, "T");
        opacityFilters.push("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(" + opacityExpression + ")'");
      } else if (opacity < 0.9999) {
        opacityFilters.push("colorchannelmixer=aa=" + opacity.toFixed(3));
      }
      return ["format=rgba", ...opacityFilters].join(",");
    };

    textAssets.forEach(({ cue, input }, index) => {
      const src = "tsrc" + index;
      const out = "tout" + index;
      const start = msToSec(cue.startTime);
      const end = msToSec(cue.startTime + cue.duration);
      const base = novaCutLayerBaseValues(cue, "textTracks");
      const keyframes = normalizeNovaCutLayerKeyframes(cue, "textTracks");
      const hasScaleKeyframes = keyframes.some((frame) =>
        cue.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.scale != null)
      );
      const hasRotationKeyframes = keyframes.some((frame) =>
        cue.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.rotation != null)
      );
      const scaleExpression = ffmpegNovaCutLayerKeyframeExpression(cue, "textTracks", "scale", base.scale, 0, "t");
      const rotationExpression = ffmpegNovaCutLayerKeyframeExpression(cue, "textTracks", "rotation", base.rotation, 0, "t");
      const xExpression = ffmpegNovaCutLayerKeyframeExpression(cue, "textTracks", "x", base.x, 0, "t");
      const yExpression = ffmpegNovaCutLayerKeyframeExpression(cue, "textTracks", "y", base.y, 0, "t");
      const textFilters = [layerAlphaFilters(cue)];
      if (hasScaleKeyframes) {
        textFilters.push("scale=w='trunc(iw*(" + scaleExpression + ")/2)*2':h='trunc(ih*(" +
          scaleExpression + ")/2)*2':eval=frame");
      }
      if (hasRotationKeyframes || Math.abs(Number(base.rotation) || 0) > 0.001) {
        textFilters.push("rotate=angle='(" + rotationExpression + ")*PI/180':c=black@0:ow=iw:oh=ih");
      }
      filters.push("[" + input.index + ":v:0]" + textFilters.join(",") + "[" + src + "]");
      const xPosition = "'(main_w-overlay_w)/2+((" + xExpression + ")-0.5)*main_w'";
      const yPosition = "'(main_h-overlay_h)/2+((" + yExpression + ")-0.5)*main_h'";
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=x=" + xPosition +
        ":y=" + yPosition + ":enable='between(t," + start.toFixed(3) + "," + end.toFixed(3) +
        ")':eof_action=pass:shortest=0:repeatlast=0[" + out + "]"
      );
      currentVideo = out;
    });

    stickerAssets.forEach(({ overlay, input }, index) => {
      const src = "ssrc" + index;
      const out = "sout" + index;
      const start = msToSec(overlay.startTime);
      const end = msToSec(overlay.startTime + overlay.duration);
      const baseScale = clamp(Number(overlay.scale) || 1, 0.1, 4);
      const w = clamp(Number(overlay.width || 0.2) * baseScale, 0.02, 1);
      const h = clamp(Number(overlay.height || 0.2) * baseScale, 0.02, 1);
      const x = clamp(Number(overlay.x || 0.5) - w / 2, 0, Math.max(0, 1 - w));
      const y = clamp(Number(overlay.y || 0.5) - h / 2, 0, Math.max(0, 1 - h));
      const targetWidth = Math.max(2, Math.floor(width * w) & ~1);
      const targetHeight = Math.max(2, Math.floor(height * h) & ~1);
      const keyframes = normalizeNovaCutLayerKeyframes(overlay, "overlayTracks");
      const hasScaleKeyframes = keyframes.some((frame) => overlay.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.scale != null));
      const hasRotationKeyframes = keyframes.some((frame) => overlay.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.rotation != null));
      const hasXKeyframes = keyframes.some((frame) => overlay.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.x != null));
      const hasYKeyframes = keyframes.some((frame) => overlay.keyframes?.some((raw) => Number(raw.timeMs) === frame.timeMs && raw.y != null));
      const scaleExpression = ffmpegNovaCutLayerKeyframeExpression(overlay, "overlayTracks", "scale", baseScale, 0, "t");
      const rotationExpression = ffmpegNovaCutLayerKeyframeExpression(overlay, "overlayTracks", "rotation", Number(overlay.rotation) || 0, 0, "t");
      const xExpression = ffmpegNovaCutLayerKeyframeExpression(overlay, "overlayTracks", "x", Number(overlay.x) || 0.5, 0, "t");
      const yExpression = ffmpegNovaCutLayerKeyframeExpression(overlay, "overlayTracks", "y", Number(overlay.y) || 0.5, 0, "t");
      const stickerFilters = [
        "scale=" + targetWidth + ":" + targetHeight + ":force_original_aspect_ratio=decrease",
        "pad=" + targetWidth + ":" + targetHeight + ":(ow-iw)/2:(oh-ih)/2:color=black@0"
      ];
      if (hasScaleKeyframes) {
        stickerFilters.push("scale=w='trunc(iw*(" + scaleExpression + ")/" + baseScale.toFixed(4) + "/2)*2':h='trunc(ih*(" +
          scaleExpression + ")/" + baseScale.toFixed(4) + "/2)*2':eval=frame");
      }
      if (hasRotationKeyframes || Math.abs(Number(overlay.rotation) || 0) > 0.001) {
        const angle = hasRotationKeyframes ? "(" + rotationExpression + ")*PI/180" : ((Number(overlay.rotation) || 0) * Math.PI / 180).toFixed(6);
        stickerFilters.push("rotate=angle='" + angle + "':c=black@0:ow=rotw(iw):oh=roth(ih)");
      }
      const hasPositionKeyframes = hasXKeyframes || hasYKeyframes;
      const xPosition = hasXKeyframes
        ? "'clip(main_w*(" + xExpression + ")-overlay_w/2,0,main_w-overlay_w)'"
        : "main_w*" + x.toFixed(5);
      const yPosition = hasYKeyframes
        ? "'clip(main_h*(" + yExpression + ")-overlay_h/2,0,main_h-overlay_h)'"
        : "main_h*" + y.toFixed(5);
      filters.push(
        "[" + input.index + ":v:0]" + layerAlphaFilters(overlay) + "," + stickerFilters.join(",") + "[" + src + "]"
      );
      filters.push(
        "[" + currentVideo + "][" + src + "]overlay=x=" + xPosition +
        ":y=" + yPosition +
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
    this.projectDbPromise = null;
    this.projectReady = false;
    this.projectHydrationStarted = false;
    this.projectReadyPromise = Promise.resolve({ restored: false, available: false });
    this.projectPersistenceDisabled = false;
    this.projectSaveTimer = 0;
    this.projectSaveQueue = Promise.resolve();
    this.lastProjectSaveError = "";
    this.events.on("statechange", () => this.scheduleProjectDraftSave());
    this.events.on("selectionchange", () => this.scheduleProjectDraftSave());
    this.events.on("ratio", () => this.scheduleProjectDraftSave());
    if (this.root) this.mount(this.root);
  }

  on(event, callback) { return this.events.on(event, callback); }
  emitHistoryState() { this.events.emit("historystatechange", { canUndo: this.history.canUndo(), canRedo: this.history.canRedo() }); }

  mount(root) {
    this.root = root;
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const blockUntilDraftReady = (event) => {
      if (this.projectReady) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    };
    ["click", "pointerdown", "drop", "paste"].forEach((type) => {
      root.addEventListener(type, blockUntilDraftReady, { capture: true, signal });
    });
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
    // Text actions are delegated below because timeline lane buttons are
    // re-created during renderTimeline and therefore cannot keep direct
    // listeners attached at mount time.
    bind("ratio", () => this.openCanvasRatioPicker());
    bind("export", () => this.compileAndExportVideo());
    bind("play", () => this.togglePlayback());

    root.addEventListener("click", (event) => {
      const target = event.target?.closest?.("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (action === "sticker") this.openStickerPicker();
      else if (action === "text") this.openTextEditor();
      else if (action === "effects") this.openEffectsEditor();
      else if (action === "more") this.openToolMenu();
    }, { signal });

    this.installCanvasInteractions(canvas);
    this.events.emit("selectionchange", { id: this.activeTrackId });
    this.emitHistoryState();
    if (!this.projectHydrationStarted) {
      this.projectHydrationStarted = true;
      this.setStatus("Restoring saved draft…");
      this.projectReadyPromise = this.restoreProjectDraft().then((result) => {
        this.projectReady = true;
        if (root?.dataset) root.dataset.novacutProjectReady = "true";
        if (result.restored) {
          this.activeTrackId = this.findFirstExistingId(this.activeTrackId);
          this.preview?.syncRegistry();
          this.preview?.markDirty();
          this.events.emit("ratio", {
            ratio: this.aspectRatio,
            size: RATIO_PRESETS[this.aspectRatio],
            restored: true
          });
          this.setStatus("Draft restored");
        } else if (!result.available) {
          this.projectPersistenceDisabled = true;
          this.setStatus("Draft autosave is unavailable in this browser");
        } else {
          this.setStatus("Ready");
        }
        this.events.emit("statechange", this.getState());
        this.emitHistoryState();
        return result;
      }).catch((error) => {
        this.projectReady = true;
        this.projectPersistenceDisabled = true;
        if (root?.dataset) root.dataset.novacutProjectReady = "true";
        this.setStatus("Draft restore failed: " + String(error?.message || error).slice(0, 120));
        this.events.emit("statechange", this.getState());
        return { restored: false, available: false, error };
      });
    } else {
      this.projectReady = true;
      if (root?.dataset) root.dataset.novacutProjectReady = "true";
    }
    return this;
  }

  openProjectDraftDatabase() {
    if (this.projectPersistenceDisabled || !globalThis.indexedDB) {
      return Promise.resolve(null);
    }
    if (this.projectDbPromise) return this.projectDbPromise;
    this.projectDbPromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open("novacut-project-drafts", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local draft storage."));
      request.onblocked = () => reject(new Error("Local draft storage is blocked by another editor tab."));
    }).catch((error) => {
      this.projectDbPromise = null;
      throw error;
    });
    return this.projectDbPromise;
  }

  cloneProjectDraftValue(value) {
    if (typeof Blob !== "undefined" && value instanceof Blob) return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map((item) => this.cloneProjectDraftValue(item));
    if (!value || typeof value !== "object") return value;
    const result = {};
    Object.keys(value).forEach((key) => {
      if (value[key] !== undefined) result[key] = this.cloneProjectDraftValue(value[key]);
    });
    return result;
  }

  async restoreProjectDraft() {
    if (!globalThis.indexedDB) {
      return { restored: false, available: false };
    }
    const db = await this.openProjectDraftDatabase();
    if (!db) return { restored: false, available: false };
    const draft = await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", "readonly");
      const request = transaction.objectStore("drafts").get("current");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read the last NovaCut draft."));
      transaction.onabort = () => reject(transaction.error || new Error("Draft restore transaction was aborted."));
    });
    if (!draft?.state || typeof draft.state !== "object") {
      return { restored: false, available: true };
    }
    const state = draft.state;
    const trackNames = ["videoTracks", "audioTracks", "textTracks", "overlayTracks", "effectTracks"];
    if (!trackNames.every((name) => Array.isArray(state[name]))) {
      return { restored: false, available: true };
    }
    for (const name of trackNames) {
      this.registry[name] = state[name];
    }
    if (RATIO_PRESETS[draft.aspectRatio]) this.aspectRatio = draft.aspectRatio;
    this.aspectRatioExplicit = Boolean(draft.aspectRatioExplicit);
    this.currentTimestamp = clamp(Number(draft.currentTimestamp) || 0, 0, this.registry.durationMs());
    this.activeTrackId = this.findFirstExistingId(draft.activeTrackId);
    this.preview?.syncRegistry();
    return { restored: true, available: true, savedAt: Number(draft.savedAt) || 0 };
  }

  scheduleProjectDraftSave() {
    if (!this.projectReady || this.projectPersistenceDisabled) return;
    if (this.projectSaveTimer) clearTimeout(this.projectSaveTimer);
    this.projectSaveTimer = setTimeout(() => {
      this.projectSaveTimer = 0;
      this.saveProjectDraft().catch((error) => {
        const message = String(error?.message || error);
        if (message !== this.lastProjectSaveError) {
          this.lastProjectSaveError = message;
          this.setStatus("Draft auto-save failed: " + message.slice(0, 110));
        }
      });
    }, 900);
  }

  saveProjectDraft() {
    if (!this.projectReady || this.projectPersistenceDisabled) return Promise.resolve(false);
    const draft = this.cloneProjectDraftValue({
      id: "current",
      savedAt: Date.now(),
      aspectRatio: this.aspectRatio,
      aspectRatioExplicit: this.aspectRatioExplicit,
      currentTimestamp: this.currentTimestamp,
      activeTrackId: this.activeTrackId,
      state: this.getState()
    });
    const persist = async () => {
      const db = await this.openProjectDraftDatabase();
      if (!db) throw new Error("IndexedDB is unavailable.");
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("drafts", "readwrite");
        transaction.objectStore("drafts").put(draft);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error || new Error("Could not save the NovaCut draft."));
        transaction.onabort = () => reject(transaction.error || new Error("Draft save transaction was aborted."));
      });
      if (this.root?.dataset) this.root.dataset.novacutDraftSavedAt = String(draft.savedAt);
      this.lastProjectSaveError = "";
      return true;
    };
    this.projectSaveQueue = this.projectSaveQueue.catch(() => false).then(persist);
    return this.projectSaveQueue;
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
    // Selection is presentation state, not a timeline-model mutation. Emitting
    // statechange/refresh here recreates every clip DOM node in the middle of
    // a drag gesture, leaving the gesture attached to a detached element.
    this.events.emit("selectionchange", { id: this.activeTrackId });
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
    if (!selected || !["videoTracks", "textTracks", "overlayTracks"].includes(selected.type)) {
      this.setStatus("Select a video, text, or sticker clip to flip.");
      return false;
    }
    const before = this.history.capture();
    const key = axis === "y" ? "flipY" : "flipX";
    if (selected.type === "videoTracks") {
      selected.item.transform = { ...(selected.item.transform || {}), [key]: !selected.item.transform?.[key] };
    } else if (selected.type === "overlayTracks") {
      selected.item[key] = !selected.item[key];
    } else {
      selected.item.style = { ...(selected.item.style || {}), [key]: !selected.item.style?.[key] };
    }
    this.history.record(before, "Flip");
    this.refresh();
    this.setStatus((axis === "y" ? "Vertical" : "Horizontal") + " flip applied");
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

  openCanvasRatioPicker() {
    const sheet = this.openSheet("Canvas ratio");
    sheet.body.innerHTML =
      '<div class="nx-novacut__tool-grid">' +
      Object.keys(RATIO_PRESETS).map((ratio) =>
        '<button type="button" data-ratio-value="' + ratio + '"' +
        (ratio === this.aspectRatio ? ' aria-pressed="true"' : ' aria-pressed="false"') +
        '>' + ratio + '</button>'
      ).join("") +
      '</div>';
    sheet.body.querySelectorAll("[data-ratio-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const ratio = button.dataset.ratioValue;
        if (!RATIO_PRESETS[ratio]) return;
        this.aspectRatio = ratio;
        this.aspectRatioExplicit = true;
        this.events.emit("ratio", { ratio, size: RATIO_PRESETS[ratio] });
        this.setStatus("Canvas " + ratio);
        this.refresh();
        this.closeSheet(sheet.root);
      });
    });
  }

  setPreviewQuality(mode) {
    const quality = ["draft", "balanced", "sharp"].includes(mode) ? mode : "balanced";
    const applied = this.preview?.setPreviewQuality(quality) || quality;
    this.setStatus("Preview quality: " + applied + " (export quality unchanged)");
    return applied;
  }

  setSelectedFitMode(mode) {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") {
      this.setStatus("Select a video clip first.");
      return false;
    }
    const fitMode = mode === "fill" ? "fill" : "fit";
    if (selected.item.fitMode === fitMode) {
      this.setStatus(fitMode === "fill" ? "Fill canvas" : "Fit video");
      return true;
    }
    const before = this.history.capture();
    selected.item.fitMode = fitMode;
    this.history.record(before, fitMode === "fill" ? "Fill canvas" : "Fit video");
    this.setStatus(fitMode === "fill" ? "Fill canvas" : "Fit video");
    this.refresh();
    return true;
  }

  setVideoKeyframeAtPlayhead(values = null) {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") {
      this.setStatus("Select a video clip first.");
      return false;
    }
    const clip = selected.item;
    const localTimeMs = this.currentTimestamp - clip.startTime;
    if (localTimeMs < 0 || localTimeMs >= clip.duration) {
      this.setStatus("Move the playhead inside the selected video clip.");
      return false;
    }

    const before = this.history.capture();
    let frameValues = sampleNovaCutVideoKeyframes(clip, this.currentTimestamp);
    if (values && typeof values === "object") {
      frameValues = {
        scale: clamp(values.scale ?? frameValues.scale, 0.05, 4),
        rotation: clamp(values.rotation ?? frameValues.rotation, -360, 360),
        x_offset: clamp(values.x_offset ?? frameValues.x_offset, -2000, 2000),
        y_offset: clamp(values.y_offset ?? frameValues.y_offset, -2000, 2000),
        opacity: clamp(values.opacity ?? frameValues.opacity, 0, 1),
        easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(values.easing) ? values.easing : (frameValues.easing || "linear")
      };
      clip.scale = frameValues.scale;
      clip.x_offset = frameValues.x_offset;
      clip.y_offset = frameValues.y_offset;
      clip.transform = { ...(clip.transform || {}), scale: frameValues.scale, rotation: frameValues.rotation };
    }
    const keyframe = { timeMs: clamp(localTimeMs, 0, clip.duration), ...frameValues };
    const frames = normalizeVideoKeyframes(clip.keyframes, clip.duration, clip);
    const existingIndex = frames.findIndex((frame) => Math.abs(frame.timeMs - keyframe.timeMs) <= 20);
    if (existingIndex >= 0) frames.splice(existingIndex, 1, keyframe);
    else frames.push(keyframe);
    clip.keyframes = normalizeVideoKeyframes(frames, clip.duration, clip);
    this.history.record(before, "Set keyframe");
    this.refresh();
    this.setStatus("Keyframe set at " + (keyframe.timeMs / 1000).toFixed(2) + "s");
    return true;
  }

  setLayerOpacityKeyframeAtPlayhead(values = null) {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || !["textTracks", "overlayTracks"].includes(selected.type)) {
      this.setStatus("Select a text or sticker layer first.");
      return false;
    }
    const item = selected.item;
    const localTimeMs = this.currentTimestamp - Number(item.startTime || 0);
    if (localTimeMs < 0 || localTimeMs >= Number(item.duration || 0)) {
      this.setStatus("Move the playhead inside the selected text or sticker layer.");
      return false;
    }
    const layerType = selected.type === "overlayTracks" ? "overlayTracks" : "textTracks";
    const sampled = sampleNovaCutLayerKeyframes(item, this.currentTimestamp, layerType);
    const opacity = clamp(values?.opacity ?? sampled.opacity ?? item.opacity ?? 1, 0, 1);
    const easing = ["linear", "ease-in", "ease-out", "ease-in-out"].includes(values?.easing)
      ? values.easing
      : "linear";
    const before = this.history.capture();
    const keyframes = Array.isArray(item.keyframes) ? item.keyframes.map((frame) => ({ ...frame })) : [];
    const timeMs = clamp(localTimeMs, 0, Number(item.duration) || 1);
    const existingIndex = keyframes.findIndex((frame) =>
      frame.opacity != null && Math.abs(Number(frame.timeMs) - timeMs) <= 34
    );
    const keyframe = { timeMs, opacity, easing };
    if (["textTracks", "overlayTracks"].includes(layerType)) {
      keyframe.x = clamp(values?.x ?? sampled.x, 0, 1);
      keyframe.y = clamp(values?.y ?? sampled.y, 0, 1);
      keyframe.scale = clamp(values?.scale ?? sampled.scale, 0.1, 4);
      keyframe.rotation = clamp(values?.rotation ?? sampled.rotation, -360, 360);
    }
    if (existingIndex >= 0) keyframes.splice(existingIndex, 1, keyframe);
    else keyframes.push(keyframe);
    item.keyframes = keyframes.sort((a, b) => Number(a.timeMs) - Number(b.timeMs));
    this.history.record(before, "Set layer opacity keyframe");
    this.refresh();
    this.setStatus("Layer opacity keyframe set at " + (timeMs / 1000).toFixed(2) + "s");
    return true;
  }

  removeLayerOpacityKeyframeAtPlayhead() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || !["textTracks", "overlayTracks"].includes(selected.type)) {
      this.setStatus("Select a text or sticker layer first.");
      return false;
    }
    const item = selected.item;
    const localTimeMs = this.currentTimestamp - Number(item.startTime || 0);
    const index = (item.keyframes || []).findIndex((frame) =>
      frame.opacity != null && Math.abs(Number(frame.timeMs) - localTimeMs) <= 34
    );
    if (index < 0) {
      this.setStatus("There is no opacity keyframe at the current playhead.");
      return false;
    }
    const before = this.history.capture();
    item.keyframes.splice(index, 1);
    this.history.record(before, "Remove layer opacity keyframe");
    this.refresh();
    this.setStatus("Layer opacity keyframe removed");
    return true;
  }

  removeVideoKeyframeAtPlayhead() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") {
      this.setStatus("Select a video clip first.");
      return false;
    }
    const clip = selected.item;
    const localTimeMs = this.currentTimestamp - clip.startTime;
    if (localTimeMs < 0 || localTimeMs >= clip.duration) {
      this.setStatus("Move the playhead inside the selected video clip.");
      return false;
    }
    const frames = normalizeVideoKeyframes(clip.keyframes, clip.duration, clip);
    const index = frames.findIndex((frame) => Math.abs(frame.timeMs - localTimeMs) <= 34);
    if (index < 0) {
      this.setStatus("There is no keyframe at the current playhead.");
      return false;
    }
    const before = this.history.capture();
    frames.splice(index, 1);
    clip.keyframes = frames;
    this.history.record(before, "Remove keyframe");
    this.refresh();
    this.setStatus("Keyframe removed");
    return true;
  }

  setSelectedKeyframeAtPlayhead() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected) {
      this.setStatus("Select a video, text, or sticker clip first.");
      return false;
    }
    if (selected.type === "videoTracks") return this.setVideoKeyframeAtPlayhead();
    if (["textTracks", "overlayTracks"].includes(selected.type)) {
      const item = selected.item;
      const localTimeMs = this.currentTimestamp - Number(item.startTime || 0);
      if (localTimeMs < 0 || localTimeMs >= Number(item.duration || 0)) {
        this.setStatus("Move the playhead inside the selected text or sticker layer.");
        return false;
      }
      const sampled = sampleNovaCutLayerKeyframes(item, this.currentTimestamp, selected.type);
      const easing = (item.keyframes || [])
        .filter((frame) => frame.opacity != null)
        .sort((a, b) => Math.abs(Number(a.timeMs) - localTimeMs) - Math.abs(Number(b.timeMs) - localTimeMs))[0]?.easing || "linear";
      return this.setLayerOpacityKeyframeAtPlayhead({ ...sampled, easing });
    }
    this.setStatus("Keyframes are available for video, text, and sticker clips.");
    return false;
  }

  removeSelectedKeyframeAtPlayhead() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected) {
      this.setStatus("Select a video, text, or sticker clip first.");
      return false;
    }
    if (selected.type === "videoTracks") return this.removeVideoKeyframeAtPlayhead();
    if (["textTracks", "overlayTracks"].includes(selected.type)) return this.removeLayerOpacityKeyframeAtPlayhead();
    this.setStatus("Keyframes are available for video, text, and sticker clips.");
    return false;
  }

  adjustSelectedVideoScale(multiplier) {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") {
      this.setStatus("Select a video clip first.");
      return false;
    }
    const before = this.history.capture();
    const oldScale = Math.max(0.05, Number(selected.item.transform?.scale ?? selected.item.scale) || 1);
    const nextScale = clamp(oldScale * (Number(multiplier) || 1), 0.25, 4);
    selected.item.transform = { ...(selected.item.transform || {}), scale: nextScale };
    selected.item.scale = nextScale;
    this.history.record(before, "Resize video");
    this.setStatus("Video scale " + Math.round(nextScale * 100) + "%");
    this.refresh();
    return true;
  }

  resetSelectedVideoFraming() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected || selected.type !== "videoTracks") {
      this.setStatus("Select a video clip first.");
      return false;
    }
    const before = this.history.capture();
    selected.item.fitMode = "fit";
    selected.item.x_offset = 0;
    selected.item.y_offset = 0;
    selected.item.scale = 1;
    selected.item.transform = { ...(selected.item.transform || {}), scale: 1 };
    this.history.record(before, "Reset video framing");
    this.setStatus("Video framing reset");
    this.refresh();
    return true;
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
    let lastPreloadAt = 0;
    const tick = (now) => {
      if (!this.isPlaying) return;
      const delta = Math.max(0, now - last);
      last = now;
      if (now - lastPreloadAt >= 250) {
        lastPreloadAt = now;
        this.preloadUpcomingMedia(this.currentTimestamp, 1800);
      }
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
        const sourceOffset = media.currentTime * 1000 - Math.max(0, Number(clockClip.sourceStartTime) || 0);
        const mediaTimelineTime = clockClip.startTime + novaCutTimelineOffsetForSource(clockClip, sourceOffset);
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

  preloadUpcomingMedia(timestamp = this.currentTimestamp, preloadWindowMs = 1800) {
    if (!this.preview || !this.isPlaying) return;
    const horizon = Number(timestamp) + Math.max(250, Number(preloadWindowMs) || 1800);
    const nextVideo = this.registry.videoTracks
      .filter((clip) => clip.file && Number(clip.startTime) > Number(timestamp) + 20 &&
        Number(clip.startTime) <= horizon)
      .sort((a, b) => Number(a.startTime) - Number(b.startTime))[0];
    if (nextVideo && !this.preview.media.has(nextVideo.id) && !this.preview.pending.has(nextVideo.id)) {
      // Begin decoding the next clip before its timeline boundary. Resolution is
      // deduplicated by the preview cache and deliberately does not block RAF.
      void this.preview.resolve(nextVideo).then((media) => {
        if (!(media instanceof HTMLVideoElement)) return;
        const sourceStart = msToSec(nextVideo.sourceStartTime);
        try {
          if (Math.abs(media.currentTime - sourceStart) > 0.03) media.currentTime = sourceStart;
        } catch (_) {}
      }).catch((error) => this.reportError("preload-video", error));
    }

    const nextAudio = this.registry.audioTracks
      .filter((segment) => segment.file && Number(segment.startTime) > Number(timestamp) + 20 &&
        Number(segment.startTime) <= horizon)
      .sort((a, b) => Number(a.startTime) - Number(b.startTime))[0];
    if (nextAudio && !this.preview.audioMedia.has(nextAudio.id) && !this.preview.audioPending.has(nextAudio.id)) {
      void this.preview.resolveAudio(nextAudio).then((audio) => {
        if (!audio) return;
        const sourceStart = msToSec(nextAudio.sourceStartTime || 0);
        try {
          if (Math.abs(audio.currentTime - sourceStart) > 0.03) audio.currentTime = sourceStart;
        } catch (_) {}
      }).catch((error) => this.reportError("preload-audio", error));
    }
  }

  async prepareClip(clip) {
    if (!clip?.file || !this.preview) return null;
    this.events.emit("media:decoding", { clip });
    try {
      const media = await this.preview.resolve(clip);
      if (media instanceof HTMLVideoElement) {
        media.playbackRate = clamp(clip.speed ?? 1, 0.25, 4);
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
    if (!record) {
      this.setStatus("Select a timeline clip before using Split.");
      return { success: false };
    }
    const tracks = this.registry[record.type];
    if (!Array.isArray(tracks)) {
      this.setStatus("This timeline item cannot be split.");
      return { success: false };
    }

    const before = this.history.capture();
    const item = record.item;
    const timestamp = clamp(currentTimestamp, item.startTime, item.startTime + item.duration);
    const left = timestamp - item.startTime;
    const right = item.startTime + item.duration - timestamp;
    const frame = 1000 / 30;
    if (left <= frame || right <= frame) {
      this.setStatus("Move the playhead away from the clip edge.");
      return { success: false, reason: "split-point-too-close-to-boundary" };
    }

    const idPrefix = {
      videoTracks: "video",
      audioTracks: "audio",
      textTracks: "text",
      overlayTracks: "sticker",
      effectTracks: "effect"
    }[record.type] || "clip";
    const sourceStartTime = Math.max(0, Number(item.sourceStartTime) || 0);
    const clipSpeed = record.type === "videoTracks" ? clamp(item.speed ?? 1, 0.25, 4) : 1;
    const hasSpeedCurve = record.type === "videoTracks" && Array.isArray(item.speedCurve) && item.speedCurve.length > 1;
    const splitSourceOffset = hasSpeedCurve ? novaCutSourceOffsetForTimeline(item, left) : left * clipSpeed;
    const first = { ...cloneObject(item), duration: left };
    const second = {
      ...cloneObject(item),
      id: uid(idPrefix),
      startTime: timestamp,
      duration: right
    };
    if ("sourceStartTime" in item) second.sourceStartTime = sourceStartTime + splitSourceOffset;
    if (record.type === "videoTracks") {
      first.sourceDuration = Math.max(1, splitSourceOffset);
      second.sourceDuration = Math.max(1, Number(item.sourceDuration) - splitSourceOffset);
      if (hasSpeedCurve) {
        first.speedCurve = sliceNovaCutSpeedCurve(item, 0, left, first.sourceDuration);
        second.speedCurve = sliceNovaCutSpeedCurve(item, left, item.duration, second.sourceDuration);
        first.speed = clamp(first.sourceDuration / left, 0.25, 4);
        second.speed = clamp(second.sourceDuration / right, 0.25, 4);
        first.speedCurvePreset = first.speedCurve.length ? "custom" : "none";
        second.speedCurvePreset = second.speedCurve.length ? "custom" : "none";
      } else {
        first.sourceDuration = Math.max(1, left * clipSpeed);
        second.sourceDuration = Math.max(1, right * clipSpeed);
      }
    }
    if (record.type === "videoTracks" && Array.isArray(item.keyframes) && item.keyframes.length) {
      const splitValues = sampleNovaCutVideoKeyframes(item, timestamp);
      const originalFrames = normalizeVideoKeyframes(item.keyframes, item.duration, item);
      first.keyframes = normalizeVideoKeyframes([
        ...originalFrames.filter((frame) => frame.timeMs < left - 1),
        { timeMs: left, ...splitValues }
      ], left, first);
      second.keyframes = normalizeVideoKeyframes([
        { timeMs: 0, ...splitValues },
        ...originalFrames.filter((frame) => frame.timeMs > left + 1).map((frame) => ({
          ...frame,
          timeMs: frame.timeMs - left
        }))
      ], right, second);
    }

    const index = tracks.findIndex((entry) => entry.id === item.id);
    if (index < 0) return { success: false, reason: "timeline-item-not-found" };
    tracks.splice(index, 1, first, second);
    this.activeTrackId = second.id;
    this.history.record(before, "Split");
    this.refresh();
    this.events.emit("split", {
      type: record.type,
      originalClipId: item.id,
      firstClip: first,
      secondClip: second,
      splitTimestamp: timestamp
    });
    return { success: true, firstClip: first, secondClip: second };
  }

  findTransitionPairNearPlayhead() {
    const clips = [...this.registry.videoTracks].sort((a, b) => a.startTime - b.startTime);
    if (clips.length < 2) return null;
    const toleranceMs = 80;
    const pairs = [];
    for (let index = 0; index < clips.length - 1; index += 1) {
      const left = clips[index];
      const right = clips[index + 1];
      const cutTime = Number(left.startTime) + Number(left.duration);
      const contiguous = Math.abs(cutTime - Number(right.startTime)) <= toleranceMs;
      const transition = right.transitionIn;
      const overlappingTransition = Boolean(
        transition?.type === "cross-dissolve" &&
        Math.abs(cutTime - (Number(right.startTime) + Number(transition.durationMs))) <= toleranceMs
      );
      if (contiguous || overlappingTransition) {
        pairs.push({ left, right, cutTime, distance: Math.abs(cutTime - this.currentTimestamp) });
      }
    }
    if (!pairs.length) return null;

    const selected = this.registry.getById(this.activeTrackId);
    if (selected?.type === "videoTracks") {
      const selectedIndex = clips.findIndex((clip) => clip.id === selected.item.id);
      const incomingTransition = pairs.find((pair) =>
        pair.right.id === selected.item.id && pair.right.transitionIn?.type === "cross-dissolve"
      );
      if (incomingTransition) return incomingTransition;
      const adjacent = pairs.filter((pair) =>
        pair.left.id === selected.item.id || pair.right.id === selected.item.id
      );
      if (adjacent.length) {
        adjacent.sort((a, b) => a.distance - b.distance);
        return adjacent[0];
      }
      // A selected clip with no adjacent cut should not silently affect a
      // distant edit elsewhere in the sequence.
      return null;
    }

    const nearest = pairs.sort((a, b) => a.distance - b.distance)[0];
    return nearest && nearest.distance <= 2000 ? nearest : null;
  }

  applyTransitionAtPlayhead(durationMs = 500, type = "fade-through-black") {
    if (!["fade-through-black", "cross-dissolve"].includes(type)) {
      this.setStatus("Choose a supported transition.");
      return { success: false, reason: "unsupported-transition" };
    }
    const pair = this.findTransitionPairNearPlayhead();
    if (!pair) {
      this.setStatus("Select a video clip beside a cut between two adjacent clips.");
      return { success: false, reason: "no-adjacent-video-cut" };
    }
    const previousTransition = pair.right.transitionIn;
    const originalRightStart = previousTransition ? Number(previousTransition.originalStartTime) : Number(pair.right.startTime);
    const maximum = Math.max(50, Math.min(Number(pair.left.duration) || 50, Number(pair.right.duration) || 50));
    const duration = clamp(durationMs, 50, maximum);
    const before = this.history.capture();

    if (previousTransition) {
      pair.right.startTime = Number.isFinite(originalRightStart) ? originalRightStart : pair.cutTime;
      for (const moved of previousTransition.rippledItems || []) {
        const track = this.registry[moved.trackType];
        const item = Array.isArray(track) ? track.find((candidate) => candidate.id === moved.id) : null;
        if (item && Math.abs(Number(item.startTime) - Number(moved.appliedStartTime)) <= 1) {
          item.startTime = Number(moved.originalStartTime);
        }
      }
      delete pair.right.transitionIn;
    }

    if (type === "cross-dissolve") {
      const cutTime = Number(pair.left.startTime) + Number(pair.left.duration);
      const rightOrigin = previousTransition && Number.isFinite(originalRightStart) ? originalRightStart : Number(pair.right.startTime);
      const rippleFrom = rightOrigin + Number(pair.right.duration);
      const rippledItems = [];
      for (const trackType of ["videoTracks", "textTracks", "overlayTracks", "effectTracks"]) {
        for (const item of this.registry[trackType] || []) {
          if (item.id === pair.left.id || item.id === pair.right.id) continue;
          const rippleThreshold = trackType === "videoTracks" ? rippleFrom : rightOrigin;
          if (Number(item.startTime) < rippleThreshold - 1) continue;
          const originalStartTime = Number(item.startTime) || 0;
          item.startTime = Math.max(0, originalStartTime - duration);
          rippledItems.push({ trackType, id: item.id, originalStartTime, appliedStartTime: item.startTime });
        }
      }
      pair.left.fadeOutMs = 0;
      pair.right.fadeInMs = duration;
      pair.right.startTime = Math.max(Number(pair.left.startTime) + 1, cutTime - duration);
      pair.right.transitionIn = { type: "cross-dissolve", durationMs: duration, originalStartTime: rightOrigin, rippledItems };
    } else {
      pair.left.fadeOutMs = duration;
      pair.right.fadeInMs = duration;
    }
    this.activeTrackId = pair.right.id;
    const label = type === "cross-dissolve" ? "Cross dissolve" : "Fade through black";
    this.history.record(before, label);
    this.refresh();
    this.setStatus(label + " · " + (duration / 1000).toFixed(2) + "s");
    return { success: true, leftClipId: pair.left.id, rightClipId: pair.right.id, durationMs: duration, type };
  }

  clearTransitionAtPlayhead() {
    const pair = this.findTransitionPairNearPlayhead();
    if (!pair) {
      this.setStatus("Select a video clip beside a cut between two adjacent clips.");
      return { success: false, reason: "no-adjacent-video-cut" };
    }
    if (!(Number(pair.left.fadeOutMs) > 0) && !(Number(pair.right.fadeInMs) > 0) && !pair.right.transitionIn) {
      this.setStatus("No transition exists at this cut.");
      return { success: false, reason: "no-transition-at-cut" };
    }
    const before = this.history.capture();
    if (pair.right.transitionIn) {
      const transition = pair.right.transitionIn;
      const originalStartTime = Number(transition.originalStartTime);
      pair.right.startTime = Number.isFinite(originalStartTime) ? originalStartTime : pair.cutTime;
      for (const moved of transition.rippledItems || []) {
        const track = this.registry[moved.trackType];
        const item = Array.isArray(track) ? track.find((candidate) => candidate.id === moved.id) : null;
        if (item && Math.abs(Number(item.startTime) - Number(moved.appliedStartTime)) <= 1) {
          item.startTime = Number(moved.originalStartTime);
        }
      }
      delete pair.right.transitionIn;
    }
    pair.left.fadeOutMs = 0;
    pair.right.fadeInMs = 0;
    this.history.record(before, "Remove transition");
    this.refresh();
    this.setStatus("Transition removed");
    return { success: true, leftClipId: pair.left.id, rightClipId: pair.right.id };
  }

  openTransitionEditor() {
    const pair = this.findTransitionPairNearPlayhead();
    if (!pair) {
      this.setStatus("Select a video clip next to a cut first.");
      return false;
    }
    const existingType = pair.right.transitionIn?.type || "fade-through-black";
    const existing = Math.max(Number(pair.right.transitionIn?.durationMs) || 0, Number(pair.left.fadeOutMs) || 0, Number(pair.right.fadeInMs) || 0);
    const defaultMs = existing || 500;
    const maximumSeconds = Math.max(0.05, Math.min(Number(pair.left.duration) || 50, Number(pair.right.duration) || 50) / 1000);
    const sheet = this.openSheet("Transition at cut");
    sheet.body.innerHTML =
      '<p class="nx-novacut__sheet-copy">Cross dissolve blends both clips over an overlap. Fade through black fades the outgoing clip down and incoming clip up through black.</p>' +
      '<div class="nx-novacut__form-grid">' +
        '<label>Transition type<select data-transition-type>' +
          '<option value="cross-dissolve"' + (existingType === "cross-dissolve" ? " selected" : "") + '>Cross dissolve</option>' +
          '<option value="fade-through-black"' + (existingType === "fade-through-black" ? " selected" : "") + '>Fade through black</option>' +
        '</select></label>' +
        '<label>Duration (seconds)<input data-transition-duration type="number" min="0.05" max="' + maximumSeconds.toFixed(2) + '" step="0.05" value="' + Math.min(defaultMs / 1000, maximumSeconds).toFixed(2) + '"></label>' +
      '</div>' +
      '<div class="nx-novacut__sheet-actions">' +
        '<button type="button" class="nx-novacut__secondary" data-transition-clear>Remove transition</button>' +
        '<button type="button" class="nx-novacut__primary" data-transition-apply>Apply transition</button>' +
      '</div>';
    sheet.body.querySelector("[data-transition-apply]")?.addEventListener("click", () => {
      const input = Number(sheet.body.querySelector("[data-transition-duration]")?.value);
      if (!Number.isFinite(input) || input < 0.05) {
        this.setStatus("Transition duration must be at least 0.05 seconds.");
        return;
      }
      const type = sheet.body.querySelector("[data-transition-type]")?.value || "fade-through-black";
      const result = this.applyTransitionAtPlayhead(input * 1000, type);
      if (result.success) this.closeSheet(sheet.root);
    });
    sheet.body.querySelector("[data-transition-clear]")?.addEventListener("click", () => {
      const result = this.clearTransitionAtPlayhead();
      if (result.success) this.closeSheet(sheet.root);
    });
    return true;
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
      ["blur","mosaic","scramble","censor","vignette"].map((type) =>
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
      '<button type="button" data-tool-action="transition">Transition at cut</button>' +
      '<button type="button" data-tool-action="keyframe-add">Set keyframe</button>' +
      '<button type="button" data-tool-action="keyframe-remove">Remove keyframe</button>' +
      '<button type="button" data-tool-action="clip-settings">Edit selected clip</button>' +
      '<button type="button" data-tool-action="fit-video">Fit video</button>' +
      '<button type="button" data-tool-action="fill-canvas">Fill canvas</button>' +
      '<button type="button" data-tool-action="zoom-in">Zoom in</button>' +
      '<button type="button" data-tool-action="zoom-out">Zoom out</button>' +
      '<button type="button" data-tool-action="reset-frame">Reset frame</button>' +
      '<button type="button" data-tool-action="preview-draft">Preview: Draft</button>' +
      '<button type="button" data-tool-action="preview-balanced">Preview: Balanced</button>' +
      '<button type="button" data-tool-action="preview-sharp">Preview: Sharp</button>' +
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
        else if (action === "transition") this.openTransitionEditor();
        else if (action === "keyframe-add") this.setSelectedKeyframeAtPlayhead();
        else if (action === "keyframe-remove") this.removeSelectedKeyframeAtPlayhead();
        else if (action === "clip-settings") this.openSelectedClipInspector();
        else if (action === "fit-video") this.setSelectedFitMode("fit");
        else if (action === "fill-canvas") this.setSelectedFitMode("fill");
        else if (action === "zoom-in") this.adjustSelectedVideoScale(1.12);
        else if (action === "zoom-out") this.adjustSelectedVideoScale(1 / 1.12);
        else if (action === "reset-frame") this.resetSelectedVideoFraming();
        else if (action === "preview-draft") this.setPreviewQuality("draft");
        else if (action === "preview-balanced") this.setPreviewQuality("balanced");
        else if (action === "preview-sharp") this.setPreviewQuality("sharp");
        else if (action === "duplicate") this.duplicateSelected();
        else if (action === "delete") this.removeSelected();
        else if (action === "rotate") this.rotateSelected();
        else if (action === "flip-x") this.flipSelected("x");
        else if (action === "flip-y") this.flipSelected("y");
      });
    });
  }

  openSelectedClipInspector() {
    const selected = this.registry.getById(this.activeTrackId);
    if (!selected?.item) {
      this.setStatus("Select a timeline clip first.");
      return false;
    }
    const { type, item } = selected;
    const titleByType = {
      videoTracks: "Video clip settings",
      audioTracks: "Audio clip settings",
      textTracks: "Text clip settings",
      overlayTracks: "Sticker settings",
      effectTracks: "Effect settings"
    };
    const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const seconds = (value) => (Math.max(0, finite(value)) / 1000).toFixed(2);
    const videoFrameValues = type === "videoTracks" ? sampleNovaCutVideoKeyframes(item, this.currentTimestamp) : null;
    const layerFrameValues = type === "overlayTracks"
      ? sampleNovaCutLayerKeyframes(item, this.currentTimestamp, "overlayTracks")
      : type === "textTracks" ? sampleNovaCutLayerKeyframes(item, this.currentTimestamp, "textTracks") : null;
    const input = (label, name, value, attrs = "") =>
      '<label>' + label + '<input data-clip-prop="' + name + '" type="number" value="' + value + '" ' + attrs + '></label>';
    let fields =
      input("Start (seconds)", "start", seconds(item.startTime), 'min="0" max="3600" step="0.05"') +
      input("Duration (seconds)", "duration", seconds(item.duration), 'min="0.03" max="3600" step="0.05"');

    if (type === "videoTracks") {
      const transform = item.transform || {};
      fields +=
        '<label>Frame mode<select data-clip-prop="fitMode"><option value="fit"' + (item.fitMode !== "fill" ? " selected" : "") + '>Fit</option><option value="fill"' + (item.fitMode === "fill" ? " selected" : "") + '>Fill canvas</option></select></label>' +
        input("Average speed (x)", "speed", finite(item.speed, 1), 'min="0.25" max="4" step="0.05"') +
        '<label>Speed curve<select data-clip-prop="speedCurvePreset">' +
          '<option value="none"' + ((!item.speedCurve?.length || item.speedCurvePreset === "none") ? " selected" : "") + '>Normal</option>' +
          '<option value="montage"' + (item.speedCurvePreset === "montage" ? " selected" : "") + '>Montage</option>' +
          '<option value="hero"' + (item.speedCurvePreset === "hero" ? " selected" : "") + '>Hero time</option>' +
          '<option value="bullet"' + (item.speedCurvePreset === "bullet" ? " selected" : "") + '>Bullet</option>' +
          '<option value="flash-in"' + (item.speedCurvePreset === "flash-in" ? " selected" : "") + '>Flash in</option>' +
          '<option value="flash-out"' + (item.speedCurvePreset === "flash-out" ? " selected" : "") + '>Flash out</option>' +
          '<option value="custom"' + (item.speedCurvePreset === "custom" ? " selected" : "") + '>Custom curve</option>' +
        '</select></label>' +
        input("Scale (%)", "scale", Math.round(Math.max(0.05, finite(transform.scale ?? item.scale, 1)) * 100), 'min="25" max="400" step="5"') +
        input("Position X (preview px)", "x", finite(item.x_offset), 'min="-2000" max="2000" step="1"') +
        input("Position Y (preview px)", "y", finite(item.y_offset), 'min="-2000" max="2000" step="1"') +
        input("Rotation (degrees)", "rotation", finite(videoFrameValues?.rotation ?? transform.rotation), 'min="-360" max="360" step="1"') +
        input("Opacity (%)", "opacity", Math.round(clamp(videoFrameValues?.opacity ?? item.opacity ?? 1, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Brightness (%)", "brightness", finite(item.brightness, 100), 'min="0" max="200" step="5"') +
        input("Contrast (%)", "contrast", finite(item.contrast, 100), 'min="0" max="200" step="5"') +
        input("Saturation (%)", "saturation", finite(item.saturation, 100), 'min="0" max="300" step="5"') +
        input("Fade in (seconds)", "fadeIn", seconds(item.fadeInMs), 'min="0" max="60" step="0.05"') +
        input("Fade out (seconds)", "fadeOut", seconds(item.fadeOutMs), 'min="0" max="60" step="0.05"') +
        input("Source audio volume (%)", "volume", Math.round(finite(item.volume, 1) * 100), 'min="0" max="400" step="5"');
    } else if (type === "audioTracks") {
      fields +=
        input("Audio volume (%)", "volume", Math.round(finite(item.volume, 1) * 100), 'min="0" max="400" step="5"') +
        input("Fade in (seconds)", "fadeIn", seconds(item.fadeInMs), 'min="0" max="60" step="0.05"') +
        input("Fade out (seconds)", "fadeOut", seconds(item.fadeOutMs), 'min="0" max="60" step="0.05"');
    } else if (type === "textTracks") {
      const style = item.style || {};
      fields += '<label>Text<textarea data-clip-prop="text" maxlength="240"></textarea></label>' +
        input("Opacity (%)", "opacity", Math.round(clamp(layerFrameValues?.opacity ?? item.opacity ?? 1, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Fade in (seconds)", "fadeIn", seconds(item.fadeInMs), 'min="0" max="60" step="0.05"') +
        input("Fade out (seconds)", "fadeOut", seconds(item.fadeOutMs), 'min="0" max="60" step="0.05"') +
        input("Font size", "fontSize", finite(style.fontSize, 48), 'min="8" max="180" step="1"') +
        input("Scale (%)", "scale", Math.round(clamp(layerFrameValues?.scale ?? 1, 0.1, 4) * 100), 'min="10" max="400" step="5"') +
        input("Position X (%)", "x", Math.round(clamp(layerFrameValues?.x ?? style.x ?? 0.5, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Position Y (%)", "y", Math.round(clamp(layerFrameValues?.y ?? style.y ?? 0.82, 0, 1) * 100), 'min="0" max="100" step="1"') +
        '<label>Text color<input data-clip-prop="color" type="color" value="' + (/^#[0-9a-f]{6}$/i.test(String(style.color || "")) ? style.color : "#ffffff") + '"></label>' +
        input("Rotation (degrees)", "rotation", finite(layerFrameValues?.rotation ?? style.rotation), 'min="-360" max="360" step="1"');
    } else if (type === "overlayTracks") {
      fields +=
        input("Position X (%)", "x", Math.round(clamp(layerFrameValues?.x ?? item.x ?? 0.5, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Position Y (%)", "y", Math.round(clamp(layerFrameValues?.y ?? item.y ?? 0.5, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Opacity (%)", "opacity", Math.round(clamp(layerFrameValues?.opacity ?? item.opacity ?? 1, 0, 1) * 100), 'min="0" max="100" step="1"') +
        input("Fade in (seconds)", "fadeIn", seconds(item.fadeInMs), 'min="0" max="60" step="0.05"') +
        input("Fade out (seconds)", "fadeOut", seconds(item.fadeOutMs), 'min="0" max="60" step="0.05"') +
        input("Width (%)", "width", Math.round(finite(item.width, 0.2) * 100), 'min="3" max="100" step="1"') +
        input("Height (%)", "height", Math.round(finite(item.height, 0.2) * 100), 'min="3" max="100" step="1"') +
        input("Scale (%)", "scale", Math.round(finite(layerFrameValues?.scale ?? item.scale, 1) * 100), 'min="10" max="400" step="5"') +
        input("Rotation (degrees)", "rotation", finite(layerFrameValues?.rotation ?? item.rotation), 'min="-360" max="360" step="1"');
    } else if (type === "effectTracks") {
      fields +=
        '<label>Effect<select data-clip-prop="effectType">' +
        ["blur", "mosaic", "scramble", "censor", "vignette"].map((name) => '<option value="' + name + '"' + (item.type === name ? " selected" : "") + '>' + name + '</option>').join("") +
        '</select></label>' +
        input("Position X (%)", "x", Math.round(finite(item.x, 0.25) * 100), 'min="0" max="94" step="1"') +
        input("Position Y (%)", "y", Math.round(finite(item.y, 0.25) * 100), 'min="0" max="94" step="1"') +
        input("Width (%)", "width", Math.round(finite(item.width, 0.5) * 100), 'min="6" max="100" step="1"') +
        input("Height (%)", "height", Math.round(finite(item.height, 0.5) * 100), 'min="6" max="100" step="1"') +
        input("Intensity", "intensity", finite(item.intensity, 12), 'min="1" max="64" step="1"');
    } else {
      this.setStatus("This selection cannot be edited here.");
      return false;
    }

    const sheet = this.openSheet(titleByType[type] || "Clip settings");
    const playheadLocalMs = clamp(this.currentTimestamp - Number(item.startTime || 0), 0, Math.max(1, Number(item.duration) || 1));
    const nearbyKeyframe = type === "videoTracks"
      ? normalizeVideoKeyframes(item.keyframes, item.duration, item).find((frame) => Math.abs(frame.timeMs - playheadLocalMs) <= 34)
      : null;
    const nearbyLayerOpacityKeyframe = ["textTracks", "overlayTracks"].includes(type)
      ? (item.keyframes || []).find((frame) => frame.opacity != null && Math.abs(Number(frame.timeMs) - playheadLocalMs) <= 34)
      : null;
    const keyframeEasing = nearbyKeyframe?.easing || nearbyLayerOpacityKeyframe?.easing || "linear";
    const keyframeControls = type === "videoTracks"
      ? '<div class="nx-novacut__keyframe-actions">' +
        '<label>Interpolation to next<select data-clip-prop="keyframeEasing">' +
          '<option value="linear"' + (keyframeEasing === "linear" ? " selected" : "") + '>Linear</option>' +
          '<option value="ease-in"' + (keyframeEasing === "ease-in" ? " selected" : "") + '>Ease in</option>' +
          '<option value="ease-out"' + (keyframeEasing === "ease-out" ? " selected" : "") + '>Ease out</option>' +
          '<option value="ease-in-out"' + (keyframeEasing === "ease-in-out" ? " selected" : "") + '>Ease in-out</option>' +
        '</select></label>' +
        '<span data-keyframe-count>Keyframes: ' + (Array.isArray(item.keyframes) ? item.keyframes.length : 0) + '</span>' +
        '<button type="button" class="nx-novacut__secondary" data-clip-keyframe-set>Set keyframe at playhead</button>' +
        '<button type="button" class="nx-novacut__secondary" data-clip-keyframe-remove>Remove keyframe here</button>' +
        '</div>'
      : ["textTracks", "overlayTracks"].includes(type)
        ? '<div class="nx-novacut__keyframe-actions">' +
          '<label>Layer interpolation<select data-clip-prop="keyframeEasing">' +
            '<option value="linear"' + (keyframeEasing === "linear" ? " selected" : "") + '>Linear</option>' +
            '<option value="ease-in"' + (keyframeEasing === "ease-in" ? " selected" : "") + '>Ease in</option>' +
            '<option value="ease-out"' + (keyframeEasing === "ease-out" ? " selected" : "") + '>Ease out</option>' +
            '<option value="ease-in-out"' + (keyframeEasing === "ease-in-out" ? " selected" : "") + '>Ease in-out</option>' +
          '</select></label>' +
          '<span data-layer-opacity-keyframe-count>Layer keyframes: ' + (item.keyframes || []).filter((frame) => frame.opacity != null).length + '</span>' +
          '<button type="button" class="nx-novacut__secondary" data-layer-opacity-keyframe-set>Set layer keyframe</button>' +
          '<button type="button" class="nx-novacut__secondary" data-layer-opacity-keyframe-remove>Remove layer keyframe here</button>' +
          '</div>'
        : '';
    const renderSpeedCurveRows = (points) => points.map((point, index) => {
      const endpoint = index === 0 || index === points.length - 1;
      const position = endpoint ? (index === 0 ? 0 : 100) : clamp(point.position, 0, 100);
      const speed = clamp(point.speed, 0.25, 4);
      return '<div class="nx-novacut__speed-curve-point" data-speed-curve-row>' +
        '<span class="nx-novacut__speed-curve-index">' + (index + 1) + '</span>' +
        '<label>Position %<input data-speed-curve-position type="number" value="' + position.toFixed(1) + '" min="' + (endpoint ? position : '0.1') + '" max="' + (endpoint ? position : '99.9') + '" step="0.1" ' + (endpoint ? 'readonly' : '') + '></label>' +
        '<label>Speed ×<input data-speed-curve-speed type="number" value="' + speed.toFixed(2) + '" min="0.25" max="4" step="0.05"></label>' +
        (endpoint ? '' : '<button type="button" class="nx-novacut__secondary" data-speed-curve-remove="' + index + '" aria-label="Remove curve point ' + (index + 1) + '">Remove</button>') +
        '</div>';
    }).join('');
    const renderSpeedCurveGraph = (points) => {
      const xAt = (position) => 36 + clamp(position, 0, 100) * 2.7;
      const yAt = (speed) => 96 - ((clamp(speed, 0.25, 4) - 0.25) / 3.75) * 84;
      const grid = [0.25, 1, 2, 3, 4].map((speed) => {
        const y = yAt(speed).toFixed(2);
        return '<line class="nx-novacut__speed-curve-grid" x1="36" y1="' + y + '" x2="306" y2="' + y + '"/>' +
          '<text class="nx-novacut__speed-curve-label" x="4" y="' + (Number(y) + 3.5).toFixed(2) + '">' + speed + '×</text>';
      }).join('');
      const line = points.map((point) => xAt(point.position).toFixed(2) + ',' + yAt(point.speed).toFixed(2)).join(' ');
      const handles = points.map((point, index) => {
        const cx = xAt(point.position).toFixed(2);
        const cy = yAt(point.speed).toFixed(2);
        const radius = (index === 0 || index === points.length - 1) ? '5.5' : '5';
        const label = 'Point ' + (index + 1) + ', ' + Number(point.position).toFixed(1) + ' percent, ' +
          clamp(point.speed, 0.25, 4).toFixed(2) + ' times speed';
        // Transparent hit target gives fingers a practical touch area without
        // making the visible graph handles oversized.
        return '<circle class="nx-novacut__speed-curve-hit-area" data-speed-curve-handle="' + index +
          '" cx="' + cx + '" cy="' + cy + '" r="12" fill="transparent" stroke="transparent" stroke-width="12" pointer-events="all" aria-label="' + label + '"/>' +
          '<circle class="nx-novacut__speed-curve-handle" cx="' + cx + '" cy="' + cy +
          '" r="' + radius + '" pointer-events="none"/>';
      }).join('');
      return '<svg class="nx-novacut__speed-curve-graph" data-speed-curve-graph viewBox="0 0 320 120" role="img" aria-label="Custom playback speed curve. Drag points vertically to change speed and horizontally to change timing.">' +
        '<rect class="nx-novacut__speed-curve-plot" x="31" y="7" width="280" height="94" rx="8"/>' +
        grid +
        '<polyline class="nx-novacut__speed-curve-line" points="' + line + '"/>' +
        handles +
        '</svg>';
    };
    const initialSpeedCurve = Array.isArray(item.speedCurve) && item.speedCurve.length > 1
      ? item.speedCurve
      : [{ timeMs: 0, speed: finite(item.speed, 1) }, { timeMs: item.duration, speed: finite(item.speed, 1) }];
    const speedCurveInitialPoints = initialSpeedCurve.map((point) => ({
      position: clamp((Number(point.timeMs) || 0) / Math.max(1, Number(item.duration) || 1) * 100, 0, 100),
      speed: clamp(point.speed, 0.25, 4)
    }));
    if (speedCurveInitialPoints.length > 1) {
      speedCurveInitialPoints[0].position = 0;
      speedCurveInitialPoints[speedCurveInitialPoints.length - 1].position = 100;
    }
    const speedCurveEditor = type === "videoTracks"
      ? '<section class="nx-novacut__speed-curve-editor" data-speed-curve-editor' + (item.speedCurvePreset === "custom" ? '' : ' hidden') + '>' +
        '<div class="nx-novacut__speed-curve-heading"><strong>Custom speed curve</strong><span>0.25×–4×</span></div>' +
        '<div class="nx-novacut__speed-curve-graph-host" data-speed-curve-graph-host>' + renderSpeedCurveGraph(speedCurveInitialPoints) + '</div>' +
        '<div class="nx-novacut__speed-curve-points" data-speed-curve-points>' + renderSpeedCurveRows(speedCurveInitialPoints) + '</div>' +
        '<button type="button" class="nx-novacut__secondary" data-speed-curve-add>Add curve point</button>' +
        '<p class="nx-novacut__sheet-copy">Set the speed at each point. Endpoints stay fixed; up to 10 points are supported.</p>' +
        '</section>'
      : '';
    const colorPresets = type === "videoTracks"
      ? '<div class="nx-novacut__color-presets" role="group" aria-label="Color presets">' +
        '<button type="button" data-color-preset="original">Original</button>' +
        '<button type="button" data-color-preset="vivid">Vivid</button>' +
        '<button type="button" data-color-preset="muted">Muted</button>' +
        '<button type="button" data-color-preset="dramatic">Dramatic</button>' +
        '<button type="button" data-color-preset="mono">Mono</button>' +
        '</div>'
      : '';
    sheet.body.innerHTML =
      '<div class="nx-novacut__form-grid">' + fields + '</div>' +
      speedCurveEditor +
      colorPresets +
      keyframeControls +
      '<p class="nx-novacut__sheet-copy">Apply transform and opacity values, then set a keyframe at the playhead. Two or more keyframes animate position, scale, rotation, and opacity.</p>' +
      '<div class="nx-novacut__sheet-actions"><button type="button" class="nx-novacut__secondary" data-sheet-close>Cancel</button><button type="button" class="nx-novacut__primary" data-apply-clip-settings>Apply changes</button></div>';
    const speedCurveSelect = sheet.body.querySelector('[data-clip-prop="speedCurvePreset"]');
    const speedCurveEditorRoot = sheet.body.querySelector('[data-speed-curve-editor]');
    const speedCurvePointsHost = sheet.body.querySelector('[data-speed-curve-points]');
    const speedCurveGraphHost = sheet.body.querySelector('[data-speed-curve-graph-host]');
    const readCustomSpeedCurveDraft = () => Array.from(speedCurvePointsHost?.querySelectorAll('[data-speed-curve-row]') || [])
      .map((row) => ({
        position: Number(row.querySelector('[data-speed-curve-position]')?.value),
        speed: Number(row.querySelector('[data-speed-curve-speed]')?.value)
      }));
    const renderCustomSpeedCurveGraph = (points = readCustomSpeedCurveDraft()) => {
      if (speedCurveGraphHost) speedCurveGraphHost.innerHTML = renderSpeedCurveGraph(points);
    };
    const renderCustomSpeedCurvePoints = (points) => {
      if (!speedCurvePointsHost) return;
      speedCurvePointsHost.innerHTML = renderSpeedCurveRows(points);
      renderCustomSpeedCurveGraph(points);
      speedCurvePointsHost.querySelectorAll('[data-speed-curve-remove]').forEach((button) => {
        button.addEventListener('click', () => {
          const draft = readCustomSpeedCurveDraft();
          const index = Number(button.dataset.speedCurveRemove);
          if (index <= 0 || index >= draft.length - 1 || draft.length <= 2) return;
          draft.splice(index, 1);
          renderCustomSpeedCurvePoints(draft);
        });
      });
    };
    let draggedSpeedCurvePoint = null;
    const updateSpeedCurveFromPointer = (event) => {
      if (draggedSpeedCurvePoint == null || !speedCurveGraphHost) return;
      const graph = speedCurveGraphHost.querySelector('[data-speed-curve-graph]');
      const rect = graph?.getBoundingClientRect();
      if (!rect || rect.width < 1 || rect.height < 1) return;
      const draft = readCustomSpeedCurveDraft();
      const index = draggedSpeedCurvePoint;
      if (index < 0 || index >= draft.length) return;
      const chartX = ((event.clientX - rect.left) / rect.width) * 320;
      const chartY = ((event.clientY - rect.top) / rect.height) * 120;
      const endpoint = index === 0 || index === draft.length - 1;
      const minimumPosition = index === 0 ? 0 : draft[index - 1].position + 0.1;
      const maximumPosition = index === draft.length - 1 ? 100 : draft[index + 1].position - 0.1;
      draft[index] = {
        position: endpoint ? (index === 0 ? 0 : 100) : clamp((chartX - 36) / 2.7, minimumPosition, maximumPosition),
        speed: clamp(0.25 + ((96 - chartY) / 84) * 3.75, 0.25, 4)
      };
      renderCustomSpeedCurvePoints(draft);
    };
    speedCurvePointsHost?.addEventListener('input', (event) => {
      if (event.target?.matches?.('[data-speed-curve-position], [data-speed-curve-speed]')) {
        renderCustomSpeedCurveGraph();
      }
    });
    speedCurveGraphHost?.addEventListener('pointerdown', (event) => {
      const handle = event.target?.closest?.('[data-speed-curve-handle]');
      if (!handle) return;
      event.preventDefault();
      draggedSpeedCurvePoint = Number(handle.dataset.speedCurveHandle);
      try { speedCurveGraphHost.setPointerCapture(event.pointerId); } catch (_) {}
    });
    speedCurveGraphHost?.addEventListener('pointermove', (event) => {
      if (draggedSpeedCurvePoint == null) return;
      event.preventDefault();
      updateSpeedCurveFromPointer(event);
    });
    const stopSpeedCurveDrag = (event) => {
      if (draggedSpeedCurvePoint == null) return;
      draggedSpeedCurvePoint = null;
      try {
        if (speedCurveGraphHost.hasPointerCapture(event.pointerId)) speedCurveGraphHost.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };
    speedCurveGraphHost?.addEventListener('pointerup', stopSpeedCurveDrag);
    speedCurveGraphHost?.addEventListener('pointercancel', stopSpeedCurveDrag);
    if (speedCurveSelect && speedCurveEditorRoot) {
      speedCurveSelect.addEventListener('change', () => {
        speedCurveEditorRoot.hidden = speedCurveSelect.value !== 'custom';
      });
      speedCurveEditorRoot.hidden = speedCurveSelect.value !== 'custom';
      speedCurveEditorRoot.querySelector('[data-speed-curve-add]')?.addEventListener('click', () => {
        const draft = readCustomSpeedCurveDraft().sort((a, b) => a.position - b.position);
        if (draft.length >= 10) {
          this.setStatus('A custom speed curve supports up to 10 points.');
          return;
        }
        let gapIndex = 0;
        let gapSize = -1;
        for (let index = 0; index < draft.length - 1; index += 1) {
          const gap = draft[index + 1].position - draft[index].position;
          if (gap > gapSize) { gapSize = gap; gapIndex = index; }
        }
        if (gapSize < 0.2) {
          this.setStatus('There is not enough space for another curve point.');
          return;
        }
        const left = draft[gapIndex];
        const right = draft[gapIndex + 1];
        draft.splice(gapIndex + 1, 0, {
          position: Math.round((left.position + right.position) * 5) / 10,
          speed: clamp((left.speed + right.speed) / 2, 0.25, 4)
        });
        renderCustomSpeedCurvePoints(draft);
      });
      renderCustomSpeedCurvePoints(readCustomSpeedCurveDraft());
    }
    const colorPresetValues = {
      original: { brightness: 100, contrast: 100, saturation: 100 },
      vivid: { brightness: 105, contrast: 115, saturation: 140 },
      muted: { brightness: 100, contrast: 95, saturation: 70 },
      dramatic: { brightness: 96, contrast: 140, saturation: 115 },
      mono: { brightness: 100, contrast: 110, saturation: 0 }
    };
    sheet.body.querySelector("[data-clip-keyframe-set]")?.addEventListener("click", () => {
      const value = (name, fallback) => {
        const parsed = Number(sheet.body.querySelector('[data-clip-prop="' + name + '"]')?.value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const transform = item.transform || {};
      this.setVideoKeyframeAtPlayhead({
        scale: clamp(value("scale", Number(transform.scale ?? item.scale) * 100) / 100, 0.05, 4),
        rotation: clamp(value("rotation", Number(transform.rotation) || 0), -360, 360),
        x_offset: clamp(value("x", Number(item.x_offset) || 0), -2000, 2000),
        y_offset: clamp(value("y", Number(item.y_offset) || 0), -2000, 2000),
        opacity: clamp(value("opacity", clamp(videoFrameValues?.opacity ?? item.opacity ?? 1, 0, 1) * 100) / 100, 0, 1),
        easing: sheet.body.querySelector('[data-clip-prop="keyframeEasing"]')?.value || "linear"
      });
      const count = sheet.body.querySelector("[data-keyframe-count]");
      if (count) count.textContent = "Keyframes: " + (item.keyframes?.length || 0);
    });
    sheet.body.querySelector("[data-clip-keyframe-remove]")?.addEventListener("click", () => {
      this.removeVideoKeyframeAtPlayhead();
      const count = sheet.body.querySelector("[data-keyframe-count]");
      if (count) count.textContent = "Keyframes: " + (item.keyframes?.length || 0);
    });
    sheet.body.querySelector("[data-layer-opacity-keyframe-set]")?.addEventListener("click", () => {
      const readLayerValue = (name, fallback) => {
        const parsed = Number(sheet.body.querySelector('[data-clip-prop="' + name + '"]')?.value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const opacity = clamp(readLayerValue("opacity", clamp(layerFrameValues?.opacity ?? item.opacity ?? 1, 0, 1) * 100) / 100, 0, 1);
      const layerValues = { opacity,
        easing: sheet.body.querySelector('[data-clip-prop="keyframeEasing"]')?.value || "linear"
      };
      if (["textTracks", "overlayTracks"].includes(type)) {
        const layerStyle = item.style || {};
        const defaultX = type === "textTracks" ? (layerStyle.x ?? 0.5) : (item.x ?? 0.5);
        const defaultY = type === "textTracks" ? (layerStyle.y ?? 0.82) : (item.y ?? 0.5);
        const defaultScale = type === "textTracks" ? 1 : (item.scale ?? 1);
        const defaultRotation = type === "textTracks" ? (layerStyle.rotation ?? 0) : (item.rotation ?? 0);
        layerValues.x = clamp(readLayerValue("x", (layerFrameValues?.x ?? defaultX) * 100) / 100, 0, 1);
        layerValues.y = clamp(readLayerValue("y", (layerFrameValues?.y ?? defaultY) * 100) / 100, 0, 1);
        layerValues.scale = clamp(readLayerValue("scale", (layerFrameValues?.scale ?? defaultScale) * 100) / 100, 0.1, 4);
        layerValues.rotation = clamp(readLayerValue("rotation", layerFrameValues?.rotation ?? defaultRotation), -360, 360);
      }
      this.setLayerOpacityKeyframeAtPlayhead(layerValues);
      const count = sheet.body.querySelector("[data-layer-opacity-keyframe-count]");
      if (count) count.textContent = "Opacity keyframes: " + (item.keyframes || []).filter((frame) => frame.opacity != null).length;
    });
    sheet.body.querySelector("[data-layer-opacity-keyframe-remove]")?.addEventListener("click", () => {
      this.removeLayerOpacityKeyframeAtPlayhead();
      const count = sheet.body.querySelector("[data-layer-opacity-keyframe-count]");
      if (count) count.textContent = "Opacity keyframes: " + (item.keyframes || []).filter((frame) => frame.opacity != null).length;
    });
    sheet.body.querySelectorAll("[data-color-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = colorPresetValues[button.dataset.colorPreset];
        if (!preset) return;
        Object.entries(preset).forEach(([name, value]) => {
          const control = sheet.body.querySelector('[data-clip-prop="' + name + '"]');
          if (control) control.value = String(value);
        });
        sheet.body.querySelectorAll("[data-color-preset]").forEach((other) => {
          other.classList.toggle("is-active", other === button);
        });
      });
    });
    const textInput = sheet.body.querySelector('[data-clip-prop="text"]');
    if (textInput) textInput.value = String(item.text || "");
    sheet.body.querySelector("[data-apply-clip-settings]")?.addEventListener("click", () => {
      const value = (name, fallback) => {
        const parsed = Number(sheet.body.querySelector('[data-clip-prop="' + name + '"]')?.value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const requestedSpeedCurve = type === "videoTracks" ? (speedCurveSelect?.value || "none") : "none";
      let customSpeedCurveDraft = [];
      if (type === "videoTracks" && requestedSpeedCurve === "custom") {
        customSpeedCurveDraft = readCustomSpeedCurveDraft().sort((a, b) => a.position - b.position);
        const validPoints = customSpeedCurveDraft.length >= 2 &&
          Math.abs(customSpeedCurveDraft[0].position) <= 0.01 &&
          Math.abs(customSpeedCurveDraft[customSpeedCurveDraft.length - 1].position - 100) <= 0.01 &&
          customSpeedCurveDraft.every((point, index) =>
            Number.isFinite(point.position) && Number.isFinite(point.speed) &&
            point.speed >= 0.25 && point.speed <= 4 &&
            (index === 0 || point.position - customSpeedCurveDraft[index - 1].position >= 0.1)
          );
        if (!validPoints) {
          this.setStatus('Custom speed curve needs 0% and 100% endpoints, unique positions, and speeds from 0.25× to 4×.');
          return;
        }
      }
      const before = this.history.capture();
      item.startTime = Math.round(clamp(value("start", finite(item.startTime) / 1000), 0, 3600) * 1000);
      const priorDuration = Math.max(1, finite(item.duration, 3000));
      const requestedDuration = Math.round(clamp(value("duration", priorDuration / 1000), 0.03, 3600) * 1000);
      if (type === "videoTracks") {
        const priorSpeed = clamp(item.speed ?? 1, 0.25, 4);
        const nextSpeed = clamp(value("speed", priorSpeed), 0.25, 4);
        const durationChanged = Math.abs(requestedDuration - priorDuration) > 1;
        const speedChanged = Math.abs(nextSpeed - priorSpeed) > 0.001;
        item.speed = nextSpeed;
        if (speedChanged && !durationChanged) {
          const sourceDuration = Math.max(1, Number(item.sourceDuration) || priorDuration * priorSpeed);
          item.duration = Math.max(30, Math.round(sourceDuration / nextSpeed));
        } else {
          item.duration = requestedDuration;
          item.sourceDuration = Math.max(1, item.duration * nextSpeed);
        }
        const scale = clamp(value("scale", 100) / 100, 0.25, 4);
        item.scale = scale;
        item.transform = { ...(item.transform || {}), scale, rotation: clamp(value("rotation", 0), -360, 360) };
        item.x_offset = clamp(value("x", finite(item.x_offset)), -2000, 2000);
        item.y_offset = clamp(value("y", finite(item.y_offset)), -2000, 2000);
        item.brightness = clamp(value("brightness", finite(item.brightness, 100)), 0, 200);
        item.contrast = clamp(value("contrast", finite(item.contrast, 100)), 0, 200);
        item.saturation = clamp(value("saturation", finite(item.saturation, 100)), 0, 300);
        item.opacity = clamp(value("opacity", finite(item.opacity, 1) * 100) / 100, 0, 1);
        item.fadeInMs = Math.min(item.duration, Math.round(clamp(value("fadeIn", finite(item.fadeInMs) / 1000), 0, 60) * 1000));
        item.fadeOutMs = Math.min(item.duration, Math.round(clamp(value("fadeOut", finite(item.fadeOutMs) / 1000), 0, 60) * 1000));
        item.volume = clamp(value("volume", 100) / 100, 0, 4);
        item.fitMode = sheet.body.querySelector('[data-clip-prop="fitMode"]')?.value === "fill" ? "fill" : "fit";
        if (requestedSpeedCurve === "none") {
          item.speedCurve = [];
          item.speedCurvePreset = "none";
        } else if (requestedSpeedCurve === "custom") {
          item.speedCurve = createNovaCutCustomSpeedCurve(customSpeedCurveDraft, item.duration, item.sourceDuration);
          item.speedCurvePreset = item.speedCurve.length > 1 ? "custom" : "none";
        } else if (["montage", "hero", "bullet", "flash-in", "flash-out"].includes(requestedSpeedCurve)) {
          item.speedCurve = createNovaCutSpeedCurvePreset(requestedSpeedCurve, item.duration, item.sourceDuration);
          item.speedCurvePreset = item.speedCurve.length ? requestedSpeedCurve : "none";
        }
      } else if (type === "audioTracks") {
        item.duration = requestedDuration;
        item.volume = clamp(value("volume", 100) / 100, 0, 4);
        item.fadeInMs = Math.min(item.duration, Math.round(clamp(value("fadeIn", finite(item.fadeInMs) / 1000), 0, 60) * 1000));
        item.fadeOutMs = Math.min(item.duration, Math.round(clamp(value("fadeOut", finite(item.fadeOutMs) / 1000), 0, 60) * 1000));
      } else if (type === "textTracks") {
        item.duration = requestedDuration;
        item.text = String(textInput?.value || "").slice(0, 240);
        item.opacity = clamp(value("opacity", finite(item.opacity, 1) * 100) / 100, 0, 1);
        item.fadeInMs = Math.min(item.duration, Math.round(clamp(value("fadeIn", finite(item.fadeInMs) / 1000), 0, 60) * 1000));
        item.fadeOutMs = Math.min(item.duration, Math.round(clamp(value("fadeOut", finite(item.fadeOutMs) / 1000), 0, 60) * 1000));
        item.style = {
          ...(item.style || {}),
          fontSize: clamp(value("fontSize", 48), 8, 180),
          x: clamp(value("x", 50) / 100, 0, 1),
          y: clamp(value("y", 82) / 100, 0, 1),
          color: sheet.body.querySelector('[data-clip-prop="color"]')?.value || "#ffffff",
          rotation: clamp(value("rotation", 0), -360, 360)
        };
      } else if (type === "overlayTracks") {
        item.duration = requestedDuration;
        item.opacity = clamp(value("opacity", finite(item.opacity, 1) * 100) / 100, 0, 1);
        item.fadeInMs = Math.min(item.duration, Math.round(clamp(value("fadeIn", finite(item.fadeInMs) / 1000), 0, 60) * 1000));
        item.fadeOutMs = Math.min(item.duration, Math.round(clamp(value("fadeOut", finite(item.fadeOutMs) / 1000), 0, 60) * 1000));
        item.width = clamp(value("width", 20) / 100, 0.03, 1);
        item.height = clamp(value("height", 20) / 100, 0.03, 1);
        item.scale = clamp(value("scale", 100) / 100, 0.1, 5);
        const halfWidth = clamp(item.width * item.scale / 2, 0.02, 0.48);
        const halfHeight = clamp(item.height * item.scale / 2, 0.02, 0.48);
        item.x = clamp(value("x", 50) / 100, halfWidth, 1 - halfWidth);
        item.y = clamp(value("y", 50) / 100, halfHeight, 1 - halfHeight);
        item.rotation = clamp(value("rotation", 0), -360, 360);
      } else if (type === "effectTracks") {
        item.duration = requestedDuration;
        item.width = clamp(value("width", 50) / 100, 0.06, 1);
        item.height = clamp(value("height", 50) / 100, 0.06, 1);
        item.x = clamp(value("x", 25) / 100, 0, Math.max(0, 1 - item.width));
        item.y = clamp(value("y", 25) / 100, 0, Math.max(0, 1 - item.height));
        item.intensity = clamp(value("intensity", 12), 1, 64);
        const nextType = sheet.body.querySelector('[data-clip-prop="effectType"]')?.value;
        if (["blur", "mosaic", "scramble", "censor", "vignette"].includes(nextType)) item.type = nextType;
      }
      this.history.record(before, "Edit " + type.replace("Tracks", "").replace(/s$/, ""));
      this.closeSheet(sheet.root);
      this.refresh();
      this.setStatus("Updated selected clip");
    });
    return true;
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
      const activeVideos = this.getActiveVideoClips().slice().sort((a, b) => b.startTime - a.startTime);
      if (activeVideos.length) return { type: "videoTracks", item: activeVideos[0] };
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
      } else if (record.type === "videoTracks") {
        record.item.x_offset = (Number(state.original.x_offset) || 0) + dx * (canvas.width || width);
        record.item.y_offset = (Number(state.original.y_offset) || 0) + dy * (canvas.height || height);
      }
      // Keep the canvas/native video layer in sync while the user is dragging,
      // not just after pointerup commits the history transaction.
      this.preview?.markDirty();
      event.preventDefault();
    }, { signal: this.abort.signal });

    const end = (event) => {
      const state = this.canvasPointerState;
      if (!state || state.pointerId !== event.pointerId) return;
      this.canvasPointerState = null;
      this.history.commit();
      this.refresh();
      canvas.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    canvas.addEventListener("pointerup", end, { signal: this.abort.signal });
    canvas.addEventListener("pointercancel", (event) => {
      if (!this.canvasPointerState) return;
      this.canvasPointerState = null;
      this.history.cancel();
      this.refresh();
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
    const x = width / 2;
    const y = height / 2;
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
    ctx.scale(style.flipX ? -1 : 1, style.flipY ? -1 : 1);
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
    ctx.scale(overlay.flipX ? -1 : 1, overlay.flipY ? -1 : 1);
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
    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
      this.projectSaveTimer = 0;
    }
    if (this.projectReady && !this.projectPersistenceDisabled) {
      try { await this.saveProjectDraft(); } catch (_) {}
    }
    this.abort?.abort();
    this.closeAllSheets();
    this.preview?.dispose();
    await this.runtime.terminate();
    this.events.clear();
  }
}

export { NovaCutCommandCompiler, NovaCutFFmpegRuntime };
export const createNovaCutEngine = (options = {}) => new NovaCutEngine(options);
