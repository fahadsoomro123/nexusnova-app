const NIS_DOWNLOAD_URL = 'https://speed.cloudflare.com/__down';
const NIS_UPLOAD_URL = 'https://speed.cloudflare.com/__up';
const NIS_RESULT_KEY = 'nexusnova_nova_internet_speed_v1';
const NIS_SCALE = Object.freeze([
  { value: 0, rotation: -94.0, label: '0', x: 171.0, y: 534.9 },
  { value: 1, rotation: -68.6, label: '1', x: 185.5, y: 388.5 },
  { value: 5, rotation: -44.1, label: '5', x: 255.4, y: 259.7 },
  { value: 10, rotation: -21.9, label: '10', x: 371.1, y: 191.5 },
  { value: 20, rotation: 0.2, label: '20', x: 501.2, y: 156.2 },
  { value: 50, rotation: 21.9, label: '50', x: 628.9, y: 191.5 },
  { value: 100, rotation: 43.5, label: '100', x: 737.4, y: 262.2 },
  { value: 250, rotation: 66.7, label: '250', x: 804.9, y: 380.9 },
  { value: 500, rotation: 92.7, label: '500', x: 821.7, y: 527.3 },
  { value: 1000, rotation: 117.4, label: '1G', x: 792.8, y: 663.6 }
]);

