import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

function shell(){
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="moreMenu"><button class="more-item" onclick="openMoreTab('browser')" type="button"><span class="mi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></span><span>Browser</span></button></div>
    <main class="main"><section id="tab-browser"><div class="card">Legacy browser placeholder</div></section></main>
    <script>window.openMoreTab=()=>{};</script>
  </body></html>`;
}

function allAppsShell(){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    .tab{display:none}.tab.active{display:block}.more-menu{display:none}.more-menu.show{display:block}.more-inner{display:grid;grid-template-columns:repeat(3,1fr)}
  </style></head><body>
    <div id="nxSplash">Loading NexusNova</div>
    <header class="top-header">NexusNova</header><div class="ticker-wrap">Ticker</div>
    <main class="main">
      <section id="tab-home" class="tab active"><div id="mining-fixture">MINING ACTIVE</div></section>
      <section id="tab-tools" class="tab"><div id="tools-fixture">TOOLS WORKS</div></section>
      <section id="tab-browser" class="tab"><div>Legacy browser placeholder</div></section>
    </main>
    <div id="moreMenu" class="more-menu"><div class="more-inner">
      <button class="more-item" onclick="openMoreTab('tools')" type="button"><span class="mi-icon"></span><span>Tools</span></button>
      <button class="more-item" onclick="openMoreTab('other')" type="button"><span class="mi-icon"></span><span>Other</span></button>
      <button class="more-item" onclick="openMoreTab('browser')" type="button"><span class="mi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></span><span>Browser</span></button>
    </div></div>
    <button id="moreBtn" type="button" onclick="toggleMore()">ALL APPS</button>
    <script>
      window.toggleMore=()=>document.getElementById('moreMenu').classList.toggle('show');
      window.openMoreTab=name=>{
        document.getElementById('moreMenu').classList.remove('show');
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        document.getElementById('tab-'+name)?.classList.add('active');
      };
    </script>
  </body></html>`;
}

async function installBrowserV4(page){
  await page.addScriptTag({url:`${base}/js/nexusnova-browser-v1.js?v=4`});
  await page.waitForFunction(()=>window.__nxNexusBrowserV4===true && window.NexusNovaBrowser?.version==='nexus-browser-v4');
  await page.waitForSelector('[data-nx-browser-window]');
  await page.waitForTimeout(100);
}

async function hookExternalClicks(page){
  await page.evaluate(()=>{
    window.__externalClicks=[];
    HTMLAnchorElement.prototype.click=function(){
      if(this.target==='_blank') window.__externalClicks.push({href:this.href,target:this.target,rel:this.rel});
    };
  });
}

