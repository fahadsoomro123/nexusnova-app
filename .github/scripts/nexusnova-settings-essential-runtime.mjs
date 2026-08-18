import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin='http://127.0.0.1:4173';
const scriptPath=String(process.env.NX_SETTINGS_SCRIPT_PATH||'/js/nexusnova-account-deletion-settings-v1.js').replace(/^\/+/, '');
const expectedLabel=process.env.NX_SETTINGS_LABEL||'source';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:873}});

try{
  await page.goto(`${origin}/.github/fixtures/runtime-origin.html`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    document.body.innerHTML=`
      <section id="tab-about" class="tab active">
        <div class="settings-hero card"><div><h2>⚙️ NexusNova Settings</h2><p class="settings-muted">Control your account, app, AI and privacy.</p></div><span class="settings-version">v6.1.0</span></div>
        <div class="card settings-card"><h3>Account</h3>
          <div class="settings-row"><div><strong>Miner User</strong><small>test@example.com</small></div><button>Edit</button></div>
          <div class="settings-row"><div><strong>Email verification</strong><small>Verified</small></div><button>Refresh</button></div>
          <div class="settings-row"><div><strong>Change password</strong><small>Reset</small></div><button>Reset</button></div>
          <div class="settings-row"><div><strong>Sign out</strong><small>Logout</small></div><button>Logout</button></div>
        </div>
        <div class="card settings-card"><h3>Appearance</h3>
          <div class="settings-row"><div><strong>Theme</strong><small>Theme</small></div><select><option>System</option></select></div>
          <div class="settings-row"><div><strong>Compact mode</strong><small>Compact</small></div><input type="checkbox"></div>
        </div>
        <div class="card settings-card"><h3>Notifications</h3></div>
        <div class="card settings-card"><h3>AI</h3>
          <div class="settings-row"><div><strong>AI language</strong></div><select><option>English</option></select></div>
          <div class="settings-row"><div><strong>Voice replies</strong></div><input type="checkbox"></div>
          <div class="settings-row"><div><strong>Clear saved AI data</strong></div><button>Clear</button></div>
        </div>
        <div class="card settings-card"><h3>Privacy & Permissions</h3></div>
        <div class="card settings-card"><h3>General</h3></div>
        <div class="card settings-card"><h3>System Status</h3></div>
        <div class="card settings-card"><h3>Support & About</h3></div>
      </section>`;
    window.__openedSettingsUrls=[];
    window.NexusBrowserAndroid={postMessage(raw){window.__openedSettingsUrls.push(JSON.parse(String(raw)).url)}};
  });

  await page.addScriptTag({url:`${origin}/${scriptPath}?v=essential-runtime`});
  await page.waitForFunction(()=>document.documentElement.dataset.nxSettingsSimple==='1');

  const state=await page.evaluate(()=>({
    title:document.querySelector('#tab-about .settings-hero h2')?.textContent||'',
    subtitle:document.querySelector('#tab-about .settings-hero .settings-muted')?.textContent||'',
    headings:[...document.querySelectorAll('#tab-about .settings-card h3')].map(el=>el.textContent.trim()),
    deleteText:document.getElementById('nxAccountDeletionSettingsRow')?.textContent||'',
    privacyText:document.getElementById('nxPrivacyPolicySettingsRow')?.textContent||'',
    compact:[...document.querySelectorAll('#tab-about .settings-row strong')].some(el=>el.textContent.trim()==='Compact mode'),
    clearAi:[...document.querySelectorAll('#tab-about .settings-row strong')].some(el=>el.textContent.trim()==='Clear saved AI data'),
    settingsVersion:document.documentElement.dataset.nxSettingsVersion||''
  }));

  assert.equal(state.title,'⚙️ Settings');
  assert.match(state.subtitle,/essential app preferences/i);
  assert.deepEqual(state.headings,['Account','Preferences']);
  assert.match(state.deleteText,/Delete Account/);
  assert.match(state.privacyText,/Privacy Policy/);
  assert.equal(state.compact,false);
  assert.equal(state.clearAi,false);
  assert.equal(state.settingsVersion,'3');

  await page.locator('#nxPrivacyPolicyBtn').click();
  await page.locator('#nxAccountDeletionBtn').click();
  const urls=await page.evaluate(()=>window.__openedSettingsUrls.slice());
  assert.equal(urls.length,2);
  assert.match(urls[0],/privacy-policy\.html$/);
  assert.match(urls[1],/account-deletion\.html$/);

  console.log(`PASS Settings (${expectedLabel}): compact Account + Preferences only, Privacy Policy and Delete Account visible and routed.`);
}finally{
  await browser.close();
}