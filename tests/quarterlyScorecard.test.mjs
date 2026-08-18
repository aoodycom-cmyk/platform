import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availableQuarterlyScorecardYears,
  buildQuarterlyScorecard,
  createQuarterlyScorecardExportModel,
  normalizeRequirementAlias,
  parseQuarterPeriod
} from "../src/externalAnalysis/quarterlyScorecard.js";
import { QUARTERLY_FORWARD_OUTLOOK_KIND } from "../src/externalAnalysis/quarterlyForwardOutlook.js";

const historicalRequirementSets = {
  DEMO: [
    requirementSet("Q1 2026", "EVALUATED", 58, [
      requirement("revenue_growth", "Revenue Growth", 30, 31, "PASSED", "نمو الإيرادات حقق المطلوب."),
      requirement("gross_margin", "Gross Margin", 45, 42, "FAILED", "الهامش لم يصل إلى المطلوب.")
    ]),
    requirementSet("Q2 FY2026", "EVALUATED", 76, [
      requirement("revenue_growth", "Quarterly Revenue Growth", 32, 36, "EXCEEDED", "النمو تجاوز المطلوب."),
      requirement("gross_margin_q2", "Gross Margin Q2 FY2026", 45, 46, "PASSED", "الهامش حقق المطلوب.")
    ]),
    requirementSet("Q3 2026", "OPEN", null, [
      requirement("revenue_growth_q3", "Revenue Growth", 34, null, "NOT_REPORTED"),
      requirement("gross_margin_q3", "Gross Margin", 47, null, "NOT_REPORTED")
    ])
  ]
};

const externalAnalyses = {
  DEMO: [{
    id: "demo-2026",
    analysisDate: "2026-08-08",
    reportPeriod: "Q2 2026",
    company: { ticker: "DEMO", name: "Demo Company" },
    fairValueSummary: { fairValueLow: 45, fairValueBase: 60, fairValueHigh: 100 },
    supplements: [
      {
        kind: QUARTERLY_FORWARD_OUTLOOK_KIND,
        period: "Q1 2026",
        growthOutlook: "stable",
        marginOutlook: "pressured",
        guidanceTrend: "maintained",
        managementTone: "cautious",
        thesisImpact: "neutral",
        summary: "النمو مستقر لكن الهوامش تحت ضغط."
      },
      {
        kind: QUARTERLY_FORWARD_OUTLOOK_KIND,
        period: "Q2 2026",
        growthOutlook: "accelerating",
        marginOutlook: "improving",
        guidanceTrend: "raised",
        managementTone: "positive",
        thesisImpact: "supports",
        summary: "النمو والهوامش يتحسنان والتوجيهات ارتفعت."
      }
    ]
  }]
};

const scorecard = buildQuarterlyScorecard({ historicalRequirementSets, externalAnalyses, ticker: "DEMO", year: 2026 });

// 1. Q1 and Q2 are evaluated while Q3 and Q4 remain unreported.
assert.equal(scorecard.quarters[0].evaluated, true);
assert.equal(scorecard.quarters[1].evaluated, true);
assert.equal(scorecard.quarters[2].evaluated, false);
assert.equal(scorecard.quarters[3].evaluated, false);
assert.equal(scorecard.quarters[2].weightedAchievement, null);
assert.equal(scorecard.quarters[3].weightedAchievement, null);

// 2. Future quarters stay neutral and never become zero or failed.
const revenueRow = scorecard.rows.find((row) => row.key === "id:revenue_growth");
assert.equal(revenueRow.cells[3].reported, false);
assert.equal(revenueRow.cells[3].status, "NOT_REPORTED");
assert.equal(revenueRow.cells[3].actualValue, null);
assert.equal(revenueRow.cells[4], undefined);

// 3. Requirements align into one row across quarters.
const marginRows = scorecard.rows.filter((row) => normalizeRequirementAlias(row.label).includes("gross margin"));
assert.equal(marginRows.length, 1);
assert.deepEqual(Object.keys(marginRows[0].cells), ["1", "2", "3"]);

// 4. A stable ID has priority even when the supplied label changes.
assert.equal(revenueRow.cells[1].actualValue, 31);
assert.equal(revenueRow.cells[2].actualValue, 36);

