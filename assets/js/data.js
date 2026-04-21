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
  // Flatten bookmarkList[].bookmarkItem[] into a single array.
  // Precompute _domain and _favicon so we don't rederive them on every render.
  const bookmarks = (parsed.bookmarkList || []).flatMap((group) =>
    (group.bookmarkItem || []).map((bm) => ({
      ...bm,
      id: String(bm.id),
      tags: bm.tags || [],
      featured: bm.featured || false,
      desc: bm.desc || "",
      collectionItem: bm.collectionItem || null,
      _domain: getDomain(bm.url),
      _favicon: getFavicon(bm.url),
    }))
  );
  // Precompute tag frequency once per data load (memoized in getAllTags()).
  const tagCounts = {};
  bookmarks.forEach((b) => b.tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  return { meta, site, collections, bookmarks, tags };
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

// Fetch the dead-links report and mark flagged bookmarks. Silent on failure —
// the report is optional metadata, not critical to the app.
async function loadDeadLinks(isLocal) {
  const url = isLocal ? "./data/dead-links.json" : `${REPO_BASE}/data/dead-links.json`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return new Map();
    const report = await res.json();
    const map = new Map();
    (report.dead || []).forEach((d) => map.set(String(d.id), { status: d.status, reason: d.reason }));
    return map;
  } catch { return new Map(); }
}

function applyDeadLinks(bookmarks, deadMap) {
  bookmarks.forEach((bm) => {
    const info = deadMap.get(String(bm.id));
    bm._dead = info ? { status: info.status, reason: info.reason } : null;
  });
}

async function loadData() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const url = isLocal ? "./data/bookmarks.yaml" : `${REPO_BASE}/data/bookmarks.yaml`;

  function applyParsed(parsed, { stale = false, fetchedAt = null } = {}) {
    state.meta = parsed.meta; state.site = parsed.site;
    state.collections = parsed.collections; state.bookmarks = parsed.bookmarks;
    state.tags = parsed.tags;
    state.error = null;
    state.fromCache = stale ? { fetchedAt } : null;
  }

  try {
    const cache = readCache();

    // Within TTL — use cache without any network request
    if (!isLocal && cache && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
      applyParsed(parseYaml(cache.data));
      applyDeadLinks(state.bookmarks, await loadDeadLinks(isLocal));
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
      applyDeadLinks(state.bookmarks, await loadDeadLinks(isLocal));
      return;
    }

    if (!res.ok) throw new Error(`bookmarks.yaml: ${res.status}`);

    // New data — store and use
    const yamlText = await res.text();
    writeCache(yamlText, res.headers.get("etag") || "");
    applyParsed(parseYaml(yamlText));
    applyDeadLinks(state.bookmarks, await loadDeadLinks(isLocal));

  } catch (e) {
    console.error("Fetch failed:", e);
    // Fall back to stale cache rather than showing an error
    const cache = readCache();
    if (cache) {
      applyParsed(parseYaml(cache.data), { stale: true, fetchedAt: cache.fetchedAt });
      applyDeadLinks(state.bookmarks, await loadDeadLinks(isLocal));
      return;
    }
    state.meta = null;
    state.site = { name: "Markly", tagline: "", description: "" };
    state.collections = []; state.bookmarks = []; state.tags = [];
    state.activeSubcol = null;
    state.fromCache = null;
    state.error = "Could not load bookmarks from GitHub. Please try again later.";
  }
}

/* ═══ Query parser ═══
   Free-text search with operator prefixes and negation:
     tag:ai site:github.com collection:dev is:featured is:dead -tag:news
   Tokens are whitespace-separated; unknown prefixes fall through to plain text.
   Short text tokens (≥3 chars) also match as a title subsequence — "ghb"
   finds "github".
*/
const KNOWN_OPS = new Set(["tag", "site", "collection", "is"]);

function parseQuery(raw) {
  return (raw || "").trim().split(/\s+/).filter(Boolean).map((tok) => {
    const neg = tok.length > 1 && tok.startsWith("-");
    const body = neg ? tok.slice(1) : tok;
    const i = body.indexOf(":");
    if (i > 0) {
      const op = body.slice(0, i).toLowerCase();
      const val = body.slice(i + 1).toLowerCase();
      if (KNOWN_OPS.has(op) && val) return { op, val, neg };
    }
    return { op: "text", val: body.toLowerCase(), neg };
  });
}

function fuzzySubseq(hay, needle) {
  let j = 0;
  for (let i = 0; i < hay.length && j < needle.length; i++) {
    if (hay[i] === needle[j]) j += 1;
  }
  return j === needle.length;
}

function matchTerm(bm, term) {
  const { op, val } = term;
  if (op === "tag") {
    return (bm.tags || []).some((t) => t.toLowerCase().includes(val));
  }
  if (op === "site") {
    return (bm._domain || "").toLowerCase().includes(val) ||
           (bm.url || "").toLowerCase().includes(val);
  }
  if (op === "collection") {
    return (bm.collection || "").toLowerCase() === val ||
           (bm.collectionItem || "").toLowerCase() === val;
  }
  if (op === "is") {
    if (val === "featured") return !!bm.featured;
    if (val === "dead") return !!bm._dead;
    return false;
  }
  // Plain text: substring across title/desc/url/tags, plus title subsequence.
  const title = (bm.title || "").toLowerCase();
  const desc = (bm.desc || "").toLowerCase();
  const url = (bm.url || "").toLowerCase();
  const tagBlob = (bm.tags || []).join(" ").toLowerCase();
  if (title.includes(val) || desc.includes(val) || url.includes(val) || tagBlob.includes(val)) return true;
  if (val.length >= 3 && fuzzySubseq(title, val)) return true;
  return false;
}

