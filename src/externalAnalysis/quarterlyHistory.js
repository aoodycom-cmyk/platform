export const QUARTERLY_HISTORY_SCHEMA_VERSION = "franklin-quarterly-history/v1";
export const QUARTERLY_HISTORY_STATUSES = ["REPORTED", "UPCOMING"];

const REPORTED = "REPORTED";
const UPCOMING = "UPCOMING";

export function normalizeQuarterlyEarningsHistory(input = {}, externalAnalyses = {}, options = {}) {
  let history = normalizeHistoryBuckets(input);
  const stats = createQuarterlyHistoryStats();
  const reports = Object.values(externalAnalyses || {})
    .flatMap((bucket) => Array.isArray(bucket) ? bucket : [])
    .filter(isObject)
    .sort(compareReportsForLifecycle);

  for (const report of reports) {
    const result = applyQuarterlyEarningsLifecycle(history, report, options);
    history = result.history;
    addStats(stats, result.stats);
  }

  return { history: sortHistoryBuckets(history), stats };
}

export function applyQuarterlyEarningsLifecycle(input = {}, report = {}, options = {}) {
  let history = normalizeHistoryBuckets(input);
  const stats = createQuarterlyHistoryStats();
  const operations = [];
  stats.analyses.processed += 1;
  const ticker = reportTicker(report);
  if (!ticker) {
    stats.analyses.skipped += 1;
    return { history, stats };
  }

  let bucket = history[ticker] || [];
  const reported = createReportedQuarterRecord(report, options);
  if (reported) {
    const result = upsertQuarterRecord(bucket, reported, options);
    bucket = result.records;
    operations.push(result);
    addOperationStats(stats, result);
  }

  const upcoming = createUpcomingQuarterRecord(report, options);
  if (upcoming) {
    const result = upsertQuarterRecord(bucket, upcoming, options);
    bucket = result.records;
    operations.push(result);
    addOperationStats(stats, result);
  }

  if (operations.some((item) => item.operation === "added")) stats.analyses.added += 1;
  else if (operations.some((item) => item.operation === "updated")) stats.analyses.updated += 1;
  else stats.analyses.skipped += 1;
  stats.analyses.conflicts += operations.reduce((sum, item) => sum + (item.conflictCount || 0), 0);
  history = { ...history, [ticker]: sortQuarterRecords(bucket) };
  return { history, stats };
}

export function createReportedQuarterRecord(report = {}, options = {}) {
  const identity = reportIdentity(report);
  const latestQuarter = report.latestQuarter || report.metadata?.franklinV3Report?.latestQuarter;
  if (!identity.ticker || !identity.fiscalYear || !identity.fiscalQuarter || !isObject(latestQuarter)) return null;
  const analysisDate = identity.analysisDate || report.analysisDate || null;
  const sources = cloneArray(report.sources || report.metadata?.franklinV3Report?.sources);
  const evaluation = cloneValue(
    report.previousRequirementsEvaluation
      || report.metadata?.franklinV3Report?.previousRequirementsEvaluation
      || null
  );
  const requirements = freezeRequirements(evaluation?.requirements || []);
  const requirementSetId = evaluation?.requirementSetId
    || report.metadata?.franklinV3Report?.reportIdentity?.previousRequirementSetId
    || null;

  return finalizeRecord({
    schemaVersion: QUARTERLY_HISTORY_SCHEMA_VERSION,
    id: quarterRecordId(identity),
    quarterKey: quarterKey(identity),
    ticker: identity.ticker,
    companyName: identity.companyName,
    fiscalYear: identity.fiscalYear,
    fiscalQuarter: identity.fiscalQuarter,
    periodEndDate: identity.periodEndDate,
    earningsReleaseDate: identity.earningsReleaseDate,
    analysisDate,
    status: REPORTED,
    analysisId: report.id || null,
    sourceAnalysisIds: report.id ? [report.id] : [],
    sourceSchemaVersion: report.metadata?.nativeSchemaVersion || report.schemaVersion || null,
    latestQuarter: cloneValue(latestQuarter),
    requirements,
    requirementSetId,
    requirementsMeta: requirementsMetaFromEvaluation(evaluation),
    previousRequirementsEvaluation: evaluation,
    sources,
    conflicts: [],
    updatedAt: analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || null
  }, report);
}

