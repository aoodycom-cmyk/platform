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
  const normalized = normalizeJsonLikeText(clean);
  const candidates = uniqueCandidates([
    clean,
    extractFirstJsonObject(clean),
    normalized,
    extractFirstJsonObject(normalized)
  ]);
  for (const candidate of candidates) {
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

export function normalizeJsonLikeText(text) {
  return String(text || "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, "\"")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u00A0/g, " ")
    .trim();
}

function uniqueCandidates(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}
