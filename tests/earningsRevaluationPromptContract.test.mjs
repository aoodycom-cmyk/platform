import assert from "node:assert/strict";
import {
  buildNewEarningsAnalysisPrompt,
  FRANKLIN_EARNINGS_PROMPT_VERSION
} from "../src/externalAnalysis/chatgptContract.js";

const previousReport = {
  id: "FUTU-INITIAL-2026-08-19",
  analysisDate: "2026-08-19",
  reportPeriod: "Q1 2026",
  company: { ticker: "FUTU", name: "Futu Holdings Limited", currency: "USD" },
  fairValueSummary: {
    fairValueLow: 95,
    fairValueBase: 150,
    fairValueHigh: 190,
    probabilityWeightedFairValue: 151
  },
  decision: { action: "WATCH" },
  thesis: { shortSummary: "النمو قوي لكن التقييم يحتاج متابعة التنفيذ." },
  priceTargetRequirements: {
    requirementSetId: "FUTU_REQ_Q2_2026",
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    requirements: [
      { id: "revenue", name: "Revenue", arabicName: "الإيرادات", metric: "Revenue", type: "minimum", requiredValue: 6100000000, requiredDisplay: "HK$6.1bn", unit: "HKD", weight: 30, status: "NOT_REPORTED" },
      { id: "funded", name: "Funded Accounts", arabicName: "الحسابات الممولة", metric: "Funded Accounts", type: "minimum", requiredValue: 3780000, requiredDisplay: "3.78m", unit: "accounts", weight: 30, status: "NOT_REPORTED" },
      { id: "assets", name: "Client Assets", arabicName: "أصول العملاء", metric: "Client Assets", type: "minimum", requiredValue: 1250000000000, requiredDisplay: "HK$1.25tn", unit: "HKD", weight: 20, status: "NOT_REPORTED" },
      { id: "margin", name: "Gross Margin", arabicName: "الهامش الإجمالي", metric: "Gross Margin", type: "minimum", requiredValue: 86, requiredDisplay: "86%", unit: "%", weight: 20, status: "NOT_REPORTED" }
    ]
  }
};

