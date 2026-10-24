// External analytical risk severity, not the legacy engine's safety score.
export const EXTERNAL_RISK_SCALE = "higher-is-riskier";
export const RISK_SCALE_EXPLANATION_AR = "درجة شدة المخاطر: 0 أقل مخاطر و100 أعلى مخاطر؛ ليست درجة أمان. لا تقلب الدرجات القديمة تلقائيًا.";
export function hasComparableRiskScore(report = {}) {
  const score = report.scores?.risk;
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
    && report.scores?.riskScale === EXTERNAL_RISK_SCALE;
}
