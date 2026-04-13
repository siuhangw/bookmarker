/* ═══════════════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════════════ */
const REPO_BASE = "https://raw.githubusercontent.com/siuhangw/bookmarker/main";

/* ═══ State ═══ */
let state = {
  site: { name: "Markly", tagline: "", description: "" },
  meta: null,
  collections: [],
  bookmarks: [],
  activeCol: "all",
  activeSubcol: null,
  activeTag: null,
  showFeatured: false,
  search: "",
  view: "grid",
  theme: "light",
  sidebarOpen: window.innerWidth >= 1024,
  expandedCols: new Set(),
  error: null,
};

/* ═══ Helpers ═══ */
const getFavicon = (url) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
  catch { return ""; }
};
const getDomain = (url) => {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
};
const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const isMobile = () => window.innerWidth < 640;
const isTablet = () => window.innerWidth >= 640 && window.innerWidth < 1024;
const isDesktop = () => window.innerWidth >= 1024;

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

/* ═══ Render ═══ */
function render() {
  const filtered = getFiltered();
  const allTags = getAllTags();
  const colData = state.collections.find((c) => c.id === state.activeCol);

  // Site name
  document.getElementById("siteName").textContent = state.site.name;

  // Menu button icon
  const menuBtn = document.getElementById("menuBtn");
  if (isDesktop()) {
    menuBtn.innerHTML = `<i data-lucide="chevron-right" style="width:17px;height:17px;transition:transform 0.2s;${state.sidebarOpen ? "transform:rotate(180deg);" : ""}"></i>`;
  } else {
    menuBtn.innerHTML = `<i data-lucide="menu" style="width:20px;height:20px;"></i>`;
  }

  // Sidebar state
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (isDesktop()) {
    sidebar.classList.toggle("collapsed", !state.sidebarOpen);
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  } else {
    sidebar.classList.remove("collapsed");
    sidebar.classList.toggle("open", state.sidebarOpen);
    overlay.classList.toggle("active", state.sidebarOpen);
  }

  // Sidebar nav
  let nav = "";
  // All
  nav += navItem("all", "layers", "All Resources", state.bookmarks.length, state.activeCol === "all" && !state.showFeatured && !state.activeTag);
  // Favorites
  const favCount = state.bookmarks.filter((b) => b.featured).length;
  nav += navItem("fav", "star", "Favorites", favCount, state.showFeatured, state.showFeatured ? ' style="color:#F59E0B"' : "");
  nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Collections</div>`;
  // Collections
  state.collections.forEach((col) => {
    const count = state.bookmarks.filter((b) => b.collection === col.id).length;
    const isActive = state.activeCol === col.id && !state.showFeatured && !state.activeTag;
    const hasSubs = col.subcollections && col.subcollections.length > 0;
    const isExpanded = state.expandedCols.has(col.id);
    const chevron = hasSubs
      ? `<button class="nav-chevron${isExpanded ? " expanded" : ""}" onclick="toggleColExpand('${col.id}')" aria-label="Toggle subcollections"><i data-lucide="chevron-right" style="width:13px;height:13px;"></i></button>`
      : "";
    nav += `<div class="nav-collection-wrap">
      <button class="nav-item${isActive && !state.activeSubcol ? " active" : ""}" onclick="${hasSubs ? "selectAndToggleCollection" : "selectCollection"}('${col.id}')">`
        <span class="nav-icon"><span class="color-dot" style="background:${col.color};"></span></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(col.name)}</span>
        <span class="nav-count">${count}</span>
      </button>${chevron}
    </div>`;
    if (hasSubs && isExpanded) {
      col.subcollections
        .slice()
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
        .forEach((sub) => {
          const subCount = state.bookmarks.filter((b) => b.collection === col.id && b.subcollection === sub.id).length;
          const subActive = state.activeSubcol === sub.id;
          nav += `<button class="nav-item nav-subitem${subActive ? " active" : ""}" onclick="selectSubcollection('${sub.id}')">
            <span class="nav-icon"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↳ ${esc(sub.name)}</span>
            <span class="nav-count">${subCount}</span>
          </button>`;
        });
    }
  });
  // Tags
  if (allTags.length > 0) {
    nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Tags</div><div class="tags-wrap">`;
    allTags.slice(0, 20).forEach(([tag]) => {
      nav += `<button class="tag-btn${state.activeTag === tag ? " active" : ""}" onclick="selectTag('${esc(tag)}')">${esc(tag)}</button>`;
    });
    nav += `</div>`;
  }
  document.getElementById("sidebarNav").innerHTML = nav;

  // View buttons
  document.getElementById("gridBtn").className = `view-btn${state.view === "grid" ? " active" : ""}`;
  document.getElementById("listBtn").className = `view-btn${state.view === "list" ? " active" : ""}`;

  // Theme icon
  document.getElementById("themeIcon").setAttribute("data-lucide", state.theme === "dark" ? "sun" : "moon");

  // Item count
  document.getElementById("itemCount").textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;

  // Search clear
  document.getElementById("searchClear").style.display = state.search ? "flex" : "none";

  // Content
  let html = "";

  // Error
  if (state.error) {
    html += `<div class="error-banner fade-up">
      <i data-lucide="alert-circle" style="width:18px;height:18px;color:var(--accent);flex-shrink:0;margin-top:1px;"></i>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);">${esc(state.error)}</p>
        <button class="error-retry" onclick="reloadData()">Try again</button>
      </div>
    </div>`;
  }

  // Title
  let title = "All Resources";
  let subtitle = state.site.description || state.site.tagline;
  if (state.showFeatured) { title = "Favorites"; subtitle = ""; }
  else if (state.activeTag) { title = `Tagged <span class="title-dim">#${esc(state.activeTag)}</span>`; subtitle = ""; }
  else if (state.activeSubcol && colData) {
    const subcol = colData.subcollections?.find((s) => s.id === state.activeSubcol);
    title = subcol ? esc(subcol.name) : esc(colData.name);
    subtitle = "";
  }
  else if (state.activeCol !== "all" && colData) { title = esc(colData.name); subtitle = ""; }

  html += `<div class="title-section"><h2 class="page-title">${title}</h2>`;
  if (state.activeCol === "all" && !state.showFeatured && !state.activeTag && subtitle) {
    html += `<p class="page-subtitle">${esc(subtitle)}</p>`;
  }
  html += `</div>`;

  // Active tag chip
  if (state.activeTag) {
    html += `<button class="active-tag-chip" onclick="clearTag()">#${esc(state.activeTag)} <i data-lucide="x" style="width:12px;height:12px;"></i></button>`;
  }

  // Bookmarks
  if (filtered.length === 0) {
    html += `<div class="empty-state">
      <i data-lucide="bookmark" style="width:38px;height:38px;opacity:0.3;margin-bottom:14px;"></i>
      <p style="font-size:14px;font-weight:500;">No bookmarks found</p>
      <p style="font-size:12px;margin-top:4px;">Try a different search or filter</p>
    </div>`;
  } else if (state.view === "grid" || isMobile()) {
    html += `<div class="grid">`;
    filtered.forEach((bm, i) => { html += renderCard(bm, i); });
    html += `</div>`;
  } else {
    html += `<div class="list">`;
    filtered.forEach((bm, i) => { html += renderRow(bm, i); });
    html += `</div>`;
  }

  document.getElementById("content").innerHTML = html;
  lucide.createIcons();
}

