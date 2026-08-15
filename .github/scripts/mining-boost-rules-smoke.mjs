import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId = 'demo-nexusnova-rules';
const rules = await fs.readFile('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({projectId, firestore:{rules}});

const HOUR = 60 * 60 * 1000;
const BOOST = 2 * HOUR;
const MAX = 12 * HOUR;

const verified = env.authenticatedContext('boost-miner', {
  email:'boost@example.com', email_verified:true
}).firestore();
const unverified = env.authenticatedContext('boost-unverified', {
  email:'boost2@example.com', email_verified:false
}).firestore();

const verifiedRef = doc(verified, 'users/boost-miner');
const unverifiedRef = doc(unverified, 'users/boost-unverified');

const profile = (uid, email, anchor) => ({
  uid,
  name:'Boost Miner',
  email,
  balance:0,
  totalMined:0,
  tasksCompleted:0,
  completedTasks:{},
  miningActive:true,
  miningStartedAt:anchor,
  miningLastUpdate:anchor,
  sessionEarned:0,
  lastDailyReward:0,
  dailyRewardStreak:0,
  createdAt:new Date(anchor - HOUR)
});

try {
  const anchor = Date.now();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/boost-miner'), profile('boost-miner', 'boost@example.com', anchor));
    await setDoc(doc(db, 'users/boost-unverified'), profile('boost-unverified', 'boost2@example.com', anchor));
  });

  await assertSucceeds(updateDoc(verifiedRef, {miningStartedAt: anchor - BOOST}));
  let snap = await getDoc(verifiedRef);
  assert.equal(Number(snap.data().miningStartedAt), anchor - BOOST);
  assert.equal(Number(snap.data().miningLastUpdate), anchor);
  assert.equal(Number(snap.data().balance), 0);
  assert.equal(Number(snap.data().totalMined), 0);
  console.log('PASS one verified rewarded boost shifts only miningStartedAt by exactly 2h');

  // From the current -2h state, a -1h step or a -4h jump must fail.
  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - 3 * HOUR}));
  console.log('PASS arbitrary 1h mining-time reduction denied');

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - 6 * HOUR}));
  console.log('PASS client cannot skip directly across two boost charges');

  await assertFails(updateDoc(verifiedRef, {
    miningStartedAt: anchor - 4 * HOUR,
    balance: 24
  }));
  console.log('PASS mining boost cannot smuggle a balance mint');

  // Apply the remaining five valid 2h steps. After six charges total the
  // current session must be anchored exactly 12h earlier than its immutable
  // miningLastUpdate timestamp.
  for (let use = 2; use <= 6; use += 1) {
    await assertSucceeds(updateDoc(verifiedRef, {miningStartedAt: anchor - use * BOOST}));
  }

  snap = await getDoc(verifiedRef);
  assert.equal(Number(snap.data().miningLastUpdate) - Number(snap.data().miningStartedAt), MAX);
  assert.equal(Number(snap.data().balance), 0);
  assert.equal(Number(snap.data().totalMined), 0);
  console.log('PASS six sequential charges produce exactly the 12h session cap and no direct NVX');

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - 14 * HOUR}));
  console.log('PASS seventh charge / 14h reduction denied');

  await assertFails(updateDoc(verifiedRef, {
    miningStartedAt: anchor - 14 * HOUR,
    miningLastUpdate: anchor - BOOST
  }));
  console.log('PASS client cannot move the immutable session anchor to bypass the 12h cap');

  await assertFails(updateDoc(unverifiedRef, {miningStartedAt: anchor - BOOST}));
  console.log('PASS unverified account cannot use value-bearing mining boost');

  // A session already old enough to finish must be claimed instead of
  // consuming another rewarded ad / moving the timestamp farther back.
  const expiredAnchor = Date.now() - 24 * HOUR - 5000;
  await env.withSecurityRulesDisabled(async ctx => {
    await updateDoc(doc(ctx.firestore(), 'users/boost-miner'), {
      miningActive:true,
      miningStartedAt:expiredAnchor,
      miningLastUpdate:expiredAnchor,
      balance:0,
      totalMined:0
    });
  });
  await assertFails(updateDoc(verifiedRef, {miningStartedAt: expiredAnchor - BOOST}));
  console.log('PASS already-complete mining session cannot be boosted');

  console.log('\nMining boost Firestore rules smoke complete: exact 2h steps, 12h cap, value isolation and verification gates passed.');
} finally {
  await env.cleanup();
}
