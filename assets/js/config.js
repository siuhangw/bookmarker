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
  sort: "default",   // "default" | "alpha" | "date"
  theme: "light",
  sidebarOpen: window.innerWidth >= 1024,
  expandedCols: new Set(),
  activeModal: null,
  error: null,
};
