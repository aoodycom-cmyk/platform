export const FRANKLIN_STATE_SCHEMA_VERSION = 1;

export const FRANKLIN_STATE_BACKUP_PREFIXES = [
  "franklinBootRecoveryBackup:",
  "franklinManualResetBackup:",
  "franklinPreCloudRestoreBackupV1",
  "franklinPreCloudRestoreBackupV1:",
  "franklinPreLocalRestoreBackupV1:",
  "franklinPreCloudPushBackupV1:"
];

export function migrateFranklinState(rawState = {}, options = {}) {
  const diagnostics = {
    schemaVersion: FRANKLIN_STATE_SCHEMA_VERSION,
    warnings: [],
    quarantinedReports: []
  };
  const source = cloneState(rawState);
  const input = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  if (source !== input) diagnostics.warnings.push({ path: "$", issue: "state-root-not-object" });

  const state = {
    ...input,
    stateSchemaVersion: normalizeSchemaVersion(input.stateSchemaVersion),
    manualInputs: plainObject(input.manualInputs) ? input.manualInputs : { averageCost: "", morningstarFairValue: "", notes: "" },
    evaluatedCompanies: normalizeArray(input.evaluatedCompanies, "evaluatedCompanies", diagnostics),
    compareSelectedTickers: normalizeArray(input.compareSelectedTickers, "compareSelectedTickers", diagnostics),
    history: normalizeArray(input.history, "history", diagnostics),
    watchList: normalizeArray(input.watchList, "watchList", diagnostics),
    watchDraft: plainObject(input.watchDraft) ? input.watchDraft : { thesis: "", targetPrice: "", reviewDate: "", notes: "" },
    externalAnalyses: normalizeExternalAnalysesForBoot(input.externalAnalyses, diagnostics),
    historicalRequirementSets: normalizeHistoricalRequirementSetsForBoot(input.historicalRequirementSets, diagnostics),
    libraryFilter: typeof input.libraryFilter === "string" ? input.libraryFilter : "all",
    librarySort: typeof input.librarySort === "string" ? input.librarySort : "latest",
    evaluatedSort: plainObject(input.evaluatedSort) ? input.evaluatedSort : undefined,
    rankingFilter: typeof input.rankingFilter === "string" ? input.rankingFilter : "all",
    sectorFilter: typeof input.sectorFilter === "string" ? input.sectorFilter : "all"
  };

  state.externalReportSelection = normalizeExternalSelection(input.externalReportSelection, state.externalAnalyses, diagnostics);
  state.__franklinMigration = diagnostics;
  if (options.includeRawBackupKey) state.__franklinRawBackupKey = options.includeRawBackupKey;
  return { state, diagnostics };
}

export function summarizeFranklinState(state = {}) {
  const externalAnalyses = plainObject(state.externalAnalyses) ? state.externalAnalyses : {};
  const tickerCount = Object.values(externalAnalyses).filter((reports) => Array.isArray(reports) && reports.length > 0).length;
  const reportCount = Object.values(externalAnalyses).reduce((sum, reports) => sum + (Array.isArray(reports) ? reports.length : 0), 0);
  const historicalRequirementSets = plainObject(state.historicalRequirementSets) ? state.historicalRequirementSets : {};
  const historicalRequirementSetCount = Object.values(historicalRequirementSets).reduce((sum, sets) => sum + (Array.isArray(sets) ? sets.length : 0), 0);
  const supplementCount = Object.values(externalAnalyses).reduce((sum, reports) => {
    if (!Array.isArray(reports)) return sum;
    return sum + reports.reduce((inner, report) => inner + (Array.isArray(report?.supplements) ? report.supplements.length : 0), 0);
  }, 0);
  return {
    tickerCount,
    reportCount,
    historicalRequirementSetCount,
    supplementCount,
    evaluatedCompanyCount: Array.isArray(state.evaluatedCompanies) ? state.evaluatedCompanies.length : 0
  };
}

export function countExternalReports(state = {}) {
  return summarizeFranklinState(state).reportCount;
}

