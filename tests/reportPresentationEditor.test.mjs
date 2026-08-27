import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { externalAnalysisToHomeCard } from "../src/externalAnalysis/reportAdapter.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { withCurrentPrice, withPresentation } from "../src/ui/reportPresentationEditor.js";

const source = {
  id: "report-1",
  company: { ticker: "ACME", name: "Acme" },
  fairValueSummary: { currentPrice: 100, fairValueBase: 150 },
  metadata: {
    franklinV3Report: {
      marketPrice: { value: 100 },
      valuation: { upsideToBasePct: 50, marginOfSafetyPct: 33.33 }
    }
  }
};

const repriced = withCurrentPrice(source, 120);
assert.equal(repriced.fairValueSummary.currentPrice, 120);
assert.equal(repriced.fairValueSummary.upsideDownsidePercent, 25);
assert.equal(repriced.fairValueSummary.marginOfSafetyPercent, 20);
assert.equal(repriced.metadata.franklinV3Report.marketPrice.value, 120);
assert.equal(repriced.metadata.franklinV3Report.valuation.upsideToBasePct, 25);
assert.equal(repriced.metadata.franklinV3Report.valuation.marginOfSafetyPct, 20);
assert.equal(source.fairValueSummary.currentPrice, 100, "manual editing must not mutate the saved source object");

const logo = "data:image/png;base64,aGVsbG8=";
const presented = withPresentation(repriced, { companyLogoDataUrl: logo, morningstarFairValue: 142 });
const normalized = normalizeExternalAnalysisReport(presented, "", { now: new Date("2026-08-25T00:00:00Z") });
assert.equal(normalized.presentation.companyLogoDataUrl, logo);
assert.equal(normalized.presentation.morningstarFairValue, 142);

const card = externalAnalysisToHomeCard(normalized);
assert.equal(card.companyLogoDataUrl, logo);
assert.equal(card.morningstarFairValue, 142);
assert.equal(card.currentPrice, 120);

const cleared = withPresentation(presented, { companyLogoDataUrl: null, morningstarFairValue: null });
assert.equal("companyLogoDataUrl" in cleared.presentation, false);
assert.equal("morningstarFairValue" in cleared.presentation, false);

const editorSource = await readFile(new URL("../src/ui/reportPresentationEditor.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(editorSource, /activePanel === "external-import"/);
assert.match(editorSource, /بيانات بطاقة الشركة/);
assert.match(editorSource, /insertAdjacentElement\("afterend", section\)/);
assert.match(editorSource, /reportNeedsOwnerPresentation/);
assert.match(mainSource, /reportPresentationEditor\.js\?v=v39-visible-owner-presentation/);
assert.match(indexSource, /main\.js\?v=v40-franklin-mobile-v2/);
assert.match(indexSource, /styles-visual-system\.css\?v=v39-visible-owner-presentation/);

console.log("report presentation editor tests passed");
