import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const LISTINGS = 'marketplaceListings';
const ORDERS = 'marketplaceOrders';
const CURRENCIES = Object.freeze(['PKR','USD','EUR','GBP']);
const CATEGORIES = Object.freeze(['Electronics','Books','Education','Home','Fashion','Services','Other']);

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function timeMs(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value?.seconds) return Number(value.seconds) * 1000;
  return Number(value) || 0;
}

function money(value, currency = 'PKR') {
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined,{maximumFractionDigits:2}) : '0'}`;
}

function favoriteKey(uid) {
  return `nexusnova_market_favorites:${uid || 'guest'}`;
}

function readFavorites(uid) {
  const rows = loadJson(favoriteKey(uid), []);
  return Array.isArray(rows) ? rows.filter(id => typeof id === 'string').slice(0,200) : [];
}

function writeFavorites(uid, ids) {
  saveJson(favoriteKey(uid), [...new Set(ids)].slice(0,200));
}

function errorMessage(error, fallback) {
  if (error?.code === 'permission-denied') return 'Marketplace/Orders Firestore permission was denied. Check deployed rules and email verification.';
  if (error?.code === 'failed-precondition') return 'Firestore needs the required index before this query can run.';
  return String(error?.message || fallback || 'Marketplace action failed.').replace(/^FirebaseError:\s*/i,'').slice(0,260);
}

async function signedUser({ write = false } = {}) {
  return requireFirebaseUser(write ? { verified:true } : {});
}

async function displayName(user) {
  const profile = await readUserProfile(user).catch(() => ({}));
  return String(profile?.name || user.displayName || user.email?.split('@')[0] || 'NexusNova user').trim().slice(0,80) || 'NexusNova user';
}

async function recentListings() {
  await signedUser();
  const snap = await getDocs(query(collection(firestoreDb,LISTINGS), orderBy('createdAt','desc'), limit(60)));
  return snap.docs.map(item => ({ id:item.id, ...item.data() }));
}

export function renderMarketplaceSuite() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-market-mode="browse">BROWSE</button>
        <button type="button" data-market-mode="mine">MY LISTINGS</button>
        <button type="button" data-market-mode="favorites">FAVORITES</button>
      </div>
      <button type="button" data-market-dashboard>SELLER DASHBOARD</button>
      <p class="nx-tool-meta" data-market-status>Real Firestore buyer/seller records. NexusNova does not create fake payment or delivery confirmations.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Post an Item</strong>
      <label class="nx-field"><span>Item title</span><input maxlength="120" data-listing-title placeholder="Grade 5 Science Books"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Category</span><select data-listing-category>${CATEGORIES.map(value=>`<option>${value}</option>`).join('')}</select></label>
        <label class="nx-field"><span>Currency</span><select data-listing-currency>${CURRENCIES.map(value=>`<option>${value}</option>`).join('')}</select></label>
      </div>
      <label class="nx-field"><span>Price</span><input type="number" min="0" max="1000000000" step="0.01" inputmode="decimal" data-listing-price placeholder="0"></label>
      <label class="nx-field"><span>Description</span><textarea rows="4" maxlength="1200" data-listing-description placeholder="Condition and important details"></textarea></label>
      <button class="nx-primary" type="button" data-listing-post>POST REAL LISTING</button>
      <p class="nx-tool-meta">Posting or changing a listing requires a verified email, matching the deployed Firestore security contract.</p>
    </section>

    <section class="nx-stack" data-market-output><div class="nx-empty">Loading Marketplace…</div></section>
  `);

  const status = root.querySelector('[data-market-status]');
  const output = root.querySelector('[data-market-output]');
  const title = root.querySelector('[data-listing-title]');
  const category = root.querySelector('[data-listing-category]');
  const currency = root.querySelector('[data-listing-currency]');
  const price = root.querySelector('[data-listing-price]');
  const description = root.querySelector('[data-listing-description]');
  const postButton = root.querySelector('[data-listing-post]');
  let activeMode = 'browse';
  let busy = false;

  const drawListings = async (rows, mode) => {
    const user = await signedUser();
    const fav = new Set(readFavorites(user.uid));
    const visible = mode === 'browse' ? rows.filter(row => String(row.status || 'active') === 'active') : rows;
    if (!visible.length) {
      output.innerHTML = `<div class="nx-empty">${mode === 'favorites' ? 'No Marketplace favorites.' : mode === 'mine' ? 'You have no listings yet.' : 'No active Marketplace listings yet.'}</div>`;
      return;
    }
    output.innerHTML = visible.map(row => {
      const mine = row.sellerUid === user.uid;
      const active = String(row.status || 'active') === 'active';
      return `<article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(row.title || 'Marketplace item')}</strong><span>${escapeHtml(money(row.price,row.currency))}</span></div>
        <p>${escapeHtml(row.category || 'Other')} • Seller: ${escapeHtml(row.sellerName || 'NexusNova user')}<br>${escapeHtml(row.description || '')}</p>
        <small>Status: ${escapeHtml(row.status || 'active')}</small>
        <div class="nx-action-row" style="margin-top:9px">
          <button type="button" data-market-fav="${escapeHtml(row.id)}">${fav.has(row.id) ? '★ SAVED' : '☆ FAVORITE'}</button>
          ${!mine && active ? `<button class="nx-primary" type="button" data-market-buy="${escapeHtml(row.id)}">REQUEST TO BUY</button>` : ''}
          ${mine ? `<button type="button" data-market-toggle="${escapeHtml(row.id)}" data-market-next="${active ? 'sold' : 'active'}">${active ? 'MARK SOLD' : 'SET ACTIVE'}</button>` : ''}
        </div>
      </article>`;
    }).join('');

    output.querySelectorAll('[data-market-fav]').forEach(button => button.addEventListener('click', async () => {
      const user = await signedUser();
      const ids = readFavorites(user.uid);
      const next = ids.includes(button.dataset.marketFav) ? ids.filter(id=>id!==button.dataset.marketFav) : [button.dataset.marketFav,...ids];
      writeFavorites(user.uid,next);
      status.textContent = next.includes(button.dataset.marketFav) ? 'Saved to Marketplace favorites.' : 'Removed from favorites.';
      await refresh(activeMode);
    }));

    output.querySelectorAll('[data-market-buy]').forEach(button => button.addEventListener('click', async () => {
      const listing = rows.find(row => row.id === button.dataset.marketBuy);
      if (!listing || busy) return;
      busy = true;
      button.disabled = true;
      try {
        const user = await signedUser({write:true});
        if (listing.sellerUid === user.uid) throw new Error('You cannot buy your own listing.');
        if (String(listing.status) !== 'active') throw new Error('This listing is no longer active.');
        await addDoc(collection(firestoreDb,ORDERS), {
          listingId:listing.id,
          buyerUid:user.uid,
          sellerUid:String(listing.sellerUid || ''),
          title:String(listing.title || '').slice(0,120),
          amount:Number(listing.price) || 0,
          currency:CURRENCIES.includes(listing.currency) ? listing.currency : 'PKR',
          status:'requested',
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp()
        });
        status.textContent = 'Real buy request sent to the seller. No payment was charged.';
      } catch (error) {
        status.textContent = errorMessage(error,'Could not send buy request.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    }));

    output.querySelectorAll('[data-market-toggle]').forEach(button => button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        await signedUser({write:true});
        await updateDoc(doc(firestoreDb,LISTINGS,button.dataset.marketToggle), {
          status:button.dataset.marketNext,
          updatedAt:serverTimestamp()
        });
        status.textContent = `Listing set to ${button.dataset.marketNext}.`;
        await refresh('mine');
      } catch (error) {
        status.textContent = errorMessage(error,'Could not update listing.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    }));
  };

  const refresh = async (mode = activeMode) => {
    activeMode = mode;
    status.textContent = 'Loading real Marketplace records…';
    output.innerHTML = '<div class="nx-empty">Loading…</div>';
    try {
      const user = await signedUser();
      if (mode === 'mine') {
        const snap = await getDocs(query(collection(firestoreDb,LISTINGS), where('sellerUid','==',user.uid), limit(60)));
        await drawListings(snap.docs.map(item=>({id:item.id,...item.data()})).sort((a,b)=>timeMs(b.createdAt)-timeMs(a.createdAt)),'mine');
      } else {
        const rows = await recentListings();
        if (mode === 'favorites') {
          const ids = new Set(readFavorites(user.uid));
          await drawListings(rows.filter(row=>ids.has(row.id)),'favorites');
        } else {
          await drawListings(rows,'browse');
        }
      }
      status.textContent = 'Marketplace synced from Firestore.';
    } catch (error) {
      output.innerHTML = '<div class="nx-empty">Marketplace records are unavailable right now.</div>';
      status.textContent = errorMessage(error,'Marketplace unavailable.');
    }
  };

  root.querySelectorAll('[data-market-mode]').forEach(button => button.addEventListener('click',()=>refresh(button.dataset.marketMode)));

  root.querySelector('[data-market-dashboard]').addEventListener('click', async () => {
    status.textContent = 'Building seller dashboard…';
    try {
      const user = await signedUser();
      const [listingSnap,orderSnap] = await Promise.all([
        getDocs(query(collection(firestoreDb,LISTINGS), where('sellerUid','==',user.uid), limit(100))),
        getDocs(query(collection(firestoreDb,ORDERS), where('sellerUid','==',user.uid), limit(100)))
      ]);
      const listings = listingSnap.docs.map(item=>item.data());
      const orders = orderSnap.docs.map(item=>item.data());
      output.innerHTML = `<section class="nx-summary-grid">
        <div><span>Listings</span><strong>${listings.length}</strong></div>
        <div><span>Active</span><strong>${listings.filter(row=>row.status==='active').length}</strong></div>
        <div><span>Buy Requests</span><strong>${orders.length}</strong></div>
        <div><span>Open Requests</span><strong>${orders.filter(row=>!['delivered','cancelled'].includes(row.status)).length}</strong></div>
      </section>`;
      status.textContent = 'Seller dashboard uses your real Firestore records.';
    } catch (error) {
      status.textContent = errorMessage(error,'Seller dashboard unavailable.');
    }
  });

  postButton.addEventListener('click', async () => {
    if (busy) return;
    const cleanTitle = title.value.trim();
    const cleanDescription = description.value.trim().slice(0,1200);
    const amount = Number(price.value);
    if (cleanTitle.length < 2 || cleanTitle.length > 120) { status.textContent = 'Item title must be 2–120 characters.'; return; }
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) { status.textContent = 'Enter a valid price.'; return; }
    if (!CURRENCIES.includes(currency.value)) { status.textContent = 'Choose a supported currency.'; return; }
    busy = true;
    postButton.disabled = true;
    postButton.textContent = 'POSTING…';
    try {
      const user = await signedUser({write:true});
      const sellerName = await displayName(user);
      await addDoc(collection(firestoreDb,LISTINGS), {
        sellerUid:user.uid,
        sellerName,
        title:cleanTitle,
        description:cleanDescription,
        category:CATEGORIES.includes(category.value) ? category.value : 'Other',
        price:amount,
        currency:currency.value,
        status:'active',
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      title.value = '';
      price.value = '';
      description.value = '';
      status.textContent = 'Real Marketplace listing posted.';
      await refresh('mine');
    } catch (error) {
      status.textContent = errorMessage(error,'Could not post listing.');
    } finally {
      busy = false;
      postButton.disabled = false;
      postButton.textContent = 'POST REAL LISTING';
    }
  });

  refresh('browse');
  return root;
}

function orderLabel(value) {
  return String(value || 'requested').replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());
}

function nextSellerStatus(status) {
  return ({requested:'accepted',accepted:'processing',processing:'shipped',shipped:'out_for_delivery',out_for_delivery:'delivered'})[status] || '';
}

async function loadOrders() {
  const user = await signedUser();
  const ref = collection(firestoreDb,ORDERS);
  const [buyerSnap,sellerSnap] = await Promise.all([
    getDocs(query(ref,where('buyerUid','==',user.uid),limit(100))),
    getDocs(query(ref,where('sellerUid','==',user.uid),limit(100)))
  ]);
  const map = new Map();
  [...buyerSnap.docs,...sellerSnap.docs].forEach(item=>map.set(item.id,{id:item.id,...item.data()}));
  return [...map.values()].sort((a,b)=>timeMs(b.createdAt)-timeMs(a.createdAt));
}

export function renderOrdersSuite() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-order-filter="all">ALL</button>
        <button type="button" data-order-filter="processing">PROCESSING</button>
        <button type="button" data-order-filter="shipped">SHIPPED</button>
      </div>
      <div class="nx-action-row">
        <button type="button" data-order-filter="out_for_delivery">OUT FOR DELIVERY</button>
        <button type="button" data-order-filter="delivered">DELIVERED</button>
        <button type="button" data-order-filter="return">RETURN / REFUND</button>
      </div>
      <p class="nx-tool-meta" data-order-status>Loading real buyer/seller order records…</p>
    </section>
    <section class="nx-stack" data-order-output><div class="nx-empty">Loading…</div></section>
  `);

  const status = root.querySelector('[data-order-status]');
  const output = root.querySelector('[data-order-output]');
  let rows = [];
  let activeFilter = 'all';
  let busy = false;

  const filtered = filter => {
    if (filter === 'processing') return rows.filter(row=>['accepted','processing'].includes(row.status));
    if (filter === 'return') return rows.filter(row=>['return_requested','cancelled'].includes(row.status));
    if (filter === 'all') return rows;
    return rows.filter(row=>row.status===filter);
  };

  const draw = async () => {
    const user = await signedUser();
    const visible = filtered(activeFilter);
    if (!visible.length) {
      output.innerHTML = '<div class="nx-empty">No matching real order records.</div>';
      return;
    }
    output.innerHTML = visible.map(row => {
      const seller = row.sellerUid === user.uid;
      const buyer = row.buyerUid === user.uid;
      const next = seller ? nextSellerStatus(row.status) : '';
      const canSellerCancel = seller && ['requested','accepted','processing'].includes(row.status);
      const canBuyerCancel = buyer && ['requested','accepted'].includes(row.status);
      const canReturn = buyer && row.status === 'delivered';
      const when = timeMs(row.createdAt) ? new Date(timeMs(row.createdAt)).toLocaleString() : 'syncing';
      return `<article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(row.title || 'Marketplace item')}</strong><span>${escapeHtml(money(row.amount,row.currency))}</span></div>
        <p>${seller ? 'You are seller' : 'You are buyer'} • ${escapeHtml(when)}<br>Status: <b>${escapeHtml(orderLabel(row.status))}</b></p>
        <div class="nx-action-row">
          ${next ? `<button class="nx-primary" type="button" data-order-next="${escapeHtml(row.id)}" data-next="${escapeHtml(next)}">SET ${escapeHtml(orderLabel(next).toUpperCase())}</button>` : ''}
          ${canSellerCancel || canBuyerCancel ? `<button type="button" data-order-next="${escapeHtml(row.id)}" data-next="cancelled">CANCEL</button>` : ''}
          ${canReturn ? `<button type="button" data-order-next="${escapeHtml(row.id)}" data-next="return_requested">REQUEST RETURN</button>` : ''}
        </div>
      </article>`;
    }).join('');

    output.querySelectorAll('[data-order-next]').forEach(button => button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      const next = button.dataset.next;
      try {
        await signedUser({write:true});
        await updateDoc(doc(firestoreDb,ORDERS,button.dataset.orderNext), { status:next, updatedAt:serverTimestamp() });
        status.textContent = `Order updated to ${orderLabel(next)}. This is a NexusNova buyer/seller workflow state, not courier/payment proof.`;
        await refresh(activeFilter);
      } catch (error) {
        status.textContent = errorMessage(error,'Could not update order.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    }));
  };

  const refresh = async (filter = activeFilter) => {
    activeFilter = filter;
    status.textContent = 'Loading real buyer/seller order records…';
    try {
      rows = await loadOrders();
      await draw();
      status.textContent = `${rows.length} real Marketplace order record${rows.length===1?'':'s'} loaded. Payment settlement and courier tracking are not claimed.`;
    } catch (error) {
      rows = [];
      output.innerHTML = '<div class="nx-empty">Orders are unavailable right now.</div>';
      status.textContent = errorMessage(error,'Orders unavailable.');
    }
  };

  root.querySelectorAll('[data-order-filter]').forEach(button => button.addEventListener('click',()=>refresh(button.dataset.orderFilter)));
  refresh('all');
  return root;
}

export const marketplaceSuiteRenderers = Object.freeze({
  marketplace:renderMarketplaceSuite,
  orders:renderOrdersSuite
});
