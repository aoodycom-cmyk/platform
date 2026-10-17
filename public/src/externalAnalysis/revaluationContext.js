// Keep only the frozen evidence needed by the cross-report gates. Never persist
// a cached validation result, and never recursively copy the analysis history.
export function snapshotRevaluationContext(previous) {
  if (!previous?.id) return null;
  return JSON.parse(JSON.stringify({
    id: previous.id,
    company: previous.company,
    analysisDate: previous.analysisDate,
    reportPeriod: previous.reportPeriod,
    fairValueSummary: previous.fairValueSummary,
    priceTargetRequirements: previous.priceTargetRequirements
  }));
}

export function storedRevaluationContext(report = {}) {
  const native = report.metadata?.franklinV3Report;
  const previous = report.metadata?.revaluationContext;
  if (native?.analysisType !== "EARNINGS_REVALUATION" || !previous
    || previous.id !== native.reportIdentity?.previousAnalysisId) return {};
  return { currentReport: previous };
}
