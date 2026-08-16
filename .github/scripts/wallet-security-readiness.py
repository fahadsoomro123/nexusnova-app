from pathlib import Path
import re
import sys

ROOT = Path('.')
errors = []

ACTIONS_PATH = 'js/wallet-actions-v2.js'
SYNC_PATH = 'js/wallet-onchain-sync-v3.js'
CONNECT_PATH = 'js/wallet-connect-fix-v2.js'

# Mainnet token contracts verified against issuer/network documentation on
# 2026-08-16. Keep this intentionally conservative: no guessed bridged assets.
EXPECTED_TOKENS = {
    '0x1': {
        'USDT': ('0xdAC17F958D2ee523a2206206994597C13D831ec7', 6),
        'USDC': ('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6),
    },
    '0x89': {
        'USDC': ('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6),
    },
    '0xa4b1': {
        'USDC': ('0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6),
    },
    '0xa': {
        'USDC': ('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 6),
    },
    '0x2105': {
        'USDC': ('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6),
    },
    '0xa86a': {
        'USDT': ('0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', 6),
        'USDC': ('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 6),
    },
}
EXPECTED_NATIVE = {
    '0x1': 'ETH',
    '0x38': 'BNB',
    '0x89': 'POL',
    '0xa4b1': 'ETH',
    '0xa': 'ETH',
    '0x2105': 'ETH',
    '0xa86a': 'AVAX',
}


def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')


def chain_blocks(text):
    matches = list(re.finditer(r'^\s*"(0x[0-9a-fA-F]+)"\s*:\s*\{', text, re.M))
    blocks = {}
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks[match.group(1).lower()] = text[start:end]
    return blocks


actions = read(ACTIONS_PATH)
sync = read(SYNC_PATH)
connect = read(CONNECT_PATH)
action_blocks = chain_blocks(actions)
sync_blocks = chain_blocks(sync)

if set(action_blocks) != set(EXPECTED_NATIVE):
    errors.append(f'wallet action chain set drifted: {sorted(action_blocks)}')
if set(sync_blocks) != set(EXPECTED_NATIVE):
    errors.append(f'wallet balance chain set drifted: {sorted(sync_blocks)}')

for chain_id, symbol in EXPECTED_NATIVE.items():
    action_block = action_blocks.get(chain_id, '')
    sync_block = sync_blocks.get(chain_id, '')
    if not re.search(rf'native:\s*\{{\s*symbol:\s*"{re.escape(symbol)}"\s*,\s*decimals:\s*18\s*\}}', action_block, re.S):
        errors.append(f'{chain_id} native asset/18 decimals drifted in wallet actions')
    if not re.search(rf'native:\s*"{re.escape(symbol)}"', sync_block):
        errors.append(f'{chain_id} native asset drifted in on-chain sync')

for chain_id in EXPECTED_NATIVE:
    expected = EXPECTED_TOKENS.get(chain_id, {})
    action_block = action_blocks.get(chain_id, '')
    sync_block = sync_blocks.get(chain_id, '')

    # Every configured token must be one of the issuer-verified entries below.
    action_tokens = {
        m.group(1): (m.group(2), int(m.group(3)))
        for m in re.finditer(
            r'\b(USDT|USDC)\s*:\s*\{\s*contract:\s*"(0x[a-fA-F0-9]{40})"\s*,\s*decimals:\s*(\d+)\s*\}',
            action_block,
            re.S,
        )
    }
    sync_tokens = {
        m.group(1): (m.group(2), int(m.group(3)))
        for m in re.finditer(
            r'\b(USDT|USDC)\s*:\s*\[\s*"(0x[a-fA-F0-9]{40})"\s*,\s*(\d+)\s*\]',
            sync_block,
            re.S,
        )
    }

    normalized_expected = {k: (v[0].lower(), v[1]) for k, v in expected.items()}
    normalized_actions = {k: (v[0].lower(), v[1]) for k, v in action_tokens.items()}
    normalized_sync = {k: (v[0].lower(), v[1]) for k, v in sync_tokens.items()}
    if normalized_actions != normalized_expected:
        errors.append(f'{chain_id} action token map does not match issuer-verified matrix: {normalized_actions}')
    if normalized_sync != normalized_expected:
        errors.append(f'{chain_id} balance token map does not match issuer-verified matrix: {normalized_sync}')
    if normalized_actions != normalized_sync:
        errors.append(f'{chain_id} read/send token maps drifted from each other')

# Connect is permission-only. It must never sign or send value.
for forbidden in [
    'eth_sendTransaction', 'eth_sendRawTransaction', 'eth_sign', 'personal_sign',
    'eth_signTypedData', 'wallet_sendCalls'
]:
    if forbidden in connect:
        errors.append(f'wallet connect unexpectedly contains value/signing method: {forbidden}')

# Balance sync is strictly read-only.
for forbidden in [
    'eth_sendTransaction', 'eth_sendRawTransaction', 'eth_sign', 'personal_sign',
    'eth_signTypedData', 'wallet_sendCalls'
]:
    if forbidden in sync:
        errors.append(f'on-chain balance sync unexpectedly contains value/signing method: {forbidden}')
for required in ['eth_accounts', 'eth_chainId', 'eth_getBalance', 'eth_call']:
    if required not in sync:
        errors.append(f'on-chain sync read method missing: {required}')

# The action module can request only wallet-native transaction confirmation. It
# must not request raw signatures/keys or mutate NexusNova's Firebase balance.
if actions.count('eth_sendTransaction') != 1:
    errors.append('wallet actions must contain exactly one wallet-confirmed eth_sendTransaction path')
for forbidden in [
    'eth_sendRawTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData',
    'wallet_sendCalls', 'privateKey', 'mnemonic', 'seedPhrase'
]:
    if forbidden in actions:
        errors.append(f'wallet actions contain forbidden signing/secret marker: {forbidden}')
for forbidden in ['firebasejs', 'getFirestore(', 'setDoc(', 'updateDoc(', 'runTransaction(']:
    if forbidden in actions:
        errors.append(f'external wallet transfer module must not mutate Firebase account value: {forbidden}')

# Destination, amount, and chain/account context must be revalidated immediately
# before a transfer is submitted.
for marker in [
    '/^0x[a-fA-F0-9]{40}$/.test(destination)',
    'destination.toLowerCase() === address.toLowerCase()',
    'function decimalToUnits(raw, decimals)',
    'const current = await connection();',
    'current.address.toLowerCase() !== address.toLowerCase()',
    'current.chainId !== chainId',
    'await current.p.request({ method: "eth_sendTransaction", params: [tx] })',
]:
    if marker not in actions:
        errors.append(f'wallet transfer safety marker missing: {marker}')

# Deposit/receive remains the user's connected external wallet, never a generated
# NexusNova custody address.
for marker in [
    'This is your connected wallet address.',
    'NexusNova never holds your private key.',
    '${esc(address)}',
]:
    if marker not in actions:
        errors.append(f'non-custodial receive contract missing: {marker}')

if errors:
    print('NexusNova wallet security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova wallet security readiness: PASS')
print(' - send/read token maps: identical and issuer-verified')
print(' - USDT/USDC decimals: locked to verified 6-decimal contracts')
print(' - connect + balance sync: no signing/value methods')
print(' - sends: wallet-confirmed eth_sendTransaction only')
print(' - send submit: destination + amount + account + chain revalidated')
print(' - receive: connected external wallet address; no custodial/fake address')
