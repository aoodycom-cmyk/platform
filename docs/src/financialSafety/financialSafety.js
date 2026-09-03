import { normalizeFiscalQuarterPeriod as normalizeQuarterPeriod } from "../externalAnalysis/fiscalQuarterPeriod.js";

const QUARTERLY_IMPORT_METHOD = "quarterly_earnings_lite";
const REPORTED_STATUSES = new Set(["PASSED", "PARTIALLY_PASSED", "FAILED", "EXCEEDED"]);

export function installFinancialSafetyLayer(store, root = document.getElementById("app")) {
  if (!store || store.__financialSafetyInstalled) return;
  store.__financialSafetyInstalled = true;
  protectAgainstDuplicateEarningsUpdates(store);

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    nextFrame(() => {
      scheduled = false;
      renderFinancialSafetyUi(store, root);
    });
  };

  store.subscribe(schedule);
  const observer = new MutationObserver(schedule);
  if (root) observer.observe(root, { childList: true, subtree: true });

  setTimeout(() => {
    repairCurrentLifecycleIfSafe(store);
    schedule();
  }, 0);
}

export function auditFinancialReport(report = {}) {
  const errors = [];
  const warnings = [];
  auditValuationArithmetic(report, errors);
  auditQuarterlyProvenance(report, errors, warnings);
  return { valid: errors.length === 0, errors, warnings };
}

export function repairHistoricalRequirementSets(collection = {}, externalAnalyses = {}) {
  const next = clone(collection || {});
  const repairs = [];
  const reportsByTicker = Object.fromEntries(Object.entries(externalAnalyses || {}).map(([ticker, reports]) => [
    normalizeTicker(ticker),
    Array.isArray(reports) ? reports : []
  ]));

  for (const [ticker, sets] of Object.entries(next)) {
    if (!Array.isArray(sets)) continue;
    const reports = reportsByTicker[normalizeTicker(ticker)] || [];
    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index];
      const target = normalizeQuarterPeriod(set?.targetQuarter || set?.earningsPeriod);
      if (!set?.requirementSetId || !target) continue;
      const candidates = reports
        .filter((report) => report?.previousRequirementsEvaluation?.requirementSetId === set.requirementSetId)
        .filter((report) => normalizeQuarterPeriod(report.reportPeriod) === target)
        .filter((report) => {
          const evaluationPeriod = normalizeQuarterPeriod(report.previousRequirementsEvaluation?.earningsPeriod);
          return !evaluationPeriod || evaluationPeriod === target;
        })
        .filter((report) => hasEvaluationEvidence(report.previousRequirementsEvaluation))
        .sort(compareEvaluationCandidates);
      const best = candidates[0];
      if (!best) continue;
      const evaluation = best.previousRequirementsEvaluation;
      const alreadyCorrect = set.status === "EVALUATED" && set.evaluatedByAnalysisId === best.id;
      if (alreadyCorrect) continue;

      sets[index] = {
        ...set,
        status: "EVALUATED",
        evaluatedByAnalysisId: best.id || null,
        evaluatedAt: best.metadata?.importedAt || best.metadata?.updatedAt || best.analysisDate || null,
        requirements: mergeEvaluationIntoDefinitions(set.requirements, evaluation.requirements),
        requirementsAssessment: materialAssessment(evaluation.requirementsAssessment)
          ? clone(evaluation.requirementsAssessment)
          : null
      };
      repairs.push({
        ticker: normalizeTicker(ticker),
        requirementSetId: set.requirementSetId,
        previousEvaluator: set.evaluatedByAnalysisId || null,
        correctedEvaluator: best.id || null,
        targetQuarter: target
      });
    }
  }
  return { collection: next, repairs };
}