// 5. Metric/name normalization removes quarter and year suffixes.
assert.equal(normalizeRequirementAlias("Gross Margin Q2 FY2026"), "gross margin");
assert.deepEqual(parseQuarterPeriod("Q2 FY2026"), { quarter: 2, year: 2026 });

// 6. Missing values remain null and are never converted to zero.
assert.equal(marginRows[0].cells[3].actualValue, null);
assert.notEqual(marginRows[0].cells[3].actualValue, 0);

// 7. Historical target sets and saved quarterly reports both feed the scorecard.
assert.deepEqual(availableQuarterlyScorecardYears(historicalRequirementSets, "demo"), [2026]);
assert.equal(scorecard.rows.length, 2);
assert.equal(scorecard.companyName, "Demo Company");

// 8. Forward outlook is attached to the correct quarter and does not fabricate future-quarter views.
assert.equal(scorecard.quarters[0].outlook.growthOutlook, "stable");
assert.equal(scorecard.quarters[0].outlook.thesisImpact, "neutral");
assert.equal(scorecard.quarters[1].outlook.growthOutlook, "accelerating");
assert.equal(scorecard.quarters[1].outlook.guidanceTrend, "raised");
assert.equal(scorecard.quarters[1].outlook.thesisImpact, "supports");
assert.equal(scorecard.quarters[2].outlook, null);
assert.equal(scorecard.quarters[3].outlook, null);

// 9. A Q1 observation against a Q3 target stays in Q1; Q3 remains an open target.
const goalHistorical = {
  AMZN: [{
    requirementSetId: "AMZN_Q32026_TARGET",
    ticker: "AMZN",
    earningsPeriod: "Q3 2026",
    targetQuarter: "Q3 2026",
    status: "EVALUATED",
    evaluatedByAnalysisId: "AMZN-Q1-2026",
    evaluatedAt: "2026-04-29T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    requirements: [
      requirement("aws_growth", "AWS Growth", 30, 28, "NOT_REPORTED", "Q1 observation; Q3 target is not due yet.")
    ],
    requirementsAssessment: null
  }]
};
const goalReports = {
  AMZN: [{
    id: "AMZN-Q1-2026",
    analysisDate: "2026-04-29",
    reportPeriod: "Q1 2026",
    company: { ticker: "AMZN", name: "Amazon.com, Inc." },
    fairValueSummary: { fairValueLow: 170, fairValueBase: 220, fairValueHigh: 275 },
    previousRequirementsEvaluation: {
      requirementSetId: "AMZN_Q32026_TARGET",
      targetQuarter: "Q3 2026",
      requirements: [
        requirement("aws_growth", "AWS Growth", 30, 28, "NOT_REPORTED", "Q1 observation; Q3 target is not due yet.")
      ],
      requirementsAssessment: null
    },
    supplements: []
  }]
};
const goalScorecard = buildQuarterlyScorecard({ historicalRequirementSets: goalHistorical, externalAnalyses: goalReports, ticker: "AMZN", year: 2026 });
const awsGoalRow = goalScorecard.rows.find((row) => row.key === "id:aws_growth");
assert.equal(goalScorecard.quarters[0].evaluated, true, "Q1 must count as an observed quarter when an actual value exists.");
assert.equal(goalScorecard.latestReportedQuarter, 1);
assert.equal(awsGoalRow.cells[1].actualValue, 28, "Q1 actual must remain attached to Q1.");
assert.equal(awsGoalRow.cells[1].status, "NOT_REPORTED", "Pre-target observations stay neutral rather than pass/fail.");
assert.equal(awsGoalRow.cells[1].reported, true, "Observed actuals must remain inspectable in the UI.");
assert.equal(awsGoalRow.cells[1].observation, true);
assert.equal(awsGoalRow.cells[3].requiredValue, 30, "The Q3 target threshold must stay visible.");
assert.equal(awsGoalRow.cells[3].actualValue, null, "Q1 actual must never be copied into the Q3 target cell.");
assert.equal(awsGoalRow.cells[3].status, "NOT_REPORTED", "Q3 must remain open until Q3 is actually reported.");
assert.equal(goalScorecard.quarters[2].evaluated, false);

