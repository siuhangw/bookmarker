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
function setSort(v) { state.sort = v; render(); }
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", state.theme);
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
  lucide.createIcons();
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

/* ═══ Responsive ═══ */
window.addEventListener("resize", () => {
  if (isDesktop() && !state.sidebarOpen) { state.sidebarOpen = true; }
  if (isMobile()) state.view = "grid";
  render();
});

/* ═══ Init ═══ */
(async function init() {
  lucide.createIcons();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  await loadData();
  applyThemeFromMeta();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "flex";
  state.sidebarOpen = isDesktop();
  render();
})();
