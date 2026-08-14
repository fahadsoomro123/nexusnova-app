import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, serverTimestamp
} from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-referral-rules';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});

const referrer=env.authenticatedContext('referrer-1',{email:'referrer@example.com',email_verified:true}).firestore();
const referredUnverified=env.authenticatedContext('referred-1',{email:'referred@example.com',email_verified:false}).firestore();
const referredVerified=env.authenticatedContext('referred-1',{email:'referred@example.com',email_verified:true}).firestore();
const oldUser=env.authenticatedContext('old-user',{email:'old@example.com',email_verified:true}).firestore();
const stranger=env.authenticatedContext('stranger-ref',{email:'stranger@example.com',email_verified:true}).firestore();
const anon=env.unauthenticatedContext().firestore();

const baseProfile=(uid,email,createdAt=new Date(),totalMined=0)=>({
  uid,name:'Miner',email,balance:0,totalMined,tasksCompleted:0,completedTasks:{},
  miningActive:false,miningStartedAt:0,miningLastUpdate:0,sessionEarned:0,
  lastDailyReward:0,dailyRewardStreak:0,createdAt
});

const CODE='NVX-ABCDEFGH';

try {
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'users/referrer-1'),baseProfile('referrer-1','referrer@example.com',new Date(),72));
    await setDoc(doc(db,'users/referred-1'),baseProfile('referred-1','referred@example.com',new Date(),0));
    await setDoc(doc(db,'users/old-user'),baseProfile('old-user','old@example.com',new Date(Date.now()-49*60*60*1000),0));
    await setDoc(doc(db,'users/stranger-ref'),baseProfile('stranger-ref','stranger@example.com',new Date(),0));
  });

  const codeRef=doc(referrer,`referralCodes/${CODE}`);
  await assertSucceeds(setDoc(codeRef,{ownerUid:'referrer-1',code:CODE,createdAt:serverTimestamp()}));
  console.log('PASS owner can create one privacy-safe referral code document');

  await assertSucceeds(getDoc(doc(referredUnverified,`referralCodes/${CODE}`)));
  await assertFails(getDoc(doc(anon,`referralCodes/${CODE}`)));
  await assertFails(getDocs(collection(referrer,'referralCodes')));
  console.log('PASS referral code supports signed-in direct lookup but cannot be anonymously read or enumerated');

  await assertFails(updateDoc(doc(stranger,`referralCodes/${CODE}`),{ownerUid:'stranger-ref'}));
  await assertFails(deleteDoc(codeRef));
  console.log('PASS referral code ownership is immutable');

  const relation={
    referredUid:'referred-1',
    referrerUid:'referrer-1',
    code:CODE,
    status:'pending',
    createdAt:serverTimestamp()
  };
  const relationRef=doc(referredUnverified,'referrals/referred-1');
  await assertSucceeds(setDoc(relationRef,relation));
  console.log('PASS genuine new account can attach one pending referral relationship');

  await assertSucceeds(getDoc(doc(referrer,'referrals/referred-1')));
  await assertSucceeds(getDoc(doc(referredUnverified,'referrals/referred-1')));
  await assertFails(getDoc(doc(stranger,'referrals/referred-1')));
  const referredByMe=query(collection(referrer,'referrals'),where('referrerUid','==','referrer-1'));
  const myReferralRows=await assertSucceeds(getDocs(referredByMe));
  assert.equal(myReferralRows.size,1);
  console.log('PASS referral relationship is readable only by referred user or matching referrer query');

  await assertFails(setDoc(doc(referrer,'referrals/referrer-1'),{
    referredUid:'referrer-1',referrerUid:'referrer-1',code:CODE,status:'pending',createdAt:serverTimestamp()
  }));
  console.log('PASS self-referral denied');

  await assertFails(setDoc(doc(stranger,'referrals/referred-1'),relation));
  console.log('PASS another user cannot attach or overwrite somebody else referral');

  await assertFails(setDoc(doc(oldUser,'referrals/old-user'),{
    referredUid:'old-user',referrerUid:'referrer-1',code:CODE,status:'pending',createdAt:serverTimestamp()
  }));
  console.log('PASS old account cannot backfill referral attribution after 24-hour new-account window');

  await assertFails(setDoc(doc(stranger,'referrals/stranger-ref'),{
    referredUid:'stranger-ref',referrerUid:'not-the-code-owner',code:CODE,status:'pending',createdAt:serverTimestamp()
  }));
  console.log('PASS forged referrer UID that does not own code is denied');

  await assertFails(updateDoc(relationRef,{status:'verified',verifiedAt:serverTimestamp()}));
  console.log('PASS unverified email cannot verify a referral');

  await assertFails(updateDoc(doc(referredVerified,'referrals/referred-1'),{status:'verified',verifiedAt:serverTimestamp()}));
  console.log('PASS verified email alone is insufficient before first mining cycle');

  await env.withSecurityRulesDisabled(async ctx=>{
    await updateDoc(doc(ctx.firestore(),'users/referred-1'),{totalMined:24,balance:24});
  });

  await assertFails(updateDoc(doc(referrer,'referrals/referred-1'),{status:'verified',verifiedAt:serverTimestamp()}));
  console.log('PASS referrer cannot self-approve the referred account');

  await assertSucceeds(updateDoc(doc(referredVerified,'referrals/referred-1'),{status:'verified',verifiedAt:serverTimestamp()}));
  const verified=await getDoc(doc(referredVerified,'referrals/referred-1'));
  assert.equal(verified.data().status,'verified');
  console.log('PASS verified referred user with >=24 authoritative mined NVX can verify referral');

  await assertFails(updateDoc(doc(referredVerified,'referrals/referred-1'),{referrerUid:'stranger-ref'}));
  await assertFails(deleteDoc(doc(referredVerified,'referrals/referred-1')));
  console.log('PASS verified referral attribution cannot be reassigned or deleted');

  console.log('\nReferral rules smoke complete: attribution, privacy, anti-self-referral and verification passed.');
} finally {
  await env.cleanup();
}
