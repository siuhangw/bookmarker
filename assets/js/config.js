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
  tags: [],
  activeCol: "all",
  activeSubcol: null,
  activeTag: null,
  showFeatured: false,
  search: "",
  view: "grid",
  sort: "default",   // "default" | "alpha" | "date"
  theme: "light",
  showStats: false,
  sidebarOpen: window.innerWidth >= 1024,
  expandedCols: new Set(),
  activeModal: null,
  error: null,
  fromCache: null,   // { fetchedAt: ms } when serving stale data after a failed refresh
};
