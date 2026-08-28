import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../styles-mobile-hotfix-v46.css");
const index = read("../index.html");
const worker = read("../service-worker.js");
const sync = read("../scripts/sync-deploy.mjs");

assert.match(index, /styles-mobile-hotfix-v46\.css\?v=v46-iphone-nav-date/);
assert.match(index, /main\.js\?v=v46-iphone-nav-date/);
assert.ok(worker.includes('"./styles-mobile-hotfix-v46.css"'));
assert.ok(worker.includes("franklin-research-v11-franklin-mobile-v2-v46"));
assert.ok(sync.includes('"styles-mobile-hotfix-v46.css"'));

assert.match(css, /\.mobile-nav:not\(\.quarterly-scorecard-nav\)[\s\S]*left: 0 !important;/);
assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important;/);
assert.match(css, /transform: none !important;/);
assert.match(css, /\.franklin-price-asof[\s\S]*display: none !important;/);
assert.match(css, /\.franklin-card-readiness[\s\S]*white-space: nowrap !important;/);

console.log("Mobile hotfix v46 regression checks passed.");
