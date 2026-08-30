/* NexusNova Mining Immersive v1
   Presentation-only interaction layer for the mining dashboard.
   Adds pointer-driven lighting, subtle 3D parallax and tactile visual feedback.
   It never reads/writes Firebase, rewards, balances, mining timestamps or ads. */
(() => {
  'use strict';
  if (window.__nxMiningImmersiveV1) return;
  window.__nxMiningImmersiveV1 = true;
  window.nexusMiningImmersiveVersion = 'mining-immersive-v1';

  const STYLE_ID = 'nxMiningImmersiveV1Style';
  const HOME_ID = 'tab-home';
  const finePointer = matchMedia('(pointer:fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${HOME_ID}.nx-mining-immersive-v1{
        --nx-ix:50%;--nx-iy:24%;--nx-rx:0deg;--nx-ry:0deg;
        isolation:isolate;
      }
      #${HOME_ID}.nx-mining-immersive-v1:before{
        content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
        background:radial-gradient(circle at var(--nx-ix) var(--nx-iy),rgba(76,194,255,.12),transparent 29%);
        mix-blend-mode:screen;opacity:.85;transition:opacity .22s ease;
      }
      #${HOME_ID}.nx-mining-immersive-v1>.card:first-child,
      #${HOME_ID}.nx-mining-immersive-v1 .stat-card,
      #${HOME_ID}.nx-mining-immersive-v1 #nxMiningSessionPulseV2,
      #${HOME_ID}.nx-mining-immersive-v1 #nxHalvingFomoV1{
        transform-style:preserve-3d!important;
        will-change:transform;
      }
      @media(pointer:fine) and (prefers-reduced-motion:no-preference){
        #${HOME_ID}.nx-mining-immersive-v1>.card:first-child{
          transform:perspective(900px) rotateX(calc(var(--nx-rx) * .34)) rotateY(calc(var(--nx-ry) * .34)) translateZ(10px)!important;
          transition:transform .14s ease-out!important;
        }
        #${HOME_ID}.nx-mining-immersive-v1 .stat-card{
          transform:perspective(860px) rotateX(calc(var(--nx-rx) * .24)) rotateY(calc(var(--nx-ry) * .24)) translateZ(12px)!important;
          transition:transform .16s ease-out,box-shadow .2s ease!important;
        }
        #${HOME_ID}.nx-mining-immersive-v1 #nxMiningSessionPulseV2,
        #${HOME_ID}.nx-mining-immersive-v1 #nxHalvingFomoV1{
          transform:perspective(920px) rotateX(calc(var(--nx-rx) * .15)) rotateY(calc(var(--nx-ry) * .15)) translateZ(10px)!important;
          transition:transform .18s ease-out!important;
        }
      }
      #mineBtn .nx-mining-touch-ripple{
        position:absolute;z-index:2;width:18px;height:18px;border-radius:50%;pointer-events:none;
        background:radial-gradient(circle,rgba(255,255,255,.72) 0%,rgba(137,222,255,.34) 34%,transparent 72%);
        transform:translate(-50%,-50%) scale(.2);opacity:0;
        animation:nxMiningTouchRipple .54s cubic-bezier(.2,.72,.2,1) forwards;
      }
      #mineBtn.nx-mining-contact{
        filter:saturate(1.08) brightness(1.04)!important;
      }
      @keyframes nxMiningTouchRipple{
        0%{opacity:.72;transform:translate(-50%,-50%) scale(.2)}
        60%{opacity:.30}
        100%{opacity:0;transform:translate(-50%,-50%) scale(10)}
      }
      @media(prefers-reduced-motion:reduce){
        #${HOME_ID}.nx-mining-immersive-v1:before{display:none}
        #mineBtn .nx-mining-touch-ripple{animation:none!important;display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function setNeutral(home) {
    home.style.setProperty('--nx-ix', '50%');
    home.style.setProperty('--nx-iy', '24%');
    home.style.setProperty('--nx-rx', '0deg');
    home.style.setProperty('--nx-ry', '0deg');
  }

  function installParallax(home) {
    if (!finePointer || reduceMotion) return;
    home.addEventListener('pointermove', event => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = home.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        const rx = (0.5 - y) * 5.2;
        const ry = (x - 0.5) * 6.4;
        home.style.setProperty('--nx-ix', `${(x * 100).toFixed(2)}%`);
        home.style.setProperty('--nx-iy', `${(y * 100).toFixed(2)}%`);
        home.style.setProperty('--nx-rx', `${rx.toFixed(2)}deg`);
        home.style.setProperty('--nx-ry', `${ry.toFixed(2)}deg`);
      });
    }, { passive: true });
    home.addEventListener('pointerleave', () => setNeutral(home), { passive: true });
  }

  function installTouchFeedback(button) {
    button.addEventListener('pointerdown', event => {
      button.classList.add('nx-mining-contact');
      if (!reduceMotion) {
        const rect = button.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'nx-mining-touch-ripple';
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 620);
      }
    }, { passive: true });
    const release = () => button.classList.remove('nx-mining-contact');
    button.addEventListener('pointerup', release, { passive: true });
    button.addEventListener('pointercancel', release, { passive: true });
    button.addEventListener('pointerleave', release, { passive: true });
  }

  function boot() {
    installStyle();
    const home = document.getElementById(HOME_ID);
    const button = document.getElementById('mineBtn');
    if (!home || !button) return;
    if (home.dataset.nxMiningImmersive === '1') return;
    home.dataset.nxMiningImmersive = '1';
    home.classList.add('nx-mining-immersive-v1');
    setNeutral(home);
    installParallax(home);
    installTouchFeedback(button);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
