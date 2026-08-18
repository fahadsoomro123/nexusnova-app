import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-vault10x';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});
const uid='vault10x-user';
const now=Date.now();

try {
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),`users/${uid}`),{
      uid,name:'Vault Tester',email:`${uid}@example.com`,
      balance:10,totalMined:24,tasksCompleted:0,completedTasks:{},
      miningActive:false,miningStartedAt:0,miningLastUpdate:0,
      sessionEarned:0,lastDailyReward:0,dailyRewardStreak:0,
      novaVaultPending:1,novaVaultBoostCredits:0,
      novaBoosterInventory:0,novaRainInventory:0,novaTimeWarpInventory:0,
      novaFeatureCooldownUntil:0,createdAt:new Date(now-86_400_000)
    });
  });

  const db=env.authenticatedContext(uid,{email:`${uid}@example.com`,email_verified:true}).firestore();
  const ref=doc(db,`users/${uid}`);

  await assertFails(updateDoc(ref,{novaVaultBoostCredits:1}));
  await assertFails(updateDoc(ref,{novaVaultBoostCredits:3,novaVaultPending:0}));
  await assertFails(updateDoc(ref,{novaLastVaultMode:'10x'}));
  await assertFails(updateDoc(ref,{novaBoosterInventory:1,novaVaultBoostCredits:0,novaVaultPending:0}));

  console.log('PASS Firestore rules: Web/mobile clients cannot mint 10x credits, consume them, or forge boosted Vault rewards.');
} finally {
  await env.cleanup();
}
