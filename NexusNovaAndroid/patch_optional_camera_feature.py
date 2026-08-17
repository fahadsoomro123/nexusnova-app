from pathlib import Path

manifest_path = Path('NexusNovaAndroid/app/src/main/AndroidManifest.xml')
manifest = manifest_path.read_text(encoding='utf-8')

permission = '<uses-permission android:name="android.permission.CAMERA" />'
feature = '<uses-feature android:name="android.hardware.camera" android:required="false" />'

if feature not in manifest:
    if permission not in manifest:
        raise SystemExit('CAMERA permission not found in AndroidManifest.xml')
    manifest = manifest.replace(permission, permission + '\n    ' + feature, 1)

if manifest.count(feature) != 1:
    raise SystemExit('Optional camera feature must appear exactly once')
if permission not in manifest:
    raise SystemExit('CAMERA permission was unexpectedly removed')

manifest_path.write_text(manifest, encoding='utf-8')
print('Declared camera hardware optional while preserving CAMERA permission and camera-capable features.')
