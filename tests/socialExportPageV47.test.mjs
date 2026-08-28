import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const components = read("../src/ui/components.js");
const foundation = read("../src/ui/foundation.js");
const social = read("../src/ui/socialImageExport.js");
const quality = read("../src/ui/socialImageExportQualityPatch.js");
const index = read("../index.html");
const worker = read("../service-worker.js");

assert.match(components, /\["social-export", "Export"\]/);
assert.doesNotMatch(components.slice(components.indexOf("const panels"), components.indexOf("const visiblePanels")), /\["external-import", "Import Analysis"\]/);
assert.match(components, /function socialExportPage/);
assert.match(components, /التحليل الأساسي/);
assert.match(components, /آخر تحليل أرباح/);
assert.match(components, /data-social-export-report-id/);
assert.match(foundation, /"social-export":/);
assert.match(social, /button\.dataset\.socialExportReportId/);
assert.match(quality, /button\.dataset\.socialExportReportId/);
assert.match(index, /v4[78]-(?:social-export-page|arabic-glossary)/);
assert.match(worker, /mobile-v2-v4[78]/);

console.log("Social export page v47 checks passed.");
