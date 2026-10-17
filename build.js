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

function writeFile(rel, content) {
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

marked.use({ gfm: true });
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
      <span class="row-title">${escapeHtml(p.title)}</span>
      <span class="row-tags">${tags(p)}</span>
      <span class="row-toggle" aria-hidden="true"></span>
    </summary>
    <div class="drawer">
      ${p.cover ? `<a class="drawer-media" href="${projectUrl(p)}" tabindex="-1"><img src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}" loading="lazy"></a>` : ""}
      <div class="drawer-text">
        ${p.tagline ? `<p class="drawer-tagline">${escapeHtml(p.tagline)}</p>` : ""}
        ${facts ? `<dl class="facts">${facts}</dl>` : ""}
        <a class="drawer-link" href="${projectUrl(p)}">View project →</a>
      </div>
    </div>
  </details></li>`;
}

function yearSpan(list) {
  const years = list.map((p) => Number(p.start_year)).filter(Boolean);
  if (!years.length) return "";
  return `${Math.min(...years)}–${Math.max(...years)}`;
}

/* ---------- build ---------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(THEME, "style.css"), path.join(OUT, "style.css"));
copyDir(path.join(CONTENT, "images"), path.join(OUT, "images"));
copyDir(path.join(THEME, "fonts"), path.join(OUT, "fonts"));

// Background color from site.md is injected into the stylesheet
if (SITE.background) {
  const css = read(path.join(OUT, "style.css")).replace(/--bg:\s*#[0-9a-fA-F]{3,8};/, `--bg: ${SITE.background};`);
  fs.writeFileSync(path.join(OUT, "style.css"), css);
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
  <img class="portrait" src="${imageUrl(SITE.portrait)}" alt="${escapeHtml(SITE.portrait_alt || SITE.name)}" width="320" height="238">
  <script>
  // let the portrait finish its circle before stopping
  (() => {
    const p = document.querySelector(".portrait"); if (!p) return;
    let leaving = false;
    p.addEventListener("mouseenter", () => { leaving = false; p.classList.add("orbit"); });
    p.addEventListener("mouseleave", () => { leaving = true; });
    p.addEventListener("animationiteration", () => { if (leaving) p.classList.remove("orbit"); });
  })();
  </script>
  <p class="greeting">${inline(home.data.greeting || "")}</p>
  <h1>${inline(home.data.headline || "")}</h1>
  <div class="lede">${markdown(home.body)}</div>
</section>

<section class="recent" aria-labelledby="recent-h">
  <div class="section-head">
    <h2 id="recent-h">${escapeHtml(home.data.recent_heading || "Recent work")}</h2>
    <a href="/work/">All work →</a>
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
      body: `
<article>
  <header class="page-head">
    <p class="eyebrow"><a href="/work/">Work</a> / ${escapeHtml(String(p.years || ""))}</p>
    <h1>${escapeHtml(p.title)}</h1>
    <p class="lede">${escapeHtml(p.tagline || "")}</p>
    <dl class="facts">
      ${p.client ? `<div><dt>Client</dt><dd>${escapeHtml(p.client)}</dd></div>` : ""}
      ${p.role ? `<div><dt>Role</dt><dd>${escapeHtml(p.role)}</dd></div>` : ""}
      ${p.years ? `<div><dt>Years</dt><dd>${escapeHtml(String(p.years))}</dd></div>` : ""}
    </dl>
  </header>
  ${p.cover ? `<figure class="hero"><img src="${assetUrl(p, p.cover)}" alt="${escapeHtml(p.cover_alt || "")}"></figure>` : ""}
  <div class="prose">${markdown(p.body)}</div>
</article>
<nav class="pager" aria-label="More projects">
  ${prev ? `<a href="${projectUrl(prev)}"><span>← Newer</span>${escapeHtml(prev.title)}</a>` : "<span></span>"}
  ${next ? `<a class="next" href="${projectUrl(next)}"><span>Older →</span>${escapeHtml(next.title)}</a>` : "<span></span>"}
</nav>`,
    })
  );
});

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
<div class="prose">${markdown(withEmail)}</div>
${name === "contact" ? `<p class="big-mail"><a href="mailto:${SITE.email}">${SITE.email}</a></p>` : ""}`,
    })
  );
}

// 404
writeFile(
  "404.html",
  layout({
    title: "Page not found",
    urlPath: "/404.html",
    body: `<section class="page-head"><h1>Page not found</h1><p class="lede">That page doesn't exist. <a href="/">Back to the homepage →</a></p></section>`,
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
