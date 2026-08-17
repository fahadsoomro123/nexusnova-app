import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-rules';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});

// Marketplace writes are intentionally verified-email-only in production.
// Keep the main happy-path actors verified so this smoke tests the workflow,
// not a missing Auth claim. Separate unverified mining/reward contexts below
// continue to prove value-bearing operations are rejected for unverified users.
const seller=env.authenticatedContext('seller-1',{email:'seller@example.com',email_verified:true}).firestore();
const buyer=env.authenticatedContext('buyer-1',{email:'buyer@example.com',email_verified:true}).firestore();
const stranger=env.authenticatedContext('stranger-1',{email:'stranger@example.com',email_verified:true}).firestore();
const miner=env.authenticatedContext('miner-1',{email:'miner@example.com',email_verified:true}).firestore();
const unverifiedMiner=env.authenticatedContext('miner-2',{email:'miner2@example.com',email_verified:false}).firestore();
const rewarder=env.authenticatedContext('rewarder-1',{email:'rewarder@example.com',email_verified:true}).firestore();
const unverifiedRewarder=env.authenticatedContext('rewarder-2',{email:'rewarder2@example.com',email_verified:false}).firestore();
const anon=env.unauthenticatedContext().firestore();

const listingRef=doc(seller,'marketplaceListings/listing-1');
const validListing={
  sellerUid:'seller-1',sellerName:'Seller',title:'Runtime Bicycle',description:'Good condition',
  category:'Vehicles & Parts',price:25000,currency:'PKR',status:'active',
  createdAt:serverTimestamp(),updatedAt:serverTimestamp()
};

const baseProfile=(uid,email)=>({
  uid,name:'Miner',email,balance:0,totalMined:0,tasksCompleted:0,completedTasks:{},
  miningActive:false,miningStartedAt:0,miningLastUpdate:0,sessionEarned:0,
  lastDailyReward:0,dailyRewardStreak:0,createdAt:new Date()
});

