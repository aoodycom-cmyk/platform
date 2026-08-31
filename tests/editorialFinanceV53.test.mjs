import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const earningsCss = readFileSync(new URL("../styles-earnings-compact-v56.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const sync = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

const editorialIndex = html.indexOf("styles-editorial-finance-v53.css");
assert.ok(editorialIndex > html.indexOf("styles-mobile-hotfix-v46.css"), "Editorial Finance must be the final application CSS entry point.");
assert.ok(editorialIndex < html.indexOf("src/main.js"), "Editorial Finance must load before the application mounts.");
assert.match(html, /src\/main\.js\?v=v54-launch-hotfix/, "The stable application entry URL remains unchanged.");
assert.match(main, /components\.js\?v=v54-launch-hotfix/, "The report component asset contract remains unchanged.");
assert.match(worker, /editorial-v54-hotfix/, "The PWA cache retains the launch-hotfix lineage while advancing the earnings release.");

assert.ok(css.length > 20000, "The full Codex editorial layer must remain the application-wide presentation base.");
assert.ok(css.includes("Franklin Editorial Finance v53"), "The restored Codex editorial source must remain identifiable.");
assert.ok(main.includes("earningsTableExperience.js?v=v57-earnings-single-source"), "The isolated earnings layer must load through the single-source runtime module.");
assert.ok(worker.includes('"./styles-editorial-finance-v53.css"'));
assert.ok(worker.includes('"./styles-earnings-compact-v56.css"'));
assert.ok(sync.includes('"styles-editorial-finance-v53.css"'));
assert.ok(sync.includes('"styles-earnings-compact-v56.css"'));

for (const token of [
  "--editorial-surface: #17191a",
  "--editorial-line: rgba(255, 255, 255, 0.075)",
  "--editorial-radius-card: 18px",
  "--editorial-positive-surface",
  "--editorial-negative-surface"
]) {
  assert.ok(css.includes(token), `Editorial token missing: ${token}`);
}
assert.match(css, /@media \(max-width: 899px\)/, "The Codex redesign must remain iPhone-first.");
assert.match(css, /font-size:\s*15\.5px/, "Arabic analysis copy must remain comfortably readable on iPhone.");
assert.match(css, /font-variant-numeric:\s*tabular-nums lining-nums/, "Financial values must keep tabular numerals.");
assert.equal(css.includes("linear-gradient("), false, "The Codex editorial base must keep calm tonal surfaces.");
assert.equal(earningsCss.includes("linear-gradient("), false, "The earnings screen must keep the same quiet Franklin identity.");
assert.ok(earningsCss.includes('data-earnings-table-enhanced="true"'), "Earnings overrides must remain isolated from the rest of Franklin.");

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
assert.ok(components.includes('isSupport ? "support" : "risk"'));
assert.ok(components.includes("report.metadata?.franklinV3Report?.strengths"));
assert.ok(components.includes("report.metadata?.franklinV3Report?.risks"));
assert.ok(components.includes("new Set(ids.map"));
assert.ok(components.includes('data-panel="strengths-risks"'));
assert.equal(components.includes("فرصة الاستثمار • Investment Opportunity"), false);

console.log("Franklin Editorial Finance v53 restored base: PASS");
