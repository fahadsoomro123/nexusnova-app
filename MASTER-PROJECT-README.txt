NexusNova Master Project — Current Clean Package

Canonical modern app source:
- fresh-rebuild/

Android wrapper/build project:
- NexusNovaAndroid/

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
- Keep canonical source, Android/native code, backend/infrastructure, active workflows, active security/readiness checks, and useful roadmap documentation.
- Remove old APK outputs, logs, patch/prep scripts, obsolete self-modifying workflows, stale recovery/test workflows, duplicate status reports, and orphan helper scripts.
- Do not treat legacy root page2 files as the canonical APK source.
- Do not modify Golden backup branches during normal bug-fix work.