function navItem(id, icon, label, count, active, extra = "") {
  const action = id === "fav" ? "toggleFavorites()" : `selectCollection('${id}')`;
  return `<button class="nav-item${active ? " active" : ""}" onclick="${action}">
    <span class="nav-icon"><i data-lucide="${icon}" style="width:15px;height:15px;"${extra}></i></span>
    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(label)}</span>
    <span class="nav-count">${count}</span>
  </button>`;
}

function renderCard(bm, i) {
  const col = state.collections.find((c) => c.id === bm.collection);
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:12px;height:12px;fill:#F59E0B;"></i>` : "";
  let tags = "";
  if (col) tags += `<span class="collection-badge" style="background:${col.color}18;color:${col.color};">${esc(col.name)}</span>`;
  if (bm.subcollection && col) {
    const subcol = col.subcollections?.find((s) => s.id === bm.subcollection);
    if (subcol) tags += `<span class="subcol-badge">${esc(subcol.name)}</span>`;
  }
  bm.tags.slice(0, 3).forEach((t) => {
    tags += `<button class="inline-tag" onclick="event.preventDefault();event.stopPropagation();selectTag('${esc(t)}')">#${esc(t)}</button>`;
  });
  const desc = bm.desc ? `<p class="card-desc">${esc(bm.desc)}</p>` : "";
  return `<a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="card fade-up" style="animation-delay:${i * 35}ms;">
    <div class="card-top">
      <div class="card-icon"><img src="${getFavicon(bm.url)}" alt="" onerror="this.style.display='none'" /></div>
      <div class="card-info">
        <div class="card-title-row"><span class="card-title">${esc(bm.title)}</span>${fav}</div>
        <span class="card-domain">${esc(getDomain(bm.url))}</span>
      </div>
      <i data-lucide="arrow-up-right" class="card-arrow" style="width:15px;height:15px;"></i>
    </div>
    ${desc}
    <div class="card-tags">${tags}</div>
  </a>`;
}

