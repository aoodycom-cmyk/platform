import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const syncDeploy = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/ui/quarterlyEarningsEntry.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-quarterly-earnings-entry.css", import.meta.url), "utf8");

assert.match(index, /styles-quarterly-earnings-entry\.css/);
assert.match(index, /quarterlyEarningsEntry\.js/);
assert.match(worker, /styles-quarterly-earnings-entry\.css/);
assert.match(worker, /quarterlyEarningsEntry\.js/);
assert.match(syncDeploy, /styles-quarterly-earnings-entry\.css/);

assert.match(source, /إضافة نتائج ربع/);
assert.match(source, /data-quarter=/);
assert.match(source, /Quarter context: Q\$\{quarter\} \$\{year\}/);
assert.match(source, /open-earnings-update/);
assert.match(source, /data-earnings-field='earningsText'/);
assert.match(source, /dispatchEvent\(new Event\("input"/);
assert.match(css, /@media \(max-width: 899px\)/);
assert.match(css, /quarterly-earnings-entry-overlay/);
assert.match(css, /#60a5fa/i);

console.log("Quarterly earnings entry integration checks passed.");
