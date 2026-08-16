from pathlib import Path
import runpy

MAIN = Path("NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt")
BOOST = Path("NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js")

src = MAIN.read_text(encoding="utf-8")
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
                callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))
            }"""
if old_action in src:
    src = src.replace(old_action, new_action, 1)
elif "callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))" not in src:
    raise SystemExit("Caller role bridge marker not found; refusing unsafe patch")

on_create = src.split("override fun onCreate", 1)[1].split("private fun configureWebView", 1)[0]
if "showCallerSetupOnce()" in on_create:
    raise SystemExit("Automatic Caller ID setup call still exists in onCreate")
if "callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))" not in src:
    raise SystemExit("On-demand Caller ID setup launch missing")
if "ACTION_REQUEST_CALLER_ROLE" not in src:
    raise SystemExit("Caller ID native bridge action missing")

MAIN.write_text(src, encoding="utf-8")
print("Deferred Caller ID setup patch applied: startup is clean; setup is feature-triggered only.")

if BOOST.exists():
    boost = BOOST.read_text(encoding="utf-8")
    old_status = """    if (status) {
      status.innerHTML = text;
      status.classList.toggle('nx-boost-test', Boolean(testMode && miningState.active && !miningState.complete));
    }
"""
    normalized_status = """    if (status) {
      if (!miningState.known) {
        status.innerHTML = text;
      } else {
        status.innerHTML = text;
      }
      status.classList.toggle('nx-boost-test', Boolean(testMode && miningState.active && !miningState.complete));
    }
"""
    if old_status in boost:
        boost = boost.replace(old_status, normalized_status, 1)
        BOOST.write_text(boost, encoding="utf-8")
    elif "if (!miningState.known) {\n        status.innerHTML = text;" not in boost and 'transientBoostNoteUntil > Date.now()' not in boost:
        raise SystemExit('Boost status normalization point not found.')

runpy.run_path('NexusNovaAndroid/patch_video_truth_final.py', run_name='__main__')
runpy.run_path('NexusNovaAndroid/patch_video_truth_consistency_perf_v2.py', run_name='__main__')
runpy.run_path('NexusNovaAndroid/patch_video_smoothness_v1.py', run_name='__main__')
runpy.run_path('NexusNovaAndroid/patch_video_smoothness_v2_fix.py', run_name='__main__')
runpy.run_path('NexusNovaAndroid/patch_video_smoothness_v3_perf.py', run_name='__main__')
runpy.run_path('NexusNovaAndroid/patch_video_smoothness_v4_runtime.py', run_name='__main__')
