import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.FRANKLIN_E2E_URL || "http://127.0.0.1:4321/";
const modulePath = process.env.FRANKLIN_PLAYWRIGHT_MODULE;
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const browserName = String(process.env.FRANKLIN_E2E_BROWSER || "chromium").toLowerCase();
const originalLog = console.log;
console.log = () => {};
const { canonical } = await import("./intcOwnerAcceptance.test.mjs");
console.log = originalLog;
const browser = await playwright[browserName].launch({ headless: true, ...(browserName === "chromium" && process.env.FRANKLIN_BROWSER_EXECUTABLE ? { executablePath: process.env.FRANKLIN_BROWSER_EXECUTABLE } : {}) });

try {
  for (const width of [320, 390, 430, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500, locale: "ar-SA", colorScheme: "dark" });
    if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL(`?journey-qa=${width}`, baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY));
    await page.locator(".research-welcome [data-action='open-external-import']").click();
    await page.locator("[data-analysis-company-query]").fill("إنفيديا");
    await page.locator("[data-action='analysis-company-continue']").click();
    await page.locator("[data-analysis-journey-step='2']").waitFor();
    await capture(page, width, "request");
    assert.equal(await page.locator("[data-external-ticker-hint]").inputValue(), "NVDA");
    assert.equal(await page.locator("[data-owner-current-price]:visible").count(), 0, "Manual card editing must not interrupt research setup.");
    const button = await page.locator("[data-action='copy-full-analysis-prompt']").boundingBox();
    const card = await page.locator(".chatgpt-prep-card").boundingBox();
    assert.ok(button.width >= card.width - 50, "The copy button must occupy the available card width.");
    await page.locator("[data-action='copy-full-analysis-prompt']").click();
    await page.locator("[data-analysis-journey-step='3']").waitFor();
    await capture(page, width, "result");
    assert.ok(await page.locator(".journey-copy-confirmation").isVisible());
    if (browserName === "chromium") {
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(copied, /"ticker":\s*"NVDA"/);
    }
    await page.locator("[data-external-import-mode='paste']").click();
    const draftText = "نص النتيجة قبل الرجوع بين الخطوات";
    await page.locator("[data-external-raw]").fill(draftText);
    await page.locator(".analysis-progress [data-analysis-step='2']").click();
    await page.locator(".analysis-progress [data-analysis-step='3']").click();
    assert.equal(await page.locator("[data-external-raw]").inputValue(), draftText, "Back/forward navigation must preserve pasted content.");
    await page.locator("[data-external-raw]").fill("Fair value / ChatGPT هو نظام التحليل المالي");
    await page.locator("[data-action='parse-external-analysis']").click();
    assert.match(await page.locator(".journey-validation").innerText(), /ألصقت طلب التحليل/);
    assert.equal(await page.locator("[data-action='save-external-analysis']").count(), 0, "A copied request must never expose a save action.");
    await page.locator(".analysis-progress [data-analysis-step='1']").click();
    await page.locator("[data-analysis-company-query]").fill("INTC");
    await page.locator("[data-action='analysis-company-continue']").click();
    await page.locator("[data-analysis-journey-step='2']").waitFor();
    await page.locator(".analysis-progress [data-analysis-step='3']").click();
    await page.locator("[data-external-import-mode='paste']").click();
    await page.locator("[data-external-raw]").fill(JSON.stringify(canonical));
    await page.locator("[data-action='parse-external-analysis']").click();
    await page.waitForFunction(() => window.__equityResearchStore.state.externalImport?.validation?.valid && window.__equityResearchStore.state.externalImport?.stage === "preview");
    assert.equal(await page.locator(".owner-import-presentation-editor[open]").count(), 0, "Card customization remains optional and collapsed.");
    await assertLayout(page, `${width}px result review`);
    await page.locator("[data-action='save-external-analysis']").click();
    await page.waitForFunction(() => window.__equityResearchStore.state.activePanel === "external-report");
    const persisted = await page.evaluate(() => window.__equityResearchStore.state.externalAnalyses.INTC[0].metadata.franklinV3Report);
    assert.deepEqual(persisted, canonical, "Presentation changes must preserve every financial field and source.");
    await page.locator("[data-investment-data-tab='financials']").click();
    await capture(page, width, "report");
    await assertLayout(page, `${width}px financial report`);
    await page.locator(".external-report-actions [data-panel='home']").click();
    await page.locator("[data-library-card][data-external-ticker='INTC']").waitFor();
    await capture(page, width, "library");
    await assertLayout(page, `${width}px populated library`);
    await page.locator(".mobile-nav [data-panel='settings']").click();
    await page.locator("[data-action='open-franklin-account']").waitFor();
    await capture(page, width, "settings");
    await assertLayout(page, `${width}px settings`);
    assert.deepEqual(errors, [], `No uncaught errors during the ${width}px journey`);
    await context.close();
  }
  console.log(`Analysis journey, paste preservation, safe review and responsive layout [${browserName}]: PASS`);
} finally { await browser.close(); }

async function assertLayout(page, label) {
  assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), 0, `${label} has horizontal overflow`);
  const invalid = await page.locator("button:visible").evaluateAll((nodes) => nodes.filter((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.width < 24; }).map((node) => node.textContent.trim().slice(0, 40)));
  assert.deepEqual(invalid, [], `${label} contains unusably narrow buttons`);
}

async function capture(page, width, screen) {
  const directory = process.env.FRANKLIN_UX_ARTIFACT_DIR;
  if (!directory) return;
  await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))));
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${browserName}-${width}-${screen}.png`), fullPage: true });
}
