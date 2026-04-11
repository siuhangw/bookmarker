import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, FolderOpen, Tag, Trash2, X, Upload, Download,
  ChevronRight, ExternalLink, Grid3X3, List, Edit2, Check, Bookmark,
  MoreVertical, FolderPlus, Hash, Globe, Loader2, ChevronDown
} from "lucide-react";

const STORAGE_KEY = "bookmarks-app-data";

const DEFAULT_COLORS = [
  "#E8453C", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#06B6D6", "#84CC16"
];

const DEFAULT_DATA = {
  collections: [
    { id: "unsorted", name: "Unsorted", color: "#94a3b8", createdAt: Date.now() }
  ],
  bookmarks: []
};

// Favicon helper
const getFavicon = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch { return null; }
};

// Extract domain
const getDomain = (url) => {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
};

// Parse browser bookmarks HTML
const parseBookmarksHTML = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const links = doc.querySelectorAll("a");
  const results = [];
  links.forEach((a) => {
    const url = a.getAttribute("href");
    const title = a.textContent.trim();
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      // Try to get folder name from parent DL > DT > H3
      let folder = null;
      let parent = a.parentElement;
      while (parent) {
        if (parent.tagName === "DL") {
          const prev = parent.previousElementSibling;
          if (prev && prev.tagName === "H3") {
            folder = prev.textContent.trim();
            break;
          }
        }
        parent = parent.parentElement;
      }
      results.push({ url, title: title || getDomain(url), folder });
    }
  });
  return results;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function BookmarkManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tagFilter, setTagFilter] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const fileInputRef = useRef(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          setData(JSON.parse(result.value));
        } else {
          setData(DEFAULT_DATA);
        }
      } catch {
        setData(DEFAULT_DATA);
      }
      setLoading(false);
    })();
  }, []);

  // Save data
  const save = useCallback(async (newData) => {
    setData(newData);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) { console.error("Save failed:", e); }
  }, []);

  // Add bookmark
  const addBookmark = (url, title, collectionId, tags = []) => {
    const bm = {
      id: uid(),
      url: url.startsWith("http") ? url : `https://${url}`,
      title: title || getDomain(url),
      favicon: getFavicon(url.startsWith("http") ? url : `https://${url}`),
      collectionId: collectionId || "unsorted",
      tags,
      createdAt: Date.now()
    };
    save({ ...data, bookmarks: [bm, ...data.bookmarks] });
  };

  // Update bookmark
  const updateBookmark = (id, updates) => {
    save({
      ...data,
      bookmarks: data.bookmarks.map((b) => b.id === id ? { ...b, ...updates } : b)
    });
  };

  // Delete bookmark
  const deleteBookmark = (id) => {
    save({ ...data, bookmarks: data.bookmarks.filter((b) => b.id !== id) });
  };

  // Add collection
  const addCollection = (name, color) => {
    const col = { id: uid(), name, color: color || DEFAULT_COLORS[data.collections.length % DEFAULT_COLORS.length], createdAt: Date.now() };
    save({ ...data, collections: [...data.collections, col] });
    return col.id;
  };

  // Delete collection
  const deleteCollection = (id) => {
    if (id === "unsorted") return;
    save({
      ...data,
      collections: data.collections.filter((c) => c.id !== id),
      bookmarks: data.bookmarks.map((b) => b.collectionId === id ? { ...b, collectionId: "unsorted" } : b)
    });
    if (activeCollection === id) setActiveCollection("all");
  };

  // Rename collection
  const renameCollection = (id, name) => {
    save({
      ...data,
      collections: data.collections.map((c) => c.id === id ? { ...c, name } : c)
    });
  };

  // Import bookmarks from HTML
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseBookmarksHTML(ev.target.result);
      const newCollections = [...data.collections];
      const newBookmarks = [...data.bookmarks];
      const folderMap = {};

      // Map existing collections
      data.collections.forEach((c) => { folderMap[c.name.toLowerCase()] = c.id; });

      parsed.forEach((item) => {
        let colId = "unsorted";
        if (item.folder) {
          const key = item.folder.toLowerCase();
          if (folderMap[key]) {
            colId = folderMap[key];
          } else {
            const col = {
              id: uid(), name: item.folder,
              color: DEFAULT_COLORS[newCollections.length % DEFAULT_COLORS.length],
              createdAt: Date.now()
            };
            newCollections.push(col);
            folderMap[key] = col.id;
            colId = col.id;
          }
        }
        // Skip duplicates
        if (!newBookmarks.some((b) => b.url === item.url)) {
          newBookmarks.unshift({
            id: uid(), url: item.url, title: item.title,
            favicon: getFavicon(item.url), collectionId: colId,
            tags: [], createdAt: Date.now()
          });
        }
      });
      save({ collections: newCollections, bookmarks: newBookmarks });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "bookmarks-export.json";
    a.click(); URL.revokeObjectURL(url);
  };

  // Get all unique tags
  const allTags = data ? [...new Set(data.bookmarks.flatMap((b) => b.tags))] : [];

  // Filter bookmarks
  const filtered = data ? data.bookmarks.filter((b) => {
    const matchesCollection = activeCollection === "all" || b.collectionId === activeCollection;
    const matchesTag = !tagFilter || b.tags.includes(tagFilter);
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCollection && matchesTag && matchesSearch;
  }) : [];

  if (loading || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f0f", color: "#e0e0e0", fontFamily: "'DM Sans', sans-serif" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const getCollection = (id) => data.collections.find((c) => c.id === id);
  const countFor = (id) => data.bookmarks.filter((b) => b.collectionId === id).length;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --bg: #0c0c0c; --bg-card: #161616; --bg-sidebar: #111111;
          --bg-hover: #1e1e1e; --bg-input: #1a1a1a; --bg-modal: #181818;
          --border: #262626; --border-light: #333;
          --text: #e8e8e8; --text-muted: #888; --text-dim: #555;
          --accent: #E8453C; --accent-hover: #d63c34;
          --tag-bg: #1f1f1f; --tag-text: #aaa;
          --shadow: 0 16px 48px rgba(0,0,0,0.5);
          --radius: 10px; --radius-sm: 6px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
        input, textarea, select, button { font-family: inherit; }
        a { color: inherit; text-decoration: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .fade-in { animation: fadeIn 0.25s ease both; }
        .modal-in { animation: modalIn 0.2s ease both; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
        {/* Sidebar */}
        <aside style={{
          width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0,
          background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", transition: "all 0.2s ease",
          overflow: "hidden"
        }}>
          {/* Logo */}
          <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Bookmark size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>Markly</span>
          </div>

          {/* Collections */}
          <div style={{ flex: 1, overflow: "auto", padding: "0 12px" }} className="scrollbar-thin">
            <div style={{ padding: "8px 8px 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
              Collections
            </div>

            {/* All */}
            <SidebarItem
              active={activeCollection === "all" && !tagFilter}
              onClick={() => { setActiveCollection("all"); setTagFilter(null); }}
              icon={<Grid3X3 size={15} />}
              label="All Bookmarks"
              count={data.bookmarks.length}
            />

            {data.collections.map((col) => (
              <SidebarItem
                key={col.id}
                active={activeCollection === col.id && !tagFilter}
                onClick={() => { setActiveCollection(col.id); setTagFilter(null); }}
                icon={<div style={{ width: 12, height: 12, borderRadius: 3, background: col.color, flexShrink: 0 }} />}
                label={editingCollection === col.id ? (
                  <input
                    autoFocus
                    defaultValue={col.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { renameCollection(col.id, e.target.value || col.name); setEditingCollection(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { renameCollection(col.id, e.target.value || col.name); setEditingCollection(null); } }}
                    style={{
                      background: "var(--bg-input)", border: "1px solid var(--border-light)",
                      borderRadius: 4, padding: "2px 6px", color: "var(--text)", fontSize: 13, width: "100%", outline: "none"
                    }}
                  />
                ) : col.name}
                count={countFor(col.id)}
                onContextMenu={(e) => {
                  if (col.id === "unsorted") return;
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: "collection", id: col.id });
                }}
              />
            ))}

            <button
              onClick={() => setShowCollectionModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", background: "none", border: "none",
                color: "var(--text-dim)", fontSize: 13, cursor: "pointer",
                borderRadius: "var(--radius-sm)", transition: "color 0.15s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
            >
              <FolderPlus size={15} /> New Collection
            </button>

            {/* Tags */}
            {allTags.length > 0 && (
              <>
                <div style={{ padding: "16px 8px 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
                  Tags
                </div>
                {allTags.map((tag) => (
                  <SidebarItem
                    key={tag}
                    active={tagFilter === tag}
                    onClick={() => { setTagFilter(tagFilter === tag ? null : tag); setActiveCollection("all"); }}
                    icon={<Hash size={14} color="var(--text-dim)" />}
                    label={tag}
                    count={data.bookmarks.filter((b) => b.tags.includes(tag)).length}
                  />
                ))}
              </>
            )}
          </div>

          {/* Sidebar Footer */}
          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
            <input type="file" accept=".html,.htm" ref={fileInputRef} onChange={handleImport} style={{ display: "none" }} />
            <SidebarBtn icon={<Upload size={14} />} label="Import" onClick={() => fileInputRef.current?.click()} />
            <SidebarBtn icon={<Download size={14} />} label="Export" onClick={handleExport} />
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <header style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 24px",
            borderBottom: "1px solid var(--border)", flexShrink: 0
          }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4
            }}>
              <ChevronRight size={18} style={{ transform: sidebarOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-input)", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", padding: "0 12px"
            }}>
              <Search size={15} color="var(--text-dim)" />
              <input
                placeholder="Search bookmarks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, padding: "10px 0", background: "none", border: "none",
                  color: "var(--text)", fontSize: 14, outline: "none"
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 2, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", padding: 3 }}>
              <ViewToggle active={viewMode === "grid"} onClick={() => setViewMode("grid")} icon={<Grid3X3 size={14} />} />
              <ViewToggle active={viewMode === "list"} onClick={() => setViewMode("list")} icon={<List size={14} />} />
            </div>

            <button
              onClick={() => { setEditingBookmark(null); setShowAddModal(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--accent)", color: "#fff", border: "none",
                padding: "9px 16px", borderRadius: "var(--radius-sm)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "background 0.15s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
            >
              <Plus size={15} /> Add
            </button>
          </header>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 24 }} className="scrollbar-thin">
            {/* Active filter label */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {tagFilter ? `#${tagFilter}` : activeCollection === "all" ? "All Bookmarks" : getCollection(activeCollection)?.name}
              </h2>
              <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>{filtered.length}</span>
              {tagFilter && (
                <button onClick={() => setTagFilter(null)} style={{
                  background: "var(--tag-bg)", border: "none", color: "var(--tag-text)",
                  fontSize: 11, padding: "2px 8px", borderRadius: 20, cursor: "pointer"
                }}>Clear</button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "80px 20px", color: "var(--text-dim)"
              }}>
                <Bookmark size={40} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 500 }}>No bookmarks yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Click "Add" or import from your browser</p>
              </div>
            ) : viewMode === "grid" ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12
              }}>
                {filtered.map((bm, i) => (
                  <BookmarkCard key={bm.id} bm={bm} collection={getCollection(bm.collectionId)}
                    onEdit={() => { setEditingBookmark(bm); setShowAddModal(true); }}
                    onDelete={() => deleteBookmark(bm.id)}
                    onTagClick={(t) => setTagFilter(t)}
                    delay={i * 30}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {filtered.map((bm, i) => (
                  <BookmarkRow key={bm.id} bm={bm} collection={getCollection(bm.collectionId)}
                    onEdit={() => { setEditingBookmark(bm); setShowAddModal(true); }}
                    onDelete={() => deleteBookmark(bm.id)}
                    onTagClick={(t) => setTagFilter(t)}
                    delay={i * 20}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setContextMenu(null)} />
          <div className="modal-in" style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 100,
            background: "var(--bg-modal)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow)", padding: 4, minWidth: 140
          }}>
            <CtxItem label="Rename" onClick={() => { setEditingCollection(contextMenu.id); setContextMenu(null); }} />
            <CtxItem label="Delete" danger onClick={() => { deleteCollection(contextMenu.id); setContextMenu(null); }} />
          </div>
        </>
      )}

      {/* Add/Edit Bookmark Modal */}
      {showAddModal && (
        <Modal onClose={() => { setShowAddModal(false); setEditingBookmark(null); }}>
          <BookmarkForm
            bookmark={editingBookmark}
            collections={data.collections}
            onSubmit={(url, title, colId, tags) => {
              if (editingBookmark) {
                updateBookmark(editingBookmark.id, { url, title, collectionId: colId, tags, favicon: getFavicon(url) });
              } else {
                addBookmark(url, title, colId, tags);
              }
              setShowAddModal(false);
              setEditingBookmark(null);
            }}
            onClose={() => { setShowAddModal(false); setEditingBookmark(null); }}
          />
        </Modal>
      )}

      {/* New Collection Modal */}
      {showCollectionModal && (
        <Modal onClose={() => setShowCollectionModal(false)}>
          <CollectionForm
            colors={DEFAULT_COLORS}
            onSubmit={(name, color) => { addCollection(name, color); setShowCollectionModal(false); }}
            onClose={() => setShowCollectionModal(false)}
          />
        </Modal>
      )}
    </>
  );
}

