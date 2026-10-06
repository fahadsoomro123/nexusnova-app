const SOCIALS = Object.freeze({
  x: Object.freeze({
    id: 'x',
    label: 'X',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova profile',
    href: 'https://x.com/NexusNovaTools',
    glyph: 'X',
    action: 'FOLLOW'
  }),
  instagram: Object.freeze({
    id: 'instagram',
    label: 'Instagram',
    handle: '@nexusnovatools',
    detail: 'Official NexusNova profile',
    href: 'https://www.instagram.com/nexusnovatools/',
    glyph: 'IG',
    action: 'FOLLOW'
  }),
  telegram: Object.freeze({
    id: 'telegram',
    label: 'Telegram',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova channel',
    href: 'https://t.me/NexusNovaTools',
    glyph: 'TG',
    action: 'JOIN'
  }),
  facebook: Object.freeze({
    id: 'facebook',
    label: 'Facebook',
    handle: '@NexusNovaTools',
    detail: 'Official NexusNova page',
    href: 'https://web.facebook.com/NexusNovaTools/',
    glyph: 'f',
    action: 'FOLLOW'
  })
});

const FOLLOWABLE_IDS = new Set(Object.keys(SOCIALS));
let promptRoot = null;
let promptItem = null;
let scanQueued = false;

