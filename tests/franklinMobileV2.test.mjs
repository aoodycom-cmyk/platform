import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-franklin-v2.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../src/ui/foundation.js", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

assert.ok(html.indexOf("styles-franklin-v2.css") > html.indexOf("styles-visual-system.css"));
assert.match(css, /--v2-accent:\s*#2dd1bc/);
assert.match(css, /min-height:\s*96px !important/);
assert.match(css, /grid-template-columns:\s*repeat\(3, 1fr\)/);
assert.match(components, /"strengths-risks"/);
assert.match(components, /function strengthsRisksPage/);
assert.match(components, /v2-library-scenarios/);
assert.match(components, /Morningstar/);
assert.match(foundation, /<svg viewBox=/);
assert.doesNotMatch(foundation, /home:\s*"⌂"/);
assert.match(syncScript, /"styles-franklin-v2\.css"/);
assert.match(serviceWorker, /franklin-mobile-v2-v52/);
assert.match(serviceWorker, /"\.\/styles-franklin-v2\.css"/);

console.log("Franklin Mobile Redesign V2: PASS");
