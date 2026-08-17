from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
PAGES = [ROOT / 'index.html', ROOT / 'page2.html']
MARKER = 'nx-android-startup-release-v3'

CRITICAL = '''
<!-- nx-android-startup-release-v3 -->
<style id="nxAndroidStartupReleaseV3">
@keyframes nxAndroidGuaranteedSplashExit {
  to { opacity:0; visibility:hidden; pointer-events:none; }
}
#nxSplash {
  animation: nxAndroidGuaranteedSplashExit .28s ease 2.45s forwards !important;
}
/* The primary navigation must never be left hidden by a stale startup state. */
.bottom-dock {
  display:block !important;
  visibility:visible !important;
  opacity:1 !important;
  pointer-events:auto !important;
}
.bottom-dock .dock-inner { display:flex !important; }
.bottom-dock .dock-item { visibility:visible !important; opacity:1 !important; pointer-events:auto !important; }
</style>
<script id="nxAndroidStartupReleaseV3Script">
(function(){
  'use strict';
  var born = Date.now();
  function release(){
    try {
      var splash = document.getElementById('nxSplash');
      if (!splash) return false;
      if (Date.now() - born < 2200) return false;
      splash.style.setProperty('pointer-events','none','important');
      splash.style.setProperty('opacity','0','important');
      splash.style.setProperty('visibility','hidden','important');
      splash.style.setProperty('display','none','important');
      splash.classList.add('hide');
      setTimeout(function(){ try { splash.remove(); } catch (_) {} }, 80);
      return true;
    } catch (_) { return false; }
  }
  function tick(){
    if (release()) return;
    if (Date.now() - born < 9000) setTimeout(tick, 120);
  }
  setTimeout(tick, 2200);
  window.__nexusAndroidStartupReleaseV3 = release;
})();
</script>
'''

for path in PAGES:
    if not path.exists():
        raise SystemExit(f'Missing Android startup page: {path}')
    text = path.read_text(encoding='utf-8')
    if MARKER not in text:
        marker = '<head>'
        if marker not in text:
            raise SystemExit(f'No <head> in {path}')
        text = text.replace(marker, marker + CRITICAL, 1)
        path.write_text(text, encoding='utf-8')

page = (ROOT / 'page2.html').read_text(encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')
for text, label in ((page, 'dashboard'), (index, 'login')):
    for token in (MARKER, 'nxAndroidGuaranteedSplashExit', '__nexusAndroidStartupReleaseV3'):
        if token not in text:
            raise SystemExit(f'Android {label} startup release v3 missing: {token}')

print('Applied Android startup release v3: branded splash has CSS + polling hard release and primary dock cannot remain hidden by stale startup state.')
