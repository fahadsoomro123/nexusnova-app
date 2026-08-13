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
const anon=env.unauthenticatedContext().firestore();

const listingRef=doc(seller,'marketplaceListings/listing-1');
const validListing={
  sellerUid:'seller-1',sellerName:'Seller',title:'Runtime Bicycle',description:'Good condition',
  category:'Vehicles & Parts',price:25000,currency:'PKR',status:'active',
  createdAt:serverTimestamp(),updatedAt:serverTimestamp()
};

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

  console.log('\nFirestore rules smoke complete: security cases passed.');
} finally {
  await env.cleanup();
}
