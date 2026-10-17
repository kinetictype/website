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
const withBase = (html) =>
  BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`).replace(/url\("\/(?!\/)/g, `url("${BASE}/`) : html;

// Placeholder and other small SVG images are written straight into the page instead of <img>,
// so they always show (no separate file to load). Large SVGs (the portrait) stay as <img>.
const svgCache = {};
function inlineSvgImages(html) {
  return html.replace(/<img\b([^>]*?)\bsrc="(\/images\/[^"]+\.svg)"([^>]*)>/g, (tag, before, src, after) => {
    const file = path.join(CONTENT, src);
    if (!exists(file) || fs.statSync(file).size > 50000) return tag;
    const svg = (svgCache[file] ||= read(file).replace(/<\?xml[\s\S]*?\?>\s*/, "").trim());
    const attrs = before + " " + after;
    const cls = (attrs.match(/\bclass="([^"]*)"/) || [])[1];
    const alt = (attrs.match(/\balt="([^"]*)"/) || [])[1] || "";
    const a11y = alt ? `role="img" aria-label="${alt}"` : `aria-hidden="true"`;
    return svg
      .replace(/(<svg\b[^>]*?)\s(width|height)="[^"]*"/g, "$1")
      .replace(/(<svg\b[^>]*?)\s(width|height)="[^"]*"/g, "$1")
      .replace("<svg", `<svg${cls ? ` class="${cls}"` : ""} ${a11y} preserveAspectRatio="xMidYMid slice" focusable="false"`);
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
  return { data: yaml.load(m[1]) || {}, body: m[2].trim() };
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

const PROJECT_DIR = path.join(CONTENT, "projects");
const projects = fs
  .readdirSync(PROJECT_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data, body } = parseFile(path.join(PROJECT_DIR, f));
    return { ...data, slug: f.replace(/\.md$/, ""), body };
  })
  .filter((p) => p.hidden !== true)
  .sort((a, b) => Number(b.start_year || 0) - Number(a.start_year || 0));

// Passion projects have "section: passion"; everything else is work
const passion = projects.filter((p) => p.section === "passion");
const workProjects = projects.filter((p) => p.section !== "passion");

const featured = workProjects
  .filter((p) => p.featured === true)
  .sort((a, b) => Number(a.featured_order || 99) - Number(b.featured_order || 99))
  .slice(0, 3);
const archive = workProjects.filter((p) => !featured.includes(p));

