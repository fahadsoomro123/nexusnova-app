import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><body>
    <section id="tab-smart">
      <article class="feature-tile"><strong>Camera / Documents</strong><small>Document understanding workflow.</small><button onclick="nxComing('camera')">Open Camera</button></article>
      <article class="feature-tile"><strong>AI Daily Brief</strong><small>News + finance + weather + reminders.</small><button onclick="nxComing('brief')">Build Brief</button></article>
    </section>
    <section id="tab-ai"><input id="aiImageInput" type="file"><textarea id="aiInput"></textarea></section>
    <span id="balance">42.5 NVX</span><span id="timer">18h 20m remaining</span>
  </body></html>`);

  await page.evaluate(()=>{
    localStorage.clear();
    window.__nxRewardsSparkV1=true;
    window.__nxAllAppsSmartSearchV2=true;
    window.nexusAccountId='test-account';
    window.__comingCalls=0;
    window.nxComing=()=>{window.__comingCalls+=1;};
    window.__tabs=[];
    window.openMoreTab=tab=>window.__tabs.push(tab);
    window.__cameraClicks=0;
    document.getElementById('aiImageInput').addEventListener('click',e=>{e.preventDefault();window.__cameraClicks+=1;});
    window.__sent=0;
    window.sendAIMessage=()=>{window.__sent+=1;window.__sentPrompt=document.getElementById('aiInput').value;};
    const now=Date.now()+3600000;
    localStorage.setItem('nxmega_events:test-account',JSON.stringify([{title:'School meeting',when:now}]));
    localStorage.setItem('nxmega_reminders:test-account',JSON.stringify([{text:'Pay bill',when:now+60000,fired:false}]));
    localStorage.setItem('nxmega_expenses:test-account',JSON.stringify([{amount:1200},{amount:300}]));
    localStorage.setItem('nxmega_habits:test-account',JSON.stringify([{name:'Walk',days:5}]));
  });

  await page.addScriptTag({url:`${base}/js/nexusnova-smart-live-v1.js?v=37`});
  await page.waitForFunction(()=>window.nexusSmartLiveVersion==='real-actions-v3.7' && document.getElementById('nxSmartCameraLive') && document.getElementById('nxSmartBriefLive'));

  const briefCopy=await page.locator('#nxSmartBriefLive').evaluate(btn=>btn.closest('.feature-tile').querySelector('small').textContent);
  assert.ok(briefCopy.includes('Balance, mining, events, reminders, expenses and habits'));
  assert.equal(briefCopy.includes('weather'),false);
  console.log('PASS Smart Daily Brief card copy matches the data the feature actually uses');

  await page.click('#nxSmartCameraLive');
  assert.equal(await page.evaluate(()=>window.__cameraClicks),1);
  assert.ok((await page.evaluate(()=>window.__tabs)).includes('ai'));
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Smart Camera routes into the real AI image input without legacy Coming Soon');

  await page.click('#nxSmartBriefLive');
  assert.equal(await page.evaluate(()=>window.__sent),1);
  const prompt=await page.evaluate(()=>window.__sentPrompt);
  for(const expected of ['42.5 NVX','18h 20m remaining','School meeting','Pay bill','1500','Walk: 5 check-ins']) assert.ok(prompt.includes(expected),`missing ${expected}`);
  assert.ok(prompt.includes('do not invent missing information'));
  assert.ok(prompt.includes('weather/news data is not supplied rather than guessing'));
  assert.equal(await page.evaluate(()=>window.__comingCalls),0);
  console.log('PASS Smart Daily Brief sends only real available app context and explicitly forbids guessing missing live data');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nSmart runtime complete: camera handoff, truthful copy and real-context daily brief passed.');
} finally {
  await browser.close();
}
