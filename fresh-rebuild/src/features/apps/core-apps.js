import { claimDailyRewardCloudflare } from '../../core/nova-mining-rewards-store.js';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { authService } from '../../core/auth-service.js';
import {
  firebaseAuth,
  firestoreDb,
  readUserProfile,
  requireFirebaseUser
} from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';
import { escapeHtml } from '../../core/local-store.js';

const DAY = 86_400_000;
const ERC20_BALANCE_OF = '0x70a08231';
const CHAINS = {
  '0x1': { name:'Ethereum Mainnet', native:'ETH', tokens:{ USDT:['0xdAC17F958D2ee523a2206206994597C13D831ec7',6], USDC:['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',6] } },
  '0x38': { name:'BNB Smart Chain', native:'BNB', tokens:{} },
  '0x89': { name:'Polygon PoS', native:'POL', tokens:{ USDC:['0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',6] } },
  '0xa4b1': { name:'Arbitrum One', native:'ETH', tokens:{ USDC:['0xaf88d065e77c8C2239327C5EDb3A432268e5831',6] } },
  '0xa': { name:'OP Mainnet', native:'ETH', tokens:{ USDC:['0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',6] } },
  '0x2105': { name:'Base', native:'ETH', tokens:{ USDC:['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',6] } },
  '0xa86a': { name:'Avalanche C-Chain', native:'AVAX', tokens:{ USDT:['0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',6], USDC:['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',6] } }
};
const PRICE_IDS = { ETH:'ethereum', BNB:'binancecoin', POL:'polygon-ecosystem-token', AVAX:'avalanche-2', USDT:'tether', USDC:'usd-coin' };

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function formatAmount(value, digits = 4) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

function formatUsd(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}` : '—';
}

function formatDuration(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function provider() {
  const eth = window.ethereum;
  if (!eth) return null;
  const list = Array.isArray(eth.providers) ? eth.providers : [eth];
  return list.find(item => item?.isRabby) || list[0] || null;
}

async function rpc(method, params = []) {
  const p = provider();
  if (!p?.request) throw new Error('No compatible browser wallet detected.');
  return p.request({ method, params });
}

function hexBalance(raw, decimals) {
  try {
    const value = BigInt(raw || '0x0');
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = (value % base).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    return Number(`${whole}${fraction ? `.${fraction}` : ''}`);
  } catch { return 0; }
}

async function erc20(address, contract) {
  const data = ERC20_BALANCE_OF + address.slice(2).toLowerCase().padStart(64, '0');
  return rpc('eth_call', [{ to: contract, data }, 'latest']);
}

async function walletPrices() {
  const prices = { USDT:1, USDC:1 };
  try {
    const ids = [...new Set(Object.values(PRICE_IDS))].join(',');
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`, { cache:'no-store' });
    if (!response.ok) return prices;
    const data = await response.json();
    Object.entries(PRICE_IDS).forEach(([symbol,id]) => {
      const price = Number(data?.[id]?.usd);
      if (Number.isFinite(price) && price > 0) prices[symbol] = price;
    });
  } catch {}
  return prices;
}