export function createUpcomingQuarterRecord(report = {}, options = {}) {
  const currentIdentity = reportIdentity(report);
  const next = report.nextRequirements || report.metadata?.franklinV3Report?.nextRequirements;
  const target = parseFiscalPeriod(next?.targetQuarter);
  if (!currentIdentity.ticker || !isObject(next) || !target) return null;
  const identity = {
    ticker: currentIdentity.ticker,
    companyName: currentIdentity.companyName,
    fiscalYear: target.fiscalYear,
    fiscalQuarter: target.fiscalQuarter,
    periodEndDate: null,
    earningsReleaseDate: null
  };
  const analysisDate = currentIdentity.analysisDate || report.analysisDate || null;
  const requirements = freezeRequirements(next.requirements || []);
  if (!requirements.length) return null;

  return finalizeRecord({
    schemaVersion: QUARTERLY_HISTORY_SCHEMA_VERSION,
    id: quarterRecordId(identity),
    quarterKey: quarterKey(identity),
    ticker: identity.ticker,
    companyName: identity.companyName,
    fiscalYear: identity.fiscalYear,
    fiscalQuarter: identity.fiscalQuarter,
    periodEndDate: null,
    earningsReleaseDate: null,
    analysisDate,
    status: UPCOMING,
    analysisId: report.id || null,
    sourceAnalysisIds: report.id ? [report.id] : [],
    sourceSchemaVersion: report.metadata?.nativeSchemaVersion || report.schemaVersion || null,
    latestQuarter: null,
    requirements,
    requirementSetId: next.requirementSetId || report.priceTargetRequirements?.requirementSetId || null,
    requirementsMeta: cloneValue({
      mode: next.mode ?? null,
      previousQuarter: next.previousQuarter ?? report.reportPeriod ?? null,
      targetQuarter: next.targetQuarter ?? null,
      currentJustifiedValue: next.currentJustifiedValue ?? null,
      targetValue: next.targetValue ?? null,
      targetScenario: next.targetScenario ?? null,
      targetDescription: next.targetDescription ?? null,
      summary: next.summary ?? null
    }),
    previousRequirementsEvaluation: null,
    sources: cloneArray(report.sources || report.metadata?.franklinV3Report?.sources),
    conflicts: [],
    updatedAt: analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || null
  }, report);
}

export function quarterlyHistoryForTicker(history = {}, ticker = "") {
  return sortQuarterRecords(history?.[normalizeTicker(ticker)] || []);
}

export function evaluateRequirementDeterministically(requirement = {}, actual = {}, context = {}) {
  const actualValue = actual.actualValue ?? actual.value ?? null;
  if (actualValue === null || actualValue === undefined || typeof actualValue !== "number" || !Number.isFinite(actualValue)) {
    return { evaluated: false, status: "NOT_REPORTED", reason: "MISSING_ACTUAL" };
  }
  if (String(requirement.type || "").toLowerCase() === "qualitative") {
    return { evaluated: false, status: "NOT_REPORTED", reason: "QUALITATIVE_REQUIRES_EVIDENCE" };
  }
  const dimensions = [
    ["unit", requirement.unit, actual.unit],
    ["currency", requirement.currency ?? context.currency, actual.currency ?? context.actualCurrency],
    ["accountingBasis", requirement.accountingBasis ?? context.accountingBasis, actual.accountingBasis ?? context.actualAccountingBasis],
    ["period", requirement.targetQuarter ?? context.targetQuarter, actual.period ?? context.actualPeriod]
  ];
  const mismatch = dimensions.find(([, expected, received]) => expected && received && normalizeDimension(expected) !== normalizeDimension(received));
  if (mismatch) {
    return { evaluated: false, status: "NOT_REPORTED", reason: "DIMENSION_MISMATCH", dimension: mismatch[0], expected: mismatch[1], received: mismatch[2] };
  }

  const type = String(requirement.type || "minimum").toLowerCase();
  const requiredValue = requirement.requiredValue;
  if (type === "minimum" && Number.isFinite(requiredValue)) {
    return { evaluated: true, status: actualValue >= requiredValue ? "PASSED" : "FAILED", reason: "DETERMINISTIC_MINIMUM" };
  }
  if (type === "maximum" && Number.isFinite(requiredValue)) {
    return { evaluated: true, status: actualValue <= requiredValue ? "PASSED" : "FAILED", reason: "DETERMINISTIC_MAXIMUM" };
  }
  if (type === "range") {
    const [minimum, maximum] = requirementRange(requirement);
    if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
      return { evaluated: true, status: actualValue >= minimum && actualValue <= maximum ? "PASSED" : "FAILED", reason: "DETERMINISTIC_RANGE" };
    }
  }
  return { evaluated: false, status: "NOT_REPORTED", reason: "UNSUPPORTED_REQUIREMENT_VALUE" };
}

