import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, X, Grid3X3, List, Bookmark, Star, Layers,
  ArrowUpRight, Sun, Moon, ChevronRight, Menu, Loader2, RefreshCw, AlertCircle
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   DATA SOURCE
   
   Currently: embedded data (works inside Claude artifact sandbox).
   
   For production deployment, switch to GitHub fetch mode by:
   1. Setting USE_GITHUB_FETCH = true
   2. Updating REPO_BASE to your repo's raw URL
   
   The embedded data below mirrors what's in your GitHub repo YAML files.
   When you deploy this as a standalone site, the fetch mode will pull
   live data from: https://raw.githubusercontent.com/siuhangw/bookmarker/main/
   ═══════════════════════════════════════════════════════════════════════════ */

const USE_GITHUB_FETCH = false;
const REPO_BASE = "https://raw.githubusercontent.com/siuhangw/bookmarker/main";

/* ─── Embedded data (mirrors your GitHub YAML files) ─── */
const EMBEDDED_SITE = {
  name: "Markly",
  tagline: "Curated tools, resources, and links I use and recommend."
};

const EMBEDDED_COLLECTIONS = [
  { id: "dev", name: "Dev Tools", color: "#3B82F6", file: "dev.yaml" },
  { id: "design", name: "Design", color: "#E8453C", file: "design.yaml" },
  { id: "productivity", name: "Productivity", color: "#10B981", file: "productivity.yaml" },
  { id: "learning", name: "Learning", color: "#F59E0B", file: "learning.yaml" },
  { id: "ai", name: "AI & ML", color: "#8B5CF6", file: "ai.yaml" },
  { id: "media", name: "Media & Fun", color: "#06B6D6", file: "media.yaml" },
];

