/* NexusNova Live Market + Wallet Integrity V4
   CoinGecko market-cap data is primary. Binance 24h-volume markets are an
   honest fallback. A static catalog is used only with unavailable prices.
   Market search always filters the same authoritative rows currently rendered.
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
    ["RUNE","THORChain"],["QNT","Quant"],["FET","Artificial Superintelligence Alliance"],["ALGO","Algorand"],["VET","VeChain"],["POL","Polygon Ecosystem Token"],["CRO","Cronos"],["KAS","Kaspa"],["MNT","Mantle"],["OKB","OKB"],
    ["WIF","dogwifhat"],["BONK","Bonk"],["JUP","Jupiter"],["TIA","Celestia"],["PYTH","Pyth Network"],["ONDO","Ondo"],["ENA","Ethena"],["WLD","Worldcoin"],["GALA","Gala"],["SAND","The Sandbox"],
    ["MANA","Decentraland"],["AXS","Axie Infinity"],["THETA","Theta Network"],["EGLD","MultiversX"],["FLOW","Flow"],["KAVA","Kava"],["XTZ","Tezos"],["EOS","EOS"],["IOTA","IOTA"],["NEO","Neo"],
    ["CHZ","Chiliz"],["CRV","Curve DAO"],["COMP","Compound"],["SNX","Synthetix"],["1INCH","1inch"],["BAT","Basic Attention Token"],["ZEC","Zcash"],["DASH","Dash"],["XMR","Monero"],["KCS","KuCoin Token"],
    ["LUNC","Terra Classic"],["RPL","Rocket Pool"],["DYDX","dYdX"],["GMX","GMX"],["CAKE","PancakeSwap"],["KSM","Kusama"],["MINA","Mina"],["ROSE","Oasis"],["CFX","Conflux"],["AR","Arweave"],
    ["JASMY","JasmyCoin"],["ZIL","Zilliqa"],["ENS","Ethereum Name Service"],["LPT","Livepeer"],["BLUR","Blur"],["STRK","Starknet"],["NOT","Notcoin"],["JTO","Jito"],["PENDLE","Pendle"],["W","Wormhole"]
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

  window.nexusTop100FallbackCatalog = fallbackCatalog;

  function publish(rows, source) {
    cache = { at: Date.now(), coins: rows.slice(0, TOP_LIMIT), source };
    window.__nexusMarketCoins = cache.coins;
    window.__nexusMarketSource = source;
    return cache;
  }

  async function fetchTop100(force = false) {
    if (!force && cache.coins.length && Date.now() - cache.at < CACHE_MS) return cache;
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
          return publish(rows.slice(0, TOP_LIMIT).map((coin, index) => ({
            id: String(coin.id || coin.symbol || index),
            symbol: String(coin.symbol || "").toUpperCase(),
            name: String(coin.name || coin.symbol || "Coin"),
            current_price: num(coin.current_price),
            price_change_percentage_24h: num(coin.price_change_percentage_24h),
            market_cap_rank: num(coin.market_cap_rank) || index + 1,
            image: String(coin.image || "")
          })), "coingecko-market-cap");
        }
      } catch (error) {
        console.warn("NexusNova market CoinGecko source:", error);
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
        if (coins.length >= 50) return publish(coins, "binance-volume");
      } catch (error) {
        console.warn("NexusNova market Binance fallback:", error);
      }

      return publish(fallbackCatalog(), "catalog");
    })();

    try { return await pending; }
    finally { pending = null; }
  }

  function sourceText(source, count, filtered = false) {
    const n = Number(count || 0);
    if (filtered) return `${n} match${n === 1 ? "" : "es"}`;
    if (source === "coingecko-market-cap") return `${n} coins • Market-cap live`;
    if (source === "binance-volume") return `${n} liquid USDT markets • Live fallback`;
    return `${n} coins • prices reconnecting`;
  }

  function renderMarket(coins, source, filtered = false) {
    const list = document.getElementById("marketList");
    const count = document.getElementById("marketCount");
    if (!list) return;

    list.innerHTML = coins.map((coin, index) => {
      const change = num(coin.price_change_percentage_24h);
      const rank = source === "coingecko-market-cap"
        ? `#${num(coin.market_cap_rank) || index + 1}`
        : source === "binance-volume"
          ? `VOL #${index + 1}`
          : `#${index + 1}`;
      const changeText = num(coin.current_price) > 0
        ? `<div class="${change >= 0 ? "up" : "down"} coin-change">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</div>`
        : `<div class="coin-change" style="color:#64748b">24h unavailable</div>`;
      return `
        <div class="coin-row" data-top100-market="${esc(coin.symbol)}">
          <div class="coin-rank">${rank}</div>
          <div style="min-width:0;flex:1">
            <div class="coin-name">${esc(coin.name)}</div>
            <div class="coin-symbol">${esc(coin.symbol)}</div>
          </div>
          <div class="coin-price" style="text-align:right">
            ${priceText(coin.current_price)}
            ${changeText}
          </div>
        </div>`;
    }).join("") || '<div class="status">No matching coin found.</div>';

    if (count) count.textContent = sourceText(source, coins.length, filtered);
  }

  function currentBalance(symbol) {
    const values = window.__nexusOnchainVisibleBalances || {};
    return Object.prototype.hasOwnProperty.call(values, symbol) ? num(values[symbol]) : 0;
  }

  function renderWallet(coins, source) {
    const list = document.getElementById("walletAssetList");
    if (!list) return;
    let totalUsd = 0;
    list.innerHTML = coins.map(coin => {
      const symbol = String(coin.symbol || "").toUpperCase();
      const balance = currentBalance(symbol);
      const price = num(coin.current_price);
      totalUsd += balance * price;
      const icon = coin.image
        ? `<img src="${esc(coin.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
        : esc(symbol.slice(0, 1));
      return `
        <div class="coin-row" data-wallet-symbol="${esc(symbol)}" data-symbol="${esc(symbol)}">
          <div style="width:34px;height:34px;border-radius:50%;background:#182234;display:flex;align-items:center;justify-content:center;font-weight:800;color:#49a7ff;overflow:hidden;flex:0 0 34px">${icon}</div>
          <div style="flex:1;min-width:0;margin-left:9px"><div class="coin-name">${esc(coin.name)}</div><div class="coin-symbol">${esc(symbol)}</div></div>
          <div style="text-align:right;min-width:115px"><div class="coin-price wallet-live-price">${priceText(price)}</div><div style="font-size:10px;color:#64748b;margin-top:3px">${balance > 0 ? balance.toLocaleString(undefined,{maximumFractionDigits:6}) : "0"} ${esc(symbol)}</div></div>
        </div>`;
    }).join("");

    const total = document.getElementById("walletTotalUsd");
    if (total) total.textContent = "$ " + totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const status = document.getElementById("walletActionStatus");
    if (status && !document.getElementById("nexusWalletActionModal")) status.textContent = sourceText(source, coins.length);
  }

  function filterMarket() {
    const query = String(document.getElementById("cryptoSearch")?.value || "").toLowerCase().trim();
    const rows = cache.coins.length ? cache.coins : (window.__nexusMarketCoins || []);
    if (!query) {
      renderMarket(rows, cache.source || window.__nexusMarketSource || "catalog", false);
      return;
    }
    const filtered = rows.filter(coin =>
      String(coin.name || "").toLowerCase().includes(query) ||
      String(coin.symbol || "").toLowerCase().includes(query)
    );
    renderMarket(filtered, cache.source || window.__nexusMarketSource || "catalog", true);
  }

  async function refreshBoth(which, force = false) {
    if (which !== "wallet") {
      const marketList = document.getElementById("marketList");
      if (marketList) marketList.innerHTML = '<div class="status">Loading live crypto market...</div>';
    }
    if (which !== "market") {
      const walletList = document.getElementById("walletAssetList");
      if (walletList) walletList.innerHTML = '<div class="status">Loading crypto assets...</div>';
    }
    const result = await fetchTop100(force);
    const coins = result.coins.slice(0, TOP_LIMIT);
    if (which !== "wallet") renderMarket(coins, result.source, false);
    if (which !== "market") renderWallet(coins, result.source);
    return coins;
  }

  function installOverrides() {
    window.loadMarket = () => refreshBoth("market");
    window.refreshNexusMarket = () => refreshBoth("market", true);
    window.refreshWalletFoundation = () => refreshBoth("wallet");
    window.filterCryptoMarket = filterMarket;
  }

  installOverrides();
  window.__nexusTop100LiveFix = {
    refreshAll: force => refreshBoth("all", Boolean(force)),
    fetchTop100
  };
  window.nexusMarketIntegrityVersion = "live-v4";

  function fixBrandText() {
    document.querySelectorAll(".logo-title").forEach(el => {
      const text = (el.textContent || "").replace(/\s+/g, "");
      if (/^NexusNovaNova$/i.test(text)) el.innerHTML = 'Nexus<span>Nova</span>';
    });
  }

  function boot() {
    installOverrides();
    fixBrandText();
    const search = document.getElementById("cryptoSearch");
    if (search && !search.dataset.nxMarketV4) {
      search.dataset.nxMarketV4 = "1";
      search.addEventListener("input", filterMarket, true);
    }
    setTimeout(() => refreshBoth("all").catch(error => console.warn("NexusNova market boot:", error)), 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("load", installOverrides, { once: true });
})();
