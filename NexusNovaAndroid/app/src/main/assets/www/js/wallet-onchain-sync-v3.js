/* NexusNova Wallet On-Chain Sync V3
   Single source of truth for the visible external-wallet balances.
   Reads the currently connected injected EVM wallet.
   No fake balances, no transactions, no MutationObserver.
*/
(() => {
  "use strict";

  const ERC20_BALANCE_OF = "0x70a08231";

  const CHAINS = {
    "0x1": {
      name: "Ethereum Mainnet",
      native: "ETH",
      tokens: {
        USDT: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 6],
        USDC: ["0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6]
      }
    },
    "0x38": {
      name: "BNB Smart Chain",
      native: "BNB",
      tokens: {
        USDT: ["0x55d398326f99059fF775485246999027B3197955", 18],
        USDC: ["0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", 18]
      }
    },
    "0x89": {
      name: "Polygon",
      native: "MATIC",
      tokens: {
        USDT: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6],
        USDC: ["0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6]
      }
    },
    "0xa4b1": {
      name: "Arbitrum One",
      native: "ETH",
      tokens: {
        USDT: ["0xFd086bC7CD5C481dcc9C85ebe478A1C0b69FCbb9", 6],
        USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6]
      }
    },
    "0xa": {
      name: "Optimism",
      native: "ETH",
      tokens: {
        USDT: ["0x01bff41798a0bcf287b996046ca68b395dbc1071", 6],
        USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6]
      }
    },
    "0x2105": {
      name: "Base",
      native: "ETH",
      tokens: {
        USDT: ["0x0000000000000000000000000000000000000000", 6],
        USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6]
      }
    }
  };

  const PRICE_IDS = {
    ETH: "ethereum",
    BNB: "binancecoin",
    MATIC: "matic-network",
    USDT: "tether",
    USDC: "usd-coin"
  };

  const $ = id => document.getElementById(id);

  window.__nexusOnchainVisibleBalances =
    window.__nexusOnchainVisibleBalances || {};

  window.__nexusOnchainReadStatus =
    window.__nexusOnchainReadStatus || {};

  window.__nexusOnchainNetwork =
    window.__nexusOnchainNetwork || "";

  function provider() {
    return window.ethereum || null;
  }

  function currentAddress() {
    return window.nexusConnectedAddress || window.ethereum?.selectedAddress || "";
  }

  function currentChain() {
    return String(window.nexusConnectedChainId || "").toLowerCase();
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
        row.getAttribute("data-symbol") ||
        row.getAttribute("data-asset-symbol") ||
        ""
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
    if (!row) return 0;

    const right = row.lastElementChild || row.querySelector(".wallet-row-right");
    if (!right) return 0;

    // NEVER overwrite the live USD price element
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
    valueEl.textContent = px > 0
      ? "≈ " + usd(Number(amount) * px)
      : "";

    return Number(amount) * px;
  }

  function setPending(symbol, message) {
    delete window.__nexusOnchainVisibleBalances[symbol];
    window.__nexusOnchainReadStatus[symbol] =
      /unsupported|not configured/i.test(String(message)) ? "unsupported" : "pending";
    const row = findRow(symbol);
    if (!row) return;
    const right = row.lastElementChild || row.querySelector(".wallet-row-right");
    if (!right) return;

    // Only touch balance line — keep price intact
    let el = right.querySelector(".wallet-live-balance");
    if (!el) {
      el = document.createElement("div");
      el.className = "wallet-live-balance";
      right.appendChild(el);
    }
    // Soft message, not "Other chain / Not supported"
    const soft = /unsupported|not configured|Unsupported/i.test(String(message))
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
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network,tether,usd-coin&vs_currencies=usd",
        { cache: "no-store" }
      );
      if (r.ok) {
        const d = await r.json();
        Object.entries(PRICE_IDS).forEach(([symbol, id]) => {
          result[symbol] = Number(d?.[id]?.usd || 0);
        });
      }
    } catch (_) {}

    // Stablecoin fallback; native prices are deliberately never invented.
    result.USDT = result.USDT || 1;
    result.USDC = result.USDC || 1;
    return result;
  }

  async function refresh() {
    const p = provider();
    const list = $("walletAssetList");
    if (!p || !list) return;

    try {
      const accounts = await rpc("eth_accounts");
      const address = accounts?.[0] || currentAddress();
      if (!address) {
        ["ETH", "BNB", "USDT", "USDC"].forEach(s => setPending(s, "Connect wallet to read balance"));
        return;
      }

      const chainId = String(await rpc("eth_chainId")).toLowerCase();
      window.nexusConnectedAddress = address;
      window.nexusConnectedChainId = chainId;

      const chain = CHAINS[chainId];
      window.__nexusOnchainNetwork = chain?.name || chainId;
      if (!chain) {
        window.__nexusOnchainVisibleBalances = {};
        setPending("ETH", "Unsupported EVM network");
        setPending("USDT", "Unsupported EVM network");
        setPending("USDC", "Unsupported EVM network");
        return;
      }

      const px = await prices();
      let total = 0;

      const nativeHex = await rpc("eth_getBalance", [address, "latest"]);
      const nativeAmount = format(nativeHex, 18);
      total += setRow(chain.native, nativeAmount, px[chain.native] || 0);

      for (const symbol of ["USDT", "USDC"]) {
        const config = chain.tokens[symbol];
        if (!config || /^0x0+$/.test(config[0])) {
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
      console.warn("NexusNova on-chain sync V3:", error);
      window.__nexusOnchainReadStatus = window.__nexusOnchainReadStatus || {};
      ["ETH","BNB","MATIC","USDT","USDC"].forEach(symbol => {
        if (!Object.prototype.hasOwnProperty.call(window.__nexusOnchainVisibleBalances || {}, symbol)) {
          window.__nexusOnchainReadStatus[symbol] = "error";
        }
      });
    } finally {
      try {
        if (typeof window.__nexusPrimaryWalletRenderer === "function") {
          window.__nexusPrimaryWalletRenderer();
        }
      } catch (_) {}
    }
  }

  window.refreshNexusOnchainWallet = refresh;

  function start() {
    refresh();
    setTimeout(refresh, 1200);
    setTimeout(refresh, 3000);
    setInterval(refresh, 10000);

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", () => setTimeout(refresh, 250));
      window.ethereum.on("chainChanged", () => setTimeout(refresh, 250));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