export function parseFiscalPeriod(value) {
  const clean = String(value || "").trim().toUpperCase();
  const quarter = clean.match(/(?:^|\s)Q\s*([1-4])(?:\s|$)/i) || clean.match(/^Q([1-4])/i);
  const year = clean.match(/(?:FY\s*)?(20\d{2})/i);
  if (!quarter || !year) return null;
  return { fiscalQuarter: `Q${quarter[1]}`, fiscalYear: Number(year[1]) };
}

export function createQuarterlyHistoryStats() {
  return {
    analyses: { processed: 0, added: 0, updated: 0, skipped: 0, conflicts: 0 },
    quarters: { added: 0, updated: 0, skipped: 0, conflicts: 0 },
    sources: { added: 0, updated: 0, skipped: 0, conflicts: 0 },
    requirementSets: { added: 0, updated: 0, skipped: 0, conflicts: 0 }
  };
}

function upsertQuarterRecord(records = [], incoming, options = {}) {
  const current = records.find((item) => item.quarterKey === incoming.quarterKey);
  if (!current) {
    return {
      records: [...records, incoming],
      operation: "added",
      conflictCount: 0,
      sourcesAdded: incoming.sources.length,
      requirementSetOperation: incoming.requirementSetId ? "added" : "skipped"
    };
  }

  if (current.status === REPORTED && incoming.status === UPCOMING) {
    return {
      records,
      operation: "skipped",
      conflictCount: 0,
      sourcesAdded: 0,
      requirementSetOperation: "skipped"
    };
  }

  const merged = mergeQuarterRecords(current, incoming, options);
  if (stableStringify(merged) === stableStringify(current)) {
    return {
      records,
      operation: "skipped",
      conflictCount: 0,
      sourcesAdded: 0,
      requirementSetOperation: "skipped"
    };
  }

  const previousSourceKeys = new Set((current.sources || []).map(sourceKey));
  const sourcesAdded = (merged.sources || []).filter((source) => !previousSourceKeys.has(sourceKey(source))).length;
  const conflictCount = Math.max(0, (merged.conflicts?.length || 0) - (current.conflicts?.length || 0));
  return {
    records: records.map((item) => item.quarterKey === incoming.quarterKey ? merged : item),
    operation: "updated",
    conflictCount,
    sourcesAdded,
    requirementSetOperation: current.requirementSetId === merged.requirementSetId ? "skipped" : current.requirementSetId ? "updated" : "added"
  };
}

function mergeQuarterRecords(current, incoming, options = {}) {
  if (current.status === UPCOMING && incoming.status === REPORTED) {
    const conflicts = mergeConflictLists(current.conflicts, compareEstablishedRequirements(current, incoming, options));
    return finalizeRecord({
      ...incoming,
      requirements: current.requirements?.length ? cloneArray(current.requirements) : cloneArray(incoming.requirements),
      requirementSetId: current.requirementSetId || incoming.requirementSetId || null,
      requirementsMeta: current.requirementsMeta || incoming.requirementsMeta || null,
      sourceAnalysisIds: uniqueStrings([...(current.sourceAnalysisIds || []), ...(incoming.sourceAnalysisIds || [])]),
      sources: mergeSources(current.sources, incoming.sources),
      conflicts
    }, incoming);
  }

  const incomingPreferred = compareRecordVersions(incoming, current) >= 0;
  const preferred = incomingPreferred ? incoming : current;
  const fallback = incomingPreferred ? current : incoming;
  const conflicts = [];
  const merge = (left, right, path) => mergePreferredValue(left, right, path, conflicts, preferred, fallback, options);
  const merged = {
    ...preferred,
    companyName: merge(preferred.companyName, fallback.companyName, "companyName"),
    periodEndDate: merge(preferred.periodEndDate, fallback.periodEndDate, "periodEndDate"),
    earningsReleaseDate: merge(preferred.earningsReleaseDate, fallback.earningsReleaseDate, "earningsReleaseDate"),
    analysisDate: merge(preferred.analysisDate, fallback.analysisDate, "analysisDate"),
    latestQuarter: merge(preferred.latestQuarter, fallback.latestQuarter, "latestQuarter"),
    requirements: merge(preferred.requirements, fallback.requirements, "requirements"),
    requirementSetId: merge(preferred.requirementSetId, fallback.requirementSetId, "requirementSetId"),
    requirementsMeta: merge(preferred.requirementsMeta, fallback.requirementsMeta, "requirementsMeta"),
    previousRequirementsEvaluation: merge(preferred.previousRequirementsEvaluation, fallback.previousRequirementsEvaluation, "previousRequirementsEvaluation"),
    sourceAnalysisIds: uniqueStrings([...(current.sourceAnalysisIds || []), ...(incoming.sourceAnalysisIds || [])]),
    sources: mergeSources(current.sources, incoming.sources),
    conflicts: mergeConflictLists(current.conflicts, incoming.conflicts, conflicts)
  };
  return finalizeRecord(merged, preferred);
}