function ensureStyles() {
  if (document.getElementById('nx-tasks-social-follow-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-tasks-social-follow-v1';
  style.textContent = `
    .nx-social-mission[data-social-task="x"] .nx-social-glyph{
      background:linear-gradient(145deg,rgba(32,38,48,.94),rgba(4,8,14,.98));
      border-color:rgba(255,255,255,.14);color:#fff;font-size:16px;letter-spacing:-.06em
    }
    .nx-social-mission[data-social-task="instagram"] .nx-social-glyph{
      background:radial-gradient(circle at 68% 70%,rgba(255,188,64,.72),transparent 28%),linear-gradient(145deg,rgba(203,51,126,.88),rgba(100,55,201,.92));
      border-color:rgba(255,190,230,.18);color:#fff;font-size:9px;letter-spacing:.03em
    }
    .nx-social-mission[data-social-task="x"] .nx-social-action,
    .nx-social-mission[data-social-task="instagram"] .nx-social-action,
    .nx-social-mission[data-social-task="facebook"] .nx-social-action{
      background:linear-gradient(145deg,rgba(24,113,171,.22),rgba(49,56,159,.18));
      border-color:rgba(98,211,255,.20);color:#c6f2ff
    }
    .nx-social-mission[data-social-task="telegram"] .nx-social-action{
      background:linear-gradient(145deg,rgba(26,154,204,.22),rgba(14,96,157,.22));
      border-color:rgba(91,209,255,.22);color:#bcefff
    }
    .nx-follow-gate{
      position:fixed;inset:0;z-index:2147483638;display:grid;align-items:end;padding:18px 14px calc(env(safe-area-inset-bottom) + 18px);
      background:rgba(1,7,16,.77);backdrop-filter:blur(10px) saturate(118%);-webkit-backdrop-filter:blur(10px) saturate(118%);
      opacity:0;pointer-events:none;transition:opacity .17s ease
    }
    .nx-follow-gate.is-open{opacity:1;pointer-events:auto}
    .nx-follow-gate__sheet{
      width:min(100%,520px);margin:0 auto;padding:16px;border:1px solid rgba(96,208,255,.20);border-radius:24px;
      background:radial-gradient(circle at 92% 0,rgba(94,95,255,.16),transparent 31%),linear-gradient(155deg,rgba(13,37,59,.99),rgba(5,18,32,.995));
      box-shadow:0 26px 70px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.055);transform:translateY(20px) scale(.985);transition:transform .19s cubic-bezier(.2,.8,.2,1)
    }
    .nx-follow-gate.is-open .nx-follow-gate__sheet{transform:none}
    .nx-follow-gate__top{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .nx-follow-gate__identity{display:flex;align-items:center;gap:11px;min-width:0}
    .nx-follow-gate__glyph{flex:0 0 44px;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(114,218,255,.17);border-radius:14px;background:linear-gradient(145deg,rgba(25,106,157,.66),rgba(31,50,110,.76));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 20px rgba(0,0,0,.22);font-size:12px;font-weight:950;color:#fff}
    .nx-follow-gate__copy{min-width:0}.nx-follow-gate__copy small{display:block;color:#61dffc;font-size:8px;font-weight:900;letter-spacing:.14em}.nx-follow-gate__copy strong{display:block;margin-top:3px;font-size:16px;line-height:1.15}.nx-follow-gate__copy span{display:block;margin-top:3px;color:#8da9bd;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nx-follow-gate__close{flex:0 0 38px;width:38px;height:38px;border:1px solid rgba(154,204,255,.12);border-radius:12px;background:rgba(11,31,50,.88);color:#b8ccda;font-size:19px;cursor:pointer}
    .nx-follow-gate__message{margin:14px 1px 0;color:#9cb2c4;font-size:10px;line-height:1.55}
    .nx-follow-gate__trust{display:flex;align-items:flex-start;gap:7px;margin:10px 1px 0;padding:9px 10px;border:1px solid rgba(91,211,255,.10);border-radius:12px;background:rgba(49,177,220,.045);color:#6f8ca1;font-size:8px;line-height:1.45}
    .nx-follow-gate__trust i{flex:0 0 7px;width:7px;height:7px;margin-top:2px;border-radius:50%;background:#45dfa8;box-shadow:0 0 11px rgba(69,223,168,.65)}
    .nx-follow-gate__actions{display:grid;grid-template-columns:88px minmax(0,1fr);gap:8px;margin-top:13px}
    .nx-follow-gate__actions button{min-height:46px;border-radius:14px;font-size:9px;font-weight:950;letter-spacing:.065em;cursor:pointer}
    .nx-follow-gate__cancel{border:1px solid rgba(149,178,203,.13);background:rgba(12,30,48,.78);color:#8ca5b8}
    .nx-follow-gate__go{border:1px solid rgba(86,220,255,.25);background:linear-gradient(135deg,rgba(24,135,197,.93),rgba(57,82,199,.86));color:#fff;box-shadow:0 10px 24px rgba(18,96,184,.2),inset 0 1px 0 rgba(255,255,255,.09)}
    html.nx-follow-gate-open{overflow:hidden!important}
    @media(max-width:370px){.nx-follow-gate{padding-inline:10px}.nx-follow-gate__sheet{padding:14px;border-radius:21px}.nx-follow-gate__actions{grid-template-columns:78px minmax(0,1fr)}}
    @media(prefers-reduced-motion:reduce){.nx-follow-gate,.nx-follow-gate__sheet{transition:none!important}}
  `;
  document.head.appendChild(style);
}

function rowHtml(item) {
  return `
    <a class="nx-social-mission" data-social-task="${item.id}" href="${item.href}" target="_blank" rel="noopener noreferrer" aria-label="Open ${item.label} ${item.handle}">
      <span class="nx-social-glyph" aria-hidden="true">${item.glyph}</span>
      <span class="nx-social-copy"><strong>${item.label}</strong><span>${item.handle}</span><small>${item.detail}</small></span>
      <span class="nx-social-action">${item.action}</span>
    </a>
  `;
}

function createRow(item) {
  const holder = document.createElement('div');
  holder.innerHTML = rowHtml(item).trim();
  return holder.firstElementChild;
}

function enhanceGrid(grid) {
  if (!(grid instanceof HTMLElement)) return;
  const tasksRoot = grid.closest('.nx-tasks-premium');
  if (!tasksRoot) return;
  tasksRoot.dataset.socialRewardVerification = 'server-only';

  const telegram = grid.querySelector('[data-social-task="telegram"]');
  if (!grid.querySelector('[data-social-task="instagram"]')) {
    const instagram = createRow(SOCIALS.instagram);
    if (telegram) grid.insertBefore(instagram, telegram);
    else grid.prepend(instagram);
  }
  if (!grid.querySelector('[data-social-task="x"]')) {
    const x = createRow(SOCIALS.x);
    const instagram = grid.querySelector('[data-social-task="instagram"]');
    if (instagram) grid.insertBefore(x, instagram);
    else grid.prepend(x);
  }

  for (const item of Object.values(SOCIALS)) {
    const row = grid.querySelector(`[data-social-task="${item.id}"]`);
    if (!row) continue;
    row.href = item.href;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
    const action = row.querySelector('.nx-social-action');
    if (action) action.textContent = item.action;
  }
}

function scan() {
  scanQueued = false;
  document.querySelectorAll('.nx-community-grid').forEach(enhanceGrid);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  queueMicrotask(scan);
}

function ensurePrompt() {
  if (promptRoot?.isConnected) return promptRoot;
  const root = document.createElement('div');
  root.className = 'nx-follow-gate';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Open official NexusNova social profile');
  root.innerHTML = `
    <section class="nx-follow-gate__sheet">
      <div class="nx-follow-gate__top">
        <div class="nx-follow-gate__identity">
          <span class="nx-follow-gate__glyph" data-follow-glyph aria-hidden="true">N</span>
          <div class="nx-follow-gate__copy"><small>OFFICIAL NEXUSNOVA</small><strong data-follow-title>Community</strong><span data-follow-handle></span></div>
        </div>
        <button class="nx-follow-gate__close" type="button" data-follow-close aria-label="Close">×</button>
      </div>
      <p class="nx-follow-gate__message" data-follow-message></p>
      <p class="nx-follow-gate__trust"><i aria-hidden="true"></i><span>You will be redirected to the official platform. Follow or join there. NVX is never credited just for opening a link; any reward requires secure server verification.</span></p>
      <div class="nx-follow-gate__actions">
        <button class="nx-follow-gate__cancel" type="button" data-follow-cancel>NOT NOW</button>
        <button class="nx-follow-gate__go" type="button" data-follow-go>OPEN PROFILE</button>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  const close = () => {
    root.classList.remove('is-open');
    document.documentElement.classList.remove('nx-follow-gate-open');
    setTimeout(() => {
      if (!root.classList.contains('is-open')) root.hidden = true;
    }, 190);
    promptItem = null;
  };

  root.querySelector('[data-follow-close]')?.addEventListener('click', close);
  root.querySelector('[data-follow-cancel]')?.addEventListener('click', close);
  root.addEventListener('click', event => {
    if (event.target === root) close();
  });
  root.querySelector('[data-follow-go]')?.addEventListener('click', () => {
    const item = promptItem;
    if (!item) return;
    const link = document.createElement('a');
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    close();
  });

  promptRoot = root;
  return root;
}

function openPrompt(item) {
  ensureStyles();
  const root = ensurePrompt();
  promptItem = item;
  const glyph = root.querySelector('[data-follow-glyph]');
  const title = root.querySelector('[data-follow-title]');
  const handle = root.querySelector('[data-follow-handle]');
  const message = root.querySelector('[data-follow-message]');
  const go = root.querySelector('[data-follow-go]');
  if (glyph) glyph.textContent = item.glyph;
  if (title) title.textContent = item.label;
  if (handle) handle.textContent = item.handle;
  if (message) message.textContent = item.id === 'telegram'
    ? `Join the official ${item.label} community. Tap below to open ${item.handle}.`
    : `Follow NexusNova on ${item.label}. Tap below to open the official ${item.handle} profile.`;
  if (go) go.textContent = item.action === 'JOIN' ? 'OPEN & JOIN' : 'OPEN & FOLLOW';
  root.hidden = false;
  document.documentElement.classList.add('nx-follow-gate-open');
  requestAnimationFrame(() => root.classList.add('is-open'));
}

function onDocumentClick(event) {
  const row = event.target instanceof Element ? event.target.closest('.nx-social-mission[data-social-task]') : null;
  if (!row) return;
  const id = String(row.dataset.socialTask || '');
  if (!FOLLOWABLE_IDS.has(id)) return;
  event.preventDefault();
  event.stopPropagation();
  openPrompt(SOCIALS[id]);
}

function boot() {
  ensureStyles();
  queueScan();
  document.addEventListener('click', onDocumentClick, true);
  const observer = new MutationObserver(queueScan);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
