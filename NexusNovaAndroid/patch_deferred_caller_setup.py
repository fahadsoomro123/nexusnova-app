from pathlib import Path
import runpy

MAIN = Path("NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt")

src = MAIN.read_text(encoding="utf-8")

# Session-restore builds may choose either index.html or page2.html at startup,
# so do not couple Caller ID deferral to a specific webView.loadUrl(...) line.
startup_call = "        showCallerSetupOnce()\n"
startup_comment = """        // Caller ID setup is intentionally deferred. Do not interrupt splash/auth.
        // The user sees setup only after explicitly choosing the Caller ID feature.
"""
if startup_call in src:
    src = src.replace(startup_call, startup_comment, 1)
elif "Caller ID setup is intentionally deferred" not in src:
    raise SystemExit("Caller setup startup marker not found; refusing unsafe patch")

old_action = "            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()"
new_action = """            ACTION_REQUEST_CALLER_ROLE -> {
                // Explicit user action from the Caller ID feature opens our explanation
                // screen first. Android's role permission is requested only after the
                // user taps ENABLE CALLER ID ROLE inside that screen.
                callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))
            }"""

if old_action in src:
    src = src.replace(old_action, new_action, 1)
elif "callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))" not in src:
    raise SystemExit("Caller role bridge marker not found; refusing unsafe patch")

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

# This step runs after same-device session restore and after rewarded event-order
# hardening. It is therefore the deterministic point to apply the fixes proven
# by the user's real-device screen recording.
runpy.run_path('NexusNovaAndroid/patch_video_truth_final.py', run_name='__main__')
