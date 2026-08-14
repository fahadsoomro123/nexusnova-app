import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main class="main">
      <section id="tab-wallet" class="tab active"></section>
      <section id="tab-profile" class="tab"></section>
      <section id="tab-about" class="tab"></section>
    </main>
  </body></html>`);
  await page.addScriptTag({url:`${base}/js/nexusnova-bug-report-v1.js?v=1`});
  assert.equal(await page.evaluate(()=>window.nexusBugReportVersion),'bug-report-v1');
  await page.waitForSelector('#tab-profile .nx-bug-launch');
  await page.waitForSelector('#tab-about .nx-bug-launch');
  console.log('PASS bug report launch cards render in Profile and Settings/About');

  await page.evaluate(()=>{
    window.dispatchEvent(new ErrorEvent('error',{message:'Failed for test@example.com 0x1111111111111111111111111111111111111111 at https://secret.example/path phone +92 300 1234567'}));
  });
  const diagnostic=await page.evaluate(()=>window.nexusBugDiagnostics.summary());
  assert.match(diagnostic,/feature=wallet/);
  assert.match(diagnostic,/browser=/);
  assert.equal(diagnostic.includes('test@example.com'),false);
  assert.equal(diagnostic.includes('0x1111111111111111111111111111111111111111'),false);
  assert.equal(diagnostic.includes('https://secret.example/path'),false);
  assert.equal(diagnostic.includes('+92 300 1234567'),false);
  assert.match(diagnostic,/\[email\]/);
  assert.match(diagnostic,/\[wallet\]/);
  assert.match(diagnostic,/\[url\]/);
  assert.match(diagnostic,/\[number\]/);
  console.log('PASS recent diagnostics sanitize email, wallet, URL and phone-like values');

  await page.evaluate(()=>window.nexusOpenBugReport());
  await page.waitForSelector('#nxBugReportModal:not([hidden])');
  assert.equal(await page.isChecked('#nxBugDiagnostics'),true);
  assert.equal(await page.inputValue('#nxBugCategory'),'ui');
  assert.equal(await page.inputValue('#nxBugSeverity'),'medium');
  assert.match(await page.textContent('#nxBugReportModal'),/No email, wallet address, search text, messages, contacts or exact location/i);
  await page.uncheck('#nxBugDiagnostics');
  assert.equal(await page.isChecked('#nxBugDiagnostics'),false);
  console.log('PASS report form exposes explicit optional diagnostics control');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('\nBug report runtime complete: UI + sanitized diagnostics passed.');
}finally{
  await browser.close();
}
