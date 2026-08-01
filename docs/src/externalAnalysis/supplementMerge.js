import { attachCompletionStatus, getPath, valuePresent } from "./missingFields.js";
import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";
import { PROTECTED_SUPPLEMENT_PATHS } from "./supplementValidator.js";

export function mergeExternalAnalysisSupplement(existingReport = {}, supplement = {}, options = {}) {
  const now = options.now || new Date();
  const resolutions = options.resolutions || {};
  const manualValues = options.manualValues || {};
  const mergedReport = clone(existingReport);
  const appliedFields = [];
  const rejectedFields = [];
  const conflicts = [];
  const unchangedFields = [];

  for (const [path, incomingValue] of Object.entries(supplement.fields || {})) {
    if (PROTECTED_SUPPLEMENT_PATHS.has(path)) {
      rejectedFields.push(rejection(path, incomingValue, getPath(existingReport, path), "protected_field"));
      continue;
    }
    if (incomingValue === null || incomingValue === undefined) {
      rejectedFields.push(rejection(path, incomingValue, getPath(existingReport, path), "null_supplement_value"));
      continue;
    }

    const currentValue = getPath(existingReport, path);
    const hasCurrent = valuePresent(currentValue, path);
    if (!hasCurrent) {
      setPath(mergedReport, path, incomingValue);
      appliedFields.push(applied(path, null, incomingValue, "filled_missing"));
      continue;
    }
    if (sameValue(currentValue, incomingValue)) {
      unchangedFields.push(applied(path, currentValue, incomingValue, "same_value"));
      continue;
    }

    const resolution = resolutions[path];
    if (resolution === "use-new") {
      setPath(mergedReport, path, incomingValue);
      appliedFields.push(applied(path, currentValue, incomingValue, "user_approved_new_value"));
      continue;
    }
    if (resolution === "manual") {
      const manualValue = manualValues[path];
      if (manualValue !== undefined && manualValue !== "") {
        setPath(mergedReport, path, manualValue);
        appliedFields.push(applied(path, currentValue, manualValue, "user_manual_value"));
        continue;
      }
    }
    if (resolution === "keep-current") {
      rejectedFields.push(rejection(path, incomingValue, currentValue, "user_kept_current_value"));
      continue;
    }

    conflicts.push({
      path,
      currentValue,
      newValue: incomingValue,
      reason: "existing_value_differs"
    });
  }

  mergedReport.analysisOrigin = existingReport.analysisOrigin;
  mergedReport.id = existingReport.id;
  mergedReport.rawAnalysisOriginal = existingReport.rawAnalysisOriginal || existingReport.rawAnalysis || "";
  mergedReport.supplements = [
    ...(Array.isArray(existingReport.supplements) ? existingReport.supplements : []),
    {
      id: createSupplementAuditId(existingReport, now),
      importedAt: now.toISOString(),
      rawSupplement: supplement.rawSupplement || "",
      parsedFields: { ...(supplement.fields || {}) },
      appliedFields,
      rejectedFields,
      conflicts,
      unchangedFields,
      source: supplement.source || "ChatGPT",
      sourceModel: supplement.sourceModel || null,
      notes: Array.isArray(supplement.notes) ? supplement.notes : []
    }
  ];
  mergedReport.metadata = {
    ...(mergedReport.metadata || {}),
    updatedAt: now.toISOString()
  };

  const validation = validateExternalAnalysisReport(mergedReport);
  const completedReport = attachCompletionStatus(mergedReport, validation, {
    now,
    conflictingPaths: conflicts.map((item) => item.path)
  });

  return {
    report: completedReport,
    validation,
    appliedFields,
    rejectedFields,
    conflicts,
    unchangedFields
  };
}

export function setPath(object, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applied(path, previousValue, newValue, action) {
  return { path, previousValue, newValue, action };
}

function rejection(path, newValue, currentValue, reason) {
  return { path, currentValue, newValue, reason };
}

function createSupplementAuditId(report, now) {
  const ticker = report.company?.ticker || "EXT";
  return `supplement-${ticker}-${now.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
