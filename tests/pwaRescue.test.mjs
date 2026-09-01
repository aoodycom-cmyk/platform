import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VERSION = "visual-qa-20260901-7";
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const rescue = readFileSync(new URL("../rescue.html", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

assert.ok(index.includes(VERSION), "index should request the mobile rescue release assets");
assert.ok(index.includes("reset-pwa"), "index should support a forced PWA reset query");
assert.ok(index.includes("searchParams.delete(\"fresh\")"), "index should remove one-time rescue query params after reset");
assert.ok(index.includes("navigator.serviceWorker.getRegistrations"), "index should unregister stale service workers");
assert.ok(index.includes("caches.keys"), "index should clear Franklin caches");

assert.match(serviceWorker, /franklin-research-[A-Za-z0-9._-]+/, "service worker should use a versioned Franklin cache name");
assert.ok(serviceWorker.includes("\"./rescue.html\""), "service worker should make the rescue page available");
assert.equal(serviceWorker.includes("\"./\""), false, "service worker should not precache the app shell route");
assert.equal(serviceWorker.includes("\"./index.html\""), false, "service worker should not precache index.html");

assert.ok(rescue.includes(VERSION), "rescue page should redirect to the mobile rescue release");
assert.ok(rescue.includes("<script>"), "rescue page should use a classic script for wider mobile support");
assert.equal(rescue.includes("type=\"module\""), false, "rescue page must not depend on module support");
assert.ok(rescue.includes("registration.unregister()"), "rescue page should unregister all service workers");
assert.ok(rescue.includes("caches.delete(key)"), "rescue page should delete Franklin cache entries");
assert.ok(rescue.includes("لا يتم حذف تحليلاتك"), "rescue copy should reassure users that saved analyses are not deleted");

assert.ok(syncScript.includes("\"rescue.html\""), "rescue.html should sync to public and docs deployments");

console.log("PWA rescue tests passed.");
