from pathlib import Path

INDEX = Path('NexusNovaAndroid/app/src/main/assets/www/index.html')
text = INDEX.read_text(encoding='utf-8')

text = text.replace(
    'Google sign-in is not enabled inside this Android TEST shell yet. Use email login for this build.',
    'Google sign-in is not enabled inside this Android build yet. Please use email login for now.'
)

if 'Android TEST shell' in text:
    raise SystemExit('Stable auth UI still contains TEST-shell wording')
if 'Google sign-in is not enabled inside this Android build yet.' not in text:
    raise SystemExit('Stable Google sign-in fallback wording was not applied')

INDEX.write_text(text, encoding='utf-8')
print('Stable Android auth wording applied.')
