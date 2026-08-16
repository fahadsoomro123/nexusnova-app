from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
MARKER = 'nx-video-smoothness-v3-perf'

def update(rel, transform):
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f'Missing Android performance input: {path}')
    src = path.read_text(encoding='utf-8')
    src = transform(src)
    path.write_text(src, encoding='utf-8')
    return src

# Late ALL APPS wrappers were reintroducing JS smooth scrolling after page2-core.
update('js/nexusnova-final-user-fixes-v1.js', lambda s: s.replace("behavior: 'smooth'", "behavior: 'auto'"))

# A hidden wallet refresh landed roughly once a minute while the user was
# scrolling ALL APPS. Only refresh prices in the visible Wallet screen.
def patch_failsafe(src):
    old = '''        setInterval(
            loadWalletPrices,
            60000
        );'''
    new = '''        setInterval(
            () => {
                if(document.visibilityState !== "visible") return;
                if(!document.getElementById("tab-wallet")?.classList.contains("active")) return;
                loadWalletPrices();
            },
            180000
        );'''
    if old in src:
        return src.replace(old, new, 1)
    if '180000' not in src or 'tab-wallet' not in src:
        raise SystemExit('Failsafe wallet refresh patch point missing.')
    return src
update('js/core-failsafe-core.js', patch_failsafe)

# Top ticker stays live but does not need to repaint every 30 seconds.
def patch_ticker(src):
    old = 'setInterval(loadTicker, 30000);'
    new = "setInterval(()=>{if(document.visibilityState==='visible')loadTicker()}, 60000);"
    if old in src:
        return src.replace(old, new, 1)
    if new not in src:
        raise SystemExit('Ticker throttle patch point missing.')
    return src
update('js/ticker-fix.js', patch_ticker)

# Health checks are useful diagnostics, not a foreground animation. Move them
# away from startup and reduce their periodic frequency on the native shell.
def patch_health(src):
    src = src.replace('const CHECK_INTERVAL_MS = 60 * 1000;', 'const CHECK_INTERVAL_MS = 3 * 60 * 1000;', 1)
    src = src.replace('scheduleRun(2800);', 'scheduleRun(7000);', 1)
    src = src.replace(
        'intervalId = setInterval(() => runHealthCheck().catch(() => {}), CHECK_INTERVAL_MS);',
        "intervalId = setInterval(() => { if(document.visibilityState==='visible') runHealthCheck().catch(() => {}); }, CHECK_INTERVAL_MS);",
        1
    )
    return src
update('js/nexusnova-health-monitor-v1.js', patch_health)

# Compatibility loader used a 50ms poll while waiting for the native ad bridge.
# 200ms is responsive to a human tap and cuts the startup polling work by 75%.
def patch_reward_loader(src):
    if '        }, 50);' in src:
        return src.replace('        }, 50);', '        }, 200);', 1)
    return src
update('js/nexusnova-rewarded-ads-v1.js', patch_reward_loader)

# Currency guard no longer needs twenty background DOM passes. Recheck on the
# finance tab event instead.
def patch_integrity(src):
    src = src.replace('if (converterPasses >= 20) clearInterval(converterGuard);', 'if (converterPasses >= 5) clearInterval(converterGuard);', 1)
    src = src.replace(
        '    }, 2000);\n    assertReliableConverter();',
        "    }, 4000);\n    window.addEventListener('nexusnova:tab-changed', e => { if(String(e?.detail?.name||'')==='finance') setTimeout(assertReliableConverter,0); });\n    assertReliableConverter();",
        1
    )
    return src
for rel in ('js/final-integrity-fix-core.js','js/final-integrity-core.js'):
    update(rel, patch_integrity)

# Durable marker and verification.
page = ROOT / 'page2.html'
page_src = page.read_text(encoding='utf-8')
if MARKER not in page_src:
    page_src = page_src.replace('</body>', f'<!-- {MARKER} -->\n</body>', 1)
    page.write_text(page_src, encoding='utf-8')

final_failsafe = (ROOT/'js/core-failsafe-core.js').read_text(encoding='utf-8')
final_nav = (ROOT/'js/nexusnova-final-user-fixes-v1.js').read_text(encoding='utf-8')
if "behavior: 'smooth'" in final_nav:
    raise SystemExit('Late smooth-scroll navigation remains in Android shell.')
if '180000' not in final_failsafe or 'tab-wallet' not in final_failsafe:
    raise SystemExit('Hidden wallet refresh is not gated.')
print('Applied Android smoothness v3: hidden wallet/ticker/health work throttled, late smooth scrolling removed, and ad-loader polling reduced.')
