import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-nova-vault';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});
const DAY=86_400_000;
const now=Date.now();

const verified=uid=>env.authenticatedContext(uid,{email:`${uid}@example.com`,email_verified:true}).firestore();
const profile=(uid,pending=0)=>({
  uid,name:'Nova Miner',email:`${uid}@example.com`,
  balance:10,totalMined:24,tasksCompleted:0,completedTasks:{},
  miningActive:true,miningStartedAt:now-DAY-10_000,miningLastUpdate:now-DAY-10_000,
  sessionEarned:0,lastDailyReward:0,dailyRewardStreak:0,novaVaultPending:pending,
  createdAt:new Date(now-DAY*3)
});

try{
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'users/vault-ok'),profile('vault-ok',2));
    await setDoc(doc(ctx.firestore(),'users/vault-cheat'),profile('vault-cheat',0));
    await setDoc(doc(ctx.firestore(),'users/boost-cheat'),profile('boost-cheat',0));
  });

  const ok=verified('vault-ok');
  const okRef=doc(ok,'users/vault-ok');
  await assertSucceeds(updateDoc(okRef,{
    balance:34,
    totalMined:48,
    miningActive:false,
    miningStartedAt:0,
    miningLastUpdate:Date.now(),
    novaVaultPending:3
  }));
  const snap=await getDoc(okRef);
  assert.equal(snap.data().novaVaultPending,3);
  assert.equal(snap.data().balance,34);
  console.log('PASS natural 24H finish grants exactly one additional pending Nova Vault');

  await assertFails(updateDoc(okRef,{novaBoosterInventory:99}));
  await assertFails(updateDoc(okRef,{novaRainInventory:99}));
  await assertFails(updateDoc(okRef,{novaTimeWarpInventory:99}));
  await assertFails(updateDoc(okRef,{novaFeatureCooldownUntil:Date.now()+15000}));
  console.log('PASS client cannot mint Nova inventory or alter shared cooldown');

  const cheat=verified('vault-cheat');
  await assertFails(updateDoc(doc(cheat,'users/vault-cheat'),{
    balance:34,
    totalMined:48,
    miningActive:false,
    miningStartedAt:0,
    miningLastUpdate:Date.now(),
    novaVaultPending:2
  }));
  console.log('PASS natural completion cannot grant two Vaults');

  const boost=verified('boost-cheat');
  await assertFails(updateDoc(doc(boost,'users/boost-cheat'),{miningStartedAt:now-DAY-10_000-2*60*60*1000}));
  console.log('PASS direct client two-hour Mining Boost remains denied');

  console.log('\nNova Vault Firestore smoke complete.');
}finally{
  await env.cleanup();
}
