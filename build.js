#!/usr/bin/env node
/*
  kierawestphal.com — site builder
  ---------------------------------
  Reads everything in /content and writes a finished website to /dist.
  Needs Node.js 18 or newer. First time only: npm install
  Then:  npm run build      (or: node build.js)

  You should never need to edit this file to change text or images.
  Edit the files in /content instead (see README.md).
*/

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { marked } = require("marked");

const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content");
const THEME = path.join(ROOT, "theme");
const OUT = path.join(ROOT, "dist");

/* ---------- small helpers ---------- */

const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyDir(src, dest) {
  if (!exists(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (!entry.name.endsWith(".md") && !entry.name.startsWith(".")) fs.copyFileSync(s, d);
  }
}

// When the site is served from a sub-folder (e.g. username.github.io/website/ before the custom
// domain is connected), BASE_PATH is "/website" and every internal link is prefixed with it.
const BASE = (process.env.BASE_PATH || "").replace(/\/$/, "");
// CloudCannon on-page editing. "npm run build:cloudcannon" sets CLOUDCANNON_EDIT=1, which adds
// data-editable markers so text and images can be clicked and edited in CloudCannon's Visual Editor.
// The normal build (GitHub Pages, the live site) leaves EDIT off and its HTML is unchanged.
const EDIT = process.env.CLOUDCANNON_EDIT === "1";
const ed = (attrs) => (EDIT ? " " + attrs : "");
const attr = (s) => escapeHtml(String(s));
// a field in another content file, e.g. a project card on the homepage
const fileProp = (dir, slug, key) => `@file[/content/${dir}/${slug}.md].${key}`;
// Cross-file bindings (@file[...]) don't resolve in CloudCannon for this site, so list pages
// (homepage, Work, Journal) carry no markers; each item is edited on its own page instead.
const edText = (prop, type = "span") => (String(prop).startsWith("@file") ? "" : ed(`data-editable="text" data-type="${type}" data-prop="${attr(prop)}"`));
// CloudCannon only edits image fields that hold text, so a marker is added only when the field
// exists in the file (an empty "" is fine); otherwise the image is left as plain, unmarked HTML.
const valueAt = (obj, key) => String(key).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isText = (obj, key) => typeof valueAt(obj, key) === "string";
// obj = the content file's data; srcKey/altKey = keys inside it; prefix = "" or an @file[...] prefix
function edImage(obj, srcKey, altKey, prefix = "") {
  if (!EDIT || prefix || !isText(obj, srcKey)) return "";
  const alt = altKey && isText(obj, altKey) ? ` data-prop-alt="${attr(prefix + altKey)}"` : "";
  return ` data-editable="image" data-prop-src="${attr(prefix + srcKey)}"${alt}`;
}

const withBase = (html) =>
  BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`).replace(/url\("\/(?!\/)/g, `url("${BASE}/`) : html;

// Placeholder and other small SVG images are written straight into the page instead of <img>,
// so they always show (no separate file to load). Large SVGs (the portrait) stay as <img>.
const svgCache = {};
function inlineSvgImages(html) {
  if (EDIT) return html; // the Visual Editor needs real <img> tags to swap images
  let copy = 0;
  return html.replace(/<img\b([^>]*?)\bsrc="(\/images\/[^"]+\.svg)"([^>]*)>/g, (tag, before, src, after) => {
    const file = path.join(CONTENT, src);
    if (!exists(file) || fs.statSync(file).size > 50000) return tag;
    let svg = (svgCache[file] ||= read(file).replace(/<\?xml[\s\S]*?\?>\s*/, "").trim());
    // the same logo can appear more than once on a page, so give each copy its own internal ids
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    if (ids.length) {
      const n = ++copy;
      for (const id of ids) svg = svg.split(`"${id}"`).join(`"${id}-${n}"`).split(`#${id}"`).join(`#${id}-${n}"`).split(`#${id})`).join(`#${id}-${n})`);
    }
    const attrs = before + " " + after;
    const cls = (attrs.match(/\bclass="([^"]*)"/) || [])[1];
    const alt = (attrs.match(/\balt="([^"]*)"/) || [])[1] || "";
    const a11y = alt ? `role="img" aria-label="${alt}"` : `aria-hidden="true"`;
    // only the outermost <svg> loses its fixed size (nested <svg> frames inside it keep theirs)
    const end = svg.indexOf(">") + 1;
    const outer = svg.slice(0, end).replace(/\s(width|height)="[^"]*"/g, "");
    // logos (data-fit="contain") are scaled to fit without cropping; images fill their box like a photo
    const fit = /data-fit="contain"/.test(outer) ? "meet" : "slice";
    // logos carry their width-to-height ratio so CSS can size them without distortion
    const vb = (outer.match(/viewBox="([^"]+)"/) || [])[1];
    const [, , vw, vh] = vb ? vb.trim().split(/[\s,]+/).map(Number) : [];
    const ar = fit === "meet" && vw && vh ? `--ar:${(vw / vh).toFixed(3)}` : "";
    let head = outer;
    if (ar) head = /\sstyle="/.test(head) ? head.replace(/\sstyle="([^"]*)"/, (m, s) => ` style="${s.replace(/;?\s*$/, ";")}${ar}"`) : head.replace("<svg", `<svg style="${ar}"`);
    return head.replace("<svg", `<svg${cls ? ` class="${cls}"` : ""} ${a11y} preserveAspectRatio="xMidYMid ${fit}" focusable="false"`) + svg.slice(end);
  });
}

