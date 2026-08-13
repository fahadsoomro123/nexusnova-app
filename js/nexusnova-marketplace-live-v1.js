/* NexusNova Marketplace Live v2
   Authenticated Firestore marketplace: real listings, seller ownership, favorites and buy requests.
   No fake payment confirmations are created. Premium NexusNova forms replace browser prompts. */
(() => {
  'use strict';
  if (window.__nxMarketplaceLiveV2) return;
  window.__nxMarketplaceLiveV2 = true;
  window.__nxMarketplaceLiveV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const favoriteKey = uid => `nexusnova_market_favorites:${uid || 'guest'}`;
  let api = null;
  let uiPromise = null;

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1200);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function message(title,text,icon='spark',eyebrow='NEXUSNOVA MARKETPLACE') {
    try {
      const ui = await getUI();
      await ui.alert({eyebrow,title,text,icon,buttonText:'OK'});
    } catch (_) {
      window.alert(String(text || title || 'Marketplace'));
    }
  }

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

  function status(messageText, danger = false) {
    const el = out();
    if (!el) return;
    const ui = window.NexusNovaUI;
    if (ui) {
      el.innerHTML = ui.resultShell({
        title: danger ? 'Marketplace Needs Attention' : 'NexusNova Marketplace',
        subtitle: danger ? 'Could not complete this marketplace action' : 'Live buyer and seller records',
        icon: danger ? 'security' : 'spark',
        bodyHtml:`<div style="${danger ? 'color:#ff9aac' : 'color:#b9cee5'}">${esc(messageText)}</div>`
      });
    } else {
      el.innerHTML = `<div class="nxmega-muted" style="${danger ? 'color:#f87171' : ''}">${esc(messageText)}</div>`;
    }
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
    const ui = window.NexusNovaUI;
    if (!rows.length) {
      const body='<div style="color:#91a9c4">No marketplace listings found yet.</div>';
      el.innerHTML = ui ? ui.resultShell({title:'Marketplace Listings',subtitle:'No matching items',icon:'search',bodyHtml:body}) : body;
      return;
    }
    const uid = api?.auth?.currentUser?.uid || '';
    const fav = new Set(favorites(uid));
    const title = mode === 'mine' ? 'My Listings' : mode === 'favorites' ? 'Favorites' : 'Marketplace Listings';
    const cards = rows.map(row => {
      const mine = row.sellerUid === uid;
      const active = String(row.status || 'active') === 'active';
      return `<div style="margin-top:10px;padding:14px;border-radius:17px;background:linear-gradient(145deg,rgba(8,27,49,.92),rgba(5,18,34,.92));border:1px solid rgba(94,166,240,.16);box-shadow:0 10px 24px rgba(0,0,0,.14)" data-market-id="${esc(row.id)}">
        <div style="display:flex;gap:12px;align-items:flex-start"><div style="width:44px;height:44px;flex:0 0 44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#176eff,#49bfff);box-shadow:0 9px 20px rgba(25,126,255,.24)">${ui?.icon?.('spark') || '✦'}</div><div style="min-width:0;flex:1"><b style="font-size:14px">${esc(row.title)}</b><div style="font-size:11px;color:#84a1c0;margin-top:4px">${esc(row.category || 'Other')} • ${money(row.price,row.currency)} • Seller: ${esc(row.sellerName || 'NexusNova user')}</div><div style="font-size:12px;color:#cbd5e1;margin-top:7px;line-height:1.5">${esc(row.description || '')}</div><div style="font-size:10px;color:#6f8ba8;margin-top:6px">Status: ${esc(row.status || 'active')}</div></div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:11px">
          <button type="button" class="action-btn" data-market-fav="${esc(row.id)}">${fav.has(row.id) ? '★ Saved' : '☆ Favorite'}</button>
          ${!mine && active ? `<button type="button" class="action-btn primary" data-market-buy="${esc(row.id)}">Request to Buy</button>` : ''}
          ${mine ? `<button type="button" class="action-btn" data-market-toggle="${esc(row.id)}">${active ? 'Mark Sold' : 'Set Active'}</button>` : ''}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = ui ? ui.resultShell({title,subtitle:`${rows.length} real listing(s)`,icon:'spark',bodyHtml:cards,footer:'Marketplace records are live Firestore data when production rules are deployed.'}) : `<div style="display:flex;justify-content:space-between"><b>${esc(title)}</b><span>${rows.length} item(s)</span></div>${cards}`;

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
      const ui=await getUI().catch(()=>null);
      const body=`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="tool-result">Listings<br><b>${rows.length}</b></div><div class="tool-result">Active<br><b>${rows.filter(x=>x.status==='active').length}</b></div><div class="tool-result">Buy Requests<br><b>${orderRows.length}</b></div><div class="tool-result">Open Requests<br><b>${orderRows.filter(x=>!['delivered','cancelled'].includes(x.status)).length}</b></div></div>`;
      el.innerHTML=ui?ui.resultShell({title:'Seller Dashboard',subtitle:'Your real Marketplace activity',icon:'spark',bodyHtml:body}):`<b>Seller Dashboard</b>${body}`;
    } catch (error) { status(error?.message || 'Seller dashboard unavailable.', true); }
  }

  async function postItem() {
    try {
      const {f,user} = await userRequired();
      const ui = await getUI();
      const data = await ui.form({
        eyebrow:'NEXUSNOVA MARKETPLACE',
        title:'Post a Marketplace Item',
        subtitle:'Create a real listing with a clean visual form. No fake payment or delivery confirmation is created.',
        icon:'spark',
        submitText:'Post Item',
        fields:[
          {name:'title',label:'Item Title',icon:'subject',placeholder:'e.g. Grade 5 Science Books',required:true,wide:true},
          {name:'category',label:'Category',icon:'search',type:'select',value:'Other',options:['Electronics','Books','Education','Home','Fashion','Services','Other']},
          {name:'currency',label:'Currency',icon:'number',type:'select',value:'PKR',options:['PKR','USD','EUR','GBP']},
          {name:'price',label:'Price',icon:'number',type:'number',placeholder:'0',min:0,max:1000000000,step:'0.01',required:true,wide:true},
          {name:'description',label:'Short Description',icon:'worksheet',type:'textarea',placeholder:'Describe the item, condition and important details…',wide:true}
        ]
      });
      if (!data) return;
      const title = String(data.title || '').trim();
      const category = String(data.category || 'Other').trim().slice(0,60);
      const price = Number(data.price);
      const currency = String(data.currency || 'PKR').trim().toUpperCase();
      const description = String(data.description || '').trim().slice(0,1200);
      if (title.length < 2 || title.length > 120) return message('Check Item Title','Item title must be between 2 and 120 characters.','subject');
      if (!Number.isFinite(price) || price < 0 || price > 1000000000) return message('Check Price','Enter a valid price.','number');
      if (!['PKR','USD','EUR','GBP'].includes(currency)) return message('Unsupported Currency','Choose PKR, USD, EUR or GBP.','number');
      const sellerName = String(user.displayName || user.email?.split('@')[0] || 'NexusNova user').slice(0,80);
      await f.addDoc(f.collection(f.db,'marketplaceListings'), {
        sellerUid:user.uid, sellerName, title, category, description, price, currency,
        status:'active', createdAt:f.serverTimestamp(), updatedAt:f.serverTimestamp()
      });
      await message('Listing Posted',`${title} is now saved in the NexusNova Marketplace.`, 'spark');
      myListings();
    } catch (error) {
      console.error('Marketplace post:', error);
      await message('Could Not Post Listing',error?.code === 'permission-denied' ? 'Marketplace Firestore rules are not deployed yet.' : (error?.message || 'Could not post listing.'),'security');
    }
  }

  async function toggleFavorite(id) {
    try {
      const {user} = await userRequired();
      const list = favorites(user.uid);
      const next = list.includes(id) ? list.filter(x => x !== id) : [id,...list];
      saveFavorites(user.uid,next);
      window.NexusNovaUI?.toast(next.includes(id)?'Saved to Marketplace favorites.':'Removed from favorites.');
      showFavorites();
    } catch (error) { await message('Favorites',error?.message || 'Could not update favorite.','security'); }
  }

  async function requestBuy(id, rows) {
    const listing = rows.find(row => row.id === id);
    if (!listing) return;
    try {
      const {f,user} = await userRequired();
      if (listing.sellerUid === user.uid) return message('Your Own Listing','You cannot send a buy request for your own listing.','security');
      const ui=await getUI();
      const yes=await ui.confirm({
        eyebrow:'BUY REQUEST',
        title:'Send Buy Request?',
        text:`${listing.title} • ${money(listing.price,listing.currency)}. This sends a real request to the seller, but no payment will be charged yet.`,
        icon:'spark',
        confirmText:'Send Request',
        cancelText:'Cancel'
      });
      if(!yes) return;
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
      await message('Buy Request Sent','The seller can now see your request. No payment has been charged.','spark');
    } catch (error) {
      await message('Could Not Send Buy Request',error?.code === 'permission-denied' ? 'Marketplace order rules are not deployed yet.' : (error?.message || 'Could not send buy request.'),'security');
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
      window.NexusNovaUI?.toast(next==='sold'?'Listing marked sold.':'Listing is active again.');
      myListings();
    } catch (error) { await message('Could Not Update Listing',error?.message || 'Could not update listing.','security'); }
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
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(handler()).catch(error=>console.error('Marketplace action:',error));
    });
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
  const boot = () => { getUI().catch(()=>{}); install(); [900,1800,3500,7000].forEach(ms => setTimeout(install,ms)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();