try {
  await assertFails(getDoc(doc(anon,'marketplaceListings/listing-1')));
  console.log('PASS unauthenticated marketplace read denied');

  await assertSucceeds(setDoc(listingRef,validListing));
  console.log('PASS verified seller valid listing create allowed');

  await assertFails(setDoc(doc(buyer,'marketplaceListings/forged'),{...validListing,sellerUid:'seller-1'}));
  console.log('PASS buyer cannot forge seller listing');

  await assertFails(updateDoc(doc(buyer,'marketplaceListings/listing-1'),{price:1,updatedAt:serverTimestamp()}));
  console.log('PASS non-owner listing edit denied');

  const orderRef=doc(buyer,'marketplaceOrders/order-1');
  const order={listingId:'listing-1',buyerUid:'buyer-1',sellerUid:'seller-1',title:'Runtime Bicycle',amount:25000,currency:'PKR',status:'requested',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await assertSucceeds(setDoc(orderRef,order));
  console.log('PASS verified buyer valid order request allowed');

  await assertFails(setDoc(doc(buyer,'marketplaceOrders/order-forged-price'),{...order,amount:1}));
  console.log('PASS forged order price denied');

  await assertFails(getDoc(doc(stranger,'marketplaceOrders/order-1')));
  await assertSucceeds(getDoc(doc(seller,'marketplaceOrders/order-1')));
  await assertSucceeds(getDoc(doc(buyer,'marketplaceOrders/order-1')));
  console.log('PASS order privacy limited to buyer/seller');

  await assertFails(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'delivered',updatedAt:serverTimestamp()}));
  console.log('PASS seller cannot skip requested directly to delivered');

  await assertFails(updateDoc(doc(buyer,'marketplaceOrders/order-1'),{status:'return_requested',updatedAt:serverTimestamp()}));
  console.log('PASS buyer cannot request return before delivery');

  await assertSucceeds(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'accepted',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'processing',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'shipped',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'out_for_delivery',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(seller,'marketplaceOrders/order-1'),{status:'delivered',updatedAt:serverTimestamp()}));
  console.log('PASS seller sequential order workflow allowed');

  await assertSucceeds(updateDoc(doc(buyer,'marketplaceOrders/order-1'),{status:'return_requested',updatedAt:serverTimestamp()}));
  console.log('PASS buyer return request allowed only after delivered');

  await assertFails(deleteDoc(doc(buyer,'marketplaceOrders/order-1')));
  console.log('PASS order deletion denied');

  const minerRef=doc(miner,'users/miner-1');
  const unverifiedMinerRef=doc(unverifiedMiner,'users/miner-2');
  const rewarderRef=doc(rewarder,'users/rewarder-1');
  const unverifiedRewarderRef=doc(unverifiedRewarder,'users/rewarder-2');
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'users/miner-1'),{...baseProfile('miner-1','miner@example.com'),referralCode:'NVXMINER1'});
    await setDoc(doc(ctx.firestore(),'users/miner-2'),baseProfile('miner-2','miner2@example.com'));
    await setDoc(doc(ctx.firestore(),'users/rewarder-1'),{...baseProfile('rewarder-1','rewarder@example.com'),balance:10});
    await setDoc(doc(ctx.firestore(),'users/rewarder-2'),baseProfile('rewarder-2','rewarder2@example.com'));
  });

  // Privacy-safe public leaderboard mirror. It contains no email, wallet,
  // balance or user-controlled score: values must equal the secure user doc.
  const leagueRef=doc(miner,'leaderboardPublic/miner-1');
  const leagueZero={name:'Miner',totalMined:0,tasksCompleted:0,dailyRewardStreak:0,updatedAt:serverTimestamp()};
  await assertSucceeds(setDoc(leagueRef,leagueZero));
  console.log('PASS verified miner can publish exact privacy-safe leaderboard mirror');

  await assertSucceeds(getDoc(doc(stranger,'leaderboardPublic/miner-1')));
  await assertFails(getDoc(doc(anon,'leaderboardPublic/miner-1')));
  console.log('PASS leaderboard readable to signed-in community but denied to anonymous users');

  await assertFails(setDoc(leagueRef,{...leagueZero,totalMined:999999}));
  console.log('PASS miner cannot forge leaderboard mining score');

  await assertFails(setDoc(leagueRef,{...leagueZero,email:'miner@example.com'}));
  console.log('PASS private email field cannot be published in leaderboard document');

  await assertFails(setDoc(doc(stranger,'leaderboardPublic/miner-1'),leagueZero));
  console.log('PASS another signed-in user cannot overwrite a miner leaderboard document');

  await assertFails(setDoc(doc(unverifiedMiner,'leaderboardPublic/miner-2'),leagueZero));
  console.log('PASS unverified miner cannot publish leaderboard position');

  // Daily Reward: first verified claim is exactly +5 and starts streak 1.
  const dailyNow=Date.now();
  await assertSucceeds(updateDoc(rewarderRef,{balance:15,lastDailyReward:dailyNow,dailyRewardStreak:1}));
  let dailyDoc=await getDoc(rewarderRef);
  assert.equal(dailyDoc.data().balance,15);
  assert.equal(dailyDoc.data().dailyRewardStreak,1);
  console.log('PASS verified user can claim exact +5 daily reward after cooldown');

  await assertFails(updateDoc(rewarderRef,{balance:20,lastDailyReward:Date.now(),dailyRewardStreak:2}));
  console.log('PASS immediate repeat daily reward denied');

  await env.withSecurityRulesDisabled(async ctx=>{
    await updateDoc(doc(ctx.firestore(),'users/rewarder-1'),{
      balance:15,
      lastDailyReward:Date.now()-25*60*60*1000,
      dailyRewardStreak:1
    });
  });

  await assertFails(updateDoc(rewarderRef,{balance:21,lastDailyReward:Date.now(),dailyRewardStreak:2}));
  console.log('PASS daily reward cannot mint +6 or arbitrary value');

  const continuationNow=Date.now();
  await assertSucceeds(updateDoc(rewarderRef,{balance:20,lastDailyReward:continuationNow,dailyRewardStreak:2}));
  dailyDoc=await getDoc(rewarderRef);
  assert.equal(dailyDoc.data().balance,20);
  assert.equal(dailyDoc.data().dailyRewardStreak,2);
  console.log('PASS 24-48h daily claim continues streak by exactly one');

  await assertFails(updateDoc(unverifiedRewarderRef,{balance:5,lastDailyReward:Date.now(),dailyRewardStreak:1}));
  console.log('PASS unverified user cannot claim daily NVX');

  const startNow=Date.now();
  await assertSucceeds(updateDoc(minerRef,{miningActive:true,miningStartedAt:startNow,miningLastUpdate:startNow}));
  console.log('PASS verified user can start a current mining session');

  await assertFails(updateDoc(minerRef,{balance:999}));
  console.log('PASS arbitrary balance mint denied');

  await assertFails(updateDoc(minerRef,{balance:24,totalMined:24,miningActive:false,miningStartedAt:0,miningLastUpdate:Date.now()}));
  console.log('PASS mining reward cannot be claimed before 24 hours');

  const unverifiedNow=Date.now();
  await assertFails(updateDoc(unverifiedMinerRef,{miningActive:true,miningStartedAt:unverifiedNow,miningLastUpdate:unverifiedNow}));
  console.log('PASS unverified email cannot start value-bearing mining');

  // Seed the exact kind of legacy expired state seen in production. Extra
  // profile fields must not prevent a valid mining-only transition.
  await env.withSecurityRulesDisabled(async ctx=>{
    await updateDoc(doc(ctx.firestore(),'users/miner-1'),{
      miningActive:true,
      miningStartedAt:Date.now()-86400000-5000,
      miningLastUpdate:Date.now()-86400000-5000,
      balance:63,
      totalMined:48,
      referralCode:'NVXMINER1'
    });
  });

  // Mirror the single-owner engine: transaction #1 settles exactly +24.
  await assertSucceeds(runTransaction(miner,async tx=>{
    const snap=await tx.get(minerRef);
    const d=snap.data();
    const now=Date.now();
    tx.update(minerRef,{
      balance:Number(d.balance)+24,
      totalMined:Number(d.totalMined)+24,
      miningActive:false,
      miningStartedAt:0,
      miningLastUpdate:now
    });
  }));

  let finished=await getDoc(minerRef);
  assert.equal(finished.data().balance,87);
  assert.equal(finished.data().totalMined,72);
  assert.equal(finished.data().miningActive,false);
  assert.equal(finished.data().referralCode,'NVXMINER1');
  console.log('PASS legacy 63/48 expired session settles to 87/72 without touching unrelated fields');

  await assertSucceeds(setDoc(leagueRef,{name:'Miner',totalMined:72,tasksCompleted:0,dailyRewardStreak:0,updatedAt:serverTimestamp()}));
  const leagueAfterMining=await getDoc(leagueRef);
  assert.equal(leagueAfterMining.data().totalMined,72);
  console.log('PASS leaderboard can sync only the newly verified 72 NVX mining total');

  await assertFails(setDoc(leagueRef,{name:'Miner',totalMined:96,tasksCompleted:0,dailyRewardStreak:0,updatedAt:serverTimestamp()}));
  console.log('PASS leaderboard cannot get ahead of authoritative mining total');

  // Mirror transaction #2: immediately start the next 24h session.
  await assertSucceeds(runTransaction(miner,async tx=>{
    const snap=await tx.get(minerRef);
    const d=snap.data();
    assert.equal(d.miningActive,false);
    assert.equal(Number(d.miningStartedAt),0);
    const now=Date.now();
    tx.update(minerRef,{miningActive:true,miningStartedAt:now,miningLastUpdate:now});
  }));

  const restarted=await getDoc(minerRef);
  assert.equal(restarted.data().balance,87);
  assert.equal(restarted.data().totalMined,72);
  assert.equal(restarted.data().miningActive,true);
  assert.ok(Number(restarted.data().miningStartedAt)>0);
  console.log('PASS settled legacy session can immediately start a fresh 24h session');

  await assertFails(updateDoc(minerRef,{balance:111,totalMined:96,miningLastUpdate:Date.now()}));
  console.log('PASS active new session cannot replay another +24 reward');

  console.log('\nFirestore rules smoke complete: leaderboard + daily reward + mining + marketplace security passed.');
} finally {
  await env.cleanup();
}
