import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TESTS = join(ROOT, "tests");
const PUBLIC = join(ROOT, "public");
const CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function discoverTestInventory() {
  const entries = await readdir(TESTS, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  return {
    unit: names.filter((name) => name.endsWith(".test.mjs")).sort(),
    e2e: names.filter((name) => name.endsWith(".e2e.mjs")).sort()
  };
}

export async function runAllTests(options = {}) {
  const inventory = await discoverTestInventory();
  if (!inventory.unit.length) throw new Error("No Franklin unit/integration test files were discovered.");
  if (!inventory.e2e.length) throw new Error("No Franklin E2E test files were discovered.");

  for (const file of inventory.unit) {
    await runNode(["--experimental-vm-modules", join(TESTS, file)], process.env);
  }

  if (options.unitOnly) return inventory;
  const externalUrl = String(process.env.FRANKLIN_E2E_URL || "").trim();
  if (externalUrl) {
    await runE2eFiles(inventory.e2e, externalUrl);
    return inventory;
  }

  const server = createStaticTestServer();
  await listen(server);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  try {
    await runE2eFiles(inventory.e2e, baseUrl);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  return inventory;
}

async function runE2eFiles(files, baseUrl) {
  const env = {
    ...process.env,
    FRANKLIN_E2E_URL: baseUrl,
    ...browserEnvironment()
  };
  for (const file of files) await runNode([join(TESTS, file)], env);
}

function browserEnvironment() {
  const result = {};
  if (!process.env.FRANKLIN_BROWSER_EXECUTABLE && existsSync(CHROME_MAC)) {
    result.FRANKLIN_BROWSER_EXECUTABLE = CHROME_MAC;
  }
  return result;
}

function runNode(args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Test process failed (${signal || code}): ${args.at(-1)}`));
    });
  });
}

function createStaticTestServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      const filePath = resolve(PUBLIC, normalize(requested));
      if (filePath !== PUBLIC && !filePath.startsWith(`${PUBLIC}${sep}`)) throw new Error("OUTSIDE_PUBLIC_ROOT");
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("NOT_A_FILE");
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": mimeType(filePath), "Cache-Control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
}

function mimeType(filePath) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  })[extname(filePath)] || "application/octet-stream";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unitOnly = process.argv.includes("--unit-only");
  runAllTests({ unitOnly }).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
