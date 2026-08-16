from pathlib import Path
import os,re

ROOT=Path(os.environ.get('NX_WEB_ROOT','NexusNovaAndroid/app/src/main/assets/www'))
MARKER='nx-video-smoothness-v4-runtime'

def load(rel):
    p=ROOT/rel
    if not p.exists(): raise SystemExit(f'Missing {p}')
    return p,p.read_text(encoding='utf-8')
def save(p,s): p.write_text(s,encoding='utf-8')

# page shell: blur is expensive on WebView; keep modern gradients/borders but no
# live backdrop sampling. Pause the always-moving ticker while the user scrolls.
p,page=load('page2.html')
if MARKER not in page:
    style='''<style id="nxAndroidRuntimePerfV4">
html.nx-android-smooth body *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html.nx-android-smooth.nx-user-scrolling .ticker-content{animation-play-state:paused!important}
</style>
<script id="nxAndroidScrollPerfV4">
(function(){
  let t=0;
  window.addEventListener('scroll',function(){
    document.documentElement.classList.add('nx-user-scrolling');
    clearTimeout(t); t=setTimeout(function(){document.documentElement.classList.remove('nx-user-scrolling')},140);
  },{passive:true});
})();
</script>'''
    page=page.replace('</head>',style+'\n</head>',1)
    page=page.replace('</body>',f'<!-- {MARKER} -->\n</body>',1)
save(p,page)

# page2-core: after auth only hydrate the account/profile. Every network-heavy
# feature already has an explicit switchTab trigger; don't pre-open all of them.
p,core=load('js/page2-core.js')
old_auth='''        setTimeout(async () => {
            try { await loadUserProfile(); } catch (error) { console.warn('Deferred profile load:', error); }
            setTimeout(() => {
                try { loadMarket(); } catch (_) {}
                try { loadFinanceData(); } catch (_) {}
                try { loadNews(); } catch (_) {}
                try { loadChat(); } catch (_) {}
                try { renderEmergencyContacts(); } catch (_) {}
            }, 900);
        }, 700);'''
new_auth='''        setTimeout(async () => {
            try { await loadUserProfile(); } catch (error) { console.warn('Deferred profile load:', error); }
            try { renderEmergencyContacts(); } catch (_) {}
        }, 250);'''
if old_auth in core:
    core=core.replace(old_auth,new_auth,1)
elif new_auth not in core:
    raise SystemExit('Auth background feature fan-out patch point missing.')

# Original and repair ticker loops competed with ticker-fix.js. Keep their
# immediate fallback pass, but ticker-fix becomes the only periodic owner.
core=core.replace('''updateTicker();

setInterval(
    updateTicker,
    120000
);''','''updateTicker();
// Android: ticker-fix.js is the single periodic ticker refresh owner.''',1)
core=core.replace('''    repairTicker();
    setInterval(repairTicker, 60000);''','''    repairTicker();
    // Android: ticker-fix.js owns periodic refresh; this is fallback-only.''',1)

# Auxiliary profile repair used to issue repeated Firestore getDoc calls every
# second for 12 seconds. Stop on the first authenticated pass.
old_boot='''    let tries = 0;

    const boot = setInterval(() => {

        tries++;

        try{
            if(
                (currentUser || auth.currentUser)
            ){
                repairProfile();
                repairAIStatus();
            }
        }catch(_){}

        if(tries >= 12){
            clearInterval(boot);
        }

    },1000);'''
new_boot='''    let tries = 0;
    const boot = setInterval(() => {
        tries++;
        try{
            if(currentUser || auth.currentUser){
                clearInterval(boot);
                repairProfile();
                repairAIStatus();
                return;
            }
        }catch(_){}
        if(tries >= 6) clearInterval(boot);
    },1500);'''
if old_boot in core:
    core=core.replace(old_boot,new_boot,1)
elif new_boot not in core:
    raise SystemExit('Repeated profile repair boot patch point missing.')
if MARKER not in core: core=f'/* {MARKER} */\n'+core
save(p,core)

# Failsafe is a fallback, not a second market/wallet owner. Don't fetch market
# at boot or alongside the primary tab handler.
p,fail=load('js/core-failsafe-core.js')
fail=fail.replace('''                            if(
                                tabName === "market"
                            ){
                                loadLiveMarket();
                            }

                            if(
                                tabName === "wallet"
                            ){
                                loadWalletPrices();
                            }''','''                            if(tabName === "market" && typeof window.loadMarket !== "function"){
                                loadLiveMarket();
                            }
                            if(tabName === "wallet" && typeof window.refreshWalletFoundation !== "function"){
                                loadWalletPrices();
                            }''',1)
fail=fail.replace('''        // Market can run independently.
        loadLiveMarket();''','''        // Primary page2 handlers own Market/Wallet. Failsafe stays dormant
        // until a primary handler is genuinely unavailable.''',1)
