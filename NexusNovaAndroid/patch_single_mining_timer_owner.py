from pathlib import Path
import re

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
FAILSAFE = ROOT / 'core-failsafe-core.js'
PAGE2 = ROOT / 'page2-core.js'
REWARDS = ROOT / 'rewards-security-v1.js'
MARKER = 'nx-single-mining-timer-owner-v1'

for path in (FAILSAFE, PAGE2, REWARDS):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android asset: {path}')

failsafe = FAILSAFE.read_text(encoding='utf-8')
page2 = PAGE2.read_text(encoding='utf-8')
rewards = REWARDS.read_text(encoding='utf-8')

if MARKER not in failsafe:
    pattern = re.compile(
        r'        function setMinerUI\(active,start\)\{.*?\n        \}\n\n        async function loadUser\(\)\{',
        re.S,
    )
    replacement = '''        function setMinerUI(active,start){
            // nx-single-mining-timer-owner-v1
            // Mining UI is owned exclusively by rewards-security-v1.js.
            // The failsafe may recover navigation/market/wallet, but it must
            // never run a second countdown or overwrite #timer/#btnText.
            clearInterval(tickerTimer);
            tickerTimer = null;
            try{
                if(typeof window.nexusSecureRenderMining === "function"){
                    window.nexusSecureRenderMining();
                }
            }catch(_){}
        }

        async function loadUser(){'''
    failsafe, count = pattern.subn(replacement, failsafe, count=1)
    if count != 1:
        raise SystemExit('Could not neutralize legacy failsafe mining ticker.')

# The old page2 implementation is intentionally shadowed by the secure wrapper.
# Verify that the effective wrapper still delegates to the single owner.
required_page2 = [
    'document.getElementById("mineBtn").onclick = function(){',
    'window.nexusSecureStartMining',
    'function startMiningTicker(){',
    'window.nexusSecureRenderMining',
    'window.nexusSecureFinishMining',
]
for needle in required_page2:
    if needle not in page2:
        raise SystemExit(f'page2 secure mining wrapper missing: {needle}')

# The secure owner must expose the authoritative renderer and TEST preview hook.
required_rewards = [
    'window.nexusSecureRenderMining',
    'window.nexusSecureMiningState',
]
for needle in required_rewards:
    if needle not in rewards:
        raise SystemExit(f'Secure mining owner missing: {needle}')

# After patching, the failsafe must contain zero direct timer writers.
if 'timer.textContent' in failsafe:
    raise SystemExit('Failsafe still writes the mining timer after single-owner patch.')
if 'setInterval(\n                    tick,\n                    1000' in failsafe:
    raise SystemExit('Failsafe legacy mining interval survived the single-owner patch.')

FAILSAFE.write_text(failsafe, encoding='utf-8')

final = FAILSAFE.read_text(encoding='utf-8')
for needle in (MARKER, 'window.nexusSecureRenderMining', 'tickerTimer = null;'):
    if needle not in final:
        raise SystemExit(f'Single-owner mining verification failed: {needle}')

print('Single-owner mining enforced: legacy failsafe cannot write #timer or run a competing mining ticker.')
