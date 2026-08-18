import { buildQuarterlyForwardOutlookIndex } from "./quarterlyForwardOutlook.js";

const QUARTERS = [1, 2, 3, 4];
const REQUIREMENT_STATUSES = new Set(["EXCEEDED", "PASSED", "PARTIALLY_PASSED", "FAILED", "NOT_REPORTED"]);
const SET_STATUS_PRIORITY = { EVALUATED: 5, OBSERVED: 4, OPEN: 3, SUPERSEDED: 2, CANCELLED: 1 };

export function availableQuarterlyScorecardYears(historicalRequirementSets = {}, ticker = "") {
  const normalizedTicker = normalizeTicker(ticker);
  const years = (historicalRequirementSets?.[normalizedTicker] || [])
    .map((set) => parseQuarterPeriod(set?.targetQuarter || set?.earningsPeriod))
    .filter(Boolean)
    .map((period) => period.year);
  return [...new Set(years)].sort((left, right) => right - left);
}

export function buildQuarterlyScorecard({
  historicalRequirementSets = {},
  externalAnalyses = {},
  ticker = "",
  year = null
} = {}) {
  const normalizedTicker = normalizeTicker(ticker);
  const years = availableQuarterlyScorecardYears(historicalRequirementSets, normalizedTicker);
  const reports = Array.isArray(externalAnalyses?.[normalizedTicker]) ? externalAnalyses[normalizedTicker] : [];
  const reportYears = reports.map((report) => parseQuarterPeriod(report?.reportPeriod)?.year).filter(Number.isFinite);
  const selectedYear = Number(year) || years[0] || reportYears.sort((a, b) => b - a)[0] || null;
  const sourceSets = (historicalRequirementSets?.[normalizedTicker] || [])
    .map((set) => sanitizePrematureEvaluation(set, reports))
    .map((set) => ({ set, period: parseQuarterPeriod(set?.targetQuarter || set?.earningsPeriod) }))
    .filter(({ period }) => period?.year === selectedYear);
  const observationSets = buildQuarterObservationSets(reports, selectedYear);
  const quarterSets = selectQuarterSets([...sourceSets, ...observationSets]);
  const rows = alignRequirementRows(quarterSets);
  const outlookByQuarter = buildQuarterlyForwardOutlookIndex(reports, selectedYear);
  const quarters = QUARTERS.map((quarter) => quarterSummary(quarterSets[quarter], quarter, outlookByQuarter[quarter] || null));
  const reportedQuarters = quarters.filter((item) => item.evaluated);
  const latestReportedQuarter = reportedQuarters.at(-1)?.quarter || null;
  const latestTargetSet = [...QUARTERS]
    .reverse()
    .map((quarter) => sourceSets.find((candidate) => candidate.period?.quarter === quarter)?.set)
    .find(Boolean) || null;
  const latestReport = findLatestReport(reports, selectedYear);

  return {
    ticker: normalizedTicker,
    companyName: latestReport?.company?.name || normalizedTicker,
    year: selectedYear,
    years: [...new Set([...years, ...reportYears])].sort((left, right) => right - left),
    quarters,
    rows,
    latestReportedQuarter,
    reportedQuarterCount: reportedQuarters.length,
    trajectory: storedAchievementTrajectory(reportedQuarters),
    overallStatus: reportedQuarters.at(-1)?.overallStatus || null,
    target: latestTargetSet ? {
      value: numberOrNull(latestTargetSet.targetValue ?? latestTargetSet.nextTargetValue),
      scenario: textOrNull(latestTargetSet.targetScenario),
      description: textOrNull(latestTargetSet.targetDescription || latestTargetSet.summary),
      trend: storedTargetTrend(sourceSets.map(({ set, period }) => ({
        quarter: period.quarter,
        targetValue: numberOrNull(set?.targetValue ?? set?.nextTargetValue)
      })))
    } : null,
    fairValue: latestReport ? {
      bear: numberOrNull(latestReport.fairValueSummary?.fairValueLow),
      base: numberOrNull(latestReport.fairValueSummary?.fairValueBase),
      bull: numberOrNull(latestReport.fairValueSummary?.fairValueHigh)
    } : null
  };
}

export function createQuarterlyScorecardExportModel(scorecard = {}, exportedAt = new Date()) {
  return {
    brand: "Franklin Research",
    title: "متابعة الأرباع",
    ticker: scorecard.ticker || "",
    companyName: scorecard.companyName || "",
    year: scorecard.year || null,
    target: scorecard.target ? { ...scorecard.target } : null,
    trajectory: scorecard.trajectory || null,
    overallStatus: scorecard.overallStatus || null,
    quarters: (scorecard.quarters || []).map((quarter) => ({ ...quarter })),
    rows: (scorecard.rows || []).map((row) => ({
      key: row.key,
      label: row.label,
      secondaryLabel: row.secondaryLabel,
      cells: Object.fromEntries(QUARTERS.map((quarter) => [quarter, row.cells?.[quarter] ? { ...row.cells[quarter] } : null]))
    })),
    exportedAt: validDate(exportedAt).toISOString()
  };
}

