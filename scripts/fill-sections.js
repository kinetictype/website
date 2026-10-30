#!/usr/bin/env node
/* Gives every project without sections the standard case-study structure (templates/default-sections.yml):
   Context, Your goal, Design principles & frameworks, Challenges, Showing your designs, Results & outcomes, Learnings,
   with placeholder text and images in the alternating layout. Run by the deploy workflow on every push, so a project
   created in Pages CMS gets the same structure as all the others. Existing sections are never touched. */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "content", "projects");
const block = fs.readFileSync(path.join(ROOT, "templates", "default-sections.yml"), "utf8")
  .split("\n").filter((l) => !l.startsWith("#")).join("\n").trim() + "\n";
const changed = [];
for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  const file = path.join(DIR, name);
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  let data;
  try { data = yaml.load(m[1]) || {}; } catch { continue; }
  if (Array.isArray(data.sections) && data.sections.length) continue;
  // drop an empty "sections:" line if there is one, then add the standard sections at the end of the front matter
  const front = m[1].replace(/^sections:\s*(\[\]|null|~)?\s*$/m, "").replace(/\s+$/, "");
  fs.writeFileSync(file, text.replace(m[0], `---\n${front}\n${block}---`));
  changed.push(name);
}
console.log(changed.length ? `Added the standard sections to: ${changed.join(", ")}` : "Every project already has sections.");
