from pathlib import Path

path = Path('js/wallet-actions-v2.js')
text = path.read_text(encoding='utf-8')

old_open = '      const { p, address, chain } = await connection();'
new_open = '      const { p, address, chainId, chain } = await connection();'
if new_open not in text:
    if old_open not in text:
        raise SystemExit('Wallet connection destructuring changed unexpectedly; refusing edit.')
    text = text.replace(old_open, new_open, 1)

old_submit = '''        try {\n          let tx;\n          if (asset === chain.native.symbol) {'''
new_submit = '''        try {\n          // Re-check the injected wallet immediately before building/sending value.\n          // A user can change account or chain while this modal is open; using the\n          // stale token map after that would be a financial safety bug.\n          const current = await connection();\n          if (\n            current.address.toLowerCase() !== address.toLowerCase() ||\n            current.chainId !== chainId\n          ) {\n            throw new Error(\n              "Wallet account or network changed. Close this window and start the transfer again."\n            );\n          }\n\n          let tx;\n          if (asset === chain.native.symbol) {'''
if new_submit not in text:
    if old_submit not in text:
        raise SystemExit('Wallet submit block changed unexpectedly; refusing edit.')
    text = text.replace(old_submit, new_submit, 1)

old_send = '          const hash = await p.request({ method: "eth_sendTransaction", params: [tx] });'
new_send = '          const hash = await current.p.request({ method: "eth_sendTransaction", params: [tx] });'
if new_send not in text:
    if old_send not in text:
        raise SystemExit('Wallet send call changed unexpectedly; refusing edit.')
    text = text.replace(old_send, new_send, 1)

path.write_text(text, encoding='utf-8')
print('Wallet send now revalidates account + chain immediately before eth_sendTransaction.')
