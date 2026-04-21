/* ═══ Domain grouping ═══ */
function groupByDomain(bookmarks) {
  const map = {};
  bookmarks.forEach((bm) => {
    const domain = bm._domain || "unknown";
    if (!map[domain]) map[domain] = [];
    map[domain].push(bm);
  });
  return Object.entries(map)
    .map(([domain, items]) => ({ domain, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

/* ═══ Render ═══ */
function render() {
  document.getElementById("siteName").textContent = state.site.name;
  document.body.classList.toggle("admin-mode", !!state.adminMode);
  renderSidebar();
  renderAdminToolbar();
  if (state.showStats) {
    renderHeader([]);
    renderStats();
    safeCreateIcons();
    return;
  }
  const filtered = getFiltered();
  renderHeader(filtered);
  renderContent(filtered);
  safeCreateIcons();
}

function renderAdminToolbar() {
  const existing = document.getElementById("adminToolbar");
  if (!state.adminMode) {
    if (existing) existing.remove();
    return;
  }
  const count = Object.keys(state.adminChanges || {}).length;
  const bar = existing || (() => {
    const el = document.createElement("div");
    el.id = "adminToolbar";
    el.className = "admin-toolbar";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Admin mode");
    document.body.appendChild(el);
    return el;
  })();
  bar.innerHTML = `
    <span class="admin-toolbar-badge"><i data-lucide="shield" style="width:12px;height:12px;"></i>ADMIN</span>
    <span class="admin-toolbar-status">${count} modified</span>
    <button class="admin-toolbar-btn" data-action="admin-copy-yaml" ${count ? "" : "disabled"}>
      <i data-lucide="clipboard" style="width:13px;height:13px;"></i>Copy YAML
    </button>
    <button class="admin-toolbar-btn admin-toolbar-btn-danger" data-action="admin-discard" ${count ? "" : "disabled"}>
      <i data-lucide="trash-2" style="width:13px;height:13px;"></i>Discard
    </button>`;
}

function renderSidebar() {
  // Menu button icon
  const menuBtn = document.getElementById("menuBtn");
  if (isDesktop()) {
    menuBtn.innerHTML = `<i data-lucide="chevron-right" style="width:17px;height:17px;transition:transform 0.2s;${state.sidebarOpen ? "transform:rotate(180deg);" : ""}"></i>`;
  } else {
    menuBtn.innerHTML = `<i data-lucide="menu" style="width:20px;height:20px;"></i>`;
  }

  // Sidebar container state
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
  nav += navItem("all", "layers", "All Resources", state.bookmarks.length, state.activeCol === "all" && !state.showFeatured && !state.activeTag);
  const favCount = state.bookmarks.filter((b) => (state.adminMode ? getEffectiveBookmark(b).featured : b.featured)).length;
  nav += navItem("fav", "star", "Favorites", favCount, state.showFeatured, "");
  nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Collections</div>`;

  state.collections.forEach((col) => {
    const count = state.bookmarks.filter((b) => b.collection === col.id).length;
    const isActive = state.activeCol === col.id && !state.showFeatured && !state.activeTag;
    const hasSubs = col.collectionItem && col.collectionItem.length > 0;
    const isExpanded = state.expandedCols.has(col.id);
    const colId = esc(col.id);
    const chevron = hasSubs
      ? `<button class="nav-chevron${isExpanded ? " expanded" : ""}" data-action="toggle-col-expand" data-col="${colId}" aria-label="Toggle subcollections"><i data-lucide="chevron-right" style="width:13px;height:13px;"></i></button>`
      : "";
    const colAction = hasSubs ? "select-and-toggle-collection" : "select-collection";
    nav += `<div class="nav-collection-wrap">
      <button class="nav-item${isActive && !state.activeSubcol ? " active" : ""}" data-action="${colAction}" data-col="${colId}">
        <span class="nav-icon"><i data-lucide="${col.icon || 'folder'}" style="width:15px;height:15px;"></i></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(col.name)}</span>
        <span class="nav-count">${count}</span>
      </button>${chevron}
    </div>`;
    if (hasSubs && isExpanded) {
      col.collectionItem
        .slice()
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
        .forEach((sub) => {
          const subCount = state.bookmarks.filter((b) => b.collection === col.id && b.collectionItem === sub.id).length;
          const subActive = state.activeSubcol === sub.id;
          nav += `<button class="nav-item nav-subitem${subActive ? " active" : ""}" data-action="select-subcollection" data-sub="${esc(sub.id)}">
            <span class="nav-icon"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↳ ${esc(sub.name)}</span>
            <span class="nav-count">${subCount}</span>
          </button>`;
        });
    }
  });

  const allTags = getAllTags();
  if (allTags.length > 0) {
    nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Tags</div><div class="tags-wrap">`;
    allTags.slice(0, SIDEBAR_TAG_LIMIT).forEach(([tag]) => {
      nav += renderTagChip(tag, "sidebar");
    });
    nav += `</div>`;
  }
  document.getElementById("sidebarNav").innerHTML = nav;
}

function renderHeader(filtered) {
  document.getElementById("gridBtn").className = `view-btn${state.view === "grid" ? " active" : ""}`;
  document.getElementById("listBtn").className = `view-btn${state.view === "list" ? " active" : ""}`;
  document.getElementById("sortDefault").className = `sort-btn${state.sort === "default" ? " active" : ""}`;
  document.getElementById("sortAlpha").className   = `sort-btn${state.sort === "alpha"   ? " active" : ""}`;
  document.getElementById("sortDate").className    = `sort-btn${state.sort === "date"    ? " active" : ""}`;
  document.getElementById("themeIcon").setAttribute("data-lucide", state.theme === "dark" ? "sun" : "moon");
  const statsBtn = document.getElementById("statsBtn");
  if (statsBtn) statsBtn.classList.toggle("active", !!state.showStats);
  document.getElementById("itemCount").textContent = state.showStats
    ? ""
    : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;
  document.getElementById("searchClear").style.display = state.search ? "flex" : "none";
}

function renderContent(filtered) {
  const colData = state.collections.find((c) => c.id === state.activeCol);
  let html = "";

  if (state.fromCache) {
    const when = new Date(state.fromCache.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    html += `<div class="stale-banner fade-up" role="status">
      <i data-lucide="wifi-off" style="width:15px;height:15px;flex-shrink:0;"></i>
      Offline — showing cached data from ${esc(when)}
      <button class="error-retry" data-action="reload-data" style="margin-left:auto;">Retry</button>
    </div>`;
  }

  if (state.error) {
    html += `<div class="error-banner fade-up" role="alert">
      <i data-lucide="alert-circle" style="width:18px;height:18px;color:var(--accent);flex-shrink:0;margin-top:1px;"></i>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);">${esc(state.error)}</p>
        <button class="error-retry" data-action="reload-data">Try again</button>
      </div>
    </div>`;
  }

  let title = "All Resources";
  let subtitle = state.site.description || state.site.tagline;
  if (state.showFeatured) { title = "Favorites"; subtitle = ""; }
  else if (state.activeTag) { title = `Tagged <span class="title-dim">#${esc(state.activeTag)}</span>`; subtitle = ""; }
  else if (state.activeSubcol && colData) {
    const subcol = colData.collectionItem?.find((s) => s.id === state.activeSubcol);
    title = subcol ? esc(subcol.name) : esc(colData.name);
    subtitle = "";
  }
  else if (state.activeCol !== "all" && colData) { title = esc(colData.name); subtitle = ""; }

  html += `<div class="title-section"><h2 class="page-title">${title}</h2>`;
  if (state.activeCol === "all" && !state.showFeatured && !state.activeTag && subtitle) {
    html += `<p class="page-subtitle">${esc(subtitle)}</p>`;
  }
  html += `</div>`;

  if (state.activeTag) {
    html += `<button class="active-tag-chip" data-action="clear-tag">#${esc(state.activeTag)} <i data-lucide="x" style="width:12px;height:12px;"></i></button>`;
  }

  if (filtered.length === 0) {
    html += `<div class="empty-state">
      <i data-lucide="bookmark" style="width:38px;height:38px;opacity:0.3;margin-bottom:14px;"></i>
      <p style="font-size:14px;font-weight:500;">No bookmarks found</p>
      <p style="font-size:12px;margin-top:4px;">Try a different search or filter</p>
    </div>`;
  } else {
    const groups = groupByDomain(filtered);
    let cardIndex = 0;
    groups.forEach((group) => {
      html += `<div class="domain-group">
        <div class="domain-header">
          <img class="domain-favicon favicon" src="${group.items[0]._favicon}" alt="" />
          <span class="domain-name">${esc(group.domain)}</span>
          <span class="domain-count">${group.items.length}</span>
        </div>`;
      if (state.view === "grid" || isMobile()) {
        html += `<div class="grid">`;
        group.items.forEach((bm) => { html += renderCard(bm, cardIndex++); });
        html += `</div>`;
      } else {
        html += `<div class="list">`;
        group.items.forEach((bm) => { html += renderRow(bm, cardIndex++); });
        html += `</div>`;
      }
      html += `</div>`;
    });
  }

  document.getElementById("content").innerHTML = html;
}

function navItem(id, icon, label, count, active, extra = "") {
  const attrs = id === "fav"
    ? `data-action="toggle-favorites"`
    : `data-action="select-collection" data-col="${esc(id)}"`;
  return `<button class="nav-item${active ? " active" : ""}" ${attrs}>
    <span class="nav-icon"><i data-lucide="${icon}" style="width:15px;height:15px;"${extra}></i></span>
    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(label)}</span>
    <span class="nav-count">${count}</span>
  </button>`;
}

function renderAdminBadge(baseBm) {
  if (!state.adminMode) return "";
  const dirty = adminChangeIsDirty(baseBm);
  const eff = getEffectiveBookmark(baseBm);
  const starred = eff.featured;
  const id = esc(baseBm.id);
  return `<span class="admin-controls${dirty ? " dirty" : ""}">
      <button class="admin-btn admin-star${starred ? " on" : ""}" data-action="admin-toggle-featured" data-id="${id}" title="Toggle featured" aria-label="Toggle featured">
        <i data-lucide="star" style="width:13px;height:13px;"></i>
      </button>
      <button class="admin-btn" data-action="admin-edit-tags" data-id="${id}" title="Edit tags" aria-label="Edit tags">
        <i data-lucide="tag" style="width:13px;height:13px;"></i>
      </button>
    </span>`;
}

function renderCard(baseBm, i) {
  const bm = state.adminMode ? getEffectiveBookmark(baseBm) : baseBm;
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:12px;height:12px;"></i>` : "";
  const dead = bm._dead ? `<span class="dead-dot" title="Link may be broken (HTTP ${esc(String(bm._dead.status ?? "error"))})"></span>` : "";
  const tags = bm.tags.slice(0, CARD_TAG_LIMIT).map((t) => renderTagChip(t, "inline")).join("");
  const desc = bm.desc ? `<p class="card-desc">${esc(bm.desc)}</p>` : "";
  const dirty = state.adminMode && adminChangeIsDirty(baseBm) ? " admin-dirty" : "";
  return `<a href="${esc(bm.url)}" class="card fade-up${bm._dead ? " card-dead" : ""}${dirty}" style="animation-delay:${i * 35}ms;" data-action="open-modal" data-id="${esc(bm.id)}" rel="noopener noreferrer">
    <div class="card-top">
      <div class="card-icon"><img class="favicon" src="${bm._favicon}" alt="" /></div>
      <div class="card-info">
        <div class="card-title-row"><span class="card-title">${esc(bm.title)}</span>${fav}${dead}</div>
        <span class="card-domain">${esc(bm._domain)}</span>
      </div>
      ${renderAdminBadge(baseBm)}
      <i data-lucide="arrow-up-right" class="card-arrow" style="width:15px;height:15px;"></i>
    </div>
    ${desc}
    <div class="card-tags">${tags}</div>
  </a>`;
}

function renderRow(baseBm, i) {
  const bm = state.adminMode ? getEffectiveBookmark(baseBm) : baseBm;
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:10px;height:10px;margin-left:5px;vertical-align:middle;"></i>` : "";
  const dead = bm._dead ? `<span class="dead-dot" title="Link may be broken (HTTP ${esc(String(bm._dead.status ?? "error"))})" style="margin-left:5px;vertical-align:middle;"></span>` : "";
  const tags = bm.tags.slice(0, ROW_TAG_LIMIT).map((t) => renderTagChip(t, "row")).join("");
  const dirty = state.adminMode && adminChangeIsDirty(baseBm) ? " admin-dirty" : "";
  return `<a href="${esc(bm.url)}" class="row fade-up${bm._dead ? " card-dead" : ""}${dirty}" style="animation-delay:${i * 20}ms;" data-action="open-modal" data-id="${esc(bm.id)}" rel="noopener noreferrer">
    <div class="row-icon"><img class="favicon" src="${bm._favicon}" alt="" /></div>
    <span class="row-title">${esc(bm.title)}${fav}${dead}</span>
    <span class="row-desc">${esc(bm.desc)}</span>
    ${tags}
    <span class="row-domain">${esc(bm._domain)}</span>
    ${renderAdminBadge(baseBm)}
    <i data-lucide="arrow-up-right" class="row-arrow" style="width:13px;height:13px;"></i>
  </a>`;
}

function renderModalContent(bm, col, subcol) {
  const tags = bm.tags.map((t) => renderTagChip(t, "modal")).join("");
  const meta = [
    col ? esc(col.name) : null,
    subcol ? esc(subcol.name) : null,
    bm.added ? esc(String(bm.added)) : null,
  ].filter(Boolean).join(" · ");
  return `
    <div class="modal-header">
      <div class="modal-icon"><img class="favicon" src="${bm._favicon}" alt="" /></div>
      <div class="modal-title-wrap">
        <h2 class="modal-title" id="modalTitle">${esc(bm.title)}</h2>
        <a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="modal-domain">${esc(bm._domain)}</a>
      </div>
      <button class="modal-close" data-action="close-modal" aria-label="Close"><i data-lucide="x" style="width:18px;height:18px;"></i></button>
    </div>
    ${bm.desc ? `<p class="modal-desc">${esc(bm.desc)}</p>` : ""}
    ${bm._dead ? `<div class="modal-dead" role="status"><span class="dead-dot"></span>Link may be broken — last check returned HTTP ${esc(String(bm._dead.status ?? "error"))}${bm._dead.reason ? ` (${esc(bm._dead.reason)})` : ""}.</div>` : ""}
    ${meta ? `<div class="modal-meta">${meta}</div>` : ""}
    ${bm.tags.length ? `<div class="modal-tags">${tags}</div>` : ""}
    <div class="modal-footer">
      <a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="modal-visit">
        Visit site <i data-lucide="arrow-up-right" style="width:14px;height:14px;"></i>
      </a>
    </div>`;
}

/* ═══ Stats view ═══ */
const SPARKLINE_W = 480;
const SPARKLINE_H = 90;

function renderStatsSparkline(months) {
  if (!months.length) return `<p class="stats-empty">No dated bookmarks yet.</p>`;
  const max = Math.max(...months.map((m) => m.count), 1);
  const n = months.length;
  const step = n > 1 ? SPARKLINE_W / (n - 1) : 0;
  const pts = months.map((m, i) => {
    const x = i * step;
    const y = SPARKLINE_H - (m.count / max) * (SPARKLINE_H - 10) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = `0,${SPARKLINE_H} ${pts} ${SPARKLINE_W},${SPARKLINE_H}`;
  const firstLabel = months[0].month;
  const lastLabel = months[months.length - 1].month;
  const total = months.reduce((s, m) => s + m.count, 0);
  return `
    <div class="stats-sparkline-wrap">
      <svg viewBox="0 0 ${SPARKLINE_W} ${SPARKLINE_H}" preserveAspectRatio="none" class="stats-sparkline" aria-label="Bookmarks added per month">
        <polygon points="${area}" fill="var(--accent)" opacity="0.12" />
        <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" />
      </svg>
      <div class="stats-sparkline-axis">
        <span>${esc(firstLabel)}</span>
        <span>${total} added across ${n} month${n !== 1 ? "s" : ""}</span>
        <span>${esc(lastLabel)}</span>
      </div>
    </div>`;
}

function renderStats() {
  const total = state.bookmarks.length;
  const featured = state.bookmarks.filter((b) => b.featured).length;
  const byCol = statsByCollection();
  const allTags = getAllTags();
  const maxCol = Math.max(...byCol.map((c) => c.count), 1);
  const months = statsByMonth();

  const colRows = byCol.map((c) => {
    const pct = (c.count / maxCol) * 100;
    const color = esc(c.color || "var(--accent)");
    return `<div class="stats-row">
      <span class="stats-row-label">${esc(c.name)}</span>
      <div class="stats-row-bar"><span class="stats-row-fill" style="width:${pct.toFixed(1)}%;background:${color};"></span></div>
      <span class="stats-row-count">${c.count}</span>
    </div>`;
  }).join("");

  const tagChips = allTags.slice(0, 30).map(([tag, count]) =>
    `<button class="stats-tag-chip" data-action="select-tag" data-tag="${esc(tag)}">
       <span>${esc(tag)}</span><span class="stats-tag-count">${count}</span>
     </button>`
  ).join("");

  document.getElementById("content").innerHTML = `
    <div class="title-section">
      <h2 class="page-title">Stats</h2>
      <p class="page-subtitle">Overview of your bookmark collection.</p>
    </div>

    <div class="stats-summary">
      <div class="stats-card"><span class="stats-card-value">${total}</span><span class="stats-card-label">Total</span></div>
      <div class="stats-card"><span class="stats-card-value">${state.collections.length}</span><span class="stats-card-label">Collections</span></div>
      <div class="stats-card"><span class="stats-card-value">${allTags.length}</span><span class="stats-card-label">Tags</span></div>
      <div class="stats-card"><span class="stats-card-value">${featured}</span><span class="stats-card-label">Favorites</span></div>
    </div>

    <section class="stats-section">
      <h3 class="stats-heading">Added per month</h3>
      ${renderStatsSparkline(months)}
    </section>

    <section class="stats-section">
      <h3 class="stats-heading">By collection</h3>
      <div class="stats-rows">${colRows}</div>
    </section>

    <section class="stats-section">
      <h3 class="stats-heading">Top tags</h3>
      <div class="stats-tags">${tagChips || `<p class="stats-empty">No tags yet.</p>`}</div>
    </section>`;
}
