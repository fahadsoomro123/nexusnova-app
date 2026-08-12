/* NexusNova Top-100 Live Market + Wallet Fix V3
   Targeted compatibility layer for environments where the Firebase module
   fails before the main market/wallet functions are registered.
*/
(function () {
  "use strict";

  const TOP_LIMIT = 100;
  const CACHE_MS = 90 * 1000;
  let cache = { at: 0, coins: [], source: "" };
  let pending = null;

  const FALLBACK_COINS = [
    ["BTC","Bitcoin"],["ETH","Ethereum"],["USDT","Tether"],["BNB","BNB"],["SOL","Solana"],["USDC","USD Coin"],["XRP","XRP"],["DOGE","Dogecoin"],["ADA","Cardano"],["TRX","TRON"],
    ["AVAX","Avalanche"],["SHIB","Shiba Inu"],["TON","Toncoin"],["LINK","Chainlink"],["DOT","Polkadot"],["BCH","Bitcoin Cash"],["SUI","Sui"],["LTC","Litecoin"],["HBAR","Hedera"],["XLM","Stellar"],
    ["UNI","Uniswap"],["PEPE","Pepe"],["NEAR","NEAR Protocol"],["APT","Aptos"],["ICP","Internet Computer"],["ETC","Ethereum Classic"],["AAVE","Aave"],["FIL","Filecoin"],["ATOM","Cosmos"],["ARB","Arbitrum"],
    ["OP","Optimism"],["INJ","Injective"],["RENDER","Render"],["TAO","Bittensor"],["SEI","Sei"],["STX","Stacks"],["IMX","Immutable"],["MKR","Maker"],["LDO","Lido DAO"],["GRT","The Graph"],
    ["RUNE","THORChain"],["QNT","Quant"],["FET","Artificial Superintelligence Alliance"],["ALGO","Algorand"],["VET","VeChain"],["MATIC","Polygon"],["POL","Polygon Ecosystem Token"],["CRO","Cronos"],["KAS","Kaspa"],["MNT","Mantle"],
    ["OKB","OKB"],["WIF","dogwifhat"],["BONK","Bonk"],["JUP","Jupiter"],["TIA","Celestia"],["PYTH","Pyth Network"],["ONDO","Ondo"],["ENA","Ethena"],["WLD","Worldcoin"],["GALA","Gala"],
    ["SAND","The Sandbox"],["MANA","Decentraland"],["AXS","Axie Infinity"],["THETA","Theta Network"],["EGLD","MultiversX"],["FLOW","Flow"],["KAVA","Kava"],["XTZ","Tezos"],["EOS","EOS"],["IOTA","IOTA"],
    ["NEO","Neo"],["CHZ","Chiliz"],["CRV","Curve DAO"],["COMP","Compound"],["SNX","Synthetix"],["1INCH","1inch"],["BAT","Basic Attention Token"],["ZEC","Zcash"],["DASH","Dash"],["XMR","Monero"],
    ["KCS","KuCoin Token"],["LUNC","Terra Classic"],["RPL","Rocket Pool"],["DYDX","dYdX"],["GMX","GMX"],["CAKE","PancakeSwap"],["FTM","Fantom"],["KSM","Kusama"],["MINA","Mina"],["ROSE","Oasis"],
    ["CFX","Conflux"],["AR","Arweave"],["JASMY","JasmyCoin"],["ZIL","Zilliqa"],["ENS","Ethereum Name Service"],["LPT","Livepeer"],["BLUR","Blur"],["STRK","Starknet"],["NOT","Notcoin"],["JTO","Jito"]
  ].slice(0, TOP_LIMIT);

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function priceText(price) {
    price = num(price);
    if (price <= 0) return "Price unavailable";
    return "$" + price.toLocaleString(undefined, {
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 8 : 2
    });
  }

  async function fetchJSON(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 9000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function fallbackCatalog() {
    return FALLBACK_COINS.map((entry, index) => ({
      id: entry[0].toLowerCase(),
      symbol: entry[0],
      name: entry[1],
      current_price: 0,
      price_change_percentage_24h: 0,
      market_cap_rank: index + 1,
      image: ""
    }));
  }

  async function fetchTop100() {
    if (cache.coins.length >= TOP_LIMIT && Date.now() - cache.at < CACHE_MS) {
      return cache;
    }
    if (pending) return pending;

    pending = (async function () {
      try {
        const rows = await fetchJSON(
          "https://api.coingecko.com/api/v3/coins/markets" +
          "?vs_currency=usd&order=market_cap_desc&per_page=100&page=1" +
          "&sparkline=false&price_change_percentage=24h",
          9000
        );
        if (Array.isArray(rows) && rows.length >= 80) {
          const coins = rows.slice(0, TOP_LIMIT).map((coin, index) => ({
            id: String(coin.id || coin.symbol || index),
            symbol: String(coin.symbol || "").toUpperCase(),
            name: String(coin.name || coin.symbol || "Coin"),
            current_price: num(coin.current_price),
            price_change_percentage_24h: num(coin.price_change_percentage_24h),
            market_cap_rank: num(coin.market_cap_rank) || index + 1,
            image: String(coin.image || "")
          }));
          cache = { at: Date.now(), coins: coins, source: "CoinGecko market cap" };
          return cache;
        }
      } catch (error) {
        console.warn("NexusNova top-100 CoinGecko source:", error);
      }

      try {
        const rows = await fetchJSON("https://api.binance.com/api/v3/ticker/24hr", 9000);
        const stableBases = new Set(["USDT","USDC","FDUSD","TUSD","USDP","DAI","EUR","TRY","BRL","BIDR","IDRT"]);
        const nameMap = new Map(FALLBACK_COINS.map(x => [x[0], x[1]]));
        const seen = new Set();
        const coins = (Array.isArray(rows) ? rows : [])
          .filter(row => {
            const pair = String(row.symbol || "").toUpperCase();
            if (!pair.endsWith("USDT")) return false;
            const base = pair.slice(0, -4);
            if (!base || stableBases.has(base)) return false;
            if (/(UP|DOWN|BULL|BEAR)$/.test(base)) return false;
            if (seen.has(base)) return false;
            seen.add(base);
            return true;
          })
          .sort((a, b) => num(b.quoteVolume) - num(a.quoteVolume))
          .slice(0, TOP_LIMIT)
          .map((row, index) => {
            const base = String(row.symbol || "").toUpperCase().slice(0, -4);
            return {
              id: base.toLowerCase(),
              symbol: base,
              name: nameMap.get(base) || base,
              current_price: num(row.lastPrice),
              price_change_percentage_24h: num(row.priceChangePercent),
              market_cap_rank: index + 1,
              image: ""
            };
          });

        if (coins.length >= 80) {
          while (coins.length < TOP_LIMIT) {
            const extra = fallbackCatalog().find(c => !coins.some(x => x.symbol === c.symbol));
            if (!extra) break;
            extra.market_cap_rank = coins.length + 1;
            coins.push(extra);
          }
          cache = { at: Date.now(), coins: coins.slice(0, TOP_LIMIT), source: "Binance 24h volume" };
          return cache;
        }
      } catch (error) {
        console.warn("NexusNova top-100 Binance source:", error);
      }

      const coins = fallbackCatalog();
      cache = { at: Date.now(), coins: coins, source: "catalog" };
      return cache;
    })();

    try {
      return await pending;
    } finally {
      pending = null;
    }
  }

  function renderMarket(coins, source) {
    const list = document.getElementById("marketList");
    const count = document.getElementById("marketCount");
    if (!list) return;

    list.innerHTML = coins.slice(0, TOP_LIMIT).map((coin, index) => {
      const change = num(coin.price_change_percentage_24h);
      return `
        <div class="coin-row" data-top100-market="${esc(coin.symbol)}">
          <div class="coin-rank">#${index + 1}</div>
          <div style="min-width:0;flex:1">
            <div class="coin-name">${esc(coin.name)}</div>
            <div class="coin-symbol">${esc(coin.symbol)}</div>
          </div>
          <div class="coin-price" style="text-align:right">
            ${priceText(coin.current_price)}
            <div class="${change >= 0 ? "up" : "down"} coin-change">
              ${change >= 0 ? "+" : ""}${change.toFixed(2)}%
            </div>
          </div>
        </div>`;
    }).join("");

    if (count) {
      count.textContent = source === "catalog"
        ? "100 coins • live prices reconnecting"
        : "Top 100 coins • Live";
    }
  }

  function currentBalance(symbol) {
    const cache = window.__nexusOnchainVisibleBalances || {};
    if (Object.prototype.hasOwnProperty.call(cache, symbol)) return num(cache[symbol]);
    return 0;
  }

  function renderWallet(coins, source) {
    const list = document.getElementById("walletAssetList");
    if (!list) return;

    let totalUsd = 0;
    list.innerHTML = coins.slice(0, TOP_LIMIT).map((coin) => {
      const symbol = String(coin.symbol || "").toUpperCase();
      const balance = currentBalance(symbol);
      const price = num(coin.current_price);
      const value = balance * price;
      totalUsd += value;
      const icon = coin.image
        ? `<img src="${esc(coin.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
        : esc(symbol.slice(0, 1));

      return `
        <div class="coin-row" data-wallet-symbol="${esc(symbol)}" data-symbol="${esc(symbol)}">
          <div style="width:34px;height:34px;border-radius:50%;background:#182234;display:flex;align-items:center;justify-content:center;font-weight:800;color:#49a7ff;overflow:hidden;flex:0 0 34px">
            ${icon}
          </div>
          <div style="flex:1;min-width:0;margin-left:9px">
            <div class="coin-name">${esc(coin.name)}</div>
            <div class="coin-symbol">${esc(symbol)}</div>
          </div>
          <div style="text-align:right;min-width:115px">
            <div class="coin-price wallet-live-price">${priceText(price)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:3px">${balance > 0 ? balance.toLocaleString(undefined,{maximumFractionDigits:6}) : "0"} ${esc(symbol)}</div>
          </div>
        </div>`;
    }).join("");

    const total = document.getElementById("walletTotalUsd");
    if (total) {
      total.textContent = "$ " + totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const status = document.getElementById("walletActionStatus");
    if (status) {
      status.textContent = source === "catalog"
        ? "100 crypto assets loaded • reconnecting live prices"
        : "Top 100 crypto assets loaded • Live prices";
    }
  }

  async function refreshBoth(which) {
    if (which !== "wallet") {
      const marketList = document.getElementById("marketList");
      if (marketList) marketList.innerHTML = '<div class="status">Loading top 100 crypto market...</div>';
    }
    if (which !== "market") {
      const walletList = document.getElementById("walletAssetList");
      if (walletList) walletList.innerHTML = '<div class="status">Loading top 100 crypto assets...</div>';
    }

    const result = await fetchTop100();
    const coins = result.coins.slice(0, TOP_LIMIT);
    if (which !== "wallet") renderMarket(coins, result.source);
    if (which !== "market") renderWallet(coins, result.source);
    return coins;
  }

  window.loadMarket = function () {
    return refreshBoth("market");
  };

  window.refreshWalletFoundation = function () {
    return refreshBoth("wallet");
  };

  window.__nexusTop100LiveFix = {
    refreshAll: function () { return refreshBoth("all"); },
    fetchTop100: fetchTop100
  };

  function fixBrandText() {
    document.querySelectorAll(".logo-title").forEach(function (el) {
      const text = (el.textContent || "").replace(/\s+/g, "");
      if (/^NexusNovaNova$/i.test(text)) {
        el.innerHTML = 'Nexus<span>Nova</span>';
      }
    });
  }

  function boot() {
    fixBrandText();
    setTimeout(function () {
      refreshBoth("all").catch(function (error) {
        console.warn("NexusNova top-100 boot:", error);
      });
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
