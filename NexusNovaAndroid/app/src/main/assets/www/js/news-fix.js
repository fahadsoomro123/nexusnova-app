/* NexusNova NEWS FIX V2
   Reliable browser-side news loader with multiple fallbacks.
   Does not touch mining, wallet, tasks, market or AI.
*/
(() => {
  "use strict";
  let requestNo = 0;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));

  const setStatus = text => {
    const el = document.getElementById("newsStatus");
    if (el) el.textContent = text;
  };

  const safeHttpUrl = value => {
    try {
      const u = new URL(String(value || ""));
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
    } catch (_) { return ""; }
  };

  const render = items => {
    const list = document.getElementById("newsList");
    if (!list) return;
    const clean = items.filter(x => x && x.title).slice(0, 12);
    if (!clean.length) throw new Error("No articles");

    list.innerHTML = clean.map(item => {
      const url = safeHttpUrl(item.url || item.link || "");
      const safeUrl = esc(url);
      return `
        <div class="news-item">
          <div class="news-title">${esc(item.title)}</div>
          <div class="news-meta">${esc(item.source || "World News")}${item.date ? " • " + esc(item.date) : ""}</div>
          ${url ? `<button class="action-btn" style="margin-top:7px;padding:7px 10px" data-news-url="${safeUrl}">Read News</button>` : ""}
        </div>`;
    }).join("");

    list.querySelectorAll("[data-news-url]").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-news-url");
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      });
    });

    setStatus("Connected • Live");
  };

  async function fetchJson(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {cache:"no-store", signal:controller.signal});
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function gdelt() {
    const data = await fetchJson(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=json&maxrecords=12&timespan=24h"
    );
    return (Array.isArray(data.articles) ? data.articles : []).map(a => ({
      title:a.title, url:a.url, date:a.seendate, source:a.domain || "World News"
    }));
  }

  async function rss2json(rss, source) {
    const url = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss);
    const data = await fetchJson(url);
    return (Array.isArray(data.items) ? data.items : []).map(a => ({
      title:a.title, url:a.link, date:a.pubDate, source
    }));
  }

  async function allOriginsRss(rss, source) {
    const target = "https://api.allorigins.win/raw?url=" + encodeURIComponent(rss);
    const xml = await (await fetch(target, {cache:"no-store"})).text();
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("item")].map(item => ({
      title:item.querySelector("title")?.textContent || "World News",
      url:item.querySelector("link")?.textContent || "",
      date:item.querySelector("pubDate")?.textContent || "",
      source
    }));
  }

  window.loadNews = async function() {
    const list = document.getElementById("newsList");
    if (!list) return;
    const id = ++requestNo;

    list.innerHTML = '<div class="status">Loading live world news...</div>';
    setStatus("Connecting...");

    const sources = [
      () => gdelt(),
      () => rss2json("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", "Google News"),
      () => rss2json("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World"),
      () => allOriginsRss("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", "Google News")
    ];

    for (const load of sources) {
      try {
        const items = await load();
        if (id !== requestNo) return;
        render(items);
        return;
      } catch (error) {
        console.warn("NexusNova news source failed:", error);
      }
    }

    if (id === requestNo) {
      list.innerHTML = '<div class="status">Live news is temporarily unavailable. Tap ↻ Refresh to retry.</div>';
      setStatus("Offline");
    }
  };

  // The final news implementation is installed at the end of page2.js.
})();
