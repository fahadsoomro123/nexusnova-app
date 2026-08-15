import fs from 'node:fs';

const src = fs.readFileSync('functions/rewardedAds.js','utf8');
const notifications = fs.readFileSync('functions/notifications.js','utf8');

const required = [
  "defineSecret('AYET_PUBLISHER_API_KEY')",
  "defineString('NEXUSNOVA_AYET_ADSLOT_ID'",
  'const REWARD_NVX = 2.5',
  "req.get('X-Ayetstudios-Security-Hash')",
  "createHmac('sha256'",
  'crypto.timingSafeEqual',
  "params.get('transaction_id')",
  "params.get('external_identifier')",
  "params.get('currency_amount')",
  "params.get('adslot_id')",
  'adslotId !== expectedAdslot',
  '!exactReward(amount)',
  "db.collection('rewardedAdTransactions').doc(rewardId)",
  'tx.create(rewardRef',
  'rewardedAdCount: FieldValue.increment(1)',
  'rewardedAdTotalNvx: FieldValue.increment(REWARD_NVX)',
  "reason: 'invalid_signature'",
  "reason: 'unexpected_reward_amount'"
];

for (const token of required) {
  if (!src.includes(token)) throw new Error(`Rewarded-ad backend security marker missing: ${token}`);
}

if (!notifications.includes('Object.assign(exports, require("./rewardedAds"));')) {
  throw new Error('Rewarded-ad callback is not exported through the Functions bundle.');
}

const forbidden = [
  /AYET_PUBLISHER_API_KEY\s*=\s*['"][^'"]{8,}['"]/, // never hard-code a secret
  /balance\s*[:=]\s*[^\n;]*currency_amount/i,      // never trust provider amount as arbitrary credit
  /req\.body[^\n]*balance/i                          // never accept client-supplied balance
];
for (const pattern of forbidden) {
  if (pattern.test(src)) throw new Error(`Unsafe rewarded-ad backend pattern found: ${pattern}`);
}

console.log('Rewarded-ad backend security smoke passed.');
