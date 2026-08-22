import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = read("../index.html");
const serviceWorker = read("../service-worker.js");
const store = read("../src/state/store.js");
const components = read("../src/ui/components.js");

assert.ok(index.includes("franklin-cache-version-seen"), "PWA cache cleanup must be version-gated.");
assert.equal(index.includes("window.location.reload()"), false, "PWA cache cleanup must not reload before app boot.");
assert.ok(index.includes("Promise.allSettled"), "PWA cache cleanup must tolerate partial cache cleanup failures.");
assert.ok(index.includes("franklin-reset"), "Static boot rescue reset URL must be available before app modules load.");
assert.ok(index.includes("إصلاح وفتح Franklin"), "Static boot rescue panel must replace a black screen with an action.");
assert.ok(index.includes("franklinManualResetBackup:"), "Static boot reset must preserve a local backup before clearing app state.");

assert.equal(
  /import\s+\{\s*DEMO_ANALYSIS_FIXTURE\s*\}\s+from\s+["']\.\.\/data\/demoFlow\.js["']/.test(store),
  false,
  "Demo fixture must not be a startup dependency."
);
assert.equal(components.includes("../data/demoFlow.js"), false, "UI shell must not import demo fixtures during startup.");
assert.ok(store.includes('await import("../data/demoFlow.js")'), "Demo analysis should load only when requested.");
assert.ok(store.includes('await import("../data/externalDemo.js")'), "External demo scenario should load only when requested.");

assert.equal(serviceWorker.includes("cache.addAll(STATIC_ASSETS)"), false, "Service worker install must not fail on one unavailable optional asset.");
assert.ok(serviceWorker.includes("Promise.allSettled(STATIC_ASSETS.map"), "Service worker install should best-effort cache static assets.");

console.log("Boot resilience checks passed.");

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}
