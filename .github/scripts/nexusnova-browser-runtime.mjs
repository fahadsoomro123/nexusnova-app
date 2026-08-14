import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

function shell(){
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="moreMenu"><button class="more-item"><span>BROWSER</span></button></div>
    <section id="tab-browser">
      <div class="hub-hero"><div><div class="hub-kicker">NEXUS BROWSER</div><h2><span class="mi-icon">◎</span> Built-in Web Viewer</h2><p>Old copy</p></div></div>
      <div class="tool-row"><input id="nxBrowserUrl" value="https://example.com/"><button id="oldGo" onclick="nxBrowse()">Go</button></div>
      <div class="browser-links"><button id="preset" onclick="nxBrowsePreset('https://example.org/')">Example preset</button></div>
      <div class="browser-frame-wrap"><iframe id="nxBrowserFrame" src="about:blank"></iframe></div>
      <div id="nxBrowserStatus">Old status</div>
      <button id="external" onclick="nxOpenBrowserExternal()">Open externally</button>
    </section>
  </body></html>`;
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
      // Simulate the legacy browser launcher owning the globals first.
      window.nxBrowse=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
      window.nxBrowsePreset=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
      window.nxOpenBrowserExternal=()=>{window.__legacyCalls=(window.__legacyCalls||0)+1;};
    });

    await page.addScriptTag({url:`${base}/js/nexusnova-browser-v1.js?v=1`});
    await page.waitForFunction(()=>window.__nxNexusBrowserV1===true && window.NexusNovaBrowser?.version==='in-app-browser-v1');
    await page.waitForTimeout(260);

    assert.equal(await page.textContent('#tab-browser h2'),'◎ NexusNova Browser');
    assert.equal((await page.textContent('.more-item span')).trim(),'NEXUSNOVA BROWSER');
    assert.equal((await page.textContent('#oldGo')).trim(),'Open');
    console.log('PASS NexusNova Browser naming and in-app UI install');

    await page.click('#oldGo');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.com/');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    assert.equal(await page.evaluate(()=>window.__legacyCalls||0),0);
    console.log('PASS Go loads the website inside NexusNova instead of auto-opening Chrome/Edge');

    await page.click('#preset');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.org/');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    console.log('PASS browser preset stays inside the NexusNova web viewer');

    await page.fill('#nxBrowserUrl','nexusnova test search');
    await page.press('#nxBrowserUrl','Enter');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src.startsWith('https://www.google.com/search?q='));
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    console.log('PASS address bar supports search/URL entry without external redirect');

    await page.fill('#nxBrowserUrl','javascript:alert(1)');
    await page.click('#oldGo');
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('Only secure HTTPS browsing is allowed'));
    console.log('PASS unsafe schemes are rejected');

    // Reproduce the real load-order problem: a late legacy script overwrites the
    // globals, then the guard must restore the NexusNova Browser owner.
    await page.evaluate(()=>{
      window.nxBrowse=()=>{window.__lateLegacy=(window.__lateLegacy||0)+1;};
      window.nxBrowsePreset=()=>{window.__lateLegacy=(window.__lateLegacy||0)+1;};
    });
    await page.addScriptTag({url:`${base}/js/nexusnova-browser-guard-v1.js?v=1`});
    await page.waitForTimeout(80);
    await page.fill('#nxBrowserUrl','https://example.net/');
    await page.click('#oldGo');
    await page.waitForFunction(()=>document.getElementById('nxBrowserFrame')?.src==='https://example.net/');
    assert.equal(await page.evaluate(()=>window.__lateLegacy||0),0);
    console.log('PASS late legacy launcher cannot retake the Browser button');

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
      window.NexusBrowserAndroid={
        postMessage(message){ window.__nativeMessages.push(JSON.parse(message)); }
      };
      HTMLAnchorElement.prototype.click=function(){ if(this.target==='_blank') window.__externalClicks+=1; };
    });
    await page.addScriptTag({url:`${base}/js/nexusnova-browser-v1.js?v=1`});
    await page.waitForFunction(()=>window.NexusNovaBrowser?.nativeAvailable()===true);
    await page.waitForTimeout(260);

    await page.fill('#nxBrowserUrl','https://www.google.com/');
    await page.click('#oldGo');
    const messages=await page.evaluate(()=>window.__nativeMessages);
    assert.equal(messages.length,1);
    assert.deepEqual(messages[0],{action:'open',url:'https://www.google.com/'});
    assert.equal(await page.getAttribute('#nxBrowserFrame','src'),'about:blank');
    assert.equal(await page.evaluate(()=>window.__externalClicks),0);
    assert.ok((await page.textContent('#nxBrowserStatus')).includes('not Chrome'));
    console.log('PASS Android mode routes HTTPS into the trusted NexusNova Browser Activity bridge, not Chrome');

    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();
  }

  console.log('\nNexusNova Browser runtime complete: web in-app browsing, legacy override protection and Android native routing passed.');
} finally {
  await browser.close();
}
