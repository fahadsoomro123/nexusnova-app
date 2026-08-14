/* NexusNova Wallet On-Chain Sync V4
   Single source of truth for visible external-wallet balances.
   Reads only explicitly verified/maintained EVM assets for each supported chain.
   No fake balances, no transactions, no MutationObserver.
*/
(() => {
  "use strict";
  if (window.__nxWalletOnchainV4) return;
  window.__nxWalletOnchainV4 = true;

  const ERC20_BALANCE_OF = "0x70a08231";

  // Keep this list intentionally conservative. A missing token is shown as
  // unsupported rather than guessing a bridged/legacy contract address.
  const CHAINS = {
    "0x1": {
      name: "Ethereum Mainnet",
      native: "ETH",
      tokens: {
        USDT: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 6],
        USDC: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6]
      }
    },
    "0x38": {
      name: "BNB Smart Chain",
      native: "BNB",
      tokens: {}
    },
    "0x89": {
      name: "Polygon PoS",
      native: "POL",
      tokens: {
        USDC: ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6]
      }
    },
    "0xa4b1": {
      name: "Arbitrum One",
      native: "ETH",
      tokens: {
        USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6]
      }
    },
    "0xa": {
      name: "OP Mainnet",
      native: "ETH",
      tokens: {
        USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6]
      }
    },
    "0x2105": {
      name: "Base",
      native: "ETH",
      tokens: {
        USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6]
      }
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
    ETH: "ethereum",
    BNB: "binancecoin",
    POL: "polygon-ecosystem-token",
    AVAX: "avalanche-2",
    USDT: "tether",
    USDC: "usd-coin"
  };

  const $ = id => document.getElementById(id);

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

  function currentAddress() {
    return window.nexusConnectedAddress || provider()?.selectedAddress || "";
  }

  function format(raw, decimals) {
    try {
      const n = BigInt(raw || "0x0");
      const base = 10n ** BigInt(decimals);
      const whole = n / base;
      const frac = (n % base).toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
      return frac ? `${whole}.${frac}` : whole.toString();
    } catch {
      return "0";
    }
  }

  function usd(n) {
    const value = Number(n || 0);
    return "$" + value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function findRow(symbol) {
    const rows = document.querySelectorAll("#walletAssetList .coin-row");
    const wanted = String(symbol).toUpperCase();
    return [...rows].find(row => {
      const data = String(
        row.getAttribute("data-symbol") || row.getAttribute("data-asset-symbol") || ""
      ).toUpperCase();
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
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const d = await r.json();
        Object.entries(PRICE_IDS).forEach(([symbol, id]) => {
          result[symbol] = Number(d?.[id]?.usd || 0);
        });
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
        totalEl.textContent = "$ " + total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      const status = $("walletActionStatus");
      if (status && !document.getElementById("nexusWalletActionModal")) {
        status.innerHTML = `On-chain balances live • ${chain.name}`;
        status.style.color = "#22c55e";
      }
    } catch (error) {
      console.warn("NexusNova on-chain sync V4:", error);
      ["ETH","BNB","POL","AVAX","USDT","USDC"].forEach(symbol => {
        if (!Object.prototype.hasOwnProperty.call(window.__nexusOnchainVisibleBalances || {}, symbol)) {
          window.__nexusOnchainReadStatus[symbol] = "error";
        }
      });
    } finally {
      try {
        if (typeof window.__nexusPrimaryWalletRenderer === "function") {
          window.__nexusPrimaryWalletRenderer();
          // Renderer may have rebuilt rows; paint authoritative values once more.
          const px = await prices();
          Object.entries(window.__nexusOnchainVisibleBalances || {}).forEach(([symbol, amount]) => {
            setRow(symbol, amount, px[symbol] || 0);
          });
        }
      } catch (_) {}
    }
  }

  window.refreshNexusOnchainWallet = refresh;
  window.nexusWalletOnchainVersion = "verified-assets-v4";

  function start() {
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