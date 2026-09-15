/* Real app-shell bridge for Fare Lens. Travel is a full-screen product,
   not a child of the generic Discover app header. Preserve only the real
   Travel back control and never touch the global MINE/NOVA HUB dock. */
function repairTravelShell() {
  const stage = document.getElementById('nx-stage');
  const travel = stage?.querySelector('.nxf-travel');
  if (!travel) return false;
  const screen = travel.closest('#nx-stage > .nx-screen');
  if (!screen) return false;

  screen.classList.add('nx-travel-runtime-screen');

  // Remove the legacy generic app wrapper. Its metadata previously rendered
  // "DISCOVER / Travel / Travel planning and live sources" above Fare Lens.
  screen.querySelectorAll(':scope > .nx-app-head').forEach(header => {
    const back = header.querySelector('[data-app-back]');
    if (back && !screen.querySelector(':scope > [data-travel-shell-back]')) {
      back.hidden = false;
      back.removeAttribute('aria-hidden');
      back.dataset.travelShellBack = '1';
      screen.insertBefore(back, screen.firstChild);
    } else if (back) {
      back.remove();
    }
    header.remove();
  });

  // Legacy Smart Travel Context must never reappear inside Fare Lens.
  screen.querySelectorAll('[data-smart-travel-context]').forEach(node => node.remove());
  return true;
}

function installRuntimeGuard() {
  const stage = document.getElementById('nx-stage');
  if (!stage) {
    queueMicrotask(installRuntimeGuard);
    return;
  }
  const observer = new MutationObserver(repairTravelShell);
  observer.observe(stage, { subtree: true, childList: true });
  repairTravelShell();
  let ticks = 0;
  const poll = () => {
    repairTravelShell();
    if (++ticks < 120) setTimeout(poll, 250);
  };
  poll();
}

installRuntimeGuard();
export { repairTravelShell };
