from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
INDEX = ROOT / 'index.html'
PAGE = ROOT / 'page2.html'
ANALYTICS = ROOT / 'js/nexusnova-analytics-v1.js'
AUTH_V2 = ROOT / 'js/nexusnova-auth-page-v2.js'
MARKER = 'nx-android-startup-smooth-v1'

for path in (INDEX, PAGE, ANALYTICS):
    if not path.exists():
        raise SystemExit(f'Missing Android startup input: {path}')

index = INDEX.read_text(encoding='utf-8')
page = PAGE.read_text(encoding='utf-8')
analytics = ANALYTICS.read_text(encoding='utf-8')
auth_v2 = AUTH_V2.read_text(encoding='utf-8') if AUTH_V2.exists() else ''

# 1) Login startup. The current Auth v2 page already has a bounded,
# non-blocking splash contract. Patch the controller instead of looking for the
# retired inline Firebase/login markup. Keep the legacy path for older shells.
uses_auth_v2 = 'nexusnova-auth-page-v2.js' in index and bool(auth_v2)

if uses_auth_v2:
    # Native Android should open in returning-user login mode by default while
    # preserving the signup toggle for new users.
    if 'applyMode(false);' in auth_v2:
        auth_v2 = auth_v2.replace('applyMode(false);', 'applyMode(nativeShell);', 1)
    elif 'applyMode(nativeShell);' not in auth_v2:
        raise SystemExit('Auth v2 native login-mode hook not found.')

    # Preserve an explicit native route marker so Android-only hydration and
    # safety guards remain deterministic after login navigation.
    old_redirect = "  window.location.replace('./page2.html');"
    new_redirect = "  window.location.replace(nativeShell ? './page2.html?nxAndroid=1' : './page2.html');"
    if old_redirect in auth_v2:
        auth_v2 = auth_v2.replace(old_redirect, new_redirect, 1)
    elif "./page2.html?nxAndroid=1" not in auth_v2:
        raise SystemExit('Auth v2 dashboard redirect hook not found.')

    # Verify the modern splash itself remains bounded and independent from the
    # Firebase module finishing forever.
    if "setTimeout(()=>releaseSplash(true),2200);" not in index:
        raise SystemExit('Auth v2 bounded splash release hook not found.')
else:
    # Legacy inline-auth compatibility for older prepared shells.
    index = index.replace('var minMs = 3200;', 'var minMs = 700;', 1)
    old_ready = '''  if(document.readyState === "complete") ready();
  else window.addEventListener("load", ready);
'''
    new_ready = '''  if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, {once:true});
  } else {
    ready();
  }
  setTimeout(hide, 1150);
'''
    if old_ready in index:
        index = index.replace(old_ready, new_ready, 1)
    elif 'setTimeout(hide, 1150);' not in index:
        raise SystemExit('Android login splash readiness block not found.')

    index = index.replace('<h1 id="title">Nexus<span>Nova</span></h1>', '<h1 id="title">Welcome Back</h1>', 1)
    index = index.replace('<p id="subtitle">Sign up to start mining</p>', '<p id="subtitle">Log in to your account</p>', 1)
    index = index.replace('<div class="captcha-box" id="captchaBox">', '<div class="captcha-box" id="captchaBox" style="display:none">', 1)
    index = index.replace('display:block!important;overflow:hidden!important;', 'overflow:hidden!important;', 1)
    index = index.replace('        Sign up with Email\n', '        Log in with Email\n', 1)
    index = index.replace('            Already have an account? Log in\n', "            Don't have an account? Sign up\n", 1)
    index = index.replace(
        'let loginMode = false;',
        "let loginMode = new URLSearchParams(location.search).get('nxAndroid') === '1' || location.pathname.startsWith('/nexusnova-native/');",
        1
    )
    index = index.replace(
        '            "./page2.html"\n',
        "            (location.pathname.startsWith('/nexusnova-native/') ? './page2.html?nxAndroid=1' : './page2.html')\n",
        1
    )

