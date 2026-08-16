from pathlib import Path

path = Path('firestore.rules')
text = path.read_text(encoding='utf-8')
start_marker = '    function validDailyReward() {\n'
end_marker = '    function leaderboardSource(uid) {\n'

if start_marker not in text:
    print('Legacy validDailyReward helper is already removed.')
else:
    start = text.index(start_marker)
    try:
        end = text.index(end_marker, start)
    except ValueError:
        raise SystemExit('Could not find safe end marker after validDailyReward; refusing edit.')
    block = text[start:end]
    if 'balance + 5' not in block or "hasOnly(['balance', 'lastDailyReward', 'dailyRewardStreak'])" not in block:
        raise SystemExit('Unexpected validDailyReward helper shape; refusing edit.')
    text = text[:start] + text[end:]
    path.write_text(text, encoding='utf-8')
    print('Removed dead legacy client-side Daily Reward rule helper.')