if MARKER not in fail: fail=f'/* {MARKER} */\n'+fail
save(p,fail)

# Ultimate upgrade used to start Wallet observers plus 9 timed wallet refreshes
# and a News request during every dashboard boot. Make both feature-driven.
p,ultimate=load('js/nexusnova-ultimate-upgrade.js')
ultimate=ultimate.replace('''  function startWalletStability() {
    const list = document.getElementById("walletAssetList");''','''  let walletStabilityStarted = false;
  function startWalletStability() {
    if(walletStabilityStarted) return;
    walletStabilityStarted = true;
    const list = document.getElementById("walletAssetList");''',1)
ultimate=ultimate.replace('''    [250,700,1500,3000,5000,10000].forEach(ms =>
      setTimeout(() => {
        repaintWalletFromCache();
        window.refreshNexusOnchainWallet?.();
      }, ms)
    );''','''    [150,900].forEach(ms =>
      setTimeout(() => {
        if(!document.getElementById("tab-wallet")?.classList.contains("active")) return;
        repaintWalletFromCache();
        window.refreshNexusOnchainWallet?.();
      }, ms)
    );''',1)
old_uboot='''  async function boot() {
    addCameraButton();
    startWalletStability();

    if (document.getElementById("newsList")) {
      setTimeout(enhancedNews, 900);
    }

    // AI initialization is lazy; this avoids slowing dashboard startup.
    const aiConnection = document.getElementById("aiConnectionText");
    if (aiConnection) aiConnection.textContent = "AI ready — tap Ask to connect";

    // If a wallet is already authorized, refresh after all renderers settle.
    [500, 1500, 3500].forEach(ms =>
      setTimeout(() => window.refreshNexusOnchainWallet?.(), ms)
    );
  }'''
new_uboot='''  async function boot() {
    addCameraButton();
    // AI/Wallet/News are feature-driven on Android. Do not compete with Home.
    const aiConnection = document.getElementById("aiConnectionText");
    if (aiConnection) aiConnection.textContent = "AI ready — tap Ask to connect";
  }

  window.addEventListener('nexusnova:tab-changed', event => {
    const name=String(event?.detail?.name || '');
    if(name === 'wallet') startWalletStability();
  });'''
if old_uboot in ultimate:
    ultimate=ultimate.replace(old_uboot,new_uboot,1)
elif new_uboot not in ultimate:
    raise SystemExit('Ultimate boot fan-out patch point missing.')
if MARKER not in ultimate: ultimate=f'/* {MARKER} */\n'+ultimate
save(p,ultimate)

# Reduce a local DOM observer that only exists to redraw a speed gauge. The
# speed tool itself can call sync via its existing updates; bounded/tab checks
# are enough for normal navigation and remove another subtree observer.
p,speed=load('js/nexusnova-speed-meter-sync-v2.js')
old_speed='''    if(main.dataset.nxMeterObserved!=='1'){
      main.dataset.nxMeterObserved='1';
      new MutationObserver(sync).observe(main,{childList:true,characterData:true,subtree:true});
    }
    sync();'''
new_speed='''    main.dataset.nxMeterObserved='1';
    sync();'''
if old_speed in speed:
    speed=speed.replace(old_speed,new_speed,1)
elif 'new MutationObserver(sync).observe(main' in speed:
    raise SystemExit('Speed meter observer still present.')
save(p,speed)

# Verify exact generated Android assets.
checks={
 'page2.html':[MARKER,'nxAndroidRuntimePerfV4','nx-user-scrolling'],
 'js/page2-core.js':[MARKER,'setTimeout(async () => {','}, 250);','single periodic ticker refresh owner'],
 'js/core-failsafe-core.js':[MARKER,'typeof window.loadMarket !== "function"'],
 'js/nexusnova-ultimate-upgrade.js':[MARKER,'walletStabilityStarted','name === \'wallet\''],
}
for rel,needles in checks.items():
    txt=(ROOT/rel).read_text(encoding='utf-8')
    for needle in needles:
        if needle not in txt: raise SystemExit(f'v4 verification failed {rel}: {needle}')
if 'setInterval(repairTicker, 60000)' in (ROOT/'js/page2-core.js').read_text(encoding='utf-8'):
    raise SystemExit('Competing 60s repairTicker loop remains.')
if 'new MutationObserver(sync).observe(main' in (ROOT/'js/nexusnova-speed-meter-sync-v2.js').read_text(encoding='utf-8'):
    raise SystemExit('Speed meter subtree observer remains.')
print('Applied Android smoothness v4: feature-driven Wallet/Market/News/Chat, one periodic ticker owner, one-shot profile repair, zero WebView backdrop blur, scroll-aware ticker, and no speed-meter subtree observer.')
