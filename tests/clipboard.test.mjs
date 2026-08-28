import assert from "node:assert/strict";
import { copyTextForMobile } from "../src/ui/clipboard.js";

let modernValue = "";
await copyTextForMobile("large Franklin prompt", {
  navigator: { clipboard: { writeText: async (value) => { modernValue = value; } } },
  document: { createElement: () => { throw new Error("legacy copy must not run when Clipboard API is available"); } }
});
assert.equal(modernValue, "large Franklin prompt");

let legacyValue = "";
let removed = false;
const textarea = { value: "", style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, remove() { removed = true; } };
await copyTextForMobile("legacy prompt", {
  navigator: {},
  document: {
    body: { appendChild(node) { legacyValue = node.value; } },
    createElement: () => textarea,
    execCommand: (command) => command === "copy"
  }
});
assert.equal(legacyValue, "legacy prompt");
assert.equal(removed, true);
await assert.rejects(() => copyTextForMobile("", { navigator: {}, document: {} }), /Nothing to copy/);
console.log("clipboard tests passed");