/* ---- Sub-components ---- */

function SidebarItem({ active, onClick, icon, label, count, onContextMenu }) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "8px 10px", background: active ? "var(--bg-hover)" : "none",
        border: "none", color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
        borderRadius: "var(--radius-sm)", transition: "all 0.12s", textAlign: "left"
      }}
    >
      {icon}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
      )}
    </button>
  );
}

function SidebarBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
      color: "var(--text-muted)", fontSize: 12, padding: "7px 0", cursor: "pointer"
    }}>
      {icon} {label}
    </button>
  );
}

function ViewToggle({ active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "var(--bg-hover)" : "none", border: "none",
      color: active ? "var(--text)" : "var(--text-dim)", cursor: "pointer",
      padding: "5px 8px", borderRadius: 4
    }}>
      {icon}
    </button>
  );
}

function BookmarkCard({ bm, collection, onEdit, onDelete, onTagClick, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="fade-in"
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 16, cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        animationDelay: `${delay}ms`,
        borderColor: hovered ? "var(--border-light)" : "var(--border)",
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.2)" : "none",
        position: "relative"
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        {bm.favicon ? (
          <img src={bm.favicon} alt="" style={{ width: 20, height: 20, borderRadius: 4, marginTop: 2 }} onError={(e) => e.target.style.display = "none"} />
        ) : (
          <Globe size={18} color="var(--text-dim)" style={{ marginTop: 2 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={bm.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {bm.title}
          </a>
          <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
            {getDomain(bm.url)}
          </span>
        </div>
        {hovered && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <IconBtn icon={<Edit2 size={12} />} onClick={(e) => { e.stopPropagation(); onEdit(); }} />
            <IconBtn icon={<Trash2 size={12} />} onClick={(e) => { e.stopPropagation(); onDelete(); }} danger />
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {collection && (
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: collection.color + "18", color: collection.color, fontWeight: 500
          }}>
            {collection.name}
          </span>
        )}
        {bm.tags.map((t) => (
          <button key={t} onClick={(e) => { e.stopPropagation(); onTagClick(t); }} style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: "var(--tag-bg)", color: "var(--tag-text)", border: "none", cursor: "pointer"
          }}>
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}

function BookmarkRow({ bm, collection, onEdit, onDelete, onTagClick, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="fade-in"
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
        background: hovered ? "var(--bg-card)" : "transparent",
        borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "background 0.12s",
        animationDelay: `${delay}ms`
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {bm.favicon ? (
        <img src={bm.favicon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} onError={(e) => e.target.style.display = "none"} />
      ) : (
        <Globe size={16} color="var(--text-dim)" />
      )}
      <a href={bm.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {bm.title}
      </a>
      <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
        {getDomain(bm.url)}
      </span>
      {collection && (
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: collection.color + "18", color: collection.color, fontWeight: 500, flexShrink: 0 }}>
          {collection.name}
        </span>
      )}
      {bm.tags.map((t) => (
        <button key={t} onClick={(e) => { e.stopPropagation(); onTagClick(t); }} style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 20,
          background: "var(--tag-bg)", color: "var(--tag-text)", border: "none", cursor: "pointer", flexShrink: 0
        }}>
          #{t}
        </button>
      ))}
      {hovered && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <IconBtn icon={<Edit2 size={12} />} onClick={(e) => { e.stopPropagation(); onEdit(); }} />
          <IconBtn icon={<Trash2 size={12} />} onClick={(e) => { e.stopPropagation(); onDelete(); }} danger />
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4,
      color: danger ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
      padding: 5, display: "flex", alignItems: "center"
    }}>
      {icon}
    </button>
  );
}

function CtxItem({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", padding: "7px 12px", background: "none", border: "none",
      color: danger ? "var(--accent)" : "var(--text)", fontSize: 13, cursor: "pointer",
      textAlign: "left", borderRadius: 4
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
    >
      {label}
    </button>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div className="modal-in" onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-modal)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
        width: "100%", maxWidth: 440, padding: 24
      }}>
        {children}
      </div>
    </div>
  );
}

