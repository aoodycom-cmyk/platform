import {
  normalizePriceTargetRequirements,
  normalizeRequirementList,
  normalizeRequirementsAssessment
} from "./requirements.js";

export const REQUIREMENT_SET_STATUSES = ["OPEN", "EVALUATED", "SUPERSEDED", "CANCELLED"];

export function normalizeHistoricalRequirementSets(input = {}, externalAnalyses = {}) {
  const result = {};
  const add = (set) => {
    const normalized = normalizeRequirementSet(set);
    if (!normalized?.ticker || !normalized.requirementSetId) return;
    const current = result[normalized.ticker] || [];
    if (!current.some((item) => item.requirementSetId === normalized.requirementSetId)) {
      current.push(normalized);
      result[normalized.ticker] = current;
    }
  };

  if (Array.isArray(input)) {
    input.forEach(add);
  } else if (input && typeof input === "object") {
    for (const [ticker, sets] of Object.entries(input)) {
      if (Array.isArray(sets)) {
        sets.forEach((set) => add({ ...set, ticker: set?.ticker || ticker }));
      }
    }
  }

  for (const reports of Object.values(externalAnalyses || {})) {
    if (!Array.isArray(reports)) continue;
    reports.forEach((report) => {
      const set = createRequirementSetFromReport(report);
      if (set) add(set);
    });
  }

  return Object.fromEntries(Object.entries(result).map(([ticker, sets]) => [
    ticker,
    sets.sort(compareRequirementSetsDesc)
  ]));
}

export function createRequirementSetFromReport(report = {}, now = new Date()) {
  if (isQuarterlyEarningsLiteReport(report)) return null;
  const block = normalizePriceTargetRequirements(report.priceTargetRequirements);
  if (!block.requirements.length) return null;
  const ticker = normalizeTicker(report.company?.ticker || report.ticker);
  if (!ticker) return null;
  const createdAt = block.createdAt || report.metadata?.importedAt || dateToIso(report.analysisDate, now);
  const status = normalizeRequirementSetStatus(block.status)
    || inferRequirementSetStatus(block.requirements);
  const requirementSetId = block.requirementSetId
    || createRequirementSetId({
      ticker,
      earningsPeriod: block.earningsPeriod || report.reportPeriod,
      createdAt,
      createdFromAnalysisId: block.createdFromAnalysisId || report.id
    });

  return {
    requirementSetId,
    ticker,
    createdAt,
    createdFromAnalysisId: block.createdFromAnalysisId || report.id || null,
    earningsPeriod: block.earningsPeriod || report.reportPeriod || null,
    previousQuarter: block.previousQuarter || null,
    targetQuarter: block.targetQuarter || block.earningsPeriod || report.reportPeriod || null,
    currentJustifiedValue: block.currentJustifiedValue,
    targetValue: block.targetValue,
    nextTargetValue: block.nextTargetValue || block.targetValue,
    targetScenario: block.targetScenario,
    targetDescription: block.targetDescription,
    mode: block.mode || null,
    summary: block.summary,
    status,
    evaluatedByAnalysisId: block.evaluatedByAnalysisId || null,
    evaluatedAt: block.evaluatedAt || null,
    requirements: freezeRequirementSetRequirements(block.requirements, status),
    requirementsAssessment: status === "EVALUATED"
      ? normalizeRequirementsAssessment(block.requirementsAssessment || {})
      : null
  };
}

export function prepareHistoricalRequirementEvaluation(report = {}, requirementSets = {}, options = {}) {
  const match = findRequirementSetMatch(report, requirementSets, options);
  if (!match.set) return { report, match };
  const previousRequirementsEvaluation = buildRequirementEvaluation(match.set, report, match);
  return {
    report: {
      ...report,
      previousRequirementsEvaluation,
      requirementsAssessment: previousRequirementsEvaluation.requirementsAssessment || report.requirementsAssessment
    },
    match: {
      ...match,
      evaluationPreview: previousRequirementsEvaluation
    }
  };
}

