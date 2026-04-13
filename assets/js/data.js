/* ═══ Data Loading ═══ */
async function fetchFromGitHub() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const url = isLocal ? "./data/bookmarks.yaml" : `${REPO_BASE}/data/bookmarks.yaml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bookmarks.yaml: ${res.status}`);
  const parsed = jsyaml.load(await res.text());

  const meta = parsed.meta || {};
  const site = {
    name: meta.title || "Markly",
    tagline: meta.tagline || "",
    description: meta.description || "",
  };

  const collections = (parsed.collections || [])
    .slice()
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const bookmarks = (parsed.bookmarks || []).map((bm) => ({
    ...bm,
    id: String(bm.id),
    tags: bm.tags || [],
    featured: bm.featured || false,
    desc: bm.desc || "",
    subcollection: bm.subcollection || null,
  }));

  return { meta, site, collections, bookmarks };
}

async function loadData() {
  try {
    const data = await fetchFromGitHub();
    state.meta = data.meta;
    state.site = data.site;
    state.collections = data.collections;
    state.bookmarks = data.bookmarks;
    state.error = null;
  } catch (e) {
    console.error("Fetch failed:", e);
    state.meta = null;
    state.site = { name: "Markly", tagline: "", description: "" };
    state.collections = [];
    state.bookmarks = [];
    state.activeSubcol = null;
    state.error = "Could not load bookmarks from GitHub. Please try again later.";
  }
}

/* ═══ Filtering ═══ */
function getFiltered() {
  return state.bookmarks.filter((b) => {
    if (state.activeCol !== "all" && b.collection !== state.activeCol) return false;
    if (state.activeSubcol && b.subcollection !== state.activeSubcol) return false;
    if (state.activeTag && !b.tags.includes(state.activeTag)) return false;
    if (state.showFeatured && !b.featured) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });
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
  const defaultTheme = state.meta.theme?.default ?? "light";
  state.theme = defaultTheme;
  document.body.setAttribute("data-theme", defaultTheme);
}
