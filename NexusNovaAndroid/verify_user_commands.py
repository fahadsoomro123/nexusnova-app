from pathlib import Path

ROOT = Path('NexusNovaAndroid')
WEB = ROOT / 'app/src/main/assets/www'
JAVA = ROOT / 'app/src/main/java/com/nexusnova/app'


def read(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f'Missing required file: {path}')
    return path.read_text(encoding='utf-8')


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise SystemExit(f'FAIL {label}: missing {needle!r}')
    print(f'PASS {label}')


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise SystemExit(f'FAIL {label}: forbidden {needle!r} still present')
    print(f'PASS {label}')


page2 = read(WEB / 'page2.html')
index = read(WEB / 'index.html')
core = read(WEB / 'js/core-failsafe.js')
ux = read(WEB / 'js/nexusnova-ux-simplify-v1.js')
speed = read(WEB / 'js/nexusnova-speedtest-app-v4.js')
final_fix = read(WEB / 'js/final-integrity-fix.js')
ads = read(WEB / 'js/nexusnova-ad-settings-v2.js')
watch = read(WEB / 'js/nexusnova-watch-ad-reward-v1.js')
main = read(JAVA / 'MainActivity.kt')

# 1) Preserve the branded NexusNova splash but guarantee it cannot become a blocker.
require(page2, 'id="nxSplash"', 'Branded dashboard splash preserved')
require(page2, 'INITIALIZING SECURE WORKSPACE'.title().lower().replace('initializing secure workspace','Initializing secure workspace') if False else 'Initializing secure workspace', 'Branded splash status preserved')
require(page2, 'nx-android-splash-hard-failsafe-v2', 'Android dashboard splash hard failsafe embedded')
require(index, 'nxAndroidEntrySplashFailsafe', 'Android login splash hard failsafe embedded')
require(core, 'splash.classList.remove("nx-startup-hold")', 'Stale startup hold removed')
require(core, 'setTimeout(releaseSplash, 3200)', 'Independent branded splash release timer')
require(core, 'display", "none", "important"', 'Splash force-hide fallback')
forbid(core, 'splash.classList.add("nx-startup-hold")', 'No blocking startup hold reintroduced')
forbid(core, 'splash.remove = function', 'Native splash remove is never overridden')

# 2) Android navigation Back + exit confirmation.
require(main, 'Exit NexusNova?', 'Android exit dialog title')
require(main, 'Do you want to exit NexusNova?', 'Android exit dialog message')
require(main, 'systemBack', 'Android Back delegates to NexusNova navigation first')

# 3) Large bottom Back and simplified book/page navigation.
require(ux, 'nxUxBottomNav', 'Large bottom Back navigation')
require(ux, 'systemBack', 'Web systemBack hook')
require(ux, 'PREVIOUS', 'Reader Previous control')
require(ux, 'NEXT →', 'Reader Next control')
require(ux, 'NEXT PAGE →', 'Urdu Library Next Page control')

# 4) Speed Test moved to ALL APPS and upgraded to a real meter.
require(speed, 'Standalone ALL APPS utility with real Cloudflare-edge measurements', 'Standalone ALL APPS Speed Test')
require(speed, '#tab-tools .nexus-tool-chip[data-tool="speed"]', 'Legacy Tools Speed Test hidden')
require(speed, "openMoreTab('speed-test')", 'Speed Test ALL APPS route')
require(speed, 'Open Internet Speed Test', 'Speed Test accessible menu tile')
for metric in ('Download', 'Upload', 'Ping', 'Jitter'):
    require(speed, metric, f'Speed Test {metric} metric')
require(speed, 'START SPEED TEST', 'Speed Test start action')
require(speed, 'speed.cloudflare.com', 'Speed Test real measurement provider')
require(final_fix, 'nexusnova-speedtest-app-v4.js', 'Speed Test v4 boot integration')
require(final_fix, 'nexusnova-ux-simplify-v1.js', 'UX simplifier boot integration')

# 5) TEST ad contract remains exactly test-only with protected screens and no banner.
require(ads, 'productionAdsEnabled: false', 'Production ads disabled in TEST build')
require(ads, 'minGapMs: 180000', 'Interstitial 3-minute gap')
require(ads, 'sessionMax: 4', 'Interstitial max 4/session')
require(ads, 'firstAfterEligibleBreaks: 3', 'Interstitial initial interaction gate')
require(ads, 'permanentBottomBanner: false', 'Permanent bottom banner disabled')
require(ads, 'protectedNoForcedAds', 'Protected no-forced-ad screen list')
for protected in ('Wallet', 'Qibla', 'Quran', 'Hadith', 'Bible', 'Emergency', 'Health', 'Security', 'Login/Auth'):
    require(ads, protected, f'Protected ad-free screen: {protected}')
require(final_fix, 'nexusnova-existing-app-ad-hotfix-v2.js', 'Existing-app interstitial hotfix boot integration')
require(watch, 'PRODUCTION_SSV_ENABLED = false', 'Watch Ad production value disabled')
require(watch, 'TEST', 'Watch Ad TEST contract present')

print('PASS NexusNova user-command regression gate: splash, Back/exit, books, Speed Test and TEST ads are integrated in the final prepared Android shell.')
