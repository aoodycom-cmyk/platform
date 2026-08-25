import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-visual-system.css", import.meta.url), "utf8");
const mobileIndex = html.indexOf("styles-mobile2.css");
const visualIndex = html.indexOf("styles-visual-system.css");

assert.ok(visualIndex > mobileIndex, "the reversible visual layer must load after legacy styles");
assert.match(css, /--ui-text-page:\s*22px/);
assert.match(css, /--ui-text-section:\s*18px/);
assert.match(css, /--ui-text-body:\s*14px/);
assert.match(css, /\.compact-card-metric span/);
assert.match(css, /background-image:\s*none !important/);
assert.doesNotMatch(css, /linear-gradient\(/, "the visual layer should not add generated-looking gradients");

console.log("Franklin reversible visual system: PASS");
