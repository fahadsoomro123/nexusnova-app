from pathlib import Path
import os,re

ROOT = Path(os.environ.get('NX_WEB_ROOT','NexusNovaAndroid/app/src/main/assets/www'))
MARKER='nx-video-smoothness-v1'

def read(name):
    p=ROOT/name
    if not p.exists(): raise SystemExit(f'Missing {p}')
    return p,p.read_text(encoding='utf-8')

def write(p,s): p.write_text(s,encoding='utf-8')

# ---------- page shell: instant tabs + stable Android compositor ----------
p,page=read('page2.html')
if MARKER not in page:
    perf = r'''<style id="nxAndroidSmoothnessV1">
html.nx-android-smooth{scroll-behavior:auto!important}
html.nx-android-smooth body .tab.active{animation:none!important;transition:none!important;opacity:1!important;transform:none!important}
html.nx-android-smooth body .bottom-dock,html.nx-android-smooth body #moreMenu.more-menu{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html.nx-android-smooth body .dock-item,html.nx-android-smooth body #moreMenu .more-item,html.nx-android-smooth body #moreMenu .mi-icon{transition:none!important;will-change:auto!important}
html.nx-android-smooth body #moreMenu .mi-icon{filter:none!important;box-shadow:0 5px 14px rgba(0,0,0,.20)!important}
html.nx-android-smooth body #mineBtn.nx-future-miner{transform:none!important;transition:none!important;will-change:auto!important;box-shadow:0 11px 26px rgba(0,80,120,.22),0 0 0 1px rgba(80,220,190,.10) inset!important}
html.nx-android-smooth body #mineBtn.nx-future-miner:hover:not(:disabled){transform:none!important}
html.nx-android-smooth body #mineBtn.nx-future-miner::before,html.nx-android-smooth body #mineBtn.nx-future-miner::after,html.nx-android-smooth body .nx-mining-reactor::before,html.nx-android-smooth body .nx-mining-reactor::after{animation:none!important}
html.nx-android-smooth body .nx-mining-bolt{filter:none!important}
html.nx-android-smooth body #moreMenu.more-menu.show{contain:layout paint style}
@media(max-width:700px){html.nx-android-smooth body .bottom-dock{background:#01070f!important;box-shadow:0 8px 24px rgba(0,0,0,.32)!important}}
</style>
<script id="nxAndroidSmoothnessEarlyV1">
(function(){
  document.documentElement.classList.add('nx-android-smooth');
  function fastSplash(){ try{ window.__nexusAndroidReleaseSplash?.(); }catch(_){} }
  setTimeout(fastSplash, 650);
  setTimeout(fastSplash, 900);
})();
</script>'''
    page=page.replace('</head>',perf+'\n</head>',1)
    end = r'''<script id="nxAndroidSmoothnessLateV1">
(function(){
  'use strict';
  if(window.__nxAndroidSmoothnessLateV1)return;
  window.__nxAndroidSmoothnessLateV1=true;
  function announce(name){
    try{ window.dispatchEvent(new CustomEvent('nexusnova:tab-changed',{detail:{name:String(name||'')}})); }catch(_){}
  }
  document.addEventListener('click',function(e){
    var dock=e.target.closest('.bottom-dock .dock-item');
    if(dock){
      var oc=String(dock.getAttribute('onclick')||'');
      var m=oc.match(/switchTab\(['\"]([^'\"]+)/);
      if(m) setTimeout(function(){announce(m[1]);},0);
    }
    if(e.target.closest('#moreBtn')) setTimeout(function(){announce('allapps');},0);
    var item=e.target.closest('#moreMenu .more-item');
    if(item){
      var oc2=String(item.getAttribute('onclick')||'');
      var m2=oc2.match(/openMoreTab\(['\"]([^'\"]+)/);
      if(m2) setTimeout(function(){announce(m2[1]);},0);
    }
  },true);
})();
</script>
<!-- nx-video-smoothness-v1 -->'''
    page=page.replace('</body>',end+'\n</body>',1)
write(p,page)

