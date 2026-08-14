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
    console.log('PASS NexusNova Browser V4 chrome + red NexusNova launcher branding');

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
    await page.waitForSelector('[data-nx-browser-extensions]');
    await page.click('[data-nx-browser-extensions]');
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

  console.log('\nNexusNova Browser runtime complete: V4 branding, no automatic Chrome redirect, explicit web fallback, Extensions Hub and native Android routing passed.');
} finally {
  await browser.close();
}
