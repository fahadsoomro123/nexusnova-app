/* NexusNova Wallet On-Chain Sync V5
   Single source of truth for visible external-wallet balances.
   Reads only explicitly verified/maintained EVM assets for each supported chain.
   Adds requested wallet layout, zero-balance filter, mobile safe navigation and smooth scrolling.
*/
(() => {
  "use strict";
  if (window.__nxWalletOnchainV5) return;
  window.__nxWalletOnchainV5 = true;

  const ERC20_BALANCE_OF = "0x70a08231";

  const CHAINS = {
    "0x1": {
      name: "Ethereum Mainnet",
      native: "ETH",
      tokens: {
        USDT: ["0xdAC17F958D2ee523a2206994597C13D831ec7", 6],
        USDC: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6]
      }
    },
    "0x38": { name: "BNB Smart Chain", native: "BNB", tokens: {} },
    "0x89": {
      name: "Polygon PoS",
      native: "POL",
      tokens: { USDC: ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6] }
    },
    "0xa4b1": {
      name: "Arbitrum One",
      native: "ETH",
      tokens: { USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6] }
    },
    "0xa": {
      name: "OP Mainnet",
      native: "ETH",
      tokens: { USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6] }
    },
    "0x2105": {
      name: "Base",
      native: "ETH",
      tokens: { USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6] }
    },
    "0xa86a": {
      name: "Avalanche C-Chain",
      native: "AVAX",
      tokens: {
        USDT: ["0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", 6],
        USDC: ["0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", 6]
      }
    }
  };

  const PRICE_IDS = {
    ETH: "ethereum", BNB: "binancecoin", POL: "polygon-ecosystem-token",
    AVAX: "avalanche-2", USDT: "tether", USDC: "usd-coin"
  };

  const $ = id => document.getElementById(id);
  const ZERO_PREF = "nexusnova_wallet_hide_zero_v1";

  function installUiPolish(){
    if (!document.getElementById("nxMobileWalletPolishV1")) {
      const style = document.createElement("style");
      style.id = "nxMobileWalletPolishV1";
      style.textContent = `
        html,body{scroll-behavior:smooth!important;overscroll-behavior-y:contain}
        body{touch-action:pan-y;-webkit-tap-highlight-color:transparent}
        .main,.wallet-assets-scroll,.chat-box,.ai-box,.nx-scripture-reader{scroll-behavior:smooth!important;-webkit-overflow-scrolling:touch}
        .bottom-dock{transform:translateZ(0);backface-visibility:hidden;will-change:transform}
        .dock-item,.more-item,.action-btn,.refresh-btn{touch-action:manipulation}
        .mi-icon svg{transform:scale(.88);transform-origin:center}
        #tab-wallet .coin-row .mi-icon svg{transform:scale(.84)}
        #nxHideZeroBalances{display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
        #nxHideZeroBalances.active{color:#fff!important;border-color:rgba(57,180,255,.7)!important;background:linear-gradient(135deg,#116ce7,#27a3ff)!important;box-shadow:0 8px 20px rgba(22,126,255,.22)}
        @media(max-width:700px){
          body{padding-bottom:132px!important}
          .bottom-dock{left:8px!important;right:8px!important;bottom:max(24px,env(safe-area-inset-bottom))!important;border-radius:19px!important;overflow:hidden!important;box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 1px rgba(85,159,255,.18)!important}
          .dock-inner{padding:2px 3px 4px!important}
          .dock-item{padding:8px 2px 7px!important;min-height:58px!important}
          .dock-item .mi-icon{margin-bottom:1px!important}
          .more-menu{bottom:calc(max(24px,env(safe-area-inset-bottom)) + 78px)!important}
          .more-menu.show{max-height:calc(100dvh - 112px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch}
          .main{padding-bottom:22px!important}
        }
      `;
      document.head.appendChild(style);
    }

    const wallet = $("tab-wallet");
    const list = $("walletAssetList");
    if (!wallet || !list) return;

    const assetCard = list.closest(".card");
    const actionCard = [...wallet.querySelectorAll(":scope > .card")].find(card =>
      /wallet actions/i.test(card.querySelector("h3")?.textContent || "")
    );
    if (assetCard && actionCard && assetCard.parentNode === actionCard.parentNode && actionCard.nextElementSibling !== assetCard) {
      assetCard.parentNode.insertBefore(actionCard, assetCard);
    }

    if (assetCard && !$("nxHideZeroBalances")) {
      const header = assetCard.querySelector(".market-header") || assetCard;
      const btn = document.createElement("button");
      btn.id = "nxHideZeroBalances";
      btn.type = "button";
      btn.className = "refresh-btn";
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = '<span class="mi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/></svg></span><span>Hide zero</span>';
      const refresh = header.querySelector(".refresh-btn");
      if (refresh?.parentNode === header) header.insertBefore(btn, refresh);
      else header.appendChild(btn);
      btn.addEventListener("click", () => {
        const enabled = btn.getAttribute("aria-pressed") !== "true";
        localStorage.setItem(ZERO_PREF, enabled ? "1" : "0");
        applyZeroFilter();
      });
    }

    applyZeroFilter();
  }

  function rowBalance(row){
    const explicit = row.querySelector(".wallet-live-balance,[data-balance],.wallet-balance,.asset-balance,.wallet-asset-balance");
    const text = String(explicit?.textContent || "").trim();
    if (text) {
      const n = Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
      if (Number.isFinite(n)) return n;
    }

    const right = row.lastElementChild;
    if (right) {
      const lines = String(right.innerText || right.textContent || "")
        .split(/\n+/).map(v => v.trim()).filter(Boolean).reverse();
      for (const line of lines) {
        if (/^[≈$]/.test(line)) continue;
        const m = line.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s+\S+/);
        if (m) return Number(m[1]);
      }
    }
    return null;
  }

  function applyZeroFilter(){
    const list = $("walletAssetList");
    const btn = $("nxHideZeroBalances");
    if (!list) return;
    const enabled = localStorage.getItem(ZERO_PREF) === "1";
    if (btn) {
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.classList.toggle("active", enabled);
      const label = btn.querySelector("span:last-child");
      if (label) label.textContent = enabled ? "Show all" : "Hide zero";
    }
    list.querySelectorAll(":scope > .coin-row").forEach(row => {
      const amount = rowBalance(row);
      row.style.display = enabled && amount !== null && Math.abs(amount) < 1e-12 ? "none" : "";
    });
  }

  window.nexusApplyWalletZeroFilter = applyZeroFilter;

  window.__nexusOnchainVisibleBalances = window.__nexusOnchainVisibleBalances || {};
  window.__nexusOnchainReadStatus = window.__nexusOnchainReadStatus || {};
  window.__nexusOnchainNetwork = window.__nexusOnchainNetwork || "";

  function provider() {
    const eth = window.ethereum;
    if (!eth) return null;
    const list = Array.isArray(eth.providers) ? eth.providers : [eth];
    const address = String(window.nexusConnectedAddress || "").toLowerCase();
    if (address) {
      const authorized = list.find(p => p?.selectedAddress?.toLowerCase?.() === address);
      if (authorized) return authorized;
    }
    return list.find(p => p?.isRabby) || list[0] || null;
  }

  function currentAddress() { return window.nexusConnectedAddress || provider()?.selectedAddress || ""; }

  function format(raw, decimals) {
    try {
      const n = BigInt(raw || "0x0");
      const base = 10n ** BigInt(decimals);
      const whole = n / base;
      const frac = (n % base).toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
      return frac ? `${whole}.${frac}` : whole.toString();
    } catch { return "0"; }
  }

  function usd(n) {
    const value = Number(n || 0);
    return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function findRow(symbol) {
    const rows = document.querySelectorAll("#walletAssetList .coin-row");
    const wanted = String(symbol).toUpperCase();
    return [...rows].find(row => {
      const data = String(row.getAttribute("data-symbol") || row.getAttribute("data-asset-symbol") || "").toUpperCase();
      if (data === wanted) return true;
      const text = String(row.querySelector(".coin-symbol")?.textContent || row.textContent || "").toUpperCase();
      return new RegExp(`\\b${wanted}\\b`).test(text);
    }) || null;
  }

  function setRow(symbol, amount, price) {
    window.__nexusOnchainVisibleBalances[symbol] = Number(amount || 0);
    window.__nexusOnchainReadStatus[symbol] = "ok";
    const row = findRow(symbol);
    if (!row) return Number(amount || 0) * Number(price || 0);
    const right = row.lastElementChild || row.querySelector(".wallet-row-right");
    if (!right) return 0;
    let balanceEl = right.querySelector(".wallet-live-balance");
    if (!balanceEl) {
      balanceEl = document.createElement("div");
      balanceEl.className = "wallet-live-balance";
      right.appendChild(balanceEl);
    }
    balanceEl.textContent = `${amount} ${symbol}`;
    let valueEl = right.querySelector(".wallet-live-usd");
    if (!valueEl) {
      valueEl = document.createElement("div");
      valueEl.className = "wallet-live-usd";
      right.appendChild(valueEl);
    }
    const px = Number(price || 0);
    valueEl.textContent = px > 0 ? "≈ " + usd(Number(amount) * px) : "";
    queueMicrotask(applyZeroFilter);
    return Number(amount) * px;
  }

  function setPending(symbol, message) {
    delete window.__nexusOnchainVisibleBalances[symbol];
    window.__nexusOnchainReadStatus[symbol] = /unsupported|not configured/i.test(String(message)) ? "unsupported" : "pending";
    const row = findRow(symbol);
    if (!row) return;
    const right = row.lastElementChild || row.querySelector(".wallet-row-right");
    if (!right) return;
    let el = right.querySelector(".wallet-live-balance");
    if (!el) {
      el = document.createElement("div");
      el.className = "wallet-live-balance";
      right.appendChild(el);
    }
    const soft = /unsupported|not configured/i.test(String(message))
      ? ("0 " + symbol)
      : (String(message).includes("Connect") ? ("0 " + symbol) : String(message));
    el.textContent = soft;
    queueMicrotask(applyZeroFilter);
  }

  async function rpc(method, params = []) {
    const p = provider();
    if (!p) throw new Error("No browser wallet detected");
    return p.request({ method, params });
  }

  async function erc20(address, contract) {
    const data = ERC20_BALANCE_OF + address.slice(2).toLowerCase().padStart(64, "0");
    return rpc("eth_call", [{ to: contract, data }, "latest"]);
  }

  async function prices() {
    const result = {};
    try {
      const ids = [...new Set(Object.values(PRICE_IDS))].join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        Object.entries(PRICE_IDS).forEach(([symbol, id]) => { result[symbol] = Number(d?.[id]?.usd || 0); });
      }
    } catch (_) {}
    result.USDT = result.USDT || 1;
    result.USDC = result.USDC || 1;
    return result;
  }

  function clearOtherChainBalances(chain) {
    const allowed = new Set([chain.native, ...Object.keys(chain.tokens)]);
    ["ETH","BNB","POL","AVAX","USDT","USDC","MATIC"].forEach(symbol => {
      if (!allowed.has(symbol)) {
        delete window.__nexusOnchainVisibleBalances[symbol];
        window.__nexusOnchainReadStatus[symbol] = "unsupported";
      }
    });
  }

  async function refresh() {
    const p = provider();
    const list = $("walletAssetList");
    if (!p || !list) return;
    try {
      const accounts = await rpc("eth_accounts");
      const address = accounts?.[0] || currentAddress();
      if (!address) {
        ["ETH","BNB","POL","AVAX","USDT","USDC"].forEach(s => setPending(s, "Connect wallet to read balance"));
        return;
      }
      const chainId = String(await rpc("eth_chainId")).toLowerCase();
      window.nexusConnectedAddress = address;
      window.nexusConnectedChainId = chainId;
      const chain = CHAINS[chainId];
      window.__nexusOnchainNetwork = chain?.name || chainId;
      if (!chain) {
        window.__nexusOnchainVisibleBalances = {};
        ["ETH","BNB","POL","AVAX","USDT","USDC"].forEach(s => setPending(s, "Unsupported EVM network"));
        return;
      }
      clearOtherChainBalances(chain);
      const px = await prices();
      let total = 0;
      const nativeHex = await rpc("eth_getBalance", [address, "latest"]);
      const nativeAmount = format(nativeHex, 18);
      total += setRow(chain.native, nativeAmount, px[chain.native] || 0);
      for (const symbol of ["USDT", "USDC"]) {
        const config = chain.tokens[symbol];
        if (!config) {
          setPending(symbol, `${symbol} not configured on ${chain.name}`);
          continue;
        }
        const raw = await erc20(address, config[0]);
        const amount = format(raw, config[1]);
        total += setRow(symbol, amount, px[symbol] || 0);
      }
      const totalEl = $("walletTotalUsd");
      if (totalEl) {
        totalEl.textContent = "$ " + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      const status = $("walletActionStatus");
      if (status && !document.getElementById("nexusWalletActionModal")) {
        status.innerHTML = `On-chain balances live • ${chain.name}`;
        status.style.color = "#22c55e";
      }
    } catch (error) {
      console.warn("NexusNova on-chain sync V5:", error);
      ["ETH","BNB","POL","AVAX","USDT","USDC"].forEach(symbol => {
        if (!Object.prototype.hasOwnProperty.call(window.__nexusOnchainVisibleBalances || {}, symbol)) {
          window.__nexusOnchainReadStatus[symbol] = "error";
        }
      });
    } finally {
      try {
        if (typeof window.__nexusPrimaryWalletRenderer === "function") {
          window.__nexusPrimaryWalletRenderer();
          const px = await prices();
          Object.entries(window.__nexusOnchainVisibleBalances || {}).forEach(([symbol, amount]) => {
            setRow(symbol, amount, px[symbol] || 0);
          });
        }
      } catch (_) {}
      installUiPolish();
      applyZeroFilter();
    }
  }

  window.refreshNexusOnchainWallet = refresh;
  window.nexusWalletOnchainVersion = "verified-assets-v5-polished";

  function start() {
    installUiPolish();
    const list = $("walletAssetList");
    if (list && !list.__nxZeroObserver) {
      const observer = new MutationObserver(() => {
        installUiPolish();
        applyZeroFilter();
      });
      observer.observe(list, { childList:true, subtree:true, characterData:true });
      list.__nxZeroObserver = observer;
    }
    refresh();
    setTimeout(refresh, 1200);
    setTimeout(refresh, 3000);
    setInterval(refresh, 10000);
    const p = provider();
    if (p?.on) {
      p.on("accountsChanged", () => setTimeout(refresh, 250));
      p.on("chainChanged", () => setTimeout(refresh, 250));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