# ---------- page2 core: no animated blank tab transition, no hidden heavy refresh ----------
p,core=read('js/page2-core.js')
if 'nx-video-smooth-core-v1' not in core:
    core=core.replace('''    window.scrollTo({\n        top:0,\n        behavior:"smooth"\n    });''','''    window.scrollTo({\n        top:0,\n        behavior:"auto"\n    });\n\n    try { window.dispatchEvent(new CustomEvent('nexusnova:tab-changed',{detail:{name}})); } catch (_) {}''',1)

    core=re.sub(r'''setInterval\(\s*\(\) => \{\s*if\(typeof refreshWalletFoundation === "function"\)\{\s*refreshWalletFoundation\(\);\s*\}\s*\},\s*60000\s*\);''', '''setInterval(\n    () => {\n        if(document.visibilityState !== "visible") return;\n        if(!document.getElementById("tab-wallet")?.classList.contains("active")) return;\n        if(typeof refreshWalletFoundation === "function") refreshWalletFoundation();\n    },\n    180000\n);''', core, count=1, flags=re.S)

    core=re.sub(r'''setInterval\(\s*\(\) => \{\s*if\(miningActive\)\{\s*startMiningTicker\(\);\s*\}\s*\},\s*30000\s*\);''', '''// nx-video-smooth-core-v1: secure rewards-security-v1 owns mining rendering.\n// No legacy periodic mining re-render is allowed here.''', core, count=1, flags=re.S)

    pat=re.compile(r'''\(async function initNexusAI\(\)\{(?P<body>.*?)\n\}\)\(\);''',re.S)
    m=pat.search(core)
    if m:
        body=m.group('body')
        repl="""let nxAiInitPromise = null;\nfunction initNexusAIOnDemand(){\n    if(nxAiInitPromise) return nxAiInitPromise;\n    nxAiInitPromise = (async function(){"""+body+"""\n    })();\n    return nxAiInitPromise;\n}\nwindow.nexusInitAIOnDemand = initNexusAIOnDemand;\nif(!window.__nexusAndroidShell) void initNexusAIOnDemand();\nwindow.addEventListener('nexusnova:tab-changed', event => {\n    if(String(event?.detail?.name || '') === 'ai') void initNexusAIOnDemand();\n});"""
        core=core[:m.start()]+repl+core[m.end():]
    else:
        if 'function initNexusAIOnDemand' not in core:
            raise SystemExit('AI lazy-init patch point missing')
    if 'nx-video-smooth-core-v1' not in core:
        core='/* nx-video-smooth-core-v1 */\n'+core
write(p,core)

