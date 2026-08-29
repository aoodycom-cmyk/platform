import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SOCIAL_EXPORT_HEIGHT,
  SOCIAL_EXPORT_WIDTH,
  buildEarningsTrackerModel,
  buildInvestmentInfographicModel
} from "../src/ui/socialImageExport.js";

const report = {
  analysisDate: "2026-08-24",
  reportPeriod: "Q2 2026",
  company: {
    ticker: "INTC",
    name: "Intel Corporation",
    sector: "Technology",
    industry: "Semiconductors",
    currency: "USD"
  },
  fairValueSummary: {
    fairValueLow: 55,
    fairValueBase: 85,
    fairValueHigh: 135,
    probabilityWeightedFairValue: 90,
    currentPrice: 90.07,
    upsideDownsidePercent: -5.63,
    marginOfSafetyPercent: -5.96
  },
  decision: { action: "WATCH", confidence: 76, investmentScore: 64 },
  metadata: {
    franklinV3Report: {
      schemaVersion: "franklin-fair-value/v3",
      methodologyVersion: "fair-value-methodology/v2",
      analysisType: "INITIAL",
      reportIdentity: {
        ticker: "INTC",
        companyName: "Intel Corporation",
        fiscalQuarter: "Q2",
        fiscalYear: 2026,
        analysisDate: "2026-08-24"
      },
      company: {
        sector: "Technology",
        industry: "Semiconductors",
        reportingCurrency: "USD",
        tradingCurrency: "USD",
        securityUnit: "share"
      },
      companyProfile: {
        summary: "Intel تصمم المعالجات وتبني Intel Foundry لتصنيع الشرائح.",
        businessModel: "تجمع بين منتجات أشباه الموصلات وخدمات foundry كثيفة رأس المال."
      },
      dataQuality: { score: 92, confidence: "HIGH" },
      strengths: [
        { title: "نمو DCAI", explanation: "طلب قوي على الخوادم." },
        { title: "تحسن الهوامش", explanation: "تعافي تشغيلي." }
      ],
      risks: [
        { title: "خسائر Foundry", explanation: "ما تزال مرتفعة." },
        { title: "ضغط FCF", explanation: "Capex مرتفع." }
      ],
      catalysts: [{ title: "خفض خسائر Foundry", explanation: "تحسن اقتصاديات المصانع." }],
      latestQuarter: {
        summary: "Q2 أظهر نموًا قويًا وتحسنًا في الهوامش.",
        coreMetrics: {
          revenue: { actualValue: 16128000000, unit: "USD", consensusValue: 14420000000, yoyPct: 25.4 },
          eps: { actualValue: 0.42, unit: "USD/share", consensusValue: 0.21 },
          grossMarginPct: { actualValue: 40.4, unit: "%" },
          operatingMarginPct: { actualValue: 11.1, unit: "%" },
          freeCashFlow: { actualValue: -8419000000, unit: "USD" }
        },
        companySpecificKpis: [
          { name: "DCAI Revenue", arabicName: "إيرادات DCAI", actualValue: 6262000000, actualDisplay: "$6.262B", yoyPct: 59, importance: "critical" }
        ],
        guidance: [
          { period: "Q3 2026", topic: "Revenue", currentGuidance: "$15.8B-$16.8B", direction: "new" },
          { period: "Q3 2026", topic: "Non-GAAP EPS", currentGuidance: "$0.38", direction: "new" },
          { period: "Q3 2026", topic: "GAAP Gross Margin", currentGuidance: "41.0%", direction: "new" }
        ]
      },
      valuation: {
        current: { bear: 55, base: 85, bull: 135, probabilityWeighted: 90, currency: "USD", securityUnit: "share", confidence: "MEDIUM" },
        upsideToBasePct: -5.63,
        marginOfSafetyPct: -5.96
      },
      thesis: {
        updatedSummary: "Intel في تحول تشغيلي حقيقي لكن نجاح Foundry والتدفق النقدي ما زالا عامل الحسم."
      },
      decision: { scope: "STOCK_LEVEL", action: "WATCH", confidence: 76, investmentScore: 64 },
      marketPrice: { value: 90.07, currency: "USD", asOf: "2026-08-21", priceType: "LAST_CLOSE" },
      nextRequirements: {
        requirementSetId: null,
        mode: "DEFEND_BASE",
        previousQuarter: "Q2 2026",
        targetQuarter: "Q3 2026",
        currentJustifiedValue: 85,
        targetValue: 85,
        targetScenario: "BASE_DEFENSE",
        requirements: [
          { id: "q3_revenue", name: "Q3 Revenue", arabicName: "إيرادات Q3", metric: "Revenue", type: "minimum", baselineValue: 16128000000, baselineDisplay: "$16.128B", requiredValue: 15800000000, requiredDisplay: ">= $15.8B", unit: "USD", importance: "critical", weight: 35, status: "NOT_REPORTED" },
          { id: "q3_eps", name: "Q3 Non-GAAP EPS", arabicName: "ربحية Q3 المعدلة", metric: "Non-GAAP EPS", type: "minimum", baselineValue: 0.42, baselineDisplay: "$0.42", requiredValue: 0.38, requiredDisplay: ">= $0.38", unit: "USD/share", importance: "high", weight: 25, status: "NOT_REPORTED" },
          { id: "q3_margin", name: "Q3 GAAP Gross Margin", arabicName: "هامش Q3 الإجمالي", metric: "GAAP Gross Margin", type: "minimum", baselineValue: 40.4, baselineDisplay: "40.4%", requiredValue: 41, requiredDisplay: ">= 41.0%", unit: "%", importance: "high", weight: 40, status: "NOT_REPORTED" }
        ]
      },
      previousRequirementsEvaluation: null,
      monitoringChecklist: []
    }
  }
};

