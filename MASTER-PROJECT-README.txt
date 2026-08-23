NexusNova Master Project — Current Clean Package

Canonical modern app source:
- fresh-rebuild/

Android wrapper/build project:
- NexusNovaAndroid/
- Android assets/www is generated at build time from fresh-rebuild/ and is not tracked.

Backend and infrastructure retained:
- functions/
- firestore.rules
- firebase.json / firebase-public/
- vpn-infra/

Current development branch:
- nexusnova-latest-full-apk-recovery-20260823

Phone-PASS Golden baseline:
- nexusnova-golden-phone-pass-20260823
- commit e6176f721216e3e0c3130c8811a4123bcafce8cc

Repository cleanup policy:
- Keep canonical source, Android/native code, backend/infrastructure, current workflows, and useful documentation.
- Root web entry redirects to fresh-rebuild/; the historical page2/js/css frontend has been retired.
- Generated Android web assets, APK/AAB outputs, logs, caches, patch/prep scripts, stale recovery/test workflows and orphan helpers must not be committed.
- Legacy historical status documents belong under docs/archive/ and are not current source-of-truth.
- Do not modify Golden backup branches during normal bug-fix work.
