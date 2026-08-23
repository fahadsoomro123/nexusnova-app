const START = -130;
const SWEEP = 260;

function polar(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function createGauge({
  value = 0,
  min = 0,
  max = 1,
  unit = 'NVX/H',
  ratio: ratioOverride = null,
  displayValue = null,
  decimals = 4,
  ariaLabel = ''
} = {}) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : safeMin;
  const safeValue = Math.min(safeMax, Math.max(safeMin, numericValue));
  const computedRatio = (safeValue - safeMin) / (safeMax - safeMin);
  const ratio = Math.max(0, Math.min(1, Number.isFinite(Number(ratioOverride)) ? Number(ratioOverride) : computedRatio));
  const angle = START + ratio * SWEEP;
  const shown = displayValue == null
    ? safeValue.toFixed(Math.max(0, Math.min(6, Number(decimals) || 0)))
    : String(displayValue);
  const ticks = Array.from({ length: 21 }, (_, index) => {
    const tickAngle = START + (index / 20) * SWEEP;
    const major = index % 5 === 0;
    const a = polar(80, 80, major ? 49 : 51, tickAngle);
    const b = polar(80, 80, 56, tickAngle);
    return `<line class="nx-gauge__tick${major ? ' major' : ''}" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}"/>`;
  }).join('');

  return `<div class="nx-gauge" data-nx-gauge>
    <svg viewBox="0 0 160 126" role="img" aria-label="${ariaLabel || `${shown} ${unit}`}">
      <defs>
        <linearGradient id="nxGaugeGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#3b82f6"/><stop offset=".55" stop-color="#42d3ff"/><stop offset="1" stop-color="#27e2a4"/>
        </linearGradient>
      </defs>
      <path class="nx-gauge__track" d="${arcPath(80,80,58,START,START+SWEEP)}"/>
      <path class="nx-gauge__arc" d="${arcPath(80,80,58,START,angle)}"/>
      ${ticks}
      <g class="nx-gauge__needle" style="transform:rotate(${angle}deg)">
        <path d="M78.5 82 L80 30 L81.5 82 Z" fill="#42d3ff"/>
      </g>
      <circle class="nx-gauge__hub" cx="80" cy="80" r="5"/>
      <text class="nx-gauge__value" x="80" y="103">${shown}</text>
      <text class="nx-gauge__unit" x="80" y="114">${unit}</text>
    </svg>
  </div>`;
}
