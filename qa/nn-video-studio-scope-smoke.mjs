import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('fresh-rebuild/assets/styles/nn-video-studio.css', 'utf8');
const upgrade = fs.readFileSync('fresh-rebuild/src/features/apps/nn-video-studio-upgrade.js', 'utf8');
const appScreen = fs.readFileSync('fresh-rebuild/src/features/apps/app-screen.js', 'utf8');

const requiredScopedSelectors = [
  '.nn-video-editor .nn-timeline__ruler',
  '.nn-video-editor .nn-track__row',
  '.nn-video-editor .nn-clip__body',
  '.nn-video-editor .nn-clip__handle',
  '.nn-video-editor .nn-playhead',
  '.nn-video-editor .nn-video-editor__scroll'
];

function escapeRegExp(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

for (const selector of requiredScopedSelectors) {
  assert.match(css, new RegExp(escapeRegExp(selector)));
}

const unscopedPatterns = [
  /^\.nn-timeline__ruler\{/m,
  /^\.nn-track__label\{/m,
  /^\.nn-track__row\{/m,
  /^\.nn-clip__body\{/m,
  /^\.nn-clip__handle\{/m,
  /^\.nn-playhead\{/m,
  /^\.nn-video-editor__scroll\{/m
];

for (const pattern of unscopedPatterns) {
  assert.doesNotMatch(css, pattern);
}

assert.match(css, /@media\(max-width:520px\)/);
assert.match(css, /touch-action:none/);
assert.match(upgrade, /new AbortController\(\)/);
assert.match(upgrade, /grid\.dispose\(\)/);
assert.match(upgrade, /editor\.destroy\(\)/);
assert.match(upgrade, /bridgeCleanup\(\)/);
assert.match(upgrade, /releaseStyle\(\)/);
assert.match(upgrade, /signal: lifecycleController\.signal/);
assert.doesNotMatch(upgrade, /window\.addEventListener\(/);
assert.doesNotMatch(upgrade, /document\.addEventListener\(/);
assert.match(appScreen, /enhanceAiVideoStudio\(body\)/);
assert.match(appScreen, /body\.__nnVideoTimelineCleanup\?\.\(\)/);

console.log('NexusNova AI Video Studio component-scope/lifecycle audit: PASS.');