function mergePreferredValue(preferred, fallback, path, conflicts, preferredRecord, fallbackRecord, options) {
  if (preferred === null || preferred === undefined) return cloneValue(fallback);
  if (fallback === null || fallback === undefined) return cloneValue(preferred);
  if (stableStringify(preferred) === stableStringify(fallback)) return cloneValue(preferred);

  if (Array.isArray(preferred) || Array.isArray(fallback)) {
    conflicts.push(conflictEntry(path, fallback, preferred, preferredRecord, fallbackRecord, options));
    return cloneArray(preferred);
  }

  if (isObject(preferred) && isObject(fallback)) {
    const result = {};
    for (const key of [...new Set([...Object.keys(fallback), ...Object.keys(preferred)])].sort()) {
      result[key] = mergePreferredValue(preferred[key], fallback[key], `${path}.${key}`, conflicts, preferredRecord, fallbackRecord, options);
    }
    return result;
  }

  conflicts.push(conflictEntry(path, fallback, preferred, preferredRecord, fallbackRecord, options));
  return cloneValue(preferred);
}

function compareEstablishedRequirements(upcoming, reported, options) {
  const evaluated = reported.previousRequirementsEvaluation?.requirements;
  if (!Array.isArray(evaluated) || !evaluated.length) return [];
  const expected = freezeRequirements(evaluated);
  if (stableStringify(upcoming.requirements) === stableStringify(expected)) return [];
  return [conflictEntry(
    "requirements",
    expected,
    upcoming.requirements,
    upcoming,
    reported,
    options,
    "تم الحفاظ على مجموعة المتطلبات التي ثُبتت قبل إعلان النتائج."
  )];
}

function conflictEntry(path, previousValue, selectedValue, selectedRecord, otherRecord, options = {}, note = null) {
  const identity = [selectedRecord.quarterKey, path, stableStringify(previousValue), stableStringify(selectedValue)].join("|");
  return {
    id: `quarter-conflict-${stableHash(identity)}`,
    path,
    previousValue: cloneValue(previousValue),
    incomingValue: cloneValue(selectedValue),
    selectedAnalysisId: selectedRecord.analysisId || null,
    otherAnalysisId: otherRecord.analysisId || null,
    resolution: "NEWEST_ANALYSIS_WINS_WITH_AUDIT",
    note: note || "تم اختيار أحدث نسخة تحليلية مع تسجيل التعارض دون تعديل صامت.",
    detectedAt: selectedRecord.analysisDate || options.now?.toISOString?.() || null
  };
}

function finalizeRecord(record, versionSource = {}) {
  const identity = {
    ticker: record.ticker,
    fiscalYear: record.fiscalYear,
    fiscalQuarter: record.fiscalQuarter,
    periodEndDate: record.periodEndDate
  };
  const clean = {
    ...record,
    schemaVersion: QUARTERLY_HISTORY_SCHEMA_VERSION,
    id: quarterRecordId(identity),
    quarterKey: quarterKey(identity),
    ticker: normalizeTicker(record.ticker),
    fiscalYear: Number(record.fiscalYear),
    fiscalQuarter: normalizeQuarter(record.fiscalQuarter),
    status: record.status === UPCOMING ? UPCOMING : REPORTED,
    sourceAnalysisIds: uniqueStrings(record.sourceAnalysisIds),
    sources: dedupeSources(record.sources),
    conflicts: mergeConflictLists(record.conflicts)
  };
  clean.versionRank = recordVersionRank(versionSource, clean);
  return clean;
}