export function parseQuarterPeriod(value) {
  const text = String(value || "").trim().toUpperCase();
  const quarterMatch = text.match(/\bQ([1-4])\b/);
  const yearMatch = text.match(/(20\d{2})/);
  if (!quarterMatch || !yearMatch) return null;
  return { quarter: Number(quarterMatch[1]), year: Number(yearMatch[1]) };
}

export function normalizeRequirementAlias(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(?:fy)?20\d{2}\b/g, "")
    .replace(/\bq[1-4]\b/g, "")
    .replace(/(?:^|[_-])q[1-4](?:$|[_-])/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildQuarterObservationSets(reports = [], selectedYear) {
  return reports.map((report) => {
    const period = parseQuarterPeriod(report?.reportPeriod || report?.previousRequirementsEvaluation?.earningsPeriod);
    const evaluation = report?.previousRequirementsEvaluation;
    if (!period || period.year !== selectedYear || !Array.isArray(evaluation?.requirements) || !evaluation.requirements.length) return null;
    const hasActual = evaluation.requirements.some(hasRequirementActual);
    if (!hasActual) return null;
    return {
      period,
      set: {
        ...evaluation,
        requirementSetId: evaluation.requirementSetId || `OBS-${report.id || `${period.quarter}-${period.year}`}`,
        status: "OBSERVED",
        earningsPeriod: report.reportPeriod || evaluation.earningsPeriod || `Q${period.quarter} ${period.year}`,
        evaluatedAt: report.analysisDate || report.metadata?.updatedAt || report.metadata?.importedAt || null,
        requirementsAssessment: evaluation.requirementsAssessment || report.requirementsAssessment || null
      }
    };
  }).filter(Boolean);
}

function sanitizePrematureEvaluation(set = {}, reports = []) {
  if (set.status !== "EVALUATED" || !set.evaluatedByAnalysisId) return set;
  const target = parseQuarterPeriod(set.targetQuarter || set.earningsPeriod);
  const evaluationReport = reports.find((report) => report?.id === set.evaluatedByAnalysisId);
  const reported = parseQuarterPeriod(evaluationReport?.reportPeriod);
  if (!target || !reported || (target.quarter === reported.quarter && target.year === reported.year)) return set;
  return {
    ...set,
    status: "OPEN",
    evaluatedByAnalysisId: null,
    evaluatedAt: null,
    requirementsAssessment: null,
    requirements: (set.requirements || []).map((requirement) => ({
      ...requirement,
      actualValue: null,
      actualDisplay: null,
      actualRaw: null,
      direction: "unknown",
      impact: "unknown",
      status: "NOT_REPORTED",
      evaluationNote: null
    }))
  };
}

function selectQuarterSets(sourceSets = []) {
  const selected = {};
  for (const candidate of sourceSets) {
    const quarter = candidate.period.quarter;
    const current = selected[quarter];
    if (!current || compareSetCandidates(candidate.set, current.set) > 0) selected[quarter] = candidate;
  }
  return selected;
}

function compareSetCandidates(left = {}, right = {}) {
  const statusDifference = (SET_STATUS_PRIORITY[left.status] || 0) - (SET_STATUS_PRIORITY[right.status] || 0);
  if (statusDifference) return statusDifference;
  return dateValue(left.evaluatedAt || left.createdAt) - dateValue(right.evaluatedAt || right.createdAt);
}

function alignRequirementRows(quarterSets = {}) {
  const rows = [];
  const idRows = new Map();
  const aliasRows = new Map();

  for (const quarter of QUARTERS) {
    const set = quarterSets[quarter]?.set;
    const requirements = Array.isArray(set?.requirements) ? set.requirements : [];
    requirements.forEach((requirement, index) => {
      const stableId = normalizeStableId(requirement.id);
      const aliases = requirementAliases(requirement);
      let row = stableId ? idRows.get(stableId) : null;
      if (!row) row = aliases.map((alias) => aliasRows.get(alias)).find((candidate) => candidate && !candidate.cells[quarter]) || null;
      if (!row) {
        const fallback = aliases[0] || `requirement-${index + 1}`;
        row = {
          key: stableId ? `id:${stableId}` : `metric:${fallback}`,
          label: requirement.arabicName || requirement.name || requirement.metric || `Requirement ${index + 1}`,
          secondaryLabel: requirement.arabicName ? (requirement.name || requirement.metric || "") : "",
          aliases: new Set(aliases),
          cells: {}
        };
        rows.push(row);
      }
      if (stableId) idRows.set(stableId, row);
      aliases.forEach((alias) => {
        row.aliases.add(alias);
        if (!aliasRows.has(alias)) aliasRows.set(alias, row);
      });
      row.cells[quarter] = requirementCell(requirement, set, quarter);
    });
  }

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    secondaryLabel: row.secondaryLabel,
    cells: row.cells
  }));
}

