/* ═══ Export ═══
   Loads data/bookmarks.yaml and converts it to JSON / OPML / RSS / CSV.
   Standalone — does not reuse index.html state; just needs REPO_BASE from
   config.js. */

const status = document.getElementById("status");
const formats = document.getElementById("formats");
const previewWrap = document.getElementById("previewWrap");
const previewBody = document.getElementById("previewBody");
const previewLabel = document.getElementById("previewLabel");

let bookmarks = [];
let collections = [];
let meta = {};

const escXml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// CSV: wrap in quotes, double any embedded quote. Wrap all fields to keep it
// simple (Excel tolerates extra quoting; unquoted fields with commas break).
const csvField = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;

function flattenYaml(parsed) {
  meta = parsed.meta || {};
  collections = (parsed.collectionList || []).slice()
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  bookmarks = (parsed.bookmarkList || []).flatMap((g) =>
    (g.bookmarkItem || []).map((bm) => ({ ...bm, domain: g.domain }))
  );
}

/* ─── Generators ─── */
function toJson() {
  return JSON.stringify({
    meta,
    collections,
    bookmarks: bookmarks.map((bm) => ({
      id: bm.id,
      title: bm.title,
      url: bm.url,
      desc: bm.desc || "",
      collection: bm.collection,
      collectionItem: bm.collectionItem || null,
      tags: bm.tags || [],
      featured: !!bm.featured,
      added: bm.added || null,
    })),
  }, null, 2);
}

function toOpml() {
  const title = escXml(meta.title || "Bookmarks");
  const byCol = {};
  collections.forEach((c) => { byCol[c.id] = []; });
  bookmarks.forEach((bm) => {
    if (!byCol[bm.collection]) byCol[bm.collection] = [];
    byCol[bm.collection].push(bm);
  });
  const now = new Date().toUTCString();
  const outlines = collections.map((c) => {
    const items = (byCol[c.id] || []).map((bm) =>
      `      <outline type="link" text="${escXml(bm.title)}" title="${escXml(bm.title)}" url="${escXml(bm.url)}" />`
    ).join("\n");
    return `    <outline text="${escXml(c.name)}" title="${escXml(c.name)}">\n${items}\n    </outline>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${title}</title>
    <dateCreated>${now}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

function toRss(limit = 50) {
  const sorted = bookmarks.filter((b) => b.added).sort((a, b) => String(b.added).localeCompare(String(a.added)));
  const recent = sorted.slice(0, limit);
  const title = escXml(meta.title || "Bookmarks");
  const description = escXml(meta.description || meta.tagline || "Recently added bookmarks");
  const link = "https://siuhangw.github.io/bookmarker/";
  const items = recent.map((bm) => {
    const pubDate = new Date(`${bm.added}T00:00:00Z`).toUTCString();
    const cats = (bm.tags || []).map((t) => `      <category>${escXml(t)}</category>`).join("\n");
    return `    <item>
      <title>${escXml(bm.title)}</title>
      <link>${escXml(bm.url)}</link>
      <guid isPermaLink="false">markly-${escXml(String(bm.id))}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escXml(bm.desc || "")}</description>
${cats}
    </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${title} — Recently Added</title>
    <link>${escXml(link)}</link>
    <description>${description}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function toCsv() {
  const cols = ["id", "title", "url", "desc", "collection", "collectionItem", "tags", "featured", "added"];
  const header = cols.map(csvField).join(",");
  const rows = bookmarks.map((bm) => [
    bm.id, bm.title, bm.url, bm.desc || "",
    bm.collection || "", bm.collectionItem || "",
    (bm.tags || []).join("|"),
    bm.featured ? "true" : "false",
    bm.added || "",
  ].map(csvField).join(","));
  return [header, ...rows].join("\n") + "\n";
}

/* ─── Download / preview ─── */
const FORMATS = {
  json: { gen: toJson, mime: "application/json",      ext: "json", label: "JSON" },
  opml: { gen: toOpml, mime: "text/x-opml+xml",       ext: "opml", label: "OPML" },
  rss:  { gen: toRss,  mime: "application/rss+xml",   ext: "xml",  label: "RSS" },
  csv:  { gen: toCsv,  mime: "text/csv",              ext: "csv",  label: "CSV" },
};

function download(format) {
  const f = FORMATS[format];
  if (!f) return;
  const blob = new Blob([f.gen()], { type: f.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bookmarks.${f.ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function preview(format) {
  const f = FORMATS[format];
  if (!f) return;
  previewLabel.textContent = `${f.label} preview (${bookmarks.length} bookmarks)`;
  const text = f.gen();
  // Cap preview so very large files don't freeze the browser.
  previewBody.textContent = text.length > 50_000 ? text.slice(0, 50_000) + "\n\n… truncated" : text;
  previewWrap.hidden = false;
  previewWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyPreview() {
  try {
    await navigator.clipboard.writeText(previewBody.textContent);
    const btn = document.querySelector('[data-action="copy"]');
    if (btn) { const old = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = old; }, 1200); }
  } catch { /* user denied — nothing to do */ }
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "download") download(el.dataset.format);
  else if (action === "preview") preview(el.dataset.format);
  else if (action === "copy") copyPreview();
  else if (action === "close-preview") { previewWrap.hidden = true; }
});

/* ─── Load ─── */
(async function init() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const url = isLocal ? "./data/bookmarks.yaml" : `${REPO_BASE}/data/bookmarks.yaml`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    flattenYaml(jsyaml.load(await res.text()));
    status.textContent = `Ready — ${bookmarks.length} bookmarks across ${collections.length} collections.`;
    formats.hidden = false;
  } catch (e) {
    status.textContent = `Error loading bookmarks: ${e.message}`;
    status.classList.add("export-status-error");
  }
})();
