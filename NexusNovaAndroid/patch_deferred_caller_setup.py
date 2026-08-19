from pathlib import Path

MAIN = Path("NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt")

src = MAIN.read_text(encoding="utf-8")
startup_call = "        showCallerSetupOnce()\n"
startup_comment = """        // Caller ID setup must never interrupt splash/auth startup.
        // Caller ID remains available only through its explicit feature action.
"""

if startup_call in src:
    src = src.replace(startup_call, startup_comment, 1)
elif "Caller ID setup must never interrupt splash/auth startup" not in src:
    raise SystemExit("Caller ID startup call marker not found; refusing unsafe patch")

on_create = src.split("override fun onCreate", 1)[1].split("private fun configureWebView", 1)[0]
if "showCallerSetupOnce()" in on_create:
    raise SystemExit("Automatic Caller ID setup call still exists in onCreate")

# Preserve the existing explicit feature bridge. This is the only allowed path
# for requesting the Android Caller ID / call-screening role.
if "ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()" not in src:
    raise SystemExit("Explicit Caller ID feature action missing")

MAIN.write_text(src, encoding="utf-8")
print("Caller ID startup auto-launch disabled; explicit Caller ID feature action preserved.")
