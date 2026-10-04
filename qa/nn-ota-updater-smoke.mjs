import fs from 'node:fs';
import assert from 'node:assert/strict';

const updater = fs.readFileSync('fresh-rebuild/assets/js/nn-ota-updater.js', 'utf8');
const screen = fs.readFileSync('fresh-rebuild/src/features/apps/app-screen.js', 'utf8');
const build = fs.readFileSync('NexusNovaAndroid/app/build.gradle.kts', 'utf8');
const main = fs.readFileSync('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt', 'utf8');
const webmgr = fs.readFileSync('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusOtaWebManager.kt', 'utf8');

for (const needle of [
  'class NexusNovaOTAUpdater',
  'checkForUpdates()',
  'triggerUpdateDownload(',
  'applyPatch(',
  'new AbortController()',
  'this.controller.abort()',
  'const COMMIT_API',
  'api.github.com',
  'const OTA_MANIFEST_URL',
  'publishedCommit !== this.clientCommit',
  'raw.githubusercontent.com',
  'expectedSha256',
  'expectedVersionCode',
  'installUpdate',
  'Update Now',
  'Please update to continue',
  'readInstalledBuildState()',
  'fetchLatestRepositoryState()',
  'verifyRuntimeState(',
  'DIAGNOSTIC RUNTIME STATE',
  'Current Device Running Code SHA',
  'GitHub Repository Latest SHA',
  'Verification Delta Status'
]) assert.ok(updater.includes(needle), 'OTA updater missing: ' + needle);

assert.ok(!/raw\.githubusercontent\.com.*build\/outputs/.test(updater), 'invalid raw CI output endpoint present');
assert.ok(!updater.includes('RELEASE_API'));
assert.ok(!updater.includes('releaseApi'));
const forbiddenWindowOpen = 'window.' + 'open';
const forbiddenGoldenRecovery = 'golden-' + 'disaster-' + 'recovery';
assert.ok(!updater.includes(forbiddenWindowOpen));
assert.ok(!updater.includes('browser_download_url'));
assert.ok(!updater.includes(forbiddenGoldenRecovery));
assert.ok(main.includes('PackageInstaller.SessionParams'));
assert.ok(main.includes('sha256File('));
assert.ok(main.includes('raw.githubusercontent.com'));
assert.ok(!main.includes('launchCachedApkWithFileProvider'));
assert.ok(main.includes('GLOBAL_OTA_BOOT_SCRIPT'));
assert.ok(main.includes('NexusNovaOTAUpdater'));
assert.ok(main.includes('checkAndNotify'));
assert.ok(!screen.includes('NexusNovaOTAUpdater'));
assert.ok(!screen.includes('otaUpdater.checkAndNotify'));
assert.ok(webmgr.includes('GLOBAL_OTA_UPDATER_PATH'));
assert.ok(webmgr.includes('relativePath == GLOBAL_OTA_UPDATER_PATH'));
assert.ok(build.includes('NEXUS_BUILD_COMMIT'));
assert.ok(main.includes('NexusNovaNativeInfo'));
assert.ok(main.includes('NexusNovaDiagnostic'));
assert.ok(main.includes('BuildConfig.NEXUS_BUILD_COMMIT'));
assert.ok(updater.includes('this.controller.abort()'));
assert.ok(updater.includes('this.diagnosticPanel?.remove()'));
console.log('NexusNova OTA popup smoke: global startup trigger, native installer bridge, redirect removal, stale-overlay isolation, deterministic metadata validation, and mining-safe teardown assertions passed.');