try {
  {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message||String(e)));
    await page.goto(base+'/.runtime-origin.html');
    await page.setContent(shell());
    await hookExternalClicks(page);
    await installBrowserV4(page);

    assert.ok((await page.textContent('#tab-browser h2')).includes('NexusNova Browser'));
    assert.equal(await page.locator('#tab-browser').evaluate(node=>node.classList.contains('nx-browser-shell')),true);
    assert.equal(await page.locator('#nxBrowserFrame').count(),0,'V4 must not restore the broken iframe viewer');
    assert.equal(await page.locator('.nx-browser-toolbar .nx-browser-nav').count(),4);
    assert.equal(await page.locator('.nx-browser-toolbar .nx-browser-nav svg').count(),4);
    assert.ok((await page.getAttribute('#nxBrowserUrl','placeholder')).includes('Search or enter website'));
    assert.equal(await page.locator('.nx-speed-grid [data-nx-speed]').count(),8);
    assert.ok((await page.textContent('#tab-browser')).includes('Speed Dial'));
    assert.ok((await page.textContent('#tab-browser')).includes('WEB PREVIEW'));

    const launcherLabel=await page.locator('#moreMenu .more-item>span:last-child').evaluate(node=>getComputedStyle(node,'::after').content);
    assert.ok(String(launcherLabel).includes('NexusNova'));
    console.log('PASS NexusNova Browser V4 chrome + launcher integration layer');

    await page.fill('#nxBrowserUrl','https://example.com/');
    await page.click('[data-nx-browser-go]');
    let clicks=await page.evaluate(()=>window.__externalClicks);
    assert.equal(clicks.length,0,'Web preview must not automatically redirect to Chrome/new tab');
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('automatic Chrome redirect'));
    assert.ok((await page.textContent('[data-nx-browser-page]')).includes('example.com'));
    assert.equal(await page.locator('[data-nx-explicit-external]').count(),1);
    console.log('PASS web preview no longer auto-redirects to Chrome');

    await page.click('[data-nx-explicit-external]');
    clicks=await page.evaluate(()=>window.__externalClicks);
    assert.equal(clicks.length,1,'External handoff must require an explicit user click');
    assert.equal(clicks[0].href,'https://example.com/');
    assert.equal(clicks[0].target,'_blank');
    assert.ok(clicks[0].rel.includes('noopener'));
    console.log('PASS web preview external opening is explicit only');

    await page.click('[data-nx-browser-home]');
    await page.fill('#nxBrowserUrl','nexusnova test search');
    await page.press('#nxBrowserUrl','Enter');
    assert.equal((await page.evaluate(()=>window.__externalClicks)).length,1);
    assert.ok((await page.inputValue('#nxBrowserUrl')).startsWith('https://www.google.com/search?q='));
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('automatic Chrome redirect'));
    console.log('PASS omnibox search stays in NexusNova web preview without automatic handoff');

    await page.click('[data-nx-browser-home]');
    await page.fill('#nxBrowserUrl','javascript:alert(1)');
    await page.click('[data-nx-browser-go]');
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('Website ya search term'));
    assert.equal((await page.evaluate(()=>window.__externalClicks)).length,1);
    console.log('PASS unsafe schemes are rejected');

    await page.addScriptTag({url:`${base}/js/nexusnova-browser-extensions-v1.js?v=2`});
    await page.waitForFunction(()=>window.NexusNovaBrowserExtensions?.version==='extensions-apps-hub-v2');
    await page.evaluate(()=>window.NexusNovaBrowserExtensions.install());
    await page.waitForSelector('[data-nx-browser-extensions-local]');
    await page.click('[data-nx-browser-extensions-local]');
    await page.waitForSelector('#nxBrowserExtensionsOverlay.open');
    const extText=await page.textContent('#nxBrowserExtensionsOverlay');
    assert.ok(extText.includes('NEXUSNOVA // EXTENSIONS + APPS'));
    assert.ok(extText.includes('Extensions & Apps Hub'));
    assert.ok(extText.includes('Chrome .crx') && extText.includes('cannot execute arbitrary desktop'));

    await page.fill('[data-app-name]','Example App');
    await page.fill('[data-app-url]','https://example.net/');
    await page.click('[data-app-install]');
    assert.ok((await page.textContent('[data-app-install-status]')).includes('installed in NexusNova Browser'));
    assert.equal(await page.locator('[data-nx-installed-apps] [data-app-id]').count(),1);
    console.log('PASS Extensions & Apps Hub remains connected to Browser V4');

    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }

  {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message||String(e)));
    await page.goto(base+'/.runtime-origin.html');
    await page.setContent(shell());
    await page.evaluate(()=>{
      window.__nativeMessages=[];
      window.__externalClicks=[];
      window.NexusBrowserAndroid={postMessage(message){window.__nativeMessages.push(JSON.parse(message));}};
      HTMLAnchorElement.prototype.click=function(){if(this.target==='_blank')window.__externalClicks.push(this.href);};
    });
    await installBrowserV4(page);

    assert.ok((await page.textContent('#tab-browser')).includes('NEXUS NATIVE'));

    /* In the Android app, tapping the ALL APPS launcher must open BrowserActivity directly. */
    await page.click('#moreMenu .more-item');
    let messages=await page.evaluate(()=>window.__nativeMessages);
    assert.equal(messages.length,1);
    assert.deepEqual(messages[0],{action:'open',url:'https://www.google.com/'});

    await page.fill('#nxBrowserUrl','https://www.wikipedia.org/');
    await page.click('[data-nx-browser-go]');
    messages=await page.evaluate(()=>window.__nativeMessages);
    assert.equal(messages.length,2);
    assert.deepEqual(messages[1],{action:'open',url:'https://www.wikipedia.org/'});
    assert.equal((await page.evaluate(()=>window.__externalClicks)).length,0);
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('Chrome redirect nahi'));
    console.log('PASS Android launcher + omnibox route into dedicated NexusNova BrowserActivity without Chrome');

    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }

  {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message||String(e)));
    await page.goto(base+'/.runtime-origin.html');
    await page.setContent(allAppsShell());
    await page.addStyleTag({url:`${base}/css/nexusnova-final-user-fixes-v1.css?v=launcher-test`});
    await page.addScriptTag({url:`${base}/js/nexusnova-allapps-smart-search-v1.js?v=search-first-test`});
    await page.waitForSelector('#nxAllAppsSmartSearch');
    await page.addScriptTag({url:`${base}/js/nexusnova-regional-qibla-browser-v1.js?v=ui-stability-test`});

    /* The intro should be visible long enough to feel intentional. */
    await page.waitForTimeout(900);
    assert.equal(await page.locator('#nxSplash').count(),1,'Splash should still exist at ~0.9 seconds');
    assert.notEqual(await page.locator('#nxSplash').evaluate(el=>getComputedStyle(el).visibility),'hidden','Splash should still be visible at ~0.9 seconds');

    /* Browser V4 must be requested immediately by the bootstrap, not from window.load + timers. */
    await page.waitForFunction(()=>window.__nxNexusBrowserV4===true,{timeout:5000});
    await page.waitForSelector('[data-nx-browser-window]',{state:'attached'});

    await page.click('#moreBtn');
    await page.waitForFunction(()=>document.body.classList.contains('nx-allapps-open'));
    assert.equal(await page.locator('main.main').evaluate(el=>getComputedStyle(el).display),'none','Mining/Home must be hidden while ALL APPS is open');
    assert.equal(await page.locator('#moreMenu').evaluate(el=>getComputedStyle(el).position),'relative','ALL APPS must render as its own screen, not a fixed overlay');

    const searchOrder=Number(await page.locator('#nxAllAppsSmartSearch').evaluate(el=>getComputedStyle(el).order));
    const toolOrder=Number(await page.locator("#moreMenu .more-item[onclick*='tools']").evaluate(el=>getComputedStyle(el).order));
    const browserOrder=Number(await page.locator("#moreMenu .more-item[onclick*='browser']").evaluate(el=>getComputedStyle(el).order));
    assert.ok(searchOrder < toolOrder && toolOrder < browserOrder && browserOrder < 0,'Smart Search must be first, followed by Tools and NexusNova Browser');

    const searchTop=await page.locator('#nxAllAppsSmartSearch').evaluate(el=>el.getBoundingClientRect().top);
    const toolTop=await page.locator("#moreMenu .more-item[onclick*='tools']").evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(searchTop < toolTop,'Smart Search must render above the launcher tiles');

    const browserLabel=await page.locator("#moreMenu .more-item[onclick*='browser']>span:last-child").evaluate(el=>getComputedStyle(el,'::after').content);
    assert.ok(String(browserLabel).includes('NexusNova Browser'),'Browser launcher must use the full NexusNova Browser name');
    assert.notEqual(await page.locator("#moreMenu .more-item[onclick*='browser'] .mi-icon svg").evaluate(el=>getComputedStyle(el).display),'none','Browser globe icon must stay visible');
    const browserBadge=await page.locator("#moreMenu .more-item[onclick*='browser'] .mi-icon").evaluate(el=>getComputedStyle(el,'::after').content);
    assert.ok(String(browserBadge).includes('N'),'Browser icon must include the NexusNova N badge');

    /* Other ALL APPS launchers must still use their original handlers. */
    await page.click("#moreMenu .more-item[onclick*='tools']");
    await page.waitForFunction(()=>document.getElementById('tab-tools')?.classList.contains('active'));
    assert.equal(await page.locator('main.main').evaluate(el=>getComputedStyle(el).display),'block');
    assert.equal(await page.locator('#tools-fixture').isVisible(),true);

    await page.waitForTimeout(1450);
    assert.equal(await page.locator('#nxSplash').count(),0,'Splash should finish after the balanced ~1.8 second intro');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS balanced splash + Search-first ALL APPS + NexusNova Browser launcher + untouched app clicks');
    await page.close();
  }

  console.log('\nNexusNova Browser runtime complete: V4 branding, no automatic Chrome redirect, Extensions Hub, Android routing, balanced splash and Search-first ALL APPS passed.');
} finally {
  await browser.close();
}