function reportIdentity(report = {}) {
  const native = report.metadata?.franklinV3Report || {};
  const nativeIdentity = native.reportIdentity || {};
  const fiscal = report.fiscalIdentity || {};
  const period = parseFiscalPeriod(report.reportPeriod)
    || parseFiscalPeriod(`${fiscal.fiscalQuarter || nativeIdentity.fiscalQuarter || ""} ${fiscal.fiscalYear || nativeIdentity.fiscalYear || ""}`)
    || {};
  return {
    ticker: reportTicker(report),
    companyName: report.company?.name || nativeIdentity.companyName || null,
    fiscalQuarter: normalizeQuarter(fiscal.fiscalQuarter || nativeIdentity.fiscalQuarter || period.fiscalQuarter),
    fiscalYear: Number(fiscal.fiscalYear || nativeIdentity.fiscalYear || period.fiscalYear) || null,
    periodEndDate: fiscal.periodEndDate || nativeIdentity.periodEndDate || null,
    earningsReleaseDate: fiscal.earningsReleaseDate || nativeIdentity.earningsReleaseDate || null,
    analysisDate: report.analysisDate || nativeIdentity.analysisDate || null
  };
}

function normalizeHistoryBuckets(input) {
  if (!isObject(input)) return {};
  const result = {};
  for (const [tickerKey, records] of Object.entries(input)) {
    const ticker = normalizeTicker(tickerKey);
    if (!ticker || !Array.isArray(records)) continue;
    for (const record of records) {
      if (!isObject(record)) continue;
      const period = parseFiscalPeriod(`${record.fiscalQuarter || ""} ${record.fiscalYear || ""}`);
      if (!period) continue;
      const normalized = finalizeRecord({
        ...cloneValue(record),
        ticker,
        fiscalQuarter: period.fiscalQuarter,
        fiscalYear: period.fiscalYear,
        status: record.status === UPCOMING ? UPCOMING : REPORTED,
        latestQuarter: record.status === UPCOMING ? null : cloneValue(record.latestQuarter),
        requirements: record.status === UPCOMING ? freezeRequirements(record.requirements) : cloneArray(record.requirements),
        sourceAnalysisIds: uniqueStrings(record.sourceAnalysisIds),
        sources: cloneArray(record.sources),
        conflicts: cloneArray(record.conflicts)
      }, record);
      const current = result[ticker] || [];
      const merged = upsertQuarterRecord(current, normalized).records;
      result[ticker] = merged;
    }
  }
  return sortHistoryBuckets(result);
}

function freezeRequirements(requirements = []) {
  return (Array.isArray(requirements) ? requirements : []).filter(isObject).map((requirement) => ({
    ...cloneValue(requirement),
    actualValue: null,
    actualDisplay: null,
    actualRaw: null,
    status: "NOT_REPORTED",
    partialCreditPct: null,
    evaluationNote: null,
    sourceId: null
  }));
}

function requirementsMetaFromEvaluation(evaluation) {
  if (!isObject(evaluation)) return null;
  return cloneValue({
    targetQuarter: evaluation.targetQuarter ?? evaluation.earningsPeriod ?? null,
    targetValue: evaluation.targetValue ?? null,
    targetScenario: evaluation.targetScenario ?? null,
    targetDescription: evaluation.targetDescription ?? null,
    summary: evaluation.summary ?? null,
    createdAt: evaluation.createdAt ?? null,
    createdFromAnalysisId: evaluation.createdFromAnalysisId ?? null
  });
}

function mergeSources(left = [], right = []) {
  return dedupeSources([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]);
}

function dedupeSources(sources = []) {
  const result = new Map();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!isObject(source)) continue;
    const key = sourceKey(source);
    const current = result.get(key);
    result.set(key, current ? mergeSource(current, source) : cloneValue(source));
  }
  return [...result.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

function mergeSource(current, incoming) {
  const result = { ...cloneValue(current) };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === null || value === undefined) continue;
    if (key === "usedFor" && Array.isArray(value)) {
      result.usedFor = uniqueStrings([...(Array.isArray(result.usedFor) ? result.usedFor : []), ...value]);
    } else {
      result[key] = cloneValue(value);
    }
  }
  return result;
}

function sourceKey(source = {}) {
  return String(source.id || source.url || `${source.title || "source"}|${source.date || ""}`).trim();
}