const projectUrl = (p) => `/work/${p.slug}/`;
const imageUrl = (f) => (!f ? "" : /^(https?:)?\//.test(f) ? f : `/images/${f}`);
const assetUrl = (p, file) => imageUrl(file);

// Arrow icon used in links (aria-hidden: the link text already says where it goes)
const ARROW = `<svg class="icon-arrow" width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_BACK = ARROW.replace('class="icon-arrow"', 'class="icon-arrow flip"');

/* ---------- shared layout ---------- */

function layout({ title, description, urlPath, body, image, type = "website", schema, bodyClass = "" }) {
  const fullTitle = title ? `${title} — ${SITE.name}` : SITE.site_title || SITE.name;
  const desc = description || SITE.description;
  const canonical = SITE.url + urlPath;
  const ogImage = SITE.url + (image || imageUrl(SITE.og_image));
  const nav = [
    ["/about/", "About"],
    ["/work/", "Work"],
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
<link rel="icon" href="${imageUrl(SITE.favicon || "favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<style>:root{--wand:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M10%2010%20L29%2029%22%20stroke%3D%22%230F181A%22%20stroke-width%3D%223.2%22%20stroke-linecap%3D%22round%22/%3E%3Cpath%20d%3D%22M10%2010%20L29%2029%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%20stroke-dasharray%3D%220%2022%206%2099%22/%3E%3Cpath%20d%3D%22M7%201.5%20L8.6%205.4%20L12.8%205.6%20L9.6%208.2%20L10.7%2012.3%20L7%2010%20L3.3%2012.3%20L4.4%208.2%20L1.2%205.6%20L5.4%205.4%20Z%22%20fill%3D%22%2345BCD1%22%20stroke%3D%22%230F181A%22%20stroke-width%3D%221%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E") 7 6}</style>
${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
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
    <a class="footer-name" href="/about/">${escapeHtml(SITE.name)}</a>
    <span>${escapeHtml(SITE.tagline || "")}</span>
  </div>
  <nav aria-label="Footer">
    <a href="mailto:${SITE.email}">${SITE.email}</a>
    <a href="/contact/">Contact</a>
    <a href="/imprint/">Imprint</a>
    <a href="/privacy/">Privacy</a>
  </nav>
</footer>
<div class="sparkles" aria-hidden="true"></div>
<script>
  // magic wand: little stars drift off the pointer as it moves (mouse/trackpad only; off for reduced motion)
  (() => {
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = document.querySelector(".sparkles");
    const colors = ["#45BCD1", "#159AB3", "#961574", "#F2C14E"];
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
  return `<a class="card" href="${projectUrl(p)}">
    <div class="card-media"><img src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}" loading="lazy"></div>
    <div class="card-text">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.tagline || "")}</p>
      ${withTags ? tags(p) : ""}
      <p class="meta"><span>${escapeHtml(p.client || "")}</span><span>${escapeHtml(p.years || "")}</span></p>
    </div>
  </a>`;
}

function row(p) {
  const facts = [
    p.client ? `<div><dt>Client</dt><dd>${escapeHtml(p.client)}</dd></div>` : "",
    p.role ? `<div><dt>Role</dt><dd>${escapeHtml(p.role)}</dd></div>` : "",
  ].join("");
  return `<li><details class="row">
    <summary>
      <span class="row-years">${escapeHtml(String(p.years || ""))}</span>
      <span class="row-thumb">${p.cover ? `<img src="${assetUrl(p, p.cover)}" alt="" loading="lazy">` : ""}</span>
      <span class="row-title">${escapeHtml(p.title)}</span>
      <span class="row-tags">${tags(p)}</span>
      <span class="row-toggle" aria-hidden="true"></span>
    </summary>
    <div class="drawer">
      ${p.cover ? `<a class="drawer-media" href="${projectUrl(p)}" tabindex="-1"><img src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}" loading="lazy"></a>` : ""}
      <div class="drawer-text">
        ${p.tagline ? `<p class="drawer-tagline">${escapeHtml(p.tagline)}</p>` : ""}
        ${facts ? `<dl class="facts">${facts}</dl>` : ""}
        <a class="drawer-link" href="${projectUrl(p)}">View project ${ARROW}</a>
      </div>
    </div>
  </details></li>`;
}

function yearSpan(list) {
  const years = list.map((p) => Number(p.start_year)).filter(Boolean);
  if (!years.length) return "";
  return `${Math.min(...years)}–${Math.max(...years)}`;
}


/* The homepage portrait: an SVG file is placed directly in the page (inline);
   any other image type falls back to a normal <img>. */
function portraitMarkup() {
  const alt = escapeHtml(SITE.portrait_alt || SITE.name);
  const file = path.join(CONTENT, String(SITE.portrait || "").replace(/^\//, ""));
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
  <div class="icon-field" aria-hidden="true"><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.68675 15.6451L4.59494 14.5435C4.6983 14.4839 4.8196 14.4631 4.9369 14.4851L8.6914 15.1878C8.99995 15.2455 9.28478 15.008 9.28338 14.6941L9.26876 11.4045C9.26836 11.3151 9.29193 11.2272 9.33701 11.15L11.2317 7.90621C11.3303 7.73739 11.3215 7.52658 11.2091 7.3666L8.01892 2.82568M19.0002 4.85905C13.5002 7.50004 16.5 11 17.5002 11.5C19.3773 12.4384 21.9876 12.5 21.9876 12.5C21.9958 12.3344 22 12.1677 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C12.1677 22 12.3344 21.9959 12.5 21.9877M16.7578 21.9398L13.591 13.591L21.9398 16.7578L18.2376 18.2376L16.7578 21.9398Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.66113 18.3391L7.25499 13.7452M18.2175 2.78271C21.9275 6.4927 21.9275 12.5078 18.2175 16.2177C14.5075 19.9277 8.49243 19.9277 4.78245 16.2177M17 22.0002H6.99997M12 22.0002V19.0002M17.5 9.50023C17.5 12.8139 14.8137 15.5002 11.5 15.5002C8.18626 15.5002 5.49997 12.8139 5.49997 9.50023C5.49997 6.18652 8.18626 3.50023 11.5 3.50023C14.8137 3.50023 17.5 6.18652 17.5 9.50023Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15C8.68629 15 6 12.3137 6 9V3.44444C6 3.0306 6 2.82367 6.06031 2.65798C6.16141 2.38021 6.38021 2.16141 6.65798 2.06031C6.82367 2 7.0306 2 7.44444 2H16.5556C16.9694 2 17.1763 2 17.342 2.06031C17.6198 2.16141 17.8386 2.38021 17.9397 2.65798C18 2.82367 18 3.0306 18 3.44444V9C18 12.3137 15.3137 15 12 15ZM12 15V18M18 4H20.5C20.9659 4 21.1989 4 21.3827 4.07612C21.6277 4.17761 21.8224 4.37229 21.9239 4.61732C22 4.80109 22 5.03406 22 5.5V6C22 6.92997 22 7.39496 21.8978 7.77646C21.6204 8.81173 20.8117 9.62038 19.7765 9.89778C19.395 10 18.93 10 18 10M6 4H3.5C3.03406 4 2.80109 4 2.61732 4.07612C2.37229 4.17761 2.17761 4.37229 2.07612 4.61732C2 4.80109 2 5.03406 2 5.5V6C2 6.92997 2 7.39496 2.10222 7.77646C2.37962 8.81173 3.18827 9.62038 4.22354 9.89778C4.60504 10 5.07003 10 6 10M7.44444 22H16.5556C16.801 22 17 21.801 17 21.5556C17 19.5919 15.4081 18 13.4444 18H10.5556C8.59188 18 7 19.5919 7 21.5556C7 21.801 7.19898 22 7.44444 22Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3M21 7L15.5657 12.4343C15.3677 12.6323 15.2687 12.7313 15.1545 12.7684C15.0541 12.8011 14.9459 12.8011 14.8455 12.7684C14.7313 12.7313 14.6323 12.6323 14.4343 12.4343L12.5657 10.5657C12.3677 10.3677 12.2687 10.2687 12.1545 10.2316C12.0541 10.1989 11.9459 10.1989 11.8455 10.2316C11.7313 10.2687 11.6323 10.3677 11.4343 10.5657L7 15M21 7H17M21 7V11"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7.5 12H7.51M12 12H12.01M16.5 12H16.51M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.1971 3.23374 14.3397 3.65806 15.3845C3.73927 15.5845 3.77988 15.6845 3.798 15.7653C3.81572 15.8443 3.8222 15.9028 3.82221 15.9839C3.82222 16.0667 3.80718 16.1569 3.77711 16.3374L3.18413 19.8952C3.12203 20.2678 3.09098 20.4541 3.14876 20.5888C3.19933 20.7067 3.29328 20.8007 3.41118 20.8512C3.54589 20.909 3.73218 20.878 4.10476 20.8159L7.66265 20.2229C7.84309 20.1928 7.9333 20.1778 8.01613 20.1778C8.09715 20.1778 8.15566 20.1843 8.23472 20.202C8.31554 20.2201 8.41552 20.2607 8.61549 20.3419C9.6603 20.7663 10.8029 21 12 21ZM8 12C8 12.2761 7.77614 12.5 7.5 12.5C7.22386 12.5 7 12.2761 7 12C7 11.7239 7.22386 11.5 7.5 11.5C7.77614 11.5 8 11.7239 8 12ZM12.5 12C12.5 12.2761 12.2761 12.5 12 12.5C11.7239 12.5 11.5 12.2761 11.5 12C11.5 11.7239 11.7239 11.5 12 11.5C12.2761 11.5 12.5 11.7239 12.5 12ZM17 12C17 12.2761 16.7761 12.5 16.5 12.5C16.2239 12.5 16 12.2761 16 12C16 11.7239 16.2239 11.5 16.5 11.5C16.7761 11.5 17 11.7239 17 12Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11.2827 3.45332C11.5131 2.98638 11.6284 2.75291 11.7848 2.67831C11.9209 2.61341 12.0791 2.61341 12.2152 2.67831C12.3717 2.75291 12.4869 2.98638 12.7174 3.45332L14.9041 7.88328C14.9721 8.02113 15.0061 8.09006 15.0558 8.14358C15.0999 8.19096 15.1527 8.22935 15.2113 8.25662C15.2776 8.28742 15.3536 8.29854 15.5057 8.32077L20.397 9.03571C20.9121 9.11099 21.1696 9.14863 21.2888 9.27444C21.3925 9.38389 21.4412 9.5343 21.4215 9.68377C21.3988 9.85558 21.2124 10.0372 20.8395 10.4004L17.3014 13.8464C17.1912 13.9538 17.136 14.0076 17.1004 14.0715C17.0689 14.128 17.0487 14.1902 17.0409 14.2545C17.0321 14.3271 17.0451 14.403 17.0711 14.5547L17.906 19.4221C17.994 19.9355 18.038 20.1922 17.9553 20.3445C17.8833 20.477 17.7554 20.57 17.6071 20.5975C17.4366 20.6291 17.2061 20.5078 16.7451 20.2654L12.3724 17.9658C12.2361 17.8942 12.168 17.8584 12.0962 17.8443C12.0327 17.8318 11.9673 17.8318 11.9038 17.8443C11.832 17.8584 11.7639 17.8942 11.6277 17.9658L7.25492 20.2654C6.79392 20.5078 6.56341 20.6291 6.39297 20.5975C6.24468 20.57 6.11672 20.477 6.04474 20.3445C5.962 20.1922 6.00603 19.9355 6.09407 19.4221L6.92889 14.5547C6.95491 14.403 6.96793 14.3271 6.95912 14.2545C6.95132 14.1902 6.93111 14.128 6.89961 14.0715C6.86402 14.0076 6.80888 13.9538 6.69859 13.8464L3.16056 10.4004C2.78766 10.0372 2.60121 9.85558 2.57853 9.68377C2.55879 9.5343 2.60755 9.38389 2.71125 9.27444C2.83044 9.14863 3.08797 9.11099 3.60304 9.03571L8.49431 8.32077C8.64642 8.29854 8.72248 8.28742 8.78872 8.25662C8.84736 8.22935 8.90016 8.19096 8.94419 8.14358C8.99391 8.09006 9.02793 8.02113 9.09597 7.88328L11.2827 3.45332Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2L10.6985 7.20599C10.4445 8.22185 10.3176 8.72978 10.0531 9.14309C9.81915 9.50868 9.50868 9.81915 9.14309 10.0531C8.72978 10.3176 8.22185 10.4445 7.20599 10.6985L2 12L7.20599 13.3015C8.22185 13.5555 8.72978 13.6824 9.14309 13.9469C9.50868 14.1808 9.81915 14.4913 10.0531 14.8569C10.3176 15.2702 10.4445 15.7782 10.6985 16.794L12 22L13.3015 16.794C13.5555 15.7782 13.6824 15.2702 13.9469 14.8569C14.1808 14.4913 14.4913 14.1808 14.8569 13.9469C15.2702 13.6824 15.7782 13.5555 16.794 13.3015L22 12L16.794 10.6985C15.7782 10.4445 15.2702 10.3176 14.8569 10.0531C14.4913 9.81915 14.1808 9.50868 13.9469 9.14309C13.6824 8.72978 13.5555 8.22185 13.3015 7.20599L12 2Z"/></svg></template><template class="icon-tpl"><svg class="float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.5 13L7.28446 14.5689C7.54995 15.0999 7.68269 15.3654 7.86003 15.5954C8.01739 15.7996 8.20041 15.9826 8.40455 16.14C8.63462 16.3173 8.9001 16.4501 9.43108 16.7155L11 17.5L9.43108 18.2845C8.9001 18.5499 8.63462 18.6827 8.40455 18.86C8.20041 19.0174 8.01739 19.2004 7.86003 19.4046C7.68269 19.6346 7.54995 19.9001 7.28446 20.4311L6.5 22L5.71554 20.4311C5.45005 19.9001 5.31731 19.6346 5.13997 19.4046C4.98261 19.2004 4.79959 19.0174 4.59545 18.86C4.36538 18.6827 4.0999 18.5499 3.56892 18.2845L2 17.5L3.56892 16.7155C4.0999 16.4501 4.36538 16.3173 4.59545 16.14C4.79959 15.9826 4.98261 15.7996 5.13997 15.5954C5.31731 15.3654 5.45005 15.0999 5.71554 14.5689L6.5 13Z"/><path d="M15 2L16.1786 5.06442C16.4606 5.79765 16.6016 6.16426 16.8209 6.47264C17.0153 6.74595 17.254 6.98475 17.5274 7.17909C17.8357 7.39836 18.2024 7.53937 18.9356 7.82138L22 9L18.9356 10.1786C18.2024 10.4606 17.8357 10.6016 17.5274 10.8209C17.254 11.0153 17.0153 11.254 16.8209 11.5274C16.6016 11.8357 16.4606 12.2024 16.1786 12.9356L15 16L13.8214 12.9356C13.5394 12.2024 13.3984 11.8357 13.1791 11.5274C12.9847 11.254 12.746 11.0153 12.4726 10.8209C12.1643 10.6016 11.7976 10.4606 11.0644 10.1786L8 9L11.0644 7.82138C11.7976 7.53937 12.1643 7.39836 12.4726 7.17909C12.746 6.98475 12.9847 6.74595 13.1791 6.47264C13.3984 6.16426 13.5394 5.79765 13.8214 5.06442L15 2Z"/></svg></template></div>
  <script>
  // Icon field: the icons are spread left to right across the top of the homepage in a random
  // order (re-shuffled on every visit), kept clear of the menu, portrait, greeting and headline.
  // Each one eases in (fade + scale), holds, and eases out at its own random times, forever.
  (() => {
    const field = document.querySelector(".icon-field"); if (!field) return;
    const tpls = [...field.querySelectorAll(".icon-tpl")];
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let timers = [];
    if (field.parentElement !== document.body) document.body.prepend(field); // field covers the top of the page
    function layout() {
      timers.forEach(clearTimeout); timers = [];
      field.querySelectorAll(".float-icon").forEach((e) => e.remove());
      const main = document.querySelector("main"), mainBox = main.getBoundingClientRect();
      const page = (r) => ({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
      const size = innerWidth <= 700 ? 44 : 75, gap = size * 0.6;
      const portrait = document.querySelector(".portrait");
      const top = 12, bottom = page(portrait.getBoundingClientRect()).b;
      field.style.height = bottom + 20 + "px";
      // keep-clear zones (page coordinates): name, menu, portrait, greeting, headline
      const pad = 12;
      const zone = (el) => { if (!el) return null; const r = page(el.getBoundingClientRect()); return { l: r.l - pad, t: r.t - pad, r: r.r + pad, b: r.b + pad }; };
      const g = document.querySelector(".bubble");
      const avoid = [document.querySelector(".wordmark"), document.querySelector(".site-header nav"), portrait, g, document.querySelector(".intro h1")].map(zone).filter(Boolean);
      const hits = (x, y) => avoid.some((z) => !(x + size <= z.l || x >= z.r || y + size <= z.t || y >= z.b));
      const left = mainBox.left + scrollX, width = mainBox.width;
      const cols = Math.max(1, Math.floor(width / (size + gap)));
      const step = width / cols;
      const order = shuffle(tpls.slice());
      let k = 0;
      for (let c = 0; c < cols; c++) {
        // try a few random heights in this column; skip the column if every spot is taken
        let spot = null;
        for (let tries = 0; tries < 12 && !spot; tries++) {
          const x = left + c * step + rand(0, Math.max(0, step - size));
          const y = top + rand(0, Math.max(0, bottom - top - size));
          if (!hits(x, y)) spot = [x, y];
        }
        if (!spot) continue;
        const icon = order[k++ % order.length].content.firstElementChild.cloneNode(true);
        if (k % order.length === 0) shuffle(order);
        icon.style.cssText = "left:" + spot[0] + "px;top:" + spot[1] + "px;width:" + size + "px;height:" + size + "px";
        field.appendChild(icon);
        if (still) { icon.classList.add("on"); continue; }
        const cycle = () => {
          icon.classList.add("on");
          timers.push(setTimeout(() => {
            icon.classList.remove("on");
            timers.push(setTimeout(cycle, rand(1500, 6000) + 2400));
          }, 2400 + rand(1500, 4500)));
        };
        timers.push(setTimeout(cycle, rand(200, 6000)));
      }
    }
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 250); });
    if (document.readyState === "complete") layout(); else addEventListener("load", layout);
  })();
  </script>
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
  ${home.data.greeting ? `<p class="greeting">${inline(home.data.greeting)}</p>` : ""}
  <h1>${inline(home.data.headline || "").replace(/\s*\|\s*/g, '<br class="desktop-break"> ')}</h1>
  ${home.data.subhead ? `<p class="subhead">${inline(home.data.subhead)}</p>` : ""}
  <div class="lede">${markdown(home.body)}</div>
</section>

<section class="recent" aria-labelledby="recent-h">
  <div class="section-head">
    <h2 id="recent-h">${escapeHtml(home.data.recent_heading || "Recent work")}</h2>
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
    <h2 id="passion-h">${escapeHtml(home.data.passion_heading || "Passion projects")}</h2>
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
    <h2 id="archive-h">${escapeHtml(home.data.archive_heading || "More projects")}</h2>
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
  <h1>${inline(work.data.title || "Work")}</h1>
  <div class="lede">${markdown(work.body)}</div>
</section>
<section class="recent"><div class="cards">${featured.map((p) => card(p, true)).join("\n")}</div></section>
${passion.length ? `<section class="recent passion"><div class="section-head"><h2>${escapeHtml(home.data.passion_heading || "Passion projects")}</h2></div><div class="cards">${passion.map((p) => card(p, false)).join("\n")}</div></section>` : ""}
<section class="archive"><ol class="rows">${archive.map(row).join("\n")}</ol></section>`,
  })
);


