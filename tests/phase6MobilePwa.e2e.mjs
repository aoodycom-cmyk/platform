import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const baseUrl = process.env.FRANKLIN_E2E_URL || "http://127.0.0.1:4321/";
const modulePath = process.env.FRANKLIN_PLAYWRIGHT_MODULE;
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const browserName = String(process.env.FRANKLIN_E2E_BROWSER || "chromium").toLowerCase();
const browser = await playwright[browserName].launch({
  headless: true,
  ...(browserName === "chromium" && process.env.FRANKLIN_BROWSER_EXECUTABLE ? { executablePath: process.env.FRANKLIN_BROWSER_EXECUTABLE } : {})
});

try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: "ar-SA" });
    const page = await context.newPage();
    await page.goto(new URL(`?phase6=${viewport.width}x${viewport.height}`, baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY && window.__equityResearchStore));
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    assert.equal(overflow, 0, `${browserName} ${viewport.width}x${viewport.height} horizontal overflow`);
    const visibleControls = page.locator("button:visible:not([aria-hidden=true]):not([tabindex='-1']), [role=button]:visible:not([aria-hidden=true]):not([tabindex='-1']), input:visible:not([aria-hidden=true]):not([tabindex='-1']), select:visible:not([aria-hidden=true]):not([tabindex='-1']), textarea:visible:not([aria-hidden=true]):not([tabindex='-1'])");
    const count = Math.min(await visibleControls.count(), 40);
    for (let index = 0; index < count; index += 1) {
      const box = await visibleControls.nth(index).boundingBox();
      if (!box) continue;
      const identity = await visibleControls.nth(index).evaluate((node) => `${node.tagName}#${node.id}.${node.className} ${node.getAttribute("aria-label") || node.textContent || ""}`.slice(0, 240));
      assert.ok(box.width >= 24 && box.height >= 24, `undersized control ${index}: ${box.width}x${box.height} ${identity}`);
    }
    await page.evaluate(() => {
      localStorage.setItem("phase6-refresh-sentinel", "محفوظ-123");
      document.body.dataset.phase6LongText = "قيمة عادلة (Fair Value) -12.5% USD ".repeat(200);
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY));
    assert.equal(await page.evaluate(() => localStorage.getItem("phase6-refresh-sentinel")), "محفوظ-123");
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar-SA" });
  const page = await context.newPage();
  await page.goto(new URL("?phase6=pwa", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY));
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) return "missing";
    if (worker.state === "activated") return worker.state;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`service worker activation timeout: ${worker.state}`)), 15000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") { clearTimeout(timeout); resolve(worker.state); }
        if (worker.state === "redundant") { clearTimeout(timeout); reject(new Error("service worker became redundant")); }
      });
    });
  });
  assert.equal(workerState, "activated");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, "service worker must control the reloaded client");
  await context.setOffline(true);
  const cachedOfflinePage = await page.evaluate(async () => {
    const response = await caches.match(new URL("./offline.html", location.href).href);
    return response ? response.text() : "";
  });
  assert.ok(cachedOfflinePage.includes("أنت غير متصل"), "controlled WebKit client must read the offline fallback from cache while disconnected");
  await context.setOffline(false);
  await page.goto(new URL("?phase6=reconnected", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY));
  await context.close();
  console.log(`Franklin Phase 6 mobile/PWA E2E [${browserName}]: PASS`);
} finally {
  await browser.close();
}