const EMBEDDED_BOOKMARKS = [
  // ── Dev Tools ──
  { id: "dev-0", url: "https://github.com", title: "GitHub", desc: "Where the world builds software. Version control, collaboration, and CI/CD.", collection: "dev", tags: ["code", "git", "open-source"], featured: true },
  { id: "dev-1", url: "https://code.visualstudio.com", title: "VS Code", desc: "Lightweight but powerful code editor with extensions for every language.", collection: "dev", tags: ["editor", "code", "microsoft"], featured: false },
  { id: "dev-2", url: "https://developer.mozilla.org", title: "MDN Web Docs", desc: "The definitive resource for web standards — HTML, CSS, JS, and Web APIs.", collection: "dev", tags: ["docs", "reference", "web"], featured: true },
  { id: "dev-3", url: "https://caniuse.com", title: "Can I Use", desc: "Browser support tables for modern web technologies at a glance.", collection: "dev", tags: ["browser", "compatibility", "web"], featured: false },
  { id: "dev-4", url: "https://regex101.com", title: "Regex101", desc: "Online regex tester and debugger with real-time explanation.", collection: "dev", tags: ["regex", "tool", "testing"], featured: false },
  // ── Design ──
  { id: "design-0", url: "https://figma.com", title: "Figma", desc: "Collaborative interface design tool used by teams worldwide.", collection: "design", tags: ["ui", "prototyping", "collaboration"], featured: true },
  { id: "design-1", url: "https://dribbble.com", title: "Dribbble", desc: "Discover top designers and creative work. Design inspiration daily.", collection: "design", tags: ["inspiration", "portfolio", "community"], featured: false },
  { id: "design-2", url: "https://coolors.co", title: "Coolors", desc: "Super fast color palette generator. Press spacebar to explore.", collection: "design", tags: ["color", "palette", "tool"], featured: false },
  { id: "design-3", url: "https://fonts.google.com", title: "Google Fonts", desc: "Free, open-source font library with easy web embedding.", collection: "design", tags: ["typography", "fonts", "google"], featured: false },
  { id: "design-4", url: "https://mobbin.com", title: "Mobbin", desc: "Browse real-world mobile and web design patterns from top apps.", collection: "design", tags: ["ui", "patterns", "mobile"], featured: true },
  // ── Productivity ──
  { id: "prod-0", url: "https://notion.so", title: "Notion", desc: "All-in-one workspace for notes, wikis, docs, and project management.", collection: "productivity", tags: ["notes", "wiki", "workspace"], featured: true },
  { id: "prod-1", url: "https://linear.app", title: "Linear", desc: "Streamlined issue tracking built for high-performance engineering teams.", collection: "productivity", tags: ["issues", "project", "engineering"], featured: false },
  { id: "prod-2", url: "https://raycast.com", title: "Raycast", desc: "Blazingly fast launcher for macOS that replaces Spotlight and more.", collection: "productivity", tags: ["launcher", "mac", "automation"], featured: true },
  { id: "prod-3", url: "https://excalidraw.com", title: "Excalidraw", desc: "Virtual whiteboard for sketching hand-drawn-like diagrams.", collection: "productivity", tags: ["whiteboard", "diagrams", "sketching"], featured: false },
  // ── Learning ──
  { id: "learn-0", url: "https://freecodecamp.org", title: "freeCodeCamp", desc: "Learn to code for free with interactive curriculum and certifications.", collection: "learning", tags: ["coding", "free", "curriculum"], featured: true },
  { id: "learn-1", url: "https://coursera.org", title: "Coursera", desc: "Online courses from top universities and companies worldwide.", collection: "learning", tags: ["courses", "university", "certificates"], featured: false },
  { id: "learn-2", url: "https://pudding.cool", title: "The Pudding", desc: "Visual essays that explain ideas debated in culture with data.", collection: "learning", tags: ["data-viz", "culture", "essays"], featured: true },
  // ── AI & ML ──
  { id: "ai-0", url: "https://chat.openai.com", title: "ChatGPT", desc: "OpenAI's conversational AI assistant for writing, analysis, and coding.", collection: "ai", tags: ["chatbot", "writing", "openai"], featured: true },
  { id: "ai-1", url: "https://huggingface.co", title: "Hugging Face", desc: "The platform for open-source ML models, datasets, and demos.", collection: "ai", tags: ["models", "open-source", "datasets"], featured: true },
  { id: "ai-2", url: "https://replicate.com", title: "Replicate", desc: "Run open-source AI models in the cloud with a simple API.", collection: "ai", tags: ["api", "models", "cloud"], featured: false },
  { id: "ai-3", url: "https://paperswithcode.com", title: "Papers With Code", desc: "Machine learning papers with code, benchmarks, and leaderboards.", collection: "ai", tags: ["research", "papers", "benchmarks"], featured: false },
  // ── Media & Fun ──
  { id: "media-0", url: "https://open.spotify.com", title: "Spotify", desc: "Music streaming with podcasts, playlists, and personalized discovery.", collection: "media", tags: ["music", "podcasts", "streaming"], featured: false },
  { id: "media-1", url: "https://youtube.com", title: "YouTube", desc: "Video platform for tutorials, entertainment, and endless rabbit holes.", collection: "media", tags: ["video", "tutorials", "entertainment"], featured: true },
  { id: "media-2", url: "https://getpocket.com", title: "Pocket", desc: "Save articles and videos for later. Read when you're ready.", collection: "media", tags: ["read-later", "articles", "curation"], featured: false },
];

