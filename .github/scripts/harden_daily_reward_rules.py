from pathlib import Path

path = Path('firestore.rules')
text = path.read_text(encoding='utf-8')

old = """          || validMiningRepair()\n          || validDailyReward()\n        ));"""
new = """          || validMiningRepair()\n        ));"""

if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Removed direct client Daily Reward write permission from /users updates.')
elif '|| validDailyReward()' not in text:
    print('Daily Reward direct-write permission is already removed.')
else:
    raise SystemExit('Unexpected firestore.rules shape; refusing unsafe automatic edit.')
