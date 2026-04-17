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

// Lucide loads from a CDN; if it's blocked or slow we still want the rest of
// the UI to function instead of every render throwing.
const safeCreateIcons = () => {
  try { if (typeof lucide !== "undefined") lucide.createIcons(); }
  catch (e) { console.warn("lucide.createIcons failed:", e); }
};
