import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

function shell(){
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="moreMenu"><button class="more-item"><span>BROWSER</span></button></div>
    <main class="main"><section id="tab-browser"><div class="card">Legacy browser placeholder</div></section></main>
  </body></html>`;
}

async function installBrowserV3(page){
  await page.addScriptTag({url:`${base}/js/nexusnova-browser-v1.js?v=3`});
  await page.waitForFunction(()=>window.__nxNexusBrowserV3===true && window.NexusNovaBrowser?.version==='nexus-browser-v3');
  await page.waitForSelector('[data-nx-browser-toolbar]');
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
    await installBrowserV3(page);

    assert.ok((await page.textContent('#tab-browser h2')).includes('NexusNova Browser'));
    assert.equal(await page.locator('#tab-browser').evaluate(node=>node.classList.contains('nx-browser-shell')),true);
    assert.equal(await page.locator('#nxBrowserFrame').count(),0,'V3 must not restore the broken iframe viewer');
    assert.equal(await page.locator('[data-nx-browser-toolbar] .nx-browser-nav').count(),4);
    assert.equal(await page.locator('[data-nx-browser-toolbar] .nx-browser-nav svg').count(),4);
    assert.ok((await page.getAttribute('#nxBrowserUrl','placeholder')).includes('Search or enter website'));
    assert.equal(await page.locator('.nx-speed-grid [data-nx-speed]').count(),8);
    assert.ok((await page.textContent('#tab-browser')).includes('Speed Dial'));
    assert.ok((await page.textContent('#tab-browser')).includes('REAL PAGE • NEW TAB'));
    console.log('PASS NexusNova Browser V3 full browser chrome, Speed Dial and non-iframe start page');

    await page.fill('#nxBrowserUrl','https://example.com/');
    await page.click('[data-nx-browser-go]');
    let clicks=await page.evaluate(()=>window.__externalClicks);
    assert.equal(clicks.length,1);
    assert.equal(clicks[0].href,'https://example.com/');
    assert.equal(clicks[0].target,'_blank');
    assert.ok(clicks[0].rel.includes('noopener'));
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('real browser tab'));
    console.log('PASS web/PWA routing opens a real top-level browser tab instead of blocked iframe');

    await page.fill('#nxBrowserUrl','nexusnova test search');
    await page.press('#nxBrowserUrl','Enter');
    clicks=await page.evaluate(()=>window.__externalClicks);
    assert.equal(clicks.length,2);
    assert.ok(clicks[1].href.startsWith('https://www.google.com/search?q='));
    console.log('PASS omnibox supports web search');

    await page.fill('#nxBrowserUrl','javascript:alert(1)');
    await page.click('[data-nx-browser-go]');
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('Website ya search term'));
    assert.equal((await page.evaluate(()=>window.__externalClicks)).length,2);
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
    console.log('PASS Extensions & Apps Hub remains connected to Browser V3');

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
    await installBrowserV3(page);

    assert.ok((await page.textContent('#tab-browser')).includes('ANDROID ENGINE'));
    assert.ok((await page.textContent('#tab-browser')).includes('NEXUS NATIVE'));
    await page.fill('#nxBrowserUrl','https://www.google.com/');
    await page.click('[data-nx-browser-go]');
    const messages=await page.evaluate(()=>window.__nativeMessages);
    assert.equal(messages.length,1);
    assert.deepEqual(messages[0],{action:'open',url:'https://www.google.com/'});
    assert.equal((await page.evaluate(()=>window.__externalClicks)).length,0);
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('Android Browser'));
    console.log('PASS Android mode routes into dedicated NexusNova Browser Activity without external handoff');

    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }

  console.log('\nNexusNova Browser runtime complete: V3 browser chrome, real web routing, Extensions & Apps and Android native routing passed.');
} finally {
  await browser.close();
}