/* ---------- case-study page template ---------- */
function caseStudy(p) {
  // next / previous stay within the same section (work or passion), newest to oldest, looping at the end
  const group = p.section === "passion" ? passion : workProjects;
  const k = group.indexOf(p);
  const next = group[(k + 1) % group.length];
  const prev = k > 0 ? group[k - 1] : null;
  const meta = [p.role, p.years, p.client].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  return `
<article class="case">
  <a class="back" href="/work/">${ARROW_BACK} Work</a>
  <header class="case-head">
    <h1>${escapeHtml(p.title)}</h1>
    ${p.logo ? `<img class="case-logo" src="${imageUrl(p.logo)}" alt="${escapeHtml(p.client || "")} logo">` : ""}
    ${meta ? `<p class="case-meta">${meta}</p>` : ""}
    ${p.tagline ? `<p class="case-lede">${escapeHtml(p.tagline)}</p>` : ""}
    ${tags(p)}
  </header>
  ${p.cover ? `<div class="media media-1 case-hero"><figure><img src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}"></figure></div>` : ""}
  <div class="case-body">${markdown(p.body)}</div>
</article>

<nav class="next-project" aria-label="Next project">
  <a href="${projectUrl(next)}">
    <span class="next-label">Next project ${ARROW}</span>
    <span class="next-title">${escapeHtml(next.title)}</span>
    ${next.cover ? `<span class="next-thumb"><img src="${assetUrl(next, next.cover)}" alt="" loading="lazy"></span>` : ""}
  </a>
  ${prev ? `<a class="prev-link" href="${projectUrl(prev)}">${ARROW_BACK} Previous: ${escapeHtml(prev.title)}</a>` : ""}
