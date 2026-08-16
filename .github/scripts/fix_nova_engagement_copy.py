from pathlib import Path

path = Path('js/nexusnova-nova-vault-v1.js')
if not path.exists():
    raise SystemExit('Nova Vault client missing.')

text = path.read_text(encoding='utf-8')
text = text.replace(
    '   One free Vault is granted after each natural 24-hour mining completion.\n',
    '   A Vault is granted after each natural 24-hour mining completion and after\n   every successful stored Nova Booster/Nova Rain use.\n'
)
text = text.replace(
    'Tap START MINING next; NexusNova will show the required ad first, then activate the new session.',
    'Tap START MINING next; mining activates immediately in the background while NexusNova also tries to show the start ad. If the ad is unavailable, mining stays active and no second tap is needed.'
)

if 'show the required ad first, then activate the new session' in text:
    raise SystemExit('Stale blocking-ad Time Warp copy remains.')
if 'mining activates immediately in the background' not in text:
    raise SystemExit('Start-first Time Warp copy was not installed.')
if 'every successful stored Nova Booster/Nova Rain use' not in text:
    raise SystemExit('Booster/Rain Vault gift header copy was not installed.')

path.write_text(text, encoding='utf-8')
print('Nova engagement copy is consistent with start-first mining and boost Vault gifts.')
