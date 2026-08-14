/* NexusNova Orders Live v1
   Real Firestore buy-request/order records shared between buyer and seller.
   Statuses are user/seller workflow states, not fake courier or payment confirmations. */
(() => {
  'use strict';
  if (window.__nxOrdersLiveV1) return;
  window.__nxOrdersLiveV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let api = null;
  let currentRows = [];

  function output() {
    let el = $('nxOrdersLiveOut');
    const tab = $('tab-mega-orders');
    if (!tab) return null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxOrdersLiveOut';
      el.className = 'card';
      el.style.marginTop = '12px';
      tab.appendChild(el);
    }
    return el;
  }

  function status(message, danger = false) {
    const el = output();
    if (el) el.innerHTML = `<div class="nxmega-muted" style="${danger ? 'color:#f87171' : ''}">${esc(message)}</div>`;
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
    api = {auth:authLib.getAuth(apps[0]), db:dbLib.getFirestore(apps[0]), ...dbLib};
    return api;
  }

  async function required() {
    const f = await firebase();
    const user = f.auth.currentUser;
    if (!user) throw new Error('Sign in first to view Orders.');
    return {f,user};
  }

  function timeValue(value) {
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
    return Number(value) || 0;
  }

  async function loadAll() {
    const {f,user} = await required();
    const ref = f.collection(f.db,'marketplaceOrders');
    const [buyerSnap,sellerSnap] = await Promise.all([
      f.getDocs(f.query(ref,f.where('buyerUid','==',user.uid),f.limit(100))),
      f.getDocs(f.query(ref,f.where('sellerUid','==',user.uid),f.limit(100)))
    ]);
    const map = new Map();
    [...buyerSnap.docs,...sellerSnap.docs].forEach(doc => map.set(doc.id,{id:doc.id,...doc.data()}));
    return [...map.values()].sort((a,b)=>timeValue(b.createdAt)-timeValue(a.createdAt));
  }

  function money(row) {
    return `${row.currency || 'PKR'} ${Number(row.amount || 0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  }

  function label(value) {
    return String(value || 'requested').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  }

  function nextSellerStatus(statusValue) {
    return ({requested:'accepted',accepted:'processing',processing:'shipped',shipped:'out_for_delivery',out_for_delivery:'delivered'})[statusValue] || '';
  }

  function render(filter = 'all') {
    const el = output();
    if (!el) return;
    const uid = api?.auth?.currentUser?.uid || '';
    let rows = currentRows;
    if (filter === 'processing') rows = rows.filter(x => ['accepted','processing'].includes(x.status));
    else if (filter === 'return') rows = rows.filter(x => ['return_requested','cancelled'].includes(x.status));
    else if (filter !== 'all') rows = rows.filter(x => x.status === filter);

    if (!rows.length) {
      el.innerHTML = '<div class="nxmega-muted">No matching real order records.</div>';
      return;
    }

    el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px"><b>Marketplace Orders</b><span class="nxmega-muted">${rows.length} record(s)</span></div>` + rows.map(row => {
      const seller = row.sellerUid === uid;
      const buyer = row.buyerUid === uid;
      const next = seller ? nextSellerStatus(row.status) : '';
      const when = timeValue(row.createdAt) ? new Date(timeValue(row.createdAt)).toLocaleString() : 'syncing';
      return `<div class="nxmega-item" style="margin-top:10px">
        <div style="min-width:0;flex:1"><b>${esc(row.title || 'Marketplace item')}</b><small>${money(row)} · ${seller ? 'You are seller' : 'You are buyer'} · ${esc(when)}</small><div style="margin-top:5px;font-size:12px">Status: <b>${esc(label(row.status))}</b></div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${next ? `<button type="button" class="action-btn primary" data-order-status="${esc(row.id)}" data-next="${esc(next)}">Set ${esc(label(next))}</button>` : ''}
          ${seller && !['delivered','cancelled','return_requested'].includes(row.status) ? `<button type="button" class="action-btn danger" data-order-status="${esc(row.id)}" data-next="cancelled">Cancel</button>` : ''}
          ${buyer && ['requested','accepted'].includes(row.status) ? `<button type="button" class="action-btn danger" data-order-status="${esc(row.id)}" data-next="cancelled">Cancel Request</button>` : ''}
          ${buyer && row.status === 'delivered' ? `<button type="button" class="action-btn" data-order-status="${esc(row.id)}" data-next="return_requested">Request Return</button>` : ''}
        </div>
      </div>`;
    }).join('') + `<div class="integration-note" style="margin-top:12px">These are real NexusNova buyer/seller records. Payment settlement and courier tracking are not claimed until their providers are connected.</div>`;

    el.querySelectorAll('[data-order-status]').forEach(button => button.addEventListener('click', () => updateStatus(button.dataset.orderStatus,button.dataset.next)));
  }

  async function refresh(filter = 'all') {
    status('Loading real order records…');
    try {
      currentRows = await loadAll();
      render(filter);
    } catch (error) {
      console.error('NexusNova Orders:', error);
      status(error?.code === 'permission-denied' ? 'Marketplace/Orders Firestore rules are not deployed yet.' : (error?.message || 'Orders unavailable.'), true);
    }
  }

  async function updateStatus(id,next) {
    const allowed = ['accepted','processing','shipped','out_for_delivery','delivered','cancelled','return_requested'];
    if (!allowed.includes(next)) return;
    if (!confirm(`Update this order to “${label(next)}”?`)) return;
    try {
      const {f} = await required();
      await f.updateDoc(f.doc(f.db,'marketplaceOrders',id), {status:next,updatedAt:f.serverTimestamp()});
      await refresh('all');
    } catch (error) {
      alert(error?.code === 'permission-denied' ? 'Order rules are not deployed or this status change is not allowed for your role.' : (error?.message || 'Could not update order.'));
    }
  }

  function findButton(labelText) {
    return Array.from(document.querySelectorAll('#tab-mega-orders button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === labelText.toLowerCase()
    );
  }
  function claim(labelText,id,filter) {
    const button = findButton(labelText);
    if (!button || button.dataset.nxOrdersReady === '1') return;
    button.id = id;
    button.dataset.nxOrdersReady = '1';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();refresh(filter);});
  }

  function install() {
    if (!$('tab-mega-orders')) return;
    claim('All Orders','nxOrdersAll','all');
    claim('Processing','nxOrdersProcessing','processing');
    claim('Shipped','nxOrdersShipped','shipped');
    claim('Out for Delivery','nxOrdersOut','out_for_delivery');
    claim('Delivered','nxOrdersDelivered','delivered');
    claim('Return / Refund','nxOrdersReturn','return');
  }

  window.nexusOrdersRefresh = refresh;
  const boot=()=>{install();[900,1800,3500,7000].forEach(ms=>setTimeout(install,ms));};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();