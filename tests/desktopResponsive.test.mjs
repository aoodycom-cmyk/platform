import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rootCss = readFileSync(new URL("../styles-desktop.css", import.meta.url), "utf8");
const publicCss = readFileSync(new URL("../public/styles-desktop.css", import.meta.url), "utf8");
const docsCss = readFileSync(new URL("../docs/styles-desktop.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.equal(publicCss, rootCss, "public desktop stylesheet must match canonical root stylesheet");
assert.equal(docsCss, rootCss, "docs desktop stylesheet must match canonical root stylesheet");
assert.ok(rootCss.includes("@media (min-width: 900px)"), "desktop layer must be gated away from approved mobile layout");
assert.ok(rootCss.includes(".mobile-app-shell:not(.scorecard-app-shell) .mobile-app-frame"), "desktop shell must override the old 440px mobile frame");
assert.ok(rootCss.includes("1280px"), "standard desktop app shell must use a desktop-width cap");
assert.ok(rootCss.includes(".scorecard-app-shell .mobile-app-frame"), "scorecard must have its own desktop canvas");
assert.ok(rootCss.includes("1440px"), "scorecard desktop canvas must support the approved 1440px Figma design");
assert.ok(rootCss.includes('"detail annual"') && rootCss.includes('"detail main"'), "desktop scorecard must place detail panel beside annual summary and matrix");
assert.ok(rootCss.includes(".quarterly-scorecard-layout") && rootCss.includes("display: contents"), "scorecard nested layout must participate in the Figma desktop grid");
assert.ok(rootCss.includes(".quarterly-mobile-cards") && rootCss.includes("display: none"), "desktop scorecard must render the matrix instead of enlarged mobile cards");
assert.ok(index.includes("styles-desktop.css?v=v11-library-ui-20260820d"), "app must load the desktop responsive layer after the existing styles");

console.log("Desktop responsive and Figma scorecard regression tests passed.");
