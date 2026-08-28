import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../styles-design-director-v45.css");
const index = read("../index.html");
const worker = read("../service-worker.js");
const sync = read("../scripts/sync-deploy.mjs");

assert.match(index, /styles-design-director-v45\.css\?v=v45-design-director/);
assert.match(index, /main\.js\?v=v4[5-8]-(?:design-director|iphone-nav-date|social-export-page|arabic-glossary)/);
assert.ok(worker.includes('"./styles-design-director-v45.css"'));
assert.ok(sync.includes('"styles-design-director-v45.css"'));
assert.match(css, /calc\(118px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(css, /\.quarterly-scorecard-nav\s*\{/);
assert.match(css, /min-height: var\(--dd-touch\)/);
assert.match(css, /font-size: 11px !important/);
assert.match(css, /\.passed::before/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log("Design Director v45 regression checks passed.");
