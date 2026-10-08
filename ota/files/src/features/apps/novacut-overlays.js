/* NovaCut built-in sticker asset registry. Assets are local SVG data URLs. */
export const NOVACUT_STICKERS = Object.freeze([
  { id: 'smile', label: 'Smile', glyph: '😀', bg: '#ffe66d' },
  { id: 'love', label: 'Love', glyph: '❤️', bg: '#ff6b81' },
  { id: 'fire', label: 'Fire', glyph: '🔥', bg: '#ff9f43' },
  { id: 'star', label: 'Star', glyph: '⭐', bg: '#feca57' },
  { id: 'cool', label: 'Cool', glyph: '😎', bg: '#54a0ff' },
  { id: 'laugh', label: 'Laugh', glyph: '😂', bg: '#f6c445' },
  { id: 'check', label: 'Check', glyph: '✅', bg: '#2ecc71' },
  { id: 'wow', label: 'Wow', glyph: '😮', bg: '#a66cff' }
]);
function escapeXml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
export function stickerSvg(sticker) {
  const item = sticker || NOVACUT_STICKERS[0];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256">' +
    '<circle cx="128" cy="128" r="112" fill="' + escapeXml(item.bg || '#1f2937') + '" opacity=".95"/>' +
    '<text x="128" y="143" text-anchor="middle" dominant-baseline="middle" font-size="122">' +
    escapeXml(item.glyph || '★') + '</text></svg>';
}
export function stickerAssetUrl(sticker) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stickerSvg(sticker));
}
function waitForImage(image, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (image.complete && (image.naturalWidth || image.width)) return resolve(image);
    let timer = window.setTimeout(() => { cleanup(); reject(new Error('NovaCut sticker decode timed out.')); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); image.removeEventListener('load', onLoad); image.removeEventListener('error', onError); };
    const onLoad = () => { cleanup(); resolve(image); };
    const onError = () => { cleanup(); reject(new Error('NovaCut could not decode sticker asset.')); };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
  });
}
export async function loadNovaCutImageAsset(asset) {
  if (typeof HTMLImageElement !== 'undefined' && asset instanceof HTMLImageElement) return asset;
  const image = new Image();
  image.decoding = 'async';
  image.src = String(asset || '');
  return waitForImage(image, 10000);
}