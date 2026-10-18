import assert from "node:assert/strict";
import {
  SOCIAL_EXPORT_SCALE,
  SOCIAL_EXPORT_PIXEL_WIDTH,
  SOCIAL_EXPORT_PIXEL_HEIGHT,
  SOCIAL_EXPORT_HD_LABEL,
  updateSocialExportHdLabel
} from "../src/ui/socialImageExportQualityPatch.js";

assert.equal(SOCIAL_EXPORT_SCALE, 2);
assert.equal(SOCIAL_EXPORT_PIXEL_WIDTH, 2160);
assert.equal(SOCIAL_EXPORT_PIXEL_HEIGHT, 2700);
assert.equal(SOCIAL_EXPORT_HD_LABEL, "PNG · 2160 × 2700 · HD");

let writes = 0;
const label = {
  value: "PNG · 1080 × 1350",
  get textContent() { return this.value; },
  set textContent(value) { writes += 1; this.value = value; }
};
const root = { querySelector: () => label };

assert.equal(updateSocialExportHdLabel(root), true, "the stale label should be updated");
assert.equal(updateSocialExportHdLabel(root), false, "an observer callback must not rewrite an already-correct label");
assert.equal(writes, 1, "idempotence prevents the MutationObserver feedback loop");
assert.equal(updateSocialExportHdLabel({ querySelector: () => null }), false);

console.log("Social image export HD quality: PASS");
