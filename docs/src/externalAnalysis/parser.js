import { normalizeExternalAnalysisReport } from "./schema.js";

export async function parseExternalAnalysisInput(text, { parseUnstructured, now = new Date() } = {}) {
  const rawAnalysis = String(text || "").trim();
  if (!rawAnalysis) throw new Error("Paste an external ChatGPT analysis first.");

  const localJson = parseJsonCandidate(rawAnalysis);
  if (localJson.ok) {
    return {
      report: normalizeExternalAnalysisReport(localJson.value, rawAnalysis, { now, importMethod: "structured_json" }),
      parserSource: "Local JSON Parser",
      usedAi: false
    };
  }

  if (typeof parseUnstructured !== "function") {
    throw new Error("External analysis parser is unavailable.");
  }
  const parsed = await parseUnstructured(rawAnalysis);
  return {
    report: normalizeExternalAnalysisReport(parsed.report || parsed, rawAnalysis, { now, importMethod: "openai_backend_parser" }),
    parserSource: parsed.source || "OpenAI Backend Parser",
    usedAi: true
  };
}

export function parseJsonCandidate(text) {
  const clean = String(text || "").trim();
  for (const candidate of [clean, extractFirstJsonObject(clean)]) {
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return { ok: true, value };
    } catch {
      // Continue to the next candidate.
    }
  }
  return { ok: false, value: null };
}

export function stringifyExternalAnalysisReport(report) {
  return JSON.stringify(report, null, 2);
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}
