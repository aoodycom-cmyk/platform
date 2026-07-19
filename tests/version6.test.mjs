import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const moduleCache = new Map();

async function loadModule(filePath) {
  const absolutePath = path.resolve(filePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);
  const source = await readFile(absolutePath, "utf8");
  const module = new vm.SourceTextModule(source, {
    identifier: absolutePath,
    initializeImportMeta(meta) {
      meta.url = pathToFileURL(absolutePath).href;
    }
  });
  moduleCache.set(absolutePath, module);
  await module.link((specifier, referencingModule) => {
    const resolved = path.resolve(path.dirname(referencingModule.identifier), specifier);
    return loadModule(resolved);
  });
  await module.evaluate();
  return module;
}

const ranking = (await loadModule(`${root}/public/src/engines/rankingEngine.js`)).namespace;
const colors = (await loadModule(`${root}/public/src/domain/marketColorSystem.js`)).namespace;
const language = (await loadModule(`${root}/public/src/i18n/language.js`)).namespace;
const evaluated = (await loadModule(`${root}/public/src/domain/evaluatedCompanies.js`)).namespace;

const fullCompany = {
  ticker: "AAA",
  recommendation: "BUY",
  decisionStatus: "ACTIONABLE",
  investmentScore: 82,
  upside: 0.22,
  maxFairValueUpside: 0.36,
  qualityScore: 90,
  growthScore: 78,
  managementScore: 72,
  moatScore: 80,
  riskScore: 84,
  dataQuality: 95,
  confidence: 91
};

assert.deepEqual(
  ranking.scoreEvaluatedCompany(fullCompany),
  ranking.scoreEvaluatedCompany(fullCompany),
  "ranking must be deterministic"
);

const missingCompany = {
  ticker: "MISS",
  recommendation: "HOLD",
  decisionStatus: "INSUFFICIENT_DATA",
  investmentScore: 62,
  qualityScore: 65,
  dataQuality: 38,
  confidence: 42
};
const missingScore = ranking.scoreEvaluatedCompany(missingCompany);
assert.equal(missingScore.rankingComponents.upsideComposite, null, "missing upside must stay missing");
assert.ok(
  missingScore.rankingConfidence < ranking.scoreEvaluatedCompany(fullCompany).rankingConfidence,
  "missing data lowers ranking confidence"
);

const ranked = ranking.rankEvaluatedCompanies([
  { ...fullCompany, ticker: "ACT", investmentScore: 58, rankingScore: undefined },
  { ...fullCompany, ticker: "LIM", decisionStatus: "INSUFFICIENT_DATA", investmentScore: 95, qualityScore: 95 }
]);
assert.equal(ranked[0].ticker, "ACT", "actionable companies rank before insufficient data");
assert.equal(ranked[0].rankingPosition, 1, "rank position is recalculated from the visible set");

assert.equal(ranking.normalizeUpside(1.75), 100, "extreme upside is capped");
assert.equal(colors.upsideColorCategory(0.25), "strong-positive");
assert.equal(colors.upsideColorCategory(0.1), "positive");
assert.equal(colors.upsideColorCategory(0.0999), "neutral");
assert.equal(colors.upsideColorCategory(-0.0001), "warning");
assert.equal(colors.upsideColorCategory(-0.15), "negative");
assert.equal(colors.fairValueColorCategory(102, 100), "neutral");
assert.equal(colors.fairValueColorCategory(102.1, 100), "positive");
assert.equal(colors.fairValueColorCategory(97.9, 100), "negative");

assert.equal(colors.recommendationColorCategory("BUY", "ACTIONABLE"), "positive");
assert.equal(colors.recommendationColorCategory("HOLD", "ACTIONABLE"), "warning");
assert.equal(colors.recommendationColorCategory("SELL", "ACTIONABLE"), "negative");
assert.equal(colors.recommendationColorCategory("BUY", "INSUFFICIENT_DATA"), "missing");

assert.equal(colors.riskColorCategory(80), "positive", "higher Risk Score means lower risk");
assert.equal(colors.riskColorCategory(60), "warning");
assert.equal(colors.riskColorCategory(30), "negative");
assert.equal(colors.scoreColorCategory(85), "strong-positive");
assert.equal(colors.scoreColorCategory(70), "positive");
assert.equal(colors.scoreColorCategory(55), "warning");
assert.equal(colors.scoreColorCategory(40), "warning");
assert.equal(colors.scoreColorCategory(39), "negative");

assert.equal(colors.formatSignedPercent(0.2376), "+24%");
assert.equal(colors.formatSignedPercent(-0.18), "-18%");

language.setLanguageContext("ar");
assert.equal(language.uiLabel("Rank"), "الترتيب");
assert.equal(language.uiLabel("Recommendation"), "التوصية");
assert.ok(language.financialTerm("ROIC").startsWith("ROIC"), "financial terms keep the English standard");
language.setLanguageContext("en");
assert.equal(language.uiLabel("Rank"), "Rank");
assert.equal(language.financialTerm("ROIC"), "ROIC");

const updated = evaluated.upsertEvaluatedCompany(
  [{ ticker: "AAA", currentPrice: 10 }],
  { ticker: "AAA", currentPrice: 12 }
);
assert.equal(updated.length, 1, "evaluated companies must not duplicate tickers");
assert.equal(updated[0].currentPrice, 12, "latest evaluation replaces the current row");

console.log("Version 6 ranking and color tests passed.");
