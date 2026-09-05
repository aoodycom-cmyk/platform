import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.FRANKLIN_E2E_URL || "http://127.0.0.1:4321/";
const playwright = await loadPlaywright();
const canonical = await loadCanonicalFixture();
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.FRANKLIN_BROWSER_EXECUTABLE ? { executablePath: process.env.FRANKLIN_BROWSER_EXECUTABLE } : {})
});
const pageErrors = [];
const resourceErrors = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ar-SA",
    colorScheme: "dark",
    acceptDownloads: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (url.origin === new URL(BASE_URL).origin && /\.(?:js|css|png|svg|webmanifest)(?:\?|$)/i.test(url.href)) {
      resourceErrors.push(`${response.status()} ${url.href}`);
    }
  });

  await page.goto(new URL("?e2e=json-architecture", BASE_URL).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY && window.__equityResearchStore));

  const openImport = page.locator("[data-action='open-external-import']:visible").first();
  await openImport.click();
  await page.locator("[data-external-import-mode='paste']").click();
  await page.locator("[data-external-raw]").fill(JSON.stringify(canonical));
  await page.locator("[data-action='parse-external-analysis']").click();
  await waitForState(page, (state) => state.externalImport?.stage === "preview" && !state.loading);

  const preview = await page.evaluate(() => {
    const state = window.__equityResearchStore.state;
    const report = state.externalImport.draftReport;
    return {
      valid: state.externalImport.validation.valid,
      ticker: report.company.ticker,
      companyName: report.company.name,
      analysisDate: report.analysisDate,
      currentPrice: report.fairValueSummary.currentPrice,
      bear: report.fairValueSummary.fairValueLow,
      base: report.fairValueSummary.fairValueBase,
      bull: report.fairValueSummary.fairValueHigh,
      decision: report.decision.action,
      thesis: report.thesis.updatedSummary,
      nativeSchema: report.metadata.franklinV3Report.schemaVersion
    };
  });
  assert.deepEqual(preview, {
    valid: true,
    ticker: canonical.reportIdentity.ticker,
    companyName: canonical.reportIdentity.companyName,
    analysisDate: canonical.reportIdentity.analysisDate,
    currentPrice: canonical.marketPrice.value,
    bear: canonical.valuation.current.bear,
    base: canonical.valuation.current.base,
    bull: canonical.valuation.current.bull,
    decision: canonical.decision.action,
    thesis: canonical.thesis.updatedSummary,
    nativeSchema: canonical.schemaVersion
  });

  await page.locator("[data-action='save-external-analysis']").click();
  await waitForState(page, (state) => state.activePanel === "external-report" && state.externalAnalyses?.INTC?.length === 1);
  await page.locator(".franklin-shared-stock-header").waitFor({ state: "visible" });
  assert.match(await page.locator(".franklin-shared-stock-header").innerText(), /Intel Corporation/);
  const reportText = await page.locator(".mobile-page-content").innerText();
  assert.match(reportText, /\$90/);
  assert.match(reportText, /WATCH|مراقبة/u);
  assert.ok(reportText.includes(canonical.thesis.updatedSummary.slice(0, 80)));
  await assertNoHorizontalOverflow(page, "summary");

  const beforeHistory = await stateSummary(page);
  assert.equal(beforeHistory.reportCount, 1);
  assert.equal(beforeHistory.quarters.length, 2);
  assert.deepEqual(beforeHistory.quarters.map((item) => item.status), ["REPORTED", "UPCOMING"]);
  assert.equal(beforeHistory.quarters[1].actualsPresent, false);
  assert.ok(beforeHistory.quarters[1].requirements.every((item) => item.status === "NOT_REPORTED"));

  await page.locator("[data-stock-page='earnings']").click();
  await waitForState(page, (state) => state.activePanel === "quarterly-scorecard");
  const timeline = page.locator("[data-quarterly-earnings-history]");
  await timeline.waitFor({ state: "visible" });
  await page.locator("[data-quarter-history-key='INTC:2026:Q2']").click();
  await page.locator("[data-quarter-status='REPORTED']").waitFor({ state: "visible" });
  const reportedRows = await page.locator(".quarterly-results-table tbody tr").count();
  assert.ok(reportedRows >= 2);
  assert.ok((await page.locator(".quarterly-results-table").innerText()).includes("BEAT"));

  await page.locator("[data-quarter-history-key='INTC:2026:Q3']").click();
  const upcoming = page.locator("[data-quarter-status='UPCOMING']");
  await upcoming.waitFor({ state: "visible" });
  assert.equal(await upcoming.locator(".quarterly-results-table").count(), 0);
  assert.equal(await upcoming.locator("[data-upcoming-requirement]").count(), canonical.nextRequirements.requirements.length);
  assert.ok((await upcoming.innerText()).includes("NOT_REPORTED"));
  await assertNoHorizontalOverflow(page, "earnings");

  await page.locator("[data-stock-page='summary']").click();
  await waitForState(page, (state) => state.activePanel === "external-report");
  const completionButton = page.locator("[data-action='start-report-supplement']").first();
  const completionDiagnostic = await page.evaluate(() => {
    const report = window.__equityResearchStore.state.externalAnalyses?.INTC?.[0];
    return report?.completionStatus || null;
  });
  assert.equal(await completionButton.count(), 1, `Missing supplement action: ${JSON.stringify(completionDiagnostic)}`);
  await completionButton.click();
  await page.locator("[data-supplement-raw]").waitFor({ state: "visible" });
  const targetAnalysisId = await page.evaluate(() => window.__equityResearchStore.state.externalImport.draftReport.id);
  const supplement = {
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "INTC",
    targetAnalysisId,
    analysisDate: canonical.reportIdentity.analysisDate,
    fields: { "scores.risk": 0 },
    notes: ["E2E persistence contract check"]
  };
  await page.locator("[data-supplement-raw]").fill(JSON.stringify(supplement));
  await page.locator("[data-action='parse-external-supplement']").click();
  await waitForState(page, (state) => state.externalImport?.supplement?.stage === "preview" && !state.loading);
  const supplementPreview = await page.evaluate(() => {
    const supplementState = window.__equityResearchStore.state.externalImport.supplement;
    return {
      valid: supplementState.validation.valid,
      applied: supplementState.mergePreview.appliedFields.map((item) => item.path),
      conflicts: supplementState.mergePreview.conflicts.length
    };
  });
  assert.deepEqual(supplementPreview, { valid: true, applied: ["scores.risk"], conflicts: 0 });
  await page.locator("[data-action='apply-external-supplement']").click();
  await waitForState(page, (state) => state.externalAnalyses?.INTC?.[0]?.scores?.risk === 0);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__FRANKLIN_APP_READY && window.__equityResearchStore));
  const afterReload = await stateSummary(page);
  assert.equal(afterReload.riskScore, 0);
  assert.equal(afterReload.reportCount, beforeHistory.reportCount);
  assert.deepEqual(afterReload.quarters, beforeHistory.quarters);

  await page.evaluate(() => {
    const store = window.__equityResearchStore;
    const report = store.state.externalAnalyses.INTC[0];
    store.openExternalReport("INTC", report.id);
  });
  await page.locator("details.report-actions-menu > summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-action='export-external-json']").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  assert.ok(downloadPath);
  const exportText = await readFile(downloadPath, "utf8");
  const exported = JSON.parse(exportText);
  assert.equal(exported.schemaVersion, "external-analysis-report/v2");
  assert.equal(exported.scores.risk, 0);
  assert.deepEqual(exported.metadata.franklinV3Report, canonical);
  assert.equal(exported.supplements.length, 1);

  await page.evaluate(() => window.__equityResearchStore.openExternalImport());
  await page.locator("[data-external-import-mode='file']").click();
  await page.locator("[data-external-json-file]").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: Buffer.from(exportText)
  });
  await waitForState(page, (state) => state.externalImport?.file?.status === "valid" && !state.loading);
  await page.locator("[data-action='parse-external-json-file']").click();
  await waitForState(page, (state) => state.externalImport?.stage === "preview" && !state.loading);
  const reimport = await page.evaluate(() => {
    const state = window.__equityResearchStore.state;
    return {
      duplicateId: state.externalImport.duplicate?.id || null,
      reportId: state.externalImport.draftReport?.id || null,
      riskScore: state.externalImport.draftReport?.scores?.risk,
      sourceCount: state.externalImport.draftReport?.sources?.length,
      nativeReport: state.externalImport.draftReport?.metadata?.franklinV3Report
    };
  });
  assert.equal(reimport.duplicateId, targetAnalysisId);
  assert.equal(reimport.reportId, targetAnalysisId);
  assert.equal(reimport.riskScore, 0);
  assert.equal(reimport.sourceCount, canonical.sources.length);
  assert.deepEqual(reimport.nativeReport, canonical);
  await page.locator("[data-action='save-external-analysis']").click();
  await page.waitForTimeout(100);
  const finalState = await stateSummary(page);
  assert.equal(finalState.reportCount, 1);
  assert.deepEqual(finalState.quarters, beforeHistory.quarters);
  assert.equal(finalState.requirementSetCount, beforeHistory.requirementSetCount);
  assert.equal(finalState.sourceCount, beforeHistory.sourceCount);

  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(resourceErrors, []);
  console.log(`Franklin JSON architecture E2E: PASS (${canonical.reportIdentity.ticker}, ${exportText.length} bytes)`);
} finally {
  await browser.close();
}

