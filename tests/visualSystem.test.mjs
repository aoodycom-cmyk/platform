import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-visual-system.css", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../styles-mobile2.css", import.meta.url), "utf8");
const directorCss = readFileSync(new URL("../styles-design-director-v45.css", import.meta.url), "utf8");
const editorialCss = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const stockCss = readFileSync(new URL("../styles-stock-workspace-v58.css", import.meta.url), "utf8");
const cloudUi = readFileSync(new URL("../src/cloud/franklinCloud.js", import.meta.url), "utf8");
const mobileIndex = html.indexOf("styles-mobile2.css");
const visualIndex = html.indexOf("styles-visual-system.css");

assert.ok(visualIndex > mobileIndex, "the reversible visual layer must load after legacy styles");
assert.match(css, /--ui-text-page:\s*21px/);
assert.match(css, /--ui-text-section:\s*18px/);
assert.match(css, /--ui-text-card:\s*14px/);
assert.match(css, /--ui-text-body:\s*13\.5px/);
assert.match(css, /--ui-radius-card:\s*12px/);
assert.match(css, /--ui-radius-control:\s*8px/);
assert.match(css, /\.compact-card-metric span/);
assert.match(css, /background-image:\s*none !important/);
assert.doesNotMatch(css, /linear-gradient\(/, "the visual layer should not add generated-looking gradients");
assert.match(mobileCss, /\.mobile-app-shell:not\(\.scorecard-app-shell\) \.mobile-app-header\s*\{[\s\S]*?min-height:\s*60px/);
assert.match(mobileCss, /\.company-logo\.app-logo\s*\{[\s\S]*?filter:\s*grayscale\(1\)/);
assert.doesNotMatch(mobileCss, /\.v31-library-heading\s*\{/);
assert.match(directorCss, /--dd-touch:\s*40px/);
assert.match(editorialCss, /--editorial-radius-card:\s*12px/);
assert.match(editorialCss, /\.v31-current-price-hero > strong\s*\{[\s\S]*?font-size:\s*32px/);
assert.match(stockCss, /\.franklin-stock-page-tabs button\s*\{[^}]*min-height:\s*48px[^}]*font-size:\s*13px/);
assert.match(cloudUi, /\.franklin-cloud-trigger\{[^}]*bottom:calc\(72px \+ env\(safe-area-inset-bottom\)\)[^}]*height:40px/, "Settings Cloud control must clear the bottom navigation.");

console.log("Franklin reversible visual system: PASS");
