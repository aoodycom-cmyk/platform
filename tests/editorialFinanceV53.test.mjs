import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const sync = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

const editorialIndex = html.indexOf("styles-editorial-finance-v53.css");
assert.ok(editorialIndex > html.indexOf("styles-mobile-hotfix-v46.css"), "Editorial Finance must be the final CSS layer so legacy overrides cannot shrink its typography.");
assert.ok(editorialIndex < html.indexOf("src/main.js"), "Editorial Finance must load before the application mounts.");
assert.match(html, /src\/main\.js\?v=v62-agreed-ui-fixes/, "The changed report markup must use a fresh asset version.");
assert.match(main, /components\.js\?v=v54-launch-hotfix/, "The application entry point must fetch the redesigned component module under the new asset version.");
assert.match(worker, /editorial-v54-hotfix/, "The PWA cache must advance for the visual release.");
assert.ok(worker.includes('"./styles-editorial-finance-v53.css"'), "The editorial layer must remain available offline.");
assert.ok(sync.includes('"styles-editorial-finance-v53.css"'), "Deploy copies must be generated from the canonical editorial stylesheet.");

for (const token of [
  "--editorial-surface: #17191a",
  "--editorial-line: rgba(255, 255, 255, 0.075)",
  "--editorial-radius-card: 18px",
  "--editorial-positive-surface",
  "--editorial-negative-surface"
]) {
  assert.ok(css.includes(token), `Editorial token missing: ${token}`);
}
assert.match(css, /@media \(max-width: 899px\)/, "The redesign must remain iPhone-first and avoid destabilizing desktop reports.");
assert.match(css, /font-size:\s*15\.5px/, "Arabic analysis copy must be comfortably readable on iPhone.");
assert.match(css, /font-variant-numeric:\s*tabular-nums lining-nums/, "Financial values must align with tabular numerals.");
assert.equal(css.includes("linear-gradient("), false, "The editorial layer must use calm tonal surfaces rather than generated-looking gradients.");

for (const contract of [
  "thesis-balance-card",
  "thesis-balance-side",
  "thesis-balance-divider",
  "thesis-source-pill",
  "thesis-balance-full-card",
  "ميزان الفرضية الاستثمارية"
]) {
  assert.ok(components.includes(contract), `Thesis balance presentation contract missing: ${contract}`);
}
assert.ok(components.includes('isSupport ? "support" : "risk"'), "The thesis preview must expose distinct support and risk tones.");
assert.ok(components.includes("report.metadata?.franklinV3Report?.strengths"), "Rich canonical strength evidence must be preferred over flattened legacy strings.");
assert.ok(components.includes("report.metadata?.franklinV3Report?.risks"), "Rich canonical risk evidence must be preserved.");
assert.ok(components.includes("new Set(ids.map"), "Duplicate source IDs must not inflate the displayed provenance count.");
assert.ok(components.includes('data-panel="strengths-risks"'), "The preview card must retain the full evidence navigation.");
assert.equal(components.includes("فرصة الاستثمار • Investment Opportunity"), false, "Arabic report headings must not contain mixed-language clutter.");

console.log("Franklin Editorial Finance v53: PASS");
