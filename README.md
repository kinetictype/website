# kierawestphal.com

Portfolio site for Kiera Westphal. You edit it in a browser with **Pages CMS** — no code, no terminal.
Every time you press **Save** in the CMS, the change is committed to this repository and the site republishes itself in about a minute.

---

## 1. Edit the site in Pages CMS (the everyday way)

**One-time setup**

1. Go to **https://app.pagescms.org** and click **Sign in with GitHub**.
2. When asked, install the Pages CMS GitHub app and give it access to **kinetictype/website** (you can limit it to just this repository).
3. Open **kinetictype/website** from your project list. The left sidebar shows:
   **Projects · Journal · Homepage · Work page · Journal page · Contact page · Imprint · Privacy · Site settings & SEO**.

**Editing text**

- Click a section, change the fields, press **Save**. That's it.
- The **Case study** and page text fields are a rich-text editor: headings, bold, italic, links, lists, quotes, and images.

**Replacing images**

- On any image field, click it, then **Upload** (or drag a file in). Images are stored in `content/images/`.
- Project covers are shown at 16:10 — export at **1600 × 1000 px** as JPG or WebP, ideally under 400 KB.
- Always fill in the image description (alt text). It's read by screen readers and search engines.

**Projects**

| Field | What it does |
|---|---|
| Title, One-line summary, Client, Role | Shown on the cards, the list, and the project page |
| Years shown on the site | Free text, e.g. `2016–2018` or `2024–Today` |
| Start year | Sorts the list, newest first |
| Show in Recent work + position 1/2/3 | Puts the project in the three cards at the top of the homepage |
| Hide this project | Keeps it off the site without deleting it |
| SEO description | What Google and link previews show for this project |
| Logo / cover | The small image in the More projects row, and the Recent work card (not on the project page) (logos: SVG, transparent) |
| Drop-down image | A separate photo or screenshot shown only when the row is opened in More projects (1600 × 1000) |
| Case study | The body of the project page |

- **Add a project:** Projects → **Add an entry**. The title becomes the filename and the web address
  (`Fitbit Dashboard` → `kierawestphal.com/work/fitbit-dashboard/`).
- **Rename a web address:** use the entry's **Rename** option. Rename before you share links.
- **Remove a project:** delete it, or tick **Hide this project** to keep it for later.
- Only three projects appear in Recent work. If more than three are ticked, positions 1, 2, 3 win; the rest go in the list.

### Project page structure

Every project page follows the same order (the case-study guide):

1. **Header**: Title, One-line summary (the mission), Role (Years) · Client, optional Website link, tags.
2. **Top image**, then **At a glance**: Company (Client, with the year beneath: Timeline, or Years when empty), Role, Team, Responsibilities, Goal, Outcome.
3. **Intro text** and an optional **Prototype** (Figma embed).
4. **Sections**, in this order: Context · Your goal · Design principles & frameworks · Challenges · Showing your designs ·
   Results & outcomes · Learnings. Each has a Heading, Text and Images. Image **Layout**: Full width ·
   Half with text beside it (image left, or text left) · Half (two side by side) · Third.
   Replace each "Placeholder:" prompt with your own words; delete a section you don't need.
5. **Credits**: people you worked with, as Name: role.

### Interactive SVG graphics

Upload interactive SVGs (with replay buttons, hovers or animations) like any other image and pick them in a section's
Images. The site detects them automatically and embeds them so they run in place, exactly as they would opened on their
own. Ordinary SVGs and logos are unaffected.

### Prototype embed

To show a clickable Figma prototype on a project page: in Figma, click **Share → Get embed code** and copy it.
In Pages CMS, open the project and paste it into **Prototype** (the whole `<iframe …>` code or just the link both work).
Choose **Half the page width** or **Full width**, and press **Save**. It appears after the intro text.
On tablets and phones it always runs full width. Only figma.com links are shown.

### Project page images

Open a project and scroll to **Project page images**:

- **Top image** — the large image under the title. Leave it empty and no image shows there.
- **Gallery** — the images shown after the case-study text, in order. Click **Add an entry** for each image, upload it,
  write a description (alt text) and an optional caption, and choose a **Size**:
  **Full width**, **Half** (two in a row sit side by side) or **Third** (three in a row sit side by side).
  Drag entries to reorder them; delete an entry to remove that image.
- Visitors can click any image to see it larger and use the arrow keys to move between images.

You can still drop an image into the **Case study** text itself if you want it between two paragraphs.

**Where images live** (Media in Pages CMS):