export function applyHistoricalRequirementLifecycle(collection = {}, report = {}, match = {}, now = new Date()) {
  let next = normalizeHistoricalRequirementSets(collection);
  const canMutateCanonicalLifecycle = !isQuarterlyEarningsLiteReport(report);
  const evaluation = report.previousRequirementsEvaluation;
  const matchedOpenSet = match?.status === "matched" && match?.set?.status === "OPEN"
    ? match.set
    : null;
  const evaluationMatchesOpenSet = Boolean(
    matchedOpenSet
    && evaluation?.requirementSetId
    && matchedOpenSet.requirementSetId === evaluation.requirementSetId
  );

  // A report may carry an old or malformed evaluation block. Never let that
  // block overwrite an already-closed set unless this import matched the open
  // set during the current save flow and the report period reaches the target.
  if (
    canMutateCanonicalLifecycle
    && isCanonicalV3EarningsRevaluation(report)
    && evaluationMatchesOpenSet
    && hasExplicitPreviousRequirementEvaluation(evaluation)
    && evaluationReachesTarget(evaluation, report)
  ) {
    next = markRequirementSetEvaluated(next, evaluation, report, now);
  }

  const nextSet = canMutateCanonicalLifecycle ? createRequirementSetFromReport(report, now) : null;
  if (nextSet && !isSameSetAsPreviousEvaluation(nextSet, evaluation)) {
    next = upsertRequirementSet(next, nextSet);
    if (nextSet.supersedesRequirementSetId) {
      next = markRequirementSetStatus(next, nextSet.supersedesRequirementSetId, "SUPERSEDED");
    }
  }
  return next;
}

export function attachRequirementSetIdentityToReport(report = {}, now = new Date()) {
  const set = createRequirementSetFromReport(report, now);
  if (!set) return report;
  return {
    ...report,
    priceTargetRequirements: {
      ...(report.priceTargetRequirements || {}),
      requirementSetId: set.requirementSetId,
      status: set.status,
      createdAt: report.priceTargetRequirements?.createdAt || set.createdAt,
      createdFromAnalysisId: report.priceTargetRequirements?.createdFromAnalysisId || report.id || null
    }
  };
}

export function findRequirementSetMatch(report = {}, requirementSets = {}, options = {}) {
  const ticker = normalizeTicker(report.company?.ticker || report.ticker);
  if (!ticker) return { status: "none", reason: "missing_ticker", candidates: [] };
  const openSets = (requirementSets[ticker] || []).filter((set) => set.status === "OPEN");
  if (!openSets.length) return { status: "none", reason: "no_open_sets", candidates: [] };

  const selected = options.selectedRequirementSetId
    ? openSets.find((set) => set.requirementSetId === options.selectedRequirementSetId)
    : null;
  if (selected) return matched(selected, "user_selected");

  if (isCanonicalV3EarningsRevaluation(report)) {
    const explicitId = extractExplicitRequirementSetId(report);
    if (explicitId) {
      const explicit = openSets.find((set) => set.requirementSetId === explicitId);
      if (!explicit) return { status: "none", reason: "explicit_requirement_set_not_open", candidates: [] };
      const reportedPeriod = normalizedEarningsPeriod(extractReportedEarningsPeriod(report));
      const targetPeriod = normalizedEarningsPeriod(explicit.targetQuarter || explicit.earningsPeriod);
      if (reportedPeriod && targetPeriod && reportedPeriod !== targetPeriod) {
        return { status: "none", reason: "explicit_requirement_set_period_mismatch", candidates: [explicit] };
      }
      return matched(explicit, "canonical_explicit_requirement_set_id");
    }
  }

  const reportedPeriod = normalizedEarningsPeriod(extractReportedEarningsPeriod(report));
  if (reportedPeriod) {
    const exact = openSets.filter((set) => normalizedEarningsPeriod(set.earningsPeriod) === reportedPeriod);
    if (exact.length === 1) return matched(exact[0], "exact_earnings_period");
    if (exact.length > 1) return ambiguous(exact, "multiple_exact_earnings_period");
  }

  const explicitId = extractExplicitRequirementSetId(report);
  if (explicitId) {
    const explicit = openSets.find((set) => set.requirementSetId === explicitId);
    if (explicit) return matched(explicit, "explicit_requirement_set_id");
  }

  if (openSets.length === 1) return matched(openSets[0], "single_open_suggested");
  return ambiguous(openSets, "multiple_open_sets");
}

