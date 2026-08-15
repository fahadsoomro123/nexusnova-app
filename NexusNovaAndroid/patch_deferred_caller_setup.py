from pathlib import Path

MAIN = Path("NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt")

src = MAIN.read_text(encoding="utf-8")

startup = """        webView.loadUrl(PRODUCTION_APP_URL)\n        showCallerSetupOnce()\n"""
replacement = """        webView.loadUrl(PRODUCTION_APP_URL)\n        // Caller ID setup is intentionally deferred. Do not interrupt splash/auth.\n        // The user sees setup only after explicitly choosing the Caller ID feature.\n"""

if startup not in src:
    raise SystemExit("Caller setup startup marker not found; refusing unsafe patch")
src = src.replace(startup, replacement, 1)

old_action = "            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()"
new_action = """            ACTION_REQUEST_CALLER_ROLE -> {
                // Explicit user action from the Caller ID feature opens our explanation
                // screen first. Android's role permission is requested only after the
                // user taps ENABLE CALLER ID ROLE inside that screen.
                callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))
            }"""

if old_action not in src:
    raise SystemExit("Caller role bridge marker not found; refusing unsafe patch")
src = src.replace(old_action, new_action, 1)

# Safety assertions: no automatic setup call may remain in onCreate, while the
# on-demand bridge and setup activity must remain wired.
on_create = src.split("override fun onCreate", 1)[1].split("private fun configureWebView", 1)[0]
if "showCallerSetupOnce()" in on_create:
    raise SystemExit("Automatic Caller ID setup call still exists in onCreate")
if "callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))" not in src:
    raise SystemExit("On-demand Caller ID setup launch missing")
if "ACTION_REQUEST_CALLER_ROLE" not in src:
    raise SystemExit("Caller ID native bridge action missing")

MAIN.write_text(src, encoding="utf-8")
print("Deferred Caller ID setup patch applied: startup is clean; setup is feature-triggered only.")
