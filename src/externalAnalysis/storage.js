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
  if (!ticker) return null;
  const analysisId = reportIdentityId(report);
  return (collection[ticker] || []).find((item) => {
    if (report.id && item.id === report.id) return true;
    if (analysisId && reportIdentityId(item) === analysisId) return true;
    if (hash && item.metadata?.rawHash === hash) return true;
    return sameAnalysisIdentity(item, report) && sameCanonicalPayload(item, report);
  }) || null;
}

export function findConflictingExternalAnalysis(collection = {}, report = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  if (!ticker) return null;
  return (collection[ticker] || []).find((item) => sameAnalysisIdentity(item, report) && !sameCanonicalPayload(item, report)) || null;
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

export function saveOrCorrectQuarterlyAnalysis(collection = {}, report = {}, { now = new Date() } = {}) {
  const duplicate = findDuplicateExternalAnalysis(collection, report);
  if (duplicate) return { collection, report: duplicate, duplicate, corrected: false, conflicts: [] };
  const ticker = normalizeTicker(report.company?.ticker);
  if (!ticker) return { collection, report: null, duplicate: null, corrected: false, conflicts: [] };
  const current = collection[ticker] || [];
  const existing = current.find((item) => sameFiscalQuarterIdentity(item, report));
  if (!existing) {
    const saved = saveExternalAnalysis(collection, report, { now });
    return { ...saved, corrected: false, conflicts: [] };
  }

  const incomingPreferred = compareCorrectionVersions(report, existing) >= 0;
  const preferred = incomingPreferred ? report : existing;
  const fallback = incomingPreferred ? existing : report;
  const conflicts = [];
  const merged = mergeCorrectionValue(preferred, fallback, "", conflicts);
  merged.id = existing.id;
  merged.sources = mergeReportSources(existing.sources, report.sources);
  merged.metadata = {
    ...(merged.metadata || {}),
    correctedAnalysisId: existing.id,
    correctionConflicts: mergeCorrectionConflicts(existing.metadata?.correctionConflicts, conflicts),
    updatedAt: now.toISOString()
  };
  const updated = updateSavedExternalAnalysis(collection, merged, now);
  return {
    collection: updated.collection,
    report: updated.report,
    duplicate: null,
    corrected: true,
    conflicts
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

function sameAnalysisIdentity(left = {}, right = {}) {
  return normalizeTicker(left.company?.ticker) === normalizeTicker(right.company?.ticker)
    && analysisType(left) === analysisType(right)
    && String(left.reportPeriod || "").trim() === String(right.reportPeriod || "").trim()
    && String(left.analysisDate || "").trim() === String(right.analysisDate || "").trim();
}

function analysisType(report = {}) {
  return String(report.metadata?.analysisType || report.metadata?.franklinV3?.analysisType || report.metadata?.franklinV3Report?.analysisType || "INITIAL").trim();
}

function reportIdentityId(report = {}) {
  return String(report.metadata?.franklinV3Report?.reportIdentity?.analysisId || report.metadata?.analysisId || "").trim();
}

function sameCanonicalPayload(left = {}, right = {}) {
  const leftCanonical = left.metadata?.franklinV3Report;
  const rightCanonical = right.metadata?.franklinV3Report;
  if (leftCanonical && rightCanonical) return JSON.stringify(leftCanonical) === JSON.stringify(rightCanonical);
  const leftHash = left.metadata?.rawHash;
  const rightHash = right.metadata?.rawHash;
  if (leftHash && rightHash) return leftHash === rightHash;
  return JSON.stringify(stableReportIdentityPayload(left)) === JSON.stringify(stableReportIdentityPayload(right));
}

function sameFiscalQuarterIdentity(left = {}, right = {}) {
  const leftIdentity = fiscalQuarterIdentity(left);
  const rightIdentity = fiscalQuarterIdentity(right);
  if (!leftIdentity || !rightIdentity) return false;
  if (leftIdentity.ticker !== rightIdentity.ticker) return false;
  if (leftIdentity.fiscalYear !== rightIdentity.fiscalYear || leftIdentity.fiscalQuarter !== rightIdentity.fiscalQuarter) return false;
  if (leftIdentity.periodEndDate && rightIdentity.periodEndDate) return leftIdentity.periodEndDate === rightIdentity.periodEndDate;
  return true;
}

function fiscalQuarterIdentity(report = {}) {
  const native = report.metadata?.franklinV3Report?.reportIdentity || {};
  const fiscal = report.fiscalIdentity || {};
  const period = parseFiscalPeriod(report.reportPeriod);
  const ticker = normalizeTicker(report.company?.ticker || native.ticker);
  const fiscalQuarter = normalizeFiscalQuarter(fiscal.fiscalQuarter || native.fiscalQuarter || period?.fiscalQuarter);
  const fiscalYear = Number(fiscal.fiscalYear || native.fiscalYear || period?.fiscalYear) || null;
  if (!ticker || !fiscalQuarter || !fiscalYear) return null;
  return {
    ticker,
    fiscalQuarter,
    fiscalYear,
    periodEndDate: fiscal.periodEndDate || native.periodEndDate || null
  };
}

function parseFiscalPeriod(value) {
  const clean = String(value || "").trim().toUpperCase();
  const quarter = clean.match(/Q\s*([1-4])/);
  const year = clean.match(/20\d{2}/);
  if (!quarter || !year) return null;
  return { fiscalQuarter: `Q${quarter[1]}`, fiscalYear: Number(year[0]) };
}

function normalizeFiscalQuarter(value) {
  const match = String(value || "").trim().toUpperCase().match(/^Q?\s*([1-4])$/);
  return match ? `Q${match[1]}` : null;
}

function compareCorrectionVersions(left = {}, right = {}) {
  const leftRank = correctionVersionRank(left);
  const rightRank = correctionVersionRank(right);
  return leftRank.localeCompare(rightRank);
}

function correctionVersionRank(report = {}) {
  const date = report.analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || "";
  const hash = report.metadata?.rawHash || hashText(report.rawAnalysisOriginal || report.rawAnalysis || JSON.stringify(report));
  return `${String(date)}|${String(hash)}`;
}

function mergeCorrectionValue(preferred, fallback, path, conflicts) {
  if (preferred === null || preferred === undefined) return cloneValue(fallback);
  if (fallback === null || fallback === undefined) return cloneValue(preferred);
  if (sameValue(preferred, fallback)) return cloneValue(preferred);
  if (Array.isArray(preferred) || Array.isArray(fallback)) {
    if (path !== "sources") conflicts.push(correctionConflict(path, fallback, preferred));
    return cloneValue(preferred);
  }
  if (plainObject(preferred) && plainObject(fallback)) {
    const result = {};
    for (const key of [...new Set([...Object.keys(fallback), ...Object.keys(preferred)])].sort()) {
      if (path === "metadata" && ["importedAt", "updatedAt", "correctionConflicts"].includes(key)) {
        result[key] = cloneValue(preferred[key] ?? fallback[key]);
        continue;
      }
      const nextPath = path ? `${path}.${key}` : key;
      result[key] = mergeCorrectionValue(preferred[key], fallback[key], nextPath, conflicts);
    }
    return result;
  }
  conflicts.push(correctionConflict(path, fallback, preferred));
  return cloneValue(preferred);
}

function correctionConflict(path, previousValue, selectedValue) {
  const identity = `${path}|${JSON.stringify(previousValue)}|${JSON.stringify(selectedValue)}`;
  return {
    id: `analysis-correction-${hashText(identity)}`,
    path,
    previousValue: cloneValue(previousValue),
    selectedValue: cloneValue(selectedValue),
    resolution: "NEWEST_ANALYSIS_WINS_WITH_AUDIT"
  };
}

function mergeCorrectionConflicts(...lists) {
  const result = new Map();
  for (const item of lists.flatMap((list) => Array.isArray(list) ? list : [])) {
    if (item?.id && !result.has(item.id)) result.set(item.id, cloneValue(item));
  }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergeReportSources(left = [], right = []) {
  const result = new Map();
  for (const source of [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]) {
    if (!plainObject(source)) continue;
    const key = String(source.id || source.url || `${source.title || "source"}|${source.date || ""}`);
    const previous = result.get(key) || {};
    result.set(key, {
      ...previous,
      ...cloneValue(source),
      usedFor: [...new Set([...(Array.isArray(previous.usedFor) ? previous.usedFor : []), ...(Array.isArray(source.usedFor) ? source.usedFor : [])])]
    });
  }
  return [...result.values()].sort((a, b) => String(a.id || a.url || a.title).localeCompare(String(b.id || b.url || b.title)));
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function stableReportIdentityPayload(report = {}) {
  return {
    company: report.company || null,
    analysisDate: report.analysisDate || null,
    reportPeriod: report.reportPeriod || null,
    fairValueSummary: report.fairValueSummary || null,
    thesis: report.thesis || null,
    decision: report.decision || null,
    sources: report.sources || null
  };
}