// Higher score = better match. Only used when sort === "default" and the
// search has terms; other sorts keep their own ordering.
function scoreBookmark(bm, terms) {
  let score = 0;
  const title = (bm.title || "").toLowerCase();
  const url = (bm.url || "").toLowerCase();
  const desc = (bm.desc || "").toLowerCase();
  const tags = (bm.tags || []).map((t) => t.toLowerCase());
  for (const { op, val, neg } of terms) {
    if (neg) continue;
    if (op === "text") {
      if (title === val) score += 200;
      else if (title.startsWith(val)) score += 120;
      else if (title.includes(val)) score += 80;
      if (url.includes(val)) score += 20;
      if (desc.includes(val)) score += 15;
      if (tags.includes(val)) score += 40;
      else if (tags.some((t) => t.includes(val))) score += 10;
    } else if (op === "tag") {
      if (tags.includes(val)) score += 50;
      else if (tags.some((t) => t.includes(val))) score += 20;
    } else if (op === "site" || op === "collection") {
      score += 30;
    } else if (op === "is") {
      score += 15;
    }
  }
  if (bm.featured) score += 2; // tie-break: featured first
  return score;
}

/* ═══ Filtering ═══ */
function getFiltered() {
  const terms = state.search ? parseQuery(state.search) : [];

  // In admin mode the user's pending edits should drive filter behavior
  // (e.g. freshly-starred items show up under Favorites immediately).
  const candidates = state.bookmarks.filter((base) => {
    const b = state.adminMode ? getEffectiveBookmark(base) : base;
    if (state.activeCol !== "all" && b.collection !== state.activeCol) return false;
    if (state.activeSubcol && b.collectionItem !== state.activeSubcol) return false;
    if (state.activeTag && !b.tags.includes(state.activeTag)) return false;
    if (state.showFeatured && !b.featured) return false;
    for (const t of terms) {
      const hit = matchTerm(b, t);
      if (t.neg ? hit : !hit) return false;
    }
    return true;
  });

  let list = candidates;
  if (terms.length && state.sort === "default") {
    // Rank by relevance when the user is actively searching on default sort.
    list = candidates
      .map((base) => {
        const b = state.adminMode ? getEffectiveBookmark(base) : base;
        return { base, score: scoreBookmark(b, terms) };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.base);
  } else if (state.sort === "alpha") {
    list = candidates.slice().sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  } else if (state.sort === "date") {
    list = candidates.slice().sort((a, b) => {
      if (!a.added && !b.added) return 0;
      if (!a.added) return 1;
      if (!b.added) return -1;
      return b.added > a.added ? 1 : b.added < a.added ? -1 : 0;
    });
  }

  return list;
}

// Returns [[tag, count], ...] sorted by count desc. Memoized in parseYaml().
function getAllTags() {
  return state.tags || [];
}

// Admin mode keeps edits in state.adminChanges[id] until the user copies the
// YAML diff. For rendering, merge the pending changes onto the base bookmark.
function getEffectiveBookmark(bm) {
  const change = state.adminChanges?.[bm.id];
  if (!change) return bm;
  const merged = { ...bm };
  if (Object.prototype.hasOwnProperty.call(change, "featured")) merged.featured = !!change.featured;
  if (Object.prototype.hasOwnProperty.call(change, "tags")) merged.tags = change.tags.slice();
  return merged;
}

// True when the pending change differs from the base bookmark. Used to drive
// the "dirty" indicator in the admin UI.
function adminChangeIsDirty(bm) {
  const change = state.adminChanges?.[bm.id];
  if (!change) return false;
  if (Object.prototype.hasOwnProperty.call(change, "featured") && !!change.featured !== !!bm.featured) return true;
  if (Object.prototype.hasOwnProperty.call(change, "tags")) {
    const a = change.tags || [];
    const b = bm.tags || [];
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  }
  return false;
}

/* ═══ Stats ═══ */
// Counts per collection, sorted descending by count.
function statsByCollection() {
  const counts = {};
  state.bookmarks.forEach((b) => { counts[b.collection] = (counts[b.collection] || 0) + 1; });
  return state.collections
    .map((c) => ({ id: c.id, name: c.name, color: c.color, count: counts[c.id] || 0 }))
    .sort((a, b) => b.count - a.count);
}

// Added-per-month: [{ month: "YYYY-MM", count }] covering every month from the
// earliest `added` date to the current month — zero-filled so the sparkline
// has a continuous baseline. Returns [] if no bookmark has an `added` date.
function statsByMonth() {
  const dates = state.bookmarks.map((b) => b.added).filter(Boolean).map((d) => String(d));
  if (!dates.length) return [];
  const counts = {};
  dates.forEach((d) => {
    const ym = d.slice(0, 7);
    counts[ym] = (counts[ym] || 0) + 1;
  });
  const sorted = Object.keys(counts).sort();
  const first = sorted[0];
  const [fy, fm] = first.split("-").map(Number);
  const now = new Date();
  const months = [];
  let y = fy, m = fm;
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ month: ym, count: counts[ym] || 0 });
    m += 1;
    if (m === 13) { m = 1; y += 1; }
    if (months.length > 240) break; // safety: 20y max
  }
  return months;
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