function protectAgainstDuplicateEarningsUpdates(store) {
  const original = store.saveEarningsUpdate?.bind(store);
  if (!original) return;
  store.saveEarningsUpdate = (...args) => {
    const report = store.state.earningsUpdate?.parsedReport;
    const duplicate = report ? findExactDuplicate(report, store.state.externalAnalyses) : null;
    if (duplicate) {
      const validation = store.state.earningsUpdate?.validation || { valid: true, errors: [], warnings: [] };
      store.set({
        earningsUpdate: {
          ...store.state.earningsUpdate,
          validation: {
            ...validation,
            valid: false,
            errors: [
              ...(validation.errors || []),
              { field: "metadata.rawHash", message: "نفس تحديث الأرباح محفوظ مسبقًا؛ تم منع النسخة المكررة." }
            ]
          }
        },
        notice: store.state.language === "ar"
          ? "هذا التحديث محفوظ مسبقًا. لم تتم إضافة نسخة مكررة."
          : "This earnings update is already saved. A duplicate was not added."
      });
      return undefined;
    }
    return original(...args);
  };
}

function repairCurrentLifecycleIfSafe(store) {
  if (window.__FRANKLIN_AUDIT_MODE?.readOnly) return;
  const result = repairHistoricalRequirementSets(
    store.state.historicalRequirementSets,
    store.state.externalAnalyses
  );
  if (!result.repairs.length) return;
  store.set({
    historicalRequirementSets: result.collection,
    notice: store.state.language === "ar"
      ? `تم تصحيح ${result.repairs.length} سجل متطلبات كان مرتبطًا بربع غير مطابق. لم تُنشأ أي نتيجة مالية جديدة.`
      : `${result.repairs.length} requirement lifecycle record(s) were relinked to the matching quarter. No financial result was invented.`
  });
  window.__FRANKLIN_FINANCIAL_REPAIRS = result.repairs;
}

function renderFinancialSafetyUi(store, root) {
  if (!root) return;
  ensureStyles();
  const ar = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";

  root.querySelectorAll(".v31-current-price > span").forEach((label) => {
    setText(label, ar ? "سعر وقت التحليل" : "Price at analysis");
  });
  root.querySelectorAll(".v31-upside-line > span").forEach((label) => {
    setText(label, ar ? "العائد إلى Base وقت التحليل" : "Return to Base at analysis");
  });
  root.querySelectorAll(".library-completion-row > span").forEach((label) => {
    setText(label, ar ? "اكتمال الحقول" : "Field completeness");
  });
  root.querySelectorAll("select[data-library-sort] option[value='upside']").forEach((option) => {
    setText(option, ar ? "أعلى عائد وقت التحليل" : "Highest upside at analysis");
  });

  root.querySelectorAll("[data-external-report-id]").forEach((card) => {
    if (!card.classList.contains("v31-library-stock-row")) return;
    const report = findReportById(store.state.externalAnalyses, card.dataset.externalReportId);
    const host = card.querySelector(".v31-library-price-block");
    if (!report || !host) return;
    let asOf = host.querySelector(".franklin-price-asof");
    if (!asOf) {
      asOf = document.createElement("small");
      asOf.className = "franklin-price-asof";
      host.append(asOf);
    }
    setText(asOf, `${ar ? "كما في" : "As of"} ${report.analysisDate || "—"}`);
  });

  const oldBanner = root.querySelector(".franklin-financial-safety-banner");
  const report = selectedReport(store.state);
  if (!report || report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD) {
    oldBanner?.remove();
    return;
  }

  const readiness = auditFinancialReport(report);
  const baseDate = inheritedAsOfDate(report, store.state.externalAnalyses);
  const action = report.decision?.action || "—";
  const baseFairValue = report.fairValueSummary?.fairValueBase ?? "—";
  const missingAssessment = readiness.errors.some((item) => item.code === "TARGET_ASSESSMENT_MISSING" || item.code === "TARGET_ASSESSMENT_INCONSISTENT");
  const banner = oldBanner || document.createElement("section");
  const className = `franklin-financial-safety-banner ${missingAssessment ? "critical" : "warning"}`;
  const html = `
    <strong>${ar ? "تنبيه سلامة القرار" : "Decision safety notice"}</strong>
    <p>${ar
      ? `هذا تحديث أرباح للربع ${escapeHtml(report.reportPeriod || "—")} فقط. Fair Value الأساسي (${escapeHtml(baseFairValue)}) وقرار ${escapeHtml(action)} موروثان من التحليل الكامل كما في ${escapeHtml(baseDate || "تاريخ غير محدد")}، ولم تتم إعادة تقييمهما بعد هذا الإعلان.`
      : `This is an earnings-only update for ${escapeHtml(report.reportPeriod || "—")}. Base fair value (${escapeHtml(baseFairValue)}) and ${escapeHtml(action)} are inherited from the full analysis as of ${escapeHtml(baseDate || "an unspecified date")} and were not re-evaluated after this release.`}</p>
    ${missingAssessment ? `<p class="critical-line">${ar
      ? "تقييم المتطلبات الإجمالي ناقص رغم وجود نتائج قابلة للحكم؛ لا تعتمد على نسبة الإنجاز أو حكم Thesis Tracker حتى تصحيح JSON."
      : "The aggregate requirement assessment is missing despite reportable outcomes. Do not rely on the achievement percentage or Thesis Tracker verdict until the JSON is corrected."}</p>` : ""}
  `;
  setClassName(banner, className);
  setHtml(banner, html);
  if (!oldBanner) {
    const appBar = root.querySelector(".report-app-bar");
    if (appBar) appBar.insertAdjacentElement("afterend", banner);
    else root.prepend(banner);
  }
}