export function buildRequirementEvaluation(requirementSet = {}, report = {}, match = {}) {
  const actualItems = extractActualRequirementResults(report, requirementSet);
  const exactIdOnly = isCanonicalV3EarningsRevaluation(report);
  const requirements = (requirementSet.requirements || []).map((requirement) => {
    const actual = findActualForRequirement(requirement, actualItems, { exactIdOnly });
    const actualValue = actualValueFrom(actual);
    const actualDisplay = actual?.actualDisplay ?? actual?.displayValue ?? actual?.reportedDisplay ?? null;
    const actualRaw = actual?.actualRaw ?? actual?.raw ?? actual?.commentary ?? null;
    const status = actual ? normalizeRequirementStatus(actual.status) || "NOT_REPORTED" : "NOT_REPORTED";
    return {
      ...requirement,
      actualValue,
      actualDisplay,
      actualRaw,
      direction: actual?.direction || "unknown",
      impact: actual?.impact || "unknown",
      status,
      partialCreditPct: actual?.partialCreditPct ?? null,
      evaluationNote: actual?.evaluationNote || actual?.note || null,
      sourceId: actual?.sourceId || null
    };
  });
  const supplied = report.previousRequirementsEvaluation?.requirementsAssessment || report.requirementsAssessment || {};
  const requirementsAssessment = normalizeRequirementsAssessment(supplied);
  const reportedEarningsPeriod = extractReportedEarningsPeriod(report) || requirementSet.earningsPeriod;
  return {
    requirementSetId: requirementSet.requirementSetId,
    ticker: requirementSet.ticker,
    earningsPeriod: reportedEarningsPeriod,
    previousQuarter: requirementSet.previousQuarter || null,
    targetQuarter: requirementSet.targetQuarter || requirementSet.earningsPeriod || null,
    createdAt: requirementSet.createdAt,
    createdFromAnalysisId: requirementSet.createdFromAnalysisId,
    targetValue: requirementSet.targetValue,
    targetScenario: requirementSet.targetScenario,
    targetDescription: requirementSet.targetDescription,
    summary: requirementSet.summary,
    matchType: match.matchType || null,
    requirements,
    requirementsAssessment
  };
}

export function normalizedEarningsPeriod(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function markRequirementSetEvaluated(collection, evaluation, report, now) {
  const ticker = normalizeTicker(evaluation.ticker || report.company?.ticker);
  if (!ticker) return collection;
  const sets = collection[ticker] || [];
  return {
    ...collection,
    [ticker]: sets.map((set) => {
      if (set.requirementSetId !== evaluation.requirementSetId || set.status !== "OPEN") return set;
      return {
        ...set,
        status: "EVALUATED",
        evaluatedByAnalysisId: report.id || null,
        evaluatedAt: now.toISOString(),
        requirements: mergeEvaluatedRequirements(set.requirements, evaluation.requirements),
        requirementsAssessment: evaluation.requirementsAssessment || null
      };
    })
  };
}

function markRequirementSetStatus(collection, requirementSetId, status) {
  const normalizedStatus = normalizeRequirementSetStatus(status);
  if (!requirementSetId || !normalizedStatus) return collection;
  return Object.fromEntries(Object.entries(collection || {}).map(([ticker, sets]) => [
    ticker,
    (sets || []).map((set) => set.requirementSetId === requirementSetId ? { ...set, status: normalizedStatus } : set)
  ]));
}

function upsertRequirementSet(collection, set) {
  const ticker = set.ticker;
  const current = collection[ticker] || [];
  const exists = current.some((item) => item.requirementSetId === set.requirementSetId);
  const next = exists ? current : [set, ...current];
  return {
    ...collection,
    [ticker]: next.sort(compareRequirementSetsDesc)
  };
}

function normalizeRequirementSet(input = {}) {
  if (!input || typeof input !== "object") return null;
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) return null;
  const requirements = normalizeRequirementList(input.requirements);
  const status = normalizeRequirementSetStatus(input.status) || inferRequirementSetStatus(requirements);
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    requirementSetId: input.requirementSetId || createRequirementSetId({
      ticker,
      earningsPeriod: input.earningsPeriod,
      createdAt,
      createdFromAnalysisId: input.createdFromAnalysisId
    }),
    ticker,
    createdAt,
    createdFromAnalysisId: input.createdFromAnalysisId || null,
    earningsPeriod: input.earningsPeriod || null,
    previousQuarter: textOrNull(input.previousQuarter),
    targetQuarter: textOrNull(input.targetQuarter || input.earningsPeriod),
    currentJustifiedValue: numberOrNull(input.currentJustifiedValue),
    targetValue: numberOrNull(input.targetValue),
    nextTargetValue: numberOrNull(input.nextTargetValue ?? input.targetValue),
    targetScenario: textOrNull(input.targetScenario),
    targetDescription: textOrNull(input.targetDescription),
    mode: textOrNull(input.mode),
    summary: textOrNull(input.summary),
    status,
    evaluatedByAnalysisId: input.evaluatedByAnalysisId || null,
    evaluatedAt: input.evaluatedAt || null,
    requirements,
    requirementsAssessment: input.requirementsAssessment || null,
    supersedesRequirementSetId: input.supersedesRequirementSetId || null
  };
}

