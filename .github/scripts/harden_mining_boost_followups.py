from pathlib import Path

# Browser regression: security is proved by unchanged state, zero uses, a
# testOnly native request, and a blocked direct apply(). Do not couple the test
# to the exact prose field rendered by the premium UI adapter.
runtime_path = Path('.github/scripts/nexusnova-rewarded-ads-runtime.mjs')
runtime = runtime_path.read_text(encoding='utf-8')
runtime = runtime.replace(
    "  assert.ok(state.messages.some(message => /TEST ads never reduce mining time or change NVX/i.test(message.message || '')));\n",
    "  assert.ok(state.messages.some(message => /TEST Ad Completed/i.test(message.title || '')));\n",
    1
)
runtime_path.write_text(runtime, encoding='utf-8')

# Compatibility loader copy must not advertise an active 2-hour production value
# reward now that the client-authorized boost path is intentionally disabled.
loader_path = Path('js/nexusnova-rewarded-ads-v1.js')
loader = loader_path.read_text(encoding='utf-8')
loader = loader.replace(
    '/* NexusNova Rewarded Ads compatibility loader v3.\n   Active Android provider: native AdMob -> real 2-hour mining boost.\n   Legacy ayeT server code remains dormant for historical compatibility only.\n*/',
    '/* NexusNova Rewarded Ads compatibility loader v3.1.\n   Active Android provider: native AdMob TEST mining-boost UX.\n   Mining-time value changes remain OFF until server-verified ad proof exists.\n   Legacy ayeT server code remains dormant for historical compatibility only.\n*/',
    1
)
if 'real 2-hour mining boost' in loader:
    raise SystemExit('Rewarded compatibility loader still overstates Mining Boost value.')
loader_path.write_text(loader, encoding='utf-8')

print('Decoupled Mining Boost runtime security assertion from UI prose and corrected loader value claim.')