function auditQuarterlyProvenance(report, errors, warnings) {
  if (report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD) return;
  const reportPeriod = normalizeQuarterPeriod(report.reportPeriod);
  const evaluation = report.previousRequirementsEvaluation || {};
  const evaluationPeriod = normalizeQuarterPeriod(evaluation.earningsPeriod);
  const target = normalizeQuarterPeriod(evaluation.targetQuarter || report.priceTargetRequirements?.targetQuarter);
  if (reportPeriod && evaluationPeriod && reportPeriod !== evaluationPeriod) {
    errors.push({
      code: "QUARTER_PERIOD_MISMATCH",
      field: "previousRequirementsEvaluation.earningsPeriod",
      message: `Report period ${reportPeriod} conflicts with evaluation period ${evaluationPeriod}.`
    });
  }
  const requirements = Array.isArray(evaluation.requirements) ? evaluation.requirements : [];
  const reported = requirements.filter((item) => REPORTED_STATUSES.has(String(item?.status || "").toUpperCase())).length;
  if (target && reportPeriod === target && reported > 0) {
    const assessment = evaluation.requirementsAssessment || report.requirementsAssessment;
    if (!materialAssessment(assessment)) {
      errors.push({
        code: "TARGET_ASSESSMENT_MISSING",
        field: "requirementsAssessment",
        message: "The target-quarter aggregate requirements assessment is missing."
      });
    } else if (!assessmentCountsMatch(assessment, requirements)) {
      errors.push({
        code: "TARGET_ASSESSMENT_INCONSISTENT",
        field: "requirementsAssessment",
        message: "The aggregate requirement counts do not match individual statuses."
      });
    }
  }
  if (!report.metadata?.baseAnalysisDate && !report.metadata?.decisionAsOfDate) {
    warnings.push({
      code: "INHERITED_DECISION_DATE_MISSING",
      field: "metadata.baseAnalysisDate",
      message: "The inherited valuation and decision do not have an explicit as-of date."
    });
  }
}

