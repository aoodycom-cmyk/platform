import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set([".git", "node_modules", ".pnpm-store"]);
const files = await walk(root);
const scripts = files.filter((file) => [".js", ".mjs"].includes(extname(file)));
const json = files.filter((file) => extname(file) === ".json");

for (const file of scripts) {
  const text = await readFile(file, "utf8");
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) throw new Error(`Merge marker in ${file}`);
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) throw new Error(`Dynamic code execution in ${file}`);
  await runCheck(file);
}
for (const file of json) JSON.parse(await readFile(file, "utf8"));
console.log(`Franklin quality gate passed: ${scripts.length} scripts, ${json.length} JSON contracts.`);

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

function runCheck(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Syntax check failed: ${file}`)));
  });
}