# ---------- rewarded ad: one tap queues ad; user never has to tap 2-3 times ----------
p,boost=read('js/nexusnova-admob-nexus-pass-v1.js')
if 'nx-one-tap-rewarded-queue-v1' not in boost:
    boost=boost.replace("  let pendingKind = '';", "  let pendingKind = '';\n  let rewardedRequestPending = false;",1)
    boost=boost.replace("|| (stored ? false : !adReady);", "|| (stored ? false : rewardedRequestPending || rewardedScreenOpen);",2)
    boost=boost.replace("          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…';", "          : rewardedRequestPending ? 'AD PREPARING • OPENS AUTOMATICALLY'\n          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'TAP • AD LOADS AUTOMATICALLY';",2)

    guard="""    if (rewardedRequestPending || rewardedScreenOpen || pendingKind) {\n      const busyNode = statusNode();\n      if (busyNode) busyNode.textContent = 'Rewarded ad is preparing • it will open automatically';\n      return { shown:false, reason:'ad-request-pending' };\n    }\n"""
    needle="""    clearTimeout(pendingKindClearTimer);\n    pendingKindClearTimer = null;\n    pendingKind = expected;\n"""
    if needle not in boost: raise SystemExit('rewarded queue insertion point missing')
    boost=boost.replace(needle,guard+needle,1)
    boost=boost.replace("    if (!post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected, testOnly:true })) {\n      pendingKind = '';", "    if (!post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected, testOnly:true })) {\n      rewardedRequestPending = false;\n      pendingKind = '';",1)
    boost=boost.replace("    const node = statusNode();\n    if (node) node.textContent = rewardedReady ? `Opening ${kindLabel(expected)} ad…` : 'Rewarded ad is still preparing…';", "    rewardedRequestPending = true;\n    const node = statusNode();\n    if (node) node.textContent = rewardedReady ? `Opening ${kindLabel(expected)} ad…` : 'Rewarded ad is preparing • it will open automatically';",1)

    boost=boost.replace("      case 'rewarded-ready':\n        rewardedReady = true;\n        break;", "      case 'rewarded-preparing':\n      case 'rewarded-retrying':\n        rewardedRequestPending = true;\n        rewardedReady = false;\n        break;\n      case 'rewarded-format-failed':\n        rewardedRequestPending = true;\n        break;\n      case 'rewarded-ready':\n        rewardedReady = true;\n        break;",1)
    boost=boost.replace("      case 'rewarded-showing':\n      case 'rewarded-opened':\n        rewardedReady = false;", "      case 'rewarded-showing':\n      case 'rewarded-opened':\n        rewardedRequestPending = false;\n        rewardedReady = false;",1)
    boost=boost.replace("      case 'rewarded-earned':\n        rewardedReady = false;", "      case 'rewarded-earned':\n        rewardedRequestPending = false;\n        rewardedReady = false;",1)
    boost=boost.replace("      case 'rewarded-dismissed':\n        rewardedScreenOpen = false;", "      case 'rewarded-dismissed':\n        rewardedRequestPending = false;\n        rewardedScreenOpen = false;",1)
    boost=boost.replace("      case 'rewarded-failed':\n        rewardedReady = false;", "      case 'rewarded-failed':\n        rewardedRequestPending = false;\n        rewardedReady = false;",1)
    boost=boost.replace("      rewardedReady,\n      interstitialReady,", "      rewardedReady,\n      rewardedRequestPending,\n      interstitialReady,",1)
    boost='/* nx-one-tap-rewarded-queue-v1 */\n'+boost
write(p,boost)

# ---------- remove background observers/timers that keep main thread busy ----------
p,s=read('js/nexusnova-speed-meter-sync-v2.js')
s=s.replace("  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});\n", "  window.addEventListener('nexusnova:tab-changed',e=>{if(String(e?.detail?.name||'')==='tools')setTimeout(install,0)});\n",1)
write(p,s)

p,s=read('js/nexusnova-allapps-order-guard-v5.js')
s=s.replace("    const main=document.querySelector('main.main')||document.querySelector('main');\n    if(main)new MutationObserver(scheduleRepair).observe(main,{childList:true,subtree:true});\n", "    window.addEventListener('nexusnova:tab-changed',e=>{if(String(e?.detail?.name||'')==='allapps')scheduleRepair()});\n",1)
write(p,s)

p,s=read('js/nexusnova-ad-privacy-v1.js')
s=re.sub(r'''\n  const observer = new MutationObserver\(\(\) => \{\n    if \(settingsTab\(\)\) ensureCard\(\);\n  \}\);\n  observer\.observe\(document\.documentElement, \{ childList:true, subtree:true \}\);\n''', "\n  window.addEventListener('nexusnova:tab-changed',event=>{\n    const name=String(event?.detail?.name||'');\n    if(name==='about' || name==='settings') setTimeout(ensureCard,0);\n  });\n", s, count=1)
write(p,s)

p,s=read('js/nexusnova-android-ux-repair-v1.js')
s=s.replace("  setInterval(repairMiningButton, 1000);\n", "",1)
write(p,s)