export function renderWallet() {
  const root = node(`
    <section class="nx-wallet-hero nx-panel">
      <p class="nx-eyebrow">NEXUSNOVA WALLET</p>
      <span>NVX balance</span><strong data-wallet-nvx>—</strong>
      <small>NVX mining balance is separate from external wallet assets.</small>
    </section>
    <section class="nx-tool-card">
      <div class="nx-list-card__head"><div><strong>External EVM wallet</strong><p class="nx-tool-meta" data-wallet-network style="margin-top:3px">Not connected</p></div><button class="nx-secondary nx-fit" type="button" data-wallet-connect>CONNECT</button></div>
      <div class="nx-wallet-address" data-wallet-address>Browser wallet not connected.</div>
      <div class="nx-stack" data-wallet-assets></div>
      <div class="nx-result" data-wallet-total>Total value —</div>
      <p class="nx-tool-meta" data-wallet-status>Only verified chain/native-token contracts are read. Unsupported assets are not guessed.</p>
    </section>
  `);
  const nvx = root.querySelector('[data-wallet-nvx]');
  const network = root.querySelector('[data-wallet-network]');
  const addressEl = root.querySelector('[data-wallet-address]');
  const assets = root.querySelector('[data-wallet-assets]');
  const total = root.querySelector('[data-wallet-total]');
  const status = root.querySelector('[data-wallet-status]');
  const connect = root.querySelector('[data-wallet-connect]');
  let off = null;
  let disposed = false;

  requireFirebaseUser().then(user => {
    if (disposed) return;
    off = onSnapshot(doc(firestoreDb,'users',user.uid), snap => {
      if (disposed) return;
      const balance = Number(snap.data()?.balance);
      nvx.textContent = Number.isFinite(balance) ? `${balance.toFixed(4)} NVX` : '—';
    });
  }).catch(error => { if (!disposed) status.textContent = error.message; });

  const refresh = async ({ requestAccounts = false } = {}) => {
    if (disposed) return;
    const p = provider();
    if (!p) {
      connect.disabled = true;
      status.textContent = 'No browser wallet provider is available inside this environment. Your NVX account remains available above.';
      return;
    }
    try {
      const accounts = await rpc(requestAccounts ? 'eth_requestAccounts' : 'eth_accounts');
      if (disposed) return;
      const address = String(accounts?.[0] || '');
      if (!address) {
        status.textContent = 'Tap CONNECT and approve the wallet request.';
        return;
      }
      const chainId = String(await rpc('eth_chainId')).toLowerCase();
      if (disposed) return;
      const chain = CHAINS[chainId];
      addressEl.textContent = `${address.slice(0,8)}…${address.slice(-6)}`;
      if (!chain) {
        network.textContent = `Unsupported network • ${chainId}`;
        assets.innerHTML = '<div class="nx-empty">This network is not in the verified asset list.</div>';
        total.textContent = 'Total value unavailable';
        return;
      }
      network.textContent = chain.name;
      const prices = await walletPrices();
      if (disposed) return;
      const rows = [];
      let totalUsd = 0;
      const nativeRaw = await rpc('eth_getBalance',[address,'latest']);
      if (disposed) return;
      const nativeAmount = hexBalance(nativeRaw,18);
      const nativeUsd = nativeAmount * Number(prices[chain.native] || 0);
      totalUsd += nativeUsd;
      rows.push([chain.native,nativeAmount,nativeUsd]);
      for (const [symbol,config] of Object.entries(chain.tokens)) {
        const raw = await erc20(address,config[0]);
        if (disposed) return;
        const amount = hexBalance(raw,config[1]);
        const usd = amount * Number(prices[symbol] || 0);
        totalUsd += usd;
        rows.push([symbol,amount,usd]);
      }
      assets.innerHTML = rows.map(([symbol,amount,usd]) => `<article class="nx-world-row"><span>${symbol}</span><strong>${formatAmount(amount,6)}${usd > 0 ? ` • ${formatUsd(usd)}` : ''}</strong></article>`).join('');
      total.textContent = `External wallet total ${formatUsd(totalUsd)}`;
      status.textContent = `On-chain balances live • ${chain.name}`;
      connect.textContent = 'REFRESH';
    } catch (error) {
      if (!disposed) status.textContent = error?.message || 'Wallet connection failed.';
    }
  };
  connect.addEventListener('click', () => refresh({ requestAccounts:true }));
  refresh();
  const p = provider();
  const handleAccountsChanged = () => refresh();
  const handleChainChanged = () => refresh();
  p?.on?.('accountsChanged', handleAccountsChanged);
  p?.on?.('chainChanged', handleChainChanged);
  root.__cleanup = () => {
    disposed = true;
    off?.();
    p?.removeListener?.('accountsChanged', handleAccountsChanged);
    p?.removeListener?.('chainChanged', handleChainChanged);
  };
  return root;
}

