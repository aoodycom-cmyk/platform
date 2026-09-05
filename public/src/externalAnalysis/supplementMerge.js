import { attachCompletionStatus } from "./missingFields.js";
import { diagnosticRowsForSupplement, getByPath, isMissing, setByPath, valuePresent } from "./fieldPaths.js";
import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";
import { hashText, normalizeExternalAnalysisReport } from "./schema.js";
import {
  canUseProtectedField,
  effectiveSupplementFields,
  PROTECTED_SUPPLEMENT_PATHS,
  validateExternalAnalysisSupplement
} from "./supplementValidator.js";
import { isApprovedSupplementField, isUnsafeJsonPath } from "./supplementContract.js";

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
  const supplementValidation = validateExternalAnalysisSupplement(supplement, existingReport);
  if (options.debug) console.table(diagnostics);
  if (!supplementValidation.valid) {
    return unchangedMergeResult(existingReport, supplementValidation, diagnostics, supplementFields);
  }
  for (const [path, incomingValue] of Object.entries(supplementFields)) {
    const currentValue = getByPath(existingReport, path);
    if (!isApprovedSupplementField(path) || isUnsafeJsonPath(path)) {
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

  if (conflicts.length) {
    return {
      report: clone(existingReport),
      proposedReport: mergedReport,
      validation: validateExternalAnalysisReport(existingReport),
      supplementValidation,
      appliedFields,
      rejectedFields,
      conflicts,
      unchangedFields,
      diagnostics,
      summary: mergeSummary({ appliedFields: [], rejectedFields, conflicts, unchangedFields, supplementFields })
    };
  }

  if (!appliedFields.length) {
    return {
      report: clone(existingReport),
      validation: validateExternalAnalysisReport(existingReport),
      supplementValidation,
      appliedFields,
      rejectedFields,
      conflicts,
      unchangedFields,
      diagnostics,
      summary: mergeSummary({ appliedFields, rejectedFields, conflicts, unchangedFields, supplementFields })
    };
  }

  mergedReport.analysisOrigin = existingReport.analysisOrigin;
  mergedReport.id = existingReport.id;
  mergedReport.rawAnalysisOriginal = existingReport.rawAnalysisOriginal || existingReport.rawAnalysis || "";
  const auditId = createSupplementAuditId(existingReport, supplementFields);
  const previousSupplements = Array.isArray(existingReport.supplements) ? existingReport.supplements : [];
  mergedReport.supplements = previousSupplements.some((item) => item?.id === auditId)
    ? previousSupplements
    : [...previousSupplements, {
      id: auditId,
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
    }];
  mergedReport.metadata = {
    ...(mergedReport.metadata || {}),
    updatedAt: now.toISOString()
  };

  const normalizedReport = normalizeExternalAnalysisReport(mergedReport, mergedReport.rawAnalysisOriginal || mergedReport.rawAnalysis || "", { now });
  const validation = validateExternalAnalysisReport(normalizedReport);
  const previousValidation = validateExternalAnalysisReport(existingReport);
  const newValidationErrors = validation.errors.filter((item) => !previousValidation.errors.some((previous) => previous.field === item.field && previous.message === item.message));
  if (newValidationErrors.length) {
    return {
      report: clone(existingReport),
      validation,
      supplementValidation,
      appliedFields: [],
      rejectedFields,
      conflicts: newValidationErrors.map((item) => ({ path: item.field, currentValue: getByPath(existingReport, item.field), newValue: getByPath(normalizedReport, item.field), reason: "merged_report_invalid" })),
      unchangedFields,
      diagnostics,
      summary: {
        status: "invalid_merge",
        messageAr: "لم يُحفظ أي تغيير لأن النتيجة المدمجة لم تجتز تحقق التقرير.",
        messageEn: "No changes were saved because the merged report failed validation."
      }
    };
  }
  const completedReport = attachCompletionStatus(normalizedReport, validation, {
    now,
    conflictingPaths: conflicts.map((item) => item.path)
  });

  return {
    report: completedReport,
    validation,
    supplementValidation,
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

function createSupplementAuditId(report, fields) {
  const ticker = report.company?.ticker || "EXT";
  return `supplement-${ticker}-${hashText(stableStringify(fields))}`;
}

function unchangedMergeResult(existingReport, supplementValidation, diagnostics, supplementFields) {
  const allEmpty = Object.entries(supplementFields).length > 0
    && Object.entries(supplementFields).every(([path, value]) => !valuePresent(value, path));
  return {
    report: clone(existingReport),
    validation: validateExternalAnalysisReport(existingReport),
    supplementValidation,
    appliedFields: [],
    rejectedFields: [],
    conflicts: [],
    unchangedFields: [],
    diagnostics,
    summary: allEmpty
      ? {
        status: "all_empty",
        messageAr: "لم يُرجع ChatGPT أي قيم غير فارغة للحقول المطلوبة.",
        messageEn: "ChatGPT did not return any non-empty values for the requested fields."
      }
      : {
        status: "invalid",
        messageAr: "لم يُحفظ أي تغيير لأن الرد التكميلي غير صالح.",
        messageEn: "No changes were saved because the supplement is invalid."
      }
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
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
