import { money } from "../domain/financialMetrics.js";
import { analyzeExternalAnalysisCompletion } from "./missingFields.js";
import { canonicalExternalAnalysisReport } from "./schema.js";

export function externalAnalysisToHomeCard(report = {}) {
  const completionStatus = externalReportCompletionStatus(report);
  return {
    id: report.id,
    analysisOrigin: report.analysisOrigin,
    ticker: report.company?.ticker || "",
    companyName: report.company?.name || report.company?.ticker || "",
    analysisDate: report.analysisDate || "",
    reportPeriod: report.reportPeriod || "",
    currentPrice: report.fairValueSummary?.currentPrice ?? null,
    priceAtAnalysis: report.fairValueSummary?.currentPrice ?? null,
    averageCost: report.market?.userAverageCost ?? null,
    qualityScore: report.scores?.quality ?? null,
    growthScore: report.scores?.growth ?? null,
    valuationScore: report.scores?.valuation ?? null,
    riskScore: report.scores?.risk ?? null,
    overallScore: report.decision?.investmentScore ?? null,
    bearFairValue: report.fairValueSummary?.fairValueLow ?? null,
    baseFairValue: report.fairValueSummary?.fairValueBase ?? null,
    bullFairValue: report.fairValueSummary?.fairValueHigh ?? null,
    upsideToBasePct: report.fairValueSummary?.upsideDownsidePercent ?? null,
    verdict: report.decision?.action || "",
    thesis: report.thesis?.shortSummary || report.thesis?.fullSummary || "",
    guidanceCount: Array.isArray(report.guidance) ? report.guidance.length : 0,
    kpiCount: Array.isArray(report.companySpecificKpis) ? report.companySpecificKpis.length : 0,
    requirementsAchievement: report.requirementsAssessment?.weightedAchievement ?? null,
    thesisStatus: report.requirementsAssessment?.overallStatus || "",
    hasCompanyProfile: hasCompanyProfile(report.companyProfile),
    completionStatus
  };
}

export function externalAnalysisSummaryLine(report = {}) {
  const ticker = report.company?.ticker || "External";
  const price = money(report.fairValueSummary?.currentPrice, 2);
  const base = money(report.fairValueSummary?.fairValueBase, 0);
  const verdict = report.decision?.action || "-";
  return `${ticker} / ${price} / Base ${base} / ${verdict}`;
}

export function copyableExternalAnalysisJson(report = {}) {
  return JSON.stringify(externalReportWithCompletionStatus(report), null, 2);
}

export function externalReportWithCompletionStatus(report = {}) {
  const canonical = canonicalExternalAnalysisReport(report);
  return {
    ...canonical,
    completionStatus: externalReportCompletionStatus(canonical)
  };
}

export function externalReportCompletionStatus(report = {}) {
  return analyzeExternalAnalysisCompletion(report);
}

function hasCompanyProfile(profile = null) {
  if (!profile || typeof profile !== "object") return false;
  return Boolean(
    profile.summary
    || profile.businessModel
    || profile.customers
    || (Array.isArray(profile.activities) && profile.activities.length)
    || (Array.isArray(profile.mainGrowthDrivers) && profile.mainGrowthDrivers.length)
  );
}
