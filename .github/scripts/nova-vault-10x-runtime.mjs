import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{width:393,height:873} });

const fakeModules = {
  'firebase-app.js': `export function getApps(){return [{}]}`,
  'firebase-auth.js': `
    const user={uid:'vault-test-user',emailVerified:true,reload:async()=>{},getIdToken:async()=>''};
    export function getAuth(){return {currentUser:user}}
    export function onAuthStateChanged(auth,cb){queueMicrotask(()=>cb(auth.currentUser));return ()=>{}}`,
  'firebase-firestore.js': `
    export function getFirestore(){return {}}
    export function doc(){return {}}
    export function onSnapshot(_ref,cb){queueMicrotask(()=>cb({data:()=>({novaVaultBoostCredits:Number(window.__fakeBoostCredits||0)})}));return ()=>{}}
    export async function getDoc(){return {data:()=>({novaVaultBoostCredits:Number(window.__fakeBoostCredits||0)})}}`,
  'firebase-functions.js': `
    export function getFunctions(){return {}}
    export function httpsCallable(_f,name){return async()=>{window.__secureCalls.push(name);window.__fakeBoostCredits=0;return {data:{opened:true,boosted:true,balance:47,cooldownUntil:Date.now()+15000,novaVaultPending:0,novaVaultBoostCredits:0,reward:{type:'booster',amount:1},inventory:{booster:1,rain:0,timeWarp:0,pendingVaults:0}}}}}`
};

await page.route('https://www.gstatic.com/firebasejs/12.1.0/*', async route => {
  const name = new URL(route.request().url()).pathname.split('/').pop();
  const body = fakeModules[name];
  if (!body) return route.abort('failed');
  return route.fulfill({
    status:200,
    contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*','cache-control':'no-store'},
    body
  });
});

