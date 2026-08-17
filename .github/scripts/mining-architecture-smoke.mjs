import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsDir = path.join(root, 'js');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const rewards = read('js/rewards-security-v1.js');
const page2 = read('js/page2.js');
const integrity = read('js/final-integrity-fix.js');
const page2Core = read('js/page2-core.js');
const rules = read('firestore.rules');
const boostBridge = read('js/nexusnova-admob-nexus-pass-v1.js');
const executableBoostBridge = stripComments(boostBridge);
const androidOfflineRewards = read('NexusNovaAndroid/app/src/main/assets/www/js/rewards-security-v1.js');
const androidMain = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt');

assert.match(rewards, /const SYNC_TIMEOUT_MS = 10_000;/, 'bounded mining sync timeout missing');
assert.match(rewards, /const SYNC_RETRY_DELAYS_MS = \[2_500, 7_500, 15_000\];/, 'bounded mining sync retry schedule missing');
assert.match(rewards, /RETRY SECURE SYNC/, 'manual secure-session retry state missing');
assert.match(rewards, /runTransaction/, 'mining engine must use Firestore transactions');
assert.match(rewards, /onSnapshot/, 'mining engine must watch authoritative Firestore state');
assert.match(rewards, /getIdToken\(true\)/, 'mining writes must force-refresh Auth claims');
assert.match(rewards, /window\.nexusSecureRenderMining\s*=\s*\(\)\s*=>\s*renderMiningAuthoritative/, 'legacy render calls must be ignored in favor of authoritative state');
assert.doesNotMatch(rewards, /SECURE SYNC REQUIRED/, 'generic legacy sync-error loop must not return');
assert.doesNotMatch(rewards, /httpsCallable\([^\n]*startMiningSession|httpsCallable\([^\n]*finishMiningSession/, 'web mining must not use Cloud Functions callables');

assert.doesNotMatch(page2, /mining-session-recovery/i, 'page2 must not load a competing mining recovery engine');
assert.equal(fs.existsSync(path.join(jsDir, 'mining-session-recovery-v1.js')), false, 'obsolete recovery v1 must be removed');
assert.equal(fs.existsSync(path.join(jsDir, 'mining-session-recovery-v2.js')), false, 'obsolete recovery v2 must be removed');

assert.doesNotMatch(integrity, /FUNCTIONS_HOST|sparkMiningTransaction|startMiningSession|finishMiningSession/, 'integrity layer must not own mining writes');
assert.match(page2Core, /window\.nexusSecureStartMining/, 'legacy page core must delegate Mine clicks to secure engine');
assert.match(page2Core, /window\.nexusSecureRenderMining/, 'legacy page core must delegate timer rendering to secure engine');

assert.match(rules, /function validMiningStart\(\)/, 'Firestore rules must validate mining start');
assert.match(rules, /function validMiningFinish\(\)/, 'Firestore rules must validate mining finish');
assert.match(rules, /request\.resource\.data\.balance == resource\.data\.balance \+ 24/, 'Firestore rules must enforce exact +24 NVX reward');
assert.match(rules, /request\.auth\.token\.email_verified == true/, 'verified email gate missing from value-bearing rules');

// Current security deliberately has NO direct client mining-boost transition.
// TEST Booster/Nova Rain is local/non-value-bearing until a server-verified
// fulfillment path is designed and deployed.
assert.doesNotMatch(rules, /function validMiningBoost\(\)/, 'direct client mining boost rule must remain disabled');
assert.doesNotMatch(rules, /validMiningBoost\(\)/, 'users update path must not authorize direct client mining boosts');
assert.match(rules, /validMiningStart\(\)[\s\S]*validMiningFinish\(\)[\s\S]*validMiningRollover\(\)[\s\S]*validMiningRepair\(\)/,
  'verified mining update allow-list must contain only start/finish/rollover/repair transitions');

// The compatibility bridge is UI/read-state only in this TEST edition. It may
// display proposed -2h Booster/Rain UX, but it must contain no executable
// Firestore writer or callable that changes timestamps/value while the server
// verification switch is disabled.
assert.match(boostBridge, /SERVER_VERIFIED_BOOST_ENABLED = false/, 'production server-verified boost gate must remain disabled in current TEST edition');
assert.match(boostBridge, /TOTAL_LIMIT = BOOSTER_LIMIT \+ RAIN_LIMIT/, 'combined boost limit missing');
assert.match(boostBridge, /BOOSTER_LIMIT = 2/, 'Nova Booster limit must be two uses');
assert.match(boostBridge, /RAIN_LIMIT = 4/, 'Nova Rain limit must be four uses');
assert.doesNotMatch(executableBoostBridge, /\brunTransaction\b|\bupdateDoc\b|(?:tx|transaction)\.update\s*\(/,
  'locked TEST boost bridge must not contain an executable Firestore mutation path');
assert.doesNotMatch(executableBoostBridge, /httpsCallable\s*\(/,
  'locked TEST boost bridge must not call an undeployed server fulfillment path');

const executableWriters = [];
for (const name of fs.readdirSync(jsDir).filter(name => name.endsWith('.js'))) {
  if (name === 'nexusnova-admob-nexus-pass-v1.js') continue;
  const source = stripComments(read(`js/${name}`));
  const writesMiningStart =
    /(?:tx|transaction)\.update\s*\([\s\S]{0,600}?miningActive\s*:\s*true/.test(source) ||
    /updateDoc\s*\([\s\S]{0,600}?miningActive\s*:\s*true/.test(source);
  if (writesMiningStart) executableWriters.push(name);
}
assert.deepEqual(executableWriters, ['rewards-security-v1.js'], `expected one web mining session owner, found: ${executableWriters.join(', ')}`);

// Android normally renders the exact tested production origin. Its bundled
// offline copy must never become a second value-bearing mining implementation.
assert.match(androidMain, /PRODUCTION_APP_URL\s*=\s*"https:\/\/fahadsoomro123\.github\.io\/nexusnova-app\/"/, 'Android wrapper must use production NexusNova origin');
assert.match(androidOfflineRewards, /android-offline-guard-v1/, 'Android offline value guard missing');
assert.doesNotMatch(androidOfflineRewards, /runTransaction|updateDoc|httpsCallable|getFunctions|startMiningSession|finishMiningSession/, 'Android offline bundle must not write mining/rewards');
assert.match(androidOfflineRewards, /ONLINE MINING REQUIRED/, 'Android offline mining must clearly require online production app');

console.log('PASS mining architecture: one Firestore-authoritative session owner; direct client boosts locked; TEST boost bridge is non-value-bearing and write-free.');
