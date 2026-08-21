import { normalizedEarningsPeriod } from "./historicalRequirements.js";

export function parseEarningsPeriod(value) {
  const match = String(value || "").trim().toUpperCase().match(/^Q\s*([1-4])\s+(\d{4})$/);
  if (!match) return null;
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  return { quarter, year, reportPeriod: `Q${quarter} ${year}` };
}

export function earningsPeriodFromOptions(options = {}) {
  return parseEarningsPeriod(options.reportPeriod)
    || parseEarningsPeriod(`Q${options.quarter || ""} ${options.year || ""}`);
}

export function resolveEarningsPeriodSelection(report = {}, options = {}) {
  const explicit = earningsPeriodFromOptions(options);
  if (explicit) return explicit;

  const requirements = report?.priceTargetRequirements || {};
  const expected = parseEarningsPeriod(requirements.targetQuarter || requirements.earningsPeriod);
  if (expected) return expected;

  const current = parseEarningsPeriod(report?.reportPeriod);
  if (!current) return { quarter: null, year: null, reportPeriod: "" };
  const quarter = current.quarter === 4 ? 1 : current.quarter + 1;
  const year = current.quarter === 4 ? current.year + 1 : current.year;
  return { quarter, year, reportPeriod: `Q${quarter} ${year}` };
}

export function earningsPeriodMatches(actualPeriod, expectedPeriod) {
  if (!expectedPeriod) return true;
  return normalizedEarningsPeriod(actualPeriod) === normalizedEarningsPeriod(expectedPeriod);
}