| Folder | What goes in it |
|---|---|
| `images/logos/` | Every client logo (SVG, transparent background) |
| `images/projects/<project>/` | One folder per project (e.g. `project-04-goldman-sachs`): drop-down image, case-study images, cover photos |
| `images/journal/` | Journal entry images |
| `images/placeholders/` | Shared stand-in images; upload your own instead of replacing these |

When you upload, open the right folder first in the image picker so files stay grouped.

### Journal

The **Journal** page (`kierawestphal.com/journal/`) lists entries newest first, like a news page:
an image, the date (shown as DD.MM.YYYY), and the title, with a **Filter by** row and a **Load more** button after nine entries.

- **Add an entry:** Journal → **Add an entry**. Fill in Title, Date, Category, an image and its description, then write the entry.
- **Categories** are free text. Every category you use appears as a filter button automatically (use the same spelling each time).
- **Intro line and page title:** edit **Journal page**.
- The 12 "Journal Entry Title" files are placeholders: edit them, or delete the ones you don't need.

### Download CV link

Open **Contact page** in Pages CMS, click **CV file (PDF)**, upload your CV (it's stored in `content/files/`), and press **Save**.
A "Download CV" link appears under your email on the Contact page. Change the wording in **Link text**.
To update the CV later, upload the new PDF and choose it in the same box.

**Site settings & SEO**

Your name, domain (`kierawestphal.com`), email (`k@kierawestphal.com`), the Google description,
link-preview image, profile links, and background color (`#F2F5F7`) are all set here.
Every page title, meta description, canonical link, Open Graph/Twitter tag, structured data, sitemap, and email link
is generated from these values, so change them in this one place only.

In page text, writing `{{email}}` or `{{name}}` inserts the value from Site settings.

**Before going live:** fill in the bracketed placeholders on the **Imprint** and **Privacy** pages.

---

## 2. How the site is organized

```
content/                    ← everything the CMS edits
  site.md                   ← Site settings & SEO
  pages/                    ← Homepage, Work, Contact, Imprint, Privacy
  projects/                 ← one file per project (15 placeholders, 2000–today)
  images/                   ← portrait, link-preview image, favicon
    projects/               ← project covers and case-study images
theme/style.css             ← colors, fonts, layout
build.js                    ← turns content/ into the website
.pages.yml                  ← tells Pages CMS which fields to show
.github/workflows/deploy.yml← builds and publishes on every save
```

Homepage order: intro (portrait, greeting, headline, paragraph) → **Recent work** (three cards) → **More projects** (every other project, newest first).

**Colors and fonts** are at the top of `theme/style.css` (`--ink`, `--muted`, `--accent`, `--card`).
Fonts are system fonts, so the site loads nothing from Google or other third parties.

---

## 3. Publish at kierawestphal.com (one time)

1. In this repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (GitHub Pages on a free account needs the repository to be public.)
2. Open the **Actions** tab → **Deploy site** → **Run workflow**. It finishes in about a minute.
3. **Settings → Pages → Custom domain:** enter `kierawestphal.com`, save, and tick **Enforce HTTPS** once offered.
4. At your domain registrar, point the domain at GitHub Pages:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `kinetictype.github.io`

   Check GitHub's "Managing a custom domain for your GitHub Pages site" page before changing DNS.
   Moving the domain away from Squarespace takes the old site offline, so switch when you're ready.
5. After launch, add the site to Google Search Console and submit `https://kierawestphal.com/sitemap.xml`.

---

## 4. Preview on your own computer (optional)

Needs [Node.js](https://nodejs.org) 18+.

```
npm install        # first time only
npm run preview    # builds and serves at http://localhost:8000
```

## What's generated for SEO

Each page gets a unique title, meta description, canonical URL on kierawestphal.com, Open Graph and Twitter
card tags, and a language tag. The homepage and About page include schema.org `Person` data; project pages
include `CreativeWork` data. The build also writes `sitemap.xml`, `robots.txt`, `404.html`, and the `CNAME`
file that tells GitHub Pages to serve kierawestphal.com.

## New projects get the standard structure automatically
When you create a project in Pages CMS, the deploy workflow runs `scripts/fill-sections.js`, which adds the standard
case-study sections from `templates/default-sections.yml` (Context, Your goal, Design principles & frameworks,
Challenges, Showing your designs, Results & outcomes, Learnings) with placeholder text and images in the alternating
layout. The site shows that structure for a project without sections even before the file is updated.
Existing sections are never changed.