p,s=read('js/nexusnova-android-mining-modern-v2.js')
mobile_pat=re.compile(r'''      @media\(max-width:700px\)\{.*?\}\n      @media\(max-width:390px\)''',re.S)
clean_mobile="""      @media(max-width:700px){body .bottom-dock{left:10px!important;right:10px!important;bottom:10px!important;border-radius:22px!important;overflow:hidden!important;padding:0!important;max-height:82px!important;background:#01070f!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}body .bottom-dock .dock-inner{height:72px!important;padding:4px!important;align-items:stretch!important}body .bottom-dock .dock-item{min-height:64px!important;height:64px!important;padding:6px 2px 5px!important;border-radius:17px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1!important}body .bottom-dock .dock-item span{font-size:9px!important;margin-top:3px!important;letter-spacing:.02em!important}.bottom-dock .dock-item .mi-icon{margin:0!important;line-height:1!important}body{padding-bottom:calc(148px + env(safe-area-inset-bottom))!important}body .main{padding-bottom:calc(148px + env(safe-area-inset-bottom))!important}#${PULSE_ID}{border-radius:16px;padding:10px}.nx-mp-label{font-size:8px}.nx-mp-chip{font-size:7px;padding:4px 6px}}\n      @media(max-width:390px)"""
s,n=mobile_pat.subn(clean_mobile,s,count=1)
if n==0 and 'body .bottom-dock .dock-inner{height:72px' not in s: raise SystemExit('modern mobile CSS patch missing')
s=s.replace("  function render(){\n    const pulse = ensurePulse();", "  function render(){\n    const home=document.getElementById('tab-home');\n    if(document.hidden || (home && !home.classList.contains('active'))) return;\n    const pulse = ensurePulse();",1)
s=s.replace("renderTimer=setInterval(render,750)","renderTimer=setInterval(render,1800)",1)
write(p,s)

p,s=read('js/nexusnova-nova-vault-v1.js')
s=s.replace("  function render() {\n    if (!installPanel()) return;", "  function render() {\n    const home=document.getElementById('tab-home');\n    if(document.hidden || (home && !home.classList.contains('active'))) return;\n    if (!installPanel()) return;",1)
write(p,s)

p,s=read('js/wallet-onchain-sync-v3.js')
s=s.replace("    setInterval(refresh, 10000);", "    setInterval(()=>{if(document.visibilityState==='visible'&&document.getElementById('tab-wallet')?.classList.contains('active'))refresh()}, 30000);",1)
write(p,s)

for rel in ['js/nexusnova-allinone-hub-v1.js','js/nexusnova-tools-hub-v1.js']:
    p,s=read(rel)
    s=s.replace('setInterval(clocks,1000)','setInterval(clocks,5000)')
    s=s.replace('setInterval(renderWorldClocks, 1000)','setInterval(renderWorldClocks, 5000)')
    write(p,s)

