/* ═══ Helpers ═══ */
// Tag display caps per surface — raised here so they don't drift across files.
const SIDEBAR_TAG_LIMIT = 20;
const CARD_TAG_LIMIT    = 3;
const ROW_TAG_LIMIT     = 2;

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

// Lucide loads from a CDN; if it's blocked or slow we still want the rest of
// the UI to function instead of every render throwing.
const safeCreateIcons = () => {
  try { if (typeof lucide !== "undefined") lucide.createIcons(); }
  catch (e) { console.warn("lucide.createIcons failed:", e); }
};

// Single tag chip. Variants:
//   "inline"  — card chip, #tag label, stops propagation (inside a link)
//   "row"     — list-row chip, #tag label, stops propagation
//   "sidebar" — sidebar pill, bare tag label, reflects state.activeTag
//   "modal"   — modal chip, #tag label, closes the modal before filtering
const renderTagChip = (tag, variant) => {
  const t = esc(tag);
  if (variant === "sidebar") {
    const active = state.activeTag === tag ? " active" : "";
    return `<button class="tag-btn${active}" onclick="selectTag('${t}')">${t}</button>`;
  }
  if (variant === "modal") {
    return `<button class="tag-btn" onclick="closeModal();selectTag('${t}')">#${t}</button>`;
  }
  const cls = variant === "row" ? "row-tag" : "inline-tag";
  return `<button class="${cls}" onclick="event.preventDefault();event.stopPropagation();selectTag('${t}')">#${t}</button>`;
};
