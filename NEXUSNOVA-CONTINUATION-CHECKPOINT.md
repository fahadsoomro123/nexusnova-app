# NexusNova continuation checkpoint

Current canonical app source: `fresh-rebuild/`
Current Android wrapper: `NexusNovaAndroid/`
Current working branch: `nexusnova-latest-full-apk-recovery-20260823`
Phone-PASS Golden baseline: `e6176f721216e3e0c3130c8811a4123bcafce8cc`

## Current verified state
- The Mine/WebView startup crash was fixed and physically confirmed on the user's phone.
- The Mine compositor was simplified to avoid the WebView/GPU crash path.
- WebView renderer recovery was subsequently bounded to avoid an endless recreate loop.
- Repository cleanup removed obsolete patch scripts, old build outputs, stale test/recovery workflows, and historical audit clutter.

## Source rule
Use `fresh-rebuild/` as the canonical modern app source for APK packaging. Do not package the legacy root `page2.html` shell as the modern app.

## Safety rule
Do not modify Golden backup branches during normal bug-fix work. Bug fixes belong on the working branch and require a new physical-phone test before a new approved backup is created.