/* ─── Minimal YAML parser (for GitHub fetch mode) ─── */
function parseYaml(text) {
  text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  return parseBlock(lines, 0, -1).value;
}
function parseBlock(lines, start, parentIndent) {
  let i = start, result = null;
  while (i < lines.length) {
    const line = lines[i], trimmed = line.replace(/\s+$/, "");
    if (trimmed === "" || /^\s*#/.test(trimmed)) { i++; continue; }
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= parentIndent && i > start) break;
    if (result === null) result = trimmed.startsWith("- ") ? [] : {};
    if (trimmed.startsWith("- ")) {
      if (!Array.isArray(result)) { i++; continue; }
      const afterDash = trimmed.slice(2);
      if (afterDash.includes(": ")) {
        const obj = {}, ci = afterDash.indexOf(": ");
        obj[afterDash.slice(0, ci).trim()] = parseVal(afterDash.slice(ci + 2).trim());
        i++;
        while (i < lines.length) {
          const nl = lines[i], nt = nl.replace(/\s+$/, "");
          if (nt === "" || /^\s*#/.test(nt)) { i++; continue; }
          if (nl.match(/^(\s*)/)[1].length <= indent) break;
          const nci = nt.indexOf(": ");
          if (nci > 0) obj[nt.slice(0, nci).trim()] = parseVal(nt.slice(nci + 2).trim());
          i++;
        }
        result.push(obj);
      } else { result.push(parseVal(afterDash.trim())); i++; }
    } else if (trimmed.includes(": ")) {
      const ci = trimmed.indexOf(": "), key = trimmed.slice(0, ci).trim(), vp = trimmed.slice(ci + 2).trim();
      if (!vp) { i++; const nested = parseBlock(lines, i, indent); if (typeof result === "object" && !Array.isArray(result)) result[key] = nested.value; i = nested.nextIndex; }
      else { if (typeof result === "object" && !Array.isArray(result)) result[key] = parseVal(vp); i++; }
    } else if (trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1).trim(); i++;
      const nested = parseBlock(lines, i, indent);
      if (typeof result === "object" && !Array.isArray(result)) result[key] = nested.value;
      i = nested.nextIndex;
    } else { i++; }
  }
  return { value: result || {}, nextIndex: i };
}
function parseVal(s) {
  if (s === "true") return true; if (s === "false") return false;
  if (s.startsWith("[") && s.endsWith("]"))
    return s.slice(1, -1).split(",").map(v => { v = v.trim(); return (v.startsWith('"') || v.startsWith("'")) ? v.slice(1, -1) : v; }).filter(Boolean);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

/* ─── Data loaders ─── */
async function fetchFromGitHub() {
  const metaRes = await fetch(`${REPO_BASE}/_meta.yaml`);
  if (!metaRes.ok) throw new Error(`Failed to fetch _meta.yaml: ${metaRes.status}`);
  const meta = parseYaml(await metaRes.text());
  const collections = meta.collections || [];
  const site = meta.site || { name: "Markly", tagline: "" };
  const bmArrays = await Promise.all(collections.map(async (col) => {
    try {
      const items = parseYaml(await (await fetch(`${REPO_BASE}/${col.file}`)).text());
      return (Array.isArray(items) ? items : []).map((bm, idx) => ({
        ...bm, id: `${col.id}-${idx}`, collection: col.id,
        tags: bm.tags || [], featured: bm.featured || false, desc: bm.desc || "",
      }));
    } catch { return []; }
  }));
  return { site, collections, bookmarks: bmArrays.flat() };
}

function loadEmbedded() {
  return { site: EMBEDDED_SITE, collections: EMBEDDED_COLLECTIONS, bookmarks: EMBEDDED_BOOKMARKS };
}

/* ─── Helpers ─── */
const getFavicon = (url) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
  catch { return null; }
};
const getDomain = (url) => {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
};

/* ─── Themes ─── */
const themes = {
  dark: {
    bg: "#0c0c0c", bgCard: "#161616", bgSidebar: "#111111",
    bgHover: "#1e1e1e", bgInput: "#1a1a1a",
    border: "#262626", borderHover: "#333",
    text: "#e8e8e8", textSecondary: "#999", textDim: "#555",
    accent: "#E8453C", tagBg: "#1f1f1f", tagText: "#aaa",
    shadow: "0 4px 20px rgba(0,0,0,0.3)", overlay: "rgba(0,0,0,0.6)",
  },
  light: {
    bg: "#F5F5F3", bgCard: "#FFFFFF", bgSidebar: "#ECEAE6",
    bgHover: "#E3E1DC", bgInput: "#ECEAE6",
    border: "#DBD9D3", borderHover: "#C8C6C0",
    text: "#1A1A17", textSecondary: "#6B6B63", textDim: "#A0A098",
    accent: "#E8453C", tagBg: "#E3E1DC", tagText: "#6B6B63",
    shadow: "0 4px 20px rgba(0,0,0,0.06)", overlay: "rgba(0,0,0,0.25)",
  }
};

