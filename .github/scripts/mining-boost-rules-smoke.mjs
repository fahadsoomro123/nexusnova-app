import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId = 'demo-nexusnova-rules';
const rules = await fs.readFile('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({projectId, firestore:{rules}});

const HOUR = 60 * 60 * 1000;
const BOOST = 2 * HOUR;

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

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - BOOST}));
  console.log('PASS verified client cannot apply a 2h mining boost directly');

  await assertFails(updateDoc(verifiedRef, {miningStartedAt: anchor - 6 * HOUR}));
  console.log('PASS verified client cannot jump mining timestamps by multiple boost slots');

  await assertFails(updateDoc(verifiedRef, {
    miningStartedAt: anchor - BOOST,
    balance: 24
  }));
  console.log('PASS blocked boost path cannot smuggle a balance change');

  await assertFails(updateDoc(unverifiedRef, {miningStartedAt: anchor - BOOST}));
  console.log('PASS unverified client cannot apply a mining boost either');

  const snap = await getDoc(verifiedRef);
  assert.equal(Number(snap.data().miningStartedAt), anchor);
  assert.equal(Number(snap.data().miningLastUpdate), anchor);
  assert.equal(Number(snap.data().balance), 0);
  assert.equal(Number(snap.data().totalMined), 0);
  console.log('PASS rejected boost attempts leave the mining session and NVX unchanged');

  console.log('\nMining boost Firestore rules smoke complete: all direct client boost/value mutations denied.');
} finally {
  await env.cleanup();
}
