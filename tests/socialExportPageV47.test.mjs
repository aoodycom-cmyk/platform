import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const components = read("../src/ui/components.js");
const foundation = read("../src/ui/foundation.js");
const social = read("../src/ui/socialImageExport.js");
const quality = read("../src/ui/socialImageExportQualityPatch.js");
const index = read("../index.html");
const worker = read("../service-worker.js");
const bootVersion = index.match(/var version = "([^"]+)"/)?.[1];
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

assert.match(components, /\["social-export", "Export"\]/);
assert.doesNotMatch(components.slice(components.indexOf("const panels"), components.indexOf("const visiblePanels")), /\["external-import", "Import Analysis"\]/);
assert.match(components, /function socialExportPage/);
assert.match(components, /التحليل الأساسي/);
assert.match(components, /آخر تحليل أرباح/);
assert.match(components, /data-social-export-report-id/);
assert.match(foundation, /"social-export":/);
assert.match(social, /button\.dataset\.socialExportReportId/);
assert.match(quality, /button\.dataset\.socialExportReportId/);
assert.ok(bootVersion, "index.html must expose the Franklin boot asset version.");
assert.match(index, new RegExp(`main\\.js\\?v=${escapeRegExp(bootVersion)}`));
assert.ok(worker.includes(`franklin-research-${bootVersion}`));

console.log("Social export page v47 checks passed.");