export function renderMarket() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-inline-field"><input type="search" data-market-search placeholder="Search top 100 assets"><button type="button" data-market-refresh>REFRESH</button></div>
      <p class="nx-tool-meta" data-market-status>Loading live market…</p>
    </section>
    <section class="nx-stack" data-market-list></section>
  `);
  const search = root.querySelector('[data-market-search]');
  const list = root.querySelector('[data-market-list]');
  const status = root.querySelector('[data-market-status]');
  let coins = [];
  let busy = false;
  let disposed = false;

  const draw = () => {
    if (disposed) return;
    const q = search.value.trim().toLowerCase();
    const filtered = q ? coins.filter(coin => `${coin.name} ${coin.symbol}`.toLowerCase().includes(q)) : coins;
    list.innerHTML = filtered.length ? filtered.map((coin,index) => {
      const change = Number(coin.price_change_percentage_24h);
      const tone = Number.isFinite(change) ? (change >= 0 ? 'up' : 'down') : '';
      const symbol = String(coin.symbol || '').toUpperCase();
      const rawImage = String(coin.image || '').trim();
      const image = /^https:\/\//i.test(rawImage) ? rawImage : '';
      const logo = image
        ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(coin.name)} logo" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : `<span class="nx-market-logo-fallback">${escapeHtml(symbol.slice(0,2) || '?')}</span>`;
      return `<article class="nx-market-row"><div class="nx-market-brandmark"><span class="nx-market-coin-logo">${logo}</span><span class="nx-market-rank">${coin.market_cap_rank || index+1}</span></div><div class="nx-market-copy"><strong>${escapeHtml(coin.name)}</strong><small>${escapeHtml(symbol)}</small></div><div class="right"><strong>${formatUsd(coin.current_price)}</strong><small class="${tone}">${Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}</small></div></article>`;
    }).join('') : '<div class="nx-empty">No matching assets.</div>';
  };
  const load = async () => {
    if (busy || disposed) return;
    busy = true;
    status.textContent = 'Loading live top 100 market data…';
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h', { cache:'no-store' });
      if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
      const data = await response.json();
      if (disposed) return;
      if (!Array.isArray(data) || !data.length) throw new Error('Market returned no assets.');
      coins = data.slice(0,100);
      status.textContent = `${coins.length} live assets • updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      draw();
    } catch (error) {
      if (disposed) return;
      coins = [];
      status.textContent = 'Live market unavailable. No fake prices are being shown.';
      draw();
      console.warn('[NexusNova Fresh] market:', error);
    } finally { busy = false; }
  };
  search.addEventListener('input',draw);
  root.querySelector('[data-market-refresh]').addEventListener('click',load);
  load();
  root.__cleanup = () => { disposed = true; };
  return root;
}

export function renderRewards() {
  const root = node(`
    <section class="nx-reward-hero nx-panel"><p class="nx-eyebrow">SECURE REWARDS</p><strong data-reward-balance>— NVX</strong><span data-reward-streak>Daily streak —</span></section>
    <section class="nx-tool-card">
      <div class="nx-reward-row"><div><strong>Daily Reward</strong><p>Secure +5 NVX once every 24 hours.</p></div><button type="button" data-daily-claim>CHECKING…</button></div>
      <p class="nx-tool-meta" data-daily-status>Checking eligibility…</p>
    </section>
    <section class="nx-tool-card">
      <div class="nx-reward-row"><div><strong>Watch Ad</strong><p>TEST AdMob flow for the future +2.5 NVX task.</p></div><button type="button" data-watch-ad>WATCH TEST AD</button></div>
      <p class="nx-tool-meta" data-watch-status>TEST ads never credit +2.5 NVX.</p>
    </section>
  `);
  const balance = root.querySelector('[data-reward-balance]');
  const streak = root.querySelector('[data-reward-streak]');
  const dailyBtn = root.querySelector('[data-daily-claim]');
  const dailyStatus = root.querySelector('[data-daily-status]');
  const watchBtn = root.querySelector('[data-watch-ad]');
  const watchStatus = root.querySelector('[data-watch-status]');
  let profile = null;
  let off = null;
  let timer = null;
  let disposed = false;

  const paint = () => {
    if (disposed) return;
    const value = Number(profile?.balance);
    balance.textContent = Number.isFinite(value) ? `${value.toFixed(4)} NVX` : '— NVX';
    streak.textContent = `Daily streak ${Math.max(0, Number(profile?.dailyRewardStreak) || 0)}`;
    const last = Math.max(0, Number(profile?.lastDailyReward) || 0);
    const left = Math.max(0, DAY - (Date.now() - last));
    dailyBtn.disabled = left > 0;
    dailyBtn.textContent = left > 0 ? formatDuration(left) : 'CLAIM +5 NVX';
    dailyStatus.textContent = left > 0 ? 'Next Daily Reward becomes available when this timer reaches zero.' : 'Daily Reward is ready. TEST rewarded ad is used as the current gate.';
  };

  requireFirebaseUser().then(user => {
    if (disposed) return;
    off = onSnapshot(doc(firestoreDb,'users',user.uid), snap => {
      if (disposed) return;
      profile = snap.data() || {};
      paint();
    });
    if (!disposed) timer = setInterval(paint,1000);
  }).catch(error => { if (!disposed) dailyStatus.textContent = error.message; });

  dailyBtn.addEventListener('click', async () => {
    if (dailyBtn.disabled || disposed) return;
    dailyBtn.disabled = true;
    dailyStatus.textContent = 'Opening Google TEST rewarded ad…';
    try {
      const user = await requireFirebaseUser({ write:true });
      const ad = await nativeAds.showRewarded({ purpose:'daily-reward-test', userId:user.uid });
      if (!ad.earned) throw new Error('Ad closed before reward completion.');
      if (!disposed) dailyStatus.textContent = 'Ad completed • confirming Daily Reward with secure server…';
      const data = await claimDailyRewardCloudflare({ source:'fresh-rebuild-daily-test-gate' });
      const reward = Number(data.reward);
      const nextBalance = Number(data.balance);
      if (!(reward > 0) || !Number.isFinite(nextBalance)) throw new Error('Secure Daily Reward response was invalid.');
      if (!disposed) dailyStatus.textContent = `✓ +${reward} NVX confirmed by secure server.`;
    } catch (error) {
      if (!disposed) dailyStatus.textContent = error?.message || 'Daily Reward could not be completed.';
    } finally { paint(); }
  });

  watchBtn.addEventListener('click', async () => {
    if (disposed) return;
    watchBtn.disabled = true;
    watchStatus.textContent = 'Opening Google TEST rewarded ad…';
    try {
      const user = await requireFirebaseUser({ verified:true });
      const result = await nativeAds.showRewarded({ purpose:'task-watch-ad', userId:user.uid });
      if (!disposed) watchStatus.textContent = result.earned
        ? '✓ TEST ad completed. +2.5 NVX was NOT credited in TEST mode.'
        : 'Ad closed before reward completion. No NVX was changed.';
    } catch (error) {
      if (!disposed) watchStatus.textContent = error?.message || 'Rewarded ad unavailable.';
    } finally { if (!disposed) watchBtn.disabled = false; }
  });

  nativeAds.requestStatus();
  root.__cleanup = () => {
    disposed = true;
    off?.();
    clearInterval(timer);
  };
  return root;
}

