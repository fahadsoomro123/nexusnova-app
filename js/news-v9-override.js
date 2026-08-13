/* NexusNova NEWS V9 override
   Direct publisher-page aggregation + balanced source mixing + guaranteed visuals.
   Web-only test build. Android mirror intentionally deferred until web is verified.
*/
(() => {
  "use strict";
  if (window.__nxPremiumNewsV9) return;
  window.__nxPremiumNewsV9 = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hasArabic = (v) => /[\u0600-\u06ff]/.test(String(v || ""));
  const normalize = (v) => String(v || "").normalize("NFKC").toLowerCase().replace(/[\u200c\u200d]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const safeUrl = (v, base = location.href) => {
    try {
      const u = new URL(String(v || ""), base);
      return /^(https?:)$/.test(u.protocol) ? u.href : "";
    } catch (_) { return ""; }
  };

  let language = localStorage.getItem("nx_news_language") === "en" ? "en" : "ur";
  let activeCategory = "ALL";
  let currentItems = [];
  let requestId = 0;

  const T = {
    ur: {
      heading: "پاکستان پریمیم نیوز روم",
      sub: "ARY Urdu • Express Urdu • SAMAA Urdu • Dunya • UrduPoint • KTN • Sindh TV • دیگر معتبر ذرائع",
      breaking: "بریکنگ نیوز", live: "لائیو", language: "خبروں کی زبان", refresh: "ریفریش",
      loading: "پاکستانی نیوز رومز سے تازہ خبریں اور تصاویر لوڈ ہو رہی ہیں…",
      offline: "خبریں عارضی طور پر دستیاب نہیں۔ دوبارہ ریفریش کریں۔",
      read: "مکمل خبر پڑھیں", tap: "مکمل خبر کھولیں",
      categories: {ALL:"تمام خبریں",PAKISTAN:"پاکستان",SINDH:"سندھ",SINDHI:"سنڌي",BUSINESS:"کاروبار",SPORTS:"کھیل",TECH:"ٹیکنالوجی",ENTERTAINMENT:"شوبز",WORLD:"دنیا"}
    },
    en: {
      heading: "Pakistan Premium Newsroom",
      sub: "Geo • ARY • SAMAA • Dunya • DAWN • Express Tribune • The News • Sindhi desk",
      breaking: "BREAKING NEWS", live: "LIVE", language: "News language", refresh: "Refresh",
      loading: "Loading fresh stories and images from Pakistani newsrooms…",
      offline: "Live news is temporarily unavailable. Refresh to retry.",
      read: "READ FULL STORY", tap: "Open full story",
      categories: {ALL:"All News",PAKISTAN:"Pakistan",SINDH:"Sindh",SINDHI:"Sindhi",BUSINESS:"Business",SPORTS:"Sports",TECH:"Tech",ENTERTAINMENT:"Entertainment",WORLD:"World"}
    }
  };

  const PAGE_SOURCES = {
    ur: [
      {name:"ARY Urdu", url:"https://urdu.arynews.tv/category/pakistan-2/", category:"PAKISTAN", lang:"ur"},
      {name:"Express News", url:"https://www.express.pk/", category:"PAKISTAN", lang:"ur"},
      {name:"SAMAA Urdu", url:"https://urdu.samaa.tv/latest-news", category:"PAKISTAN", lang:"ur"},
      {name:"Dunya News", url:"https://dunya.com.pk/index.php/tazatareen", category:"PAKISTAN", lang:"ur"},
      {name:"KTN News", url:"https://ktnnews.tv/category/sindh/", category:"SINDHI", lang:"sd"},
      {name:"Sindh TV News", url:"https://sindhtvnews.tv/", category:"SINDHI", lang:"sd"}
    ],
    en: [
      {name:"Geo News", url:"https://www.geo.tv/category/pakistan", category:"PAKISTAN", lang:"en"},
      {name:"ARY News", url:"https://arynews.tv/latest-news", category:"PAKISTAN", lang:"en"},
      {name:"SAMAA TV", url:"https://www.samaa.tv/", category:"PAKISTAN", lang:"en"},
      {name:"Dunya News", url:"https://www.dunyanews.tv/en/Pakistan", category:"PAKISTAN", lang:"en"},
      {name:"DAWN", url:"https://www.dawn.com/pakistan", category:"PAKISTAN", lang:"en"},
      {name:"The News", url:"https://www.thenews.com.pk/latest", category:"PAKISTAN", lang:"en"},
      {name:"KTN News", url:"https://ktnnews.tv/category/sindh/", category:"SINDHI", lang:"sd"},
      {name:"Sindh TV News", url:"https://sindhtvnews.tv/", category:"SINDHI", lang:"sd"}
    ]
  };

  const RSS_SOURCES = {
    ur: [
      {name:"UrduPoint", url:"https://www.urdupoint.com/rss/urdupoint-national.rss", category:"PAKISTAN", lang:"ur"},
      {name:"UrduPoint Business", url:"https://www.urdupoint.com/rss/urdupoint-business.rss", category:"BUSINESS", lang:"ur"},
      {name:"UrduPoint Sports", url:"https://www.urdupoint.com/rss/urdupoint-sports.rss", category:"SPORTS", lang:"ur"},
      {name:"UrduPoint Showbiz", url:"https://www.urdupoint.com/rss/urdupoint-showbiz.rss", category:"ENTERTAINMENT", lang:"ur"},
      {name:"UrduPoint World", url:"https://www.urdupoint.com/rss/urdupoint-int.rss", category:"WORLD", lang:"ur"},
      {name:"Express RSS", url:"https://www.express.pk/feed", category:"PAKISTAN", lang:"ur"}
    ],
    en: [
      {name:"Express Tribune", url:"https://tribune.com.pk/feed/pakistan", category:"PAKISTAN", lang:"en"}
    ]
  };

  function classify(title, fallback) {
    const t = String(title || "").toLowerCase();
    if (/karachi|sindh|hyderabad|sukkur|larkana|shikarpur|thar|کراچی|سندھ|حیدرآباد|سکھر|لاڑکانہ|شکارپور|سنڌ|ڪراچي|حيدرآباد|سکر/.test(t)) return "SINDH";
    if (/cricket|psl|football|hockey|match|t20|odi|کرکٹ|کھیل|فٹبال|ہاکی|میچ|ڪرڪيٽ|راند/.test(t)) return "SPORTS";
    if (/business|economy|rupee|dollar|gold|petrol|stock|imf|budget|کاروبار|معیشت|روپیہ|ڈالر|سونا|بجٹ|ڪاروبار|معيشت/.test(t)) return "BUSINESS";
    if (/technology|tech|software|mobile|internet|cyber|artificial intelligence|ٹیکنالوجی|موبائل|انٹرنیٹ|سائبر|ٽيڪنالاجي/.test(t)) return "TECH";
    if (/film|drama|showbiz|entertainment|actor|actress|فلم|ڈرامہ|شوبز|اداکار|اداڪاره/.test(t)) return "ENTERTAINMENT";
    return fallback;
  }

  function injectStyle() {
    if ($("nxNewsV9Style")) return;
    const s = document.createElement("style");
    s.id = "nxNewsV9Style";
    s.textContent = `
      #nxNewsRoot{background:linear-gradient(180deg,#081426,#06101d);border:1px solid rgba(56,189,248,.25);border-radius:18px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.38);overflow:hidden}
      #nxNewsRoot .nxv9-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:13px}
      #nxNewsRoot .nxv9-kicker{font-size:10px;letter-spacing:.18em;color:#38bdf8;font-weight:950}
      #nxNewsRoot .nxv9-heading{font-size:23px;line-height:1.16;font-weight:950;margin-top:5px;background:linear-gradient(90deg,#fff,#7dd3fc,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}
      #nxNewsRoot .nxv9-sub{font-size:11px;color:#94a3b8;margin-top:7px;line-height:1.55}
      #nxNewsRoot .nxv9-live{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(239,68,68,.36);background:rgba(127,29,29,.22);border-radius:999px;color:#fecaca;font-size:10px;font-weight:950;white-space:nowrap}
      #nxNewsRoot .nxv9-live i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 14px #ef4444}
      #nxNewsRoot .nxv9-breaking{display:grid;grid-template-columns:auto 1fr;min-height:42px;border:1px solid rgba(239,68,68,.36);border-radius:11px;overflow:hidden;background:#070d17;margin-bottom:10px}
      #nxNewsRoot .nxv9-breaking-label{display:flex;align-items:center;padding:0 13px;background:linear-gradient(135deg,#ef233c,#b90432);font-size:10px;font-weight:950;color:#fff;white-space:nowrap}
      #nxNewsRoot .nxv9-window{display:flex;align-items:center;overflow:hidden}
      #nxNewsRoot .nxv9-track{display:inline-flex;min-width:max-content;white-space:nowrap;animation:nxV9Ticker 52s linear infinite}
      #nxNewsRoot .nxv9-track span{padding:0 26px 0 12px;color:#e2e8f0;font-size:11px}#nxNewsRoot .nxv9-track b{color:#38bdf8;margin-right:7px}
      @keyframes nxV9Ticker{from{transform:translateX(8%)}to{transform:translateX(-100%)}}
      #nxNewsRoot .nxv9-controls{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 10px;border:1px solid rgba(56,189,248,.16);background:rgba(8,15,28,.84);border-radius:12px;margin-bottom:10px}
      #nxNewsRoot .nxv9-label{font-size:10px;color:#94a3b8;font-weight:850}#nxNewsRoot .nxv9-langwrap{display:flex;gap:6px}
      #nxNewsRoot .nxv9-btn,#nxNewsRoot .nxv9-chip{border:1px solid rgba(148,163,184,.24);background:#111827;color:#cbd5e1;font-weight:900}
      #nxNewsRoot .nxv9-btn{border-radius:9px;padding:7px 12px;font-size:11px}#nxNewsRoot .nxv9-btn.active,#nxNewsRoot .nxv9-chip.active{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent;color:#fff}
      #nxNewsRoot .nxv9-filters,#nxNewsRoot .nxv9-sources{display:flex;gap:7px;overflow:auto;scrollbar-width:none}#nxNewsRoot .nxv9-filters{padding:1px 0 10px}#nxNewsRoot .nxv9-sources{padding:0 0 12px}
      #nxNewsRoot .nxv9-chip{border-radius:999px;padding:7px 11px;font-size:10px;white-space:nowrap}
      #nxNewsRoot .nxv9-source{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(148,163,184,.15);background:rgba(15,23,42,.72);border-radius:999px;padding:6px 9px;color:#cbd5e1;font-size:9px;font-weight:850;white-space:nowrap}
      #nxNewsRoot .nxv9-source i{width:6px;height:6px;border-radius:50%;background:#38bdf8}
      #nxNewsRoot .nxv9-feature{position:relative;min-height:330px;border-radius:17px;overflow:hidden;border:1px solid rgba(255,255,255,.1);margin-bottom:14px;background:#0f172a;cursor:pointer;isolation:isolate}
      #nxNewsRoot .nxv9-feature:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,7,17,.03) 18%,rgba(2,8,20,.55) 56%,rgba(2,8,20,.98));z-index:1}
      #nxNewsRoot .nxv9-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0b1220}
      #nxNewsRoot .nxv9-copy{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:23px}
      #nxNewsRoot .nxv9-badges{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:9px}
      #nxNewsRoot .nxv9-breaking-badge{background:linear-gradient(135deg,#ef233c,#b90432);color:#fff;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:950}
      #nxNewsRoot .nxv9-sourcebadge,#nxNewsRoot .nxv9-cat{padding:5px 8px;border-radius:6px;font-size:9px;font-weight:950}.nxv9-sourcebadge{background:rgba(255,255,255,.09);color:#fff;border:1px solid rgba(255,255,255,.12)}#nxNewsRoot .nxv9-cat{background:rgba(14,165,233,.17);border:1px solid rgba(56,189,248,.32);color:#7dd3fc}
      #nxNewsRoot .nxv9-title{font-size:22px;line-height:1.26;font-weight:950;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.5)}
      #nxNewsRoot .nxv9-meta{display:flex;gap:7px;flex-wrap:wrap;color:#cbd5e1;font-size:10px;margin-top:10px}
      #nxNewsRoot .nxv9-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #nxNewsRoot .nxv9-card{overflow:hidden;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,14,25,.99));box-shadow:0 14px 32px rgba(0,0,0,.24);cursor:pointer}
      #nxNewsRoot .nxv9-media{position:relative;height:190px;background:#0b1220;overflow:hidden}#nxNewsRoot .nxv9-media .nxv9-img{position:absolute}
      #nxNewsRoot .nxv9-body{padding:13px}#nxNewsRoot .nxv9-cardtitle{font-size:14px;line-height:1.45;font-weight:900;color:#f8fafc}#nxNewsRoot .nxv9-snippet{font-size:11px;line-height:1.55;color:#94a3b8;margin-top:7px}
      #nxNewsRoot .nxv9-read{display:flex;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,163,184,.11);color:#38bdf8;font-size:10px;font-weight:950}
      #nxNewsRoot .nxv9-empty,#nxNewsRoot .nxv9-loading{padding:28px 15px;text-align:center;color:#94a3b8;border:1px dashed rgba(148,163,184,.2);border-radius:14px}
      #tab-news.nx-news-urdu .nxv9-heading,#tab-news.nx-news-urdu .nxv9-sub,#tab-news.nx-news-urdu .nxv9-title,#tab-news.nx-news-urdu .nxv9-cardtitle,#tab-news.nx-news-urdu .nxv9-snippet{direction:rtl;text-align:right;font-family:"Noto Nastaliq Urdu","Noto Sans Arabic","Segoe UI",Arial,sans-serif}
      @media(max-width:680px){#nxNewsRoot .nxv9-grid{grid-template-columns:1fr}#nxNewsRoot .nxv9-feature{min-height:300px}#nxNewsRoot .nxv9-title{font-size:19px}#nxNewsRoot .nxv9-media{height:205px}#nxNewsRoot .nxv9-heading{font-size:21px}#nxNewsRoot .nxv9-controls{align-items:flex-start;flex-wrap:wrap}}
    `;
    document.head.appendChild(s);
  }

  function fallbackSvg(item) {
    const label = String(item.source || "NexusNova").slice(0, 24);
    const cat = String(item.category || "NEWS").slice(0, 18);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset=".5" stop-color="#123052"/><stop offset="1" stop-color="#1d1640"/></linearGradient><radialGradient id="r"><stop stop-color="#38bdf8" stop-opacity=".38"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="210" cy="150" r="260" fill="url(#r)"/><circle cx="1000" cy="120" r="230" fill="url(#r)" opacity=".45"/><text x="70" y="330" fill="#fff" font-size="72" font-family="Arial" font-weight="700">${label.replace(/[&<>]/g,"")}</text><text x="72" y="395" fill="#7dd3fc" font-size="30" font-family="Arial" font-weight="700">${cat.replace(/[&<>]/g,"")} • NEXUSNOVA NEWS</text><rect x="70" y="445" width="220" height="54" rx="12" fill="#d90429"/><text x="92" y="482" fill="#fff" font-size="25" font-family="Arial" font-weight="700">BREAKING</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function imageProxy(url) {
    const u = safeUrl(url);
    if (!u) return "";
    return "https://images.weserv.nl/?url=" + encodeURIComponent(u) + "&w=1200&h=675&fit=cover&output=webp";
  }

  function ensureUI() {
    const tab = $("tab-news");
    if (!tab) return null;
    injectStyle();
    tab.classList.toggle("nx-news-urdu", language === "ur");
    let root = $("nxNewsRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "nxNewsRoot";
      tab.appendChild(root);
    }
    root.innerHTML = `
      <div class="nxv9-top"><div><div class="nxv9-kicker">NEXUSNOVA NEWSROOM V9</div><div id="nxv9Heading" class="nxv9-heading"></div><div id="nxv9Sub" class="nxv9-sub"></div></div><div id="nxv9Live" class="nxv9-live"><i></i></div></div>
      <div class="nxv9-breaking"><div id="nxv9BreakingLabel" class="nxv9-breaking-label"></div><div class="nxv9-window"><div id="nxv9Track" class="nxv9-track"></div></div></div>
      <div class="nxv9-controls"><div><div id="nxv9LangLabel" class="nxv9-label"></div><div class="nxv9-langwrap"><button class="nxv9-btn" data-v9-lang="ur">اردو</button><button class="nxv9-btn" data-v9-lang="en">English</button></div></div><button id="nxv9Refresh" class="nxv9-btn"></button></div>
      <div id="nxv9Filters" class="nxv9-filters"></div><div id="nxv9Sources" class="nxv9-sources"></div><div id="newsList"></div>`;
    root.querySelectorAll("[data-v9-lang]").forEach(btn => btn.addEventListener("click", () => {
      const next = btn.dataset.v9Lang === "en" ? "en" : "ur";
      if (next === language) return;
      language = next; activeCategory = "ALL"; localStorage.setItem("nx_news_language", language); renderShell(); window.loadNews();
    }));
    $("nxv9Refresh")?.addEventListener("click", () => window.loadNews(true));
    renderShell();
    return root;
  }

  function renderShell() {
    const t = T[language];
    const tab = $("tab-news");
    tab?.classList.toggle("nx-news-urdu", language === "ur");
    if ($("nxv9Heading")) $("nxv9Heading").textContent = t.heading;
    if ($("nxv9Sub")) $("nxv9Sub").textContent = t.sub;
    if ($("nxv9Live")) $("nxv9Live").innerHTML = `<i></i>${t.live}`;
    if ($("nxv9BreakingLabel")) $("nxv9BreakingLabel").textContent = t.breaking;
    if ($("nxv9LangLabel")) $("nxv9LangLabel").textContent = t.language;
    if ($("nxv9Refresh")) $("nxv9Refresh").textContent = "↻ " + t.refresh;
    document.querySelectorAll("#nxNewsRoot [data-v9-lang]").forEach(b => b.classList.toggle("active", b.dataset.v9Lang === language));
    const counts = currentItems.reduce((a,x) => { a.ALL=(a.ALL||0)+1; a[x.category]=(a[x.category]||0)+1; return a; }, {});
    const f = $("nxv9Filters");
    if (f) {
      f.innerHTML = "";
      Object.entries(t.categories).forEach(([cat,label]) => {
        const b = document.createElement("button"); b.className = "nxv9-chip" + (cat === activeCategory ? " active" : ""); b.textContent = `${label}${counts[cat] ? ` ${counts[cat]}` : ""}`;
        b.addEventListener("click", () => { activeCategory = cat; renderShell(); renderCards(); }); f.appendChild(b);
      });
    }
    const rail = $("nxv9Sources");
    if (rail) {
      const sources = [...new Set(currentItems.map(x => x.source).filter(Boolean))];
      rail.innerHTML = sources.map(s => `<span class="nxv9-source"><i></i>${esc(s)}</span>`).join("");
    }
  }

  async function fetchText(url, timeout=11000) {
    const c = new AbortController(); const timer = setTimeout(() => c.abort(), timeout);
    try { const r = await fetch(url, {cache:"no-store", signal:c.signal}); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
    finally { clearTimeout(timer); }
  }

  function pickImg(node, base) {
    const img = node?.querySelector?.("img");
    if (!img) return "";
    let raw = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || img.getAttribute("src") || "";
    if (!raw) {
      const set = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      raw = set.split(",").pop()?.trim().split(/\s+/)[0] || "";
    }
    return safeUrl(raw, base);
  }

  function parsePublisherPage(html, source) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = source.url;
    const out = [], seen = new Set();
    const anchors = [...doc.querySelectorAll("article a[href], h1 a[href], h2 a[href], h3 a[href], h4 a[href], .post a[href], .news a[href], .story a[href]")];
    for (const a of anchors) {
      let title = (a.getAttribute("title") || a.textContent || "").replace(/\s+/g," ").trim();
      if (title.length < 18) continue;
      const url = safeUrl(a.getAttribute("href"), base);
      if (!url || /\/(category|tag|author)\//i.test(url)) continue;
      const key = normalize(title); if (!key || seen.has(key)) continue; seen.add(key);
      const box = a.closest("article,li,.post,.news,.story,.item,.row,div") || a.parentElement || doc.body;
      const image = pickImg(box, base) || pickImg(a.parentElement, base);
      const p = box.querySelector?.("p");
      const desc = String(p?.textContent || "").replace(/\s+/g," ").trim().slice(0,260);
      const time = box.querySelector?.("time");
      const date = time?.getAttribute("datetime") || time?.textContent || "";
      out.push({title,url,date,source:source.name,image,description:desc,category:source.category,lang:source.lang});
      if (out.length >= 8) break;
    }
    return out;
  }

  async function loadPublisher(source) {
    try {
      const html = await fetchText("https://api.allorigins.win/raw?url=" + encodeURIComponent(source.url), 12000);
      return parsePublisherPage(html, source);
    } catch (e) { console.warn("News V9 page source failed", source.name, e); return []; }
  }

  async function loadRss(source) {
    try {
      const endpoint = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(source.url);
      const c = new AbortController(); const timer = setTimeout(() => c.abort(), 12000);
      let data;
      try { const r = await fetch(endpoint,{cache:"no-store",signal:c.signal}); if(!r.ok)throw new Error(`HTTP ${r.status}`); data = await r.json(); }
      finally { clearTimeout(timer); }
      if (data?.status && data.status !== "ok") throw new Error(data.message || "RSS error");
      return (Array.isArray(data.items) ? data.items : []).slice(0,8).map(a => {
        const html = a.content || a.description || "";
        const d = new DOMParser().parseFromString(String(html),"text/html");
        const rawImg = a.thumbnail || a.enclosure?.link || a.enclosure?.url || d.querySelector("img")?.getAttribute("src") || "";
        return {title:String(a.title||"").trim(),url:safeUrl(a.link||a.url||""),date:a.pubDate||"",source:source.name,image:safeUrl(rawImg),description:String(d.body?.textContent||"").replace(/\s+/g," ").trim().slice(0,260),category:source.category,lang:source.lang};
      });
    } catch (e) { console.warn("News V9 RSS source failed", source.name, e); return []; }
  }

  async function articleImage(item) {
    if (item.image || !item.url) return item;
    try {
      const html = await fetchText("https://api.allorigins.win/raw?url=" + encodeURIComponent(item.url), 7000);
      const doc = new DOMParser().parseFromString(html,"text/html");
      const raw = doc.querySelector('meta[property="og:image"]')?.content || doc.querySelector('meta[name="twitter:image"]')?.content || doc.querySelector('article img')?.getAttribute("src") || doc.querySelector('main img')?.getAttribute("src") || "";
      item.image = safeUrl(raw, item.url);
    } catch (_) {}
    return item;
  }

  function balanced(groups) {
    const map = new Map();
    groups.flat().forEach(item => {
      if (!item?.title) return;
      if (language === "ur" && item.lang === "en") return;
      if (language === "en" && item.lang !== "en" && item.category !== "SINDHI") return;
      item.category = item.category === "SINDHI" ? "SINDHI" : classify(item.title, item.category || "PAKISTAN");
      const arr = map.get(item.source) || []; if (arr.length < 7) arr.push(item); map.set(item.source, arr);
    });
    const out = [], keys = [...map.keys()];
    for (let round=0; round<7; round++) for (const key of keys) if (map.get(key)?.[round]) out.push(map.get(key)[round]);
    const seen = new Set();
    return out.filter(item => { const key = normalize(item.title); if (!key || seen.has(key)) return false; seen.add(key); return true; }).slice(0,90);
  }

  async function enrichImages(items) {
    const targets = items.filter(x => !x.image && x.url).slice(0,18);
    let cursor = 0;
    async function worker(){ while(cursor < targets.length){ const item = targets[cursor++]; await articleImage(item); } }
    await Promise.all([worker(),worker(),worker(),worker()]);
    for (const item of items) if (!item.image) item.image = fallbackSvg(item);
    return items;
  }

  function storyImage(item) { return safeUrl(item.image) || fallbackSvg(item); }

  function wireImages() {
    document.querySelectorAll("#nxNewsRoot img[data-real-src]").forEach(img => {
      img.addEventListener("error", () => {
        if (img.dataset.proxyTried !== "1" && img.dataset.realSrc && !img.dataset.realSrc.startsWith("data:")) {
          img.dataset.proxyTried = "1"; img.src = imageProxy(img.dataset.realSrc); return;
        }
        img.src = img.dataset.fallback || "";
      }, {once:false});
    });
  }

  function renderTicker() {
    const t = $("nxv9Track"); if (!t) return;
    t.innerHTML = currentItems.slice(0,18).map(x => `<span><b>${esc(x.source)}</b>${esc(x.title)}</span>`).join("") || `<span>${esc(T[language].loading)}</span>`;
  }

  function renderCards() {
    const list = $("newsList"); if (!list) return;
    const t = T[language];
    const clean = activeCategory === "ALL" ? currentItems : currentItems.filter(x => x.category === activeCategory);
    if (!clean.length) { list.innerHTML = `<div class="nxv9-empty" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.offline)}</div>`; return; }
    const lead = clean[0], rest = clean.slice(1,31);
    const imgTag = (item, cls) => { const real = storyImage(item), fb = fallbackSvg(item); return `<img class="nxv9-img ${cls}" src="${esc(real)}" data-real-src="${esc(real)}" data-fallback="${esc(fb)}" alt="" loading="lazy">`; };
    list.innerHTML = `<article class="nxv9-feature" data-v9-i="0">${imgTag(lead,"")}<div class="nxv9-copy"><div class="nxv9-badges"><span class="nxv9-breaking-badge">● ${esc(t.breaking)}</span><span class="nxv9-sourcebadge">${esc(lead.source)}</span><span class="nxv9-cat">${esc(t.categories[lead.category] || lead.category)}</span></div><div class="nxv9-title">${esc(lead.title)}</div><div class="nxv9-meta"><b>${esc(lead.source)}</b><span>•</span><span>${esc(t.tap)}</span></div></div></article><div class="nxv9-grid">${rest.map((item,i)=>`<article class="nxv9-card" data-v9-i="${i+1}"><div class="nxv9-media">${imgTag(item,"")}</div><div class="nxv9-body"><div class="nxv9-badges"><span class="nxv9-breaking-badge">● ${esc(t.breaking)}</span><span class="nxv9-sourcebadge">${esc(item.source)}</span><span class="nxv9-cat">${esc(t.categories[item.category] || item.category)}</span></div><div class="nxv9-cardtitle">${esc(item.title)}</div>${item.description?`<div class="nxv9-snippet">${esc(item.description)}</div>`:""}<div class="nxv9-read"><span>${esc(t.read)}</span><span>→</span></div></div></article>`).join("")}</div>`;
    list.querySelectorAll("[data-v9-i]").forEach(card => card.addEventListener("click", () => { const item = clean[Number(card.dataset.v9I)||0]; const u = safeUrl(item?.url); if (u) window.open(u,"_blank","noopener,noreferrer"); }));
    wireImages();
  }

  async function gather() {
    const pages = PAGE_SOURCES[language] || [];
    const rss = RSS_SOURCES[language] || [];
    const groups = await Promise.all([...pages.map(loadPublisher), ...rss.map(loadRss)]);
    const mixed = balanced(groups);
    await enrichImages(mixed);
    return mixed;
  }

  window.loadNews = async function() {
    ensureUI();
    const list = $("newsList"); if (!list) return;
    const id = ++requestId;
    list.innerHTML = `<div class="nxv9-loading" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(T[language].loading)}</div>`;
    try {
      const items = await gather();
      if (id !== requestId) return;
      currentItems = items;
      renderShell(); renderTicker(); renderCards();
    } catch (e) {
      console.warn("NexusNova News V9", e);
      if (id !== requestId) return;
      currentItems = []; renderShell();
      list.innerHTML = `<div class="nxv9-empty">${esc(T[language].offline)}</div>`;
    }
  };

  ensureUI();
  setTimeout(() => window.loadNews(), 50);
})();