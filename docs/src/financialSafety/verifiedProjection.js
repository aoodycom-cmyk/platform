import { normalizeExternalAnalysisReport } from "../externalAnalysis/schema.js";
import { verifyFinancialAnalysis } from "./financialVerification.js";

// An embedded verified model is not a certificate for independently editable
// display fields. Check the same projection at import and after persisted reload.
export function auditVerifiedProjection(report = {}) {
  const native = report.metadata?.franklinV3Report;
  if (native?.schemaVersion !== "franklin-fair-value/v3" || report.metadata?.importMethod === "quarterly_earnings_lite") return [];
  const expected = normalizeExternalAnalysisReport(native, "", {
    v3Validation: { financialVerification: verifyFinancialAnalysis(native) }
  });
  const fields = [
    "company", "analysisDate", "fairValueSummary", "decision", "dataQuality.score", "valuationResults",
    "valuationMethodology", "forecastAssumptions", "scenarios"
  ];
  const findings = fields.filter((field) => !equal(read(report, field), read(expected, field))).map((field) => ({
    code: "VERIFIED_PROJECTION_MISMATCH", field, status: "BLOCKED",
    message: `Displayed ${field} differs from the canonical financial model. Re-import the original analysis or regenerate the model; a verified badge cannot certify different displayed values.`
  }));
  for (const key of Object.keys(expected.scores || {})) {
    if (equal(report.scores?.[key], expected.scores[key])) continue;
    const addition = expected.scores[key] == null && report.scores?.[key] != null;
    findings.push({ code: addition ? "SUPPLEMENT_SCORE_NOT_CANONICALLY_VERIFIED" : "VERIFIED_PROJECTION_MISMATCH",
      field: `scores.${key}`, status: addition ? "NEEDS_REVIEW" : "BLOCKED",
      message: addition ? "This supplemental score is preserved but is not certified by the original financial model." : "Displayed score differs from the canonical financial model." });
  }
  return findings;
}

function read(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function equal(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).sort();
  const other = Object.keys(b).sort();
  return keys.length === other.length && keys.every((key, i) => key === other[i] && equal(a[key], b[key]));
}
