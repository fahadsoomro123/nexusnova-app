import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 393, height: 873 } });
page.setDefaultTimeout(2500);

const errors = [];
page.on('pageerror', error => errors.push(error.message || String(error)));

try {
  await page.goto(`${origin}/.runtime-origin.html`, { waitUntil: 'domcontentloaded' });
  await page.setContent(`<!doctype html><html><body>
    <section id="tab-tasks">
      <button id="legacyWatchAd" onclick="watchAdReward()">WATCH AD (+2.5 NVX)</button>
      <button id="touchProbe" type="button">TOUCH PROBE</button>
      <div id="mutationHost"></div>
    </section>
  </body></html>`);

  await page.evaluate(() => {
    window.__nativeAdMessages = [];
    window.__touchProbeCount = 0;
    window.NexusAndroid = {
      postMessage(raw) {
        window.__nativeAdMessages.push(JSON.parse(String(raw)));
      }
    };
    document.getElementById('touchProbe').addEventListener('click', () => {
      window.__touchProbeCount += 1;
    });
  });

  await page.addScriptTag({ url: `${origin}/js/nexusnova-watch-ad-reward-v1.js?v=android-touch-freeze-regression` });
  await page.waitForFunction(() => window.__nxWatchAdRewardVersion === 'watch-ad-reward-v1.1');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {
      detail: {
        event: 'status',
        provider: 'admob',
        testMode: true,
        ssvIdentityReady: true
      }
    }));
  });
  await page.waitForFunction(() => /TEST MODE/i.test(document.getElementById('nxWatchAdRewardHint')?.textContent || ''));

  // Reproduce the old failure trigger: unrelated child-list mutations after the
  // Watch Ad controller has booted. The previous document-wide observer rewrote
  // hint.textContent from its own callback and could enter an endless microtask
  // loop, starving Android WebView touch processing.
  await page.evaluate(() => {
    const host = document.getElementById('mutationHost');
    for (let i = 0; i < 40; i += 1) {
      const node = document.createElement('span');
      node.textContent = String(i);
      host.appendChild(node);
      node.remove();
    }
    window.__nxHeartbeat = 0;
    const timer = setInterval(() => {
      window.__nxHeartbeat += 1;
      if (window.__nxHeartbeat >= 6) clearInterval(timer);
    }, 25);
  });

  await page.waitForFunction(() => window.__nxHeartbeat >= 6, null, { timeout: 1500 });
  await page.locator('#touchProbe').click({ timeout: 1200 });
  await page.waitForFunction(() => window.__touchProbeCount === 1, null, { timeout: 1200 });

  const state = await page.evaluate(() => ({
    version: window.__nxWatchAdRewardVersion,
    hint: document.getElementById('nxWatchAdRewardHint')?.textContent || '',
    heartbeat: window.__nxHeartbeat,
    probe: window.__touchProbeCount,
    native: window.__nativeAdMessages.slice()
  }));

  assert.equal(state.version, 'watch-ad-reward-v1.1');
  assert.match(state.hint, /TEST MODE/i);
  assert.ok(state.heartbeat >= 6, 'Event loop must stay alive after Watch Ad decoration');
  assert.equal(state.probe, 1, 'Unrelated buttons must remain clickable after Watch Ad boot');
  assert.ok(state.native.some(message => message.action === 'adStatus'), 'Watch Ad should still request native capability status');
  assert.equal(errors.length, 0, errors.join('\n'));

  console.log('Watch Ad Android touch runtime: PASS — no self-triggering DOM observer loop; event loop and taps stay responsive.');
} finally {
  await browser.close();
}