function requirementCell(requirement = {}, set = {}, quarter) {
  const status = normalizeRequirementStatus(requirement.status);
  const hasActual = hasRequirementActual(requirement);
  return {
    quarter,
    requirementSetId: set.requirementSetId || null,
    lifecycleStatus: set.status || null,
    requiredValue: requirement.requiredValue ?? null,
    requiredDisplay: requirement.requiredDisplay || null,
    unit: requirement.unit || null,
    type: requirement.type || null,
    actualValue: requirement.actualValue ?? null,
    actualDisplay: requirement.actualDisplay || null,
    actualRaw: requirement.actualRaw ?? null,
    status,
    direction: requirement.direction || "unknown",
    impact: requirement.impact || "unknown",
    evaluationNote: requirement.evaluationNote || null,
    weight: numberOrNull(requirement.weight),
    reported: hasActual || (set.status === "EVALUATED" && status !== "NOT_REPORTED"),
    observation: set.status === "OBSERVED"
  };
}

function quarterSummary(candidate, quarter, outlook = null) {
  const set = candidate?.set;
  const assessment = set?.requirementsAssessment;
  const weightedAchievement = numberOrNull(assessment?.weightedAchievement);
  const hasReportedRequirement = (set?.requirements || []).some((requirement) => hasRequirementActual(requirement) || normalizeRequirementStatus(requirement?.status) !== "NOT_REPORTED");
  const evaluated = ["EVALUATED", "OBSERVED"].includes(set?.status) && (hasReportedRequirement || Number.isFinite(weightedAchievement));
  return {
    quarter,
    label: `Q${quarter}`,
    lifecycleStatus: set?.status || null,
    evaluated,
    weightedAchievement,
    overallStatus: textOrNull(assessment?.overallStatus),
    summary: textOrNull(assessment?.summary),
    targetValue: numberOrNull(set?.targetValue ?? set?.nextTargetValue),
    targetScenario: textOrNull(set?.targetScenario),
    requirementSetId: set?.requirementSetId || null,
    outlook
  };
}

function storedAchievementTrajectory(reportedQuarters = []) {
  const values = reportedQuarters.map((quarter) => quarter.weightedAchievement).filter(Number.isFinite);
  if (values.length < 2) return null;
  const first = values[0];
  const last = values.at(-1);
  if (last > first) return "improving";
  if (last < first) return "weakening";
  return "stable";
}

function storedTargetTrend(quarters = []) {
  const values = [...quarters]
    .sort((left, right) => (left.quarter || 0) - (right.quarter || 0))
    .map((quarter) => quarter.targetValue)
    .filter(Number.isFinite);
  if (values.length < 2) return null;
  if (values.at(-1) > values[0]) return "up";
  if (values.at(-1) < values[0]) return "down";
  return "flat";
}

function requirementAliases(requirement = {}) {
  return [...new Set([
    requirement.metric,
    requirement.name,
    requirement.arabicName,
    stripQuarterSuffix(requirement.id)
  ].map(normalizeRequirementAlias).filter(Boolean))];
}

function hasRequirementActual(requirement = {}) {
  return requirement.actualValue !== null && requirement.actualValue !== undefined
    || Boolean(textOrNull(requirement.actualDisplay))
    || requirement.actualRaw !== null && requirement.actualRaw !== undefined;
}

function normalizeStableId(value) {
  return String(value || "").trim().toLowerCase() || null;
}

function stripQuarterSuffix(value) {
  return String(value || "").replace(/(?:[_-](?:q[1-4]|fy?20\d{2}))+$/gi, "");
}

function normalizeRequirementStatus(value) {
  const status = String(value || "NOT_REPORTED").trim().toUpperCase();
  return REQUIREMENT_STATUSES.has(status) ? status : "NOT_REPORTED";
}

function findLatestReport(reports = [], year) {
  const inYear = reports.filter((report) => reportYear(report) === year);
  return [...(inYear.length ? inYear : reports)].sort((left, right) => dateValue(right.analysisDate) - dateValue(left.analysisDate))[0] || null;
}

function reportYear(report = {}) {
  const period = parseQuarterPeriod(report.reportPeriod);
  if (period) return period.year;
  const year = Number(String(report.analysisDate || "").slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function textOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}