export function findLocalFranklinBackups(storage = globalThis.localStorage) {
  if (!storage) return [];
  const keys = listStorageKeys(storage).filter(isFranklinBackupKey);
  return keys.map((key) => {
    const raw = safeGet(storage, key);
    const parsed = parseStateText(raw);
    const migrated = parsed.ok ? migrateFranklinState(parsed.value, { includeRawBackupKey: key }) : null;
    const summary = migrated ? summarizeFranklinState(migrated.state) : summarizeRawBackupWrapper(parsed.value);
    return {
      id: key,
      key,
      createdAt: backupCreatedAt(key),
      reason: backupReason(key),
      source: "localStorage",
      stateSchemaVersion: migrated?.state?.stateSchemaVersion || null,
      tickerCount: summary.tickerCount || 0,
      reportCount: summary.reportCount || 0,
      requirementSetCount: summary.historicalRequirementSetCount || 0,
      supplementCount: summary.supplementCount || 0,
      sizeBytes: raw ? raw.length : 0,
      checksum: checksumText(raw || ""),
      valid: parsed.ok,
      error: parsed.ok ? null : parsed.error
    };
  }).sort((a, b) => {
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export function readLocalFranklinBackup(storage, key) {
  if (!storage || !key || !isFranklinBackupKey(key)) return { valid: false, errors: ["Backup key is not restorable."] };
  const raw = safeGet(storage, key);
  if (!raw) return { valid: false, errors: ["Backup is empty or missing."] };
  const parsed = parseStateText(raw);
  if (!parsed.ok) return { valid: false, errors: [parsed.error] };
  const data = unwrapBackupData(parsed.value);
  const { state, diagnostics } = migrateFranklinState(data, { includeRawBackupKey: key });
  return {
    valid: true,
    errors: [],
    raw,
    state,
    diagnostics,
    preview: {
      exportedAt: backupCreatedAt(key),
      ...summarizeFranklinState(state)
    }
  };
}

export function createLocalStateBackup(storage, currentRaw, reason, now = new Date()) {
  if (!storage || !currentRaw) return null;
  const key = `franklinPreLocalRestoreBackupV1:${now.toISOString()}`;
  storage.setItem(key, currentRaw);
  return key;
}

export function shouldBlockCloudPush(localState = {}, remoteState = {}, options = {}) {
  const local = summarizeFranklinState(localState);
  const remote = summarizeFranklinState(remoteState);
  if (remote.reportCount > 0 && local.reportCount === 0) {
    return {
      blocked: true,
      reason: "EMPTY_LOCAL_WOULD_OVERWRITE_POPULATED_CLOUD",
      local,
      remote
    };
  }
  const threshold = Number(options.suspiciousReductionRatio ?? 0.5);
  if (remote.reportCount >= 3 && local.reportCount < remote.reportCount * threshold) {
    return {
      blocked: true,
      reason: "SUSPICIOUS_LOCAL_REDUCTION_REQUIRES_CONFIRMATION",
      local,
      remote
    };
  }
  return { blocked: false, reason: null, local, remote };
}

export function validateRestoredCandidate(originalState = {}, candidateState = {}) {
  const before = summarizeFranklinState(originalState);
  const after = summarizeFranklinState(candidateState);
  const errors = [];
  if (before.reportCount > 0 && after.reportCount < before.reportCount) errors.push("RESTORE_DROPPED_REPORTS");
  if (before.historicalRequirementSetCount > 0 && after.historicalRequirementSetCount < before.historicalRequirementSetCount) errors.push("RESTORE_DROPPED_REQUIREMENT_SETS");
  return { valid: errors.length === 0, errors, before, after };
}

function normalizeSchemaVersion(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : FRANKLIN_STATE_SCHEMA_VERSION;
}

function normalizeArray(value, path, diagnostics) {
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  diagnostics.warnings.push({ path, issue: `${value === null ? "null" : typeof value}-to-array` });
  return [];
}

function normalizeExternalAnalysesForBoot(collection, diagnostics) {
  if (!plainObject(collection)) {
    if (collection !== undefined) diagnostics.warnings.push({ path: "externalAnalyses", issue: "non-object-to-empty-object" });
    return {};
  }
  const result = {};
  for (const [ticker, reports] of Object.entries(collection)) {
    const cleanTicker = normalizeTicker(ticker);
    if (!cleanTicker) continue;
    if (Array.isArray(reports)) {
      result[cleanTicker] = reports.map((report, index) => normalizeReportForBoot(report, `externalAnalyses.${cleanTicker}.${index}`, diagnostics)).filter(Boolean);
      continue;
    }
    if (looksLikeReport(reports)) {
      diagnostics.warnings.push({ path: `externalAnalyses.${cleanTicker}`, issue: "single-report-object-to-array" });
      const report = normalizeReportForBoot(reports, `externalAnalyses.${cleanTicker}.0`, diagnostics);
      result[cleanTicker] = report ? [report] : [];
      continue;
    }
    diagnostics.warnings.push({ path: `externalAnalyses.${cleanTicker}`, issue: `${reports === null ? "null" : typeof reports}-bucket-to-empty-array` });
    result[cleanTicker] = [];
  }
  return result;
}

function normalizeReportForBoot(report, path, diagnostics) {
  if (!plainObject(report)) {
    diagnostics.quarantinedReports.push({ path, reason: "report-not-object", storedType: Array.isArray(report) ? "array" : report === null ? "null" : typeof report });
    return null;
  }
  return report;
}

function normalizeHistoricalRequirementSetsForBoot(collection, diagnostics) {
  if (Array.isArray(collection)) return groupRequirementSets(collection, diagnostics);
  if (!plainObject(collection)) {
    if (collection !== undefined) diagnostics.warnings.push({ path: "historicalRequirementSets", issue: "non-object-to-empty-object" });
    return {};
  }
  const result = {};
  for (const [ticker, sets] of Object.entries(collection)) {
    const cleanTicker = normalizeTicker(ticker);
    if (!cleanTicker) continue;
    if (Array.isArray(sets)) {
      result[cleanTicker] = sets.filter(plainObject);
      continue;
    }
    if (plainObject(sets)) {
      diagnostics.warnings.push({ path: `historicalRequirementSets.${cleanTicker}`, issue: "single-set-object-to-array" });
      result[cleanTicker] = [sets];
      continue;
    }
    diagnostics.warnings.push({ path: `historicalRequirementSets.${cleanTicker}`, issue: `${sets === null ? "null" : typeof sets}-bucket-to-empty-array` });
    result[cleanTicker] = [];
  }
  return result;
}

function groupRequirementSets(sets, diagnostics) {
  diagnostics.warnings.push({ path: "historicalRequirementSets", issue: "array-to-ticker-map" });
  const result = {};
  for (const set of sets) {
    if (!plainObject(set)) continue;
    const ticker = normalizeTicker(set.ticker || set.company?.ticker);
    if (!ticker) continue;
    result[ticker] = [...(result[ticker] || []), set];
  }
  return result;
}

function normalizeExternalSelection(selection, externalAnalyses, diagnostics) {
  if (!plainObject(selection)) return null;
  const ticker = normalizeTicker(selection.ticker);
  const reportId = selection.reportId || "latest";
  if (!ticker) return null;
  const reports = externalAnalyses[ticker] || [];
  const found = reportId === "latest" || reports.some((report) => report?.id === reportId);
  if (!found) diagnostics.warnings.push({ path: "externalReportSelection", issue: "stale-report-reference" });
  return { ...selection, ticker, reportId };
}

function looksLikeReport(value) {
  return plainObject(value) && Boolean(value.id || value.company || value.fairValueSummary || value.rawAnalysis || value.rawAnalysisOriginal);
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneState(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
}

function listStorageKeys(storage) {
  const keys = [];
  for (let index = 0; index < Number(storage.length || 0); index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function isFranklinBackupKey(key) {
  return FRANKLIN_STATE_BACKUP_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function parseStateText(raw) {
  try {
    return { ok: true, value: JSON.parse(raw || "{}") };
  } catch (error) {
    return { ok: false, value: null, error: String(error?.message || error) };
  }
}

function unwrapBackupData(value) {
  if (plainObject(value?.data)) return value.data;
  return value;
}

function summarizeRawBackupWrapper(value) {
  return plainObject(value?.data) ? summarizeFranklinState(value.data) : summarizeFranklinState(value);
}

function backupCreatedAt(key) {
  const match = String(key || "").match(/(\d{4}-\d{2}-\d{2}T[^:]+:[^:]+:[^:]+(?:\.\d+)?Z)/);
  return match ? match[1] : null;
}

function backupReason(key) {
  if (key.startsWith("franklinManualResetBackup:")) return "manual-reset";
  if (key.startsWith("franklinBootRecoveryBackup:")) return "boot-recovery";
  if (key.startsWith("franklinPreCloudRestoreBackupV1")) return "pre-cloud-restore";
  if (key.startsWith("franklinPreLocalRestoreBackupV1:")) return "pre-local-restore";
  if (key.startsWith("franklinPreCloudPushBackupV1:")) return "pre-cloud-push";
  return "recovery";
}

function checksumText(text) {
  let hash = 2166136261;
  const clean = String(text || "");
  for (let index = 0; index < clean.length; index += 1) {
    hash ^= clean.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean || null;
}
