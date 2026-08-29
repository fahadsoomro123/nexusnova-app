from pathlib import Path

path = Path('.github/workflows/nova57-arim-ci.yml')
text = path.read_text()
old = "            'generate: nextPrompt => hedgeModel.generateContent(nextPrompt)'\n"
new = "            'generate: nextPrompt => generateForRuntime(hedgeModel, nextPrompt, dna.capability, runtimeOptions)',\n            'generateViaAtomicRelay',\n            'mobileRelayPreferred()'\n"
if old not in text:
    raise SystemExit('Old direct generation contract not found; refusing unrelated edit.')
text = text.replace(old, new, 1)
path.write_text(text)
