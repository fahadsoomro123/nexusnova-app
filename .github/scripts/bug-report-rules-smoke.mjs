import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs/promises';

const projectId='demo-nexusnova-bug-report-rules';
const rules=await fs.readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules}});
const alice=env.authenticatedContext('alice',{email:'alice@example.com',email_verified:false}).firestore();
const bob=env.authenticatedContext('bob',{email:'bob@example.com',email_verified:true}).firestore();
const anon=env.unauthenticatedContext().firestore();

const valid={
  category:'wallet',severity:'medium',
  description:'Wallet refresh stays on loading after I press the refresh button.',
  feature:'wallet',diagnosticsIncluded:true,
  diagnostics:'feature=wallet | browser=Chrome | device=desktop | viewport=large | online=yes',
  moduleVersion:'bug-report-v1',status:'new',createdAt:serverTimestamp()
};

try{
  const ref=doc(alice,'bugReports/alice/items/report-1');
  await assertSucceeds(setDoc(ref,valid));
  console.log('PASS signed-in user can create a bounded bug report under own UID');

  await assertFails(setDoc(doc(bob,'bugReports/alice/items/report-2'),valid));
  await assertFails(setDoc(doc(anon,'bugReports/anon/items/report-3'),valid));
  console.log('PASS another user and anonymous client cannot submit under someone else path');

  await assertFails(setDoc(doc(alice,'bugReports/alice/items/report-private'),{
    ...valid,email:'alice@example.com'
  }));
  console.log('PASS arbitrary/private extra fields are denied');

  await assertFails(setDoc(doc(alice,'bugReports/alice/items/report-long'),{
    ...valid,diagnostics:'x'.repeat(1201)
  }));
  console.log('PASS oversized diagnostics are denied');

  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref,{status:'closed'}));
  await assertFails(deleteDoc(ref));
  console.log('PASS app clients cannot read, mutate or delete submitted bug reports');
}finally{
  await env.cleanup();
}