function nisNode(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body ${className}`.trim();
  root.innerHTML = html;
  return root;
}

function nisPoint(cx, cy, rx, ry, degrees) {
  const a = Number(degrees) * Math.PI / 180;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
}

function nisRotationForMbps(value) {
  const n = Math.max(0, Math.min(1000, Number(value) || 0));
  for (let i = 1; i < NIS_SCALE.length; i += 1) {
    const lo = NIS_SCALE[i - 1], hi = NIS_SCALE[i];
    if (n <= hi.value) {
      const span = hi.value - lo.value || 1;
      const t = (n - lo.value) / span;
      return lo.rotation + (hi.rotation - lo.rotation) * t;
    }
  }
  return NIS_SCALE[NIS_SCALE.length - 1].rotation;
}

function nisGaugeSvg() {
  const minorTicks = [];
  for (let i = 0; i <= 81; i += 1) {
    const angle = 188 + (162 / 81) * i;
    const major = i % 9 === 0;
    const [x1, y1] = nisPoint(500, 676, 421, 565, angle);
    const [x2, y2] = nisPoint(500, 676, major ? 382 : 394, major ? 512 : 532, angle);
    minorTicks.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${major ? 'nis-major-tick' : 'nis-minor-tick'}"/>`);
  }
  const labels = NIS_SCALE.map((item, index) => {
    const extra = index === 0 ? ' nis-label-zero' : index === NIS_SCALE.length - 1 ? ' nis-label-gig' : '';
    return `<text x="${item.x.toFixed(1)}" y="${item.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="nis-scale-label${extra}">${item.label}</text>`;
  }).join('');
  const dots = [];
  for (let row = 0; row < 8; row += 1) {
    const y = 642 + row * 14;
    const inset = row * 14;
    const count = 34 - row * 2;
    for (let col = 0; col < count; col += 1) {
      const x = 205 + inset + (590 - inset * 2) * (col / Math.max(1, count - 1));
      const opacity = (0.33 - row * 0.025).toFixed(3);
      dots.push(`<circle cx="${x.toFixed(1)}" cy="${y}" r="${row < 3 ? 2.2 : 1.8}" fill="#39cfff" opacity="${opacity}"/>`);
    }
  }
  return `<svg class="nxnis-gauge-svg" viewBox="65 35 870 720" preserveAspectRatio="none" role="img" aria-label="Nova Internet Speed live meter">
    <defs>
      <linearGradient id="nisOuterMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f8fdff"/><stop offset=".08" stop-color="#8ccfff"/>
        <stop offset=".23" stop-color="#13345d"/><stop offset=".48" stop-color="#05111f"/>
        <stop offset=".72" stop-color="#1f74bc"/><stop offset=".88" stop-color="#6bd8ff"/>
        <stop offset="1" stop-color="#2420ff"/>
      </linearGradient>
      <linearGradient id="nisArc" x1="0" y1=".1" x2="1" y2=".9">
        <stop offset="0" stop-color="#bfeaff"/><stop offset=".34" stop-color="#77c9ff"/>
        <stop offset=".68" stop-color="#2ae7ff"/><stop offset=".86" stop-color="#275aff"/>
        <stop offset="1" stop-color="#d628ff"/>
      </linearGradient>
      <linearGradient id="nisNeedle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#efffff"/><stop offset=".52" stop-color="#65eeff"/><stop offset="1" stop-color="#0aa9ff"/>
      </linearGradient>
      <radialGradient id="nisFace" cx="50%" cy="40%" r="70%">
        <stop offset="0" stop-color="#0c2c50"/><stop offset=".36" stop-color="#071c35"/>
        <stop offset=".72" stop-color="#03111f"/><stop offset="1" stop-color="#010812"/>
      </radialGradient>
      <linearGradient id="nisGlass" x1="0" y1="0" x2=".9" y2=".9">
        <stop offset="0" stop-color="#fff" stop-opacity=".42"/>
        <stop offset=".24" stop-color="#bde9ff" stop-opacity=".13"/>
        <stop offset=".57" stop-color="#fff" stop-opacity=".015"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="nisFloor" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#09b7ff" stop-opacity=".62"/>
        <stop offset=".55" stop-color="#24dcff" stop-opacity=".28"/>
        <stop offset="1" stop-color="#c327ff" stop-opacity=".62"/>
      </linearGradient>
      <filter id="nisGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="11" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="nisNeedleGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <clipPath id="nisFaceClip"><path d="M89 709C74 331 219 93 500 61C781 93 926 331 911 709Q904 738 866 746H134Q96 738 89 709Z"/></clipPath>
    </defs>
    <path d="M70 712C52 311 209 70 500 40C791 70 948 311 930 712Q923 753 873 764H127Q77 753 70 712Z" fill="#020711" stroke="#07111f" stroke-width="22"/>
    <path d="M77 710C61 323 214 81 500 51C786 81 939 323 923 710Q916 746 870 756H130Q84 746 77 710Z" fill="#061220" stroke="url(#nisOuterMetal)" stroke-width="18"/>
    <path d="M89 709C74 331 219 93 500 61C781 93 926 331 911 709Q904 738 866 746H134Q96 738 89 709Z" fill="url(#nisFace)" stroke="#1c6097" stroke-width="8"/>
    <path d="M101 704C88 344 225 111 500 80C775 111 912 344 899 704Q892 725 859 732H141Q108 725 101 704Z" fill="none" stroke="url(#nisArc)" stroke-width="9" opacity=".95" filter="url(#nisGlow)"/>
    <path d="M109 702C96 352 229 123 500 91C771 123 904 352 891 702" fill="none" stroke="#a8e9ff" stroke-width="2.4" opacity=".58"/>
    <g clip-path="url(#nisFaceClip)">${minorTicks.join('')}</g>
    <g>${labels}</g>
    <g clip-path="url(#nisFaceClip)" opacity=".96">${dots.join('')}
      ${[170,220,270,320,370,420,580,630,680,730,780,830].map(x=>`<path d="M500 610 Q${((500+x)/2).toFixed(1)} 655 ${x} 729" fill="none" stroke="#2dcfff" stroke-width="1.6" opacity=".16"/>`).join('')}
      <path d="M159 715Q500 596 841 715" fill="none" stroke="url(#nisFloor)" stroke-width="5" filter="url(#nisGlow)"/>
      <path d="M205 686Q500 615 795 686" fill="none" stroke="#4adfff" stroke-width="2" opacity=".28"/>
      <path d="M132 739Q500 758 868 739" fill="none" stroke="url(#nisArc)" stroke-width="9" opacity=".62" filter="url(#nisGlow)"/>
    </g>
    <path d="M220 116C318 67 455 48 620 64" fill="none" stroke="#e9fbff" stroke-width="24" stroke-linecap="round" opacity=".62" filter="url(#nisGlow)"/>
    <path d="M226 115C323 74 457 58 612 70" fill="none" stroke="#c8eaff" stroke-width="9" stroke-linecap="round" opacity=".86"/>
    <path d="M145 170Q319 51 536 76Q702 93 807 213Q619 143 487 219Q309 146 145 170Z" fill="url(#nisGlass)" opacity=".72"/>
    <g data-nis-needle transform="rotate(-94 500 512)" filter="url(#nisNeedleGlow)">
      <polygon points="493,518 496,231 500,198 504,231 507,518" fill="url(#nisNeedle)" stroke="#dfffff" stroke-width="3"/>
      <circle cx="500" cy="512" r="14" fill="#0b2338" stroke="#69eaff" stroke-width="5"/>
      <circle cx="500" cy="512" r="5" fill="#eaffff"/>
    </g>
    <ellipse cx="500" cy="512" rx="132" ry="74" fill="#06182a" opacity=".94"/>
    <ellipse cx="500" cy="512" rx="132" ry="74" fill="none" stroke="#12324d" stroke-width="2" opacity=".32"/>
    <g class="nxnis-readout-svg">
      <text x="500" y="386" text-anchor="middle" class="nis-mode-label">↓ DOWNLOAD</text>
      <text x="500" y="535" text-anchor="middle" class="nis-main-value" data-nis-svg-value>0.0</text>
      <text x="500" y="583" text-anchor="middle" class="nis-unit-label">Mbps</text>
    </g>
  </svg>`;
}

