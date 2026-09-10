// Nova Drive History v2 narrow visual/interaction correction.
// Keeps the approved pixel-sliced art, masks only baked demo-data regions,
// preserves the locked Drive/Tracker viewport, and never repaints on a timer.

const patched = new WeakSet();

function installStyle() {
  if (document.querySelector('[data-nx-drive-history-v2-hotfix]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-nx-drive-history-v2-hotfix>
    /* The real Drive Cockpit must stay visually untouched. History is entered
       through the four existing summary cards, not a new bar over the gauge. */
    .nxh2-dashboard-tabs{display:none!important}

    /* The early v2 coordinate hitboxes were crop-sensitive on physical phones.
       Use the real rendered analytics cards as the click targets instead. */
    .nx-history-entry-v2{display:none!important;pointer-events:none!important}
    [data-approved-drive-view] [data-approved-today],
    [data-approved-drive-view] [data-approved-week],
    [data-approved-drive-view] [data-approved-month],
    [data-approved-drive-view] [data-approved-history]{pointer-events:auto!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent}

    /* History is a sibling fixed viewport. Hide the other approved canvases only
       while History is open so no Drive/Tracker layers bleed through. */
    .nx-approved-drive.is-history-open>.nx-approved-view[data-approved-drive-view],
    .nx-approved-drive.is-history-open>.nx-approved-view[data-approved-tracker-view]{display:none!important}

    /* Work's reference art contains sample values. Cover only the value zones,
       then leave the real event-driven data above them. Static labels/icons stay. */
    .nxh2-metric{position:relative!important;isolation:isolate}
    .nxh2-metric::before{content:"";position:absolute;z-index:0;left:7%;right:27%;top:27%;bottom:5%;border-radius:7px;background:#061522;box-shadow:0 0 8px 8px #061522}
    .nxh2-metric>b,.nxh2-metric>small{position:relative;z-index:2}

    .nxh2-loc{position:relative!important;isolation:isolate}
    .nxh2-loc::before{content:"";position:absolute;z-index:0;left:17%;right:11%;top:28%;bottom:5%;border-radius:6px;background:#061522;box-shadow:0 0 7px 7px #061522}
    .nxh2-loc>b,.nxh2-loc>span{position:relative;z-index:2}

    /* Recent-trip demo dates must never show when the real store is empty. */
    .nxh2-recent{position:absolute!important;background:linear-gradient(180deg,#061a2a,#04121e)!important;border-radius:0 0 14px 14px!important;overflow:hidden!important}
    .nxh2-recent:empty::after{content:"No trips in this filter";display:grid;place-items:center;height:100%;color:#7898ac;font-size:2vw;font-weight:750;letter-spacing:.03em}
    .nxh2-row{position:relative;z-index:2}

    /* The old lock-cover caused a black floating rectangle on the dashboard.
       Entitlement remains enforced by the real owner gate, not by covering UI. */
    .nx-approved-premium-cover{display:none!important}

    /* Real click targets over the approved History bottom navigation. */
    .nxh2-bottom-hit{position:absolute;z-index:20;bottom:2.1%;height:7.4%;border:0;background:transparent;color:transparent;padding:0;-webkit-tap-highlight-color:transparent}
    .nxh2-bottom-hit.drive{left:4%;width:38.5%}
    .nxh2-bottom-hit.hub{left:43.1%;width:13.8%;border-radius:50%}
    .nxh2-bottom-hit.vehicle{right:4%;width:38.5%}
  </style>`);
}

function patch(ui) {
  if (!(ui instanceof HTMLElement)) return;
  const history = ui.querySelector('[data-approved-history-view-v2]');
  if (!history || patched.has(history)) return;
  patched.add(history);
  installStyle();

  // Remove the dashboard overlay injected by the early v2 implementation.
  ui.querySelector('[data-h2-dashboard-tabs]')?.remove();
  ui.querySelectorAll('.nx-history-entry-v2').forEach(node => node.remove());

  // Bind History to the actual four summary cards. This survives every approved
  // phone crop/scale because the clickable element is the card value itself.
  const drive = ui.querySelector('[data-approved-drive-view]');
  const historyEntries = [
    ['[data-approved-today]', 'today', 'Open today Drive History'],
    ['[data-approved-week]', 'week', 'Open this week Drive History'],
    ['[data-approved-month]', 'month', 'Open this month Drive History'],
    ['[data-approved-history]', 'history', 'Open all Drive History']
  ];
  historyEntries.forEach(([selector, filter, label]) => {
    const card = drive?.querySelector(selector);
    if (!(card instanceof HTMLElement)) return;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', label);
    const open = event => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      window.NexusNovaDriveHistory?.open?.(filter);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') open(event);
    });
  });

  const makeHit = (kind, label, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nxh2-bottom-hit ${kind}`;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', handler);
    history.appendChild(button);
  };

  makeHit('drive', 'Drive Cockpit', () => {
    window.NexusNovaDriveHistory?.close?.();
  });

  makeHit('hub', 'Nova Hub', () => {
    window.NexusNovaDriveHistory?.close?.();
    const back = ui.querySelector('[data-approved-drive-view] [data-approved-hub-back]');
    queueMicrotask(() => back?.click());
  });

  makeHit('vehicle', 'Vehicle Tracking', () => {
    window.NexusNovaDriveHistory?.close?.();
    const target = ui.querySelector('[data-approved-drive-view] [data-approved-vehicle-hit]');
    queueMicrotask(() => target?.click());
  });
}

function scan(root = document) {
  if (root instanceof HTMLElement) {
    const ui = root.matches('[data-nx-approved]')
      ? root
      : root.closest?.('[data-nx-approved]');
    if (ui) patch(ui);
  }
  root.querySelectorAll?.('[data-nx-approved]').forEach(patch);
}

installStyle();
scan();
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof HTMLElement) scan(node);
    }
  }
}).observe(document.documentElement, { childList:true, subtree:true });