// 10. Export model generation is deterministic and does not mutate source state.
const before = JSON.stringify({ historicalRequirementSets, externalAnalyses, scorecard });
const exportModel = createQuarterlyScorecardExportModel(scorecard, new Date("2026-08-18T12:00:00.000Z"));
assert.equal(exportModel.exportedAt, "2026-08-18T12:00:00.000Z");
assert.equal(exportModel.rows[0].cells[4], null);
assert.equal(exportModel.quarters[1].outlook.thesisImpact, "supports");
assert.equal(JSON.stringify({ historicalRequirementSets, externalAnalyses, scorecard }), before);

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const store = readFileSync(new URL("../src/state/store.js", import.meta.url), "utf8");
const mobileScorecard = readFileSync(new URL("../src/ui/quarterlyScorecardMobileFigma.js", import.meta.url), "utf8");

// 11. Price Target Requirements exposes the scorecard entry point.
assert.ok(components.includes('data-action="open-quarterly-scorecard"'));
assert.ok(components.includes("Quarterly Scorecard"));

// 12. Back navigation restores the originating saved report.
assert.ok(store.includes("function closeQuarterlyScorecard()"));
assert.ok(store.includes('openExternalReport(scorecard.originTicker || scorecard.ticker, scorecard.originReportId || "latest")'));

// 13. Mobile uses cards and explicitly prevents page-level horizontal overflow.
assert.ok(styles.includes(".quarterly-mobile-cards"));
assert.ok(styles.includes(".quarterly-desktop-matrix {\n  display: none;"));
assert.ok(styles.includes("overflow-x: hidden"));
assert.ok(styles.includes("grid-template-columns: repeat(4, minmax(0, 1fr))"));
const scorecardStyles = styles.slice(styles.indexOf(".quarterly-scorecard-entry"), styles.indexOf("@media (max-width: 374px)"));
assert.equal(scorecardStyles.includes("font-size: 9px"), false, "New scorecard styles must not introduce 9px labels.");

// 14. Forward Outlook has a dedicated scorecard UI and never edits valuation/recommendation fields.
assert.ok(mobileScorecard.includes("quarterly-forward-outlook"));
assert.ok(mobileScorecard.includes("النظرة المستقبلية عبر الأرباع"));
assert.ok(mobileScorecard.includes("دون تغيير القيمة العادلة أو التوصية الأساسية"));

// 15. Existing report/history/navigation panels remain present.
for (const panel of ["external-report", "company-profile", "history", "settings", "external-import"]) {
  assert.ok(components.includes(`"${panel}"`), `${panel} navigation must remain available.`);
}

assert.equal(scorecard.quarters[0].weightedAchievement, 58, "Only stored weightedAchievement may be displayed.");
assert.equal(scorecard.quarters[1].weightedAchievement, 76, "Stored quarterly achievement must be preserved exactly.");
assert.equal(scorecard.trajectory, "improving", "Trajectory may use only stored evaluated-quarter assessments.");

console.log("Quarterly Requirements Scorecard tests passed.");

function requirementSet(period, status, weightedAchievement, requirements) {
  return {
    requirementSetId: `DEMO_${String(period).replaceAll(" ", "_")}`,
    ticker: "DEMO",
    earningsPeriod: period,
    targetQuarter: period,
    status,
    createdAt: `${period.includes("Q1") ? "2026-01-01" : period.includes("Q2") ? "2026-04-01" : "2026-07-01"}T00:00:00.000Z`,
    targetValue: period.includes("Q1") ? 80 : period.includes("Q2") ? 90 : 100,
    targetScenario: "bull",
    requirements,
    requirementsAssessment: status === "EVALUATED" ? {
      weightedAchievement,
      overallStatus: period.includes("Q1") ? "bull_case_unchanged" : "bull_case_strengthened",
      summary: "Stored ChatGPT assessment."
    } : null
  };
}

function requirement(id, name, requiredValue, actualValue, status, evaluationNote = null) {
  return {
    id,
    name,
    metric: name,
    requiredValue,
    actualValue,
    actualDisplay: actualValue === null ? null : `${actualValue}%`,
    unit: "%",
    type: "minimum",
    status,
    direction: actualValue === null ? "unknown" : "up",
    impact: status === "FAILED" ? "negative" : status === "NOT_REPORTED" ? "unknown" : "positive",
    evaluationNote
  };
}
