// Nova Drive flagship clean presentation v3.
// Presentation-only layer: keep live Drive/Tracker logic and controls intact,
// but stop raster screenshots from double-painting telemetry/cards/actions.
// The original bundled approved raster is cropped once in-memory; no AI asset,
// no phone-frame strip, no clip-path and no X/Y stretching.

const cropped = new WeakSet();

function installStyle(){
  if (document.querySelector('[data-nxfs-clean-v3-style]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-nxfs-clean-v3-style>
    .nxfs-dashboard .nxfs-hero{
      background:radial-gradient(circle at 50% 44%,#09233a 0,#04131f 38%,#020b13 68%,#01060b 100%)!important;
      overflow:hidden!important;
    }
    .nxfs-tracking .nxfs-hero{
      background:radial-gradient(circle at 50% 43%,#082139 0,#03131f 47%,#020a12 74%,#01060b 100%)!important;
      overflow:hidden!important;
    }

    /* Once cropped, the image is a square gauge/map asset. Contain uses one
       proportional scale and therefore cannot rubber-stretch the artwork. */
    .nxfs-dashboard .nxfs-hero-art,
    .nxfs-tracking .nxfs-hero-art{
      inset:0!important;
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      clip-path:none!important;
      -webkit-clip-path:none!important;
      filter:saturate(1.08) contrast(1.05) brightness(.97)!important;
      pointer-events:none!important;
    }

    /* Dynamic overlays are the single source of truth and sit on opaque glass,
       so no raster text can bleed through below real telemetry. */
    .nxfs-speed-core,.nxfs-glass,.nxfs-track-card{
      isolation:isolate!important;
      backdrop-filter:none!important;
      -webkit-backdrop-filter:none!important;
    }
    .nxfs-speed-core{
      background:radial-gradient(circle,#020b14 0 67%,rgba(2,11,20,.99) 68% 75%,transparent 76%)!important;
    }
    .nxfs-glass{
      background:linear-gradient(180deg,#061a2a 0%,#020b13 100%)!important;
      box-shadow:inset 0 0 18px rgba(54,198,255,.045),0 6px 16px rgba(0,0,0,.32)!important;
    }
    .nxfs-track-card{
      background:linear-gradient(180deg,#061a2a 0%,#020b13 100%)!important;
      box-shadow:inset 0 0 18px rgba(54,198,255,.045),0 6px 16px rgba(0,0,0,.30)!important;
    }
  </style>`);
}

function cropRaster(img, spec){
  if (!(img instanceof HTMLImageElement) || cropped.has(img)) return;
  cropped.add(img);
  img.dataset.nxfsCleanCrop = 'pending';

  const run = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    try {
      const sx = Math.round(spec.x * img.naturalWidth / spec.baseW);
      const sy = Math.round(spec.y * img.naturalHeight / spec.baseH);
      const sw = Math.round(spec.w * img.naturalWidth / spec.baseW);
      const sh = Math.round(spec.h * img.naturalHeight / spec.baseH);
      if (sx < 0 || sy < 0 || sw < 2 || sh < 2 || sx + sw > img.naturalWidth || sy + sh > img.naturalHeight) throw new Error('crop-bounds');
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d', { alpha:false });
      if (!ctx) throw new Error('canvas-context');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      img.dataset.nxfsCleanCrop = 'done';
      img.src = canvas.toDataURL('image/png');
    } catch (_err) {
      // Never fall back to the photographed full-phone raster. If a device
      // cannot crop it, keep the clean HTML shell rather than double-paint UI.
      img.dataset.nxfsCleanCrop = 'failed';
      img.style.opacity = '0';
    }
  };

  if (img.complete && img.naturalWidth) run();
  else img.addEventListener('load', run, { once:true });
}

function patchShell(shell){
  if (!(shell instanceof HTMLElement)) return;
  const drive = shell.querySelector('.nxfs-dashboard .nxfs-hero-art');
  const tracker = shell.querySelector('.nxfs-tracking .nxfs-hero-art');
  // Exact measured crops from the bundled approved source assets.
  cropRaster(drive, { x:205, y:270, w:456, h:456, baseW:864, baseH:1472 });
  cropRaster(tracker, { x:173, y:328, w:595, h:595, baseW:941, baseH:1672 });
}

function scan(root=document){
  if (root instanceof HTMLElement) {
    if (root.matches('[data-nxfs-shell]')) patchShell(root);
    root.querySelectorAll?.('[data-nxfs-shell]').forEach(patchShell);
  } else {
    root.querySelectorAll?.('[data-nxfs-shell]').forEach(patchShell);
  }
}

installStyle();
scan();
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node instanceof HTMLElement) scan(node);
}))).observe(document.documentElement, { childList:true, subtree:true });
