from pathlib import Path

BOOST = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js')
if not BOOST.exists():
    raise SystemExit(f'Missing prepared Android boost asset: {BOOST}')

boost = BOOST.read_text(encoding='utf-8')
MARKER = 'nx-test-boost-authoritative-compat-v1'
if MARKER in boost:
    print('TEST authoritative compatibility normalization already applied.')
    raise SystemExit(0)

old = """    if (testMode && active && !malformed) {
      const testOverlay = readTestRewardOverlay(anchorAt);
      if (testOverlay.extraUses > 0) {
        setTimeout(() => {
          try { window.nexusSecureAdoptMiningState?.({ miningActive:true, miningStartedAt:startedAt }); } catch (_) {}
        }, 0);
      }
    }
"""
new = """    if (testMode && active && !malformed) {
      const testOverlay = readTestRewardOverlay(anchorAt);
      // nx-test-boost-authoritative-compat-v1
      // Normalize the legacy nested hook so the following authoritative timer
      // patch can replace it atomically with a latest-overlay read.
      setTimeout(() => {
        try { window.nexusSecureAdoptMiningState?.({ miningActive:true, miningStartedAt:startedAt }); } catch (_) {}
      }, 0);
    }
"""

if old not in boost:
    # If the next patch has already converted this hook, compatibility work is
    # complete and must not fail a repeated build-time invocation.
    if 'const syncTestPreviewOffset = () => {' in boost:
        print('TEST snapshot hook is already authoritative; compatibility normalization not needed.')
        raise SystemExit(0)
    raise SystemExit('Legacy nested TEST snapshot hook not found for normalization.')

boost = boost.replace(old, new, 1)
BOOST.write_text(boost, encoding='utf-8')

final = BOOST.read_text(encoding='utf-8')
for needle in (MARKER, 'const testOverlay = readTestRewardOverlay(anchorAt);', 'miningStartedAt:startedAt'):
    if needle not in final:
        raise SystemExit(f'TEST authoritative compatibility verification failed: {needle}')

print('Normalized TEST snapshot hook for atomic authoritative-timer replacement.')
