import {
  fiscalQuarterPeriodsEqual,
  nextFiscalQuarterPeriod,
  parseFiscalQuarterPeriod
} from "./fiscalQuarterPeriod.js";

export function parseEarningsPeriod(value) {
  const period = parseFiscalQuarterPeriod(value);
  if (!period) return null;
  return { quarter: period.quarter, year: period.year, reportPeriod: period.reportPeriod };
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
  return parseEarningsPeriod(nextFiscalQuarterPeriod(current.reportPeriod));
}

export function earningsPeriodMatches(actualPeriod, expectedPeriod) {
  if (!expectedPeriod) return true;
  return fiscalQuarterPeriodsEqual(actualPeriod, expectedPeriod);
}
