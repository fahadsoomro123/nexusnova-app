from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
PAGE = ROOT / 'page2.html'
VAULT = ROOT / 'js/nexusnova-nova-vault-v1.js'
UX_SOURCE = Path('js/nexusnova-android-ux-repair-v1.js')
UX_TARGET = ROOT / 'js/nexusnova-android-ux-repair-v1.js'
MARKER = 'nx-android-ux-repair-v1'

for path in (PAGE, VAULT, UX_SOURCE):
    if not path.exists():
        raise SystemExit(f'Missing Android UX patch input: {path}')

page = PAGE.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')

# Always copy the canonical UX helper into the deterministic APK web shell.
UX_TARGET.parent.mkdir(parents=True, exist_ok=True)
UX_TARGET.write_text(UX_SOURCE.read_text(encoding='utf-8'), encoding='utf-8')

# ---------------------------------------------------------------------------
# 1) Startup splash: branding stays visible briefly, but app interactivity must
#    not wait for window.load/network APIs. Android already serves local assets.
# ---------------------------------------------------------------------------
page = page.replace('var minMs = 2800;', 'var minMs = 850;', 1)
legacy_ready = '''  if(document.readyState === "complete") ready();
  else window.addEventListener("load", ready);
'''
fast_ready = '''  if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, {once:true});
  } else {
    ready();
  }
  setTimeout(hide, 1350);
'''
if legacy_ready in page:
    page = page.replace(legacy_ready, fast_ready, 1)

# Load the Android-only visual guard at the end of the local shell. It is
# presentation-only and cannot write mining/reward state.
script_tag = '<script src="./js/nexusnova-android-ux-repair-v1.js?v=1" data-nx-android-ux-repair="1"></script>'
if script_tag not in page:
    if '</body>' not in page:
        raise SystemExit('page2.html closing body not found for Android UX guard.')
    page = page.replace('</body>', f'  {script_tag}\n</body>', 1)

# ---------------------------------------------------------------------------
# 2) TEST Vault: remove the placeholder debug modal. A TEST Vault still never
#    mints production value, but now shows a clearly-labelled weighted preview
#    so the complete opening/reveal interaction can be tested.
# ---------------------------------------------------------------------------
old_test = """        await showMessage('TEST Nova Vault Opened', 'Debug Vault flow confirmed. No production NVX or inventory was minted from this TEST Vault.', 'spark');
        return { testOnly:true };
"""
new_test = """        const preview = window.NexusNovaVaultReveal?.testReward?.() || { type:'reward', amount:0, test:true };
        if (typeof window.NexusNovaVaultReveal?.play === 'function') {
          await window.NexusNovaVaultReveal.play({ ...preview, test:true });
        } else {
          await showMessage('TEST Nova Vault Opened', 'TEST Vault consumed safely. Production balance and inventory were not changed.', 'spark');
        }
        return { testOnly:true, reward:preview };
"""
if old_test in vault:
    vault = vault.replace(old_test, new_test, 1)
elif 'NexusNovaVaultReveal?.testReward' not in vault:
    raise SystemExit('TEST Vault placeholder popup patch point not found.')

# ---------------------------------------------------------------------------
# 3) Production Vault: server remains authoritative. Only after the server has
#    returned the actual type/amount do we animate the exact reward received.
# ---------------------------------------------------------------------------
old_prod = """    await showMessage('Nova Vault Opened', `${copy} A 15-second cooldown is now active.`, type === 'time-warp' ? 'spark' : 'security');
    return result;
"""
new_prod = """    if (typeof window.NexusNovaVaultReveal?.play === 'function') {
      await window.NexusNovaVaultReveal.play({ type, amount, test:false });
    } else {
      await showMessage('Nova Vault Opened', `${copy} A 15-second cooldown is now active.`, type === 'time-warp' ? 'spark' : 'security');
    }
    return result;
"""
if old_prod in vault:
    vault = vault.replace(old_prod, new_prod, 1)
elif 'NexusNovaVaultReveal?.play' not in vault:
    raise SystemExit('Production Vault reward reveal patch point not found.')

# Durable markers make the generated shell easy to verify/debug.
if MARKER not in page:
    page = page.replace(script_tag, f'<!-- {MARKER} -->\n  {script_tag}', 1)

PAGE.write_text(page, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')

checks = [
    (PAGE, MARKER),
    (PAGE, 'var minMs = 850;'),
    (PAGE, 'DOMContentLoaded'),
    (PAGE, 'nexusnova-android-ux-repair-v1.js?v=1'),
    (UX_TARGET, 'window.NexusNovaVaultReveal = Object.freeze'),
    (UX_TARGET, "label = 'MINING ACTIVE'"),
    (UX_TARGET, 'setTimeout(releaseSplash, 1350)'),
    (VAULT, 'NexusNovaVaultReveal?.testReward'),
    (VAULT, "NexusNovaVaultReveal?.play === 'function'"),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Android UX repair verification failed: {path} -> {needle}')

print('Applied Android UX repair: fast splash, canonical mining label, and animated Nova Vault reward reveal.')
