import { chromium } from "playwright";

const baseUrl = "https://aoodycom-cmyk.github.io/platform/";
const state = process.env.CAPTURE_STATE;
const captureId = process.env.CAPTURE_ID;
if (!state || !captureId) throw new Error("CAPTURE_STATE and CAPTURE_ID are required");

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

async function seedDemo() {
  await page.locator('[data-panel="settings"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-action="load-external-demo"]').click();
  await page.waitForSelector('.panel-external-report, [data-action="open-quarterly-scorecard"]', { timeout: 10000 });
  await page.waitForTimeout(700);
}

async function injectAndCapture() {
  const response = await context.request.get("https://mcp.figma.com/mcp/html-to-design/capture.js");
  if (!response.ok()) throw new Error(`Unable to load Figma capture script: ${response.status()}`);
  const source = await response.text();
  await page.evaluate((scriptSource) => {
    const script = document.createElement("script");
    script.textContent = scriptSource;
    document.head.appendChild(script);
  }, source);
  await page.waitForFunction(() => Boolean(window.figma?.captureForDesign), null, { timeout: 10000 });
  const result = await page.evaluate(async ({ captureId }) => {
    return await window.figma.captureForDesign({
      captureId,
      endpoint: `https://mcp.figma.com/mcp/capture/${captureId}/submit?bindVariables=true`,
      selector: "body"
    });
  }, { captureId });
  console.log(`Captured ${state}:`, result);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });

  if (state === "settings") {
    await page.locator('[data-panel="settings"]').first().click();
    await page.waitForTimeout(700);
  } else {
    await seedDemo();
    if (state === "quarterly") {
      const entry = page.locator('[data-action="open-quarterly-scorecard"]');
      if (!(await entry.count())) throw new Error("Quarterly Scorecard entry was not found");
      await entry.last().scrollIntoViewIfNeeded();
      await entry.last().click();
      await page.waitForSelector('.quarterly-scorecard-shell, .quarterly-scorecard-empty', { timeout: 10000 });
      await page.waitForTimeout(700);
    } else if (state === "populated") {
      const home = page.locator('[data-panel="home"]');
      if (!(await home.count())) throw new Error("Home tab was not found");
      await home.first().click();
      await page.waitForSelector('[data-library-card], .external-library-empty', { timeout: 10000 });
      await page.waitForTimeout(700);
    } else if (state !== "report") {
      throw new Error(`Unknown CAPTURE_STATE: ${state}`);
    }
  }

  await injectAndCapture();
} finally {
  await browser.close();
}
