import { parseJsonCandidate } from "./parser.js";
import { normalizeExternalAnalysisSupplement } from "./supplementSchema.js";

export async function parseExternalAnalysisSupplement(text, {
  parseUnstructured,
  existingReport = null,
  missingFields = [],
  now = new Date()
} = {}) {
  const rawSupplement = String(text || "").trim();
  if (!rawSupplement) throw new Error("Paste a supplementary ChatGPT response first.");

  const localJson = parseJsonCandidate(rawSupplement);
  if (localJson.ok) {
    return {
      supplement: normalizeExternalAnalysisSupplement(localJson.value, rawSupplement, supplementOptions(existingReport, now)),
      parserSource: "Local Supplement JSON Parser",
      usedAi: false
    };
  }

  if (typeof parseUnstructured !== "function") {
    throw new Error("Supplement parser is unavailable.");
  }

  const parsed = await parseUnstructured(rawSupplement, {
    existingReport,
    missingFields
  });
  return {
    supplement: normalizeExternalAnalysisSupplement(parsed.supplement || parsed, rawSupplement, supplementOptions(existingReport, now)),
    parserSource: parsed.source || "OpenAI Supplement Parser",
    usedAi: true
  };
}

function supplementOptions(existingReport, now) {
  return {
    now,
    ticker: existingReport?.company?.ticker,
    targetAnalysisId: existingReport?.id,
    analysisDate: existingReport?.analysisDate
  };
}