function freezeRequirementSetRequirements(requirements = [], status = "OPEN") {
  return requirements.map((requirement) => {
    if (status === "OPEN") {
      return {
        ...requirement,
        actualValue: null,
        actualDisplay: null,
        actualRaw: null,
        direction: "unknown",
        impact: "unknown",
        status: "NOT_REPORTED",
        partialCreditPct: null,
        evaluationNote: null,
        sourceId: null
      };
    }
    return requirement;
  });
}

function mergeEvaluatedRequirements(original = [], evaluated = []) {
  return original.map((requirement) => {
    const result = findActualForRequirement(requirement, evaluated);
    if (!result) return requirement;
    return {
      ...requirement,
      actualValue: result.actualValue,
      actualDisplay: result.actualDisplay || null,
      actualRaw: result.actualRaw,
      direction: result.direction || "unknown",
      impact: result.impact || "unknown",
      status: result.status,
      partialCreditPct: result.partialCreditPct ?? null,
      evaluationNote: result.evaluationNote || null,
      sourceId: result.sourceId || null
    };
  });
}

function extractActualRequirementResults(report = {}, requirementSet = {}) {
  const direct = report.previousRequirementsEvaluation?.requirements
    || report.requirementResults
    || report.requirementsResults
    || report.earningsRequirementResults
    || report.priceTargetRequirementResults;
  if (Array.isArray(direct)) return direct;

  const block = report.priceTargetRequirements || {};
  const blockPeriodMatches = normalizedEarningsPeriod(block.earningsPeriod) === normalizedEarningsPeriod(requirementSet.earningsPeriod);
  const blockIdMatches = block.requirementSetId && block.requirementSetId === requirementSet.requirementSetId;
  if ((blockPeriodMatches || blockIdMatches) && Array.isArray(block.requirements)) return block.requirements;
  return [];
}

function findActualForRequirement(requirement = {}, actualItems = [], options = {}) {
  if (options.exactIdOnly) {
    const id = String(requirement?.id || "").trim();
    if (!id) return null;
    return (actualItems || []).find((item) => String(item?.id || "").trim() === id) || null;
  }
  const keys = requirementKeys(requirement);
  return (actualItems || []).find((item) => {
    const actualKeys = requirementKeys(item);
    return actualKeys.some((key) => keys.includes(key));
  }) || null;
}

