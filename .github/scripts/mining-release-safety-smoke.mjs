import fs from 'node:fs';

const ssv = fs.readFileSync('functions/admobRewardedSsvV2.js', 'utf8');
const vault10x = fs.readFileSync('functions/novaVault10x.js', 'utf8');
const mining = fs.readFileSync('functions/index.js', 'utf8');
const client = fs.readFileSync('fresh-rebuild/src/core/release-mining-safety.js', 'utf8');
const store = fs.readFileSync('fresh-rebuild/src/core/nova-mining-rewards-store.js', 'utf8');
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

requireTokens('Nova Vault 10X', vault10x, [
  'directNvx:false',
  'totalWeight:40000',
  'booster:18000/40000',
  'rain:17000/40000',
  'timeWarp:5000/40000',
  '10X credits are earned from normal Vault milestones, never from ads.'
]);
forbid('Nova Vault 10X', vault10x, [
  /type===?['"]nvx['"]/,
  /boostedNvx/i,
  /randomInt\(5\s*,\s*26\)/
]);

requireTokens('Mining backend', mining, [
  'NOVA_MAX_BOOSTER_USES=2',
  'NOVA_MAX_RAIN_USES=4',
  'NOVA_VAULTS_PER_BOOST_CREDIT=7',
  'novaVaultMilestoneProgress',
  'novaBoosterUsesThisSession',
  'novaRainUsesThisSession',
  'miningActive:true,miningStartedAt:now',
  'novaBoostUsesThisSession:0'
]);
forbid('Mining backend', mining, [
  /novaVaultPending:inv\.pendingVaults\+1/
]);

requireTokens('Mining client safety', client, [
  "claimDailyRewardCloudflare({ source:'fresh-rebuild-release-direct' })",
  "purpose:'task-watch-ad'",
  'No NVX or mining reward was credited.',
  "httpsCallable(functions, 'openNovaVaultBoosted')",
  "source:'normal-vault-milestone'"
]);
forbid('Mining client safety', client, [
  /purpose:['"]nova-vault-10x['"]/
]);

requireTokens('Cloudflare client scope', store, [
  "claimDailyReward: '/v1/tasks/daily/claim'",
  'This mining reward action is handled by the Firebase secure backend.'
]);
forbid('Cloudflare client scope', store, [
  /openNovaVaultBoosted\s*:/,
  /useNovaBoost\s*:/,
  /useNovaTimeWarp\s*:/
]);

const releaseBlock = android.match(/release\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
if (!releaseBlock.includes('NEXUS_ADS_TEST_MODE\", \"true')) {
  throw new Error('Android release build is not locked to TEST ads.');
}
if (!releaseBlock.includes('ca-app-pub-3940256099942544~3347511713')) {
  throw new Error('Android release build is not using the Google TEST App ID.');
}

console.log('Mining release safety smoke passed.');
