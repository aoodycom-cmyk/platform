import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VERSION = "v11-franklin-v35-20260822-safari-boot1";
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const rescue = readFileSync(new URL("../rescue.html", import.meta.url), "utf8");

assert.ok(index.includes(VERSION), "index should request the Safari boot guard release");
assert.ok(serviceWorker.includes(`franklin-research-${VERSION}`), "service worker should use the Safari boot guard cache");
assert.ok(rescue.includes(VERSION), "rescue should redirect to the Safari boot guard release");

assert.ok(index.includes("String.prototype.replaceAll"), "Safari guard should polyfill replaceAll");
assert.ok(index.includes("String.prototype.matchAll"), "Safari guard should polyfill matchAll");
assert.ok(index.includes("Array.prototype.at"), "Safari guard should polyfill Array.at");
assert.ok(index.includes("Promise.prototype.finally"), "Safari guard should polyfill Promise.finally");
assert.ok(index.includes("franklin:boot-ready"), "index should listen for a successful Franklin boot");
assert.ok(index.includes("Safari لم يكمل فتح Franklin"), "index should show a visible Safari diagnostic fallback");
assert.ok(index.includes("data-franklin-boot-placeholder"), "index should render an immediate nonblank boot placeholder");

assert.equal(index.includes("quarterlyScorecardMobileFigma.js?v="), false, "optional UI modules should not be static index scripts");
assert.equal(index.includes("quarterlyEarningsEntry.js?v="), false, "optional earnings entry should not be a static index script");
assert.ok(main.includes("bootFranklin();"), "main should start through the guarded boot function");
assert.ok(main.includes("loadOptional(\"./ui/quarterlyScorecardMobileFigma.js\""), "optional scorecard enhancer should be dynamic");
assert.ok(main.includes("loadOptional(\"./financialSafety/financialSafety.js\""), "financial guard should be dynamic");
assert.ok(main.includes("signalBootReady(root)"), "main should mark the app mounted after core render");
assert.ok(main.includes("recordBootIssue(\"core-boot\""), "main should record core boot failures");

console.log("Safari boot guard tests passed.");