const prompt = buildNewEarningsAnalysisPrompt(previousReport, { quarter: 2, year: 2026 });
assert.equal(FRANKLIN_EARNINGS_PROMPT_VERSION, "franklin-earnings-revaluation-prompt/v2");
assert.ok(prompt.includes("FRANKLIN_EARNINGS_REVALUATION"));
assert.ok(prompt.includes("franklin-fair-value/v3"));
assert.ok(prompt.includes("fair-value-methodology/v2"));
assert.ok(prompt.includes(previousReport.id));
assert.ok(prompt.includes("FUTU_REQ_Q2_2026"));
assert.ok(prompt.includes("الربع الذي اختاره المستخدم لهذا التحديث: Q2 2026"));
assert.ok(prompt.includes("حلل مواد Q2 2026 فقط"));
assert.ok(prompt.includes('"fiscalQuarter":"Q2"') || prompt.includes('"fiscalQuarter": "Q2"'));
assert.ok(prompt.includes('"fiscalYear":2026') || prompt.includes('"fiscalYear": 2026'));
assert.ok(prompt.includes("previousInvestmentState JSON"));
assert.ok(prompt.includes("Previous Bear Fair Value"));
assert.ok(prompt.includes("فرضية الاستثمار"));
assert.ok(prompt.includes("revenue"));
assert.ok(prompt.includes("requiredValue"));
assert.ok(prompt.includes("أعد تقييم Bear/Base/Bull إلزاميًا"));
assert.ok(prompt.includes("UPDATED أو UNCHANGED"));
assert.ok(prompt.includes("nextRequirements جديدة بالكامل"));
assert.ok(prompt.includes("nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base"));
assert.ok(prompt.includes("مصادر جديدة خاصة بهذا الربع"));
assert.ok(prompt.includes("Franklin لا يرفع الهدف آليًا ولا يحسب targetValue"));
assert.ok(prompt.includes("NOT_REPORTED"));
assert.ok(prompt.includes("actualValue = null"));
assert.ok(prompt.includes("coverageWeightPct"));
assert.ok(prompt.includes("achievementOfReportedWeightPct"));
assert.ok(prompt.includes("STRENGTHENED"));
assert.ok(prompt.includes("valuationBridge"));
assert.ok(prompt.includes("baseChangeBridge"));
assert.ok(prompt.includes("financialNormalization"));
assert.ok(prompt.includes("previousSnapshotDate"));
assert.ok(prompt.includes("weightedMethodFairValue"));
assert.ok(prompt.includes("yearlyForecast"));
assert.ok(prompt.includes("FILE DELIVERY — MANDATORY PRIMARY MODE"));
assert.ok(prompt.includes("downloadable UTF-8 JSON file"));
assert.ok(prompt.includes("franklin-FUTU-Q2-2026-earnings-update.json"));
assert.ok(prompt.includes("Do not shorten, summarize, omit, split, or reduce any financial field"));
assert.ok(prompt.includes("FALLBACK ONLY"));
assert.ok(prompt.includes("JSON.parse()"));
assert.ok(prompt.includes("MARKET PRICE GATE"));
assert.ok(prompt.includes("GAAP/non-GAAP"));
assert.ok(prompt.includes("عدد الأسهم المخفف"));
assert.ok(prompt.includes("عناصر القالب الوهمية"));
assert.equal(/OPENAI_API|fetch\(/i.test(prompt), false);

const marker = "نفّذ الطلب التالي كاملًا ثم أخرج عقد V3 فقط:";
const requestText = prompt.slice(prompt.indexOf(marker) + marker.length).trim();
const request = JSON.parse(requestText);
assert.equal(request.promptVersion, "franklin-earnings-revaluation-prompt/v2");
assert.equal(request.requestType, "FRANKLIN_EARNINGS_REVALUATION");
assert.equal(request.periodLock.selectedPeriod, "Q2 2026");
assert.equal(request.periodLock.fiscalQuarter, "Q2");
assert.equal(request.periodLock.fiscalYear, 2026);
assert.equal(request.previousInvestmentState.analysisId, previousReport.id);
assert.equal(request.previousInvestmentState.requirementSetId, "FUTU_REQ_Q2_2026");
assert.equal(request.previousInvestmentState.frozenRequirements.length, 4);
assert.equal(request.previousInvestmentState.frozenRequirements[0].requiredValue, 6100000000);
assert.equal(request.outputContract.analysisType, "EARNINGS_REVALUATION");
assert.equal(request.outputContract.format, "DOWNLOADABLE_UTF8_JSON_FILE");
assert.equal(request.outputContract.lineage.previousAnalysisId, previousReport.id);
assert.equal(request.outputContract.lineage.previousRequirementSetId, "FUTU_REQ_Q2_2026");
assert.equal(request.jsonTemplate.schemaVersion, "franklin-fair-value/v3");
assert.equal(request.jsonTemplate.analysisType, "EARNINGS_REVALUATION");
assert.equal(request.jsonTemplate.reportIdentity.fiscalQuarter, "Q2");
assert.equal(request.jsonTemplate.reportIdentity.fiscalYear, 2026);
assert.equal(request.jsonTemplate.reportIdentity.previousAnalysisId, previousReport.id);
assert.equal(request.jsonTemplate.reportIdentity.previousRequirementSetId, "FUTU_REQ_Q2_2026");
assert.deepEqual(Object.keys(request.jsonTemplate.valuation.scenarios), ["Bear", "Base", "Bull"]);
assert.ok(request.revaluationScope.quarterReading.some((item) => item.includes("المنافسة")));
assert.ok(request.revaluationScope.frozenRequirementsEvaluation.some((item) => item.includes("NOT_REPORTED")));
assert.ok(request.revaluationScope.valuationAndThesis.some((item) => item.includes("Bear/Base/Bull")));
assert.ok(request.revaluationScope.nextRequirements.some((item) => item.includes("4 إلى 8")));
assert.ok(request.revaluationScope.nextRequirements.some((item) => item.includes("baselineValue") && item.includes("أحدث Actual")));
assert.ok(request.revaluationScope.nextRequirements.some((item) => item.includes("ADVANCE_TARGET") && item.includes("minimum requirement")));
assert.ok(request.revaluationScope.nextRequirements.some((item) => item.includes("maintenance/defense floor")));
assert.equal(request.revaluationScope.nextRequirementsBaselinePolicy.baselineSource, "latest reported actual from the earnings period being analyzed when directly comparable");
assert.match(request.revaluationScope.nextRequirementsBaselinePolicy.advanceTargetRule, /minimum >= comparable baseline/);
assert.match(request.revaluationScope.nextRequirementsBaselinePolicy.alreadyClearedRule, /not incremental evidence/);
assert.ok(request.outputContract.rules.some((item) => item.includes("baselineValue/baselineDisplay")));
assert.ok(request.outputContract.rules.some((item) => item.includes("ADVANCE_TARGET") && item.includes("مستوفى مسبقًا")));
assert.ok(request.revaluationScope.provenance.some((item) => item.includes("مصادر")));
assert.ok(request.revaluationScope.frozenRequirementsEvaluation.some((item) => item.includes("minimum")));
assert.ok(request.outputContract.rules.some((item) => item.includes("marketPrice.value")));
assert.ok(request.completionChecklist.some((item) => item.includes("marketPrice")));
assert.ok(request.completionChecklist.some((item) => item.includes("جسر تغير Base")));
assert.match(request.outputContract.canonicalValueRules.metricResult, /BEAT/);

assert.ok(prompt.length < 40000, `Earnings revaluation prompt is unexpectedly large: ${prompt.length} chars.`);
console.log(`Earnings revaluation prompt contract: PASS (${prompt.length} chars)`);
