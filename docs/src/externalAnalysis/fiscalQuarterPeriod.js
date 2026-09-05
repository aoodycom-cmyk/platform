export const FRANKLIN_FISCAL_QUARTER_FORMAT = "Q{1-4} YYYY";

const MIN_FISCAL_YEAR = 1000;
const MAX_FISCAL_YEAR = 9999;

export function parseFiscalQuarterPeriod(value) {
  const text = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!text) return null;

  const quarterFirst = text.match(/^Q\s*([1-4])(?:\s*[-/]\s*|\s+)(?:FY\s*)?(\d{4})$/);
  const yearFirst = text.match(/^(?:FY\s*)?(\d{4})(?:\s*[-/]\s*|\s+)Q\s*([1-4])$/);
  const quarter = Number(quarterFirst?.[1] || yearFirst?.[2]);
  const year = Number(quarterFirst?.[2] || yearFirst?.[1]);
  if (!Number.isInteger(quarter) || !Number.isInteger(year) || year < MIN_FISCAL_YEAR || year > MAX_FISCAL_YEAR) {
    return null;
  }

  return {
    quarter,
    year,
    fiscalQuarter: `Q${quarter}`,
    fiscalYear: year,
    reportPeriod: `Q${quarter} ${year}`
  };
}

export function fiscalQuarterPeriodFromParts(fiscalQuarter, fiscalYear) {
  const quarterMatch = String(fiscalQuarter ?? "").trim().toUpperCase().match(/^Q?\s*([1-4])$/);
  const yearText = String(fiscalYear ?? "").trim();
  if (!quarterMatch || !/^\d{4}$/.test(yearText)) return null;
  return parseFiscalQuarterPeriod(`Q${quarterMatch[1]} ${yearText}`)?.reportPeriod || null;
}

export function normalizeFiscalQuarterPeriod(value) {
  return parseFiscalQuarterPeriod(value)?.reportPeriod || null;
}

export function normalizeFiscalQuarterPeriodOrOriginal(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return normalizeFiscalQuarterPeriod(text) || text;
}

export function isCanonicalFiscalQuarterPeriod(value) {
  if (typeof value !== "string" || value !== value.trim()) return false;
  return /^Q[1-4] \d{4}$/.test(value) && normalizeFiscalQuarterPeriod(value) === value;
}

export function nextFiscalQuarterPeriod(value) {
  const period = parseFiscalQuarterPeriod(value);
  if (!period) return null;
  return fiscalQuarterPeriodFromParts(
    period.quarter === 4 ? 1 : period.quarter + 1,
    period.quarter === 4 ? period.year + 1 : period.year
  );
}

export function fiscalQuarterPeriodKey(value) {
  return normalizeFiscalQuarterPeriod(value)?.replace(" ", "") || null;
}

export function fiscalQuarterPeriodsEqual(left, right) {
  const leftPeriod = normalizeFiscalQuarterPeriod(left);
  const rightPeriod = normalizeFiscalQuarterPeriod(right);
  return Boolean(leftPeriod && rightPeriod && leftPeriod === rightPeriod);
}