/* ─── Responsive ─── */
function useBreakpoint() {
  const [bp, setBp] = useState("desktop");
  useEffect(() => {
    const check = () => setBp(window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop");
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return bp;
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BookmarkShowcase() {
  const [theme, setTheme] = useState("light");
  const [activeCol, setActiveCol] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [view, setView] = useState("grid");
  const [showFeatured, setShowFeatured] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [site, setSite] = useState(EMBEDDED_SITE);
  const [collections, setCollections] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const isDesktop = bp === "desktop";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = USE_GITHUB_FETCH ? await fetchFromGitHub() : loadEmbedded();
      setSite(data.site);
      setCollections(data.collections);
      setBookmarks(data.bookmarks);
    } catch (e) {
      setError("Could not load bookmarks. Using embedded data as fallback.");
      const data = loadEmbedded();
      setSite(data.site);
      setCollections(data.collections);
      setBookmarks(data.bookmarks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSidebarOpen(isDesktop); }, [isDesktop]);
  useEffect(() => { if (isMobile) setView("grid"); }, [isMobile]);

  const t = themes[theme];

  const allTags = useMemo(() => {
    const map = {};
    bookmarks.forEach((b) => b.tags.forEach((tg) => { map[tg] = (map[tg] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [bookmarks]);

  const filtered = useMemo(() => {
    return bookmarks.filter((b) => {
      if (activeCol !== "all" && b.collection !== activeCol) return false;
      if (activeTag && !b.tags.includes(activeTag)) return false;
      if (showFeatured && !b.featured) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.title.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) || b.tags.some((tg) => tg.toLowerCase().includes(q));
      }
      return true;
    });
  }, [bookmarks, activeCol, activeTag, search, showFeatured]);

  const activeColData = collections.find((c) => c.id === activeCol);

  const selectSidebar = useCallback((fn) => {
    fn(); if (!isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const sidebarWidth = isTablet ? 280 : 260;

  if (loading) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.accent,
            display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 1.5s ease infinite" }}>
            <Bookmark size={18} color="#fff" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.textSecondary, fontSize: 14 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
        input, button, select, textarea { font-family: inherit; }
        a { color: inherit; text-decoration: none; }
        .sb::-webkit-scrollbar { width: 4px; }
        .sb::-webkit-scrollbar-track { background: transparent; }
        .sb::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 4px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden",
        background: t.bg, color: t.text, position: "relative",
        transition: "background 0.35s ease, color 0.35s ease" }}>

        {!isDesktop && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: t.overlay }} />
        )}

        {/* ─── Sidebar ─── */}
        <aside style={{
          ...(isDesktop ? { width: sidebarOpen ? sidebarWidth : 0, minWidth: sidebarOpen ? sidebarWidth : 0, position: "relative" }
            : { position: "fixed", top: 0, left: 0, bottom: 0, width: sidebarWidth, zIndex: 50,
                transform: sidebarOpen ? "translateX(0)" : `translateX(-${sidebarWidth}px)` }),
          background: t.bgSidebar, borderRight: `1px solid ${t.border}`,
          display: "flex", flexDirection: "column",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden",
          boxShadow: !isDesktop && sidebarOpen ? "4px 0 24px rgba(0,0,0,0.15)" : "none",
        }}>
          <div style={{ padding: isMobile ? "18px 16px 14px" : "22px 20px 18px",
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accent,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bookmark size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{site.name}</span>
              <span style={{ fontSize: 11, color: t.textDim, display: "block", marginTop: -1 }}>Showcase</span>
            </div>
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(false)} style={{
                background: "none", border: "none", color: t.textSecondary, cursor: "pointer", padding: 4, display: "flex" }}>
                <X size={18} />
              </button>
            )}
          </div>

          <nav style={{ flex: 1, overflow: "auto", padding: "0 10px" }} className="sb">
            <NavItem t={t} active={activeCol === "all" && !showFeatured && !activeTag}
              onClick={() => selectSidebar(() => { setActiveCol("all"); setActiveTag(null); setShowFeatured(false); })}
              icon={<Layers size={15} />} label="All Resources" count={bookmarks.length} isMobile={isMobile} />
            <NavItem t={t} active={showFeatured}
              onClick={() => selectSidebar(() => { setShowFeatured(!showFeatured); setActiveCol("all"); setActiveTag(null); })}
              icon={<Star size={15} style={showFeatured ? { color: "#F59E0B" } : {}} />}
              label="Favorites" count={bookmarks.filter((b) => b.featured).length} isMobile={isMobile} />

            <Hr color={t.border} />
            <SectionLabel t={t}>Collections</SectionLabel>
            {collections.map((col) => (
              <NavItem key={col.id} t={t}
                active={activeCol === col.id && !showFeatured && !activeTag}
                onClick={() => selectSidebar(() => { setActiveCol(col.id); setActiveTag(null); setShowFeatured(false); })}
                icon={<div style={{ width: 12, height: 12, borderRadius: 3, background: col.color }} />}
                label={col.name} count={bookmarks.filter((b) => b.collection === col.id).length} isMobile={isMobile} />
            ))}

            {allTags.length > 0 && (
              <>
                <Hr color={t.border} />
                <SectionLabel t={t}>Tags</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "0 8px 20px" }}>
                  {allTags.slice(0, 20).map(([tag]) => (
                    <button key={tag}
                      onClick={() => selectSidebar(() => { setActiveTag(activeTag === tag ? null : tag); setShowFeatured(false); })}
                      style={{
                        fontSize: isMobile ? 12 : 11, padding: isMobile ? "6px 12px" : "4px 10px",
                        borderRadius: 20, border: "none", cursor: "pointer",
                        fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                        background: activeTag === tag ? t.text : t.tagBg,
                        color: activeTag === tag ? t.bg : t.tagText, transition: "all 0.15s"
                      }}>{tag}</button>
                  ))}
                </div>
              </>
            )}
          </nav>
        </aside>

        {/* ─── Main ─── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <header style={{
            display: "flex", alignItems: "center", gap: isMobile ? 8 : 10,
            padding: isMobile ? "10px 14px" : "12px 24px",
            borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              background: "none", border: "none", color: t.textSecondary, cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
              {isDesktop
                ? <ChevronRight size={17} style={{ transform: sidebarOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                : <Menu size={20} />}
            </button>

            <div style={{
              flex: 1, maxWidth: isDesktop ? 400 : "none",
              display: "flex", alignItems: "center", gap: 8,
              background: t.bgInput, borderRadius: 10, padding: "0 12px",
              border: `1px solid ${t.border}` }}>
              <Search size={15} color={t.textDim} style={{ flexShrink: 0 }} />
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, padding: isMobile ? "10px 0" : "9px 0", background: "none", border: "none",
                  color: t.text, fontSize: isMobile ? 14 : 13, outline: "none", minWidth: 0 }} />
              {search && (
                <button onClick={() => setSearch("")} style={{
                  background: "none", border: "none", color: t.textDim, cursor: "pointer", display: "flex", flexShrink: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {!isMobile && (
              <div style={{ display: "flex", gap: 2, background: t.bgInput, borderRadius: 6, padding: 3, flexShrink: 0 }}>
                <TBtn t={t} on={view === "grid"} onClick={() => setView("grid")} icon={<Grid3X3 size={14} />} />
                <TBtn t={t} on={view === "list"} onClick={() => setView("list")} icon={<List size={14} />} />
              </div>
            )}

            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: t.bgInput, border: `1px solid ${t.border}`,
              color: t.textSecondary, cursor: "pointer" }}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {!isMobile && (
              <span style={{ fontSize: 12, color: t.textDim, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </header>

          <div style={{
            flex: 1, overflow: "auto",
            padding: isMobile ? "16px 14px 32px" : isTablet ? "20px 20px 36px" : "24px 24px 40px" }} className="sb">

            {error && (
              <div className="fade-up" style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: 16, borderRadius: 10, marginBottom: 20,
                background: t.accent + "12", border: `1px solid ${t.accent}30` }}>
                <AlertCircle size={18} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: t.textSecondary }}>{error}</p>
              </div>
            )}

            <div style={{ marginBottom: isMobile ? 14 : 20 }}>
              <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {showFeatured ? "Favorites" :
                  activeTag ? <>Tagged <span style={{ color: t.textDim }}>#{activeTag}</span></> :
                    activeCol === "all" ? "All Resources" : activeColData?.name}
              </h2>
              {activeCol === "all" && !showFeatured && !activeTag && site.tagline && (
                <p style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>{site.tagline}</p>
              )}
            </div>

            {activeTag && (
              <button onClick={() => setActiveTag(null)} style={{
                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
                padding: "4px 12px", borderRadius: 20, background: t.accent,
                color: "#fff", border: "none", cursor: "pointer", marginBottom: 16, fontWeight: 500 }}>
                #{activeTag} <X size={12} />
              </button>
            )}

            {filtered.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "60px 20px", color: t.textDim }}>
                <Bookmark size={38} strokeWidth={1} style={{ marginBottom: 14, opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>No bookmarks found</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Try a different search or filter</p>
              </div>
            ) : view === "grid" || isMobile ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(auto-fill, minmax(240px, 1fr))" : "repeat(auto-fill, minmax(280px, 1fr))",
                gap: isMobile ? 10 : 12 }}>
                {filtered.map((bm, i) => (
                  <Card key={bm.id} bm={bm} t={t} delay={i * 35} isMobile={isMobile}
                    collections={collections} onTagClick={(tg) => { setActiveTag(tg); setShowFeatured(false); }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {filtered.map((bm, i) => (
                  <Row key={bm.id} bm={bm} t={t} delay={i * 20} isTablet={isTablet}
                    collections={collections} onTagClick={(tg) => { setActiveTag(tg); setShowFeatured(false); }} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function NavItem({ t, active, onClick, icon, label, count, isMobile }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8, width: "100%",
      padding: isMobile ? "10px 10px" : "8px 10px",
      background: active ? t.bgHover : "none",
      border: "none", color: active ? t.text : t.textSecondary,
      fontSize: isMobile ? 14 : 13, fontWeight: active ? 600 : 400, cursor: "pointer",
      borderRadius: 6, textAlign: "left", fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.15s" }}>
      <span style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 11, color: t.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
    </button>
  );
}
function Hr({ color }) { return <div style={{ height: 1, background: color, margin: "8px 10px 10px" }} />; }
function SectionLabel({ t, children }) {
  return <div style={{ padding: "2px 10px 6px", fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.08em", color: t.textDim }}>{children}</div>;
}
function TBtn({ t, on, onClick, icon }) {
  return <button onClick={onClick} style={{
    background: on ? t.bgHover : "none", border: "none",
    color: on ? t.text : t.textDim, cursor: "pointer",
    padding: "5px 8px", borderRadius: 4, display: "flex", alignItems: "center" }}>{icon}</button>;
}

function Card({ bm, t, delay, onTagClick, isMobile, collections }) {
  const [hov, setHov] = useState(false);
  const col = collections.find((c) => c.id === bm.collection);
  return (
    <a href={bm.url} target="_blank" rel="noopener noreferrer" className="fade-up"
      style={{
        display: "block", background: t.bgCard,
        border: `1px solid ${hov ? t.borderHover : t.border}`,
        borderRadius: 10, padding: isMobile ? 14 : 16, animationDelay: `${delay}ms`,
        transition: "border-color 0.15s, box-shadow 0.2s, transform 0.2s, background 0.35s",
        boxShadow: hov ? t.shadow : "none",
        transform: hov ? "translateY(-2px)" : "none" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: t.bgInput,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          border: `1px solid ${t.border}` }}>
          <img src={getFavicon(bm.url)} alt="" style={{ width: 18, height: 18, borderRadius: 3 }}
            onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{bm.title}</span>
            {bm.featured && <Star size={12} color="#F59E0B" fill="#F59E0B" />}
          </div>
          <span style={{ fontSize: 11.5, color: t.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            {getDomain(bm.url)}
          </span>
        </div>
        <ArrowUpRight size={15} color={hov ? t.text : t.textDim}
          style={{ transition: "color 0.15s", flexShrink: 0, marginTop: 2 }} />
      </div>
      {bm.desc && (
        <p style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5, marginBottom: 12,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{bm.desc}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {col && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500,
          background: col.color + "18", color: col.color }}>{col.name}</span>}
        {bm.tags.slice(0, 3).map((tg) => (
          <span key={tg} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick(tg); }}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
              background: t.tagBg, color: t.tagText, cursor: "pointer" }}>#{tg}</span>
        ))}
      </div>
    </a>
  );
}

function Row({ bm, t, delay, onTagClick, isTablet, collections }) {
  const [hov, setHov] = useState(false);
  const col = collections.find((c) => c.id === bm.collection);
  return (
    <a href={bm.url} target="_blank" rel="noopener noreferrer" className="fade-up"
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
        borderRadius: 6, animationDelay: `${delay}ms`,
        background: hov ? t.bgCard : "transparent", transition: "background 0.12s" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: t.bgInput,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        border: `1px solid ${t.border}` }}>
        <img src={getFavicon(bm.url)} alt="" style={{ width: 14, height: 14, borderRadius: 2 }}
          onError={(e) => { e.target.style.display = "none"; }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 550, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis", minWidth: 80 }}>
        {bm.title}
        {bm.featured && <Star size={10} color="#F59E0B" fill="#F59E0B" style={{ marginLeft: 5, verticalAlign: "middle" }} />}
      </span>
      <span style={{ fontSize: 12, color: t.textSecondary, flex: 1,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bm.desc}</span>
      {col && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 500,
        background: col.color + "18", color: col.color, flexShrink: 0 }}>{col.name}</span>}
      {!isTablet && bm.tags.slice(0, 2).map((tg) => (
        <span key={tg} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick(tg); }}
          style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20,
            background: t.tagBg, color: t.tagText, cursor: "pointer", flexShrink: 0 }}>#{tg}</span>
      ))}
      {!isTablet && <span style={{ fontSize: 11, color: t.textDim, fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0, width: 100, textAlign: "right" }}>{getDomain(bm.url)}</span>}
      <ArrowUpRight size={13} color={hov ? t.text : t.textDim}
        style={{ transition: "color 0.15s", flexShrink: 0 }} />
    </a>
  );
}
