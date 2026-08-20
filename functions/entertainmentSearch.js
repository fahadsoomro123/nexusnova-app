const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const ENTERTAINMENT_PROVIDER_CONFIG = defineSecret("NEXUSNOVA_ENTERTAINMENT_PROVIDERS");
const SEARCH_TIMEOUT_MS = 12000;

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
}

function cleanQuery(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 140) throw new HttpsError("invalid-argument", "Invalid entertainment search.");
  return text;
}

function cleanMode(value) {
  return String(value || "").toLowerCase() === "live" ? "live" : "discover";
}

function providerConfig() {
  let raw = "";
  try { raw = String(ENTERTAINMENT_PROVIDER_CONFIG.value() || "").trim(); } catch {}
  let parsed = {};
  if (raw) {
    try { parsed = JSON.parse(raw); }
    catch { throw new HttpsError("internal", "Entertainment provider secret is invalid JSON."); }
  }
  return {
    youtubeKey: String(parsed.youtubeApiKey || process.env.YOUTUBE_API_KEY || "").trim(),
    tmdbToken: String(parsed.tmdbBearerToken || process.env.TMDB_BEARER_TOKEN || "").trim()
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {Accept: "application/json", ...(options.headers || {})},
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = json?.error?.message || json?.status_message || `HTTP ${response.status}`;
      throw new Error(String(message).slice(0, 220));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function searchYouTube(query, key, {live = false} = {}) {
  const provider = live ? "YouTube Live" : "YouTube";
  if (!key) return {provider, status: "not-configured", results: []};
  try {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: live ? "12" : "8",
      safeSearch: "strict",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      key
    });
    if (live) params.set("eventType", "live");
    const json = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const results = (Array.isArray(json?.items) ? json.items : []).map(item => {
      const id = String(item?.id?.videoId || "").trim();
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
      const snippet = item?.snippet || {};
      return {
        kind: "video",
        provider,
        live,
        id,
        title: String(snippet.title || (live ? "Live stream" : "YouTube video")).slice(0, 220),
        creator: String(snippet.channelTitle || provider).slice(0, 120),
        description: String(snippet.description || "").replace(/\s+/g, " ").trim().slice(0, 500),
        publishedAt: String(snippet.publishedAt || ""),
        thumbnail: String(snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || ""),
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`
      };
    }).filter(Boolean);
    return {provider, status: "connected", results};
  } catch (error) {
    return {provider, status: "error", message: String(error.message || error).slice(0, 180), results: []};
  }
}

async function searchDailymotion(query) {
  try {
    const params = new URLSearchParams({
      search: query,
      limit: "8",
      fields: "id,title,thumbnail_480_url,owner.screenname,duration,embed_url"
    });
    const json = await fetchJson(`https://api.dailymotion.com/videos?${params.toString()}`);
    const results = (Array.isArray(json?.list) ? json.list : []).map(item => {
      const id = String(item?.id || "").trim();
      if (!/^[A-Za-z0-9]+$/.test(id)) return null;
      return {
        kind: "video",
        provider: "Dailymotion",
        live: false,
        id,
        title: String(item?.title || "Dailymotion video").slice(0, 220),
        creator: String(item?.["owner.screenname"] || "Dailymotion").slice(0, 120),
        description: "",
        durationSeconds: Number(item?.duration) || 0,
        thumbnail: String(item?.thumbnail_480_url || ""),
        embedUrl: String(item?.embed_url || `https://www.dailymotion.com/embed/video/${id}`)
      };
    }).filter(Boolean);
    return {provider: "Dailymotion", status: "connected", results};
  } catch (error) {
    return {provider: "Dailymotion", status: "error", message: String(error.message || error).slice(0, 180), results: []};
  }
}

async function searchTmdb(query, token) {
  if (!token) return {provider: "TMDB", status: "not-configured", results: []};
  try {
    const params = new URLSearchParams({
      query,
      include_adult: "false",
      language: "en-US",
      page: "1"
    });
    const json = await fetchJson(`https://api.themoviedb.org/3/search/multi?${params.toString()}`, {
      headers: {Authorization: `Bearer ${token}`}
    });
    const results = (Array.isArray(json?.results) ? json.results : [])
      .filter(item => item?.media_type === "movie" || item?.media_type === "tv")
      .slice(0, 10)
      .map(item => {
        const title = item.media_type === "movie" ? item.title : item.name;
        const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
        const posterPath = String(item?.poster_path || "");
        return {
          kind: item.media_type,
          provider: "TMDB",
          id: String(item?.id || ""),
          title: String(title || "Movie / TV").slice(0, 220),
          description: String(item?.overview || "").replace(/\s+/g, " ").trim().slice(0, 800),
          date: String(date || ""),
          rating: Number(item?.vote_average) || 0,
          poster: /^\/[A-Za-z0-9._/-]+$/.test(posterPath) ? `https://image.tmdb.org/t/p/w500${posterPath}` : ""
        };
      });
    return {provider: "TMDB", status: "connected", results};
  } catch (error) {
    return {provider: "TMDB", status: "error", message: String(error.message || error).slice(0, 180), results: []};
  }
}

exports.searchEntertainment = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 20,
  memory: "256MiB",
  secrets: [ENTERTAINMENT_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const query = cleanQuery(req.data?.query);
  const mode = cleanMode(req.data?.mode);
  const config = providerConfig();

  const providers = mode === "live"
    ? [await searchYouTube(query, config.youtubeKey, {live: true})]
    : await Promise.all([
      searchYouTube(query, config.youtubeKey),
      searchDailymotion(query),
      searchTmdb(query, config.tmdbToken)
    ]);

  return {
    ok: true,
    searchedAt: Date.now(),
    query,
    mode,
    providers: providers.map(({provider, status, message}) => ({provider, status, message: message || ""})),
    results: providers.flatMap(item => item.results)
  };
});