async function loadPlaywright() {
  const modulePath = process.env.FRANKLIN_PLAYWRIGHT_MODULE;
  try {
    return await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
  } catch (error) {
    throw new Error(`Playwright is required for JSON E2E. Install it or set FRANKLIN_PLAYWRIGHT_MODULE. ${error.message}`);
  }
}

async function loadCanonicalFixture() {
  const log = console.log;
  try {
    console.log = () => {};
    return (await import("./intcOwnerAcceptance.test.mjs")).canonical;
  } finally {
    console.log = log;
  }
}

async function waitForState(page, predicate) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__equityResearchStore?.state || null);
    if (state && predicate(state)) return;
    await page.waitForTimeout(50);
  }
  throw new Error("Timed out waiting for Franklin state transition.");
}

async function stateSummary(page) {
  return page.evaluate(() => {
    const state = window.__equityResearchStore.state;
    const reports = state.externalAnalyses?.INTC || [];
    const report = reports[0] || {};
    const quarters = (state.quarterlyEarningsHistory?.INTC || []).map((record) => ({
      quarterKey: record.quarterKey,
      status: record.status,
      actualsPresent: Boolean(record.latestQuarter),
      requirements: (record.requirements || []).map((item) => ({ id: item.id, status: item.status }))
    }));
    return {
      reportCount: reports.length,
      quarters,
      requirementSetCount: (state.historicalRequirementSets?.INTC || []).length,
      sourceCount: (report.sources || []).length,
      riskScore: report.scores?.risk
    };
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  assert.equal(overflow, 0, `${label} has ${overflow}px horizontal overflow`);
}
