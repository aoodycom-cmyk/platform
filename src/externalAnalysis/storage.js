import { EXTERNAL_ANALYSIS_ORIGIN, hashText, normalizeExternalAnalysisReport } from "./schema.js";

export function normalizeExternalAnalysesCollection(collection = {}) {
  if (!collection || typeof collection !== "object") return {};
  const normalized = {};
  for (const [ticker, reports] of Object.entries(collection)) {
    const cleanTicker = normalizeTicker(ticker);
    if (!cleanTicker || !Array.isArray(reports)) continue;
    normalized[cleanTicker] = reports
      .filter((report) => report?.analysisOrigin === EXTERNAL_ANALYSIS_ORIGIN)
      .map((report) => normalizeExternalAnalysisReport(report, report.rawAnalysisOriginal || report.rawAnalysis || ""))
      .sort(compareReportsDesc);
  }
  return normalized;
}

export function listLatestExternalAnalyses(collection = {}) {
  return Object.values(normalizeExternalAnalysesCollection(collection))
    .map((reports) => reports[0])
    .filter(Boolean)
    .sort(compareReportsDesc);
}

export function getExternalAnalysis(collection = {}, ticker, reportId = "latest") {
  const cleanTicker = normalizeTicker(ticker);
  const reports = normalizeExternalAnalysesCollection(collection)[cleanTicker] || [];
  if (!reports.length) return null;
  if (!reportId || reportId === "latest") return reports[0];
  return reports.find((report) => report.id === reportId) || null;
}

export function findDuplicateExternalAnalysis(collection = {}, report = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const hash = report.metadata?.rawHash || hashText(report.rawAnalysisOriginal || report.rawAnalysis || "");
  if (!ticker || !hash) return null;
  return (collection[ticker] || []).find((item) => item.metadata?.rawHash === hash) || null;
}

export function saveExternalAnalysis(collection = {}, report = {}, { allowDuplicate = false, now = new Date() } = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  if (!ticker) return { collection, report: null, duplicate: null };
  const duplicate = findDuplicateExternalAnalysis(collection, report);
  if (duplicate && !allowDuplicate) return { collection, report: duplicate, duplicate };

  const timestamp = now.toISOString();
  const nextReport = normalizeExternalAnalysisReport({
    ...report,
    id: report.id || createExternalAnalysisId(report, timestamp),
    analysisOrigin: EXTERNAL_ANALYSIS_ORIGIN,
    company: { ...(report.company || {}), ticker },
    metadata: {
      ...(report.metadata || {}),
      importedAt: report.metadata?.importedAt || timestamp,
      updatedAt: timestamp,
      rawHash: report.metadata?.rawHash || hashText(report.rawAnalysisOriginal || report.rawAnalysis || "")
    }
  }, report.rawAnalysisOriginal || report.rawAnalysis || "", { now });
  const current = collection[ticker] || [];
  return {
    collection: {
      ...collection,
      [ticker]: [nextReport, ...current].sort(compareReportsDesc)
    },
    report: nextReport,
    duplicate: null
  };
}

export function updateSavedExternalAnalysis(collection = {}, report = {}, now = new Date()) {
  const ticker = normalizeTicker(report.company?.ticker);
  if (!ticker || !report.id) return { collection, report: null };
  const timestamp = now.toISOString();
  const nextReport = normalizeExternalAnalysisReport({
    ...report,
    analysisOrigin: EXTERNAL_ANALYSIS_ORIGIN,
    rawAnalysisOriginal: report.rawAnalysisOriginal || report.rawAnalysis || "",
    metadata: {
      ...(report.metadata || {}),
      updatedAt: timestamp
    }
  }, report.rawAnalysisOriginal || report.rawAnalysis || "", { now });
  const withoutCurrent = {};
  for (const [entryTicker, reports] of Object.entries(collection)) {
    const remaining = (reports || []).filter((item) => item.id !== report.id);
    if (remaining.length) withoutCurrent[entryTicker] = remaining;
  }
  const current = withoutCurrent[ticker] || [];
  return {
    collection: {
      ...withoutCurrent,
      [ticker]: current.map((item) => item.id === report.id ? nextReport : item).sort(compareReportsDesc)
        .concat(current.some((item) => item.id === report.id) ? [] : [nextReport])
        .sort(compareReportsDesc)
    },
    report: nextReport
  };
}

export function deleteExternalAnalysis(collection = {}, ticker, reportId) {
  const cleanTicker = normalizeTicker(ticker);
  if (!cleanTicker) return collection;
  const rest = (collection[cleanTicker] || []).filter((report) => report.id !== reportId);
  if (!rest.length) {
    const { [cleanTicker]: _removed, ...remaining } = collection;
    return remaining;
  }
  return { ...collection, [cleanTicker]: rest };
}

export function deleteAllExternalAnalysesForTicker(collection = {}, ticker) {
  const cleanTicker = normalizeTicker(ticker);
  if (!cleanTicker) return collection;
  const { [cleanTicker]: _removed, ...remaining } = collection;
  return remaining;
}

function createExternalAnalysisId(report, timestamp) {
  const ticker = normalizeTicker(report.company?.ticker) || "EXT";
  const date = String(report.analysisDate || timestamp.slice(0, 10)).replace(/[^0-9A-Za-z-]/g, "");
  const hash = report.metadata?.rawHash || hashText(report.rawAnalysisOriginal || report.rawAnalysis || "");
  return `${ticker}-${date}-${hash}-${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function compareReportsDesc(a, b) {
  const dateA = new Date(a.analysisDate || a.metadata?.updatedAt || a.metadata?.importedAt || 0).getTime();
  const dateB = new Date(b.analysisDate || b.metadata?.updatedAt || b.metadata?.importedAt || 0).getTime();
  return dateB - dateA;
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean || null;
}
