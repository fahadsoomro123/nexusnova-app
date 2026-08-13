/* NexusNova NEWS FIX V3
   Pakistan-first premium live news desk with images, breaking strip, ticker,
   multiple Pakistani publishers, category accents and resilient fallbacks.
*/
(() => {
  "use strict";
  if (window.__nxPremiumNewsV3) return;
  window.__nxPremiumNewsV3 = true;

  let requestNo = 0;
  let currentItems = [];
  let activeCategory = "ALL";

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
  const safeHttpUrl = value => {
    try {
      const u = new URL(String(value || ""));
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
    } catch (_) { return ""; }
  };
  const setStatus = text => { const el = $("newsStatus"); if (el) el.textContent = text; };

  const PAK_DOMAINS = [
    "dawn.com","geo.tv","arynews.tv","tribune.com.pk","thenews.com.pk",
    "samaa.tv","express.pk","nation.com.pk","pakistantoday.com.pk","brecorder.com"
  ];

  const SOURCE_LABELS = {
    "dawn.com":"DAWN","geo.tv":"Geo News","arynews.tv":"ARY News",
    "tribune.com.pk":"Express Tribune","thenews.com.pk":"The News",
    "samaa.tv":"SAMAA","express.pk":"Express News","nation.com.pk":"The Nation",
    "pakistantoday.com.pk":"Pakistan Today","brecorder.com":"Business Recorder"
  };

  function injectPremiumStyle() {
    if ($("nxPremiumNewsStyle")) return;
    const style = document.createElement("style");
    style.id = "nxPremiumNewsStyle";
    style.textContent = `
      #tab-news{--nxNewsBlue:#38bdf8;--nxNewsRed:#ff3158;--nxNewsGold:#fbbf24;--nxNewsGreen:#22c55e;--nxNewsPurple:#a78bfa}
      #tab-news>.card{background:linear-gradient(180deg,rgba(8,16,30,.96),rgba(7,12,22,.98));border:1px solid rgba(56,189,248,.18);box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}
      .nx-news-masthead{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin:4px 0 14px}
      .nx-news-kicker{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#38bdf8;font-weight:900}
      .nx-news-heading{font-size:23px;line-height:1.1;font-weight:900;margin-top:4px;background:linear-gradient(90deg,#fff,#7dd3fc,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}
      .nx-news-sub{font-size:11px;color:#94a3b8;margin-top:6px}
      .nx-news-live{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(239,68,68,.34);background:rgba(127,29,29,.22);border-radius:999px;color:#fecaca;font-size:10px;font-weight:900;white-space:nowrap}
      .nx-news-live i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 14px #ef4444;animation:nxNewsPulse 1.15s infinite}
      @keyframes nxNewsPulse{50%{opacity:.35;transform:scale(.72)}}
      .nx-breaking-strip{display:grid;grid-template-columns:auto 1fr;border-radius:11px;overflow:hidden;border:1px solid rgba(239,68,68,.35);background:#090f1a;margin-bottom:13px;min-height:42px}
      .nx-breaking-label{display:flex;align-items:center;padding:0 13px;background:linear-gradient(135deg,#ef233c,#b90432);font-size:10px;font-weight:950;letter-spacing:.08em;color:#fff;white-space:nowrap}
      .nx-breaking-window{overflow:hidden;display:flex;align-items:center}
      .nx-breaking-track{display:inline-flex;align-items:center;white-space:nowrap;min-width:max-content;animation:nxNewsTicker 48s linear infinite}
      .nx-breaking-track span{font-size:11px;color:#e2e8f0;padding:0 28px 0 12px}
      .nx-breaking-track b{color:#38bdf8;margin-right:7px}
      @keyframes nxNewsTicker{from{transform:translateX(8%)}to{transform:translateX(-100%)}}
      .nx-news-filters{display:flex;gap:7px;overflow:auto;padding:1px 0 11px;scrollbar-width:none}
      .nx-news-filters::-webkit-scrollbar{display:none}
      .nx-news-chip{border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.82);color:#94a3b8;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:800;white-space:nowrap}
      .nx-news-chip.active{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.25)}
      .nx-feature-story{position:relative;min-height:310px;border-radius:17px;overflow:hidden;border:1px solid rgba(255,255,255,.1);margin-bottom:14px;background:#0f172a;cursor:pointer;isolation:isolate}
      .nx-feature-media,.nx-news-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0b1220}
      .nx-feature-story:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,7,17,.06) 20%,rgba(2,8,20,.52) 55%,rgba(2,8,20,.98) 100%);z-index:1}
      .nx-feature-fallback,.nx-news-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 20% 20%,rgba(56,189,248,.22),transparent 34%),radial-gradient(circle at 80% 20%,rgba(167,139,250,.2),transparent 28%),linear-gradient(135deg,#07111f,#10192d);color:rgba(255,255,255,.14);font-size:70px;font-weight:950;letter-spacing:-.08em}
      .nx-feature-copy{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:23px}
      .nx-badge-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:9px}
      .nx-news-breaking{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#ef233c,#b90432);color:#fff;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:950;letter-spacing:.08em}
      .nx-news-category{display:inline-flex;padding:5px 8px;border-radius:6px;background:rgba(14,165,233,.17);border:1px solid rgba(56,189,248,.32);color:#7dd3fc;font-size:9px;font-weight:900;text-transform:uppercase}
      .nx-feature-title{font-size:22px;line-height:1.22;font-weight:950;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.45)}
      .nx-feature-meta,.nx-card-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:#cbd5e1;font-size:10px;margin-top:10px}
      .nx-source-dot{width:5px;height:5px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8}
      .nx-news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .nx-news-card{position:relative;overflow:hidden;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(180deg,rgba(17,24,39,.95),rgba(8,14,25,.98));box-shadow:0 14px 32px rgba(0,0,0,.22);transition:.2s ease;cursor:pointer}
      .nx-news-card:hover{transform:translateY(-2px);border-color:rgba(56,189,248,.32);box-shadow:0 18px 42px rgba(0,0,0,.32)}
      .nx-news-media{position:relative;height:165px;overflow:hidden;background:#0b1220}
      .nx-news-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(5,10,20,.55))}
      .nx-news-card-body{padding:13px}
      .nx-news-card-title{font-size:14px;line-height:1.38;font-weight:900;color:#f8fafc;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .nx-news-card-title strong{color:#7dd3fc}
      .nx-news-snippet{font-size:11px;line-height:1.48;color:#94a3b8;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .nx-news-read{display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,163,184,.11);color:#38bdf8;font-size:10px;font-weight:900}
      .nx-news-card.cat-SINDH .nx-news-category{color:#86efac;border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.13)}
      .nx-news-card.cat-BUSINESS .nx-news-category{color:#fde68a;border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.12)}
      .nx-news-card.cat-SPORTS .nx-news-category{color:#f0abfc;border-color:rgba(217,70,239,.3);background:rgba(217,70,239,.11)}
      .nx-news-card.cat-TECH .nx-news-category{color:#a5b4fc;border-color:rgba(129,140,248,.35);background:rgba(129,140,248,.12)}
      .nx-news-card.cat-ENTERTAINMENT .nx-news-category{color:#f9a8d4;border-color:rgba(236,72,153,.32);background:rgba(236,72,153,.11)}
      .nx-news-empty{padding:30px 15px;text-align:center;color:#94a3b8;border:1px dashed rgba(148,163,184,.18);border-radius:14px}
      @media(max-width:680px){.nx-news-grid{grid-template-columns:1fr}.nx-feature-story{min-height:275px}.nx-feature-title{font-size:19px}.nx-news-media{height:190px}.nx-news-masthead{align-items:flex-start}.nx-news-heading{font-size:21px}}
    `;
    document.head.appendChild(style);
  }

  function sourceFromUrl(url, fallback = "Pakistan News") {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const key = Object.keys(SOURCE_LABELS).find(domain => host === domain || host.endsWith("." + domain));
      return key ? SOURCE_LABELS[key] : fallback;
    } catch (_) { return fallback; }
  }

  function domainIsPakistani(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return PAK_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
    } catch (_) { return false; }
  }

  function plainText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return String(doc.body?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function imageFromHtml(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return safeHttpUrl(doc.querySelector("img")?.getAttribute("src") || "");
    } catch (_) { return ""; }
  }

  function categoryOf(title, source = "") {
    const t = (title + " " + source).toLowerCase();
    if (/karachi|sindh|hyderabad|sukkur|larkana|shikarpur|thar|mirpurkhas/.test(t)) return "SINDH";
    if (/cricket|psl|football|hockey|match|t20|odi|test series|babar|shaheen/.test(t)) return "SPORTS";
    if (/business|economy|rupee|dollar|gold|petrol|diesel|stock|kse|psx|imf|sbp|tax|budget|trade/.test(t)) return "BUSINESS";
    if (/technology|tech|ai |artificial intelligence|software|mobile|internet|cyber|space|satellite/.test(t)) return "TECH";
    if (/film|drama|actor|actress|music|showbiz|entertainment|celebrity/.test(t)) return "ENTERTAINMENT";
    if (/pakistan|islamabad|lahore|punjab|balochistan|quetta|peshawar|khyber|government|prime minister|president|army|court|pti|pml|ppp/.test(t)) return "PAKISTAN";
    return "WORLD";
  }

  function normalizeDate(value) {
    const d = new Date(value || "");
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function timeAgo(value) {
    const d = normalizeDate(value);
    if (!d) return "Live update";
    const diff = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function isBreaking(item, index) {
    const d = normalizeDate(item.date);
    if (d && Date.now() - d.getTime() <= 6 * 3600e3) return true;
    return index < 4;
  }

  function hashFallback(text) {
    const initials = String(text || "N").split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase();
    return esc(initials || "N");
  }

  function articleMedia(item, cls) {
    const img = safeHttpUrl(item.image || "");
    if (img) return `<img class="${cls}" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="${cls === 'nx-feature-media' ? 'nx-feature-fallback' : 'nx-news-image-fallback'}" style="display:none">${hashFallback(item.source)}</div>`;
    return `<div class="${cls === 'nx-feature-media' ? 'nx-feature-fallback' : 'nx-news-image-fallback'}">${hashFallback(item.source)}</div>`;
  }

  function openArticle(item) {
    const url = safeHttpUrl(item.url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function installShell() {
    injectPremiumStyle();
    const tab = $("tab-news");
    const list = $("newsList");
    if (!tab || !list) return;

    const oldHeader = tab.querySelector(".market-header");
    if (oldHeader) {
      const title = oldHeader.querySelector("h3");
      if (title) title.style.display = "none";
      const sub = oldHeader.querySelector(".market-count");
      if (sub) sub.style.display = "none";
    }

    if (!$("nxNewsMasthead")) {
      const mast = document.createElement("div");
      mast.id = "nxNewsMasthead";
      mast.innerHTML = `
        <div class="nx-news-masthead">
          <div><div class="nx-news-kicker">NEXUSNOVA NEWSROOM</div><div class="nx-news-heading">Pakistan Live News Desk</div><div class="nx-news-sub">Pakistan-first headlines • Sindh • business • sports • world • trusted local publishers</div></div>
          <div class="nx-news-live"><i></i> LIVE</div>
        </div>
        <div class="nx-breaking-strip"><div class="nx-breaking-label">BREAKING NEWS</div><div class="nx-breaking-window"><div id="nxBreakingTrack" class="nx-breaking-track"><span>Connecting to Pakistan news desk…</span></div></div></div>
        <div id="nxNewsFilters" class="nx-news-filters"></div>`;
      list.parentElement?.insertBefore(mast, list);
    }

    const filters = $("nxNewsFilters");
    if (filters && !filters.children.length) {
      ["ALL","PAKISTAN","SINDH","BUSINESS","SPORTS","TECH","ENTERTAINMENT","WORLD"].forEach(cat => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nx-news-chip" + (cat === activeCategory ? " active" : "");
        b.textContent = cat === "ALL" ? "All News" : cat[0] + cat.slice(1).toLowerCase();
        b.dataset.newsCategory = cat;
        b.addEventListener("click", () => {
          activeCategory = cat;
          filters.querySelectorAll(".nx-news-chip").forEach(x => x.classList.toggle("active", x === b));
          render(currentItems);
        });
        filters.appendChild(b);
      });
    }
  }

  function renderTicker(items) {
    const track = $("nxBreakingTrack");
    if (!track) return;
    const top = items.slice(0, 12);
    track.innerHTML = top.length ? top.map(item => `<span><b>${esc(item.source)}</b>${esc(item.title)}</span>`).join("") : "<span>Pakistan live news desk is reconnecting…</span>";
  }

  function render(items) {
    installShell();
    const list = $("newsList");
    if (!list) return;
    const unique = [];
    const seen = new Set();
    for (const raw of items) {
      if (!raw?.title) continue;
      const key = String(raw.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 110);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const source = raw.source || sourceFromUrl(raw.url);
      unique.push({...raw, source, category:raw.category || categoryOf(raw.title, source)});
      if (unique.length >= 36) break;
    }
    currentItems = unique;
    renderTicker(unique);

    const clean = activeCategory === "ALL" ? unique : unique.filter(x => x.category === activeCategory);
    if (!clean.length) {
      list.innerHTML = `<div class="nx-news-empty">No ${esc(activeCategory.toLowerCase())} stories are available right now. Try All News or refresh.</div>`;
      return;
    }

    const lead = clean[0];
    const rest = clean.slice(1, 21);
    const leadUrl = safeHttpUrl(lead.url);
    const leadBreaking = isBreaking(lead,0);
    list.innerHTML = `
      <article class="nx-feature-story" data-news-index="0">
        ${articleMedia(lead,"nx-feature-media")}
        <div class="nx-feature-copy">
          <div class="nx-badge-row">${leadBreaking ? '<span class="nx-news-breaking">● BREAKING</span>' : ''}<span class="nx-news-category">${esc(lead.category)}</span></div>
          <div class="nx-feature-title">${esc(lead.title)}</div>
          <div class="nx-feature-meta"><span class="nx-source-dot"></span><b>${esc(lead.source)}</b><span>•</span><span>${esc(timeAgo(lead.date))}</span>${leadUrl ? '<span>• Tap to read full story</span>' : ''}</div>
        </div>
      </article>
      <div class="nx-news-grid">${rest.map((item,index) => {
        const breaking = isBreaking(item,index+1);
        return `<article class="nx-news-card cat-${esc(item.category)}" data-news-index="${index+1}">
          <div class="nx-news-media">${articleMedia(item,"nx-news-thumb")}</div>
          <div class="nx-news-card-body">
            <div class="nx-badge-row">${breaking ? '<span class="nx-news-breaking">● BREAKING</span>' : ''}<span class="nx-news-category">${esc(item.category)}</span></div>
            <div class="nx-news-card-title">${esc(item.title)}</div>
            ${item.description ? `<div class="nx-news-snippet">${esc(item.description)}</div>` : ''}
            <div class="nx-card-meta"><span class="nx-source-dot"></span><b>${esc(item.source)}</b><span>•</span><span>${esc(timeAgo(item.date))}</span></div>
            <div class="nx-news-read"><span>READ FULL STORY</span><span>→</span></div>
          </div>
        </article>`;
      }).join("")}</div>`;

    list.querySelectorAll("[data-news-index]").forEach(card => {
      card.addEventListener("click", () => openArticle(clean[Number(card.dataset.newsIndex) || 0]));
    });

    const sourceCount = new Set(unique.map(x => x.source).filter(Boolean)).size;
    setStatus(`Pakistan Desk • ${unique.length} live stories • ${sourceCount} sources`);
  }

  async function fetchJson(url, timeoutMs = 11000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {cache:"no-store", signal:controller.signal});
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  async function gdeltPakistan() {
    const q = encodeURIComponent("Pakistan");
    const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=75&timespan=48h`, 13000);
    const all = (Array.isArray(data.articles) ? data.articles : []).map(a => ({
      title:a.title,
      url:a.url,
      date:a.seendate,
      source:sourceFromUrl(a.url, a.domain || "Pakistan News"),
      image:a.socialimage || "",
      description:""
    }));
    const local = all.filter(x => domainIsPakistani(x.url));
    return local.length >= 8 ? local : all.filter(x => /pakistan|karachi|lahore|islamabad|sindh|punjab|balochistan|peshawar/i.test(x.title || ""));
  }

  async function rss2json(rss, sourceHint = "") {
    const url = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss);
    const data = await fetchJson(url, 12000);
    if (data?.status && data.status !== "ok") throw new Error(data.message || "RSS service failed");
    return (Array.isArray(data.items) ? data.items : []).map(a => {
      const description = plainText(a.description || a.content || "").slice(0, 240);
      const image = safeHttpUrl(a.thumbnail || a.enclosure?.link || imageFromHtml(a.content || a.description));
      const articleUrl = a.link || a.url || "";
      return {title:a.title,url:articleUrl,date:a.pubDate,source:sourceHint || sourceFromUrl(articleUrl),image,description};
    });
  }

  async function allOriginsRss(rss, sourceHint = "") {
    const target = "https://api.allorigins.win/raw?url=" + encodeURIComponent(rss);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(target, {cache:"no-store", signal:controller.signal});
      if (!res.ok) throw new Error("HTTP " + res.status);
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      return [...doc.querySelectorAll("item")].map(item => {
        const descriptionHtml = item.querySelector("description")?.textContent || "";
        const articleUrl = item.querySelector("link")?.textContent || "";
        const media = item.querySelector("media\\:content, content")?.getAttribute("url") || item.querySelector("enclosure")?.getAttribute("url") || imageFromHtml(descriptionHtml);
        return {
          title:item.querySelector("title")?.textContent || "Pakistan News",
          url:articleUrl,
          date:item.querySelector("pubDate")?.textContent || "",
          source:sourceHint || sourceFromUrl(articleUrl),
          image:safeHttpUrl(media),
          description:plainText(descriptionHtml).slice(0,240)
        };
      });
    } finally { clearTimeout(timer); }
  }

  const GOOGLE_LOCAL = "https://news.google.com/rss/search?q=" + encodeURIComponent("Pakistan (site:dawn.com OR site:geo.tv OR site:arynews.tv OR site:tribune.com.pk OR site:thenews.com.pk OR site:samaa.tv OR site:brecorder.com)") + "&hl=en-PK&gl=PK&ceid=PK:en";
  const GOOGLE_PK = "https://news.google.com/rss?hl=en-PK&gl=PK&ceid=PK:en";
  const TRIBUNE_PK = "https://tribune.com.pk/feed/pakistan";
  const TRIBUNE_LATEST = "https://tribune.com.pk/feed/latest";

  async function gatherSources() {
    const jobs = [
      gdeltPakistan(),
      rss2json(GOOGLE_LOCAL),
      rss2json(TRIBUNE_PK,"Express Tribune"),
      rss2json(TRIBUNE_LATEST,"Express Tribune"),
      rss2json(GOOGLE_PK,"Google News Pakistan")
    ];
    const settled = await Promise.allSettled(jobs);
    const merged = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (merged.length) return merged;

    const fallbacks = await Promise.allSettled([
      allOriginsRss(TRIBUNE_PK,"Express Tribune"),
      allOriginsRss(GOOGLE_LOCAL,"Google News Pakistan"),
      allOriginsRss(GOOGLE_PK,"Google News Pakistan")
    ]);
    return fallbacks.flatMap(result => result.status === "fulfilled" ? result.value : []);
  }

  window.loadNews = async function() {
    installShell();
    const list = $("newsList");
    if (!list) return;
    const id = ++requestNo;
    list.innerHTML = '<div class="status">Connecting to Pakistan live news desk…</div>';
    setStatus("Connecting to Pakistan sources…");

    try {
      const items = await gatherSources();
      if (id !== requestNo) return;
      if (!items.length) throw new Error("No stories returned");
      render(items);
    } catch (error) {
      console.warn("NexusNova premium news failed:", error);
      if (id !== requestNo) return;
      list.innerHTML = '<div class="nx-news-empty">Pakistan live news is temporarily unavailable. Tap Refresh to retry.</div>';
      setStatus("News desk temporarily offline");
    }
  };

  installShell();
})();