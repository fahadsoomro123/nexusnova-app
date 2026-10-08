/*
 * NovaCut visual layer primitives.
 * Android-first visual model: normalized position, deterministic built-in stickers,
 * and canvas drawing shared by preview and export.
 */

export const STICKER_LIBRARY = Object.freeze([
  { id: "sparkle", name: "Sparkle", glyph: "✦", color: "#ffffff", background: "#5f86ff", shape: "circle", fontScale: 0.72 },
  { id: "star", name: "Star", glyph: "★", color: "#fff6b8", background: "#c48a2c", shape: "circle", fontScale: 0.66 },
  { id: "heart", name: "Heart", glyph: "♥", color: "#ffd7df", background: "#b83762", shape: "circle", fontScale: 0.7 },
  { id: "fire", name: "Fire", glyph: "🔥", color: "#ffffff", background: "#8c4224", shape: "circle", fontScale: 0.62 },
  { id: "bolt", name: "Bolt", glyph: "⚡", color: "#fff8a6", background: "#7059d8", shape: "circle", fontScale: 0.64 },
  { id: "check", name: "Check", glyph: "✓", color: "#d9fff2", background: "#208d69", shape: "circle", fontScale: 0.72 },
  { id: "wow", name: "WOW", glyph: "WOW", color: "#ffffff", background: "#cf5b45", shape: "pill", fontScale: 0.28 },
  { id: "new", name: "NEW", glyph: "NEW", color: "#ffffff", background: "#2a82c8", shape: "pill", fontScale: 0.28 },
  { id: "sale", name: "SALE", glyph: "SALE", color: "#fff7c2", background: "#b64d30", shape: "pill", fontScale: 0.26 },
  { id: "love", name: "Love", glyph: "LOVE", color: "#ffe9ef", background: "#8e3d67", shape: "pill", fontScale: 0.25 },
  { id: "100", name: "100", glyph: "100", color: "#fff", background: "#8b4651", shape: "pill", fontScale: 0.27 },
  { id: "cool", name: "Cool", glyph: "COOL", color: "#d9f4ff", background: "#326c83", shape: "pill", fontScale: 0.24 }
]);

export function getStickerById(id) {
  const key = String(id || "");
  return STICKER_LIBRARY.find((sticker) => sticker.id === key) || STICKER_LIBRARY[0];
}

export function clampUnit(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

export function normalizeSticker(input = {}) {
  const base = getStickerById(input.stickerId);
  return {
    id: String(input.id || ""),
    stickerId: base.id,
    name: String(input.name || base.name),
    startTime: Math.max(0, Number(input.startTime) || 0),
    duration: Math.max(1, Number(input.duration) || 1),
    x: clampUnit(input.x, 0.5),
    y: clampUnit(input.y, 0.5),
    scale: Math.max(0.2, Math.min(4, Number(input.scale) || 1)),
    rotation: Number.isFinite(Number(input.rotation)) ? Number(input.rotation) : 0,
    opacity: Math.max(0, Math.min(1, Number(input.opacity) || 1))
  };
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function stickerMetrics(sticker, ctx, width, height, dpr = 1) {
  const normalized = normalizeSticker(sticker);
  const library = getStickerById(normalized.stickerId);
  const baseSize = 116 * normalized.scale * dpr;
  const padding = baseSize * 0.20;
  const fontSize = Math.max(18 * dpr, baseSize * library.fontScale);
  ctx.save();
  ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
  const measured = ctx.measureText(library.glyph).width;
  ctx.restore();

  const boxWidth = library.shape === "pill"
    ? Math.max(baseSize * 1.1, measured + padding * 2.2)
    : baseSize;
  const boxHeight = library.shape === "pill" ? baseSize * 0.72 : baseSize;
  return {
    x: normalized.x * width,
    y: normalized.y * height,
    width: boxWidth,
    height: boxHeight,
    rotation: normalized.rotation,
    fontSize
  };
}

export function drawSticker(ctx, sticker, width, height, dpr = 1) {
  if (!ctx) return;
  const normalized = normalizeSticker(sticker);
  const library = getStickerById(normalized.stickerId);
  const metrics = stickerMetrics(normalized, ctx, width, height, dpr);

  ctx.save();
  ctx.globalAlpha = normalized.opacity;
  ctx.translate(metrics.x, metrics.y);
  ctx.rotate((normalized.rotation * Math.PI) / 180);

  const left = -metrics.width / 2;
  const top = -metrics.height / 2;
  const radius = metrics.height * 0.26;

  roundedRectPath(ctx, left, top, metrics.width, metrics.height, radius);
  ctx.fillStyle = library.background;
  ctx.fill();

  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.stroke();

  ctx.font = `900 ${metrics.fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = library.color;
  ctx.fillText(library.glyph, 0, 1 * dpr);
  ctx.restore();
}

export function visualPointFromClient(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / height))
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleDegrees(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}
