import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const DIRECTORY_PAIRS = [
  ["src", "public/src"],
  ["src", "docs/src"],
  ["assets", "public/assets"],
  ["assets", "docs/assets"]
];

const FILES = [
  "index.html",
  "styles.css",
  "styles-mobile2.css",
  "styles-mobile-scorecard-figma.css",
  "styles-quarterly-earnings-entry.css",
  "styles-desktop.css",
  "styles-premium.css",
  "styles-v11-mobile-cleanup.css",
  "service-worker.js",
  "manifest.webmanifest",
  "offline.html",
  "login.html",
  "backend-config.js",
  "CHANGELOG.md",
  "SOURCE_OF_TRUTH.md"
];

for (const [source, target] of DIRECTORY_PAIRS) {
  assert.deepEqual(snapshot(source), snapshot(target), `${target} is out of sync with canonical ${source}. Run npm run sync-public.`);
}

for (const file of FILES) {
  const sourceHash = fileHash(join(ROOT, file));
  assert.equal(fileHash(join(ROOT, "public", file)), sourceHash, `public/${file} is out of sync. Run npm run sync-public.`);
  assert.equal(fileHash(join(ROOT, "docs", file)), sourceHash, `docs/${file} is out of sync. Run npm run sync-public.`);
}

console.log("Source-of-truth sync test passed.");

function snapshot(dir) {
  const root = join(ROOT, dir);
  return Object.fromEntries(walk(root)
    .map((file) => [relative(root, file), fileHash(file)])
    .sort(([a], [b]) => a.localeCompare(b)));
}

function walk(dir) {
  return readdirSync(dir)
    .filter((name) => name !== ".DS_Store")
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