</nav>

<aside class="author-card">
  <img src="${imageUrl(SITE.portrait)}" alt="" width="72" height="54">
  <div>
    <a class="author-name" href="/about/">${escapeHtml(SITE.name)}</a>
    <span>${escapeHtml(SITE.tagline || "")}</span>
  </div>
</aside>

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


/* About and Contact use the homepage's three-column layout: the text before the first
   "## heading" is column one, and each "## heading" starts the next column. */
const COLUMN_PAGES = ["about", "contact"];
function columns(md, name) {
  const parts = md.split(/\n(?=##\s)/).map((x) => x.trim()).filter(Boolean);
  const cols = parts.map((part) => `<div class="col">${markdown(part)}</div>`);
  if (name === "contact") cols.push(`<div class="col"><p class="big-mail"><a href="mailto:${SITE.email}">${SITE.email}</a></p></div>`);
  return `<div class="cols3">${cols.join("\n")}</div>`;
}

// Simple text pages
for (const name of ["about", "contact", "imprint", "privacy"]) {
  const { data, body } = page(name);
  const withEmail = body.replace(/\{\{email\}\}/g, SITE.email).replace(/\{\{name\}\}/g, SITE.name);
  writeFile(
    `${name}/index.html`,
    layout({
      title: data.title,
      description: data.description,
      urlPath: `/${name}/`,
      schema: name === "about" ? personSchema : undefined,
      bodyClass: `text ${name}`,
      body: `
<section class="page-head"><h1>${inline(data.title || name)}</h1></section>
${COLUMN_PAGES.includes(name) ? columns(withEmail, name) : `<div class="prose">${markdown(withEmail)}</div>`}`,
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
const urls = ["/", "/about/", "/work/", "/contact/", ...projects.map(projectUrl), "/imprint/", "/privacy/"];
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
