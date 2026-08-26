#!/usr/bin/env python3
from pathlib import Path

p = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
s = p.read_text(encoding='utf-8')


def ensure(old: str, new: str, label: str):
    global s
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'Native Drive anchor missing: {label}')
    s = s.replace(old, new, 1)

constants_old = '''        const val ACTION_AD_STATUS = "adStatus"\n\n        const val MAX_BRIDGE_MESSAGE_CHARS = 8_192\n'''
constants_new = '''        const val ACTION_AD_STATUS = "adStatus"\n        const val ACTION_NATIVE_DRIVE_START = "nativeDriveStart"\n        const val ACTION_NATIVE_DRIVE_PAUSE = "nativeDrivePause"\n        const val ACTION_NATIVE_DRIVE_RESUME = "nativeDriveResume"\n        const val ACTION_NATIVE_DRIVE_STOP = "nativeDriveStop"\n        const val ACTION_NATIVE_DRIVE_STATUS = "nativeDriveStatus"\n        const val NATIVE_DRIVE_NOTIFICATION_REQUEST_CODE = 2608\n\n        const val MAX_BRIDGE_MESSAGE_CHARS = 8_192\n'''
ensure(constants_old, constants_new, 'native action constants')

cases_old = '''            ACTION_AD_STATUS -> {\n                initializeAdsSafely()\n                adManager?.publishStatus()\n            }\n\n            ACTION_OPEN_EXTERNAL -> {\n'''
cases_new = '''            ACTION_AD_STATUS -> {\n                initializeAdsSafely()\n                adManager?.publishStatus()\n            }\n\n            ACTION_NATIVE_DRIVE_START -> {\n                if (!hasLocationPermission()) {\n                    publishNativeDriveSnapshot("Location permission is required for Nova Drive.")\n                    return\n                }\n                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&\n                    ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED\n                ) {\n                    runCatching { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NATIVE_DRIVE_NOTIFICATION_REQUEST_CODE) }\n                }\n                runCatching { NexusDriveForegroundService.start(this) }\n                    .onFailure { publishNativeDriveSnapshot("Could not start background Drive tracking: ${it.message ?: "system restriction"}") }\n                webView.postDelayed({ publishNativeDriveSnapshot() }, 180L)\n            }\n\n            ACTION_NATIVE_DRIVE_PAUSE -> {\n                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_PAUSE)\n                webView.postDelayed({ publishNativeDriveSnapshot() }, 120L)\n            }\n\n            ACTION_NATIVE_DRIVE_RESUME -> {\n                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_RESUME)\n                webView.postDelayed({ publishNativeDriveSnapshot() }, 120L)\n            }\n\n            ACTION_NATIVE_DRIVE_STOP -> {\n                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_STOP)\n                webView.postDelayed({ publishNativeDriveSnapshot() }, 280L)\n            }\n\n            ACTION_NATIVE_DRIVE_STATUS -> publishNativeDriveSnapshot()\n\n            ACTION_OPEN_EXTERNAL -> {\n'''
ensure(cases_old, cases_new, 'native action cases')

helper_anchor = '''    private fun permissionsFor(resources: Array<String>): List<String> = buildList {\n'''
helper_block = '''    private fun publishNativeDriveSnapshot(error: String? = null) {\n        if (!::webView.isInitialized || isFinishing || isDestroyed) return\n        val snapshot = NexusDriveForegroundService.readSnapshot(this)\n        if (!error.isNullOrBlank()) {\n            snapshot.put("error", error)\n            snapshot.put("status", error)\n        }\n        val script = "window.dispatchEvent(new CustomEvent('nexusnova:native-drive',{detail:${snapshot}}));"\n        webView.post {\n            if (!isFinishing && !isDestroyed && ::webView.isInitialized) {\n                runCatching { webView.evaluateJavascript(script, null) }\n            }\n        }\n    }\n\n'''
if helper_block not in s:
    if helper_anchor not in s:
        raise SystemExit('Native Drive anchor missing: helper methods')
    s = s.replace(helper_anchor, helper_block + helper_anchor, 1)

p.write_text(s, encoding='utf-8')

checks = [
    'ACTION_NATIVE_DRIVE_START',
    'NexusDriveForegroundService.start(this)',
    "nexusnova:native-drive",
    'ACTION_NATIVE_DRIVE_STATUS -> publishNativeDriveSnapshot()'
]
for check in checks:
    if check not in s:
        raise SystemExit(f'Native Drive patch verification failed: {check}')
print('Native Drive MainActivity patch: PASS')
