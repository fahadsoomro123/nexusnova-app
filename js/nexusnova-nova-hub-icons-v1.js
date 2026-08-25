/* NexusNova Nova Hub Premium Icons v1
   Presentation-only icon owner for Nova Hub.
   - Replaces legacy/generic menu SVGs with semantic glossy glass vectors.
   - Keeps every existing button, target, onclick handler and navigation flow untouched.
   - Guarantees transparent icon canvases, centered geometry, uniform sizing and title-only cards.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubPremiumIconsV1) return;
  window.__nxNovaHubPremiumIconsV1 = true;
  window.nexusNovaHubPremiumIconsVersion = 'nova-hub-premium-icons-v1';

  let sequence = 0;
  let scheduled = 0;

  const ICON_STYLE = {
    profile: ['#a855f7','#6d28d9'], converter: ['#22d3ee','#0284c7'], notes: ['#38bdf8','#2563eb'],
    calculator: ['#fbbf24','#d97706'], wallet: ['#fb7185','#e11d48'], checklist: ['#34d399','#059669'],
    focus: ['#c084fc','#7c3aed'], health: ['#fb7185','#db2777'], qr: ['#a78bfa','#6d28d9'],
    tip: ['#facc15','#ca8a04'], clock: ['#38bdf8','#0f766e'], weather: ['#facc15','#0ea5e9'],
    speed: ['#22d3ee','#2563eb'], qibla: ['#34d399','#047857'], prayer: ['#2dd4bf','#047857'],
    news: ['#60a5fa','#1d4ed8'], pakistan: ['#22c55e','#047857'], article: ['#fbbf24','#b45309'],
    location: ['#60a5fa','#2563eb'], drive: ['#38bdf8','#1d4ed8'], route: ['#22d3ee','#2563eb'],
    ai: ['#a78bfa','#2563eb'], smart: ['#818cf8','#7c3aed'], community: ['#f472b6','#7c3aed'],
    browser: ['#22d3ee','#2563eb'], emergency: ['#fb7185','#dc2626'], entertainment: ['#f472b6','#7c3aed'],
    settings: ['#94a3b8','#475569'], calendar: ['#60a5fa','#4f46e5'], shopping: ['#f472b6','#db2777'],
    security: ['#34d399','#0f766e'], vault: ['#818cf8','#4338ca'], teacher: ['#fbbf24','#ea580c'],
    market: ['#34d399','#2563eb'], orders: ['#fb923c','#ea580c'], notifications: ['#fbbf24','#db2777'],
    mining: ['#60a5fa','#7c3aed'], tools: ['#38bdf8','#4f46e5'], leaderboard: ['#facc15','#d97706'],
    growth: ['#34d399','#2563eb'], family: ['#f472b6','#7c3aed'], contacts: ['#a78bfa','#2563eb'],
    general: ['#60a5fa','#7c3aed']
  };

  const body = {
    profile: `<circle cx="32" cy="26" r="8.2"/><path d="M18.5 49c1.7-9 7.2-13.3 13.5-13.3S43.8 40 45.5 49"/>`,
    converter: `<path d="M18 23h25"/><path d="m37 17 6 6-6 6"/><path d="M46 41H21"/><path d="m27 35-6 6 6 6"/><circle cx="19" cy="23" r="2.3" fill="#fff" stroke="none"/><circle cx="45" cy="41" r="2.3" fill="#fff" stroke="none"/>`,
    notes: `<path d="M20 14h19l7 7v28H20z"/><path d="M39 14v8h7"/><path d="M25 30h16M25 36h16M25 42h11"/>`,
    calculator: `<rect x="18" y="13" width="28" height="38" rx="7"/><path d="M24 20h16v7H24z"/><path d="M25 34h.1M32 34h.1M39 34h.1M25 41h.1M32 41h.1M39 41h.1M25 48h.1M32 48h7"/>`,
    wallet: `<path d="M15 22h32a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H17a5 5 0 0 1-5-5V22a7 7 0 0 1 7-7h25"/><path d="M12 25h39"/><path d="M40 33h11v10H40a5 5 0 0 1 0-10z"/><circle cx="44" cy="38" r="1.6" fill="#fff" stroke="none"/>`,
    checklist: `<rect x="17" y="13" width="31" height="39" rx="7"/><path d="m23 25 3 3 5-6M34 25h8"/><path d="m23 36 3 3 5-6M34 36h8"/><path d="m23 47 3 3 5-6M34 47h8"/>`,
    focus: `<circle cx="32" cy="34" r="16"/><path d="M32 34V23M32 34l8 5"/><path d="M25 13h14M28 13v5M36 13v5"/><path d="m17 22-4-4M47 22l4-4"/>`,
    health: `<path d="M18 17h28a6 6 0 0 1 6 6v25H12V23a6 6 0 0 1 6-6z"/><path d="M23 28c2-4 5-6 9-6s7 2 9 6"/><path d="M32 29l5-4"/><path d="M20 38h24"/><path d="M32 38v7"/>`,
    qr: `<path d="M15 15h14v14H15zM35 15h14v14H35zM15 35h14v14H15z"/><path d="M38 36h5v5h-5zM45 36h4v13h-4M36 45h6v4h-6"/><path d="M20 20h4v4h-4M40 20h4v4h-4M20 40h4v4h-4"/>`,
    tip: `<path d="M19 22h27v27H19z"/><path d="M24 17h17"/><path d="M27 28h11M27 35h11M27 42h6"/><circle cx="43" cy="42" r="5"/><path d="M43 39v6M40 42h6"/>`,
    clock: `<circle cx="32" cy="33" r="18"/><path d="M32 20v13l9 5"/><path d="M32 10v5M10 33h5M49 33h5"/><path d="M17 18l4 4M47 18l-4 4"/>`,
    weather: `<circle cx="25" cy="24" r="9"/><path d="M25 10v5M25 33v5M11 24h5M34 24h5M15 14l4 4M35 14l-4 4"/><path d="M22 47h25a7 7 0 1 0-2.5-13.5A11 11 0 0 0 24 37a6 6 0 0 0-2 10z"/>`,
    speed: `<path d="M14 45a19 19 0 1 1 36 0"/><path d="M19 43h26"/><path d="M32 39l10-13"/><circle cx="32" cy="39" r="3.2" fill="#fff" stroke="none"/><path d="M19 30l4 2M25 22l3 4M45 30l-4 2"/>`,
    qibla: `<circle cx="32" cy="32" r="20"/><path d="M32 15v5M32 44v5M15 32h5M44 32h5"/><path d="m27 39 5-15 5 15-5-3z" fill="rgba(255,255,255,.28)"/><path d="M32 24v12"/>`,
    prayer: `<path d="M14 48h36"/><path d="M18 48V31l14-10 14 10v17"/><path d="M32 21V13"/><path d="M28 13h8"/><path d="M24 48V36h16v12"/><circle cx="44" cy="20" r="6"/><path d="M44 17v3l2 2"/>`,
    news: `<path d="M17 15h27a5 5 0 0 1 5 5v29H20a5 5 0 0 1-5-5V15z"/><path d="M23 23h17M23 31h17M23 39h10"/><rect x="36" y="36" width="8" height="8" rx="2"/><path d="M15 23h-3v20a6 6 0 0 0 6 6"/>`,
    pakistan: `<path d="M19 14h26a6 6 0 0 1 6 6v29H19a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z"/><path d="M39 23a10 10 0 1 0 2 18 8.5 8.5 0 1 1-2-18z" fill="#fff" stroke="none"/><path d="m42 26 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.5-3 1.5.6-3.2-2.4-2.3 3.3-.5z" fill="#fff" stroke="none"/>`,
    article: `<path d="M18 15h24a5 5 0 0 1 5 5v29H18a5 5 0 0 1-5-5V20a5 5 0 0 1 5-5z"/><path d="M22 25h16M22 32h16M22 39h10"/><path d="m35 46 12-12 4 4-12 12-6 2z"/><path d="m44 37 4 4"/>`,
    location: `<path d="M32 52s15-11 15-25a15 15 0 1 0-30 0c0 14 15 25 15 25z"/><circle cx="32" cy="27" r="6"/>`,
    drive: `<path d="M17 22h13l5 6h12a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V27a5 5 0 0 1 5-5z"/><path d="M22 38h20M32 32v12"/><circle cx="23" cy="47" r="2" fill="#fff" stroke="none"/><circle cx="41" cy="47" r="2" fill="#fff" stroke="none"/>`,
    route: `<circle cx="18" cy="43" r="5"/><circle cx="46" cy="20" r="5"/><circle cx="45" cy="45" r="4"/><path d="M23 42c8-1 8-13 17-17M23 45h18"/><path d="M28 19l20 11"/><path d="m28 19 3-7 5 2-2 6" fill="rgba(255,255,255,.25)"/>`,
    ai: `<path d="M23 19a9 9 0 0 1 16 4 8 8 0 0 1 5 13 8 8 0 0 1-8 12H25a8 8 0 0 1-8-12 8 8 0 0 1 6-17z"/><circle cx="25" cy="31" r="2" fill="#fff" stroke="none"/><circle cx="39" cy="31" r="2" fill="#fff" stroke="none"/><circle cx="32" cy="40" r="2" fill="#fff" stroke="none"/><path d="M25 31h14M25 31l7 9 7-9"/><path d="M32 17v6M19 39h-5M50 39h-5"/>`,
    smart: `<circle cx="32" cy="32" r="7"/><circle cx="17" cy="21" r="4"/><circle cx="47" cy="21" r="4"/><circle cx="17" cy="45" r="4"/><circle cx="47" cy="45" r="4"/><path d="M23 28l-6-7M41 28l6-7M23 36l-6 9M41 36l6 9"/><path d="M32 15v10M32 39v10"/>`,
    community: `<path d="M14 18h26a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H26l-9 7v-7h-3a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z"/><circle cx="20" cy="31" r="2" fill="#fff" stroke="none"/><circle cx="28" cy="31" r="2" fill="#fff" stroke="none"/><circle cx="36" cy="31" r="2" fill="#fff" stroke="none"/>`,
    browser: `<circle cx="32" cy="32" r="19"/><path d="M13 32h38M32 13c7 7 9 14 9 19s-2 12-9 19M32 13c-7 7-9 14-9 19s2 12 9 19"/><path d="M20 21h24M20 43h24"/>`,
    emergency: `<path d="m32 12 21 37H11z"/><path d="M32 25v12"/><circle cx="32" cy="43" r="2.2" fill="#fff" stroke="none"/>`,
    entertainment: `<rect x="13" y="17" width="38" height="31" rx="9"/><path d="m27 26 14 7-14 7z" fill="rgba(255,255,255,.28)"/><path d="M19 12l6 5M45 12l-6 5"/>`,
    settings: `<circle cx="32" cy="32" r="8"/><path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M46 18l-4 4M22 42l-4 4"/><circle cx="32" cy="32" r="18" opacity=".5"/>`,
    calendar: `<rect x="14" y="17" width="36" height="34" rx="8"/><path d="M14 27h36M22 12v10M42 12v10"/><path d="M22 34h6M36 34h6M22 42h6M36 42h6"/>`,
    shopping: `<path d="M17 25h30l-3 25H20z"/><path d="M24 25a8 8 0 0 1 16 0"/><path d="M25 34h.1M39 34h.1"/>`,
    security: `<path d="M32 12 48 18v12c0 11-6 18-16 23-10-5-16-12-16-23V18z"/><rect x="25" y="29" width="14" height="12" rx="3"/><path d="M28 29v-4a4 4 0 0 1 8 0v4"/>`,
    vault: `<rect x="14" y="14" width="36" height="36" rx="8"/><circle cx="32" cy="32" r="10"/><path d="M32 25v7l5 3M21 45l-3 5M43 45l3 5"/>`,
    teacher: `<path d="M14 18h36v25H14z"/><path d="M20 24h24M20 31h16M20 38h10"/><path d="M32 43v8M24 51h16"/><circle cx="45" cy="38" r="6"/><path d="M45 35v6M42 38h6"/>`,
    market: `<path d="M14 47V33M24 47V26M34 47V36M44 47V19"/><path d="m14 27 10-7 10 7 15-15"/><path d="M42 12h7v7"/>`,
    orders: `<path d="m14 23 18-10 18 10v21L32 54 14 44z"/><path d="M14 23l18 10 18-10M32 33v21"/><path d="m23 18 18 10"/>`,
    notifications: `<path d="M20 42h24l-3-5V27a9 9 0 0 0-18 0v10z"/><path d="M27 46a5 5 0 0 0 10 0"/><path d="M32 13V9"/>`,
    mining: `<path d="m32 10-13 22h10l-2 22 18-27H34z" fill="rgba(255,255,255,.30)"/><circle cx="32" cy="32" r="21" opacity=".55"/>`,
    tools: `<path d="M38 14a10 10 0 0 0-11 13L13 41l10 10 14-14a10 10 0 0 0 13-11l-7 7-8-8z"/><path d="M17 45l2 2"/>`,
    leaderboard: `<path d="M22 16h20v9a10 10 0 0 1-20 0z"/><path d="M22 20h-7v4a9 9 0 0 0 10 9M42 20h7v4a9 9 0 0 1-10 9M32 35v10M24 51h16"/>`,
    growth: `<path d="M15 46V18M15 46h35"/><path d="m20 39 10-11 8 6 11-15"/><path d="M42 19h7v7"/>`,
    family: `<circle cx="25" cy="25" r="7"/><circle cx="41" cy="27" r="6"/><path d="M12 49c1-10 7-15 13-15 7 0 12 5 13 15M37 36c7 0 12 4 14 13"/>`,
    contacts: `<path d="M19 13h26a6 6 0 0 1 6 6v32H19a6 6 0 0 1-6-6V19a6 6 0 0 1 6-6z"/><circle cx="32" cy="27" r="6"/><path d="M22 44c1-7 5-10 10-10s9 3 10 10"/><path d="M13 23H9M13 32H9M13 41H9"/>`,
    general: `<path d="M32 12 50 22v20L32 52 14 42V22z"/><path d="M24 28h16M24 35h16M24 42h10"/>`
  };

  function glassIcon(kind) {
    const safeKind = body[kind] ? kind : 'general';
    const colors = ICON_STYLE[safeKind] || ICON_STYLE.general;
    const id = `nxhubg${++sequence}`;
    return `<svg class="nx-hub-premium-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}" x1="11" y1="8" x2="53" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="${colors[0]}"/><stop offset=".58" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[1]}" stop-opacity=".82"/></linearGradient><linearGradient id="${id}s" x1="18" y1="9" x2="43" y2="41" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".52"/><stop offset=".42" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect x="6.5" y="6.5" width="51" height="51" rx="17" fill="url(#${id})" stroke="#fff" stroke-opacity=".30"/><path d="M14 11.5C24 6 43 7 52 16c-8 7-26 10-39 5.5-2-3.2-1.2-7.2 1-10z" fill="url(#${id}s)"/><path d="M13 48c10 7 27 9 39 1" stroke="#fff" stroke-opacity=".10" stroke-width="2" stroke-linecap="round"/><g class="nx-hub-glyph" stroke="#fff" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">${body[safeKind]}</g></svg>`;
  }

  function normalizedLabel(button) {
    const labels = Array.from(button.children || []).filter(node => node.nodeType === 1 && !node.classList.contains('mi-icon'));
    const title = labels.length ? labels[labels.length - 1].textContent : button.textContent;
    return String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function buttonTarget(button) {
    if (!button) return '';
    const ds = button.dataset || {};
    const direct = ds.nxmega || ds.nxNovaHubTarget || ds.finalBible || ds.nxAppTarget || '';
    if (direct) return String(direct).toLowerCase();
    const code = String(button.getAttribute('onclick') || '');
    const match = code.match(/(?:openMoreTab|switchTab)\(\s*['"]([^'"]+)['"]/i);
    return String(match?.[1] || '').toLowerCase();
  }

  function semanticKind(button) {
    const target = buttonTarget(button);
    const label = normalizedLabel(button);
    const text = `${target} ${label}`;
    if (/(unit|converter|convert)/.test(text)) return 'converter';
    if (/(note|document|docs|file)/.test(text)) return 'notes';
    if (/(calculator|calc\b)/.test(text)) return 'calculator';
    if (/(expense|budget|finance|wallet|saving|money)/.test(text)) return 'wallet';
    if (/(checklist|task|habit|daily)/.test(text)) return 'checklist';
    if (/(focus|reminder|pomodoro)/.test(text)) return 'focus';
    if (/(bmi|health|fitness|weight)/.test(text)) return 'health';
    if (/(qr)/.test(text)) return 'qr';
    if (/(tip)/.test(text)) return 'tip';
    if (/(world.?clock|clock|time zone|timezone)/.test(text)) return 'clock';
    if (/(weather|forecast)/.test(text)) return 'weather';
    if (/(speed|meter|network test)/.test(text)) return 'speed';
    if (/(qibla|compass)/.test(text)) return 'qibla';
    if (/(prayer|islamic|mosque|salah)/.test(text)) return 'prayer';
    if (/(pakistan|pk news|pak news)/.test(text)) return 'pakistan';
    if (/(news|newspaper)/.test(text)) return 'news';
    if (/(article|learn|education|reader|book|study)/.test(text)) return 'article';
    if (/(location|map pin|places)/.test(text)) return 'location';
    if (/(drive)/.test(text)) return 'drive';
    if (/(travel|route|flight|trip)/.test(text)) return 'route';
    if (/(ai|assistant|neural)/.test(text)) return 'ai';
    if (/(smart|mega-hub|nova hub|hub)/.test(text)) return 'smart';
    if (/(community|chat|message)/.test(text)) return 'community';
    if (/(family)/.test(text)) return 'family';
    if (/(profile|account)/.test(text)) return 'profile';
    if (/(contact|caller)/.test(text)) return 'contacts';
    if (/(browser|web)/.test(text)) return 'browser';
    if (/(sos|emergency|safety)/.test(text)) return 'emergency';
    if (/(entertain|watch|video|media)/.test(text)) return 'entertainment';
    if (/(setting|about|preferences)/.test(text)) return 'settings';
    if (/(calendar|date)/.test(text)) return 'calendar';
    if (/(shop|marketplace|store)/.test(text)) return 'shopping';
    if (/(security|shield|lock)/.test(text)) return 'security';
    if (/(vault)/.test(text)) return 'vault';
    if (/(teacher|school|class)/.test(text)) return 'teacher';
    if (/(market|price|chart|trading)/.test(text)) return 'market';
    if (/(order|package)/.test(text)) return 'orders';
    if (/(notification|alert|bell)/.test(text)) return 'notifications';
    if (/(mine|mining)/.test(text)) return 'mining';
    if (/(leaderboard|rank|trophy)/.test(text)) return 'leaderboard';
    if (/(growth|referral|analytics)/.test(text)) return 'growth';
    if (/(tool|utility)/.test(text)) return 'tools';
    return 'general';
  }

  function ensureTitle(button) {
    const children = Array.from(button.children || []);
    let title = children.filter(node => node.nodeType === 1 && !node.classList.contains('mi-icon')).pop();
    if (!title) { title = document.createElement('span'); title.textContent = normalizedLabel(button) || 'App'; button.appendChild(title); }
    title.classList.add('nx-hub-title');
    Array.from(button.children).forEach(node => { if (node !== title && !node.classList.contains('mi-icon')) node.classList.add('nx-hub-extra-copy'); });
    const label = String(title.textContent || '').replace(/\s+/g, ' ').trim();
    if (label) { button.setAttribute('aria-label', label); if (!button.title) button.title = label; }
    return title;
  }

  function ensureIcon(button) {
    let icon = button.querySelector(':scope > .mi-icon');
    if (!icon) { icon = document.createElement('span'); icon.className = 'mi-icon'; button.insertBefore(icon, button.firstChild); }
    return icon;
  }

  function applyButton(button) {
    if (!(button instanceof HTMLElement) || !button.matches('#moreMenu .more-item')) return;
    const title = ensureTitle(button);
    const icon = ensureIcon(button);
    const kind = semanticKind(button);
    const signature = `${kind}:${String(title.textContent || '').trim()}`;
    if (icon.dataset.nxPremiumIconSignature !== signature || !icon.querySelector('.nx-hub-premium-icon')) {
      icon.innerHTML = glassIcon(kind);
      icon.dataset.nxPremiumIconSignature = signature;
      icon.dataset.nxPremiumIconKind = kind;
    }
    button.dataset.nxPremiumHubCard = '1';
  }

  function applyAll() { scheduled = 0; document.querySelectorAll('#moreMenu .more-item').forEach(applyButton); }
  function scheduleApply() { if (!scheduled) scheduled = requestAnimationFrame(applyAll); }

  function installStyle() {
    if (document.getElementById('nxNovaHubPremiumIconsV1Style')) return;
    const style = document.createElement('style');
    style.id = 'nxNovaHubPremiumIconsV1Style';
    style.textContent = `
      #moreMenu .more-inner{align-items:stretch!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"]{min-height:112px!important;height:auto!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:10px 6px!important;text-align:center!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] > .mi-icon{width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important;flex:0 0 58px!important;display:flex!important;align-items:center!important;justify-content:center!important;place-items:center!important;margin:0 auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;overflow:visible!important;line-height:0!important;position:relative!important;inset:auto!important;transform:none!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] > .mi-icon::before,#moreMenu .more-item[data-nx-premium-hub-card="1"] > .mi-icon::after{content:none!important;display:none!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] .nx-hub-premium-icon{width:58px!important;height:58px!important;max-width:58px!important;max-height:58px!important;display:block!important;margin:0!important;padding:0!important;position:static!important;inset:auto!important;transform:none!important;stroke:none!important;overflow:visible!important;flex:0 0 58px!important;filter:drop-shadow(0 7px 10px rgba(0,0,0,.28)) drop-shadow(0 0 8px rgba(78,156,255,.10))!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] .nx-hub-premium-icon .nx-hub-glyph{stroke:#fff!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] > .nx-hub-title{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0 2px!important;color:#f7fbff!important;font-size:10px!important;font-weight:850!important;line-height:1.15!important;letter-spacing:.005em!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important;position:static!important;transform:none!important}
      #moreMenu .more-item[data-nx-premium-hub-card="1"] > .nx-hub-extra-copy{display:none!important}
      @media(max-width:700px){#moreMenu .more-item[data-nx-premium-hub-card="1"]{min-height:102px!important;gap:6px!important;padding:8px 4px!important}#moreMenu .more-item[data-nx-premium-hub-card="1"] > .mi-icon,#moreMenu .more-item[data-nx-premium-hub-card="1"] .nx-hub-premium-icon{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;max-width:52px!important;max-height:52px!important;flex-basis:52px!important}#moreMenu .more-item[data-nx-premium-hub-card="1"] > .nx-hub-title{font-size:9.5px!important}}
      @media(max-width:360px){#moreMenu .more-item[data-nx-premium-hub-card="1"]{min-height:96px!important}#moreMenu .more-item[data-nx-premium-hub-card="1"] > .mi-icon,#moreMenu .more-item[data-nx-premium-hub-card="1"] .nx-hub-premium-icon{width:49px!important;height:49px!important;min-width:49px!important;min-height:49px!important;max-width:49px!important;max-height:49px!important;flex-basis:49px!important}}
    `;
    document.head.appendChild(style);
  }

  function observe() {
    const root = document.body;
    if (!root || root.dataset.nxHubPremiumObserver === '1') return;
    root.dataset.nxHubPremiumObserver = '1';
    const observer = new MutationObserver(records => {
      let relevant = false;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('#moreMenu,.more-item,.mi-icon') || node.querySelector?.('#moreMenu .more-item,.more-item')) { relevant = true; break; }
        }
        if (relevant) break;
      }
      if (relevant) scheduleApply();
    });
    observer.observe(root, { childList:true, subtree:true });
    window.__nxNovaHubPremiumIconsObserverV1 = observer;
  }

  function boot() {
    installStyle(); applyAll(); observe();
    [150,450,1000,2200,4200].forEach(ms => setTimeout(scheduleApply, ms));
    window.addEventListener('nexusnova:allapps-ready', scheduleApply);
    window.addEventListener('nexusnova:nova-hub-ready', scheduleApply);
    window.addEventListener('nexusnova:ui-ready', scheduleApply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
