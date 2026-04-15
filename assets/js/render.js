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
  nav += navItem("all", "layers", "All Resources", state.bookmarks.length, state.activeCol === "all" && !state.showFeatured && !state.activeTag);
  const favCount = state.bookmarks.filter((b) => b.featured).length;
  nav += navItem("fav", "star", "Favorites", favCount, state.showFeatured, "");
  nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Collections</div>`;

  state.collections.forEach((col) => {
    const count = state.bookmarks.filter((b) => b.collection === col.id).length;
    const isActive = state.activeCol === col.id && !state.showFeatured && !state.activeTag;
    const hasSubs = col.subcollections && col.subcollections.length > 0;
    const isExpanded = state.expandedCols.has(col.id);
    const chevron = hasSubs
      ? `<button class="nav-chevron${isExpanded ? " expanded" : ""}" onclick="toggleColExpand('${col.id}')" aria-label="Toggle subcollections"><i data-lucide="chevron-right" style="width:13px;height:13px;"></i></button>`
      : "";
    nav += `<div class="nav-collection-wrap">
      <button class="nav-item${isActive && !state.activeSubcol ? " active" : ""}" onclick="${hasSubs ? "selectAndToggleCollection" : "selectCollection"}('${col.id}')">
        <span class="nav-icon"><i data-lucide="${col.icon || 'folder'}" style="width:15px;height:15px;"></i></span>
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

  if (allTags.length > 0) {
    nav += `<div class="sidebar-hr"></div><div class="sidebar-label">Tags</div><div class="tags-wrap">`;
    allTags.slice(0, 20).forEach(([tag]) => {
      nav += `<button class="tag-btn${state.activeTag === tag ? " active" : ""}" onclick="selectTag('${esc(tag)}')">${esc(tag)}</button>`;
    });
    nav += `</div>`;
  }
  document.getElementById("sidebarNav").innerHTML = nav;

  // Header controls
  document.getElementById("gridBtn").className = `view-btn${state.view === "grid" ? " active" : ""}`;
  document.getElementById("listBtn").className = `view-btn${state.view === "list" ? " active" : ""}`;
  document.getElementById("sortDefault").className = `sort-btn${state.sort === "default" ? " active" : ""}`;
  document.getElementById("sortAlpha").className   = `sort-btn${state.sort === "alpha"   ? " active" : ""}`;
  document.getElementById("sortDate").className    = `sort-btn${state.sort === "date"    ? " active" : ""}`;
  document.getElementById("themeIcon").setAttribute("data-lucide", state.theme === "dark" ? "sun" : "moon");
  document.getElementById("itemCount").textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;
  document.getElementById("searchClear").style.display = state.search ? "flex" : "none";

  // Content
  let html = "";

  if (state.error) {
    html += `<div class="error-banner fade-up">
      <i data-lucide="alert-circle" style="width:18px;height:18px;color:var(--accent);flex-shrink:0;margin-top:1px;"></i>
      <div>
        <p style="font-size:12px;color:var(--text-secondary);">${esc(state.error)}</p>
        <button class="error-retry" onclick="reloadData()">Try again</button>
      </div>
    </div>`;
  }

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

  if (state.activeTag) {
    html += `<button class="active-tag-chip" onclick="clearTag()">#${esc(state.activeTag)} <i data-lucide="x" style="width:12px;height:12px;"></i></button>`;
  }

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
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:12px;height:12px;"></i>` : "";
  let tags = "";
  bm.tags.slice(0, 3).forEach((t) => {
    tags += `<button class="inline-tag" onclick="event.preventDefault();event.stopPropagation();selectTag('${esc(t)}')">#${esc(t)}</button>`;
  });
  const desc = bm.desc ? `<p class="card-desc">${esc(bm.desc)}</p>` : "";
  return `<a href="${esc(bm.url)}" class="card fade-up" style="animation-delay:${i * 35}ms;" onclick="event.preventDefault();openModal('${bm.id}');" rel="noopener noreferrer">
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
  const fav = bm.featured ? `<i data-lucide="star" class="star-icon" style="width:10px;height:10px;margin-left:5px;vertical-align:middle;"></i>` : "";
  let tags = "";
  bm.tags.slice(0, 2).forEach((t) => {
    tags += `<button class="row-tag" onclick="event.preventDefault();event.stopPropagation();selectTag('${esc(t)}')">#${esc(t)}</button>`;
  });
  return `<a href="${esc(bm.url)}" class="row fade-up" style="animation-delay:${i * 20}ms;" onclick="event.preventDefault();openModal('${bm.id}');" rel="noopener noreferrer">
    <div class="row-icon"><img src="${getFavicon(bm.url)}" alt="" onerror="this.style.display='none'" /></div>
    <span class="row-title">${esc(bm.title)}${fav}</span>
    <span class="row-desc">${esc(bm.desc)}</span>
    ${tags}
    <span class="row-domain">${esc(getDomain(bm.url))}</span>
    <i data-lucide="arrow-up-right" class="row-arrow" style="width:13px;height:13px;"></i>
  </a>`;
}

function renderModalContent(bm, col, subcol) {
  const tags = bm.tags.map((t) =>
    `<button class="tag-btn" onclick="closeModal();selectTag('${esc(t)}')">#${esc(t)}</button>`
  ).join("");
  const meta = [
    col ? esc(col.name) : null,
    subcol ? esc(subcol.name) : null,
    bm.added ? esc(String(bm.added)) : null,
  ].filter(Boolean).join(" · ");
  return `
    <div class="modal-header">
      <div class="modal-icon"><img src="${getFavicon(bm.url)}" alt="" onerror="this.style.display='none'" /></div>
      <div class="modal-title-wrap">
        <h2 class="modal-title">${esc(bm.title)}</h2>
        <a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="modal-domain">${esc(getDomain(bm.url))}</a>
      </div>
      <button class="modal-close" onclick="closeModal()"><i data-lucide="x" style="width:18px;height:18px;"></i></button>
    </div>
    ${bm.desc ? `<p class="modal-desc">${esc(bm.desc)}</p>` : ""}
    ${meta ? `<div class="modal-meta">${meta}</div>` : ""}
    ${bm.tags.length ? `<div class="modal-tags">${tags}</div>` : ""}
    <div class="modal-footer">
      <a href="${esc(bm.url)}" target="_blank" rel="noopener noreferrer" class="modal-visit">
        Visit site <i data-lucide="arrow-up-right" style="width:14px;height:14px;"></i>
      </a>
    </div>`;
}