function nisIcon(kind) {
  if (kind === 'download') return '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 11.5 12 16l4.5-4.5M5 20h14"/></svg>';
  if (kind === 'upload') return '<svg viewBox="0 0 24 24"><path d="M12 20V9m-4.5 3.5L12 8l4.5 4.5M5 4h14"/></svg>';
  if (kind === 'ping') return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 14c2.2 0 2.2-4 4.4-4s2.2 7 4.4 7 2.2-10 4.4-10S19.4 13 21 13"/></svg>';
}

function nisSparkline(color, id) {
  return `<svg class="nxnis-spark" viewBox="0 0 120 42" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path data-nis-area fill="url(#${id})" d="M0 42L120 42Z"></path>
    <path data-nis-line fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M0 34L120 34"></path>
  </svg>`;
}

const nisStyles = `
.nxnis-screen>.nx-app-head{display:none!important}
.nxnis-root{display:block!important;width:100%!important;max-width:none!important;overflow-x:clip;color:#f7fbff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.nxnis-root *{box-sizing:border-box}.nxnis-root button{font-family:inherit}
.nxnis-shell{width:100%;margin-top:-15px;padding:4px 0 24px;background:radial-gradient(circle at 50% 28%,rgba(11,87,151,.13),transparent 34%),linear-gradient(180deg,rgba(4,15,28,.28),rgba(1,8,15,.1))}
.nxnis-head{display:grid;grid-template-columns:36px 36px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:54px;padding:2px 0 11px;border-bottom:1px solid rgba(89,167,223,.09)}
.nxnis-back,.nxnis-head-icon{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(87,171,230,.14);border-radius:13px;background:linear-gradient(145deg,rgba(7,25,43,.98),rgba(4,16,29,.98));box-shadow:inset 0 1px rgba(255,255,255,.025),0 8px 20px rgba(0,0,0,.15)}
.nxnis-back{padding:0;color:#e5f4ff;font-size:28px;line-height:1;cursor:pointer}.nxnis-back span{transform:translateY(-1px)}
.nxnis-head-icon{color:#46d2ff;background:radial-gradient(circle at 50% 48%,rgba(27,157,230,.16),transparent 62%),linear-gradient(145deg,#08243c,#041423)}
.nxnis-head-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.nxnis-title{min-width:0}.nxnis-title h2{margin:0;font-size:17px;line-height:1.02;letter-spacing:-.035em;white-space:nowrap}.nxnis-title p{margin:5px 0 0;color:#7f94aa;font-size:10px;font-weight:620;white-space:nowrap}
.nxnis-sample{width:96px;height:24px;padding:0;border:1px solid rgba(49,141,196,.18);border-radius:11px;background:#041421;color:#4dc9f2;font-size:6.4px;font-weight:900;letter-spacing:.09em;white-space:nowrap}
.nxnis-network{padding:15px 0 3px}.nxnis-network b{display:block;color:#8ca6c1;font-size:8px;letter-spacing:.16em}.nxnis-network span{display:flex;align-items:center;gap:6px;margin-top:5px;color:#8499ae;font-size:9px}.nxnis-network i{width:7px;height:7px;border-radius:50%;background:#2eea63;box-shadow:0 0 9px rgba(46,234,99,.7)}
.nxnis-network.is-offline i{background:#ff5d73;box-shadow:0 0 9px rgba(255,93,115,.55)}
.nxnis-meter{position:relative;width:100%;aspect-ratio:1000/790;margin:-26px auto 0}
.nxnis-gauge-svg{display:block;width:100%;height:100%;filter:drop-shadow(0 16px 26px rgba(0,0,0,.38))}
.nis-minor-tick{stroke:#4385af;stroke-width:2;opacity:.52}.nis-major-tick{stroke:#7bcfff;stroke-width:4;opacity:.82}.nis-scale-label{fill:#edf8ff;font-size:31px;font-weight:790;paint-order:stroke;stroke:#061221;stroke-width:5}.nis-label-zero,.nis-label-gig{font-size:29px}.nis-mode-label{fill:#6bdcff;font-size:19px;font-weight:860;letter-spacing:.14em}.nis-main-value{fill:#fbfdff;font-size:128px;font-weight:340;letter-spacing:-.04em;paint-order:stroke;stroke:#07121f;stroke-width:2}.nis-unit-label{fill:#93a7bb;font-size:25px;font-weight:760;letter-spacing:.02em}
.nxnis-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:24px}
.nxnis-card{position:relative;overflow:hidden;min-width:0;height:58px;padding:9px 9px 8px 42px;border:1px solid rgba(78,157,210,.15);border-radius:12px;background:radial-gradient(circle at 100% 100%,rgba(22,89,136,.10),transparent 45%),linear-gradient(145deg,rgba(7,25,42,.98),rgba(3,13,24,.99));box-shadow:inset 0 1px rgba(255,255,255,.022),0 8px 18px rgba(0,0,0,.12)}
.nxnis-card-icon{position:absolute;left:10px;top:10px;width:23px;height:23px;display:grid;place-items:center;border:1px solid currentColor;border-radius:50%;opacity:.95}.nxnis-card-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.nxnis-card--download{color:#2f9cff}.nxnis-card--upload{color:#31dc74}.nxnis-card--ping{color:#b02eff}.nxnis-card--jitter{color:#e8bd2f}
.nxnis-card label{display:block;color:#8ba2b9;font-size:7.2px;font-weight:900;letter-spacing:.13em}.nxnis-card strong{position:relative;z-index:2;display:block;margin-top:5px;color:#f7fbff;font-size:15px;line-height:1;white-space:nowrap}.nxnis-card strong small{color:#93a6ba;font-size:8px;font-weight:750}.nxnis-spark{position:absolute;right:7px;bottom:7px;width:74px;height:27px;opacity:.78}
.nxnis-action{position:relative;width:100%;height:40px;margin-top:10px;border:1px solid #1776b1;border-radius:22px;background:radial-gradient(circle at 25% 0,rgba(27,133,207,.24),transparent 35%),linear-gradient(180deg,#08243b,#051728);color:#f6fbff;font-size:9px;font-weight:900;letter-spacing:.14em;cursor:pointer;box-shadow:inset 0 1px rgba(170,230,255,.16),0 0 24px rgba(0,129,211,.08)}.nxnis-action:disabled{opacity:.65;cursor:default}.nxnis-action span{display:block}.nxnis-action i{position:absolute;right:8px;top:50%;width:30px;height:30px;display:grid;place-items:center;transform:translateY(-50%);border-radius:50%;background:rgba(28,93,135,.45);font-style:normal;font-size:22px;line-height:1}
.nxnis-meta{display:grid;grid-template-columns:1fr 1px 1fr;gap:14px;align-items:center;min-height:48px;padding:9px 7px 0;color:#6f8499;font-size:7.5px}.nxnis-meta>i{width:1px;height:27px;background:rgba(115,172,210,.13)}.nxnis-meta div{display:flex;align-items:center;gap:7px;min-width:0}.nxnis-meta svg{flex:0 0 18px;width:18px;height:18px;fill:none;stroke:#6f8da8;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.nxnis-meta span{min-width:0;line-height:1.35}.nxnis-meta b{color:#8ba3ba;font-weight:800}
.nxnis-status{display:none!important}
@media(max-width:360px){.nxnis-head{grid-template-columns:34px 34px minmax(0,1fr) 84px;gap:7px}.nxnis-back,.nxnis-head-icon{width:34px;height:34px}.nxnis-title h2{font-size:13px}.nxnis-title p{font-size:8px}.nxnis-sample{width:84px;height:26px;padding:0;font-size:5.5px;letter-spacing:.07em}.nxnis-network{padding-top:12px}.nxnis-metrics{gap:7px}.nxnis-card{height:55px;padding-left:39px}.nxnis-card-icon{left:8px}.nxnis-card strong{font-size:13px}.nxnis-spark{width:62px}.nxnis-action{height:42px;margin-top:13px}.nxnis-meta{gap:9px;padding-inline:4px}}
@media(max-width:330px){.nxnis-title h2{font-size:11.5px}.nxnis-title p{font-size:7.2px}}
@media(min-width:600px){.nxnis-shell{max-width:520px;margin:0 auto}.nxnis-title h2{font-size:22px}}
`;

