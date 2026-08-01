import { money } from "../domain/financialMetrics.js";
import { analyzeExternalAnalysisCompletion } from "./missingFields.js";

export function externalAnalysisToHomeCard(report = {}) {
  const completionStatus = externalReportCompletionStatus(report);
  return {
    id: report.id,
    analysisOrigin: report.analysisOrigin,
    ticker: report.company?.ticker || "",
    companyName: report.company?.name || report.company?.ticker || "",
    analysisDate: report.analysisDate || "",
    reportPeriod: report.reportPeriod || "",
    currentPrice: report.market?.priceAtAnalysis ?? null,
    qualityScore: report.scores?.quality ?? null,
    growthScore: report.scores?.growth ?? null,
    valuationScore: report.scores?.valuation ?? null,
    riskScore: report.scores?.risk ?? null,
    overallScore: report.scores?.overall ?? null,
    bearFairValue: report.fairValue?.bear ?? null,
    baseFairValue: report.fairValue?.base ?? null,
    bullFairValue: report.fairValue?.bull ?? null,
    upsideToBasePct: report.fairValue?.upsideToBasePct ?? null,
    verdict: report.decision?.verdict || "",
    thesis: report.thesis?.shortSummary || report.thesis?.fullSummary || "",
    completionStatus
  };
}

export function externalAnalysisSummaryLine(report = {}) {
  const ticker = report.company?.ticker || "External";
  const price = money(report.market?.priceAtAnalysis, 2);
  const base = money(report.fairValue?.base, 0);
  const verdict = report.decision?.verdict || "-";
  return `${ticker} / ${price} / Base ${base} / ${verdict}`;
}

export function copyableExternalAnalysisJson(report = {}) {
  return JSON.stringify(externalReportWithCompletionStatus(report), null, 2);
}

export function externalReportWithCompletionStatus(report = {}) {
  return {
    ...report,
    completionStatus: externalReportCompletionStatus(report)
  };
}

export function externalReportCompletionStatus(report = {}) {
  return analyzeExternalAnalysisCompletion(report);
}
