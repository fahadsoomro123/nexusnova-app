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


def object_block(text, key):
    """Return the exact JS object assigned to a quoted key, respecting nesting."""
    marker = f'"{key}":'
    key_pos = text.find(marker)
    if key_pos < 0:
        return ''
    start = text.find('{', key_pos + len(marker))
    if start < 0:
        return ''

    depth = 0
    quote = None
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in ('"', "'"):
            quote = ch
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return ''


actions = read(ACTIONS_PATH)
sync = read(SYNC_PATH)
connect = read(CONNECT_PATH)

# Ensure the two wallet layers expose the same deliberately supported chain set.
for chain_id in EXPECTED_NATIVE:
    if f'"{chain_id}":' not in actions:
        errors.append(f'{chain_id} missing from wallet action chain map')
    if f'"{chain_id}":' not in sync:
        errors.append(f'{chain_id} missing from wallet balance chain map')

for chain_id, symbol in EXPECTED_NATIVE.items():
    action_block = object_block(actions, chain_id)
    sync_block = object_block(sync, chain_id)
    if not action_block:
        errors.append(f'could not parse {chain_id} wallet action object')
        continue
    if not sync_block:
        errors.append(f'could not parse {chain_id} wallet balance object')
        continue

    if not re.search(rf'native:\s*\{{\s*symbol:\s*"{re.escape(symbol)}"\s*,\s*decimals:\s*18\s*\}}', action_block, re.S):
        errors.append(f'{chain_id} native asset/18 decimals drifted in wallet actions')
    if not re.search(rf'native:\s*"{re.escape(symbol)}"', sync_block):
        errors.append(f'{chain_id} native asset drifted in on-chain sync')

    expected = EXPECTED_TOKENS.get(chain_id, {})
    action_lower = action_block.lower()
    sync_lower = sync_block.lower()
    for token_symbol, (address, decimals) in expected.items():
        # Check chain-local address and token decimal shape separately. This is
        # strict on value/chain/decimals while ignoring harmless checksum casing
        # and formatting whitespace.
        if address.lower() not in action_lower:
            errors.append(f'{chain_id} {token_symbol} issuer-verified contract missing from send map')
        if address.lower() not in sync_lower:
            errors.append(f'{chain_id} {token_symbol} issuer-verified contract missing from balance map')
        if not re.search(
            rf'\b{re.escape(token_symbol)}\s*:\s*\{{[^}}]*decimals:\s*{decimals}\s*\}}',
            action_block,
            re.S,
        ):
            errors.append(f'{chain_id} {token_symbol} send decimals/shape drifted')
        if not re.search(
            rf'\b{re.escape(token_symbol)}\s*:\s*\[\s*"0x[a-fA-F0-9]+"\s*,\s*{decimals}\s*\]',
            sync_block,
            re.S,
        ):
            errors.append(f'{chain_id} {token_symbol} balance decimals/shape drifted')

    configured_action_symbols = set(re.findall(r'\b(USDT|USDC)\s*:\s*\{\s*contract:', action_block))
    configured_sync_symbols = set(re.findall(r'\b(USDT|USDC)\s*:\s*\[', sync_block))
    if configured_action_symbols != set(expected):
        errors.append(f'{chain_id} send token set drifted: {sorted(configured_action_symbols)}')
    if configured_sync_symbols != set(expected):
        errors.append(f'{chain_id} balance token set drifted: {sorted(configured_sync_symbols)}')
    if configured_action_symbols != configured_sync_symbols:
        errors.append(f'{chain_id} read/send token symbol sets drifted from each other')

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
actual_send_calls = len(re.findall(r'method:\s*"eth_sendTransaction"', actions))
if actual_send_calls != 1:
    errors.append(f'wallet actions must contain exactly one actual eth_sendTransaction request; found {actual_send_calls}')
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