function mergeConflictLists(...lists) {
  const result = new Map();
  for (const item of lists.flatMap((list) => Array.isArray(list) ? list : [])) {
    if (!isObject(item)) continue;
    const id = item.id || `quarter-conflict-${stableHash(stableStringify(item))}`;
    if (!result.has(id)) result.set(id, { ...cloneValue(item), id });
  }
  return [...result.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function addOperationStats(stats, operation) {
  stats.quarters[operation.operation] += 1;
  stats.quarters.conflicts += operation.conflictCount || 0;
  stats.sources.added += operation.sourcesAdded || 0;
  if (!operation.sourcesAdded) stats.sources.skipped += 1;
  stats.requirementSets[operation.requirementSetOperation || "skipped"] += 1;
  if (operation.conflictCount) {
    stats.sources.conflicts += operation.conflictCount;
    stats.requirementSets.conflicts += operation.conflictCount;
  }
}

function addStats(target, source) {
  for (const group of Object.keys(target)) {
    for (const key of Object.keys(target[group])) target[group][key] += source[group]?.[key] || 0;
  }
}

function sortHistoryBuckets(history) {
  return Object.fromEntries(Object.entries(history || {})
    .filter(([, records]) => Array.isArray(records) && records.length)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ticker, records]) => [ticker, sortQuarterRecords(records)]));
}

function sortQuarterRecords(records = []) {
  return [...records].sort((left, right) => {
    const year = Number(left.fiscalYear) - Number(right.fiscalYear);
    if (year) return year;
    const quarter = quarterNumber(left.fiscalQuarter) - quarterNumber(right.fiscalQuarter);
    if (quarter) return quarter;
    return String(left.periodEndDate || "9999-12-31").localeCompare(String(right.periodEndDate || "9999-12-31"));
  });
}

function compareReportsForLifecycle(left, right) {
  const leftIdentity = reportIdentity(left);
  const rightIdentity = reportIdentity(right);
  const ticker = String(leftIdentity.ticker || "").localeCompare(String(rightIdentity.ticker || ""));
  if (ticker) return ticker;
  const year = Number(leftIdentity.fiscalYear || 0) - Number(rightIdentity.fiscalYear || 0);
  if (year) return year;
  const quarter = quarterNumber(leftIdentity.fiscalQuarter) - quarterNumber(rightIdentity.fiscalQuarter);
  if (quarter) return quarter;
  return recordVersionRank(left, left).localeCompare(recordVersionRank(right, right));
}

function compareRecordVersions(left, right) {
  return String(left.versionRank || "").localeCompare(String(right.versionRank || ""));
}

function recordVersionRank(source = {}, record = {}) {
  const date = source.analysisDate || record.analysisDate || source.metadata?.updatedAt || source.metadata?.importedAt || "";
  const id = source.analysisId || source.id || record.analysisId || "";
  const fingerprint = stableHash(stableStringify({
    latestQuarter: Object.hasOwn(record, "latestQuarter") ? record.latestQuarter : source.latestQuarter ?? null,
    requirements: Object.hasOwn(record, "requirements") ? record.requirements : source.nextRequirements?.requirements ?? null,
    evaluation: Object.hasOwn(record, "previousRequirementsEvaluation") ? record.previousRequirementsEvaluation : source.previousRequirementsEvaluation ?? null
  }));
  return `${String(date)}|${String(id)}|${fingerprint}`;
}

function quarterRecordId(identity = {}) {
  const end = String(identity.periodEndDate || "UNKNOWN_PERIOD_END").trim();
  return `${quarterKey(identity)}:${end}`;
}

function quarterKey(identity = {}) {
  return `${normalizeTicker(identity.ticker) || "TICKER"}:${Number(identity.fiscalYear) || "YEAR"}:${normalizeQuarter(identity.fiscalQuarter) || "QUARTER"}`;
}

function reportTicker(report = {}) {
  return normalizeTicker(report.company?.ticker || report.reportIdentity?.ticker || report.metadata?.franklinV3Report?.reportIdentity?.ticker);
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  return clean || null;
}

function normalizeQuarter(value) {
  const match = String(value || "").trim().toUpperCase().match(/^Q?\s*([1-4])$/);
  return match ? `Q${match[1]}` : null;
}

function quarterNumber(value) {
  return Number(normalizeQuarter(value)?.slice(1)) || 0;
}

function requirementRange(requirement = {}) {
  if (Array.isArray(requirement.requiredValue)) return [requirement.requiredValue[0], requirement.requiredValue[1]];
  if (isObject(requirement.requiredValue)) {
    return [requirement.requiredValue.minimum ?? requirement.requiredValue.min, requirement.requiredValue.maximum ?? requirement.requiredValue.max];
  }
  return [requirement.minimum ?? requirement.rangeLow, requirement.maximum ?? requirement.rangeHigh];
}

function normalizeDimension(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map(cloneValue) : [];
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function stableHash(text = "") {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
