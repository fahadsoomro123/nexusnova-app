import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const url = `${base}/NexusNovaAndroid/app/src/main/assets/www/page2.html?nxAndroid=1&uiRestoreTest=1`;
const expected = ['TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'];

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({
  viewport:{ width:393, height:873 },
  userAgent:'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 NexusNovaUiRestoreProof',
  serviceWorkers:'block'
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error?.message || error || '')));

try {
  await page.route('**/*', async route => {
    try {
      const parsed = new URL(route.request().url());
      if (parsed.origin === base) return route.continue();
      return route.abort('failed');
    } catch (_) {
      return route.abort('failed');
    }
  });

  const response = await page.goto(url,{waitUntil:'commit',timeout:10000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(() => Boolean(document.getElementById('mineBtn')));
  await page.waitForFunction(() => Boolean(window.NexusNovaUiRegressionRepair),null,{timeout:10000});
  await page.waitForTimeout(6500);

  await page.locator('#moreBtn').click();
  await page.waitForFunction(() => document.getElementById('moreMenu')?.classList.contains('show') || document.body.classList.contains('nx-allapps-open'));
  await page.waitForTimeout(700);

  const hub = await page.evaluate((expectedLabels) => {
    const visible = el => {
      if (!el) return false;
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1;
    };
    const inner = document.querySelector('#moreMenu .more-inner');
    const header = document.getElementById('nxNovaHubHeader');
    const search = document.getElementById('nxAllAppsSmartSearch');
    const repair = window.NexusNovaUiRegressionRepair?.inventory?.() || {present:[],missing:expectedLabels};
    const buttons = Array.from(document.querySelectorAll('#moreMenu .more-item')).filter(b => b.dataset.nxNovaHubCore !== '1');
    const firstIcon = buttons.map(b => b.querySelector('.mi-icon')).find(Boolean);
    const iconStyle = firstIcon ? getComputedStyle(firstIcon) : null;
    const dockVisible = Array.from(document.querySelectorAll('.bottom-dock .dock-item')).filter(visible);
    const coreHubVisible = Array.from(document.querySelectorAll('#moreMenu [data-nx-nova-hub-core="1"]')).filter(visible);
    const orderGuardScripts = Array.from(document.scripts)
      .map(script => String(script.src || ''))
      .filter(src => /nexusnova-allapps-order-guard-v(?:4|5|6)\.js/i.test(src))
      .map(src => src.split('/').pop());
    return {
      firstChildId:inner?.firstElementChild?.id || '',
      secondChildId:inner?.children?.[1]?.id || '',
      headerBeforeSearch:Boolean(header && search && header.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING),
      inventory:repair,
      iconWidth:parseFloat(iconStyle?.width || '0'),
      iconHeight:parseFloat(iconStyle?.height || '0'),
      visibleDockLabels:dockVisible.map(b => String(b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g,' ').trim()),
      coreHubVisible:coreHubVisible.length,
      mineQuick:document.querySelectorAll('#nxMineQuickNavV1 [data-nx-mine-target]').length,
      headerCopy:String(header?.querySelector('.nx-nova-hub-copy')?.textContent || '').trim(),
      orderGuardScripts
    };
  }, expected);

  console.log('UI_HUB_STATE ' + JSON.stringify(hub));
  assert.equal(hub.firstChildId,'nxNovaHubHeader','Nova Hub blue header must be the first Hub block');
  assert.equal(hub.secondChildId,'nxAllAppsSmartSearch','Smart App Search must sit directly under Nova Hub header');
  assert.equal(hub.headerBeforeSearch,true,'Nova Hub header must remain above search');
  assert.deepEqual(hub.inventory.missing,[],`Missing Nova Hub features: ${hub.inventory.missing.join(', ')}`);
  assert.ok(hub.inventory.present.length >= expected.length,`Expected at least ${expected.length} Hub apps, got ${hub.inventory.present.length}`);
  assert.ok(hub.iconWidth > 0 && hub.iconWidth <= 40.5,`Mobile Hub icon width regressed: ${hub.iconWidth}`);
  assert.ok(hub.iconHeight > 0 && hub.iconHeight <= 40.5,`Mobile Hub icon height regressed: ${hub.iconHeight}`);
  assert.equal(hub.visibleDockLabels.length,2,`Bottom dock must remain exactly Mine + Nova Hub: ${hub.visibleDockLabels.join(' | ')}`);
  assert.equal(hub.coreHubVisible,0,'Wallet/Market duplicate core shortcuts must not be visible inside Nova Hub');
  assert.equal(hub.mineQuick,3,'Mine must expose Wallet / Tasks / Market quick destinations');
  assert.ok(hub.orderGuardScripts.length <= 1,`Duplicate All Apps order owners loaded: ${hub.orderGuardScripts.join(' | ')}`);

  const settings = page.locator('#moreMenu .more-item').filter({hasText:/^\s*SETTINGS\s*$/i}).first();
  await settings.click();
  await page.waitForFunction(() => document.getElementById('tab-about')?.classList.contains('active'));
  await page.waitForTimeout(350);
  const settingsState = await page.evaluate(() => {
    const pager = document.getElementById('nxUxBottomNav');
    const pagerStyle = pager ? getComputedStyle(pager) : null;
    const headings=[...document.querySelectorAll('#tab-about .settings-card h3')].map(el=>el.textContent.trim());
    const appearanceRows=[...document.querySelectorAll('#tab-about .settings-card')]
      .find(card=>String(card.querySelector('h3')?.textContent||'').trim()==='Appearance')
      ?.querySelectorAll('.settings-row strong');
    return {
      pagerVisible:Boolean(pager && pagerStyle && pagerStyle.display !== 'none' && pagerStyle.visibility !== 'hidden' && Number(pagerStyle.opacity || 1) > 0),
      allAppsBack:Boolean(document.querySelector('#tab-about > .nx-allapps-back')),
      duplicateHeroVisible:(() => { const h=document.querySelector('#tab-about > .nx-app-hero'); if(!h)return false; const s=getComputedStyle(h); return s.display !== 'none' && s.visibility !== 'hidden'; })(),
      settingsSimple:document.documentElement.dataset.nxSettingsVersion || '',
      headings,
      appearanceRows:appearanceRows ? [...appearanceRows].map(el=>el.textContent.trim()) : []
    };
  });
  console.log('UI_SETTINGS_STATE ' + JSON.stringify(settingsState));
  assert.equal(settingsState.pagerVisible,false,'Settings must not show PREVIOUS/BACK/NEXT reader pager');
  assert.equal(settingsState.allAppsBack,false,'Settings must not contain injected sub-app Back bar');
  assert.equal(settingsState.duplicateHeroVisible,false,'Settings duplicate generic app hero must be hidden');
  assert.equal(settingsState.settingsSimple,'3','Essential Settings v3 must remain active');
  assert.deepEqual(settingsState.headings,['Account','Appearance'],'Settings must stay tiny: Account + Appearance only');
  assert.deepEqual(settingsState.appearanceRows,['Theme'],'Appearance must contain Theme only');

  await page.evaluate(() => window.switchTab?.('home',null));
  await page.waitForFunction(() => document.getElementById('tab-home')?.classList.contains('active'));
  const walletQuick = page.locator('#nxMineQuickNavV1 [data-nx-mine-target="wallet"]');
  await walletQuick.click();
  await page.waitForFunction(() => document.getElementById('tab-wallet')?.classList.contains('active'));
  await page.waitForTimeout(250);
  const mineDomain = await page.evaluate(() => {
    const visible = el => { const s=getComputedStyle(el); const r=el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
    const dock = Array.from(document.querySelectorAll('.bottom-dock .dock-item')).filter(visible);
    const mine = dock.find(b => b.id !== 'moreBtn');
    return {walletActive:document.getElementById('tab-wallet')?.classList.contains('active')===true,mineActive:Boolean(mine?.classList.contains('active')),hubActive:Boolean(document.getElementById('moreBtn')?.classList.contains('active'))};
  });
  console.log('UI_MINE_DOMAIN ' + JSON.stringify(mineDomain));
  assert.equal(mineDomain.walletActive,true);
  assert.equal(mineDomain.mineActive,true,'Wallet/Tasks/Market are Mine-domain destinations');
  assert.equal(mineDomain.hubActive,false,'Nova Hub must not become active for Mine-domain core tabs');

  const severe = pageErrors.filter(text => !/Failed to fetch|ERR_FAILED|dynamically imported module|Importing a module script failed|NetworkError/i.test(text));
  assert.deepEqual(severe,[],`Unexpected page errors: ${severe.join(' | ')}`);
  console.log(`PASS UI restore runtime: ${hub.inventory.present.length} Hub entries present, compact icons restored, single order owner proven, Hub header above search, tiny Settings restored, and Mine owns Wallet/Tasks/Market while bottom dock stays Mine + Nova Hub.`);
} finally {
  await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
