import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

const GENERATED_DIRS = [
  ["src", "public/src"],
  ["src", "docs/src"],
  ["assets", "public/assets"],
  ["assets", "docs/assets"]
];

const GENERATED_FILES = [
  "index.html",
  "styles.css",
  "styles-mobile2.css",
  "styles-mobile-scorecard-figma.css",
  "styles-quarterly-earnings-entry.css",
  "styles-desktop.css",
  "styles-premium.css",
  "styles-v11-mobile-cleanup.css",
  "styles-visual-system.css",
  "styles-franklin-v2.css",
  "styles-design-director-v45.css",
  "styles-mobile-hotfix-v46.css",
  "styles-editorial-finance-v53.css",
  "styles-earnings-compact-v56.css",
  "service-worker.js",
  "manifest.webmanifest",
  "offline.html",
  "rescue.html",
  "login.html",
  "backend-config.js",
  "CHANGELOG.md",
  "SOURCE_OF_TRUTH.md"
];

for (const [source, target] of GENERATED_DIRS) {
  syncDirectory(join(ROOT, source), join(ROOT, target));
}

for (const file of GENERATED_FILES) {
  copyToDeploy(file, "public");
  copyToDeploy(file, "docs");
}

console.log("Deployment copies synced from canonical source.");

function syncDirectory(source, target) {
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, {
    recursive: true,
    filter: (path) => !path.endsWith(".DS_Store")
  });
}

function copyToDeploy(file, deployDir) {
  const source = join(ROOT, file);
  const target = join(ROOT, deployDir, file);
  if (!existsSync(source)) return;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
