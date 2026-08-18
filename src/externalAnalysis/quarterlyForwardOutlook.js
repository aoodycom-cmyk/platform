export const QUARTERLY_FORWARD_OUTLOOK_KIND = "quarterly_forward_outlook/v1";

const GROWTH_OUTLOOKS = new Set(["accelerating", "stable", "slowing", "unclear"]);
const MARGIN_OUTLOOKS = new Set(["improving", "stable", "pressured", "unclear"]);
const GUIDANCE_TRENDS = new Set(["raised", "maintained", "lowered", "mixed", "new", "not_reported"]);
const MANAGEMENT_TONES = new Set(["positive", "neutral", "cautious", "mixed", "unclear"]);
const THESIS_IMPACTS = new Set(["supports", "neutral", "weakens", "unclear"]);

export function normalizeQuarterlyForwardOutlook(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outlook = {
    growthOutlook: normalizeEnum(value.growthOutlook, GROWTH_OUTLOOKS, "unclear"),
    marginOutlook: normalizeEnum(value.marginOutlook, MARGIN_OUTLOOKS, "unclear"),
    guidanceTrend: normalizeEnum(value.guidanceTrend, GUIDANCE_TRENDS, "not_reported"),
    managementTone: normalizeEnum(value.managementTone, MANAGEMENT_TONES, "unclear"),
    thesisImpact: normalizeEnum(value.thesisImpact, THESIS_IMPACTS, "unclear"),
    summary: trimText(value.summary, 420)
  };
  return hasMaterialForwardOutlook(outlook) ? outlook : null;
}

export function upsertQuarterlyForwardOutlookSupplement(supplements = [], period = "", value = null) {
  const normalizedPeriod = normalizeQuarterPeriod(period);
  const normalizedOutlook = normalizeQuarterlyForwardOutlook(value);
  const existing = (Array.isArray(supplements) ? supplements : []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    return !(item.kind === QUARTERLY_FORWARD_OUTLOOK_KIND && normalizeQuarterPeriod(item.period) === normalizedPeriod);
  });
  if (!normalizedPeriod || !normalizedOutlook) return existing;
  return [
    ...existing,
    {
      kind: QUARTERLY_FORWARD_OUTLOOK_KIND,
      period: normalizedPeriod,
      ...normalizedOutlook
    }
  ];
}

export function buildQuarterlyForwardOutlookIndex(reports = [], year = null) {
  const selectedYear = Number(year);
  const index = {};
  const orderedReports = [...(Array.isArray(reports) ? reports : [])].sort((left, right) => dateValue(left) - dateValue(right));
  for (const report of orderedReports) {
    const directPeriod = normalizeQuarterPeriod(report?.reportPeriod);
    const directOutlook = normalizeQuarterlyForwardOutlook(report?.forwardOutlook);
    if (directPeriod && directOutlook && (!selectedYear || directPeriod.endsWith(String(selectedYear)))) {
      index[quarterNumber(directPeriod)] = directOutlook;
    }
    for (const supplement of Array.isArray(report?.supplements) ? report.supplements : []) {
      if (supplement?.kind !== QUARTERLY_FORWARD_OUTLOOK_KIND) continue;
      const period = normalizeQuarterPeriod(supplement.period);
      if (!period) continue;
      const parsedYear = Number(period.slice(-4));
      if (selectedYear && parsedYear !== selectedYear) continue;
      const outlook = normalizeQuarterlyForwardOutlook(supplement);
      if (outlook) index[quarterNumber(period)] = outlook;
    }
  }
  return index;
}

export function hasMaterialForwardOutlook(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    value.summary
    || value.growthOutlook && value.growthOutlook !== "unclear"
    || value.marginOutlook && value.marginOutlook !== "unclear"
    || value.guidanceTrend && value.guidanceTrend !== "not_reported"
    || value.managementTone && value.managementTone !== "unclear"
    || value.thesisImpact && value.thesisImpact !== "unclear"
  );
}

function normalizeEnum(value, allowed, fallback) {
  const clean = String(value || "").trim().toLowerCase();
  return allowed.has(clean) ? clean : fallback;
}

function normalizeQuarterPeriod(value) {
  const text = String(value || "").trim().toUpperCase();
  const quarter = text.match(/\bQ([1-4])\b/);
  const year = text.match(/(20\d{2})/);
  return quarter && year ? `Q${quarter[1]} ${year[1]}` : null;
}

function quarterNumber(period) {
  const match = String(period || "").match(/^Q([1-4])/i);
  return match ? Number(match[1]) : null;
}

function trimText(value, maxLength = 420) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function dateValue(report = {}) {
  const value = report.analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