# ---------- secure mining read-only cache: eliminate long blank/sync appearance ----------
p,rewards=read('js/rewards-security-v1.js')
if 'nx-mining-display-cache-v1' not in rewards:
    rewards=rewards.replace("  let miningStartAdPending = false;", "  let miningStartAdPending = false;\n  let cachedMiningDisplay = null;\n  const DISPLAY_CACHE_PREFIX = 'nx:mining-display:v1:';\n  const DISPLAY_CACHE_MAX_AGE_MS = 7 * DAY;",1)
    insert=r'''
  function readMiningDisplayCache(uid) {
    try {
      const raw=JSON.parse(localStorage.getItem(DISPLAY_CACHE_PREFIX+uid)||'null');
      if(!raw || raw.uid!==uid || Date.now()-Number(raw.savedAt||0)>DISPLAY_CACHE_MAX_AGE_MS) return null;
      return raw;
    } catch (_) { return null; }
  }
  function writeMiningDisplayCache() {
    if(!currentUid || !miningState.known) return;
    try {
      localStorage.setItem(DISPLAY_CACHE_PREFIX+currentUid,JSON.stringify({
        uid:currentUid,savedAt:Date.now(),active:miningState.active===true,
        startedAt:Number(miningState.startedAt)||0,balance:Number(miningState.balance)||0,
        totalMined:Number(miningState.totalMined)||0
      }));
    } catch (_) {}
  }
'''
    rewards=rewards.replace("  function el(id) { return document.getElementById(id); }", "  function el(id) { return document.getElementById(id); }\n"+insert,1)

    unknown="""    if (!miningState.known) {\n      button.dataset.state = syncError ? 'error' : 'ready';\n      button.classList.remove('active');\n      text.textContent = syncError ? 'RETRY SECURE SYNC' : 'SYNCING MINING';\n      timer.classList.toggle('nx-error', Boolean(syncError));\n      timer.textContent = syncError ? 'SESSION SYNC DELAYED • TAP TO RETRY' : 'CHECKING SECURE SESSION';\n      return;\n    }"""
    cached="""    if (!miningState.known) {\n      if (cachedMiningDisplay) {\n        const cachedActive=cachedMiningDisplay.active===true;\n        const cachedStart=Number(cachedMiningDisplay.startedAt)||0;\n        button.disabled=true;\n        button.dataset.state=cachedActive?'active':'ready';\n        button.classList.toggle('active',cachedActive);\n        text.textContent=cachedActive?'MINING ACTIVE':'START MINING';\n        if(cachedActive && cachedStart>0){\n          const left=Math.max(0,DAY-Math.max(0,Date.now()-cachedStart)-Math.max(0,Number(miningPreviewOffsetMs)||0));\n          timer.textContent=formatClock(left);\n          setVisibleBalance(Number(cachedMiningDisplay.balance||0)+Math.min(MINING_REWARD,Math.max(0,Date.now()-cachedStart)/HOUR));\n        } else {\n          timer.textContent='MINER OFFLINE';\n          setVisibleBalance(Number(cachedMiningDisplay.balance||0));\n        }\n        const note=button.querySelector('.nx-mining-note');\n        if(note) note.textContent='RESTORING SECURE SESSION • LAST VERIFIED DISPLAY';\n        return;\n      }\n      button.disabled=false;\n      button.dataset.state = syncError ? 'error' : 'ready';\n      button.classList.remove('active');\n      text.textContent = syncError ? 'RETRY SECURE SYNC' : 'SYNCING MINING';\n      timer.classList.toggle('nx-error', Boolean(syncError));\n      timer.textContent = syncError ? 'SESSION SYNC DELAYED • TAP TO RETRY' : 'CHECKING SECURE SESSION';\n      return;\n    }"""
    if unknown not in rewards: raise SystemExit('mining unknown render block missing')
    rewards=rewards.replace(unknown,cached,1)
    rewards=rewards.replace("    renderMiningAuthoritative();\n  }\n\n  async function firebaseModules()", "    cachedMiningDisplay=null;\n    writeMiningDisplayCache();\n    const note=el('mineBtn')?.querySelector('.nx-mining-note');\n    if(note) note.textContent='SECURE NVX REACTOR • FIRESTORE VERIFIED';\n    renderMiningAuthoritative();\n  }\n\n  async function firebaseModules()",1)
    rewards=rewards.replace("      currentUid = user?.uid || '';\n      if (!user) {", "      currentUid = user?.uid || '';\n      cachedMiningDisplay = user ? readMiningDisplayCache(user.uid) : null;\n      if (!user) {",1)
    rewards='/* nx-mining-display-cache-v1 */\n'+rewards
write(p,rewards)

checks={
 'page2.html':[MARKER,'nxAndroidSmoothnessV1','nexusnova:tab-changed'],
 'js/page2-core.js':['nx-video-smooth-core-v1','behavior:"auto"','180000'],
 'js/nexusnova-admob-nexus-pass-v1.js':['nx-one-tap-rewarded-queue-v1','rewardedRequestPending','AD PREPARING • OPENS AUTOMATICALLY'],
 'js/rewards-security-v1.js':['nx-mining-display-cache-v1','LAST VERIFIED DISPLAY'],
 'js/nexusnova-android-mining-modern-v2.js':['.bottom-dock .dock-inner{height:72px','setInterval(render,1800)'],
}
for rel,needles in checks.items():
    txt=(ROOT/rel).read_text(encoding='utf-8')
    for needle in needles:
        if needle not in txt: raise SystemExit(f'Verification failed {rel}: {needle}')
for rel in ['js/nexusnova-speed-meter-sync-v2.js','js/nexusnova-ad-privacy-v1.js']:
    txt=(ROOT/rel).read_text(encoding='utf-8')
    if 'observe(document.documentElement' in txt: raise SystemExit(f'Global observer still present: {rel}')
print('Applied video smoothness v1: one-tap rewarded queue, stable mining compositor, instant tabs, background-work throttling, and cached secure display hydration.')
