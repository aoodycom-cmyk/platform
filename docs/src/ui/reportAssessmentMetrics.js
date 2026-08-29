const RISK_SEVERITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function valuationAssessmentMetric(report = {}) {
  const explicitScore = finiteNumber(report.scores?.valuation);
  if (explicitScore !== null) {
    return { kind: "score", score: explicitScore, progress: clamp(explicitScore * 10, 0, 100) };
  }

  const upside = finiteNumber(report.fairValueSummary?.upsideDownsidePercent);
  if (upside !== null) {
    return {
      kind: "upside",
      value: upside,
      progress: clamp(Math.abs(upside), 0, 100),
      tone: upside >= 0 ? "positive" : "risk"
    };
  }

  const base = finiteNumber(report.fairValueSummary?.fairValueBase);
  if (base !== null) return { kind: "base", value: base, progress: null, tone: "positive" };
  return { kind: "missing", progress: null };
}

export function riskAssessmentMetric(report = {}) {
  const explicitScore = finiteNumber(report.scores?.risk);
  if (explicitScore !== null) {
    return { kind: "score", score: explicitScore, progress: clamp(explicitScore * 10, 0, 100), tone: "risk" };
  }

  const severity = highestRiskSeverity(report.risks);
  if (!severity) return { kind: "missing", progress: null, tone: "risk" };
  return {
    kind: "severity",
    severity,
    progress: RISK_SEVERITY_ORDER[severity] * 25,
    tone: "risk"
  };
}

export function highestRiskSeverity(risks = []) {
  if (!Array.isArray(risks)) return null;
  return risks.reduce((highest, item) => {
    const severity = String(item?.severity || "").trim().toLowerCase();
    if (!RISK_SEVERITY_ORDER[severity]) return highest;
    if (!highest || RISK_SEVERITY_ORDER[severity] > RISK_SEVERITY_ORDER[highest]) return severity;
    return highest;
  }, null);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