function auditValuationArithmetic(report, errors) {
  const summary = report.fairValueSummary || {};
  const scenarios = report.scenarios || {};
  const bear = scenarioByName(scenarios, "bear");
  const base = scenarioByName(scenarios, "base");
  const bull = scenarioByName(scenarios, "bull");
  const trio = [bear, base, bull];
  if (trio.every(Boolean) && trio.every((item) => Number.isFinite(item.probability))) {
    const probabilitySum = trio.reduce((sum, item) => sum + item.probability, 0);
    if (Math.abs(probabilitySum - 100) > 0.01) {
      errors.push({ code: "SCENARIO_PROBABILITY_SUM", field: "scenarios", message: `Scenario probabilities total ${probabilitySum}, not 100.` });
    }
    if (trio.every((item) => Number.isFinite(item.fairValue)) && Number.isFinite(summary.probabilityWeightedFairValue)) {
      const calculated = trio.reduce((sum, item) => sum + item.fairValue * item.probability, 0) / 100;
      if (Math.abs(calculated - summary.probabilityWeightedFairValue) > 0.05) {
        errors.push({ code: "WEIGHTED_FAIR_VALUE_MISMATCH", field: "fairValueSummary.probabilityWeightedFairValue", message: `Stored weighted fair value ${summary.probabilityWeightedFairValue} differs from ${calculated.toFixed(2)}.` });
      }
    }
  }
  const methodWeights = Array.isArray(report.valuationMethodology?.modelWeights)
    ? report.valuationMethodology.modelWeights.map((item) => item?.weight).filter(Number.isFinite)
    : [];
  if (methodWeights.length) {
    const total = methodWeights.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.push({ code: "VALUATION_WEIGHT_SUM", field: "valuationMethodology.modelWeights", message: `Valuation model weights total ${total}, not 100.` });
    }
  }
  if (Number.isFinite(summary.currentPrice) && Number.isFinite(summary.fairValueBase) && summary.currentPrice > 0 && summary.fairValueBase > 0) {
    const expectedUpside = ((summary.fairValueBase / summary.currentPrice) - 1) * 100;
    const expectedMos = ((summary.fairValueBase - summary.currentPrice) / summary.fairValueBase) * 100;
    if (Number.isFinite(summary.upsideDownsidePercent) && Math.abs(expectedUpside - summary.upsideDownsidePercent) > 0.2) {
      errors.push({ code: "UPSIDE_MISMATCH", field: "fairValueSummary.upsideDownsidePercent", message: "Upside/downside does not match price and Base fair value." });
    }
    if (Number.isFinite(summary.marginOfSafetyPercent) && Math.abs(expectedMos - summary.marginOfSafetyPercent) > 0.2) {
      errors.push({ code: "MARGIN_OF_SAFETY_MISMATCH", field: "fairValueSummary.marginOfSafetyPercent", message: "Margin of safety does not match price and Base fair value." });
    }
  }
}

function selectedReport(state = {}) {
  const selection = state.externalReportSelection || {};
  if (!selection.ticker) return null;
  const reports = state.externalAnalyses?.[normalizeTicker(selection.ticker)] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function inheritedAsOfDate(report, collection) {
  const explicit = report.metadata?.decisionAsOfDate || report.metadata?.baseAnalysisDate || report.metadata?.valuationAsOfDate;
  if (explicit) return explicit;
  const sourceId = report.priceTargetRequirements?.createdFromAnalysisId || report.previousRequirementsEvaluation?.createdFromAnalysisId;
  return findReportById(collection, sourceId)?.analysisDate || null;
}

function nextFrame(callback) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(callback, 0);
}

function setText(element, text) {
  const next = String(text ?? "");
  if (element.textContent !== next) element.textContent = next;
}

function setClassName(element, className) {
  if (element.className !== className) element.className = className;
}

function setHtml(element, html) {
  if (element.dataset.franklinContentKey === html) return;
  element.innerHTML = html;
  element.dataset.franklinContentKey = html;
}

function findExactDuplicate(report, collection = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  if (!ticker) return null;
  const reports = collection[ticker] || [];
  const hash = report.metadata?.rawHash;
  const raw = String(report.rawAnalysisOriginal || report.rawAnalysis || "");
  return reports.find((item) => {
    if (item.id && report.id && item.id === report.id) return false;
    if (hash && item.metadata?.rawHash === hash) return true;
    return raw && raw === String(item.rawAnalysisOriginal || item.rawAnalysis || "");
  }) || null;
}

function findReportById(collection = {}, id = "") {
  if (!id) return null;
  for (const reports of Object.values(collection || {})) {
    const match = (Array.isArray(reports) ? reports : []).find((item) => item.id === id);
    if (match) return match;
  }
  return null;
}

