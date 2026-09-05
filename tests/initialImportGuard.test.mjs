import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInitialAnalysisPrompt } from "../src/externalAnalysis/initialAnalysisPolicyV2.js";
import {
  assertDispatchedPayloadValid,
  dispatchJsonPayload,
  JSON_IMPORT_ROUTES
} from "../src/externalAnalysis/jsonContractRouter.js";

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const prompt = buildInitialAnalysisPrompt({ tickerHint: "NVDA" });
const { canonical } = await importOwnerAcceptanceFixture();

assert.match(components, /اكتب رمز السهم أولًا/);
assert.match(components, /inputmode="latin-prose"/);
assert.match(prompt, /marketPrice إلزامي بالكامل/);
assert.match(prompt, /MARKET PRICE GATE/);
assert.match(prompt, /إذا لم يتوفر سعر LIVE موثق، استخدم أحدث LAST_CLOSE/);
assert.match(prompt, /usedFor يحتوي القيمة الحرفية marketPrice/);
assert.match(prompt, /"ticker": "NVDA"/);

const badMarketSource = structuredClone(canonical);
const marketSource = badMarketSource.sources.find((source) => source.id === badMarketSource.marketPrice.sourceId);
marketSource.usedFor = ["valuation"];
const dispatched = dispatchJsonPayload(badMarketSource, {
  intendedRoute: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
  context: { expectedTicker: "INTC", expectedReportPeriod: "Q2 2026" }
});
assert.equal(dispatched.validation.valid, false);
assert.match(
  dispatched.validation.errors.map((error) => `${error.field}: ${error.message}`).join("\n"),
  /marketPrice\.sourceId: Market-price source must include marketPrice in usedFor/
);
assert.throws(() => assertDispatchedPayloadValid(dispatched, badMarketSource), /فشل التحقق من JSON عند المسار \$\.marketPrice\.sourceId/);

console.log("Initial analysis import guard: PASS");

async function importOwnerAcceptanceFixture() {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await import("./intcOwnerAcceptance.test.mjs");
  } finally {
    console.log = originalLog;
  }
}