try {
  await page.goto(`${origin}/.github/fixtures/runtime-origin.html`, {waitUntil:'domcontentloaded'});
  await page.evaluate(() => {
    document.body.innerHTML = `
      <section id="nxNovaVaultPanel">
        <div class="nx-vault-actions"></div>
      </section>
      <div id="moreMenu"><div class="more-inner">
        <button id="hubTools" class="more-item" onclick="openMoreTab('tools')">Tools</button>
        <button id="hubWallet" class="more-item" onclick="openMoreTab('wallet')">Wallet</button>
        <button id="hubNews" class="more-item" onclick="openMoreTab('news')">News</button>
      </div></div>`;

    window.__fakeBoostCredits = 0;
    window.__secureCalls = [];
    window.__rewardRequests = [];
    window.__openedFeatures = [];
    window.__alerts = [];
    window.__interstitialMode = 'pending';

    window.nexusRequireAppCheck = async () => true;
    window.NexusNovaVault = {
      status:()=>({pending:1,inventory:{pendingVaults:1},cooldownRemainingMs:0})
    };
    window.NexusNovaUI = {
      alert:async options => { window.__alerts.push(options); return true; }
    };
    window.openMoreTab = name => { window.__openedFeatures.push(name); return true; };
    window.switchTab = name => { window.__openedFeatures.push(name); return true; };

    window.NexusNovaAds = {
      requestRewarded:(purpose,extra={}) => {
        window.__rewardRequests.push({purpose,...extra});
        return {shown:true,pending:true,rewardPurpose:purpose,testOnly:true};
      },
      isEligibleFeature:name => ['tools','news'].includes(String(name)),
      maybeInterstitial:(placement,{feature}={}) => {
        if (window.__interstitialMode === 'none') return {shown:false,reason:'frequency-or-not-ready',placement,feature};
        window.__lastInterstitial = {placement,feature};
        return {shown:true,pending:true,placement,feature};
      }
    };
  });

  await page.addScriptTag({url:`${origin}/js/nexusnova-nova-vault-10x-v1.js?v=runtime`});
  await page.addScriptTag({url:`${origin}/js/nexusnova-hub-ad-gate-v1.js?v=runtime`});
  await page.waitForFunction(() => Boolean(document.getElementById('nxVault10xOpen')));

  // Native TEST status: 10x must be opt-in but cannot create real value.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event',{detail:{
      event:'status',provider:'admob',testMode:true,ssvIdentityReady:true,rewardedReady:true
    }}));
  });
  await page.locator('#nxVault10xOpen').click();
  await page.waitForFunction(() => window.__rewardRequests.length === 1);
  let state = await page.evaluate(() => ({
    request:window.__rewardRequests[0],
    calls:window.__secureCalls.slice(),
    button:document.getElementById('nxVault10xOpen').textContent,
    odds:document.getElementById('nxVault10xOdds').textContent
  }));
  assert.equal(state.request.purpose,'nova-vault-10x');
  assert.equal(state.request.userId,'vault-test-user');
  assert.deepEqual(state.calls,[],'TEST rewarded request must not call value-bearing backend');
  assert.match(state.odds,/60%/);
  assert.match(state.odds,/39\.13%/);
  assert.match(state.odds,/10\.87%/);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event',{detail:{
      event:'rewarded-earned',provider:'admob',testMode:true,rewardPurpose:'nova-vault-10x',rewardAmount:1
    }}));
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event',{detail:{
      event:'rewarded-dismissed',provider:'admob',testMode:true,rewardPurpose:'nova-vault-10x'
    }}));
  });
  await page.waitForFunction(() => window.__alerts.some(item => /10× TEST Preview/i.test(item.title || '')));
  state = await page.evaluate(() => ({
    calls:window.__secureCalls.slice(),
    alerts:window.__alerts.slice(),
    fakeCredits:window.__fakeBoostCredits,
    status:window.NexusNovaVault10x.status()
  }));
  assert.deepEqual(state.calls,[],'TEST completion must remain value-free');
  assert.equal(state.fakeCredits,0);
  assert.match(state.alerts.at(-1)?.text || '',/no Vault consumed, no balance changed/i);

  // Simulate a production SSV credit already present. The button must consume
  // it via the secure callable without showing a second ad.
  await page.evaluate(() => {
    window.__fakeBoostCredits = 1;
    window.__alerts.length = 0;
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event',{detail:{
      event:'status',provider:'admob',testMode:false,ssvIdentityReady:true,rewardedReady:true
    }}));
  });
  await page.evaluate(async () => { await window.NexusNovaVault10x.refresh(); });
  await page.waitForFunction(() => /OPEN READY/i.test(document.getElementById('nxVault10xOpen')?.textContent || ''));
  const beforeRewards = await page.evaluate(() => window.__rewardRequests.length);
  await page.locator('#nxVault10xOpen').click();
  await page.waitForFunction(() => window.__secureCalls.includes('openNovaVaultBoosted'));
  state = await page.evaluate(() => ({
    rewardRequests:window.__rewardRequests.length,
    calls:window.__secureCalls.slice(),
    alerts:window.__alerts.slice()
  }));
  assert.equal(state.rewardRequests,beforeRewards,'banked production credit must not request another ad');
  assert.equal(state.calls.filter(name => name==='openNovaVaultBoosted').length,1);
  assert.ok(state.alerts.some(item => /10× Nova Vault Opened/i.test(item.title || '')));

  // Hub: eligible feature waits for an actual interstitial terminal event.
  await page.evaluate(() => {
    window.__openedFeatures.length=0;
    window.__interstitialMode='pending';
    const menu=document.getElementById('moreMenu');
    if(menu){menu.style.display='block';menu.classList.add('show');}
  });
  await page.locator('#hubTools').click();
  await page.waitForTimeout(100);
  state = await page.evaluate(() => ({opened:window.__openedFeatures.slice(),interstitial:window.__lastInterstitial}));
  assert.deepEqual(state.opened,[],'eligible app must wait while requested interstitial is on screen');
  assert.deepEqual(state.interstitial,{placement:'hub-app-open',feature:'tools'});
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event',{detail:{
      event:'interstitial-dismissed',provider:'admob',placement:'hub-app-open',feature:'tools'
    }}));
  });
  await page.waitForFunction(() => window.__openedFeatures.includes('tools'));

  // Product navigation intentionally closes Nova Hub after opening an app. The
  // next click in this fixture must simulate the user reopening Nova Hub first.
  await page.evaluate(() => {
    window.__openedFeatures.length=0;
    const menu=document.getElementById('moreMenu');
    if(menu){menu.style.display='block';menu.classList.add('show');}
  });
  await page.locator('#hubWallet').click();
  await page.waitForFunction(() => window.__openedFeatures.includes('wallet'));

  // Eligible destination with no-fill/frequency block opens immediately after
  // the user has reopened Nova Hub.
  await page.evaluate(() => {
    window.__openedFeatures.length=0;
    window.__interstitialMode='none';
    const menu=document.getElementById('moreMenu');
    if(menu){menu.style.display='block';menu.classList.add('show');}
  });
  await page.locator('#hubNews').click();
  await page.waitForFunction(() => window.__openedFeatures.includes('news'));

  console.log('PASS Nova Vault 10x: TEST ads are value-free, production credits use secure callable, and Hub ads never block protected/no-fill navigation.');
} finally {
  await browser.close();
}