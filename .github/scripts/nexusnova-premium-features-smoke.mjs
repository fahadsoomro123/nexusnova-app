import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message || String(error)));

try {
  await page.goto(base + '/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    .nx-ayah,.nx-bible-verse{display:block;padding:4px}.nx-scripture-filtered{display:none!important}
  </style></head><body>
    <section id="tab-mega-islamic">
      <div class="nx-scripture-controls"><select id="nxQuranSurah"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select><button id="nxQuranLoad" type="button">Load Quran</button></div>
      <div id="nxQuranReader"><div class="nx-ayah">Arabic alpha • Urdu pehla</div><div class="nx-ayah">Arabic beta • Urdu doosra</div></div>
      <div class="nx-scripture-controls"><input id="nxBukhariNo" value="7"><button id="nxBukhariLoad" type="button">Load Bukhari</button></div>
    </section>
    <section id="tab-bible">
      <button id="nxBibleOpen" type="button">Open Bible</button>
      <div id="nxBibleReader"><div class="nx-bible-verse">In the beginning</div><div class="nx-bible-verse">Second verse text</div></div>
    </section>
    <section id="tab-entertainment"><div class="card"><div class="hub-hero"><h2>Entertainment</h2></div><div class="entertainment-grid"></div></div></section>
    <section id="tab-about"></section>
  </body></html>`);

  await page.evaluate(() => {
    window.__quranLoadClicks = 0;
    document.getElementById('nxQuranLoad').addEventListener('click', () => { window.__quranLoadClicks += 1; });
    window.__openedUrls = [];
    window.open = url => { window.__openedUrls.push(String(url)); return {opener:null}; };
    window.sendPasswordReset = () => 'legacy-reset';
    window.refreshEmailVerification = () => 'legacy-refresh';
    window.resendEmailVerification = () => 'legacy-resend';
    window.clearNexusAIData = () => 'legacy-clear';
    window.requestNexusLocation = () => 'legacy-location';
    window.checkNexusCamera = () => 'legacy-camera';
    window.checkNexusMicrophone = () => 'legacy-mic';
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-premium-ui-v1.js?v=1`});
  await page.addScriptTag({url:`${base}/js/nexusnova-scripture-reader-polish-v1.js?v=1`});
  await page.addScriptTag({url:`${base}/js/nexusnova-entertainment-live-v1.js?v=1`});
  await page.addScriptTag({url:`${base}/js/nexusnova-settings-premium-dialogs-v1.js?v=1`});

  await page.waitForSelector('#nxQuranFindPolish');
  await page.waitForSelector('#nxBibleFindPolish');
  await page.waitForSelector('#nxQuranPrevPolish');
  await page.waitForSelector('#nxQuranNextPolish');
  await page.waitForSelector('#nxBukhariLastPolish');
  await page.waitForSelector('#nxEntertainmentDiscover');

  // Quran current-Surah search/filter.
  await page.fill('#nxQuranFindPolish','doosra');
  await page.waitForFunction(() => document.querySelectorAll('#nxQuranReader .nx-scripture-filtered').length === 1);
  const quranState = await page.evaluate(() => ({
    hidden:document.querySelectorAll('#nxQuranReader .nx-scripture-filtered').length,
    found:document.getElementById('nxQuranFindCount')?.textContent || ''
  }));
  assert.equal(quranState.hidden,1,'Quran search must filter non-matching ayahs');
  assert.match(quranState.found,/1 found/i);

  // Quran next navigation must change the existing selector and reuse the existing load button.
  await page.click('#nxQuranNextPolish');
  const quranNav = await page.evaluate(() => ({
    value:document.getElementById('nxQuranSurah').value,
    clicks:window.__quranLoadClicks
  }));
  assert.equal(quranNav.value,'2');
  assert.equal(quranNav.clicks,1);

  // Bible current-chapter search/filter.
  await page.fill('#nxBibleFindPolish','second');
  await page.waitForFunction(() => document.querySelectorAll('#nxBibleReader .nx-scripture-filtered').length === 1);
  assert.match(await page.textContent('#nxBibleFindCount'),/1 found/i);

  // Entertainment discovery must preserve provider handoff rather than fake embedded playback.
  await page.fill('#nxEntertainmentQuery','NexusNova trailer');
  await page.selectOption('#nxEntertainmentProvider','imdb');
  await page.click('#nxEntertainmentSearchBtn');
  const entertainment = await page.evaluate(() => ({
    urls:window.__openedUrls,
    recent:JSON.parse(localStorage.getItem('nexusnova_entertainment_recent_v1') || '[]')
  }));
  assert.equal(entertainment.urls.length,1);
  assert.match(entertainment.urls[0],/^https:\/\/www\.imdb\.com\/find\/\?q=/);
  assert.equal(entertainment.recent[0]?.q,'NexusNova trailer');
  assert.equal(entertainment.recent[0]?.provider,'imdb');

  // Settings late layer must own the legacy alert/confirm actions without touching profile editing.
  const settings = await page.evaluate(() => ({
    reset:String(window.sendPasswordReset),
    refresh:String(window.refreshEmailVerification),
    resend:String(window.resendEmailVerification),
    clear:String(window.clearNexusAIData),
    location:String(window.requestNexusLocation),
    camera:String(window.checkNexusCamera),
    mic:String(window.checkNexusMicrophone)
  }));
  for (const [name,source] of Object.entries(settings)) {
    assert.ok(!source.includes('legacy-'),`Settings premium takeover missing: ${name}`);
  }

  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  console.log('PASS premium feature regression — Scripture reader, Entertainment discovery and Settings dialog takeover verified.');
} finally {
  await browser.close();
}
