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
  const data = Object.fromEntries(RESTORABLE_KEYS.map((key) => [key, scrubSecrets(state[key])]));
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
  const externalAnalyses = data.externalAnalyses && typeof data.externalAnalyses === "object" ? data.externalAnalyses : {};
  const companyCount = Object.keys(externalAnalyses).length;
  const externalReportCount = Object.values(externalAnalyses).reduce((sum, reports) => sum + (Array.isArray(reports) ? reports.length : 0), 0);
  return {
    exportedAt: backup.exportedAt || null,
    companyCount,
    externalReportCount,
    historicalRequirementSets: Object.values(data.historicalRequirementSets || {}).reduce((sum, sets) => sum + (Array.isArray(sets) ? sets.length : 0), 0),
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
