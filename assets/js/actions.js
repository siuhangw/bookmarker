/* ═══ Actions ═══ */
// Clears filter state not listed in `keep` and collapses the mobile sidebar.
function resetFilters({ keep = [] } = {}) {
  const defaults = { activeCol: "all", activeSubcol: null, activeTag: null, showFeatured: false };
  for (const [k, v] of Object.entries(defaults)) {
    if (!keep.includes(k)) state[k] = v;
  }
  if (!isDesktop()) state.sidebarOpen = false;
}

function selectCollection(id) {
  resetFilters();
  state.activeCol = id;
  render();
}
function selectAndToggleCollection(id) {
  resetFilters();
  state.activeCol = id;
  if (state.expandedCols.has(id)) { state.expandedCols.delete(id); } else { state.expandedCols.add(id); }
  render();
}
function selectSubcollection(id) {
  state.activeSubcol = state.activeSubcol === id ? null : id;
  if (!isDesktop()) state.sidebarOpen = false;
  render();
}
function toggleFavorites() {
  const next = !state.showFeatured;
  resetFilters();
  state.showFeatured = next;
  render();
}
function selectTag(tag) {
  const next = state.activeTag === tag ? null : tag;
  resetFilters({ keep: ["activeCol"] });
  state.activeTag = next;
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
  state.activeTag = null;
  document.getElementById("searchInput").value = "";
  render();
}
function setView(v) { state.view = v; render(); }
function setSort(v) { state.sort = v; render(); }
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", state.theme);
  try { localStorage.setItem("theme", state.theme); } catch { /* storage full — skip */ }
  render();
}
function toggleSidebar() { state.sidebarOpen = !state.sidebarOpen; render(); }
function closeSidebar() { state.sidebarOpen = false; render(); }

/* ═══ Modal ═══ */
function openModal(id) {
  const bm = state.bookmarks.find((b) => b.id === id);
  if (!bm) return;
  const col = state.collections.find((c) => c.id === bm.collection);
  const subcol = col?.collectionItem?.find((s) => s.id === bm.collectionItem);
  document.getElementById("modalContent").innerHTML = renderModalContent(bm, col, subcol);
  document.getElementById("bookmarkModal").classList.add("active");
  document.body.style.overflow = "hidden";
  safeCreateIcons();
}
function closeModal() {
  document.getElementById("bookmarkModal").classList.remove("active");
  document.body.style.overflow = "";
}
async function reloadData() {
  document.getElementById("app").style.display = "none";
  document.getElementById("loading").style.display = "flex";
  await loadData();
  applyThemeFromMeta();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "flex";
  render();
}

/* ═══ Event delegation ═══
   CSP forbids inline event handlers; everything routes through one click
   listener that dispatches on `data-action`. Each handler receives
   (el, event), where `el` is the closest `[data-action]` ancestor.
*/
const ACTIONS = {
  "close-sidebar":               ()     => closeSidebar(),
  "toggle-sidebar":              ()     => toggleSidebar(),
  "toggle-theme":                ()     => toggleTheme(),
  "toggle-favorites":            ()     => toggleFavorites(),
  "clear-search":                ()     => clearSearch(),
  "clear-tag":                   ()     => clearTag(),
  "reload-data":                 ()     => reloadData(),
  "close-modal":                 ()     => closeModal(),
  "noop":                        ()     => {},
  "set-view":                    (el)   => setView(el.dataset.view),
  "set-sort":                    (el)   => setSort(el.dataset.sort),
  "select-collection":           (el)   => selectCollection(el.dataset.col),
  "select-and-toggle-collection":(el)   => selectAndToggleCollection(el.dataset.col),
  "select-subcollection":        (el)   => selectSubcollection(el.dataset.sub),
  "toggle-col-expand":           (el)   => toggleColExpand(el.dataset.col),
  "select-tag":                  (el)   => selectTag(el.dataset.tag),
  "select-tag-from-modal":       (el)   => { closeModal(); selectTag(el.dataset.tag); },
  "open-modal":                  (el)   => openModal(el.dataset.id),
};

// Suppress default navigation for anchors that act as modal openers, and
// swallow bubbled clicks inside the modal panel so they don't hit the overlay.
function handleActionClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const handler = ACTIONS[action];
  if (!handler) return;
  // Anchors with data-action="open-modal" shouldn't navigate; tag chips inside
  // a card anchor shouldn't bubble up and trigger the card's open-modal.
  if (el.tagName === "A") e.preventDefault();
  if (action === "select-tag" || action === "select-tag-from-modal") {
    e.preventDefault();
    e.stopPropagation();
  }
  if (action === "noop") { e.stopPropagation(); return; }
  handler(el, e);
}

// Favicon images can't use inline `onerror=` under CSP. Hide any broken
// favicons after each render pass.
function hideBrokenFavicons(root = document) {
  root.querySelectorAll("img.favicon").forEach((img) => {
    if (img.dataset.errBound === "1") return;
    img.dataset.errBound = "1";
    img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
    if (img.complete && img.naturalWidth === 0) img.style.display = "none";
  });
}

// Wrap render() so every pass re-binds favicon error handlers.
const _renderOrig = render;
render = function patchedRender() {
  _renderOrig();
  hideBrokenFavicons();
};

// Debounce search input: rendering on every keystroke is wasteful at 500+ items.
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ═══ Responsive ═══ */
window.addEventListener("resize", () => {
  if (isDesktop() && !state.sidebarOpen) { state.sidebarOpen = true; }
  if (isMobile()) state.view = "grid";
  render();
});

/* ═══ Init ═══ */
(async function init() {
  safeCreateIcons();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  document.addEventListener("click", handleActionClick);
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", debounce(onSearch, 120));
  await loadData();
  applyThemeFromMeta();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "flex";
  state.sidebarOpen = isDesktop();
  render();
})();