export function renderProfile() {
  const root = node(`
    <section class="nx-profile-hero nx-panel"><div class="nx-profile-avatar" data-profile-avatar>N</div><div><p class="nx-eyebrow">NEXUS IDENTITY</p><strong data-profile-name>Loading…</strong><span data-profile-email></span></div></section>
    <div class="nx-summary-grid"><div><span>Total mined</span><strong data-profile-mined>—</strong></div><div><span>Tasks</span><strong data-profile-tasks>—</strong></div></div>
    <section class="nx-tool-card">
      <label class="nx-field"><span>Name</span><input maxlength="80" data-profile-name-input></label>
      <label class="nx-field"><span>Bio</span><textarea maxlength="180" rows="3" data-profile-bio></textarea></label>
      <div class="nx-two-col"><label class="nx-field"><span>City</span><input maxlength="80" data-profile-city></label><label class="nx-field"><span>Country</span><input maxlength="80" data-profile-country></label></div>
      <button class="nx-primary" type="button" data-profile-save>SAVE PROFILE</button>
      <p class="nx-tool-meta" data-profile-status>Profile details are account-scoped.</p>
    </section>
  `);
  const refs = {
    avatar:root.querySelector('[data-profile-avatar]'), name:root.querySelector('[data-profile-name]'), email:root.querySelector('[data-profile-email]'), mined:root.querySelector('[data-profile-mined]'), tasks:root.querySelector('[data-profile-tasks]'),
    nameInput:root.querySelector('[data-profile-name-input]'), bio:root.querySelector('[data-profile-bio]'), city:root.querySelector('[data-profile-city]'), country:root.querySelector('[data-profile-country]'), status:root.querySelector('[data-profile-status]')
  };
  let user = null, off = null, disposed = false;
  requireFirebaseUser().then(active => {
    if (disposed) return;
    user = active;
    refs.email.textContent = active.email || '';
    off = onSnapshot(doc(firestoreDb,'users',active.uid), snap => {
      if (disposed) return;
      const data = snap.data() || {};
      const name = String(data.name || active.displayName || 'NexusNova User');
      refs.name.textContent = name;
      refs.avatar.textContent = name.trim().charAt(0).toUpperCase() || 'N';
      refs.mined.textContent = `${formatAmount(data.totalMined,4)} NVX`;
      refs.tasks.textContent = formatAmount(data.tasksCompleted,0);
      refs.nameInput.value = name;
      refs.bio.value = data.bio || '';
      refs.city.value = data.city || '';
      refs.country.value = data.country || '';
    });
  }).catch(error => { if (!disposed) refs.status.textContent = error.message; });

  root.querySelector('[data-profile-save]').addEventListener('click', async () => {
    if (disposed) return;
    const button = root.querySelector('[data-profile-save]');
    button.disabled = true;
    refs.status.textContent = 'Saving profile…';
    try {
      const active = user || await requireFirebaseUser();
      const name = refs.nameInput.value.replace(/\s+/g,' ').trim().slice(0,80);
      if (!name) throw new Error('Name is required.');
      await updateDoc(doc(firestoreDb,'users',active.uid), {
        name,
        bio:refs.bio.value.trim().slice(0,180),
        city:refs.city.value.trim().slice(0,80),
        country:refs.country.value.trim().slice(0,80),
        profileUpdatedAt:serverTimestamp()
      });
      if (!disposed) refs.status.textContent = '✓ Profile saved.';
    } catch (error) {
      if (!disposed) refs.status.textContent = error?.message || 'Profile could not be saved.';
    } finally {
      if (!disposed) button.disabled = false;
    }
  });
  root.__cleanup = () => {
    disposed = true;
    off?.();
  };
  return root;
}

