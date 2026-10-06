const dock = document.querySelector('.nx-dock');

if (dock instanceof HTMLElement) {
  let lastY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  let ticking = false;

  const currentY = () => Math.max(
    0,
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );

  const update = () => {
    ticking = false;
    const y = currentY();
    const delta = y - lastY;

    if (y <= 8) {
      dock.classList.remove('nx-dock--scroll-away');
    } else if (delta > 5) {
      dock.classList.add('nx-dock--scroll-away');
    } else if (delta < -5) {
      dock.classList.remove('nx-dock--scroll-away');
    }

    lastY = y;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });

  dock.addEventListener('focusin', () => dock.classList.remove('nx-dock--scroll-away'));
  window.addEventListener('hashchange', () => dock.classList.remove('nx-dock--scroll-away'));
}
