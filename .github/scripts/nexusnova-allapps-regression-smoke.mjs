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
    .more-menu{display:none}.more-menu.show{display:block}.tab{display:none}.tab.active{display:block}
    .bottom-dock{display:flex}.dock-item.active{font-weight:700}
  </style></head><body>
    <main class="main">
      <section id="tab-home" class="tab active"><div class="card"><h3>Home</h3></div></section>
      <section id="tab-mega-teacher" class="tab">
        <div class="card"><h3>Teacher Toolkit</h3><label>University / College</label><select><option>University A</option></select><div id="teacherResult" class="tool-result">Ready</div></div>
      </section>
    </main>
    <div id="moreMenu" class="more-menu"><div class="more-inner">
      <button class="more-item" data-nxmega="mega-teacher" onclick="openMoreTab('mega-teacher')" type="button"><span>TEACHER TOOLKIT</span></button>
    </div></div>
    <nav class="bottom-dock">
      <button class="dock-item active" type="button">Home</button><button class="dock-item" type="button">Wallet</button><button class="dock-item" type="button">Tasks</button><button class="dock-item" type="button">Market</button><button id="moreBtn" class="dock-item" type="button">ALL APPS</button>
    </nav>
  </body></html>`);

  await page.evaluate(() => {
    window.openMoreTab = function(name) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.getElementById('tab-' + name)?.classList.add('active');
      document.getElementById('moreMenu')?.classList.remove('show');
      return true;
    };
    window.switchTab = window.openMoreTab;
    window.toggleMore = function() {
      document.getElementById('moreMenu')?.classList.toggle('show');
    };
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-premium-ui-v1.js?v=1`});
  await page.addScriptTag({url:`${base}/js/nexusnova-allapps-order-guard-v5.js`});
  await page.addScriptTag({url:`${base}/js/nexusnova-allapps-experience-v2.js?v=3`});
  await page.addScriptTag({url:`${base}/js/nexusnova-allapps-visual-polish-v1.js?v=1`});

  // These controls are intentionally inside a hidden feature tab at startup.
  // Verify that they were attached to the DOM, not that the unopened tab is visible.
  await page.waitForSelector('#tab-mega-teacher > .nx-allapps-back', {state:'attached'});
  await page.waitForSelector('#tab-mega-teacher > .nx-app-hero', {state:'attached'});

  await page.evaluate(() => window.toggleMore());
  assert.equal(await page.evaluate(() => document.body.classList.contains('nx-allapps-open')), true);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('moreMenu')).display), 'none');

  await page.click('#moreMenu .more-item');
  await page.waitForFunction(() => document.getElementById('tab-mega-teacher')?.classList.contains('active'));
  assert.equal(await page.evaluate(() => document.body.classList.contains('nx-allapps-open')), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('moreMenu')).display), 'none');
  assert.ok(await page.$('#tab-mega-teacher .nx-app-hero'));
  await page.waitForSelector('#tab-mega-teacher label .nxv-field-icon');

  await page.click('#tab-mega-teacher .nx-allapps-back button');
  await page.waitForFunction(() => document.body.classList.contains('nx-allapps-open'));

  const state = await page.evaluate(() => {
    const feature = document.getElementById('tab-mega-teacher');
    const menu = document.getElementById('moreMenu');
    const f = getComputedStyle(feature);
    const m = getComputedStyle(menu);
    return {
      menuDisplay:m.display,
      menuVisibility:m.visibility,
      featureDisplay:f.display,
      featureVisibility:f.visibility,
      featureOpacity:f.opacity,
      allAppsOpen:document.body.classList.contains('nx-allapps-open'),
      moreActive:document.getElementById('moreBtn')?.classList.contains('active') || false
    };
  });

  assert.equal(state.allAppsOpen,true,'ALL APPS state must remain active after Back');
  assert.notEqual(state.menuDisplay,'none','ALL APPS menu must be visible after Back');
  assert.notEqual(state.menuVisibility,'hidden','ALL APPS menu must not be hidden after Back');
  assert.equal(state.featureDisplay,'none','previous feature must not remain visible behind ALL APPS');
  assert.equal(state.featureVisibility,'hidden','previous feature visibility must be isolated while ALL APPS is open');
  assert.equal(state.moreActive,true,'ALL APPS dock item must be active after Back');
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));

  console.log('PASS ALL APPS regression — clean Back isolation + semantic visual icon verified.');
} finally {
  await browser.close();
}