export function renderSettings() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-setting-row"><div><strong>Account</strong><span data-settings-email>—</span></div><span class="nx-badge" data-settings-verified>CHECKING</span></div>
      <div class="nx-setting-row"><div><strong>Ads</strong><span>Android TEST inventory only in debug APK</span></div><span class="nx-badge" data-settings-ads>CHECKING</span></div>
      <div class="nx-setting-row"><div><strong>Architecture</strong><span>Fresh rebuild • no legacy UI runtime</span></div><span class="nx-badge good">FRESH</span></div>
    </section>
    <section class="nx-tool-card">
      <div class="nx-action-row"><button type="button" data-settings-resend>RESEND VERIFICATION</button><button type="button" data-settings-ad-status>REFRESH AD STATUS</button><button type="button" data-settings-logout>LOG OUT</button></div>
      <p class="nx-tool-meta" data-settings-status>Settings are ready.</p>
    </section>
  `);
  const email = root.querySelector('[data-settings-email]');
  const verified = root.querySelector('[data-settings-verified]');
  const adBadge = root.querySelector('[data-settings-ads]');
  const status = root.querySelector('[data-settings-status]');
  let disposed = false;
  let adRefreshTimer = null;
  const paintAds = () => {
    if (disposed) return;
    const ad = nativeAds.status();
    adBadge.textContent = !ad.configured ? 'WEB ONLY' : ad.testMode ? (ad.sdkReady ? 'TEST READY' : 'TEST LOADING') : 'PRODUCTION';
    adBadge.classList.toggle('good', ad.configured && ad.testMode && ad.sdkReady);
  };
  const paintUser = async () => {
    const user = await requireFirebaseUser();
    await user.reload();
    if (disposed) return;
    const active = firebaseAuth.currentUser || user;
    email.textContent = active.email || '';
    verified.textContent = active.emailVerified ? 'VERIFIED' : 'UNVERIFIED';
    verified.classList.toggle('good', active.emailVerified);
  };
  paintUser().catch(error => { if (!disposed) status.textContent = error.message; });
  paintAds();
  const offAds = nativeAds.subscribe(paintAds);
  root.querySelector('[data-settings-resend]').addEventListener('click', async () => {
    try {
      await authService.resendVerification();
      if (!disposed) status.textContent = 'Verification email sent.';
    } catch (error) {
      if (!disposed) status.textContent = error.message;
    }
  });
  root.querySelector('[data-settings-ad-status]').addEventListener('click', () => {
    if (disposed) return;
    nativeAds.requestStatus();
    status.textContent = 'Requested native AdMob status.';
    clearTimeout(adRefreshTimer);
    adRefreshTimer = setTimeout(paintAds,500);
  });
  root.querySelector('[data-settings-logout]').addEventListener('click', async () => { await authService.logout(); });
  root.__cleanup = () => {
    disposed = true;
    clearTimeout(adRefreshTimer);
    offAds?.();
  };
  return root;
}

export const coreRenderers = Object.freeze({
  wallet:renderWallet,
  tasks:renderRewards,
  market:renderMarket,
  profile:renderProfile,
  settings:renderSettings
});