function renderRow(bm, i) {
  const col = state.collections.find((c) => c.id === bm.collection);
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:10px;height:10px;fill:#F59E0B;margin-left:5px;vertical-align:middle;"></i>` : "";
  let colBadge = col ? `<span class="row-collection" style="background:${col.color}18;color:${col.color};">${esc(col.name)}</span>` : "";
  let tags = "";
  bm.tags.slice(0, 2).forEach((t) => {
    tags += `<button class="row-tag" onclick="event.preventDefault();event.stopPropagation();selectTag('${esc(t)}')">#${esc(t)}</button>`;
  });
  return `<a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="row fade-up" style="animation-delay:${i * 20}ms;">
    <div class="row-icon"><img src="${getFavicon(bm.url)}" alt="" onerror="this.style.display='none'" /></div>
    <span class="row-title">${esc(bm.title)}${fav}</span>
    <span class="row-desc">${esc(bm.desc)}</span>
    ${colBadge}${tags}
    <span class="row-domain">${esc(getDomain(bm.url))}</span>
    <i data-lucide="arrow-up-right" class="row-arrow" style="width:13px;height:13px;"></i>
  </a>`;
}

/* ═══ Actions ═══ */
function selectCollection(id) {
  state.activeCol = id; state.activeTag = null; state.showFeatured = false; state.activeSubcol = null;
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function selectAndToggleCollection(id) {
  state.activeCol = id; state.activeTag = null; state.showFeatured = false; state.activeSubcol = null;
  if (state.expandedCols.has(id)) { state.expandedCols.delete(id); } else { state.expandedCols.add(id); }
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function selectSubcollection(id) {
  state.activeSubcol = state.activeSubcol === id ? null : id;
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function toggleFavorites() {
  state.showFeatured = !state.showFeatured; state.activeCol = "all"; state.activeTag = null; state.activeSubcol = null;
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function selectTag(tag) {
  state.activeTag = state.activeTag === tag ? null : tag; state.showFeatured = false; state.activeSubcol = null;
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function toggleColExpand(id) {
  if (state.expandedCols.has(id)) { state.expandedCols.delete(id); }
  else { state.expandedCols.add(id); }
  render();
}
function clearTag() { state.activeTag = null; state.activeSubcol = null; render(); }
function onSearch() {
  state.search = document.getElementById("searchInput").value;
  render();
  document.getElementById("searchInput").focus();
}
function clearSearch() {
  state.search = "";
  state.activeSubcol = null;
  document.getElementById("searchInput").value = "";
  render();
}
function setView(v) { state.view = v; render(); }
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", state.theme);
  render();
}
function toggleSidebar() { state.sidebarOpen = !state.sidebarOpen; render(); }
function closeSidebar() { state.sidebarOpen = false; render(); }
async function reloadData() {
  document.getElementById("app").style.display = "none";
  document.getElementById("loading").style.display = "flex";
  await loadData();
  applyThemeFromMeta();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "flex";
  render();
}

function applyThemeFromMeta() {
  if (!state.meta) return;
  if (state.meta.theme?.accent) {
    document.documentElement.style.setProperty("--accent", state.meta.theme.accent);
  }
  const defaultTheme = state.meta.theme?.default ?? "light";
  state.theme = defaultTheme;
  document.body.setAttribute("data-theme", defaultTheme);
}

/* ═══ Responsive ═══ */
window.addEventListener("resize", () => {
  if (isDesktop() && !state.sidebarOpen) { state.sidebarOpen = true; }
  if (isMobile()) state.view = "grid";
  render();
});

/* ═══ Init ═══ */
(async function init() {
  lucide.createIcons();
  await loadData();
  applyThemeFromMeta();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "flex";
  state.sidebarOpen = isDesktop();
  render();
})();
