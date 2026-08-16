from pathlib import Path

REWARDS = Path('NexusNovaAndroid/app/src/main/assets/www/js/rewards-security-v1.js')
MARKER = 'nx-mining-cache-handoff-v2'

src = REWARDS.read_text(encoding='utf-8')
if MARKER in src:
    print('Mining cache handoff v2 already applied.')
    raise SystemExit(0)

if 'nx-mining-display-cache-v1' not in src:
    raise SystemExit('Video smoothness display cache v1 must run first.')

needle = """      return;
    }

    if (!miningState.active) {
"""
replacement = """      return;
    }

    // Cached state is display-only and temporarily disables interaction. As
    // soon as Firestore becomes authoritative again, restore normal button use.
    button.disabled = false;

    if (!miningState.active) {
"""
if needle not in src:
    raise SystemExit('Authoritative mining handoff patch point not found.')
src = src.replace(needle, replacement, 1)
src = f'/* {MARKER} */\n' + src
REWARDS.write_text(src, encoding='utf-8')

final = REWARDS.read_text(encoding='utf-8')
if 'button.disabled = false;' not in final or MARKER not in final:
    raise SystemExit('Mining cache handoff verification failed.')
print('Applied mining cache handoff v2: cached display cannot leave the mining button disabled after authoritative sync.')
