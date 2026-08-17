from pathlib import Path

MAIN = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
src = MAIN.read_text(encoding='utf-8')

startup_call = '        showCallerSetupOnce()\n'
startup_comment = '''        // Caller ID setup is intentionally deferred. Do not interrupt splash/auth.
        // Setup opens only after the user explicitly chooses Caller ID.
'''
if startup_call in src:
    src = src.replace(startup_call, startup_comment, 1)
elif 'Caller ID setup is intentionally deferred' not in src:
    raise SystemExit('Caller setup startup marker not found; refusing unsafe patch')

old_action = '            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()'
new_action = '''            ACTION_REQUEST_CALLER_ROLE -> {
                callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))
            }'''
if old_action in src:
    src = src.replace(old_action, new_action, 1)
elif 'callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))' not in src:
    raise SystemExit('Caller role bridge marker not found; refusing unsafe patch')

on_create_parts = src.split('override fun onCreate', 1)
if len(on_create_parts) != 2:
    raise SystemExit('MainActivity onCreate block not found')
on_create = on_create_parts[1].split('private fun configureWebView', 1)[0]
if 'showCallerSetupOnce()' in on_create:
    raise SystemExit('Automatic Caller ID setup call still exists in onCreate')
if 'callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))' not in src:
    raise SystemExit('On-demand Caller ID setup launch missing')
if 'ACTION_REQUEST_CALLER_ROLE' not in src:
    raise SystemExit('Caller ID native bridge action missing')

MAIN.write_text(src, encoding='utf-8')
print('Stable Caller ID defer patch applied with no TEST reward, time-warp or video-patch chain.')
