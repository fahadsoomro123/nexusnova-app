// NexusNova - Ticker FIX V1
(() => {
  const el = document.getElementById("ticker");
  if (!el) return;

  const coins = [
    ["BTCUSDT", "BTC"],
    ["ETHUSDT", "ETH"],
    ["BNBUSDT", "BNB"],
    ["SOLUSDT", "SOL"],
    ["XRPUSDT", "XRP"],
    ["ADAUSDT", "ADA"],
    ["DOGEUSDT", "DOGE"],
    ["TRXUSDT", "TRX"],
    ["AVAXUSDT", "AVAX"],
    ["LINKUSDT", "LINK"],
    ["DOTUSDT", "DOT"],
    ["LTCUSDT", "LTC"],
    ["BCHUSDT", "BCH"],
    ["TONUSDT", "TON"]
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  async function loadTicker() {
    try {
      const symbols = encodeURIComponent(JSON.stringify(coins.map(x => x[0])));
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Ticker HTTP " + res.status);

      const data = await res.json();
      const bySymbol = Object.fromEntries(data.map(x => [x.symbol, x]));

      const html = coins.map(([symbol, name]) => {
        const x = bySymbol[symbol];
        if (!x) return "";
        const price = Number(x.lastPrice);
        const pct = Number(x.priceChangePercent);
        const cls = pct >= 0 ? "up" : "down";
        return `<span class="ticker-item">
          <b>${esc(name)}</b> $${price >= 1 ? price.toLocaleString(undefined,{maximumFractionDigits:2}) : price.toFixed(4)}
          <span class="${cls}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span>
        </span>`;
      }).filter(Boolean).join("");

      if (html) {
        el.innerHTML = html + html;
        el.style.display = "flex";
      } else {
        el.innerHTML = `<span class="ticker-item">Market data unavailable — tap refresh</span>`;
      }
    } catch (err) {
      console.error("NexusNova ticker:", err);
      el.innerHTML = `<span class="ticker-item">Live ticker temporarily unavailable</span>`;
    }
  }

  loadTicker();
  setInterval(loadTicker, 30000);
})();
