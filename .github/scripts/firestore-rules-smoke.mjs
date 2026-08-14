import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-rules';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});

const seller=env.authenticatedContext('seller-1',{email:'seller@example.com'}).firestore();
const buyer=env.authenticatedContext('buyer-1',{email:'buyer@example.com'}).firestore();
const stranger=env.authenticatedContext('stranger-1',{email:'stranger@example.com'}).firestore();
const miner=env.authenticatedContext('miner-1',{email:'miner@example.com',email_verified:true}).firestore();
const unverifiedMiner=env.authenticatedContext('miner-2',{email:'miner2@example.com',email_verified:false}).firestore();
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
  console.log('PASS seller valid listing create allowed');

  await assertFails(setDoc(doc(buyer,'marketplaceListings/forged'),{...validListing,sellerUid:'seller-1'}));
  console.log('PASS buyer cannot forge seller listing');

  await assertFails(updateDoc(doc(buyer,'marketplaceListings/listing-1'),{price:1,updatedAt:serverTimestamp()}));
  console.log('PASS non-owner listing edit denied');

  const orderRef=doc(buyer,'marketplaceOrders/order-1');
  const order={listingId:'listing-1',buyerUid:'buyer-1',sellerUid:'seller-1',title:'Runtime Bicycle',amount:25000,currency:'PKR',status:'requested',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await assertSucceeds(setDoc(orderRef,order));
  console.log('PASS buyer valid order request allowed');

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
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'users/miner-1'),baseProfile('miner-1','miner@example.com'));
    await setDoc(doc(ctx.firestore(),'users/miner-2'),baseProfile('miner-2','miner2@example.com'));
  });

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

  await env.withSecurityRulesDisabled(async ctx=>{
    await updateDoc(doc(ctx.firestore(),'users/miner-1'),{
      miningActive:true,
      miningStartedAt:Date.now()-86400000-5000,
      miningLastUpdate:Date.now()-86400000-5000,
      balance:0,
      totalMined:0
    });
  });

  const finishNow=Date.now();
  await assertSucceeds(updateDoc(minerRef,{balance:24,totalMined:24,miningActive:false,miningStartedAt:0,miningLastUpdate:finishNow}));
  const finished=await getDoc(minerRef);
  assert.equal(finished.data().balance,24);
  assert.equal(finished.data().totalMined,24);
  assert.equal(finished.data().miningActive,false);
  console.log('PASS exactly 24 NVX can be credited after a verified 24-hour session');

  await assertFails(updateDoc(minerRef,{balance:48,totalMined:48,miningLastUpdate:Date.now()}));
  console.log('PASS finished session cannot be replayed for another reward');

  console.log('\nFirestore rules smoke complete: security cases passed.');
} finally {
  await env.cleanup();
}
