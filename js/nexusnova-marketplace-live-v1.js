/* NexusNova Marketplace Live v1
   Authenticated Firestore marketplace: real listings, seller ownership, favorites and buy requests.
   No fake payment confirmations are created. */
(() => {
  'use strict';
  if (window.__nxMarketplaceLiveV1) return;
  window.__nxMarketplaceLiveV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const favoriteKey = uid => `nexusnova_market_favorites:${uid || 'guest'}`;
  let api = null;

  function out() {
    let el = $('nxMarketplaceLiveOut');
    const tab = $('tab-mega-marketplace');
    if (!tab) return null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxMarketplaceLiveOut';
      el.className = 'card';
      el.style.marginTop = '12px';
      tab.appendChild(el);
    }
    return el;
  }

  function status(message, danger = false) {
    const el = out();
    if (!el) return;
    el.innerHTML = `<div class="nxmega-muted" style="${danger ? 'color:#f87171' : ''}">${esc(message)}</div>`;
  }

  async function firebase() {
    if (api) return api;
    const [{getApps}, authLib, dbLib] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
    const apps = getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const auth = authLib.getAuth(apps[0]);
    const db = dbLib.getFirestore(apps[0]);
    api = {auth, db, ...dbLib};
    return api;
  }

  async function userRequired() {
    const f = await firebase();
    const user = f.auth.currentUser;
    if (!user) throw new Error('Sign in first to use Marketplace.');
    return {f,user};
  }

  function favorites(uid) {
    try {
      const value = JSON.parse(localStorage.getItem(favoriteKey(uid)) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function saveFavorites(uid, list) {
    localStorage.setItem(favoriteKey(uid), JSON.stringify([...new Set(list)].slice(0,200)));
  }

  function money(value, currency) {
    const n = Number(value);
    return `${currency || 'PKR'} ${Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : '0'}`;
  }

  async function recentListings() {
    const {f} = await userRequired();
    const q = f.query(f.collection(f.db,'marketplaceListings'), f.orderBy('createdAt','desc'), f.limit(60));
    const snap = await f.getDocs(q);
    return snap.docs.map(doc => ({id:doc.id,...doc.data()}));
  }

  function renderListings(rows, mode = 'browse') {
    const el = out();
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div class="nxmega-muted">No marketplace listings found yet.</div>';
      return;
    }
    const uid = api?.auth?.currentUser?.uid || '';
    const fav = new Set(favorites(uid));
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${mode === 'mine' ? 'My Listings' : mode === 'favorites' ? 'Favorites' : 'Marketplace Listings'}</b><span class="nxmega-muted">${rows.length} item(s)</span></div>` + rows.map(row => {
      const mine = row.sellerUid === uid;
      const active = String(row.status || 'active') === 'active';
      return `<div class="nxmega-item" style="margin-top:10px" data-market-id="${esc(row.id)}">
        <div style="min-width:0;flex:1"><b>${esc(row.title)}</b><small>${esc(row.category || 'Other')} · ${money(row.price,row.currency)} · Seller: ${esc(row.sellerName || 'NexusNova user')}</small><div style="font-size:12px;color:#cbd5e1;margin-top:5px">${esc(row.description || '')}</div><div class="nxmega-muted" style="margin-top:4px">Status: ${esc(row.status || 'active')}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button type="button" class="action-btn" data-market-fav="${esc(row.id)}">${fav.has(row.id) ? '★ Saved' : '☆ Favorite'}</button>
          ${!mine && active ? `<button type="button" class="action-btn primary" data-market-buy="${esc(row.id)}">Request to Buy</button>` : ''}
          ${mine ? `<button type="button" class="action-btn" data-market-toggle="${esc(row.id)}">${active ? 'Mark Sold' : 'Set Active'}</button>` : ''}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-market-fav]').forEach(button => button.addEventListener('click', () => toggleFavorite(button.dataset.marketFav)));
    el.querySelectorAll('[data-market-buy]').forEach(button => button.addEventListener('click', () => requestBuy(button.dataset.marketBuy, rows)));
    el.querySelectorAll('[data-market-toggle]').forEach(button => button.addEventListener('click', () => toggleListing(button.dataset.marketToggle, rows)));
  }

  async function browse() {
    status('Loading real Marketplace listings…');
    try {
      const rows = (await recentListings()).filter(row => String(row.status || 'active') === 'active');
      renderListings(rows,'browse');
    } catch (error) {
      console.error('Marketplace browse:', error);
      status(error?.code === 'permission-denied' ? 'Marketplace Firestore rules are not deployed yet.' : (error?.message || 'Marketplace unavailable.'), true);
    }
  }

  async function myListings() {
    status('Loading your listings…');
    try {
      const {f,user} = await userRequired();
      const snap = await f.getDocs(f.query(f.collection(f.db,'marketplaceListings'), f.where('sellerUid','==',user.uid), f.limit(60)));
      renderListings(snap.docs.map(doc => ({id:doc.id,...doc.data()})),'mine');
    } catch (error) {
      status(error?.code === 'permission-denied' ? 'Marketplace Firestore rules are not deployed yet.' : (error?.message || 'Could not load your listings.'), true);
    }
  }

  async function showFavorites() {
    status('Loading favorites…');
    try {
      const {user} = await userRequired();
      const ids = new Set(favorites(user.uid));
      const rows = (await recentListings()).filter(row => ids.has(row.id));
      renderListings(rows,'favorites');
    } catch (error) { status(error?.message || 'Could not load favorites.', true); }
  }

  async function dashboard() {
    status('Building seller dashboard…');
    try {
      const {f,user} = await userRequired();
      const listings = await f.getDocs(f.query(f.collection(f.db,'marketplaceListings'), f.where('sellerUid','==',user.uid), f.limit(100)));
      const orders = await f.getDocs(f.query(f.collection(f.db,'marketplaceOrders'), f.where('sellerUid','==',user.uid), f.limit(100)));
      const rows = listings.docs.map(d => d.data());
      const orderRows = orders.docs.map(d => d.data());
      const el = out();
      el.innerHTML = `<b>Seller Dashboard</b><div class="nxmega-grid" style="margin-top:10px"><div class="tool-result">Listings<br><b>${rows.length}</b></div><div class="tool-result">Active<br><b>${rows.filter(x=>x.status==='active').length}</b></div><div class="tool-result">Buy Requests<br><b>${orderRows.length}</b></div><div class="tool-result">Open Requests<br><b>${orderRows.filter(x=>!['delivered','cancelled'].includes(x.status)).length}</b></div></div>`;
    } catch (error) { status(error?.message || 'Seller dashboard unavailable.', true); }
  }

  async function postItem() {
    try {
      const {f,user} = await userRequired();
      const title = (prompt('Item title:') || '').trim();
      if (title.length < 2 || title.length > 120) return;
      const category = (prompt('Category (example: Electronics, Books, Home):','Other') || 'Other').trim().slice(0,60);
      const rawPrice = prompt('Price:');
      if (rawPrice === null) return;
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price < 0 || price > 1000000000) return alert('Enter a valid price.');
      const currency = (prompt('Currency: PKR, USD, EUR or GBP','PKR') || 'PKR').trim().toUpperCase();
      if (!['PKR','USD','EUR','GBP'].includes(currency)) return alert('Unsupported currency.');
      const description = (prompt('Short description:') || '').trim().slice(0,1200);
      const sellerName = String(user.displayName || user.email?.split('@')[0] || 'NexusNova user').slice(0,80);
      await f.addDoc(f.collection(f.db,'marketplaceListings'), {
        sellerUid:user.uid, sellerName, title, category, description, price, currency,
        status:'active', createdAt:f.serverTimestamp(), updatedAt:f.serverTimestamp()
      });
      alert('Listing posted to NexusNova Marketplace.');
      myListings();
    } catch (error) {
      console.error('Marketplace post:', error);
      alert(error?.code === 'permission-denied' ? 'Marketplace Firestore rules are not deployed yet.' : (error?.message || 'Could not post listing.'));
    }
  }

  async function toggleFavorite(id) {
    try {
      const {user} = await userRequired();
      const list = favorites(user.uid);
      const next = list.includes(id) ? list.filter(x => x !== id) : [id,...list];
      saveFavorites(user.uid,next);
      showFavorites();
    } catch (error) { alert(error?.message || 'Could not update favorite.'); }
  }

  async function requestBuy(id, rows) {
    const listing = rows.find(row => row.id === id);
    if (!listing) return;
    try {
      const {f,user} = await userRequired();
      if (listing.sellerUid === user.uid) return alert('You cannot buy your own listing.');
      if (!confirm(`Send a real buy request for ${listing.title} at ${money(listing.price,listing.currency)}? No payment will be charged yet.`)) return;
      await f.addDoc(f.collection(f.db,'marketplaceOrders'), {
        listingId:id,
        buyerUid:user.uid,
        sellerUid:listing.sellerUid,
        title:String(listing.title || '').slice(0,120),
        amount:Number(listing.price) || 0,
        currency:String(listing.currency || 'PKR'),
        status:'requested',
        createdAt:f.serverTimestamp(),
        updatedAt:f.serverTimestamp()
      });
      alert('Buy request sent. No payment has been charged.');
    } catch (error) {
      alert(error?.code === 'permission-denied' ? 'Marketplace order rules are not deployed yet.' : (error?.message || 'Could not send buy request.'));
    }
  }

  async function toggleListing(id, rows) {
    const row = rows.find(item => item.id === id);
    if (!row) return;
    try {
      const {f,user} = await userRequired();
      if (row.sellerUid !== user.uid) return;
      const next = row.status === 'active' ? 'sold' : 'active';
      await f.updateDoc(f.doc(f.db,'marketplaceListings',id), {status:next, updatedAt:f.serverTimestamp()});
      myListings();
    } catch (error) { alert(error?.message || 'Could not update listing.'); }
  }

  function findButton(label) {
    return Array.from(document.querySelectorAll('#tab-mega-marketplace button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === label.toLowerCase()
    );
  }
  function claim(label,id,handler) {
    const button = findButton(label);
    if (!button || button.dataset.nxMarketplaceReady === '1') return;
    button.dataset.nxMarketplaceReady = '1';
    button.id = id;
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); handler(); });
  }

  function install() {
    if (!$('tab-mega-marketplace')) return;
    claim('Browse Categories','nxMarketBrowse',browse);
    claim('My Listings','nxMarketMine',myListings);
    claim('Favorites','nxMarketFavs',showFavorites);
    claim('Seller Dashboard','nxMarketSeller',dashboard);
    claim('Post New Item','nxMarketPost',postItem);
    claim('Buy / Sell','nxMarketBuySell',browse);
  }

  window.nexusMarketplaceBrowse = browse;
  const boot = () => { install(); [900,1800,3500,7000].forEach(ms => setTimeout(install,ms)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();