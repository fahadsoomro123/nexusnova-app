import fs from 'node:fs';
import assert from 'node:assert/strict';

const updater = fs.readFileSync('fresh-rebuild/assets/js/nn-ota-updater.js', 'utf8');
const screen = fs.readFileSync('fresh-rebuild/src/features/apps/app-screen.js', 'utf8');
const build = fs.readFileSync('NexusNovaAndroid/app/build.gradle.kts', 'utf8');
const main = fs.readFileSync('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt', 'utf8');

assert.match(updater, /class NexusNovaOTAUpdater/);
assert.match(updater, /checkForUpdates\(\)/);
assert.match(updater, /triggerUpdateDownload\(/);
assert.match(updater, /applyPatch\(/);
assert.match(updater, /new AbortController\(\)/);
assert.match(updater, /this\.controller\.abort\(\)/);
assert.match(updater, /output-metadata\.json/);
assert.match(updater, /const COMMIT_API = 'https:\/\/api\.github\.com\/repos\/'/);\nassert.match(updater, /\/commits\/\' \+ BRANCH/);\nassert.match(updater, /const METADATA_URL/);
assert.match(screen, /NexusNovaOTAUpdater/);
assert.match(screen, /miningOwned \? null/);
assert.match(screen, /otaUpdater\.checkAndNotify/);
assert.match(build, /NEXUS_BUILD_COMMIT/);
assert.match(main, /NexusNovaNativeInfo/);
console.log('NexusNova OTA popup smoke: engine, endpoints, version bridge, Nova Hub isolation, and teardown assertions passed.');