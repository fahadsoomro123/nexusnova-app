/* NovaCut preview-region effects: blur, mosaic, scramble and censor. */
export const NOVACUT_EFFECT_TYPES = Object.freeze([
  { id: 'blur', label: 'Blur' },
  { id: 'mosaic', label: 'Mosaic' },
  { id: 'scramble', label: 'Scramble' },
  { id: 'censor', label: 'Censor' }
]);
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
export function normalizeNovaCutEffect(input = {}) {
  return {
    id: String(input.id || ('effect-' + Date.now() + '-' + Math.random().toString(36).slice(2))),
    type: ['blur', 'mosaic', 'scramble', 'censor'].includes(input.type) ? input.type : 'blur',
    x: clamp(input.x == null ? 0.25 : input.x, 0, 0.94),
    y: clamp(input.y == null ? 0.25 : input.y, 0, 0.94),
    width: clamp(input.width == null ? 0.5 : input.width, 0.06, 1),
    height: clamp(input.height == null ? 0.5 : input.height, 0.06, 1),
    startTime: Math.max(0, Number(input.startTime) || 0),
    duration: Math.max(250, Number(input.duration) || 3000),
    intensity: clamp(input.intensity == null ? 12 : input.intensity, 1, 64),
    seed: Math.floor(Number(input.seed) || (Math.random() * 0x7fffffff)),
    color: String(input.color || '#000000'),
    opacity: clamp(input.opacity == null ? 0.96 : input.opacity, 0, 1)
  };
}
function rectOf(effect, width, height) {
  const w = Math.max(2, width * clamp(effect.width, 0.02, 1));
  const h = Math.max(2, height * clamp(effect.height, 0.02, 1));
  const x = Math.max(0, Math.min(width - w, width * clamp(effect.x, 0, 1)));
  const y = Math.max(0, Math.min(height - h, height * clamp(effect.y, 0, 1)));
  return { x, y, width: w, height: h };
}
function seeded(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) % 1000000) / 1000000; };
}
export function drawNovaCutEffect(ctx, source, effect, width, height) {
  if (!ctx || !source || !effect) return;
  const r = rectOf(effect, width, height);
  if (effect.type === 'censor') {
    ctx.save(); ctx.globalAlpha = clamp(effect.opacity, 0, 1); ctx.fillStyle = effect.color || '#000000'; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.restore(); return;
  }
  if (effect.type === 'blur') {
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.width, r.height); ctx.clip(); ctx.filter = 'blur(' + clamp(effect.intensity, 1, 48) + 'px)'; ctx.drawImage(source, 0, 0); ctx.restore(); return;
  }
  if (effect.type === 'mosaic') {
    const block = Math.max(2, Math.floor(clamp(effect.intensity, 2, 64)));
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.floor(r.width / block));
    small.height = Math.max(1, Math.floor(r.height / block));
    const sctx = small.getContext('2d');
    if (!sctx) return;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, small.width, small.height);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, small.width, small.height, r.x, r.y, r.width, r.height); ctx.restore(); return;
  }
  if (effect.type === 'scramble') {
    const tilesX = Math.max(2, Math.min(12, Math.floor(r.width / Math.max(8, effect.intensity))));
    const tilesY = Math.max(2, Math.min(12, Math.floor(r.height / Math.max(8, effect.intensity))));
    const tileW = r.width / tilesX; const tileH = r.height / tilesY;
    const cells = Array.from({ length: tilesX * tilesY }, (_, i) => i); const random = seeded(effect.seed);
    for (let i = cells.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.width, r.height); ctx.clip();
    for (let d = 0; d < cells.length; d += 1) {
      const s = cells[d];
      const dx = r.x + (d % tilesX) * tileW; const dy = r.y + Math.floor(d / tilesX) * tileH;
      const sx = r.x + (s % tilesX) * tileW; const sy = r.y + Math.floor(s / tilesX) * tileH;
      ctx.drawImage(source, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
    }
    ctx.restore();
  }
}