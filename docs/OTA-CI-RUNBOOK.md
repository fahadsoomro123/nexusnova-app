# NexusNova OTA Engine CI Runbook

The OTA Engine capability workflow is registered on `main` and is validated by pushes to `ota-engine-ci-exec-20260915`.

For a corrected capability revision, the verification sequence is:

1. Push the corrected revision to `ota-engine-ci-exec-20260915`.
2. Inspect only the newest `NexusNova OTA Engine Capability CI` run.
3. Require native OTA tests, signed APK inspection, Travel purge invariants, publication metadata, and artifact upload to pass.
4. Obtain and verify `NexusNova-OTA-Engine-Upgrade-SIGNED` before declaring delivery complete.

The release verification values for the current OTA Engine capability are version code `26091501`, version name `1.0.38-ota-engine-capability`, package `com.nexusnova.app`, and certificate SHA-256 `76fa4bc81be45ab1d53350ea996e85e61518379f82cb9a1ec0e2a19d2e303f25`.
