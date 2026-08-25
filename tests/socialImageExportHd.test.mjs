import assert from "node:assert/strict";
import {
  SOCIAL_EXPORT_SCALE,
  SOCIAL_EXPORT_PIXEL_WIDTH,
  SOCIAL_EXPORT_PIXEL_HEIGHT
} from "../src/ui/socialImageExportQualityPatch.js";

assert.equal(SOCIAL_EXPORT_SCALE, 2);
assert.equal(SOCIAL_EXPORT_PIXEL_WIDTH, 2160);
assert.equal(SOCIAL_EXPORT_PIXEL_HEIGHT, 2700);

console.log("Social image export HD quality: PASS");
