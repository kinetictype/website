# kierawestphal.com — content kit

This folder holds **every piece of text on the site** as `.md` files, already filled in with what's live today.
Edit them on your computer, then upload them to GitHub. The site republishes itself about a minute later.

## What's in here

```
01-START-HERE.md      ← this guide
02-CHECKLIST.md       ← every file that still has placeholder text
content/
  site.md             ← name, email, Google description, portrait, profile links
  pages/
    home.md           ← headline, greeting, the three intro columns
    contact.md        ← Contact page
    work.md           ← Work page intro
    journal.md        ← Journal page title and intro line
    imprint.md        ← Impressum (fill in the [brackets] before launch)
    privacy.md        ← Datenschutz (fill in the [brackets] before launch)
  projects/           ← one file per project (project-01 … project-15, passion-01 … passion-03)
  journal/            ← one file per Journal entry (entry-01 … entry-12)
templates/
  new-project.md      ← blank project to copy for a new one
  new-journal-entry.md← blank Journal entry
```

| File | Where it shows on the site |
|---|---|
| `project-01` to `project-03` | The three **Recent work** cards (they have `featured: true`) |
| `project-04` to `project-15` | **More projects** list |
| `passion-01` to `passion-03` | **Passion projects** |
| `project-04` | Goldman Sachs · `project-05` Fitbit · `project-06` Cisco · `project-07` Google Shopping · `project-08` TiVo · `project-09` Workday · `project-10` Chase · `project-11` Chicago Tribune |

## How a file is laid out

Every file has two parts:

```
---
title: Interactive Visualization Designer     ← settings: one per line, "name: value"
years: 2019–2021
categories:                                    ← a list: one item per line, starting with "- "
- Data Visualization
- Web
---
Opening paragraph of the case study…           ← the text, written in Markdown

## The challenge
More text…
```

Lines starting with `#` between the `---` lines are notes for you; the site ignores them.
The `<!-- … -->` note under the second `---` is also ignored.

## Rules that keep the site working

1. **Keep the file names.** The name is the web address (`project-04.md` → `/work/project-04/`).
2. **Keep both `---` lines** and keep each setting's name (the word before the colon). Only change what comes after the colon.
3. **Put text in quotes** if it contains `: ` (a colon followed by a space) or starts with `- `, `*`, `#`, `[`, `{`, `&`, `!`, `|`, `>`, `'` or `"`.
   Example: `tagline: "Redesign: help to self-service"`
4. **true / false** for yes/no settings (`featured`, `hidden`). **Dates** as `2026-10-19`. **Numbers** without quotes (`start_year: 2019`).
5. **Images:** upload the image first (see below), then type its path starting with `/images/`, e.g.
   `drawer_image: /images/projects/project-04-goldman-sachs/screenshot.webp`. Spaces in file names work but hyphens are safer.
6. Leave a setting **empty** (nothing after the colon) to hide it.
7. If something breaks, nothing on the live site changes: the publish step stops and the previous version stays up.
   Open **github.com/kinetictype/website → Actions** to see the error, or send it to me.

## Writing the text (Markdown)

| You type | You get |
|---|---|
| `## The challenge` | a section heading |
| `**bold**` / `*italic*` | **bold** / *italic* |
| `[Charts talk](https://vimeo.com/…)` | a link |
| `- item` | a bullet |
| `> A line someone said` | a pull quote |
| a blank line | a new paragraph |

- **Homepage intro** (`home.md`): each paragraph becomes one of the three columns.
- **Contact:** text before the first `## Heading` is column one; each `## Heading` starts the next column.
- **Case-study images:** use the `gallery:` list in the project file. Each image has `image`, `alt`, `caption` and `size` (`full`, `half` or `third`).

## Uploading your files

**Text files (.md)**

1. Open **github.com/kinetictype/website** and click into `content`, then the folder you're updating (`projects`, `journal` or `pages`).
2. Click **Add file → Upload files**.
3. Drag in your edited files. Files with the same name replace the old ones.
4. Scroll down and click **Commit changes**.
5. Wait about a minute, then refresh **kinetictype.github.io/website/** (Cmd + Shift + R).

Upload `site.md` into `content` itself, not into a subfolder.

**Images**

Upload images the same way, into the matching folder **before** you upload the .md file that uses them:

| Folder | What goes in it |
|---|---|
| `content/images/logos/` | Client logos (SVG with a transparent background is best) |
| `content/images/projects/<project folder>/` | A project's drop-down image, top image and gallery images (e.g. `project-04-goldman-sachs`) |
| `content/images/journal/` | Journal images |

Photos and screenshots: JPG or WebP, about 1600 px wide, under 400 KB.

You can also keep using **Pages CMS** or **CloudCannon** for quick edits. They edit these same files, so everything stays in sync.
If you edit in a CMS and then upload an older copy of the same file from this kit, the upload wins, so download a fresh kit (or ask me) before a big round of edits.

## Adding something new

- **New project:** copy `templates/new-project.md` into `content/projects/`, rename it (lowercase, hyphens), fill it in, upload.
- **New Journal entry:** copy `templates/new-journal-entry.md` into `content/journal/`, rename, fill in, upload. Entries with `hidden: true` stay off the site.
