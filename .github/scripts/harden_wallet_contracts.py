from pathlib import Path

path = Path('js/wallet-onchain-sync-v3.js')
text = path.read_text(encoding='utf-8')

bad = '0xdAC17F958D2ee523a2206994597C13D831ec7'
good = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

if good in text:
    print('Ethereum USDT balance contract is already canonical.')
elif bad in text:
    text = text.replace(bad, good, 1)
    path.write_text(text, encoding='utf-8')
    print('Fixed truncated Ethereum USDT balance contract to canonical Tether address.')
else:
    raise SystemExit('Ethereum USDT contract shape changed unexpectedly; refusing unsafe automatic edit.')
