import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const indexSource=await fs.readFile('index.html','utf8');
assert.match(indexSource,/function\s+submitEmailAuthFromKeyboard\s*\(/);
assert.match(indexSource,/emailInput\.addEventListener\(\s*["']keydown["']\s*,\s*submitEmailAuthFromKeyboard\s*\)/);
assert.match(indexSource,/passwordInput\.addEventListener\(\s*["']keydown["']\s*,\s*submitEmailAuthFromKeyboard\s*\)/);
assert.match(indexSource,/authBtn\.click\(\)/);
assert.match(indexSource,/event\.key\s*!==\s*["']Enter["']/);
console.log('PASS Email/password Enter key routes through existing auth button flow');

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message||String(error)));

try {
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main class="main">
      <section id="tab-profile" class="tab active">
        <div class="card" style="text-align:center">
          <div class="profile-avatar">old avatar</div>
          <h3 id="profileName">Miner User</h3>
          <p id="profileEmailDisplay">runtime@example.com</p>
        </div>
        <div class="card"><h3>Account Stats</h3><span id="profileId">ID</span><span id="profileTotalMined">0 NVX</span><span id="profileTasksDone">0</span></div>
        <div class="card"><h3>Referral Code</h3><div id="refCodeDisplay">NVX-RUNTIME</div></div>
      </section>
    </main>
    <div id="settingsName"></div><div id="settingsEmail"></div>
  </body></html>`);

  await page.addScriptTag({url:base+'/js/nexusnova-complete-profile-v1.js?v=1'});
  await page.waitForSelector('#nxCompleteProfileBtn');
  await page.waitForSelector('#nxProfileDetailsCard');
  await page.click('#nxCompleteProfileBtn');
  await page.waitForSelector('#nxProfileModal.open');

  for(const id of ['nxProfileFile','nxProfileNameInput','nxProfileBioInput','nxProfileCityInput','nxProfileCountryInput','nxProfileSave']){
    assert.ok(await page.$('#'+id),`missing complete profile control ${id}`);
  }
  const accept=await page.getAttribute('#nxProfileFile','accept');
  assert.match(accept,/image\/jpeg/);
  assert.match(accept,/image\/png/);
  assert.match(accept,/image\/webp/);

  const completion=await page.evaluate(() => window.nexusProfileCompletion({
    name:'Runtime User',photoDataUrl:'data:image/jpeg;base64,abc',bio:'Hello',city:'Karachi',country:'Pakistan'
  }));
  assert.equal(completion,100);

  const jpeg=await page.evaluate(async () => {
    const raw=atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlRy9sAAAAASUVORK5CYII=');
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    const file=new File([bytes],'avatar.png',{type:'image/png'});
    return await window.nexusCompressProfilePhoto(file);
  });
  assert.match(jpeg,/^data:image\/jpeg;base64,/);
  assert.ok(jpeg.length<=180000,'compressed profile photo exceeded Firestore safety limit');

  const source=await (await fetch(base+'/js/nexusnova-complete-profile-v1.js')).text();
  assert.match(source,/256/);
  assert.match(source,/profileUpdatedAt/);
  assert.doesNotMatch(source,/phoneNumber|dateOfBirth|cnic/i);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Complete Profile UI + 256x256 JPEG compression + privacy field guard');
} finally {
  await browser.close();
}
