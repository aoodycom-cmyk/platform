import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.FRANKLIN_AUDIT_URL || "http://127.0.0.1:4321/";
const outputDir = "audit-screens";
await mkdir(outputDir, { recursive: true });

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

async function settle() {
  await page.waitForTimeout(700);
}
async function shot(name) {
  await settle();
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });

  // Current empty/onboarding state.
  await shot("01-empty-library");

  // Seed the app through its own DEMO workflow so screenshots use real UI/state logic.
  await page.locator('[data-panel="settings"]').first().click();
  await settle();
  await page.locator('[data-action="load-external-demo"]').click();
  await page.waitForSelector('.panel-external-report, [data-action="open-quarterly-scorecard"]', { timeout: 10000 });

  // Main Stock Detail / Decision implementation.
  await shot("02-stock-detail-report");

  // Quarterly requirements / thesis execution screen.
  const scorecardEntry = page.locator('[data-action="open-quarterly-scorecard"]');
  if (await scorecardEntry.count()) {
    await scorecardEntry.last().scrollIntoViewIfNeeded();
    await scorecardEntry.last().click();
    await page.waitForSelector('.quarterly-scorecard-shell, .quarterly-scorecard-empty', { timeout: 10000 });
    await shot("03-quarterly-thesis-scorecard");
  }

  // Return to the report, then to the populated library.
  const closeScorecard = page.locator('[data-action="close-quarterly-scorecard"]');
  if (await closeScorecard.count()) {
    await closeScorecard.first().click();
    await settle();
  }
  const backHome = page.locator('[data-panel="home"]');
  if (await backHome.count()) {
    await backHome.first().click();
    await page.waitForSelector('[data-library-card], .external-library-empty', { timeout: 10000 });
    await shot("04-populated-library");
  }

  // Capture the settings/navigation surface as an additional implementation reference.
  const settings = page.locator('[data-panel="settings"]');
  if (await settings.count()) {
    await settings.first().click();
    await shot("05-settings-navigation");
  }
} finally {
  await browser.close();
}
