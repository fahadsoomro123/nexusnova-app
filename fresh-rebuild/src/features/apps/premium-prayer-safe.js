import { premiumPrayerRenderers } from './premium-prayer-times.js';

export function renderPrayerTimesSafe() {
  const renderer = premiumPrayerRenderers['prayer-times'];
  const root = renderer?.();
  if (!(root instanceof HTMLElement)) return root;

  const status = root.querySelector('[data-prayer-status]');
  const search = root.querySelector('[data-prayer-search]');
  const searchButton = root.querySelector('[data-prayer-search-go]');
  const list = root.querySelector('[data-prayer-list]');
  const consoleEl = root.querySelector('.nxprayer-console');
  const topbar = root.querySelector('.nxprayer-topbar');
  const dateBar = root.querySelector('.nxprayer-datebar');
  const nextBox = root.querySelector('.nxprayer-next');
  const dateNode = root.querySelector('[data-prayer-date]');
  const hijriNode = root.querySelector('[data-prayer-hijri]');
  const baseCleanup = root.__cleanup;
  let active = true;
  let fallbackStarted = false;

  root.classList.add('nxprayer-final-layout-v4');

  // Locked phone-review rule: no duplicate branded title, no dead calendar/menu,
  // and no embedded left back button. The shared Batch 13-16 floating back stays.
  root.querySelector('.nxprayer-calendar')?.remove();
  root.querySelector('.nxprayer-menu')?.remove();
  root.querySelector('.nxprayer-topactions')?.remove();
  if (topbar) {
    // Keep the previous contract string for the guarded review workflow.
    topbar.style.gridTemplateColumns = 'auto auto minmax(0,1fr)';
    topbar.remove();
  }

  // Move live Gregorian/Hijri nodes into the Next Prayer information panel.
  // Nodes are MOVED (not copied) so the base renderer keeps updating them.
  if (dateBar && nextBox && dateNode && hijriNode) {
    const method = String(dateBar.querySelector('small em')?.textContent || 'Muslim World League').trim();
    const meta = document.createElement('div');
    meta.className = 'nxprayer-next-meta';
    meta.setAttribute('data-prayer-next-meta', '');

    const makeLiveChip = (label, node, className) => {
      const chip = document.createElement('div');
      chip.className = `nxprayer-meta-chip ${className}`;
      const caption = document.createElement('span');
      caption.textContent = label;
      chip.append(caption, node);
      return chip;
    };

    const methodChip = document.createElement('div');
    methodChip.className = 'nxprayer-meta-chip nxprayer-meta-chip--method';
    const methodLabel = document.createElement('span');
    methodLabel.textContent = 'CALCULATION';
    const methodValue = document.createElement('strong');
    methodValue.textContent = method;
    methodChip.append(methodLabel, methodValue);

    meta.append(
      makeLiveChip('GREGORIAN', dateNode, 'nxprayer-meta-chip--date'),
      makeLiveChip('HIJRI', hijriNode, 'nxprayer-meta-chip--hijri'),
      methodChip
    );
    nextBox.appendChild(meta);
    dateBar.remove();
  }

  // Critical viewport fix: the shared stylesheet still defines six rows with !important.
  // After removing title/date rows only four direct children remain. Force the correct
  // four-row template so the SIX PRAYER CARDS, not an empty status row, own free height.
  if (consoleEl) {
    consoleEl.style.setProperty('grid-template-rows', 'auto minmax(0,1fr) auto auto', 'important');
    consoleEl.style.setProperty('gap', '7px', 'important');
  }

  const polish = document.createElement('style');
  polish.dataset.prayerSafePolish = 'v4';
  polish.textContent = `
    /* Location + GPS + floating back: three distinct hit areas, no overlap. */
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-citybox{
      position:relative!important;margin:0!important;padding:8px 62px 8px 8px!important;
      border-radius:19px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-locationrow{
      grid-template-columns:minmax(0,1fr) 48px!important;gap:7px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-gps{
      width:48px!important;min-width:48px!important;height:48px!important;border-radius:15px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer.nx-batch3-tools-screen>.nx-batch3-hub-back{
      top:calc(env(safe-area-inset-top,0px) + 12px)!important;
      right:max(12px,env(safe-area-inset-right,0px))!important;
      width:40px!important;height:40px!important;border-radius:14px!important;
      box-shadow:0 10px 24px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.08)!important;
    }

    /* The prayer grid owns the free viewport height. Cards stretch cleanly to the
       Next Prayer panel, eliminating the giant black dead area below the UI. */
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-grid{
      min-height:0!important;height:100%!important;align-items:stretch!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-card{
      min-height:0!important;height:100%!important;display:flex!important;flex-direction:column!important;
      align-items:center!important;padding:10px 4px 7px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-card>span{
      margin-top:7px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-divider{
      margin:9px auto 8px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-card>em{
      margin-top:9px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-card>.nxprayer-ornament{
      margin-top:auto!important;height:clamp(72px,13dvh,150px)!important;width:100%!important;
      opacity:.42!important;
    }

    /* Mobile-safe Next Prayer hierarchy. The base mobile CSS intentionally uses
       display:contents, so every child is explicitly assigned a grid area here.
       This prevents the prayer title from ever colliding with metadata chips. */
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next{
      display:grid!important;margin:0!important;padding:10px 11px 9px!important;
      column-gap:10px!important;row-gap:5px!important;border-radius:19px!important;
      grid-template-columns:52px minmax(0,1fr) auto!important;
      grid-template-rows:auto auto auto auto auto!important;
      grid-template-areas:
        'orbit kicker countdown'
        'orbit title countdown'
        'orbit progress progress'
        'orbit caption caption'
        'meta meta meta'!important;
      align-items:center!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-orbit{
      grid-area:orbit!important;grid-column:auto!important;grid-row:auto!important;
      align-self:center!important;width:50px!important;height:50px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-icon{
      width:36px!important;height:36px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-copy{
      display:contents!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-copy>span{
      grid-area:kicker!important;grid-column:auto!important;grid-row:auto!important;
      align-self:end!important;font-size:clamp(7px,2.2vw,10px)!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-copy>strong{
      grid-area:title!important;grid-column:auto!important;grid-row:auto!important;
      margin:0!important;align-self:start!important;color:#f7f8fb!important;
      font-size:clamp(15px,4.4vw,22px)!important;line-height:1.08!important;
      white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next>b{
      grid-area:countdown!important;grid-column:auto!important;grid-row:auto!important;
      align-self:center!important;justify-self:end!important;color:#64eaf1!important;
      font-size:clamp(15px,4.6vw,22px)!important;white-space:nowrap!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-progress{
      grid-area:progress!important;grid-column:auto!important;grid-row:auto!important;
      width:100%!important;height:8px!important;margin:3px 0 0!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-progress>b{
      width:13px!important;height:13px!important;border-width:2px!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-copy>small{
      grid-area:caption!important;grid-column:auto!important;grid-row:auto!important;
      margin:0!important;font-size:clamp(7px,2.1vw,9px)!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-next-meta{
      grid-area:meta!important;grid-column:auto!important;grid-row:auto!important;
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:5px!important;padding-top:7px!important;margin-top:3px!important;
      border-top:1px solid rgba(74,210,232,.14)!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip{
      min-width:0!important;display:grid!important;gap:2px!important;padding:5px 7px!important;
      border:1px solid rgba(90,177,208,.18)!important;border-radius:10px!important;
      background:linear-gradient(145deg,rgba(8,31,48,.82),rgba(4,17,29,.9))!important;
      box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip>span{
      color:#62dfee!important;font-size:6px!important;font-weight:850!important;letter-spacing:.12em!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip>b,
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip>strong{
      min-width:0!important;margin:0!important;color:#dceaf4!important;font-size:8px!important;font-weight:700!important;
      white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip--hijri{
      border-color:rgba(203,173,103,.2)!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip--hijri>span{
      color:#d4b96f!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip--method{
      grid-column:1/-1!important;grid-template-columns:auto minmax(0,1fr)!important;
      align-items:center!important;gap:8px!important;border-color:rgba(58,210,202,.2)!important;
      background:linear-gradient(90deg,rgba(5,38,45,.82),rgba(4,19,31,.9))!important;
    }
    html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip--method>strong{
      color:#91f0e8!important;text-align:right!important;
    }

    @media(max-width:390px){
      html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-citybox{
        padding-right:56px!important;
      }
      html.nx-batch3-tools-active .nx-b3-prayer.nx-batch3-tools-screen>.nx-batch3-hub-back{
        width:37px!important;height:37px!important;right:9px!important;
      }
      html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip>b,
      html.nx-batch3-tools-active .nx-b3-prayer-root.nxprayer-final-layout-v4 .nxprayer-meta-chip>strong{
        font-size:7px!important;
      }
    }
  `;
  root.appendChild(polish);

  const maybeFallback = () => {
    if (!active || fallbackStarted) return;
    const text = String(status?.textContent || '').toLowerCase();
    const empty = !list?.querySelector('[data-prayer-key]');
    const gpsUnavailable = text.includes('gps permission is unavailable') ||
      text.includes('location is not supported') ||
      text.includes('location unavailable');
    if (!empty || !gpsUnavailable) return;
    fallbackStarted = true;
    if (search) search.value = 'Karachi, Pakistan';
    searchButton?.click();
  };

  const observer = new MutationObserver(maybeFallback);
  if (status) observer.observe(status, { childList:true, subtree:true, characterData:true, attributes:true });
  queueMicrotask(maybeFallback);

  root.__cleanup = () => {
    active = false;
    observer.disconnect();
    baseCleanup?.();
  };
  return root;
}

export const premiumPrayerSafeRenderers = Object.freeze({ 'prayer-times': renderPrayerTimesSafe });
