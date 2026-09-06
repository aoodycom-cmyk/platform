import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { discoverTestInventory } from "../scripts/run-tests.mjs";

const ROOT = new URL("../", import.meta.url);

test("npm test uses the authoritative discovery runner", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", ROOT), "utf8"));
  assert.equal(packageJson.scripts.test, "node scripts/run-tests.mjs");
});

test("the authoritative runner owns every Franklin test executable", async () => {
  const inventory = await discoverTestInventory();
  const files = (await readdir(new URL("tests/", ROOT)))
    .filter((name) => name.endsWith(".test.mjs") || name.endsWith(".e2e.mjs"))
    .sort();

  assert.deepEqual([...inventory.unit, ...inventory.e2e].sort(), files);
  assert.ok(inventory.unit.includes("testRunnerCompleteness.test.mjs"));
  assert.deepEqual(inventory.e2e, ["jsonArchitecture.e2e.mjs", "phase6MobilePwa.e2e.mjs"]);
});
