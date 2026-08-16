from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
site_key = '6LfEc4QtAAAAAOohkqSv0p76iwPTeHI98hqVlwIs'
blank = '<meta name="nexusnova-app-check-site-key" content="">'
configured = f'<meta name="nexusnova-app-check-site-key" content="{site_key}">'

if configured in text:
    print('Login App Check Enterprise site key is already configured.')
elif blank in text:
    text = text.replace(blank, configured, 1)
    path.write_text(text, encoding='utf-8')
    print('Configured login/signup App Check with the same production Enterprise site key as the dashboard.')
else:
    raise SystemExit('Unexpected index.html App Check meta shape; refusing unsafe automatic edit.')