assert.equal(SOCIAL_EXPORT_WIDTH, 1080);
assert.equal(SOCIAL_EXPORT_HEIGHT, 1350);

const infographic = buildInvestmentInfographicModel(report);
assert.equal(infographic.ticker, "INTC");
assert.equal(infographic.companyName, "Intel Corporation");
assert.equal(infographic.decision, "WATCH");
assert.equal(infographic.base, 85);
assert.equal(infographic.marketPrice, 90.07);
assert.equal(infographic.latestMetrics.some((item) => item.label === "Revenue"), true);
assert.equal(infographic.latestMetrics.some((item) => item.label === "إيرادات DCAI"), true);
assert.equal(infographic.strengths[0].title, "نمو DCAI");
assert.equal(infographic.risks[0].title, "خسائر Foundry");
assert.match(infographic.thesis, /Foundry/);

const tracker = buildEarningsTrackerModel(report);
assert.equal(tracker.ticker, "INTC");
assert.equal(tracker.targetQuarter, "Q3 2026");
assert.equal(tracker.mode, "DEFEND_BASE");
assert.equal(tracker.isEvaluated, false);
assert.equal(tracker.rows.length, 3);
assert.equal(tracker.rows[0].previous, "$16.128B");
assert.equal(tracker.rows[0].expected, "$15.8B-$16.8B");
assert.equal(tracker.rows[0].target, ">= $15.8B");
assert.equal(tracker.rows[0].actual, "بانتظار الإعلان");
assert.equal(tracker.rows[0].statusLabel, "بانتظار الإعلان");
assert.equal(tracker.rows[1].expected, "$0.38");
assert.equal(tracker.rows[2].expected, "41.0%");

const evaluatedReport = structuredClone(report);
evaluatedReport.reportPeriod = "Q3 2026";
evaluatedReport.metadata.franklinV3Report.reportIdentity.fiscalQuarter = "Q3";
evaluatedReport.metadata.franklinV3Report.latestQuarter.coreMetrics.revenue = {
  actualValue: 17000000000,
  unit: "USD",
  consensusValue: 16300000000,
  yoyPct: 20
};
evaluatedReport.metadata.franklinV3Report.previousRequirementsEvaluation = {
  targetQuarter: "Q3 2026",
  requirements: [
    { id: "q3_revenue", name: "Q3 Revenue", arabicName: "إيرادات Q3", metric: "Revenue", type: "minimum", baselineValue: 16128000000, baselineDisplay: "$16.128B", requiredValue: 15800000000, requiredDisplay: ">= $15.8B", actualValue: 17000000000, actualDisplay: "$17.0B", unit: "USD", status: "EXCEEDED" }
  ]
};

const evaluatedTracker = buildEarningsTrackerModel(evaluatedReport);
assert.equal(evaluatedTracker.isEvaluated, true);
assert.equal(evaluatedTracker.rows.length, 1);
assert.equal(evaluatedTracker.rows[0].expected, "$16.3B");
assert.equal(evaluatedTracker.rows[0].actual, "$17.0B");
assert.equal(evaluatedTracker.rows[0].statusLabel, "تجاوز");

const exportSources = ["../src/ui/socialImageExport.js", "../public/src/ui/socialImageExport.js", "../docs/src/ui/socialImageExport.js"]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
assert.equal(new Set(exportSources).size, 1, "all deployed export renderers must stay identical");
assert.match(exportSources[0], /soft:\s*"#[0-9a-f]{6}"/i, "premium body copy must always use a defined color token");
assert.match(exportSources[0], /quarterMetrics\(ctx, 82, 654, m\.latestMetrics\)/, "investment export must show the latest operating evidence");
assert.match(exportSources[0], /`المتوقع \$\{row\.expected \|\| "—"\}`/, "earnings export must distinguish consensus from Franklin's target");
assert.doesNotMatch(exportSources[0], /researchSection\(ctx, 54, 1024, 972, 190, "قرار المتابعة", C\.red\)/, "routine follow-up must not look like a critical failure");

console.log("Social image export models: PASS");
