#!/usr/bin/env node
/*
  Renders the link-preview image (content/images/og-image.png, 1200 × 630) from the homepage.
  This is what Slack, iMessage, LinkedIn, X etc. show when someone pastes a link to the site.

  Run it after changing the homepage (portrait, headline, colors), then commit the new PNG:
    npm run build && npm run og-image
  First time only: npm install --no-save playwright && npx playwright install chromium

  Not part of the normal build, so publishing from Pages CMS never needs a browser.
*/
const path = require("path");
const http = require("http");
const fs = require("fs");

const DIST = path.join(__dirname, "..", "dist");
const OUT = path.join(__dirname, "..", "content", "images", "og-image.png");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("Build the site first: npm run build");
  process.exit(1);
}

// a tiny static server for dist/
const server = http.createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, async () => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("Needs Playwright (first time only): npm install --no-save playwright && npx playwright install chromium");
    server.close();
    process.exit(1);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: "networkidle" });
    // the pointer-following cubes are left out so the preview stays calm
    await page.addStyleTag({ content: ".cubes-canvas{display:none!important}" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500); // let the portrait finish fading in
    await page.screenshot({ path: OUT });
    console.log(`Saved ${path.relative(process.cwd(), OUT)} (1200 × 630)`);
  } finally {
    await browser.close();
    server.close();
  }
});
