import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

function shell(){
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="moreMenu"><button class="more-item"><span>BROWSER</span></button></div>
    <section id="tab-browser">
      <div class="card">
        <div class="hub-hero"><div><div class="hub-kicker">NEXUS BROWSER</div><h2><span class="mi-icon">◎</span> Built-in Web Viewer</h2><p>Old copy</p></div><div class="hub-orb">◎</div></div>
        <div class="tool-row"><input id="nxBrowserUrl" value="https://example.com/"><button id="oldGo" onclick="nxBrowse()">Go</button></div>
        <div class="browser-links"><button id="preset" onclick="nxBrowsePreset('https://example.org/')">Example preset</button></div>
        <div class="browser-frame-wrap"><iframe id="nxBrowserFrame" src="about:blank"></iframe></div>
        <div id="nxBrowserStatus">Old status</div>
        <button id="external" onclick="nxOpenBrowserExternal()">Open externally</button>
      </div>
    </section>
  </body></html>`;
}

async function installBrowserV2(page){
  await page.addScriptTag({url:`${base}/js/nexusnova-browser-v1.js?v=2`});
  await page.waitForFunction(()=>window.__nxNexusBrowserV2===true && window.NexusNovaBrowser?.version==='in-app-browser-v2');
  await page.waitForSelector('[data-nx-browser-toolbar]');
  await page.waitForTimeout(120);
}

try {
  {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message||String(e)));
    await page.goto(base+'/.runtime-origin.html');
    await page.setContent(shell());
    await page.evaluate(()=>{
      window.__externalClicks=0;
      const nativeClick=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){
        if(this.target==='_blank') window.__externalClicks+=1;
        else return nativeClick.call(this);
      };
      window.nxBrowse=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
      window.nxBrowsePreset=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
      window.nxOpenBrowserExternal=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
    });

    await installBrowserV2(page);

    assert.ok((await page.textContent('#tab-browser h2')).includes('NexusNova Browser'));
    assert.equal((await page.textContent('.more-item span')).trim(),'NEXUSNOVA BROWSER');
    assert.equal(await page.locator('#tab-browser').evaluate(node=>node.classList.contains('nx-browser-shell')),true);
    assert.ok((await page.textContent('.nx-browser-mode-line')).includes('Protected HTTPS navigation'));
    assert.ok((await page.textContent('.nx-browser-mode-line')).includes('WEB • IN APP'));
    assert.equal(await page.locator('[data-nx-browser-toolbar] .nx-browser-nav').count(),4);
    assert.equal(await page.locator('[data-nx-browser-toolbar] .nx-browser-nav svg').count(),4);
    assert.ok((await page.textContent('[data-nx-browser-toolbar]')).includes('NEXUS SECURE VIEW'));
    assert.ok((await page.getAttribute('#nxBrowserUrl','placeholder')).includes('secure website'));
    assert.equal(await page.locator('.browser-links .nx-browser-link-icon svg').count(),1);
    console.log('PASS NexusNova Browser V2 premium shell, Nexus branding, SVG controls and HTTPS chrome');

    await page.addScriptTag({url:`${base}/js/nexusnova-browser-extensions-v1.js?v=2`});
    await page.waitForFunction(()=>window.NexusNovaBrowserExtensions?.version==='extensions-apps-hub-v2');
    await page.evaluate(()=>window.NexusNovaBrowserExtensions.install());
    await page.waitForSelector('[data-nx-browser-extensions]');
    assert.equal(await page.locator('[data-nx-browser-extensions] svg').count(),1);
    await page.click('[data-nx-browser-extensions]');
    await page.waitForSelector('#nxBrowserExtensionsOverlay.open');
    const extText=await page.textContent('#nxBrowserExtensionsOverlay');
    assert.ok(extText.includes('NEXUSNOVA // EXTENSIONS + APPS'));
    assert.ok(extText.includes('Extensions & Apps Hub'));
    assert.ok(extText.includes('Chrome .crx') && extText.includes('cannot execute arbitrary desktop'));
    console.log('PASS NexusNova Extensions & Apps V2 is branded and honest about WebView limits');

    await page.fill('[data-app-name]','Example App');
    await page.fill('[data-app-url]','https://example.net/');
    await page.click('[data-app-install]');
    assert.ok((await page.textContent('[data-app-install-status]')).includes('installed in NexusNova Browser'));
    assert.equal(await page.locator('[data-nx-installed-apps] [data-app-id]').count(),1);
    console.log('PASS secure HTTPS web app installs into NexusNova Browser Apps Hub');
    await page.evaluate(()=>window.NexusNovaBrowserExtensions.close());

    await page.click('#oldGo');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.com/');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    assert.equal(await page.evaluate(()=>window.__legacyCalls||0),0);
    console.log('PASS Go stays inside NexusNova web viewer');

    await page.click('#preset');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.org/');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    console.log('PASS quick link stays inside NexusNova web viewer');

    await page.fill('#nxBrowserUrl','nexusnova test search');
    await page.press('#nxBrowserUrl','Enter');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src.startsWith('https://www.google.com/search?q='));
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    console.log('PASS address bar supports in-app search');

    await page.fill('#nxBrowserUrl','javascript:alert(1)');
    await page.click('#oldGo');
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('secure HTTPS'));
    console.log('PASS unsafe schemes are rejected');

    await page.evaluate(()=>{
      window.nxBrowse=()=>{window.__lateLegacy=(window.__lateLegacy||0)+1;};
      window.nxBrowsePreset=()=>{window.__lateLegacy=(window.__lateLegacy||0)+1;};
    });
    await page.addScriptTag({url:`${base}/js/nexusnova-browser-guard-v1.js?v=1`});
    await page.waitForTimeout(80);
    await page.fill('#nxBrowserUrl','https://example.edu/');
    await page.click('#oldGo');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.edu/');
    assert.equal(await page.evaluate(()=>window.__lateLegacy||0),0);
    console.log('PASS late legacy launcher cannot retake Browser ownership');

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
      window.__externalClicks=0;
      window.NexusBrowserAndroid={postMessage(message){window.__nativeMessages.push(JSON.parse(message));}};
      HTMLAnchorElement.prototype.click=function(){if(this.target==='_blank')window.__externalClicks+=1;};
    });
    await installBrowserV2(page);

    assert.ok((await page.textContent('.nx-browser-mode-line')).includes('ANDROID • IN APP'));
    await page.fill('#nxBrowserUrl','https://www.google.com/');
    await page.click('#oldGo');
    const messages=await page.evaluate(()=>window.__nativeMessages);
    assert.equal(messages.length,1);
    assert.deepEqual(messages[0],{action:'open',url:'https://www.google.com/'});
    assert.equal(await page.getAttribute('#nxBrowserFrame','src'),'about:blank');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('native NexusNova Browser'));
    console.log('PASS Android mode preserves NexusNova identity and routes into dedicated native Browser Activity');

    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }

  console.log('\nNexusNova Browser runtime complete: V2 visual identity, Extensions & Apps V2, secure in-app browsing and Android routing passed.');
} finally {
  await browser.close();
}
