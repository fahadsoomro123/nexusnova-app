import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

const page = read('page2.html');
const rootCss = read('css/nexusnova-final-user-fixes-v1.css');
const androidCss = read('NexusNovaAndroid/app/src/main/assets/www/css/nexusnova-final-user-fixes-v1.css');
const miningUi = read('js/nexusnova-android-mining-modern-v2.js');
const afterCore = read('js/nexusnova-page2-after-core-v2.js');

// The production mining surface must keep the stable semantic anchors used by
// the secure mining owner. Presentation changes are allowed; IDs are not.
for (const anchor of [
  'id="tab-home"',
  'id="balance"',
  'id="mineBtn"',
  'id="btnText"',
  'id="timer"',
  'HALVING STAGE',
  'MINING RATE'
]) {
  assert.ok(page.includes(anchor), `mining surface anchor missing: ${anchor}`);
}

// Hyper-realistic layer must stay present in both the online source and the
// Android offline bundle so a future APK cannot silently regress to flat UI.
for (const [name, css] of [['root', rootCss], ['android', androidCss]]) {
  assert.match(css, /hyper-realistic-3d-mining-v1-2026-08-30/, `${name} premium mining marker missing`);
  assert.match(css, /#mineBtn\.mine-btn:active/, `${name} tactile press state missing`);
  assert.match(css, /perspective:/, `${name} 3D perspective missing`);
  assert.match(css, /backdrop-filter:blur/, `${name} glass depth treatment missing`);
  assert.match(css, /stat-card:first-child/, `${name} halving card treatment missing`);
  assert.match(css, /stat-card:nth-child\(2\)/, `${name} mining-rate card treatment missing`);
  assert.match(css, /prefers-reduced-motion:reduce/, `${name} reduced-motion safety missing`);
}

// Halving/FOMO is display-only. It may read already-rendered stage/rate labels,
// but it must never become another mining/reward writer.
assert.match(miningUi, /mining-modern-v4-halving-fomo/, 'halving/FOMO presentation version missing');
assert.match(miningUi, /NVX HALVING WATCH/, 'halving awareness card missing');
assert.match(miningUi, /No fake countdown/, 'truthful halving timing disclosure missing');
assert.match(miningUi, /readStat\(/, 'halving UI must read the existing authoritative labels');
assert.doesNotMatch(miningUi, /\brunTransaction\b|\bupdateDoc\b|\bsetDoc\b|\baddDoc\b|\bhttpsCallable\b|\.collection\s*\(/,
  'presentation-only mining UI must not contain a value-writing backend path');

// The premium module must stay off the critical Firebase/Auth bootstrap path.
assert.match(afterCore, /nexusnova-android-mining-modern-v2\.js\?v=4/, 'premium mining module is not loaded post-core');
assert.match(afterCore, /premium mining\/halving UI/, 'premium mining loader diagnostic missing');

console.log('PASS premium mining UI: tactile 3D layer, truthful halving FOMO, Android visual parity, no value-writing presentation code.');