function assessmentCountsMatch(assessment = {}, requirements = []) {
  const counts = {
    totalRequirements: requirements.length,
    reportedRequirements: 0,
    passed: 0,
    failed: 0,
    exceeded: 0,
    partiallyPassed: 0,
    notReported: 0
  };
  for (const item of requirements) {
    const status = String(item?.status || "NOT_REPORTED").toUpperCase();
    if (status === "PASSED") counts.passed += 1;
    else if (status === "FAILED") counts.failed += 1;
    else if (status === "EXCEEDED") counts.exceeded += 1;
    else if (status === "PARTIALLY_PASSED") counts.partiallyPassed += 1;
    else counts.notReported += 1;
  }
  counts.reportedRequirements = counts.totalRequirements - counts.notReported;
  return Object.entries(counts).every(([key, value]) => assessment[key] === value);
}

function hasEvaluationEvidence(evaluation = {}) {
  const requirements = Array.isArray(evaluation?.requirements) ? evaluation.requirements : [];
  return requirements.some((item) => REPORTED_STATUSES.has(String(item?.status || "").toUpperCase()))
    || materialAssessment(evaluation?.requirementsAssessment);
}

function mergeEvaluationIntoDefinitions(definitions = [], evaluated = []) {
  return (Array.isArray(definitions) ? definitions : []).map((definition) => {
    const actual = (Array.isArray(evaluated) ? evaluated : []).find((item) => requirementKeys(item).some((key) => requirementKeys(definition).includes(key)));
    if (!actual) return definition;
    return {
      ...definition,
      actualValue: actual.actualValue ?? null,
      actualDisplay: actual.actualDisplay || null,
      actualRaw: actual.actualRaw ?? null,
      direction: actual.direction || "unknown",
      impact: actual.impact || "unknown",
      status: actual.status || "NOT_REPORTED",
      evaluationNote: actual.evaluationNote || null
    };
  });
}

function compareEvaluationCandidates(left, right) {
  const leftReported = (left.previousRequirementsEvaluation?.requirements || []).filter((item) => REPORTED_STATUSES.has(String(item?.status || "").toUpperCase())).length;
  const rightReported = (right.previousRequirementsEvaluation?.requirements || []).filter((item) => REPORTED_STATUSES.has(String(item?.status || "").toUpperCase())).length;
  if (leftReported !== rightReported) return rightReported - leftReported;
  return dateValue(right) - dateValue(left);
}

function scenarioByName(scenarios = {}, name) {
  const key = Object.keys(scenarios).find((item) => item.toLowerCase() === name);
  return key ? scenarios[key] : null;
}

function materialAssessment(value) {
  if (!value || typeof value !== "object") return false;
  return Number.isFinite(value.weightedAchievement)
    || Number.isFinite(value.reportedRequirements)
    || Boolean(String(value.overallStatus || "").trim())
    || Boolean(String(value.summary || "").trim());
}

function requirementKeys(item = {}) {
  return [item.id, item.metric, item.name, item.arabicName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function dateValue(report = {}) {
  const value = report.metadata?.updatedAt || report.metadata?.importedAt || report.analysisDate || 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureStyles() {
  if (document.getElementById("franklin-financial-safety-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-financial-safety-styles";
  style.textContent = `
    .franklin-price-asof{display:block;margin-top:6px;font-size:10px;color:var(--muted,#9aa1b6);direction:ltr;text-align:start}
    .franklin-financial-safety-banner{margin:10px 14px 14px;padding:13px 14px;border:1px solid rgba(245,158,11,.45);border-radius:14px;background:rgba(245,158,11,.08);color:var(--ink,#fff);line-height:1.65}
    .franklin-financial-safety-banner.critical{border-color:rgba(244,63,94,.52);background:rgba(244,63,94,.08)}
    .franklin-financial-safety-banner strong{display:block;margin-bottom:4px;font-size:13px}
    .franklin-financial-safety-banner p{margin:0;font-size:12px;color:var(--ink-soft,#c5cad8)}
    .franklin-financial-safety-banner .critical-line{margin-top:8px;color:#fda4af;font-weight:700}
  `;
  document.head.append(style);
}
