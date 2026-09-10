import { hydrateDriveTrackState } from './core/drive-track-persistence.js';

let recoverInFlight = null;
let hideTimer = 0;

function visibleRoot(button) {
  return button?.closest?.('#nxgold14,[data-nx-approved]') || document.querySelector('#nxgold14') || button?.closest?.('[data-nx-approved]') || null;
}

function ensureToast(ui) {
  let node = ui?.querySelector?.('[data-nx-drive-recover-feedback]');
  if (node) return node;
  if (!(ui instanceof HTMLElement)) return null;
  node = document.createElement('div');
  node.setAttribute('data-nx-drive-recover-feedback', '');
  node.style.cssText = [
    'position:absolute',
    'z-index:220',
    'left:8%',
    'right:8%',
    'top:18.5%',
    'min-height:44px',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'padding:10px 14px',
    'border:1px solid rgba(65,213,255,.72)',
    'border-radius:14px',
    'background:rgba(3,17,29,.97)',
    'box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 18px rgba(45,207,255,.14)',
    'color:#eafaff',
    'font:800 clamp(11px,2.7vw,17px)/1.35 Inter,system-ui,sans-serif',
    'text-align:center',
    'pointer-events:none'
  ].join(';');
  ui.appendChild(node);
  return node;
}

function show(ui, message, error = false, holdMs = 5200) {
  const node = ensureToast(ui);
  if (!node) return;
  window.clearTimeout(hideTimer);
  node.textContent = String(message || 'Drive recovery finished.');
  node.style.display = 'flex';
  node.style.borderColor = error ? 'rgba(255,103,114,.78)' : 'rgba(65,213,255,.72)';
  node.style.color = error ? '#ffd8dc' : '#eafaff';
  hideTimer = window.setTimeout(() => { node.style.display = 'none'; }, holdMs);
}

async function runRecovery(button) {
  const ui = visibleRoot(button);
  if (!ui) return;
  if (recoverInFlight) {
    show(ui, 'Drive recovery already chal rahi hai…');
    return recoverInFlight;
  }

  show(ui, 'Drive backup check ho raha hai…', false, 12000);
  recoverInFlight = (async () => {
    try {
      const result = await hydrateDriveTrackState();
      const count = Math.max(0, Number(result?.store?.trips?.length) || 0);
      const dayCount = Object.keys(result?.store?.days || {}).length;
      const hasLocal = count > 0 || dayCount > 0;
      if (result?.cloud === true) {
        if (hasLocal) {
          show(ui, `RECOVERED • ${count} trip${count === 1 ? '' : 's'} account backup se load ho gaye.`, false, 7000);
        } else {
          show(ui, 'Cloud connected hai, lekin is account backup me saved Drive trips 0 hain.', true, 8000);
        }
      } else if (hasLocal) {
        show(ui, `LOCAL RECOVERY • ${count} trip${count === 1 ? '' : 's'} phone storage se load hue.`, false, 7000);
      } else if (result?.error) {
        const detail = String(result.error?.message || result.error || 'cloud unavailable').slice(0, 180);
        show(ui, `RECOVER FAILED • ${detail}`, true, 9000);
      } else {
        show(ui, 'Is app storage me Drive backup nahi mila aur cloud restore available nahi hua.', true, 8000);
      }
      window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
      return result;
    } catch (error) {
      const detail = String(error?.message || error || 'unknown recovery error').slice(0, 180);
      show(ui, `RECOVER FAILED • ${detail}`, true, 9000);
      return null;
    } finally {
      recoverInFlight = null;
    }
  })();
  return recoverInFlight;
}

document.addEventListener('click', event => {
  const el = event.target instanceof Element ? event.target : null;
  const target = el?.closest?.('#nxgold14 [data-action="recover"],[data-approved-recover]');
  if (!(target instanceof HTMLElement)) return;
  queueMicrotask(() => runRecovery(target));
}, true);
