import { normalizeExternalAnalysesCollection } from "./storage.js";
import { migrateFranklinState, summarizeFranklinState } from "../state/migration.js";

export const FRANKLIN_BACKUP_SCHEMA_VERSION = "franklin-investment-backup/v1";

const RESTORABLE_KEYS = [
  "company",
  "manualInputs",
  "language",
  "theme",
  "evaluatedSort",
  "rankingFilter",
  "sectorFilter",
  "compareSelectedTickers",
  "comparisonOpen",
  "evaluatedCompanies",
  "externalAnalyses",
  "externalReportSelection",
  "historicalRequirementSets",
  "stateSchemaVersion",
  "history",
  "watchList"
];

const FORBIDDEN_SECRET_KEYS = [
  "apiKey",
  "apiKeys",
  "token",
  "secret",
  "password",
  "OPENAI_API_KEY",
  "FMP_API_KEY",
  "APP_ACCESS_PASSWORD",
  "Authorization"
];

export function createInvestmentDataBackup(state = {}, now = new Date()) {
  const data = Object.fromEntries(RESTORABLE_KEYS.map((key) => [
    key,
    scrubSecrets(key === "externalAnalyses" ? normalizeExternalAnalysesCollection(state[key] || {}) : state[key])
  ]));
  return {
    schemaVersion: FRANKLIN_BACKUP_SCHEMA_VERSION,
    appName: "Franklin Research",
    exportedAt: now.toISOString(),
    data
  };
}

export function parseInvestmentDataBackup(text) {
  let parsed;
  try {
    parsed = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return { valid: false, errors: ["Backup JSON is invalid."], backup: null, preview: null };
  }
  if (isRawFranklinState(parsed)) {
    const migrated = migrateFranklinState(parsed);
    const backup = {
      schemaVersion: FRANKLIN_BACKUP_SCHEMA_VERSION,
      appName: "Franklin Research",
      exportedAt: parsed.metadata?.exportedAt || parsed.__franklinBackupCreatedAt || null,
      data: migrated.state,
      diagnostics: migrated.diagnostics
    };
    return {
      valid: true,
      errors: [],
      backup,
      preview: previewInvestmentDataBackup(backup)
    };
  }
  const errors = validateInvestmentDataBackup(parsed);
  return {
    valid: errors.length === 0,
    errors,
    backup: parsed,
    preview: errors.length ? null : previewInvestmentDataBackup(parsed)
  };
}

export function validateInvestmentDataBackup(backup = {}) {
  const errors = [];
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) errors.push("Backup must be a JSON object.");
  if (backup.schemaVersion !== FRANKLIN_BACKUP_SCHEMA_VERSION) errors.push("Backup schemaVersion is not supported.");
  if (!backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) errors.push("Backup data is missing.");
  if (containsSecretKey(backup)) errors.push("Backup appears to contain secret fields and cannot be restored.");
  return errors;
}

export function previewInvestmentDataBackup(backup = {}) {
  const data = backup.data || {};
  const summary = summarizeFranklinState(data);
  return {
    exportedAt: backup.exportedAt || null,
    companyCount: summary.tickerCount,
    externalReportCount: summary.reportCount,
    historicalRequirementSets: summary.historicalRequirementSetCount,
    supplementCount: summary.supplementCount,
    evaluatedCompanies: Array.isArray(data.evaluatedCompanies) ? data.evaluatedCompanies.length : 0,
    historyItems: Array.isArray(data.history) ? data.history.length : 0,
    watchListItems: Array.isArray(data.watchList) ? data.watchList.length : 0,
    language: data.language || null,
    theme: data.theme || null
  };
}

export function mergeInvestmentDataBackup(currentState = {}, backup = {}) {
  const incoming = backup.data || {};
  return {
    ...currentState,
    ...pickScalarRestorable(incoming),
    evaluatedCompanies: mergeByIdOrTicker(currentState.evaluatedCompanies, incoming.evaluatedCompanies),
    history: mergeByIdOrTicker(currentState.history, incoming.history),
    watchList: mergeByIdOrTicker(currentState.watchList, incoming.watchList),
    externalAnalyses: mergeExternalAnalyses(currentState.externalAnalyses, incoming.externalAnalyses),
    historicalRequirementSets: mergeHistoricalRequirementSets(currentState.historicalRequirementSets, incoming.historicalRequirementSets),
    manualInputs: { ...(currentState.manualInputs || {}), ...(incoming.manualInputs || {}) },
    company: incoming.company || currentState.company,
    externalReportSelection: incoming.externalReportSelection || currentState.externalReportSelection
  };
}

function mergeHistoricalRequirementSets(current = {}, incoming = {}) {
  const result = { ...(current || {}) };
  for (const [ticker, sets] of Object.entries(incoming || {})) {
    if (!Array.isArray(sets)) continue;
    const currentSets = result[ticker] || [];
    result[ticker] = mergeByIdOrTicker(currentSets, sets);
  }
  return result;
}

export function replaceInvestmentDataBackup(currentState = {}, backup = {}) {
  return {
    ...currentState,
    ...Object.fromEntries(RESTORABLE_KEYS.map((key) => [key, backup.data?.[key] ?? currentState[key]]))
  };
}

function pickScalarRestorable(input = {}) {
  const scalarKeys = ["language", "theme", "evaluatedSort", "rankingFilter", "sectorFilter", "compareSelectedTickers", "comparisonOpen"];
  return Object.fromEntries(scalarKeys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}

function isRawFranklinState(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.schemaVersion !== FRANKLIN_BACKUP_SCHEMA_VERSION
    && (
      value.externalAnalyses
      || value.historicalRequirementSets
      || value.evaluatedCompanies
      || value.company
      || value.manualInputs
    )
  );
}

function mergeExternalAnalyses(current = {}, incoming = {}) {
  const result = { ...(current || {}) };
  for (const [ticker, reports] of Object.entries(incoming || {})) {
    if (!Array.isArray(reports)) continue;
    const currentReports = result[ticker] || [];
    result[ticker] = mergeByIdOrTicker(currentReports, reports);
  }
  return result;
}

function mergeByIdOrTicker(current = [], incoming = []) {
  const list = Array.isArray(current) ? [...current] : [];
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const key = item?.id || item?.requirementSetId || item?.ticker || item?.company?.ticker || JSON.stringify(item);
    const exists = list.some((entry) => (entry?.id || entry?.requirementSetId || entry?.ticker || entry?.company?.ticker || JSON.stringify(entry)) === key);
    if (!exists) list.push(item);
  }
  return list;
}

function scrubSecrets(value) {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isForbiddenKey(key))
    .map(([key, item]) => [key, scrubSecrets(item)]));
}

function containsSecretKey(value) {
  if (Array.isArray(value)) return value.some(containsSecretKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => isForbiddenKey(key) || containsSecretKey(item));
}

function isForbiddenKey(key) {
  const clean = String(key || "").toLowerCase();
  return FORBIDDEN_SECRET_KEYS.some((forbidden) => clean.includes(forbidden.toLowerCase()));
}
