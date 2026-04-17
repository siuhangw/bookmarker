/* ═══ Data Loading ═══ */
const CACHE_KEY = "bookmarks_cache";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes in ms
const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function parseYaml(yamlText) {
  const parsed = jsyaml.load(yamlText);
  const meta = parsed.meta || {};
  const site = {
    name: meta.title || "Markly",
    tagline: meta.tagline || "",
    description: meta.description || "",
  };
  const collections = (parsed.collectionList || [])
    .slice()
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  // Flatten bookmarkList[].bookmarkItem[] into a single array
  const bookmarks = (parsed.bookmarkList || []).flatMap((group) =>
    (group.bookmarkItem || []).map((bm) => ({
      ...bm,
      id: String(bm.id),
      tags: bm.tags || [],
      featured: bm.featured || false,
      desc: bm.desc || "",
      collectionItem: bm.collectionItem || null,
    }))
  );
  return { meta, site, collections, bookmarks };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(yamlText, etag) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: yamlText, etag, fetchedAt: Date.now() }));
  } catch { /* storage full — silently skip */ }
}

async function loadData() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const url = isLocal ? "./data/bookmarks.yaml" : `${REPO_BASE}/data/bookmarks.yaml`;

  function applyParsed(parsed) {
    state.meta = parsed.meta; state.site = parsed.site;
    state.collections = parsed.collections; state.bookmarks = parsed.bookmarks;
    state.error = null;
  }

  try {
    const cache = readCache();

    // Within TTL — use cache without any network request
    if (!isLocal && cache && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
      applyParsed(parseYaml(cache.data));
      return;
    }

    // Past TTL — conditional GET with ETag if available
    const headers = {};
    if (!isLocal && cache?.etag) headers["If-None-Match"] = cache.etag;

    const res = await fetchWithTimeout(url, { headers });

    if (res.status === 304) {
      // Not modified — bump timestamp, keep cached data
      writeCache(cache.data, cache.etag);
      applyParsed(parseYaml(cache.data));
      return;
    }

    if (!res.ok) throw new Error(`bookmarks.yaml: ${res.status}`);

    // New data — store and use
    const yamlText = await res.text();
    writeCache(yamlText, res.headers.get("etag") || "");
    applyParsed(parseYaml(yamlText));

  } catch (e) {
    console.error("Fetch failed:", e);
    // Fall back to stale cache rather than showing an error
    const cache = readCache();
    if (cache) { applyParsed(parseYaml(cache.data)); return; }
    state.meta = null;
    state.site = { name: "Markly", tagline: "", description: "" };
    state.collections = []; state.bookmarks = [];
    state.activeSubcol = null;
    state.error = "Could not load bookmarks from GitHub. Please try again later.";
  }
}

/* ═══ Filtering ═══ */
function getFiltered() {
  let list = state.bookmarks.filter((b) => {
    if (state.activeCol !== "all" && b.collection !== state.activeCol) return false;
    if (state.activeSubcol && b.collectionItem !== state.activeSubcol) return false;
    if (state.activeTag && !b.tags.includes(state.activeTag)) return false;
    if (state.showFeatured && !b.featured) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  if (state.sort === "alpha") {
    list = list.slice().sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  } else if (state.sort === "date") {
    list = list.slice().sort((a, b) => {
      if (!a.added && !b.added) return 0;
      if (!a.added) return 1;
      if (!b.added) return -1;
      return b.added > a.added ? 1 : b.added < a.added ? -1 : 0;
    });
  }

  return list;
}

function getAllTags() {
  const map = {};
  state.bookmarks.forEach((b) => b.tags.forEach((t) => { map[t] = (map[t] || 0) + 1; }));
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/* ═══ Theme ═══ */
function applyThemeFromMeta() {
  if (!state.meta) return;
  if (state.meta.theme?.accent) {
    document.documentElement.style.setProperty("--accent", state.meta.theme.accent);
  }
  // User preference wins over YAML default so toggling persists across reloads.
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch { /* private mode */ }
  const theme = (saved === "dark" || saved === "light")
    ? saved
    : (state.meta.theme?.default ?? "light");
  state.theme = theme;
  document.body.setAttribute("data-theme", theme);
}
