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

assert.match(rewards, /single-owner-v3/, 'single-owner mining version marker missing');
assert.match(rewards, /runTransaction/, 'mining engine must use Firestore transactions');
assert.match(rewards, /onSnapshot/, 'mining engine must watch authoritative Firestore state');
assert.match(rewards, /getIdToken\(true\)/, 'mining writes must force-refresh Auth claims');
assert.match(rewards, /window\.nexusSecureRenderMining\s*=\s*\(\)\s*=>\s*renderMiningAuthoritative/, 'legacy render calls must be ignored in favor of authoritative state');
assert.doesNotMatch(rewards, /SECURE SYNC REQUIRED/, 'generic legacy sync-error loop must not return');

assert.doesNotMatch(page2, /mining-session-recovery/i, 'page2 must not load a competing mining recovery engine');
assert.equal(fs.existsSync(path.join(jsDir, 'mining-session-recovery-v1.js')), false, 'obsolete recovery v1 must be removed');
assert.equal(fs.existsSync(path.join(jsDir, 'mining-session-recovery-v2.js')), false, 'obsolete recovery v2 must be removed');

assert.doesNotMatch(integrity, /FUNCTIONS_HOST|sparkMiningTransaction|startMiningSession|finishMiningSession/, 'integrity layer must not own mining writes');
assert.match(page2Core, /window\.nexusSecureStartMining/, 'legacy page core must delegate Mine clicks to secure engine');
assert.match(page2Core, /window\.nexusSecureRenderMining/, 'legacy page core must delegate timer rendering to secure engine');

assert.match(rules, /function validMiningStart\(\)/, 'Firestore rules must validate mining start');
assert.match(rules, /function validMiningFinish\(\)/, 'Firestore rules must validate mining finish');
assert.match(rules, /request\.resource\.data\.balance == resource\.data\.balance \+ 24/, 'Firestore rules must enforce exact +24 NVX reward');
assert.match(rules, /request\.auth\.token\.email_verified == true/, 'verified email gate missing from mining rules');

const executableWriters = [];
for (const name of fs.readdirSync(jsDir).filter(name => name.endsWith('.js'))) {
  const source = stripComments(read(`js/${name}`));
  const writesMiningStart =
    /(?:tx|transaction)\.update\s*\([\s\S]{0,600}?miningActive\s*:\s*true/.test(source) ||
    /updateDoc\s*\([\s\S]{0,600}?miningActive\s*:\s*true/.test(source);
  if (writesMiningStart) executableWriters.push(name);
}
assert.deepEqual(executableWriters, ['rewards-security-v1.js'], `expected one mining writer, found: ${executableWriters.join(', ')}`);

console.log('PASS mining architecture: one Firestore-authoritative writer, no recovery/fetch competitors.');