function writeFile(rel, content) {
  if (/\.html$/.test(rel)) content = inlineSvgImages(content);
  if (/\.(html|css)$/.test(rel)) content = withBase(content);
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/* ---------- front matter (YAML between --- lines) + Markdown body ---------- */

function parseFile(file) {
  const raw = read(file).replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw.trim() };
  // <!-- notes --> in the text are guidance for editors and never appear on the site
  return { data: yaml.load(m[1]) || {}, body: m[2].replace(/<!--[\s\S]*?-->/g, "").trim() };
}

marked.use({
  gfm: true,
  renderer: {
    paragraph(text) {
      const imgs = text.trim().split(/\s*(?:<br>)?\s*\n\s*|\s+(?=<img)/).filter(Boolean);
      if (!imgs.length || !imgs.every((t) => /^<img [^>]*>$/.test(t))) return false; // normal paragraph
      const fig = (img) => {
        const cap = (img.match(/ title="([^"]*)"/) || [])[1];
        const clean = img.replace(/ title="[^"]*"/, "").replace("<img ", '<img loading="lazy" ');
        return `<figure>${clean}${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
      };
      if (imgs.length === 1) return `<div class="media media-1">${fig(imgs[0])}</div>\n`;
      return `<div class="media media-${Math.min(imgs.length, 3)}">${imgs.map(fig).join("")}</div>\n`;
    },
  },
});
const markdown = (src = "") => marked.parse(src);
const inline = (src = "") => marked.parseInline(String(src));

/* ---------- load content ---------- */

const SITE = parseFile(path.join(CONTENT, "site.md")).data;
SITE.domain = (SITE.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
SITE.url = `https://${SITE.domain}`;

const page = (name) => parseFile(path.join(CONTENT, "pages", `${name}.md`));

/* Projects are listed most recent first, using the "Years shown on the site" text:
   newest end year first (Today / present counts as now), then newest start year, then title.
   Start year is only a fallback when the Years box is empty. */
function yearRange(p) {
  const text = String(p.years || "");
  const nums = (text.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  const ongoing = /today|present|now|heute/i.test(text);
  const fallback = Number(p.start_year) || 0;
  const start = nums.length ? Math.min(...nums) : fallback;
  const end = ongoing ? 9999 : nums.length ? Math.max(...nums) : fallback;
  return { start, end };
}
function byRecency(a, b) {
  const x = yearRange(a), y = yearRange(b);
  return y.end - x.end || y.start - x.start || String(a.title || "").localeCompare(String(b.title || ""));
}

const PROJECT_DIR = path.join(CONTENT, "projects");
const projects = fs
  .readdirSync(PROJECT_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data, body } = parseFile(path.join(PROJECT_DIR, f));
    return { ...data, slug: f.replace(/\.md$/, ""), body };
  })
  .filter((p) => p.hidden !== true)
  .sort(byRecency);

// Passion projects have "section: passion"; everything else is work
const passion = projects.filter((p) => p.section === "passion");
const workProjects = projects.filter((p) => p.section !== "passion");

const featured = workProjects
  .filter((p) => p.featured === true)
  .sort((a, b) => Number(a.featured_order || 99) - Number(b.featured_order || 99))
  .slice(0, 3);
const archive = workProjects.filter((p) => !featured.includes(p));


/* ---------- journal ---------- */
const JOURNAL_DIR = path.join(CONTENT, "journal");
const isoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const dotDate = (d) => { const [y, m, day] = isoDate(d).split("-"); return y && m && day ? `${day}.${m}.${y}` : ""; };
const entries = (exists(JOURNAL_DIR) ? fs.readdirSync(JOURNAL_DIR) : [])
  .filter((f) => f.endsWith(".md"))
  .map((f) => { const { data, body } = parseFile(path.join(JOURNAL_DIR, f)); return { ...data, slug: f.replace(/\.md$/, ""), body, iso: isoDate(data.date) }; })
  .filter((e) => e.hidden !== true)
  .sort((a, b) => b.iso.localeCompare(a.iso));
const entryUrl = (e) => `/journal/${e.slug}/`;
const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const projectUrl = (p) => `/work/${p.slug}/`;
const imageUrl = (f) => (!f ? "" : /^(https?:)?\//.test(f) ? f : `/images/${f}`);
const assetUrl = (p, file) => imageUrl(file);

// Arrow icon used in links (aria-hidden: the link text already says where it goes)
const ARROW = `<svg class="icon-arrow" width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_BACK = ARROW.replace('class="icon-arrow"', 'class="icon-arrow flip"');
const ARROW_DOWN = ARROW.replace('class="icon-arrow"', 'class="icon-arrow down"');

/* ---------- shared layout ---------- */

function layout({ title, description, urlPath, body, image, type = "website", schema, bodyClass = "" }) {
  const fullTitle = title ? `${title} — ${SITE.name}` : SITE.site_title || SITE.name;
  const desc = description || SITE.description;
  const canonical = SITE.url + urlPath;
  const ogImage = SITE.url + (image || imageUrl(SITE.og_image));
  const nav = [
    ["/work/", "Work"],
    ["/journal/", "Journal"],
    ["/contact/", "Contact"],
  ];
  return `<!doctype html>
<html lang="${SITE.language || "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="author" content="${escapeHtml(SITE.name)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${SITE.background || "#F2F5F7"}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${escapeHtml(SITE.name)}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:locale" content="${SITE.locale || "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${imageUrl(SITE.favicon || "favicon.png")}"${/\.svg$/i.test(SITE.favicon || "") ? ' type="image/svg+xml"' : /\.png$/i.test(SITE.favicon || "favicon.png") ? ' type="image/png"' : ""}>
<link rel="stylesheet" href="/style.css">
<style>:root{--wand:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M10%2010%20L29%2029%22%20stroke%3D%22%230F181A%22%20stroke-width%3D%223.2%22%20stroke-linecap%3D%22round%22/%3E%3Cpath%20d%3D%22M10%2010%20L29%2029%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%20stroke-dasharray%3D%220%2022%206%2099%22/%3E%3Cpath%20d%3D%22M7%201.5%20L8.6%205.4%20L12.8%205.6%20L9.6%208.2%20L10.7%2012.3%20L7%2010%20L3.3%2012.3%20L4.4%208.2%20L1.2%205.6%20L5.4%205.4%20Z%22%20fill%3D%22%23ffffff%22%20stroke%3D%22%230F181A%22%20stroke-width%3D%221%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E") 7 6}</style>
${EDIT ? `<style>/* editor preview only: SVG logos are not inlined here, so keep them uncropped */img[src$=".svg"]{object-fit:contain}</style>\n` : ""}${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="wordmark" href="/">${escapeHtml(SITE.name)}</a>
  <nav aria-label="Main">
    ${nav.map(([href, label]) => `<a href="${href}"${urlPath.startsWith(href) ? ' aria-current="page"' : ""}>${label}</a>`).join("\n    ")}
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div>
    <a class="footer-tagline" href="/">${escapeHtml(SITE.tagline || "")}</a>
    <a class="footer-email" href="mailto:${SITE.email}">${SITE.email}</a>
  </div>
  <nav aria-label="Footer">
    <a href="/contact/">Contact</a>
    <a href="/imprint/">Imprint</a>
    <a href="/privacy/">Privacy</a>
  </nav>
</footer>
<div class="row-preview" aria-hidden="true"></div>
<script>
  // More projects: hovering a closed row shows its drop-down image beside the pointer (mouse/trackpad only)
  (() => {
    const rows = document.querySelectorAll(".row");
    if (!rows.length || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const box = document.querySelector(".row-preview");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = null, x = 0, y = 0, raf = 0;
    const place = () => {
      raf = 0;
      const w = box.offsetWidth, h = box.offsetHeight, gap = 24;
      let left = x + gap, top = y - h / 2;
      if (left + w > innerWidth - 8) left = x - w - gap;          // flip to the left near the right edge
      top = Math.max(8, Math.min(top, innerHeight - h - 8));
      box.style.transform = "translate(" + left + "px," + top + "px)";
    };
    const show = (row) => {
      const media = row.querySelector(".drawer-media > img, .drawer-media > svg");
      if (!media || row.open) return hide();
      if (active !== row) { box.innerHTML = ""; box.appendChild(media.cloneNode(true)); active = row; }
      box.classList.toggle("is-logo", media.matches("svg[data-fit]"));
      box.classList.add("on");
    };
    const hide = () => { box.classList.remove("on"); active = null; };
    rows.forEach((row) => {
      const s = row.querySelector("summary");
      s.addEventListener("pointerenter", () => show(row));
      s.addEventListener("pointerleave", hide);
      s.addEventListener("click", hide);
      s.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(place); });
    });
    addEventListener("scroll", hide, { passive: true });
    if (still) box.classList.add("still");
  })();
</script>
<div class="sparkles" aria-hidden="true"></div>
<script>
  // magic wand: little stars drift off the pointer as it moves (mouse/trackpad only; off for reduced motion)
  (() => {
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = document.querySelector(".sparkles");
    const colors = ["#45BCD1", "#09596B", "#961574", "#F2C14E"];
    let last = 0, lx = 0, ly = 0;
    addEventListener("pointermove", (e) => {
      const now = performance.now();
      const dist = Math.hypot(e.clientX - lx, e.clientY - ly);
      if (now - last < 28 || dist < 6) return;          // a few stars per movement, not a flood
      last = now; lx = e.clientX; ly = e.clientY;
      const star = document.createElement("span");
      star.className = "sparkle";
      const size = 6 + Math.random() * 9;
      star.style.cssText = "left:" + (e.clientX - 1) + "px;top:" + e.clientY + "px;width:" + size + "px;height:" + size + "px;" +
        "color:" + colors[(Math.random() * colors.length) | 0] + ";" +
        "--dx:" + ((Math.random() - .5) * 60) + "px;--dy:" + (18 + Math.random() * 40) + "px;--r:" + ((Math.random() - .5) * 220) + "deg";
      layer.appendChild(star);
      star.addEventListener("animationend", () => star.remove());
    }, { passive: true });
  })();
</script>
</body>
</html>
`;
}

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.name,
  url: SITE.url + "/",
  email: `mailto:${SITE.email}`,
  jobTitle: SITE.job_title,
  image: SITE.url + imageUrl(SITE.portrait),
  address: SITE.location ? { "@type": "PostalAddress", addressLocality: SITE.location } : undefined,
  sameAs: [SITE.linkedin, SITE.instagram, SITE.github, SITE.other_profile].filter(Boolean),
};

/* ---------- reusable pieces ---------- */

// Categories: a list in the CMS, or "A, B, C" typed by hand
function categories(p) {
  const c = p.categories;
  const list = Array.isArray(c) ? c : typeof c === "string" ? c.split(",") : [];
  return list.map((x) => String(x).trim()).filter(Boolean);
}
function tags(p) {
  const list = categories(p);
  if (!list.length) return "";
  return `<ul class="tags" aria-label="Categories">${list.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
}

function card(p, withTags = false) {
  const f = (key) => fileProp("projects", p.slug, key);
  return `<a class="card" href="${projectUrl(p)}">
    <div class="card-media"><img${edImage(p, "cover", "cover_alt", `@file[/content/projects/${p.slug}.md].`)} src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}" loading="lazy"></div>
    <div class="card-text">
      <h3${edText(f("title"))}>${escapeHtml(p.title)}</h3>
      <p${edText(f("tagline"))}>${escapeHtml(p.tagline || "")}</p>
      ${withTags ? tags(p) : ""}
      ${p.client && p.section !== "passion" ? `<p class="meta"><span${edText(f("client"))}>${escapeHtml(p.client)}</span></p>` : ""}
    </div>
  </a>`;
}

function row(p) {
  // the row shows the logo/cover; the opened drop-down shows its own image (falls back to the cover)
  const drawerImg = p.drawer_image || p.cover;
  const drawerAlt = p.drawer_image ? p.drawer_image_alt || "" : p.cover_alt || "";
  const f = (key) => fileProp("projects", p.slug, key);
  return `<li><details class="row">
    <summary>
      <span class="row-years"${edText(f("years"))}>${escapeHtml(String(p.years || ""))}</span>
      <span class="row-thumb">${p.cover ? `<img${edImage(p, "cover", "cover_alt", `@file[/content/projects/${p.slug}.md].`)} src="${assetUrl(p, p.cover)}" alt="" loading="lazy">` : ""}</span>
      <span class="row-title"${edText(f("title"))}>${escapeHtml(p.title)}</span>
      <span class="row-tags">${tags(p)}</span>
      <span class="row-toggle" aria-hidden="true"></span>
    </summary>
    <div class="drawer">
      ${drawerImg ? `<a class="drawer-media" href="${projectUrl(p)}" tabindex="-1"><img${edImage(p, "drawer_image", "drawer_image_alt", `@file[/content/projects/${p.slug}.md].`)} src="${assetUrl(p, drawerImg)}" alt="${escapeHtml(drawerAlt)}" loading="lazy"></a>` : ""}
      <div class="drawer-text">
        ${p.tagline ? `<p class="drawer-tagline"${edText(f("tagline"))}>${escapeHtml(p.tagline)}</p>` : ""}
        ${p.summary ? `<p class="drawer-summary"${edText(f("summary"))}>${escapeHtml(String(p.summary).trim())}</p>` : ""}
        <a class="drawer-link" href="${projectUrl(p)}">View project ${ARROW}</a>
      </div>
    </div>
  </details></li>`;
}

function yearSpan(list) {
  const years = list.flatMap((p) => { const r = yearRange(p); return [r.start, r.end === 9999 ? new Date().getFullYear() : r.end]; }).filter(Boolean);
  if (!years.length) return "";
  return `${Math.min(...years)}–${Math.max(...years)}`;
}


/* The homepage portrait: an SVG file is placed directly in the page (inline);
   any other image type falls back to a normal <img>. */
function portraitMarkup() {
  const alt = escapeHtml(SITE.portrait_alt || SITE.name);
  const file = path.join(CONTENT, String(SITE.portrait || "").replace(/^\//, ""));
  if (EDIT) {
    return `<img class="portrait"${edImage(SITE, "portrait", "portrait_alt", "@file[/content/site.md].")} src="${imageUrl(SITE.portrait)}" alt="${alt}" width="320" height="238">`;
  }
  if (/\.svg$/i.test(file) && exists(file)) {
    return read(file)
      .replace(/<\?xml[\s\S]*?\?>\s*/, "")
      .replace(/\s(width|height|role|aria-label|class)="[^"]*"/g, "")
      .replace("<svg", `<svg class="portrait" width="320" height="238" role="img" aria-label="${alt}"`)
      .trim();
  }
  return `<img class="portrait" src="${imageUrl(SITE.portrait)}" alt="${alt}" width="320" height="238">`;
}

/* ---------- build ---------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(THEME, "style.css"), path.join(OUT, "style.css"));
copyDir(path.join(CONTENT, "images"), path.join(OUT, "images"));
copyDir(path.join(CONTENT, "files"), path.join(OUT, "files")); // downloads such as the CV
copyDir(path.join(THEME, "fonts"), path.join(OUT, "fonts"));

// Background color from site.md is injected into the stylesheet
{
  let css = read(path.join(OUT, "style.css"));
  if (SITE.background) css = css.replace(/--bg:\s*#[0-9a-fA-F]{3,8};/, `--bg: ${SITE.background};`);
  writeFile("style.css", css);
}

// Home
const home = page("home");
writeFile(
  "index.html",
  layout({
    title: "",
    description: SITE.description,
    urlPath: "/",
    schema: personSchema,
    bodyClass: "home",
    body: `
<section class="intro">
  <span class="portrait-wrap">
    ${portraitMarkup()}
    ${home.data.bubble ? `<span class="bubble" aria-hidden="true"><span class="bubble-text">${inline(home.data.bubble)}</span></span>` : ""}
  </span>
  <script>
  // touch screens have no hover: tapping the portrait shows or hides the greeting; tapping elsewhere hides it
  (() => {
    const w = document.querySelector(".portrait-wrap");
    if (!w || !w.querySelector(".bubble")) return;
    w.addEventListener("click", (e) => {
      if (!matchMedia("(hover: none)").matches) return;
      e.stopPropagation();
      w.classList.toggle("show-greeting");
    });
    document.addEventListener("click", () => w.classList.remove("show-greeting"));
  })();
  </script>
  ${home.data.greeting ? `<p class="greeting"${edText("greeting")}>${inline(home.data.greeting)}</p>` : ""}
  <h1>${inline(home.data.headline || "").replace(/\s*\|\s*/g, '<br class="desktop-break"> ')}</h1>
  ${home.data.subhead ? `<p class="subhead"${edText("subhead")}>${inline(home.data.subhead)}</p>` : ""}
  <div class="lede"${edText("@content", "block")}>${markdown(home.body)}</div>
</section>

<section class="recent" aria-labelledby="recent-h">
  <div class="section-head">
    <h2 id="recent-h"${home.data.recent_heading ? edText("recent_heading") : ""}>${escapeHtml(home.data.recent_heading || "Recent work")}</h2>
    <a href="/work/">All work ${ARROW}</a>
  </div>
  <div class="cards">
    ${featured.map((p) => card(p, true)).join("\n    ")}
  </div>
</section>

${
  passion.length
    ? `<section class="recent passion" aria-labelledby="passion-h">
  <div class="section-head">
    <h2 id="passion-h"${home.data.passion_heading ? edText("passion_heading") : ""}>${escapeHtml(home.data.passion_heading || "Passion projects")}</h2>
  </div>
  <div class="cards">
    ${passion.map((p) => card(p, false)).join("\n    ")}
  </div>
</section>`
    : ""
}

${
  archive.length
    ? `<section class="archive" aria-labelledby="archive-h">
  <div class="section-head">
    <h2 id="archive-h"${home.data.archive_heading ? edText("archive_heading") : ""}>${escapeHtml(home.data.archive_heading || "More projects")}</h2>
    <span class="span">${yearSpan(archive)}</span>
  </div>
  <ol class="rows">
    ${archive.map(row).join("\n    ")}
  </ol>
</section>`
    : ""
}`,
  })
);

// Work index
const work = page("work");
writeFile(
  "work/index.html",
  layout({
    title: work.data.title || "Work",
    description: work.data.description,
    urlPath: "/work/",
    body: `
<section class="page-head">
  <h1${work.data.title ? edText("title") : ""}>${inline(work.data.title || "Work")}</h1>
  <div class="lede"${edText("@content", "block")}>${markdown(work.body)}</div>
</section>
<section class="recent"><div class="cards">${featured.map((p) => card(p, true)).join("\n")}</div></section>
${passion.length ? `<section class="recent passion"><div class="section-head"><h2>${escapeHtml(home.data.passion_heading || "Passion projects")}</h2></div><div class="cards">${passion.map((p) => card(p, false)).join("\n")}</div></section>` : ""}
<section class="archive"><ol class="rows">${archive.map(row).join("\n")}</ol></section>`,
  })
);



/* Project page images, edited in the CMS under "Project page images":
   a top image (falls back to the logo/cover) and a gallery shown after the case-study text.
   Gallery sizes: full = full width, half = two side by side, third = three side by side. */
// Top image and gallery live at the top level of each project file (older files may still
// have them grouped under page_images; both work).
const topImage = (p) => ({ ...(p.page_images || {}), ...("top_image" in p ? { top_image: p.top_image, top_image_alt: p.top_image_alt } : {}) });
const galleryOf = (p) => ("gallery" in p ? p.gallery : (p.page_images || {}).gallery) || [];
function pageHero(p) {
  // the logo/cover stays on cards and list rows only; the project page shows the Top image, if one is set
  const pi = topImage(p);
  const src = pi.top_image;
  if (!src) return "";
  const alt = pi.top_image_alt || "";
  return `<div class="media media-1 case-hero"><figure><img${edImage(p, "top_image", "top_image_alt")} src="${imageUrl(src)}" alt="${escapeHtml(alt)}"></figure></div>`;
}
/* Editor only: the gallery as one CloudCannon array, so images can be replaced, added, removed and
   reordered on the page. Each item keeps its width (full / half / third). */
function editableGallery(p) {
  const list = Array.isArray(p.gallery) ? p.gallery : [];
  if (!list.length) return "";
  const width = { half: "calc(50% - 8px)", third: "calc(33.333% - 11px)" };
  const item = (g = {}) => {
    const w = width[String(g.size || "full").toLowerCase()] || "100%";
    const img = `<img${edImage(g, "image", "alt")} loading="lazy" src="${imageUrl(g.image || "/images/placeholders/placeholder-wide.svg")}" alt="${escapeHtml(g.alt || "")}">`;
    const cap = typeof g.caption === "string" ? `<figcaption${edText("caption")}>${escapeHtml(g.caption)}</figcaption>` : "";
    return `<figure data-editable="array-item" style="flex:0 0 ${w};margin:0">${img}${cap}</figure>`;
  };
  return `<div class="media" data-editable="array" data-prop="gallery" data-direction="row" style="display:flex;flex-wrap:wrap;gap:16px">${list.map(item).join("")}</div>`;
}
function pageGallery(p) {
  const items = galleryOf(p).filter((g) => g && g.image);
  if (!items.length) return "";
  const fig = (g) => `<figure><img loading="lazy" src="${imageUrl(g.image)}" alt="${escapeHtml(g.alt || "")}">${g.caption ? `<figcaption>${escapeHtml(g.caption)}</figcaption>` : ""}</figure>`;
  const per = { half: 2, third: 3 };
  const out = [];
  for (let i = 0; i < items.length; ) {
    const n = per[String(items[i].size || "full").toLowerCase()] || 1;
    const run = [];
    while (i < items.length && run.length < n && (per[String(items[i].size || "full").toLowerCase()] || 1) === n) run.push(items[i++]);
    out.push(`<div class="media media-${run.length}">${run.map(fig).join("")}</div>`);
  }
  return `\n${out.join("\n")}`;
}

/* Editor only (never on the live site): the images this project shows on the homepage cards and in
   the More projects list, so they can be replaced in CloudCannon's Visual Editor from this page. */
function listImages(p) {
  if (!EDIT) return "";
  const slot = (label, note, key, altKey, fallback) =>
    `<figure style="margin:0;flex:1 1 240px"><figcaption style="font:600 13px/1.3 var(--sans,sans-serif);margin:0 0 6px">${label}</figcaption>` +
    `<img${edImage(p, key, altKey)} src="${imageUrl(p[key] || fallback || "/images/placeholders/placeholder-drawer.svg")}" alt="${escapeHtml(p[altKey] || "")}" style="width:100%;aspect-ratio:16/10;object-fit:contain;background:var(--card,#fff);border:1px dashed var(--rule,#ccc);border-radius:6px">` +
    `<p style="font-size:12px;opacity:.7;margin:6px 0 0">${note}</p></figure>`;
  const slots = [slot("Logo / cover", "Shown on the homepage cards, in the project list and as Next project.", "cover", "cover_alt")];
  if (p.section !== "passion") slots.push(slot("Drop-down image", "Shown when this project's row is opened in More projects.", "drawer_image", "drawer_image_alt", p.cover));
  return `<section aria-label="Images used on other pages (editor only)" style="margin:32px var(--gutter,20px);padding:16px;border:2px dashed #961574;border-radius:8px">
    <p style="margin:0 0 12px;font-weight:600">Images used on other pages <span style="font-weight:400;opacity:.7">(only visible in the editor)</span></p>
    <div style="display:flex;gap:16px;flex-wrap:wrap">${slots.join("")}</div>
  </section>`;
}


/* Sections (like smeidu.com/clara): each one is a heading, text (Markdown: paragraphs, bullet lists, links)
   and that section's images. Images use the same sizes as the gallery: full, half (two side by side), third. */
function mediaRows(items) {
  items = (items || []).filter((g) => g && g.image);
  const fig = (g) => `<figure><img loading="lazy" src="${imageUrl(g.image)}" alt="${escapeHtml(g.alt || "")}">${g.caption ? `<figcaption>${escapeHtml(g.caption)}</figcaption>` : ""}</figure>`;
  const per = { half: 2, third: 3 };
  const size = (g) => per[String(g.size || "full").toLowerCase()] || 1;
  const out = [];
  for (let i = 0; i < items.length; ) {
    const n = size(items[i]);
    const run = [];
    while (i < items.length && run.length < n && size(items[i]) === n) run.push(items[i++]);
    out.push(`<div class="media media-${run.length}">${run.map(fig).join("")}</div>`);
  }
  return out.join("\n");
}
function pageSections(p) {
  const list = (Array.isArray(p.sections) ? p.sections : []).filter((s) => s && (s.heading || s.text || (s.images || []).length));
  return list.map((s) => `
${s.heading ? `<h2>${escapeHtml(String(s.heading))}</h2>` : ""}
${s.text ? markdown(String(s.text)) : ""}
${mediaRows(s.images)}`).join("\n");
}
/* Credits at the end, like "Clara crew": Name: role, with an optional link on the name */
function pageCredits(p) {
  const list = (Array.isArray(p.credits) ? p.credits : []).filter((c) => c && c.name);
  if (!list.length) return "";
  const item = (c) => {
    const name = c.link ? `<a href="${escapeHtml(String(c.link))}" target="_blank" rel="noopener">${escapeHtml(String(c.name))}</a>` : escapeHtml(String(c.name));
    return `<li>${name}${c.role ? `: ${escapeHtml(String(c.role))}` : ""}</li>`;
  };
  return `\n<h2>${escapeHtml(String(p.credits_heading || "Team"))}</h2>\n<ul class="credits">${list.map(item).join("")}</ul>`;
}

/* ---------- case-study page template ---------- */
function caseStudy(p) {
  // next / previous stay within the same section (work or passion), newest to oldest, looping at the end
  const group = p.section === "passion" ? passion : workProjects;
  const k = group.indexOf(p);
  const next = group[(k + 1) % group.length];
  const prev = k > 0 ? group[k - 1] : null;
  // one meta line like "Lead Designer (2019–2021) · Goldman Sachs", then an optional link to the live product
  const roleYears = p.role && p.years ? `${p.role} (${p.years})` : p.role || p.years || "";
  const meta = [roleYears, p.client].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  const site = p.website ? `<p class="case-link"><a href="${escapeHtml(String(p.website))}" target="_blank" rel="noopener">${escapeHtml(String(p.website_label || String(p.website).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")))} ${ARROW}</a></p>` : "";
  return `
<article class="case">
  <a class="back" href="/work/">${ARROW_BACK} Work</a>
  <header class="case-head">
    <h1${edText("title")}>${escapeHtml(p.title)}</h1>
    ${p.logo ? `<img class="case-logo"${edImage(p, "logo")} src="${imageUrl(p.logo)}" alt="${escapeHtml(p.client || "")} logo">` : ""}
    ${p.tagline ? `<p class="case-lede"${edText("tagline")}>${escapeHtml(p.tagline)}</p>` : ""}
    ${meta ? `<p class="case-meta">${meta}</p>` : ""}
    ${site}
    ${tags(p)}
  </header>
  ${pageHero(p)}${listImages(p)}
  ${EDIT
    ? `<div class="case-body"${edText("@content", "block")}>${markdown(p.body)}</div><div class="case-body">${pageSections(p)}${editableGallery(p)}${pageCredits(p)}</div>`
    : `<div class="case-body">${markdown(p.body)}${pageSections(p)}${pageGallery(p)}${pageCredits(p)}</div>`}
</article>

<nav class="next-project" aria-label="Next project">
  <a href="${projectUrl(next)}">
    <span class="next-label">Next project ${ARROW}</span>
    <span class="next-title">${escapeHtml(next.title)}</span>
    ${next.cover ? `<span class="next-thumb"><img src="${assetUrl(next, next.cover)}" alt="" loading="lazy"></span>` : ""}
  </a>
  ${prev ? `<a class="prev-link" href="${projectUrl(prev)}">${ARROW_BACK} Previous: ${escapeHtml(prev.title)}</a>` : ""}
</nav>


<div class="lightbox" hidden role="dialog" aria-modal="true" aria-label="Image viewer">
  <button class="lb-close" type="button" aria-label="Close">×</button>
  <button class="lb-prev" type="button" aria-label="Previous image">${ARROW_BACK}</button>
  <figure><div class="lb-stage"></div><figcaption></figcaption></figure>
  <button class="lb-next" type="button" aria-label="Next image">${ARROW}</button>
</div>
<script>
  // click any image in the case study to see it large; arrow keys move between images, Esc closes
  (() => {
    const imgs = [...document.querySelectorAll(".case .media img, .case .media svg")];
    const lb = document.querySelector(".lightbox"); if (!lb || !imgs.length) return;
    const stage = lb.querySelector(".lb-stage"), cap = lb.querySelector("figcaption");
    let at = 0, opener = null;
    const label = (im) => im.getAttribute("alt") || im.getAttribute("aria-label") || "Image";
    const show = (n) => {
      at = (n + imgs.length) % imgs.length; const im = imgs[at];
      stage.innerHTML = "";
      if (im.tagName.toLowerCase() === "img") {
        const big = new Image(); big.src = im.currentSrc || im.src; big.alt = im.alt; stage.appendChild(big);
      } else {
        const big = im.cloneNode(true); big.removeAttribute("tabindex"); big.removeAttribute("role"); big.setAttribute("aria-label", label(im).replace(/ — open larger$/, "")); big.setAttribute("role", "img"); big.setAttribute("preserveAspectRatio", "xMidYMid meet"); stage.appendChild(big);
      }
      cap.textContent = im.closest("figure")?.querySelector("figcaption")?.textContent || "";
    };
    const open = (n) => { opener = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector(".lb-close").focus(); };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; opener && opener.focus(); };
    imgs.forEach((im, n) => {
      im.setAttribute("tabindex", "0"); im.setAttribute("role", "button"); im.setAttribute("aria-label", label(im) + " — open larger");
      im.removeAttribute("aria-hidden");
      im.addEventListener("click", () => open(n));
      im.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(n); } });
    });
    lb.querySelector(".lb-close").onclick = close;
    lb.querySelector(".lb-prev").onclick = () => show(at - 1);
    lb.querySelector(".lb-next").onclick = () => show(at + 1);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") show(at - 1); else if (e.key === "ArrowRight") show(at + 1);
    });
  })();
</script>`;
}

// Project pages
projects.forEach((p, i) => {
  const prev = projects[i - 1];
  const next = projects[i + 1];
  writeFile(
    `work/${p.slug}/index.html`,
    layout({
      title: p.title,
      description: p.description || p.tagline,
      urlPath: projectUrl(p),
      image: p.cover && !p.cover.endsWith(".svg") ? assetUrl(p, p.cover) : undefined,
      type: "article",
      bodyClass: "project",
      schema: {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: p.title,
        description: p.description || p.tagline,
        url: SITE.url + projectUrl(p),
        author: { "@type": "Person", name: SITE.name, url: SITE.url + "/" },
        dateCreated: p.start_year ? String(p.start_year) : undefined,
      },
      body: caseStudy(p),
    })
  );
});



/* ---------- journal: list page (filter by category, load more) and one page per entry ---------- */
const JOURNAL_PAGE_SIZE = 9;
{
  const jp = page("journal");
  const cats = [...new Set(entries.map((e) => e.category).filter(Boolean))];
  const item = (e, i) => `<li class="entry" data-cat="${slugify(e.category)}"${i >= JOURNAL_PAGE_SIZE ? " data-later" : ""}>
    <a href="${entryUrl(e)}">
      <span class="entry-media">${e.cover ? `<img${edImage(e, "cover", "cover_alt", `@file[/content/journal/${e.slug}.md].`)} src="${imageUrl(e.cover)}" alt="" loading="lazy">` : ""}</span>
      <span class="entry-meta"><time datetime="${e.iso}">${dotDate(e.date)}</time>${e.category ? `<span class="entry-cat">${escapeHtml(e.category)}</span>` : ""}</span>
      <span class="entry-title"${edText(fileProp("journal", e.slug, "title"))}>${escapeHtml(e.title)}</span>
    </a>
  </li>`;
  writeFile(
    "journal/index.html",
    layout({
      title: jp.data.title || "Journal",
      description: jp.data.description,
      urlPath: "/journal/",
      bodyClass: "journal",
      body: `
<section class="page-head">
  <h1${jp.data.title ? edText("title") : ""}>${inline(jp.data.title || "Journal")}</h1>
  <div class="lede"${edText("@content", "block")}>${markdown(jp.body)}</div>
</section>
${cats.length > 1 ? `<div class="journal-filter" role="group" aria-label="Filter journal entries">
  <span class="filter-label">${escapeHtml(jp.data.filter_label || "Filter by:")}</span>
  <button type="button" class="chip" aria-pressed="true" data-filter="">All</button>
  ${cats.map((c) => `<button type="button" class="chip" aria-pressed="false" data-filter="${slugify(c)}">${escapeHtml(c)}</button>`).join("\n  ")}
</div>` : ""}
<ol class="entries">
${entries.map(item).join("\n")}
</ol>
<p class="entries-empty" hidden>No entries in this category yet.</p>
${entries.length > JOURNAL_PAGE_SIZE ? `<div class="load-more-wrap"><button type="button" class="load-more">Load more</button></div>` : ""}
<script>
  // filter by category and reveal entries a page at a time; without JavaScript every entry simply shows
  (() => {
    const list = document.querySelector(".entries"); if (!list) return;
    const items = [...list.children], step = ${JOURNAL_PAGE_SIZE};
    const more = document.querySelector(".load-more"), empty = document.querySelector(".entries-empty");
    let filter = "", shown = step;
    const render = () => {
      const match = items.filter((li) => !filter || li.dataset.cat === filter);
      items.forEach((li) => (li.hidden = true));
      match.slice(0, shown).forEach((li) => (li.hidden = false));
      if (more) more.parentElement.hidden = match.length <= shown;
      empty.hidden = match.length > 0;
    };
    document.querySelectorAll(".journal-filter .chip").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".journal-filter .chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
      filter = b.dataset.filter; shown = step; render();
    }));
    if (more) more.addEventListener("click", () => {
      const first = items.filter((li) => li.hidden && (!filter || li.dataset.cat === filter))[0];
      shown += step; render();
      first && first.querySelector("a").focus({ preventScroll: true });
    });
    items.forEach((li) => li.removeAttribute("data-later"));
    render();
  })();
</script>`,
    })
  );

  entries.forEach((e, k) => {
    const newer = entries[k - 1], older = entries[k + 1] || entries[0];
    writeFile(
      `journal/${e.slug}/index.html`,
      layout({
        title: e.title,
        description: e.description || e.excerpt,
        urlPath: entryUrl(e),
        image: e.cover && !e.cover.endsWith(".svg") ? imageUrl(e.cover) : undefined,
        type: "article",
        bodyClass: "project journal-entry",
        schema: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: e.title,
          description: e.description || e.excerpt,
          datePublished: e.iso || undefined,
          url: SITE.url + entryUrl(e),
          author: { "@type": "Person", name: SITE.name, url: SITE.url + "/" },
        },
        body: `
<article class="case">
  <a class="back" href="/journal/">${ARROW_BACK} Journal</a>
  <header class="case-head">
    <p class="case-meta"><time datetime="${e.iso}">${dotDate(e.date)}</time>${e.category ? ` · ${escapeHtml(e.category)}` : ""}</p>
    <h1${edText("title")}>${escapeHtml(e.title)}</h1>
    ${e.excerpt ? `<p class="case-lede"${edText("excerpt")}>${escapeHtml(e.excerpt)}</p>` : ""}
  </header>
  ${e.cover ? `<div class="media media-1 case-hero"><figure><img${edImage(e, "cover", "cover_alt")} src="${imageUrl(e.cover)}" alt="${escapeHtml(e.cover_alt || "")}"></figure></div>` : ""}
  <div class="case-body"${edText("@content", "block")}>${markdown(e.body)}</div>
</article>
${entries.length > 1 ? `<nav class="next-project" aria-label="Next journal entry">
  <a href="${entryUrl(older)}">
    <span class="next-label">Next entry ${ARROW}</span>
    <span class="next-title">${escapeHtml(older.title)}</span>
    ${older.cover ? `<span class="next-thumb"><img src="${imageUrl(older.cover)}" alt="" loading="lazy"></span>` : ""}
  </a>
  ${newer ? `<a class="prev-link" href="${entryUrl(newer)}">${ARROW_BACK} Newer: ${escapeHtml(newer.title)}</a>` : ""}
</nav>` : ""}`,
      })
    );
  });
}


/* About and Contact use the homepage's three-column layout: the text before the first
   "## heading" is column one, and each "## heading" starts the next column. */
const COLUMN_PAGES = ["contact"];
function columns(md, name, data = {}) {
  const parts = md.split(/\n(?=##\s)/).map((x) => x.trim()).filter(Boolean);
  const cols = parts.map((part) => `<div class="col">${markdown(part)}</div>`);
  // Contact: email, then a "Download CV" link once a CV file is uploaded (Pages CMS: Contact page → CV file)
  const cv = data.cv ? `<p class="cv-link"><a href="${escapeHtml(String(data.cv))}" download>${escapeHtml(String(data.cv_label || "Download CV"))} ${ARROW_DOWN}</a></p>` : "";
  if (name === "contact") cols.push(`<div class="col"><p class="big-mail"><a href="mailto:${SITE.email}">${SITE.email}</a></p>${cv}</div>`);
  return `<div class="cols3">${cols.join("\n")}</div>`;
}

// Simple text pages
for (const name of ["contact", "imprint", "privacy"]) {
  const { data, body } = page(name);
  const withEmail = body.replace(/\{\{email\}\}/g, SITE.email).replace(/\{\{name\}\}/g, SITE.name);
  writeFile(
    `${name}/index.html`,
    layout({
      title: data.title,
      description: data.description,
      urlPath: `/${name}/`,
      bodyClass: `text ${name}`,
      body: `
<section class="page-head"><h1${data.title ? edText("title") : ""}>${inline(data.title || name)}</h1></section>
${COLUMN_PAGES.includes(name) ? columns(withEmail, name, data) : `<div class="prose">${markdown(withEmail)}</div>`}`,
    })
  );
}

// 404
writeFile(
  "404.html",
  layout({
    title: "Page not found",
    urlPath: "/404.html",
    body: `<section class="page-head"><h1>Page not found</h1><p class="lede">That page doesn't exist. <a href="/">Back to the homepage ${ARROW}</a></p></section>`,
  })
);

// SEO files
const urls = ["/", "/work/", "/journal/", "/contact/", ...projects.map(projectUrl), ...entries.map(entryUrl), "/imprint/", "/privacy/"];
const today = new Date().toISOString().slice(0, 10);
writeFile(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.url}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`
);
writeFile("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
writeFile("CNAME", `${SITE.domain}\n`); // tells GitHub Pages which domain to serve
writeFile(".nojekyll", "");

console.log(`Built ${urls.length} pages for ${SITE.url} → dist/`);
console.log(`  Recent work: ${featured.map((p) => p.slug).join(", ")}`);
console.log(`  Project list: ${archive.length} projects (${yearSpan(archive)})`);
console.log(`  Passion projects: ${passion.map((p) => p.slug).join(", ") || "none"}`);