function requirementKeys(item = {}) {
  return [item.id, item.metric, item.name, item.arabicName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function actualValueFrom(actual = {}) {
  if (!actual) return null;
  return actual.actualValue ?? actual.value ?? actual.currentValue ?? actual.reportedValue ?? null;
}

function hasExplicitPreviousRequirementEvaluation(evaluation = {}) {
  if (!evaluation?.requirementSetId) return false;
  if (Array.isArray(evaluation.requirements) && evaluation.requirements.length) return true;
  return Boolean(evaluation.requirementsAssessment);
}

function evaluationReachesTarget(evaluation = {}, report = {}) {
  const target = normalizedEarningsPeriod(evaluation.targetQuarter);
  const reportPeriod = normalizedEarningsPeriod(
    report.reportPeriod || report.reportedEarningsPeriod || report.earningsPeriod
  );
  const evaluationPeriod = normalizedEarningsPeriod(evaluation.earningsPeriod);

  // A payload must not be allowed to claim Q2 inside its evaluation block while
  // the report itself is explicitly Q1. The report-level period is authoritative.
  if (reportPeriod && evaluationPeriod && reportPeriod !== evaluationPeriod) return false;
  const reported = reportPeriod || evaluationPeriod;
  if (!reported) return false;
  return target ? reported === target : true;
}

function isQuarterlyEarningsLiteReport(report = {}) {
  return report?.metadata?.importMethod === "quarterly_earnings_lite"
    || report?.metadata?.analysisScope === "quarterly_earnings_update"
    || report?.previousRequirementsEvaluation?.matchType === "quarterly_earnings_lite";
}

function isCanonicalV3EarningsRevaluation(report = {}) {
  const metadata = report?.metadata || {};
  const canonical = metadata.franklinV3Report;
  return metadata.nativeSchemaVersion === "franklin-fair-value/v3"
    && metadata.franklinV3?.analysisType === "EARNINGS_REVALUATION"
    && canonical?.schemaVersion === "franklin-fair-value/v3"
    && canonical?.analysisType === "EARNINGS_REVALUATION";
}

function isSameSetAsPreviousEvaluation(set, evaluation) {
  if (!set || !evaluation) return false;
  if (set.requirementSetId && set.requirementSetId === evaluation.requirementSetId) return true;
  return normalizedEarningsPeriod(set.earningsPeriod) === normalizedEarningsPeriod(evaluation.earningsPeriod)
    && normalizeTicker(set.ticker) === normalizeTicker(evaluation.ticker);
}

function extractReportedEarningsPeriod(report = {}) {
  return report.reportPeriod
    || report.reportedEarningsPeriod
    || report.earningsPeriod
    || report.previousRequirementsEvaluation?.earningsPeriod
    || null;
}

function extractExplicitRequirementSetId(report = {}) {
  return report.previousRequirementsEvaluation?.requirementSetId
    || report.requirementsEvaluation?.requirementSetId
    || report.evaluatesRequirementSetId
    || report.requirementSetId
    || report.metadata?.requirementSetId
    || null;
}

function matched(set, matchType) {
  return { status: "matched", matchType, set, candidates: [set], reason: null };
}

function ambiguous(candidates, reason) {
  return { status: "ambiguous", matchType: null, set: null, candidates, reason };
}

function inferRequirementSetStatus(requirements = []) {
  return requirements.some((item) => item.status !== "NOT_REPORTED" || item.actualValue !== null || item.actualRaw !== null)
    ? "EVALUATED"
    : "OPEN";
}

function normalizeRequirementSetStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  return REQUIREMENT_SET_STATUSES.includes(clean) ? clean : null;
}

function normalizeRequirementStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  return ["NOT_REPORTED", "PASSED", "PARTIALLY_PASSED", "FAILED", "EXCEEDED"].includes(clean) ? clean : null;
}

function createRequirementSetId({ ticker, earningsPeriod, createdAt, createdFromAnalysisId }) {
  const period = normalizedEarningsPeriod(earningsPeriod) || "PERIOD";
  const date = String(createdAt || "").slice(0, 10).replace(/[^0-9]/g, "") || "DATE";
  const hash = stableHash([ticker, period, createdAt, createdFromAnalysisId].join("|")).slice(0, 6);
  return `${normalizeTicker(ticker) || "TICKER"}_${period}_${date}_${hash}`;
}

function compareRequirementSetsDesc(a, b) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function dateToIso(value, fallback) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return fallback.toISOString();
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[%,$\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim();
  return clean || null;
}

function stableHash(text = "") {
  let hash = 2166136261;
  const clean = String(text);
  for (let index = 0; index < clean.length; index += 1) {
    hash ^= clean.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