function BookmarkForm({ bookmark, collections, onSubmit, onClose }) {
  const [url, setUrl] = useState(bookmark?.url || "");
  const [title, setTitle] = useState(bookmark?.title || "");
  const [colId, setColId] = useState(bookmark?.collectionId || "unsorted");
  const [tagStr, setTagStr] = useState(bookmark?.tags?.join(", ") || "");

  const handleSubmit = () => {
    if (!url.trim()) return;
    const tags = tagStr.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
    onSubmit(url.trim(), title.trim(), colId, tags);
  };

  return (
    <>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
        {bookmark ? "Edit Bookmark" : "Add Bookmark"}
      </h3>
      <FormField label="URL" value={url} onChange={setUrl} placeholder="https://example.com" autoFocus />
      <FormField label="Title" value={title} onChange={setTitle} placeholder="Page title (auto-filled if blank)" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Collection</label>
        <select value={colId} onChange={(e) => setColId(e.target.value)} style={{
          width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 13, outline: "none"
        }}>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <FormField label="Tags" value={tagStr} onChange={setTagStr} placeholder="design, dev, inspiration (comma-separated)" />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={{
          padding: "9px 18px", background: "var(--bg-hover)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer"
        }}>Cancel</button>
        <button onClick={handleSubmit} style={{
          padding: "9px 18px", background: "var(--accent)", border: "none",
          borderRadius: "var(--radius-sm)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"
        }}>{bookmark ? "Save" : "Add Bookmark"}</button>
      </div>
    </>
  );
}

function CollectionForm({ colors, onSubmit, onClose }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  return (
    <>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>New Collection</h3>
      <FormField label="Name" value={name} onChange={setName} placeholder="Collection name" autoFocus />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Color</label>
        <div style={{ display: "flex", gap: 8 }}>
          {colors.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent",
              cursor: "pointer", transition: "border-color 0.12s"
            }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={{
          padding: "9px 18px", background: "var(--bg-hover)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer"
        }}>Cancel</button>
        <button onClick={() => { if (name.trim()) onSubmit(name.trim(), color); }} style={{
          padding: "9px 18px", background: "var(--accent)", border: "none",
          borderRadius: "var(--radius-sm)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"
        }}>Create</button>
      </div>
    </>
  );
}

function FormField({ label, value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        style={{
          width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 13, outline: "none"
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--border-light)"}
        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
      />
    </div>
  );
}