function nisFormatMbps(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(n >= 100 ? 1 : n >= 10 ? 1 : 2) : '—';
}
function nisFormatMs(value, decimals = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : '—';
}
function nisAverage(values) {
  const list = values.filter(Number.isFinite);
  return list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : NaN;
}
function nisJitter(values) {
  if (values.length < 2) return NaN;
  const diffs = [];
  for (let i = 1; i < values.length; i += 1) diffs.push(Math.abs(values[i] - values[i - 1]));
  return nisAverage(diffs);
}
function nisClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function renderNovaInternetSpeed() {
  const root = nisNode(`<style>${nisStyles}</style>
    <section class="nxnis-shell">
      <header class="nxnis-head">
        <button class="nxnis-back" type="button" data-nis-back aria-label="Back to Nova Hub"><span>‹</span></button>
        <span class="nxnis-head-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M6.5 14.5h1M16.5 14.5h1M8 9.2l.8.7M16 9.2l-.8.7M12 7v1"/><path d="m12 17 4.2-6.2"/><circle cx="12" cy="17" r="1.4"/></svg></span>
        <div class="nxnis-title"><h2>Nova Internet Speed</h2><p>Network speed instrument</p></div>
        <button class="nxnis-sample" type="button" tabindex="-1" aria-hidden="true">METER SAMPLE B</button>
      </header>
      <div class="nxnis-network" data-nis-network><b>NEXUSNOVA NETWORK</b><span><i></i><em data-nis-connection>Optimal Connection</em></span></div>
      <div class="nxnis-meter">${nisGaugeSvg()}</div>
      <section class="nxnis-metrics" aria-label="Internet speed metrics">
        <article class="nxnis-card nxnis-card--download"><span class="nxnis-card-icon">${nisIcon('download')}</span><label>DOWNLOAD</label><strong><span data-nis-download>—</span> <small>Mbps</small></strong>${nisSparkline('#2f9cff','nisDownFill')}</article>
        <article class="nxnis-card nxnis-card--upload"><span class="nxnis-card-icon">${nisIcon('upload')}</span><label>UPLOAD</label><strong><span data-nis-upload>—</span> <small>Mbps</small></strong>${nisSparkline('#31dc74','nisUpFill')}</article>
        <article class="nxnis-card nxnis-card--ping"><span class="nxnis-card-icon">${nisIcon('ping')}</span><label>PING</label><strong><span data-nis-ping>—</span> <small>ms</small></strong>${nisSparkline('#b02eff','nisPingFill')}</article>
        <article class="nxnis-card nxnis-card--jitter"><span class="nxnis-card-icon">${nisIcon('jitter')}</span><label>JITTER</label><strong><span data-nis-jitter>—</span> <small>ms</small></strong>${nisSparkline('#e8bd2f','nisJitterFill')}</article>
      </section>
      <button class="nxnis-action" type="button" data-nis-run><span>RUN TEST</span><i>›</i></button>
      <section class="nxnis-meta">
        <div><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="6" rx="1.5"/><rect x="5" y="15" width="14" height="6" rx="1.5"/><path d="M8 6h.01M8 18h.01M11 12h2"/></svg><span><b>NexusNova Server</b><br>Cloudflare Edge • Auto Select</span></div>
        <i></i>
        <div><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg><span><b>Connection</b><br><span data-nis-live>Live</span></span></div>
      </section>
      <p class="nxnis-status" data-nis-status>Ready for a live Cloudflare Edge throughput test.</p>
    </section>`, 'nxnis-root');

  let screen = null;
  let running = false;
  const controllers = new Set();
  const history = { download: [], upload: [], ping: [], jitter: [] };
  const back = root.querySelector('[data-nis-back]');
  const run = root.querySelector('[data-nis-run]');
  const runLabel = run.querySelector('span');
  const network = root.querySelector('[data-nis-network]');
  const connection = root.querySelector('[data-nis-connection]');
  const live = root.querySelector('[data-nis-live]');
  const status = root.querySelector('[data-nis-status]');
  const needle = root.querySelector('[data-nis-needle]');
  const svgValue = root.querySelector('[data-nis-svg-value]');
  const modeLabel = root.querySelector('.nis-mode-label');
  const downEl = root.querySelector('[data-nis-download]');
  const upEl = root.querySelector('[data-nis-upload]');
  const pingEl = root.querySelector('[data-nis-ping]');
  const jitterEl = root.querySelector('[data-nis-jitter]');

  queueMicrotask(() => { screen = root.closest('.nx-screen'); screen?.classList.add('nxnis-screen'); });

  const updateOnline = () => {
    const online = navigator.onLine !== false;
    network.classList.toggle('is-offline', !online);
    connection.textContent = online ? 'Optimal Connection' : 'Offline';
    live.textContent = online ? 'Live' : 'Offline';
  };

  const paintMeter = (mbps, mode = 'DOWNLOAD') => {
    const n = Math.max(0, Number(mbps) || 0);
    const rotation = nisRotationForMbps(n);
    needle?.setAttribute('transform', `rotate(${rotation.toFixed(2)} 500 512)`);
    svgValue.textContent = nisFormatMbps(n);
    modeLabel.textContent = `${mode === 'UPLOAD' ? '↑' : '↓'} ${mode}`;
  };

  const paintSpark = (card, values) => {
    const line = card?.querySelector('[data-nis-line]');
    const area = card?.querySelector('[data-nis-area]');
    if (!line || !area) return;
    const list = values.filter(Number.isFinite).slice(-18);
    if (!list.length) { line.setAttribute('d', 'M0 34L120 34'); area.setAttribute('d', 'M0 42L120 42Z'); return; }
    const min = Math.min(...list), max = Math.max(...list), span = Math.max(0.001, max - min);
    const points = list.map((v, i) => {
      const x = list.length === 1 ? 120 : (i / (list.length - 1)) * 120;
      const y = 35 - ((v - min) / span) * 25;
      return [x, y];
    });
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    line.setAttribute('d', d);
    area.setAttribute('d', `${d}L120 42L0 42Z`);
  };

  const pushMetric = (key, value) => {
    if (Number.isFinite(value)) history[key].push(value);
    paintSpark(root.querySelector(`.nxnis-card--${key}`), history[key]);
  };

  const fetchTimed = async (url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.arrayBuffer();
      return { ms: performance.now() - started, bytes: body.byteLength };
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  };

  const measurePing = async () => {
    const samples = [];
    for (let i = 0; i < 6; i += 1) {
      status.textContent = `Measuring latency ${i + 1}/6…`;
      const sample = await fetchTimed(`${NIS_DOWNLOAD_URL}?bytes=64&nonce=${Date.now()}-${i}`, {}, 8000);
      samples.push(sample.ms);
      pingEl.textContent = nisFormatMs(nisAverage(samples), 0);
      pushMetric('ping', sample.ms);
      if (samples.length > 1) pushMetric('jitter', Math.abs(samples.at(-1) - samples.at(-2)));
    }
    return { ping: nisAverage(samples), jitter: nisJitter(samples) };
  };

  const transferDownload = async totalBytes => {
    const parts = 4;
    const each = Math.max(65536, Math.floor(totalBytes / parts));
    const started = performance.now();
    const jobs = Array.from({ length: parts }, (_, i) =>
      fetchTimed(`${NIS_DOWNLOAD_URL}?bytes=${each}&nonce=${Date.now()}-${i}`, {}, 18000)
    );
    const results = await Promise.all(jobs);
    const elapsed = (performance.now() - started) / 1000;
    const bytes = results.reduce((sum, row) => sum + row.bytes, 0);
    return bytes * 8 / elapsed / 1_000_000;
  };

  const measureDownload = async () => {
    status.textContent = 'Warming up download path…';
    const warm = await transferDownload(800_000);
    paintMeter(warm, 'DOWNLOAD'); downEl.textContent = nisFormatMbps(warm); pushMetric('download', warm);
    const target = Math.round(nisClamp((warm * 1_000_000 / 8) * 2.2, 2_000_000, 24_000_000));
    status.textContent = 'Measuring download throughput…';
    const measured = await transferDownload(target);
    paintMeter(measured, 'DOWNLOAD'); downEl.textContent = nisFormatMbps(measured); pushMetric('download', measured);
    downEl.textContent = nisFormatMbps(measured);
    return measured;
  };

  const uploadOnce = async totalBytes => {
    const parts = 3;
    const each = Math.max(65536, Math.floor(totalBytes / parts));
    const payload = new Uint8Array(each);
    const started = performance.now();
    const jobs = Array.from({ length: parts }, (_, i) =>
      fetchTimed(`${NIS_UPLOAD_URL}?nonce=${Date.now()}-${i}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: payload }, 18000)
    );
    await Promise.all(jobs);
    const elapsed = (performance.now() - started) / 1000;
    return (each * parts) * 8 / elapsed / 1_000_000;
  };

  const measureUpload = async downloadMbps => {
    status.textContent = 'Measuring upload throughput…';
    const firstBytes = Math.round(nisClamp((Math.max(5, downloadMbps * .45) * 1_000_000 / 8) * 1.6, 800_000, 6_000_000));
    const first = await uploadOnce(firstBytes);
    paintMeter(first, 'UPLOAD'); upEl.textContent = nisFormatMbps(first); pushMetric('upload', first);
    let measured = first;
    if (first > 60 && firstBytes < 6_000_000) {
      measured = await uploadOnce(6_000_000);
      paintMeter(measured, 'UPLOAD'); upEl.textContent = nisFormatMbps(measured); pushMetric('upload', measured);
    }
    upEl.textContent = nisFormatMbps(measured);
    return measured;
  };

  const applyResult = result => {
    if (!result) return;
    downEl.textContent = nisFormatMbps(result.download);
    upEl.textContent = nisFormatMbps(result.upload);
    pingEl.textContent = nisFormatMs(result.ping, 0);
    jitterEl.textContent = nisFormatMs(result.jitter, 1);
    paintMeter(result.download, 'DOWNLOAD');
    pushMetric('download', Number(result.download));
    pushMetric('upload', Number(result.upload));
    pushMetric('ping', Number(result.ping));
    pushMetric('jitter', Number(result.jitter));
    runLabel.textContent = 'RUN AGAIN';
  };

  const loadPrevious = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(NIS_RESULT_KEY) || 'null');
      if (saved && Number.isFinite(saved.download) && Number.isFinite(saved.upload)) applyResult(saved);
    } catch {}
  };

  const runTest = async () => {
    if (running) return;
    if (navigator.onLine === false) { status.textContent = 'Internet connection is offline.'; return; }
    running = true; run.disabled = true; runLabel.textContent = 'TESTING…';
    history.download.length = history.upload.length = history.ping.length = history.jitter.length = 0;
    try {
      const latency = await measurePing();
      pingEl.textContent = nisFormatMs(latency.ping, 0);
      jitterEl.textContent = nisFormatMs(latency.jitter, 1);
      const download = await measureDownload();
      const upload = await measureUpload(download);
      const result = { download, upload, ping: latency.ping, jitter: latency.jitter, at: Date.now() };
      localStorage.setItem(NIS_RESULT_KEY, JSON.stringify(result));
      applyResult(result);
      status.textContent = 'Live test complete • Cloudflare Edge • no simulated values.';
    } catch (error) {
      status.textContent = `Live test could not complete: ${error?.message || 'network request failed'}`;
    } finally {
      running = false; run.disabled = false; runLabel.textContent = 'RUN AGAIN';
    }
  };

  back.addEventListener('click', () => root.closest('.nx-screen')?.querySelector('[data-app-back]')?.click());
  run.addEventListener('click', runTest);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline(); loadPrevious(); paintMeter(Number(localStorage.getItem(NIS_RESULT_KEY) ? JSON.parse(localStorage.getItem(NIS_RESULT_KEY)).download : 0) || 0, 'DOWNLOAD');

  root.__cleanup = () => {
    controllers.forEach(controller => controller.abort());
    controllers.clear();
    window.removeEventListener('online', updateOnline);
    window.removeEventListener('offline', updateOnline);
    screen?.classList.remove('nxnis-screen');
  };
  return root;
}

export const premiumNovaInternetSpeedRenderers = Object.freeze({
  'nova-internet-speed': renderNovaInternetSpeed
});
