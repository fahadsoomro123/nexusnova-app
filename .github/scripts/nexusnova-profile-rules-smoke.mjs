import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-rules';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});

const owner=env.authenticatedContext('profile-owner',{email:'profile@example.com',email_verified:false}).firestore();
const stranger=env.authenticatedContext('profile-stranger',{email:'stranger@example.com',email_verified:true}).firestore();
const ref=doc(owner,'users/profile-owner');

const baseProfile={
  uid:'profile-owner',name:'Miner User',email:'profile@example.com',
  balance:63,totalMined:48,tasksCompleted:2,completedTasks:{taskA:true},
  miningActive:false,miningStartedAt:0,miningLastUpdate:0,sessionEarned:0,
  lastDailyReward:0,dailyRewardStreak:1,createdAt:new Date()
};

const jpeg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';

try {
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'users/profile-owner'),baseProfile);
  });

  await assertSucceeds(updateDoc(ref,{
    name:'Fahad User',
    photoDataUrl:jpeg,
    bio:'Teacher and NexusNova community member.',
    city:'Shikarpur',
    country:'Pakistan',
    profileUpdatedAt:serverTimestamp()
  }));
  console.log('PASS owner can save privacy-safe complete profile fields');

  const after=await getDoc(ref);
  if(after.data().balance!==63 || after.data().totalMined!==48){
    throw new Error('Profile edit changed value-bearing fields.');
  }
  console.log('PASS profile edit preserves balance and mining totals');

  await assertFails(updateDoc(ref,{
    name:'Fahad User',
    bio:'Trying to mint balance',
    city:'Shikarpur',
    country:'Pakistan',
    photoDataUrl:jpeg,
    profileUpdatedAt:serverTimestamp(),
    balance:999999
  }));
  console.log('PASS profile editor cannot change NVX balance');

  await assertFails(updateDoc(ref,{email:'attacker@example.com'}));
  console.log('PASS profile editor cannot change account email');

  await assertFails(updateDoc(doc(stranger,'users/profile-owner'),{
    name:'Hijacked',
    photoDataUrl:'',
    bio:'',city:'',country:'',profileUpdatedAt:serverTimestamp()
  }));
  console.log('PASS another user cannot edit the owner profile');

  await assertFails(updateDoc(ref,{
    name:'Fahad User',
    photoDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    bio:'',city:'',country:'',profileUpdatedAt:serverTimestamp()
  }));
  console.log('PASS non-JPEG profile data URI rejected');

  const oversized='data:image/jpeg;base64,'+'A'.repeat(180001);
  await assertFails(updateDoc(ref,{
    name:'Fahad User',photoDataUrl:oversized,bio:'',city:'',country:'',profileUpdatedAt:serverTimestamp()
  }));
  console.log('PASS oversized profile image rejected');

  await assertSucceeds(updateDoc(ref,{
    name:'Fahad User',photoDataUrl:'',bio:'',city:'',country:'',profileUpdatedAt:serverTimestamp()
  }));
  console.log('PASS owner can remove optional profile details/photo safely');

  console.log('\nComplete Profile Firestore security smoke passed.');
} finally {
  await env.cleanup();
}
