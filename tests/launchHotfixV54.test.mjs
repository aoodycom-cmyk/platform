import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../src/ui/foundation.js", import.meta.url), "utf8");
const store = readFileSync(new URL("../src/state/store.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

assert.equal(css.includes("padding-inline: 16px !important;\n    padding-bottom: 112px !important;"), false, "Editorial CSS must not double the iPhone frame inset or bottom navigation reserve.");
assert.equal(store.includes('theme: saved.theme || "dark"'), false, "A saved light preference must not reopen the unsupported hybrid theme.");
assert.ok(store.includes('theme: "dark"'), "Franklin must persist the production dark theme until a complete light theme exists.");
assert.equal(components.includes('data-action="toggle-theme"'), false, "The incomplete light-theme control must not appear in report flows.");
assert.equal(foundation.includes('data-action="toggle-theme"'), false, "The incomplete light-theme control must not appear in generic headers.");
assert.ok(components.includes('document.documentElement.dataset.theme = "dark"'), "Rendering must keep the full application in one coherent theme.");

assert.equal(html.includes("جاري فتح Franklin"), false, "Normal boot must not expose a textual loading/debug card.");
assert.ok(html.includes('aria-hidden="true"'), "Normal boot should use a silent placeholder.");
assert.ok(html.includes("<details") && html.includes("تفاصيل تقنية"), "Raw Safari diagnostics must stay behind progressive disclosure.");
assert.ok(html.indexOf("<details") < html.indexOf("<code"), "Safari diagnostic code must be nested under the details control.");
assert.match(html, /backend-config\.js\?v=v54-launch-hotfix/, "Safari recovery configuration must bypass the previous cached detector.");

assert.ok(components.includes('isArabicUi() ? "›" : "‹"'), "Arabic report back actions must point toward the RTL return direction.");
assert.ok(foundation.includes('language === "ar" ? "›" : "‹"'), "Arabic generic back actions must point toward the RTL return direction.");
assert.match(html, /v54-launch-hotfix/, "The hotfix must bypass stale iPhone assets.");
assert.match(worker, /editorial-v54-hotfix/, "The PWA cache must advance for the launch hotfix.");

console.log("Franklin launch hotfix v54: PASS");
