export const QUARTERLY_EARNINGS_DIGEST_KIND = "quarterly_earnings_digest/v1";
const LITE_SCHEMA = "quarterly-earnings-lite/v1";
const RESULT_VALUES = new Set(["BEAT", "MISS", "INLINE", "NA"]);
const METRIC_KEYS = [
  "revenue",
  "revenueGrowthPct",
  "eps",
  "grossMarginPct",
  "operatingMarginPct",
  "freeCashFlow",
  "cash",
  "debt"
];

export function normalizeQuarterlyEarningsDigest(value = {}, periodHint = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const period = normalizeQuarterPeriod(periodHint || periodFromPayload(value) || value.period);
  if (!period) return null;
  const metrics = {};
  for (const key of METRIC_KEYS) metrics[key] = normalizeMetric(value.metrics?.[key]);
  const digest = {
    kind: QUARTERLY_EARNINGS_DIGEST_KIND,
    period,
    reportDate: validDate(value.reportDate),
    summary: trimText(value.summary, 420),
    metrics,
    companyKpis: normalizeKpis(value.companyKpis).slice(0, 4),
    guidance: normalizeGuidance(value.guidance).slice(0, 3),
    highlights: normalizeStrings(value.highlights, 3, 220),
    concerns: normalizeStrings(value.concerns, 2, 220)
  };
  return hasMaterialDigest(digest) ? digest : null;
}

export function upsertQuarterlyEarningsDigestSupplement(supplements = [], period = "", payload = {}) {
  const digest = normalizeQuarterlyEarningsDigest(payload, period);
  const normalizedPeriod = normalizeQuarterPeriod(period);
  const existing = (Array.isArray(supplements) ? supplements : []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    return !(item.kind === QUARTERLY_EARNINGS_DIGEST_KIND && normalizeQuarterPeriod(item.period) === normalizedPeriod);
  });
  return digest ? [...existing, digest] : existing;
}

export function buildQuarterlyEarningsDigestIndex(reports = [], year = null) {
  const selectedYear = Number(year);
  const index = {};
  const orderedReports = [...(Array.isArray(reports) ? reports : [])].sort((left, right) => dateValue(left) - dateValue(right));
  for (const report of orderedReports) {
    for (const supplement of Array.isArray(report?.supplements) ? report.supplements : []) {
      if (supplement?.kind !== QUARTERLY_EARNINGS_DIGEST_KIND) continue;
      const digest = normalizeQuarterlyEarningsDigest(supplement, supplement.period);
      storeDigest(index, digest, selectedYear);
    }
    const rawPayload = parseLitePayload(report?.rawAnalysisOriginal) || parseLitePayload(report?.rawAnalysis);
    if (rawPayload) {
      const digest = normalizeQuarterlyEarningsDigest(rawPayload, report?.reportPeriod || periodFromPayload(rawPayload));
      storeDigest(index, digest, selectedYear);
    }
  }
  return index;
}

function storeDigest(index, digest, selectedYear) {
  if (!digest) return;
  const period = normalizeQuarterPeriod(digest.period);
  if (!period) return;
  const parsedYear = Number(period.slice(-4));
  if (selectedYear && parsedYear !== selectedYear) return;
  const match = period.match(/^Q([1-4])/i);
  if (match) index[Number(match[1])] = digest;
}

function normalizeMetric(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value: null, display: null, consensusDisplay: null, result: "NA" };
  }
  const result = String(value.result || "NA").trim().toUpperCase();
  return {
    value: Number.isFinite(value.value) ? value.value : null,
    display: trimText(value.display, 100),
    consensusDisplay: trimText(value.consensusDisplay, 100),
    result: RESULT_VALUES.has(result) ? result : "NA"
  };
}

function normalizeKpis(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: trimText(item?.name, 100),
    actualDisplay: trimText(item?.actualDisplay, 120),
    result: normalizeResult(item?.result)
  })).filter((item) => item.name || item.actualDisplay);
}

function normalizeGuidance(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    topic: trimText(item?.topic, 90),
    currentGuidance: trimText(item?.currentGuidance, 150),
    direction: trimText(item?.direction, 30),
    interpretation: trimText(item?.interpretation, 220)
  })).filter((item) => item.topic || item.currentGuidance || item.interpretation);
}

function normalizeResult(value) {
  const result = String(value || "NA").trim().toUpperCase();
  return RESULT_VALUES.has(result) ? result : "NA";
}

function hasMaterialDigest(digest = {}) {
  return Boolean(
    digest.summary
    || Object.values(digest.metrics || {}).some((item) => item?.display || Number.isFinite(item?.value))
    || digest.companyKpis?.length
    || digest.guidance?.length
    || digest.highlights?.length
    || digest.concerns?.length
  );
}

function parseLitePayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    return payload?.schemaVersion === LITE_SCHEMA ? payload : null;
  } catch {
    return null;
  }
}

function periodFromPayload(payload = {}) {
  const quarter = String(payload.quarter || "").trim().toUpperCase();
  const year = Number(payload.year);
  return /^Q[1-4]$/.test(quarter) && Number.isInteger(year) ? `${quarter} ${year}` : null;
}

function normalizeQuarterPeriod(value) {
  const text = String(value || "").trim().toUpperCase();
  const quarter = text.match(/\bQ([1-4])\b/);
  const year = text.match(/(20\d{2})/);
  return quarter && year ? `Q${quarter[1]} ${year[1]}` : null;
}

function normalizeStrings(items, max, maxLength) {
  return (Array.isArray(items) ? items : []).map((item) => trimText(item, maxLength)).filter(Boolean).slice(0, max);
}

function validDate(value) {
  const text = String(value || "").trim();
  if (!text || Number.isNaN(new Date(text).getTime())) return null;
  return text.slice(0, 10);
}

function trimText(value, maxLength = 220) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function dateValue(report = {}) {
  const value = report.analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
