// Nova Drive flagship shell polish v2.
// Narrow post-layer only: keeps working Drive/Tracker logic intact while locking
// the approved three-screen presentation, duration format and navigation cleanup.

const patched = new WeakSet();

function toHhMm(raw) {
  const parts = String(raw || '00:00').trim().split(':').map(v => Math.max(0, Number(v) || 0));
  if (parts.length >= 3) {
    const [h, m] = parts.slice(-3, -1);
    return `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(m)).padStart(2,'0')}`;
  }
  if (parts.length === 2) {
    // The legacy Drive runtime exposes MM:SS while the approved card is HH:MM.
    const [minutes] = parts;
    const totalMinutes = Math.floor(minutes);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2,'0')}:${String(totalMinutes % 60).padStart(2,'0')}`;
  }
  const totalMinutes = Math.floor(parts[0] || 0);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2,'0')}:${String(totalMinutes % 60).padStart(2,'0')}`;
}

function installStyle() {
  if (document.querySelector('[data-nxfs-polish-v2-style]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-nxfs-polish-v2-style>
    .nxfs-shell{height:100%!important;min-height:0!important;max-height:100%!important;align-content:stretch!important}
    .nxfs-body,.nxfs-screen,.nxfs-hero{min-height:0!important}
    .nxfs-shell button{-webkit-tap-highlight-color:transparent;outline-offset:-2px}

    /* Crop the photographed phone/bezel away while preserving one proportional
       image scale. object-fit:cover never stretches X/Y independently. */
    .nxfs-dashboard .nxfs-hero-art{inset:-10% -8%!important;width:116%!important;height:120%!important;object-fit:cover!important;object-position:center 47%!important;transform:none!important}
    .nxfs-tracking .nxfs-hero-art{inset:-12% -10%!important;width:120%!important;height:124%!important;object-fit:cover!important;object-position:center 48%!important;transform:none!important}

    /* Keep every interactive state clean: one active filter only, no painted
       halo outside the button bounds and no doubled browser focus ring. */
    .nxfs-filter,.nxfs-tab,.nxfs-navbtn{overflow:hidden!important}
    .nxfs-filter:focus:not(:focus-visible),.nxfs-tab:focus:not(:focus-visible),.nxfs-navbtn:focus:not(:focus-visible){outline:none!important}
    .nxfs-filter.is-active{box-shadow:inset 0 0 0 1px rgba(185,247,255,.28),inset 0 0 14px rgba(75,225,255,.20),0 0 9px rgba(0,174,255,.16)!important}

    /* The shell itself owns the viewport: no visual holes above the Android nav. */
    .nxfs-brand,.nxfs-nav{margin:0!important;align-self:stretch!important}
    .nxfs-toast{max-width:calc(100% - 24px)!important}
  </style>`);
}

function syncPressed(shell) {
  const activeScreen = shell.querySelector('[data-nxfs-screen].is-active')?.dataset?.nxfsScreen || 'dashboard';
  shell.querySelectorAll('[data-nxfs-screen-btn]').forEach(btn => {
    const on = (activeScreen === 'dashboard' && btn.dataset.nxfsScreenBtn === 'dashboard') ||
      (activeScreen === 'history' && btn.dataset.nxfsScreenBtn === 'history');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  shell.querySelectorAll('[data-nxfs-filter]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('is-active') ? 'true' : 'false');
  });
  shell.querySelectorAll('[data-nxfs-nav]').forEach(btn => {
    btn.setAttribute('aria-current', btn.classList.contains('is-active') ? 'page' : 'false');
  });
}

function patch(shell) {
  if (!(shell instanceof HTMLElement) || patched.has(shell)) return;
  patched.add(shell);
  installStyle();

  const duration = shell.querySelector('[data-nxfs-duration]');
  let correctingDuration = false;
  const correctDuration = () => {
    if (!(duration instanceof HTMLElement) || correctingDuration) return;
    const fixed = toHhMm(duration.textContent);
    if (duration.textContent === fixed) return;
    correctingDuration = true;
    duration.textContent = fixed;
    correctingDuration = false;
  };
  correctDuration();
  if (duration) new MutationObserver(correctDuration).observe(duration, { childList:true, subtree:true, characterData:true });

  const toast = shell.querySelector('[data-nxfs-toast]');
  // Guard the class write. Calling classList.remove() on every observed class
  // mutation can itself emit another mutation on Chromium and form a feedback
  // loop while History/Tracking is active.
  const hideToast = () => {
    if (toast?.classList.contains('is-show')) toast.classList.remove('is-show');
  };
  shell.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-nxfs-screen-btn],[data-nxfs-nav],[data-nxfs-hub]') : null;
    if (target) queueMicrotask(hideToast);
  }, true);

  const enforceOneFilter = () => {
    const active = [...shell.querySelectorAll('[data-nxfs-filter].is-active')];
    if (active.length <= 1) return;
    active.slice(1).forEach(node => node.classList.remove('is-active'));
  };

  const stateObserver = new MutationObserver(() => {
    enforceOneFilter();
    syncPressed(shell);
    const current = shell.querySelector('[data-nxfs-screen].is-active')?.dataset?.nxfsScreen;
    if (current !== 'dashboard') hideToast();
  });
  stateObserver.observe(shell, { attributes:true, subtree:true, attributeFilter:['class'] });
  enforceOneFilter();
  syncPressed(shell);
}

function scan(root = document) {
  if (root instanceof HTMLElement) {
    if (root.matches('[data-nxfs-shell]')) patch(root);
    root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch);
  } else {
    root.querySelectorAll?.('[data-nxfs-shell]').forEach(patch);
  }
}

scan();
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node instanceof HTMLElement) scan(node);
}))).observe(document.documentElement, { childList:true, subtree:true });
