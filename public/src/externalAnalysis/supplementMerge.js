import { attachCompletionStatus } from "./missingFields.js";
import { diagnosticRowsForSupplement, getByPath, isKnownAnalysisPath, isMissing, setByPath } from "./fieldPaths.js";
import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";
import { normalizeExternalAnalysisReport } from "./schema.js";
import { canUseProtectedField, effectiveSupplementFields, PROTECTED_SUPPLEMENT_PATHS } from "./supplementValidator.js";

export function mergeExternalAnalysisSupplement(existingReport = {}, supplement = {}, options = {}) {
  const now = options.now || new Date();
  const resolutions = options.resolutions || {};
  const manualValues = options.manualValues || {};
  const mergedReport = clone(existingReport);
  const appliedFields = [];
  const rejectedFields = [];
  const conflicts = [];
  const unchangedFields = [];

  const supplementFields = effectiveSupplementFields(supplement, existingReport);
  const diagnostics = diagnosticRowsForSupplement(existingReport, supplementFields);
  if (options.debug) console.table(diagnostics);
  for (const [path, incomingValue] of Object.entries(supplementFields)) {
    const currentValue = getByPath(existingReport, path);
    if (!isKnownAnalysisPath(path)) {
      rejectedFields.push(rejection(path, incomingValue, currentValue, "unknown_path"));
      continue;
    }
    if (isMissing(incomingValue, path)) {
      rejectedFields.push(rejection(path, incomingValue, currentValue, "empty_supplement_value"));
      continue;
    }
    if (PROTECTED_SUPPLEMENT_PATHS.has(path) && !canUseProtectedField(path, incomingValue, existingReport)) {
      rejectedFields.push(rejection(path, incomingValue, currentValue, "protected_field"));
      continue;
    }

    if (isMissing(currentValue, path)) {
      setByPath(mergedReport, path, incomingValue);
      appliedFields.push(applied(path, null, incomingValue, "filled_missing"));
      continue;
    }
    if (sameValue(currentValue, incomingValue)) {
      unchangedFields.push(applied(path, currentValue, incomingValue, "same_value"));
      continue;
    }

    const resolution = resolutions[path];
    if (resolution === "use-new") {
      setByPath(mergedReport, path, incomingValue);
      appliedFields.push(applied(path, currentValue, incomingValue, "user_approved_new_value"));
      continue;
    }
    if (resolution === "manual") {
      const manualValue = manualValues[path];
      if (manualValue !== undefined && manualValue !== "") {
        setByPath(mergedReport, path, manualValue);
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
      parsedFields: supplementFields,
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

  const normalizedReport = normalizeExternalAnalysisReport(mergedReport, mergedReport.rawAnalysisOriginal || mergedReport.rawAnalysis || "", { now });
  const validation = validateExternalAnalysisReport(normalizedReport);
  const completedReport = attachCompletionStatus(normalizedReport, validation, {
    now,
    conflictingPaths: conflicts.map((item) => item.path)
  });

  return {
    report: completedReport,
    validation,
    appliedFields,
    rejectedFields,
    conflicts,
    unchangedFields,
    diagnostics,
    summary: mergeSummary({ appliedFields, rejectedFields, conflicts, unchangedFields, supplementFields })
  };
}

export { setByPath as setPath } from "./fieldPaths.js";

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

function mergeSummary({ appliedFields, rejectedFields, conflicts, unchangedFields, supplementFields }) {
  if (appliedFields.length) {
    return {
      status: "merged",
      messageAr: `تم تحديث ${appliedFields.length} من الحقول الناقصة بنجاح.`,
      messageEn: `Updated ${appliedFields.length} missing field(s).`
    };
  }
  if (conflicts.length) {
    return {
      status: "conflicts",
      messageAr: "بعض القيم المستلمة تختلف عن قيم موجودة وتحتاج مراجعة قبل الدمج.",
      messageEn: "Some incoming values conflict with existing values and need review."
    };
  }
  const totalFields = Object.keys(supplementFields || {}).length;
  const emptyRejected = rejectedFields.filter((item) => item.reason === "empty_supplement_value").length;
  const unknownRejected = rejectedFields.filter((item) => item.reason === "unknown_path").length;
  if (totalFields > 0 && emptyRejected === totalFields) {
    return {
      status: "all_empty",
      messageAr: "لم يُرجع ChatGPT أي قيم غير فارغة للحقول المطلوبة.",
      messageEn: "ChatGPT did not return any non-empty values for the requested fields."
    };
  }
  if (unknownRejected > 0 && unknownRejected === rejectedFields.length) {
    return {
      status: "unknown_paths",
      messageAr: "بعض الحقول لا تطابق مسارات معروفة في Schema التحليل.",
      messageEn: "Some fields do not match known analysis schema paths."
    };
  }
  if (unchangedFields.length && unchangedFields.length + rejectedFields.length === totalFields) {
    return {
      status: "already_present",
      messageAr: "جميع القيم التي أرجعها ChatGPT موجودة مسبقًا في التحليل، لذلك لم يلزم إجراء أي تحديث.",
      messageEn: "All values returned by ChatGPT already exist in the analysis, so no update was needed."
    };
  }
  return {
    status: "no_changes",
    messageAr: "لم يتم إجراء أي تحديث على التقرير.",
    messageEn: "No report updates were applied."
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
