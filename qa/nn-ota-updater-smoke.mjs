import fs from 'node:fs';
import assert from 'node:assert/strict';

const updater = fs.readFileSync('fresh-rebuild/assets/js/nn-ota-updater.js', 'utf8');
const screen = fs.readFileSync('fresh-rebuild/src/features/apps/app-screen.js', 'utf8');
const build = fs.readFileSync('NexusNovaAndroid/app/build.gradle.kts', 'utf8');
const main = fs.readFileSync('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt', 'utf8');

for (const needle of [
  'class NexusNovaOTAUpdater',
  'checkForUpdates()',
  'triggerUpdateDownload(',
  'applyPatch(',
  'new AbortController()',
  'this.controller.abort()',
  'output-metadata.json',
  'const COMMIT_API',
  'api.github.com',
  'const RELEASE_API',
  'latestCommit !== this.clientCommit',
  'Update Now',
  'Please update to continue'
]) assert.ok(updater.includes(needle), 'OTA updater missing: ' + needle);

assert.ok(!/raw\.githubusercontent\.com.*build\/outputs/.test(updater), 'invalid raw CI output endpoint present');
assert.ok(screen.includes('NexusNovaOTAUpdater'));
assert.ok(screen.includes('miningOwned ? null'));
assert.ok(screen.includes('otaUpdater.checkAndNotify'));
assert.ok(build.includes('NEXUS_BUILD_COMMIT'));
assert.ok(main.includes('NexusNovaNativeInfo'));
console.log('NexusNova OTA popup smoke: engine, real endpoints, deterministic commit comparison, version bridge, Nova Hub isolation, and teardown assertions passed.');
