import fs from 'node:fs';

const ssv = fs.readFileSync('functions/admobRewardedSsvV2.js', 'utf8');
const client = fs.readFileSync('fresh-rebuild/src/core/release-mining-safety.js', 'utf8');
const store = fs.readFileSync('fresh-rebuild/src/core/nova-mining-rewards-store.js', 'utf8');
const adapter = fs.readFileSync('fresh-rebuild/src/core/backend-adapter.js', 'utf8');
const workerV2 = fs.readFileSync('cloudflare/nova-mining-rewards-worker/src/index-v2.js', 'utf8');
const android = fs.readFileSync('NexusNovaAndroid/app/build.gradle.kts', 'utf8');

function requireTokens(name, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${name} safety marker missing: ${token}`);
  }
}

function forbid(name, source, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(source)) throw new Error(`${name} unsafe marker found: ${pattern}`);
  }
}

// Canonical Firebase AdMob SSV remains no-value even though mining mutations are
// now routed through Cloudflare v2.
requireTokens('AdMob SSV', ssv, [
  "fulfillment:'no-value-release-safe'",
  "credited:false",
  "directNvx:false",
  "vaultBoostCredit:false",
  "reason:'ads_do_not_grant_mining_or_token_value'"
]);
forbid('AdMob SSV', ssv, [
  /WATCH_REWARD_NVX\s*=/,
  /rewardNvx\s*:/,
  /novaVaultBoostCredits\s*:/,
  /rewardedAdTotalNvx\s*:/
]);

// Active Cloudflare v2 reward/mining backend invariants.
requireTokens('Cloudflare v2 backend', workerV2, [
  'NOVA_MAX_BOOSTER_USES = 2',
  'NOVA_MAX_RAIN_USES = 4',
  'novaBoosterUsesThisSession',
  'novaRainUsesThisSession',
  'novaVaultPending:inv.pendingVaults',
  'miningActive:true',
  "reason:'ads_do_not_grant_mining_or_token_value'",
  "url.pathname === '/v1/mining/toggle'",
  "url.pathname === '/v1/vault/open'",
  "url.pathname === '/v1/vault/boosted/open'",
  "url.pathname === '/v1/boost/use'",
  "url.pathname === '/v1/boost/time-warp'"
]);
forbid('Cloudflare v2 backend', workerV2, [
  /WATCH_REWARD_NVX\s*=/,
  /rewardNvx\s*:/,
  /rewardedAdTotalNvx\s*:/,
  /novaVaultBoostCredits\s*:/,
  /novaVaultPending\s*:\s*inv\.pendingVaults\s*\+\s*1/
]);

// Active web client must route mining value actions through Cloudflare, while
// TEST rewarded ads remain no-value and can run without Firebase being healthy.
requireTokens('Mining client safety', client, [
  "claimDailyRewardCloudflare({ source:'fresh-rebuild-cloudflare-v2' })",
  "purpose:'task-watch-ad'",
  'No NVX or mining reward was credited.',
  'openNovaVaultCloudflare',
  'openNovaVaultBoostedCloudflare',
  'useNovaBoostCloudflare',
  'useNovaTimeWarpCloudflare',
  'TEST rewarded ads are diagnostics only'
]);
forbid('Mining client safety', client, [
  /purpose:['"]nova-vault-10x['"]/,
  /httpsCallable\(/,
  /WATCH_REWARD_NVX/
]);

requireTokens('Cloudflare client scope', store, [
  "toggleMining: '/v1/mining/toggle'",
  "openNovaVault: '/v1/vault/open'",
  "openNovaVaultBoosted: '/v1/vault/boosted/open'",
  "useNovaBoost: '/v1/boost/use'",
  "useNovaTimeWarp: '/v1/boost/time-warp'",
  "const user = await requireFirebaseUser({ verified:true });"
]);
forbid('Cloudflare client scope', store, [
  /httpsCallable\(/,
  /requireFirebaseUser\(\{\s*write\s*:\s*true\s*\}\)/
]);

requireTokens('Mining adapter', adapter, [
  "import { toggleMiningCloudflare } from './nova-mining-rewards-store.js';",
  "toggleMiningCloudflare({ source:'fresh-rebuild-cloudflare-v2' })",
  'post-Cloudflare mining snapshot'
]);
forbid('Mining adapter', adapter, [
  /this\.bridge\.toggleMining\(/,
  /httpsCallable\(/
]);

const releaseBlock = android.match(/release\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
if (!releaseBlock.includes('NEXUS_ADS_TEST_MODE", "true')) {
  throw new Error('Android release build is not locked to TEST ads.');
}
if (!releaseBlock.includes('ca-app-pub-3940256099942544~3347511713')) {
  throw new Error('Android release build is not using the Google TEST App ID.');
}

console.log('Mining release safety smoke passed.');
