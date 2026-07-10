export const SOURCES = {
  FMP: "Financial Modeling Prep",
  MORNINGSTAR: "Morningstar",
  MANUAL: "Manual Input",
  MISSING: "Missing"
};

export const UPDATE_STATUS = {
  FRESH: "fresh",
  OUTDATED: "outdated",
  MANUAL: "manual",
  MISSING: "missing",
  CONFLICT: "conflict"
};

export function createDataField(value, options = {}) {
  const status = options.updateStatus || inferStatus(value, options);
  return {
    value: normalizeEmpty(value),
    source: options.source || (status === UPDATE_STATUS.MISSING ? SOURCES.MISSING : SOURCES.MANUAL),
    timestamp: options.timestamp || null,
    confidence: Number.isFinite(options.confidence) ? options.confidence : defaultConfidence(status),
    updateStatus: status,
    providerType: options.providerType || "",
    field: options.field || "",
    statement: options.statement || "",
    period: options.period || "",
    fiscalPeriod: options.fiscalPeriod || "",
    conflicts: options.conflicts || []
  };
}

export function missingField(field, options = {}) {
  return createDataField(null, {
    ...options,
    field,
    source: SOURCES.MISSING,
    confidence: 0,
    updateStatus: UPDATE_STATUS.MISSING
  });
}

export function isDataField(value) {
  return Boolean(value && typeof value === "object" && "value" in value && "source" in value && "updateStatus" in value);
}

export function readFieldValue(value) {
  return isDataField(value) ? value.value : value;
}

export function readFieldMeta(value) {
  return isDataField(value) ? value : createDataField(value);
}

export function selectField(field, candidates = [], options = {}) {
  const usable = candidates
    .filter(Boolean)
    .map((candidate) => isDataField(candidate) ? candidate : createDataField(candidate, options))
    .filter((candidate) => hasUsableValue(candidate.value));
  if (!usable.length) return missingField(field, options);
  const selected = usable[0];
  const conflicts = usable.slice(1).filter((candidate) => valuesConflict(selected.value, candidate.value)).map((candidate) => ({
    source: candidate.source,
    value: candidate.value,
    timestamp: candidate.timestamp
  }));
  return {
    ...selected,
    field,
    updateStatus: conflicts.length ? UPDATE_STATUS.CONFLICT : selected.updateStatus,
    conflicts
  };
}

export function statusFromTimestamp(value, timestamp, staleAfterDays, manual = false) {
  if (!hasUsableValue(value)) return UPDATE_STATUS.MISSING;
  if (manual) return UPDATE_STATUS.MANUAL;
  if (!timestamp || !Number.isFinite(staleAfterDays)) return UPDATE_STATUS.FRESH;
  const updated = new Date(timestamp);
  if (Number.isNaN(updated.getTime())) return UPDATE_STATUS.OUTDATED;
  const ageMs = Date.now() - updated.getTime();
  const ageDays = ageMs / 86_400_000;
  return ageDays > staleAfterDays ? UPDATE_STATUS.OUTDATED : UPDATE_STATUS.FRESH;
}

export function hasUsableValue(value) {
  const unwrapped = readFieldValue(value);
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return false;
  if (typeof unwrapped === "number") return Number.isFinite(unwrapped);
  return true;
}

function inferStatus(value, options) {
  if (!hasUsableValue(value)) return UPDATE_STATUS.MISSING;
  if (options.source === SOURCES.MANUAL) return UPDATE_STATUS.MANUAL;
  return statusFromTimestamp(value, options.timestamp, options.staleAfterDays, false);
}

function defaultConfidence(status) {
  if (status === UPDATE_STATUS.MISSING) return 0;
  if (status === UPDATE_STATUS.MANUAL) return 70;
  if (status === UPDATE_STATUS.OUTDATED) return 55;
  if (status === UPDATE_STATUS.CONFLICT) return 50;
  return 90;
}

function normalizeEmpty(value) {
  return value === undefined || value === "" ? null : readFieldValue(value);
}

function valuesConflict(left, right) {
  const a = readFieldValue(left);
  const b = readFieldValue(right);
  if (typeof a === "number" && typeof b === "number") {
    const denominator = Math.max(Math.abs(a), Math.abs(b), 1);
    return Math.abs(a - b) / denominator > 0.015;
  }
  return String(a) !== String(b);
}
