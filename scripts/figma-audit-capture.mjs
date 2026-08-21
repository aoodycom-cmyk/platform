import { chromium } from "playwright";

const baseUrl = "https://aoodycom-cmyk.github.io/platform/";
const captures = {
  empty: "a77e6740-7f51-4999-87a8-2d89a2027bf1",
  report: "6897413c-ab2d-4946-8426-e04bf637b400",
  quarterly: "46dc8234-bc54-48f4-bf41-5f903be837d4",
  populated: "a60f442a-ed9d-48ef-a6ca-e5e1e1d50122",
  settings: "9bb455c2-3ad9-4ec9-a7ab-0c9d24dc5473"
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "ar-SA",
  colorScheme: "dark"
});
const page = await context.newPage();

await page.route("**/*", async (route) => {
  const response = await route.fetch();
  const headers = { ...response.headers() };
  delete headers["content-security-policy"];
  delete headers["content-security-policy-report-only"];
  await route.fulfill({ response, headers });
});

const captureScriptResponse = await context.request.get("https://mcp.figma.com/mcp/html-to-design/capture.js");
if (!captureScriptResponse.ok()) throw new Error(`Unable to load Figma capture script: ${captureScriptResponse.status()}`);
const captureScript = await captureScriptResponse.text();

async function ensureCaptureScript() {
  const exists = await page.evaluate(() => Boolean(window.figma?.captureForDesign)).catch(() => false);
  if (!exists) {
    await page.evaluate((source) => {
      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    }, captureScript);
    await page.waitForFunction(() => Boolean(window.figma?.captureForDesign), null, { timeout: 10000 });
  }
}

async function capture(id, label) {
  await page.waitForTimeout(900);
  await ensureCaptureScript();
  const result = await page.evaluate(async ({ id }) => {
    return await window.figma.captureForDesign({
      captureId: id,
      endpoint: `https://mcp.figma.com/mcp/capture/${id}/submit?bindVariables=true`,
      selector: "body"
    });
  }, { id });
  console.log(`Captured ${label}:`, result);
  await page.waitForTimeout(900);
}

async function goHome() {
  const home = page.locator('[data-panel="home"]');
  if (await home.count()) {
    await home.first().click();
    await page.waitForTimeout(700);
  }
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await capture(captures.empty, "empty library");

  // Seed realistic application state through Franklin's own DEMO workflow.
  await page.locator('[data-panel="settings"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-action="load-external-demo"]').click();
  await page.waitForSelector('.panel-external-report, [data-action="open-quarterly-scorecard"]', { timeout: 10000 });
  await capture(captures.report, "stock detail / report");

  const scorecardEntry = page.locator('[data-action="open-quarterly-scorecard"]');
  if (!(await scorecardEntry.count())) throw new Error("Quarterly Scorecard entry was not found");
  await scorecardEntry.last().scrollIntoViewIfNeeded();
  await scorecardEntry.last().click();
  await page.waitForSelector('.quarterly-scorecard-shell, .quarterly-scorecard-empty', { timeout: 10000 });
  await capture(captures.quarterly, "quarterly thesis scorecard");

  const closeScorecard = page.locator('[data-action="close-quarterly-scorecard"]');
  if (await closeScorecard.count()) {
    await closeScorecard.first().click();
    await page.waitForTimeout(500);
  }
  await goHome();
  await page.waitForSelector('[data-library-card], .external-library-empty', { timeout: 10000 });
  await capture(captures.populated, "populated library");

  const settings = page.locator('[data-panel="settings"]');
  if (!(await settings.count())) throw new Error("Settings tab was not found");
  await settings.first().click();
  await page.waitForTimeout(700);
  await capture(captures.settings, "settings / navigation");
} finally {
  await browser.close();
}