# 2) Dashboard should never advertise a false zero account while Firebase is
# restoring. A tiny non-blocking hydration layer changes placeholders only;
# the secure mining owner overwrites them as soon as the first snapshot lands.
hydration = r'''
<script data-nx-android-startup-hydration="1">
(function(){
  'use strict';
  var isAndroid = new URLSearchParams(location.search).get('nxAndroid') === '1' || location.pathname.startsWith('/nexusnova-native/');
  if (!isAndroid) return;
  document.documentElement.classList.add('nx-android-hydrating');
  function prime(){
    var balance=document.getElementById('balance');
    var usd=document.getElementById('usdValue');
    var timer=document.getElementById('timer');
    var label=document.getElementById('btnText');
    if(balance && /^0(?:\.0+)?$/.test(balance.textContent.trim())) balance.textContent='—';
    if(usd && /\$\s*0(?:\.0+)?/.test(usd.textContent)) usd.textContent='Restoring secure balance…';
    if(timer && /MINER OFFLINE/i.test(timer.textContent)) timer.textContent='RESTORING SESSION';
    if(label && /START MINING/i.test(label.textContent)) label.textContent='RESTORING MINING';
  }
  function release(){
    try {
      var state=window.nexusSecureMiningState?.();
      if(state && state.known===true){
        document.documentElement.classList.remove('nx-android-hydrating');
        return true;
      }
    }catch(_){}
    return false;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', prime,{once:true}); else prime();
  var tries=0;
  var id=setInterval(function(){ if(release() || ++tries>40) clearInterval(id); },125);
})();
</script>
'''
if 'data-nx-android-startup-hydration="1"' not in page:
    if '</body>' not in page:
        raise SystemExit('page2 closing body missing for hydration guard.')
    page = page.replace('</body>', hydration + '\n</body>', 1)

# 3) Analytics remains available in Settings/Profile, but no modal interrupts
# the first seconds after login on Android. Consent is still explicit opt-in.
needle = '''  function maybePrompt() {
    const consent = readConsent();
'''
replacement = '''  function maybePrompt() {
    if (new URLSearchParams(location.search).get('nxAndroid') === '1' || location.pathname.startsWith('/nexusnova-native/')) return;
    const consent = readConsent();
'''
if needle in analytics:
    analytics = analytics.replace(needle, replacement, 1)
elif "location.pathname.startsWith('/nexusnova-native/')" not in analytics:
    raise SystemExit('Analytics prompt hook not found.')

if MARKER not in index:
    index = index.replace('<body>', f'<body>\n<!-- {MARKER} -->', 1)

INDEX.write_text(index, encoding='utf-8')
PAGE.write_text(page, encoding='utf-8')
ANALYTICS.write_text(analytics, encoding='utf-8')
if uses_auth_v2:
    AUTH_V2.write_text(auth_v2, encoding='utf-8')

checks = [
    (INDEX, MARKER),
    (PAGE, 'data-nx-android-startup-hydration="1"'),
    (PAGE, 'RESTORING SESSION'),
    (ANALYTICS, "location.pathname.startsWith('/nexusnova-native/')"),
]
if uses_auth_v2:
    checks.extend([
        (INDEX, "setTimeout(()=>releaseSplash(true),2200);"),
        (AUTH_V2, 'applyMode(nativeShell);'),
        (AUTH_V2, './page2.html?nxAndroid=1'),
    ])
else:
    checks.extend([
        (INDEX, 'var minMs = 700;'),
        (INDEX, 'setTimeout(hide, 1150);'),
        (INDEX, "location.pathname.startsWith('/nexusnova-native/')"),
        (INDEX, './page2.html?nxAndroid=1'),
        (INDEX, '<h1 id="title">Welcome Back</h1>'),
        (INDEX, '<div class="captcha-box" id="captchaBox" style="display:none">'),
    ])

for path, marker in checks:
    if marker not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Android startup smooth verification failed: {path} -> {marker}')
if not uses_auth_v2 and 'display:block!important;overflow:hidden!important;' in index:
    raise SystemExit('Mobile captcha CSS still forces login captcha visible.')

print('Applied smooth Android startup: Auth v2 native login mode, bounded splash, preserved Android route, hydration placeholders, and deferred analytics prompt.')
